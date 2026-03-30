import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentWritten, onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as dotenv from "dotenv";
import { sendEmail } from "./services/zeptomail";
import { getPlatformSettings } from "./services/platform-settings";
import { getTrialEndedTemplate } from "./services/email-trial";
import { getTrialReminderTemplate } from "./services/email-trial-reminder";
import { getGraceEndedTemplate } from "./services/email-grace";
import { getGraceReminderTemplate } from "./services/email-grace-reminder";
import { getSubscriptionEndedTemplate } from "./services/email-cancelled";
import { normalizePlanId, planDisplayName } from "./lib/plan-normalize";

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

                // 1. Update Subscription Status
                batch.update(doc.ref, {
                    status: "expired",
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
 * Create trial subscription when a new shop is created.
 * Trial duration and plan come from platformSettings/subscription (Super Admin config).
 */
export const createTrialSubscriptionOnShopCreate = onDocumentCreated("shops/{shopId}", async (event) => {
    const shopId = event.params.shopId;
    const shopData = event.data?.data();

    if (!shopId || !shopData) {
        console.log("Missing shop data for trial creation.");
        return;
    }

    try {
        const { getTrialConfig, getTrialPlanName } = await import("./services/trial-config");
        const config = await getTrialConfig();

        const subRef = db.collection("subscriptions").doc(shopId);
        const existingSub = await subRef.get();

        if (existingSub.exists) {
            console.log(`Subscription already exists for shop ${shopId}. Skipping trial creation.`);
            return;
        }

        const now = admin.firestore.Timestamp.now();
        const trialDays = config.trialDurationDays;
        const trialEnd = new Date(now.toDate().getTime());
        trialEnd.setDate(trialEnd.getDate() + trialDays);

        const trialEndTs = admin.firestore.Timestamp.fromDate(trialEnd);
        const planName = getTrialPlanName(config.trialPlanId);

        await subRef.set({
            shopId,
            shopName: shopData.name || "",
            ownerEmail: shopData.email || "",
            ownerPhone: shopData.phone || "",
            planId: config.trialPlanId,
            planName,
            status: "trial",
            billingCycle: "monthly",
            trialStartDate: now,
            trialEndDate: trialEndTs,
            currentPeriodStart: now,
            currentPeriodEnd: trialEndTs,
            endDate: trialEndTs,
            createdAt: now,
            updatedAt: now,
        });

        console.log(`Trial subscription created for shop ${shopId}: ${planName} for ${trialDays} days (ends ${trialEnd.toISOString()}).`);

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
 * Check for expired trials daily (00:05).
 * Downgrades expired trials to Free plan.
 */
export const checkTrialExpiry = onSchedule("every day 00:05", async (event) => {
    console.log("Starting daily trial expiry check...");

    const now = admin.firestore.Timestamp.now();

    try {
        const settings = await getPlatformSettings();
        const upgradeUrl = `${settings.appUrl}/settings/subscription`;
        const emailPromises: Promise<unknown>[] = [];

        const expiredTrialsSnapshot = await db.collection("subscriptions")
            .where("status", "==", "trial")
            .where("trialEndDate", "<=", now)
            .get();

        if (expiredTrialsSnapshot.empty) {
            console.log("No expired trials found.");
            return;
        }

        console.log(`Found ${expiredTrialsSnapshot.size} expired trials.`);

        const chunks = [];
        let currentChunk = [];

        for (const doc of expiredTrialsSnapshot.docs) {
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

                console.log(`Expiring trial for shop: ${shopId}`);

                batch.update(doc.ref, {
                    status: "free",
                    planId: "free",
                    planName: "Free",
                    trialExpiredAt: now,
                    expiredAt: now,
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

                if (shopId) {
                    emailPromises.push((async () => {
                        const shopDoc = await db.collection("shops").doc(shopId).get();
                        const shopData = shopDoc.data();
                        const ownerEmail = shopData?.email || shopData?.ownerEmail || subData.userEmail;

                        if (!ownerEmail) {
                            console.warn(`No email found for shop ${shopId}, skipping trial ended email.`);
                            return;
                        }

                        const shopName = shopData?.name || "Shop Owner";
                        const trialEndDate = subData.trialEndDate?.toDate?.()
                            ? subData.trialEndDate.toDate().toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "long",
                                year: "numeric"
                            })
                            : new Date().toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "long",
                                year: "numeric"
                            });

                        const htmlBody = getTrialEndedTemplate({
                            shopName,
                            trialEndDate,
                            upgradeUrl,
                            settings,
                        });

                        await sendEmail({
                            to: [{ address: ownerEmail, name: shopName }],
                            subject: "Your LaundryBill trial has ended",
                            htmlBody,
                        });
                    })());
                }
            }

            await batch.commit();
        }

        await Promise.all(emailPromises);

        console.log("Trial expiry check completed successfully.");
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
        const settings = await getPlatformSettings();
        const upgradeUrl = `${settings.appUrl}/settings/subscription`;
        const emailPromises: Promise<unknown>[] = [];

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

                if (shopId) {
                    emailPromises.push((async () => {
                        const shopDoc = await db.collection("shops").doc(shopId).get();
                        const shopData = shopDoc.data();
                        const ownerEmail = shopData?.email || shopData?.ownerEmail || subData.userEmail;

                        if (!ownerEmail) {
                            console.warn(`No email found for shop ${shopId}, skipping grace ended email.`);
                            return;
                        }

                        const shopName = shopData?.name || "Shop Owner";
                        const previousPlanName = subData.planName || "Premium";

                        const htmlBody = getGraceEndedTemplate({
                            shopName,
                            previousPlanName,
                            upgradeUrl,
                            settings,
                        });

                        await sendEmail({
                            to: [{ address: ownerEmail, name: shopName }],
                            subject: "Your LaundryBill subscription has expired",
                            htmlBody,
                        });
                    })());
                }
            }

            await batch.commit();
        }

        await Promise.all(emailPromises);

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
        const settings = await getPlatformSettings();
        const upgradeUrl = `${settings.appUrl}/settings/subscription`;
        const emailPromises: Promise<unknown>[] = [];

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

                if (shopId) {
                    emailPromises.push((async () => {
                        const shopDoc = await db.collection("shops").doc(shopId).get();
                        const shopData = shopDoc.data();
                        const ownerEmail = shopData?.email || shopData?.ownerEmail || subData.userEmail;

                        if (!ownerEmail) {
                            console.warn(`No email found for shop ${shopId}, skipping subscription ended email.`);
                            return;
                        }

                        const shopName = shopData?.name || "Shop Owner";
                        const previousPlanName = subData.planName || "Premium";

                        const htmlBody = getSubscriptionEndedTemplate({
                            shopName,
                            previousPlanName,
                            upgradeUrl,
                            settings,
                        });

                        await sendEmail({
                            to: [{ address: ownerEmail, name: shopName }],
                            subject: "Your LaundryBill subscription has ended",
                            htmlBody,
                        });
                    })());
                }
            }

            await batch.commit();
        }

        await Promise.all(emailPromises);

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

/**
 * Send trial reminder emails daily at 09:05.
 * Sends when 7, 3, or 1 days left in trial (tracked via lastTrialReminderSent).
 */
export const sendTrialReminders = onSchedule("every day 09:05", async (event) => {
    console.log("Starting daily trial reminder check...");

    const now = new Date();

    try {
        const settings = await getPlatformSettings();
        const upgradeUrl = `${settings.appUrl}/settings/subscription`;

        const trialSnapshot = await db.collection("subscriptions")
            .where("status", "==", "trial")
            .get();

        if (trialSnapshot.empty) {
            console.log("No trial subscriptions found.");
            return;
        }

        let sent = 0;
        for (const doc of trialSnapshot.docs) {
            const sub = doc.data();
            const shopId = sub.shopId || doc.id;
            const trialEnd = sub.trialEndDate?.toDate?.();
            if (!trialEnd) continue;

            const diffMs = trialEnd.getTime() - now.getTime();
            const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            if (daysLeft < 0) continue;

            const targetDays = [7, 3, 1];
            const lastSent = sub.lastTrialReminderSent ?? 999;
            if (!targetDays.includes(daysLeft) || lastSent <= daysLeft) continue;

            const shopDoc = await db.collection("shops").doc(shopId).get();
            const shopData = shopDoc.data();
            const ownerEmail = shopData?.email || shopData?.ownerEmail || sub.userEmail;
            if (!ownerEmail) continue;

            const shopName = shopData?.name || "Shop Owner";
            const trialEndStr = trialEnd.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
            const htmlBody = getTrialReminderTemplate({
                shopName,
                daysLeft,
                trialEndDate: trialEndStr,
                upgradeUrl,
                settings,
            });

            await sendEmail({
                to: [{ address: ownerEmail, name: shopName }],
                subject: daysLeft === 1 ? "Your LaundryBill trial ends tomorrow" : `Your LaundryBill trial: ${daysLeft} days left`,
                htmlBody,
            });

            await doc.ref.update({
                lastTrialReminderSent: daysLeft,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            sent++;
        }

        console.log(`Trial reminders: sent ${sent}.`);
    } catch (error) {
        console.error("Error sending trial reminders:", error);
    }
});

/**
 * Send grace period reminder emails daily at 09:10.
 * Sends on day 1, 3, 5, 7 of grace (tracked via lastGraceReminderDay).
 */
export const sendGraceReminders = onSchedule("every day 09:10", async (event) => {
    console.log("Starting daily grace period reminder check...");

    const now = new Date();

    try {
        const settings = await getPlatformSettings();
        const updatePaymentUrl = `${settings.appUrl}/settings/subscription`;

        const graceSnapshot = await db.collection("subscriptions")
            .where("status", "==", "grace_period")
            .get();

        if (graceSnapshot.empty) {
            console.log("No grace period subscriptions found.");
            return;
        }

        let sent = 0;
        for (const doc of graceSnapshot.docs) {
            const sub = doc.data();
            const shopId = sub.shopId || doc.id;
            const graceEnd = sub.graceEndDate?.toDate?.();
            const lastFailed = sub.lastFailedPaymentDate?.toDate?.();
            if (!graceEnd || !lastFailed) continue;

            const msSinceGraceStart = now.getTime() - lastFailed.getTime();
            const dayOfGrace = Math.floor(msSinceGraceStart / (1000 * 60 * 60 * 24)) + 1;
            const targetDays = [1, 3, 5, 7];
            if (!targetDays.includes(dayOfGrace)) continue;
            if (sub.lastGraceReminderDay === dayOfGrace) continue;

            const msLeft = graceEnd.getTime() - now.getTime();
            const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
            const graceEndStr = graceEnd.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

            const shopDoc = await db.collection("shops").doc(shopId).get();
            const shopData = shopDoc.data();
            const ownerEmail = shopData?.email || shopData?.ownerEmail || sub.userEmail;
            if (!ownerEmail) continue;

            const shopName = shopData?.name || "Shop Owner";
            const planName = sub.planName || "Premium";
            const htmlBody = getGraceReminderTemplate({
                shopName,
                planName,
                dayOfGrace,
                daysLeft,
                graceEndDate: graceEndStr,
                updatePaymentUrl,
                settings,
            });

            await sendEmail({
                to: [{ address: ownerEmail, name: shopName }],
                subject: dayOfGrace === 7 ? "Final notice: Your LaundryBill subscription will be downgraded today" : `Action required: Update payment (Day ${dayOfGrace} of grace)`,
                htmlBody,
            });

            await doc.ref.update({
                lastGraceReminderDay: dayOfGrace,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            sent++;
        }

        console.log(`Grace reminders: sent ${sent}.`);
    } catch (error) {
        console.error("Error sending grace reminders:", error);
    }
});

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
export * from "./notifications/expiry-check";
export * from "./notifications/test-email";
export * from "./notifications/welcome-email";
export * from "./notifications/upgrade-email";

/**
 * Auth Functions
 */
export * from "./auth";

/**
 * Scheduled: cleanup order images from R2 (completed orders older than 30 days)
 */
export { cleanupOrderImagesDaily } from "./scheduled/cleanup-order-images";

export * from "./requests/create-public-order";
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

// Push notifications (scheduled + admin callable)
export * from "./scheduled/push-notifications";

