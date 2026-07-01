import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentWritten, onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as dotenv from "dotenv";
import { normalizePlanId, planDisplayName } from "./lib/plan-normalize";
import { getTrialConfig } from "./services/trial-config";

dotenv.config();

if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();

/**
 * Check for expired active subscriptions daily at midnight.
 * Downgrades expired shops to 'free' plan.
 */
export const checkSubscriptionExpiration = onSchedule("every day 00:00", async (event) => {
    console.log("Starting daily active subscription expiration check...");

    const now = admin.firestore.Timestamp.now();

    try {
        // Query active subscriptions that have passed their end date
        const expiredSubsSnapshot = await db.collection("subscriptions")
            .where("status", "==", "active")
            .where("endDate", "<", now)
            .get();

        if (expiredSubsSnapshot.empty) {
            console.log("No expired subscriptions found.");
            return;
        }

        console.log(`Found ${expiredSubsSnapshot.size} expired subscriptions.`);

        // Process in chunks of 400 to respect batch limits
        const chunks = [];
        let currentChunk = [];

        for (const doc of expiredSubsSnapshot.docs) {
            currentChunk.push(doc);
            if (currentChunk.length >= 400) {
                chunks.push(currentChunk);
                currentChunk = [];
            }
        }
        if (currentChunk.length > 0) chunks.push(currentChunk);

        // Execute batches
        for (const chunk of chunks) {
            const batch = db.batch();

            for (const doc of chunk) {
                const subData = doc.data();
                const shopId = subData.shopId; // Assumes shopId is stored in sub

                console.log(`Processing expired subscription for shop: ${shopId}`);

                // 1. Update Subscription Status + downgrade the plan.
                // Must also flip planId/planName to "free" (not just status): the native
                // owner-mobile + Team apps read plan limits from the subscription's planId,
                // so without this a lapsed Pro+ still resolves unlimited orders and staff/
                // driver/plant/manager can keep creating orders. Mirrors the Razorpay webhook.
                batch.update(doc.ref, {
                    status: "expired",
                    planId: "free",
                    planName: "Free",
                    updatedAt: now,
                    expiredAt: now,
                });


                // 2. Update Shop Plan to FREE
                if (shopId) {
                    const shopRef = db.collection("shops").doc(shopId);
                    batch.update(shopRef, {
                        plan: "free",
                        subscriptionStatus: "expired",
                        "subscription.planId": "free",
                        "subscription.status": "expired",
                        "subscription.endDate": null,
                        updatedAt: now
                    });
                }
            }

            await batch.commit();
        }

        console.log("Expiration check completed successfully.");

    } catch (error) {
        console.error("Error running expiration check:", error);
    }
});

/**
 * Create free subscription when a new shop is created.
 * New shops always start on the Free plan.
 */
export const createTrialSubscriptionOnShopCreate = onDocumentCreated("shops/{shopId}", async (event) => {
    const shopId = event.params.shopId;
    const shopData = event.data?.data();

    if (!shopId || !shopData) {
        console.log("Missing shop data for subscription creation.");
        return;
    }

    try {
        const subRef = db.collection("subscriptions").doc(shopId);
        const existingSub = await subRef.get();

        if (existingSub.exists) {
            console.log(`Subscription already exists for shop ${shopId}. Skipping.`);
            return;
        }

        const now = admin.firestore.Timestamp.now();

        // Order-based trial: the shop gets the trial plan's features (Pro by default)
        // for the first N orders, after which `meterTrialOrderOnCreate` converts it to Free.
        const trial = await getTrialConfig();
        const trialPlanId = normalizePlanId(trial.trialPlanId || "pro");

        await subRef.set({
            shopId,
            shopName: shopData.name || "",
            ownerEmail: shopData.email || "",
            ownerPhone: shopData.phone || "",
            planId: trialPlanId,
            planName: `${planDisplayName(trialPlanId)} (Trial)`,
            status: "trial",
            billingCycle: "monthly",
            trialOrderLimit: trial.trialOrderLimit,
            trialOrdersUsed: 0,
            trialStartedAt: now,
            createdAt: now,
            updatedAt: now,
        });

        console.log(`Trial subscription (${trialPlanId}, ${trial.trialOrderLimit} orders) created for shop ${shopId}.`);

        // --- Notify all Super Admins about new shop registration ---
        try {
            const tokensSnapshot = await db.collection("superAdminNotificationTokens").get();
            const tokens: string[] = [];
            tokensSnapshot.docs.forEach((d) => {
                const t = d.data().token;
                if (t && typeof t === "string") tokens.push(t);
            });

            if (tokens.length > 0) {
                const shopName = shopData.name || "New shop";
                const shopPhone = shopData.phone || "";
                const shopEmail = shopData.email || "";
                const contactInfo = [shopPhone, shopEmail].filter(Boolean).join(" | ");
                const city = shopData.location?.city || "";
                const state = shopData.location?.state || "";
                const locationInfo = [city, state].filter(Boolean).join(", ");

                const results = await Promise.allSettled(
                    tokens.map((token) =>
                        admin.messaging().send({
                            token,
                            notification: {
                                title: `New shop registered: ${shopName}`,
                                body: [locationInfo, contactInfo].filter(Boolean).join(" — ") || "A new shop just signed up!",
                            },
                            data: {
                                type: "new_shop_registered",
                                shopId,
                                shopName,
                            },
                        })
                    )
                );
                const sent = results.filter((r) => r.status === "fulfilled").length;
                console.log(`Super Admin notification sent to ${sent}/${tokens.length} device(s) for new shop ${shopId}.`);
            }
        } catch (notifErr) {
            console.warn("Failed to send Super Admin notification for new shop:", notifErr);
        }
    } catch (error) {
        console.error(`Failed to create trial subscription for shop ${shopId}:`, error);
    }
});

/**
 * Order-metered trial. Each new order created by a trial shop consumes one trial order;
 * once `trialOrdersUsed` reaches `trialOrderLimit` the subscription is converted to Free
 * (so the shop keeps the basic plan but loses Pro until they subscribe). Counted in a
 * transaction so concurrent order creates can't over-count.
 */
export const meterTrialOrderOnCreate = onDocumentCreated("shops/{shopId}/orders/{orderId}", async (event) => {
    const shopId = event.params.shopId;
    if (!shopId) return;
    const subRef = db.collection("subscriptions").doc(shopId);
    try {
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(subRef);
            if (!snap.exists) return;
            const sub = snap.data() || {};
            if (sub.status !== "trial") return; // only meter active trials

            const rawLimit = Number(sub.trialOrderLimit);
            const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 10;
            const used = Number(sub.trialOrdersUsed || 0) + 1;
            const now = admin.firestore.Timestamp.now();

            if (used >= limit) {
                tx.update(subRef, {
                    trialOrdersUsed: used,
                    status: "free",
                    planId: "free",
                    planName: "Free",
                    trialExpiredAt: now,
                    updatedAt: now,
                });
            } else {
                tx.update(subRef, { trialOrdersUsed: used, updatedAt: now });
            }
        });
    } catch (e) {
        console.error(`meterTrialOrderOnCreate failed for shop ${shopId}:`, e);
    }
});

/**
 * Migrate remaining trial subscriptions to free (cleanup).
 * Runs daily at 00:05 to convert any legacy trial users to free plan.
 */
export const checkTrialExpiry = onSchedule("every day 00:05", async (event) => {
    console.log("Starting trial expiry check...");

    const now = admin.firestore.Timestamp.now();

    try {
        // Only migrate trial subscriptions whose endDate has passed
        const trialSnapshot = await db.collection("subscriptions")
            .where("status", "==", "trial")
            .where("endDate", "<=", now)
            .get();

        if (trialSnapshot.empty) {
            console.log("No expired trial subscriptions found.");
            return;
        }

        console.log(`Found ${trialSnapshot.size} expired trial subscriptions to migrate to free.`);

        const chunks = [];
        let currentChunk: FirebaseFirestore.QueryDocumentSnapshot[] = [];

        for (const doc of trialSnapshot.docs) {
            currentChunk.push(doc);
            if (currentChunk.length >= 400) {
                chunks.push(currentChunk);
                currentChunk = [];
            }
        }
        if (currentChunk.length > 0) chunks.push(currentChunk);

        for (const chunk of chunks) {
            const batch = db.batch();

            for (const doc of chunk) {
                const subData = doc.data();
                const shopId = subData.shopId;

                batch.update(doc.ref, {
                    status: "free",
                    planId: "free",
                    planName: "Free",
                    trialExpiredAt: now,
                    endDate: null,
                    currentPeriodEnd: null,
                    updatedAt: now,
                });

                if (shopId) {
                    const shopRef = db.collection("shops").doc(shopId);
                    batch.update(shopRef, {
                        plan: "free",
                        subscriptionStatus: "free",
                        "subscription.planId": "free",
                        "subscription.status": "free",
                        "subscription.endDate": null,
                        updatedAt: now,
                    });
                }
            }

            await batch.commit();
        }

        console.log("Trial expiry check completed.");
    } catch (error) {
        console.error("Error running trial expiry check:", error);
    }
});

/**
 * Check for grace period expiry daily (00:10).
 * Downgrades grace period subscriptions to Free plan.
 */
export const checkGracePeriodExpiry = onSchedule("every day 00:10", async (event) => {
    console.log("Starting daily grace period expiry check...");

    const now = admin.firestore.Timestamp.now();

    try {
        const graceExpiredSnapshot = await db.collection("subscriptions")
            .where("status", "==", "grace_period")
            .where("graceEndDate", "<=", now)
            .get();

        if (graceExpiredSnapshot.empty) {
            console.log("No grace period expirations found.");
            return;
        }

        console.log(`Found ${graceExpiredSnapshot.size} subscriptions ending grace period.`);

        const chunks = [];
        let currentChunk = [];

        for (const doc of graceExpiredSnapshot.docs) {
            currentChunk.push(doc);
            if (currentChunk.length >= 400) {
                chunks.push(currentChunk);
                currentChunk = [];
            }
        }
        if (currentChunk.length > 0) chunks.push(currentChunk);

        for (const chunk of chunks) {
            const batch = db.batch();

            for (const doc of chunk) {
                const subData = doc.data();
                const shopId = subData.shopId;

                console.log(`Grace period ended for shop: ${shopId}`);

                batch.update(doc.ref, {
                    status: "expired",
                    previousPlanId: subData.planId || "free",
                    planId: "free",
                    planName: "Free",
                    expiredAt: now,
                    endDate: null,
                    currentPeriodEnd: null,
                    updatedAt: now,
                });

                if (shopId) {
                    const shopRef = db.collection("shops").doc(shopId);
                    batch.update(shopRef, {
                        plan: "free",
                        subscriptionStatus: "expired",
                        "subscription.planId": "free",
                        "subscription.status": "expired",
                        "subscription.endDate": null,
                        updatedAt: now,
                    });
                }
            }

            await batch.commit();
        }

        console.log("Grace period expiry check completed successfully.");
    } catch (error) {
        console.error("Error running grace period expiry check:", error);
    }
});

/**
 * Check for cancelled subscriptions whose period has ended (00:15).
 */
export const checkCancelledSubscriptionEnd = onSchedule("every day 00:15", async (event) => {
    console.log("Starting daily cancelled subscription end check...");

    const now = admin.firestore.Timestamp.now();

    try {
        const cancelledSnapshot = await db.collection("subscriptions")
            .where("status", "==", "cancelled")
            .where("activeUntil", "<=", now)
            .get();

        if (cancelledSnapshot.empty) {
            console.log("No cancelled subscriptions to expire.");
            return;
        }

        console.log(`Found ${cancelledSnapshot.size} cancelled subscriptions ending today.`);

        const chunks = [];
        let currentChunk = [];

        for (const doc of cancelledSnapshot.docs) {
            currentChunk.push(doc);
            if (currentChunk.length >= 400) {
                chunks.push(currentChunk);
                currentChunk = [];
            }
        }
        if (currentChunk.length > 0) chunks.push(currentChunk);

        for (const chunk of chunks) {
            const batch = db.batch();

            for (const doc of chunk) {
                const subData = doc.data();
                const shopId = subData.shopId;

                console.log(`Cancelled period ended for shop: ${shopId}`);

                batch.update(doc.ref, {
                    status: "expired",
                    previousPlanId: subData.planId || "free",
                    planId: "free",
                    planName: "Free",
                    expiredAt: now,
                    endDate: null,
                    currentPeriodEnd: null,
                    activeUntil: null,
                    updatedAt: now,
                });

                if (shopId) {
                    const shopRef = db.collection("shops").doc(shopId);
                    batch.update(shopRef, {
                        plan: "free",
                        subscriptionStatus: "expired",
                        "subscription.planId": "free",
                        "subscription.status": "expired",
                        "subscription.endDate": null,
                        updatedAt: now,
                    });
                }
            }

            await batch.commit();
        }

        console.log("Cancelled subscription end check completed successfully.");
    } catch (error) {
        console.error("Error running cancelled subscription end check:", error);
    }
});

/**
 * Apply scheduled downgrades daily at 00:20.
 * Subs with pendingDowngrade and effectiveDate <= now → switch to lower plan.
 */
export const applyScheduledDowngrades = onSchedule("every day 00:20", async (event) => {
    console.log("Starting scheduled downgrade check...");

    const now = admin.firestore.Timestamp.now();

    try {
        const activeSnapshot = await db.collection("subscriptions")
            .where("status", "in", ["active", "trial"])
            .get();

        const toApply: admin.firestore.QueryDocumentSnapshot[] = [];
        for (const doc of activeSnapshot.docs) {
            const d = doc.data();
            const pd = d.pendingDowngrade;
            if (!pd?.toPlan || !pd?.effectiveDate) continue;
            const eff = pd.effectiveDate?.toDate?.();
            if (!eff || eff > now.toDate()) continue;
            toApply.push(doc);
        }

        if (toApply.length === 0) {
            console.log("No scheduled downgrades to apply.");
            return;
        }

        console.log(`Applying ${toApply.length} scheduled downgrades.`);

        for (const doc of toApply) {
            const subData = doc.data();
            const shopId = subData.shopId || doc.id;
            const toPlan = normalizePlanId(subData.pendingDowngrade.toPlan);
            const planName = planDisplayName(toPlan);

            await doc.ref.update({
                planId: toPlan,
                planName,
                previousPlanId: subData.planId || "free",
                pendingDowngrade: admin.firestore.FieldValue.delete(),
                downgradedAt: now,
                updatedAt: now,
            });

            // syncSubscriptionToShop trigger will update the shop from this subscription doc
            console.log(`Downgrade applied for shop ${shopId} → ${toPlan}`);
        }

        console.log("Scheduled downgrade check completed.");
    } catch (error) {
        console.error("Error applying scheduled downgrades:", error);
    }
});

// Email reminder functions removed — Google/RevenueCat handles subscription emails.
// Push notifications (sendUpgradeReminders, sendAdminNotification) handle user engagement.

/**
 * Sync Subscription changes to Shop Profile.
 * This ensures the Shop document always reflects the latest Plan/Status
 * regardless of how the subscription was updated (Admin, Stripe, Background Job).
 */
export const syncSubscriptionToShop = onDocumentWritten("subscriptions/{subscriptionId}", async (event) => {
    const subscriptionId = event.params.subscriptionId;
    const newData = event.data?.after.data();

    // If deleted, we might want to revert logic, but mostly we care about Updates/Creates
    if (!newData) {
        console.log(`Subscription ${subscriptionId} deleted.`);
        return;
    }

    const shopId = newData.shopId || subscriptionId; // Fallback attempts
    console.log(`Syncing subscription ${subscriptionId} to shop ${shopId}...`);

    if (!shopId) {
        console.error("No shopId found in subscription document.");
        return;
    }

    try {
        const shopRef = db.collection("shops").doc(shopId);
        const status = newData.status || "free";

        // ============================================
        // CRITICAL: Force plan to 'free' if expired
        // Cancelled stays active until activeUntil passes
        // ============================================
        let effectivePlanId = newData.planId || "free";

        if (status === "expired") {
            console.log(`Subscription status is "${status}" - forcing plan to "free" for shop ${shopId}`);
            effectivePlanId = "free";
        }

        if (status === "cancelled") {
            const activeUntil = newData.activeUntil?.toDate?.();
            const now = new Date();

            if (activeUntil && activeUntil > now) {
                console.log(`Subscription cancelled but active until ${activeUntil.toISOString()} for shop ${shopId}`);
            } else {
                console.log(`Subscription cancelled and inactive - forcing plan to "free" for shop ${shopId}`);
                effectivePlanId = "free";
            }
        }

        if (status === "free") {
            console.log(`Subscription status is "${status}" - forcing plan to "free" for shop ${shopId}`);
            effectivePlanId = "free";
        }

        // Prepare updates for Shop document
        // We replicate key subscription fields to the root of Shop for easy access/security rules
        await shopRef.update({
            plan: effectivePlanId,
            subscriptionStatus: status,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            // Nested subscription object for detailed access in UI
            subscription: {
                planId: effectivePlanId,
                status: status,
                endDate: newData.endDate || null,
                billingCycle: newData.billingCycle || "monthly"
            }
        });

        console.log(`Successfully synced plan '${effectivePlanId}' (status: ${status}) to shop ${shopId}.`);
    } catch (error) {
        console.error(`Error syncing to shop ${shopId}:`, error);
    }
});

/**
 * Notification Functions
 */
export * from "./notifications/welcome-email";

/**
 * Auth Functions
 */
export * from "./auth";

/**
 * Scheduled: cleanup order images from R2 (completed orders older than 30 days)
 */
export { cleanupOrderImagesDaily } from "./scheduled/cleanup-order-images";

export * from "./requests/create-public-order";
export * from "./requests/track-order";
export * from "./requests/get-public-order-slot-availability";
export * from "./triggers/on-public-order-created";
export * from "./triggers/on-order-updated";
export * from "./requests/manual-trigger";
export * from "./requests/cancel-subscription";
export * from "./requests/schedule-downgrade";
export * from "./requests/validate-coupon";
export * from "./requests/get-subscription-settings";
export * from "./requests/get-help-content";
export * from "./requests/validate-app-login-email";
export * from "./requests/verify-apple-purchase";
export * from "./requests/verify-google-purchase";
export * from "./requests/sync-revenuecat-subscription";
export * from "./requests/revenuecat-webhook";

// Razorpay recurring subscriptions (web) — Pro+ / Business
export * from "./requests/create-razorpay-subscription";
export * from "./requests/verify-razorpay-payment";
export * from "./requests/razorpay-webhook";

// Push notifications (scheduled + admin callable)
export * from "./scheduled/push-notifications";

