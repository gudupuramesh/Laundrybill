/**
 * Create a Razorpay recurring subscription for a Pro+ / Business upgrade (web).
 *
 * Does NOT change the live plan — only records a pending pointer. The plan is
 * activated by verifyRazorpayPayment (instant) and/or the razorpayWebhook
 * (subscription.charged) which is the source of truth.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } from "../lib/secrets";
import { getRazorpayKeys, getRazorpayPlanId, rzpCreateSubscription } from "../services/razorpay";

if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();

export const createRazorpaySubscription = onCall(
    { secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "You must be signed in to subscribe.");
        }
        const uid = request.auth.uid;
        const { shopId, planId } = request.data || {};

        if (!shopId || typeof shopId !== "string") {
            throw new HttpsError("invalid-argument", "Missing or invalid shopId.");
        }
        if (planId !== "pro_plus" && planId !== "business") {
            throw new HttpsError("invalid-argument", "Plan must be 'pro_plus' or 'business'.");
        }

        // Ownership check (same pattern as cancelSubscriptionAtPeriodEnd)
        const shopSnap = await db.collection("shops").doc(shopId).get();
        if (!shopSnap.exists) {
            throw new HttpsError("not-found", "Shop not found.");
        }
        const shop = shopSnap.data() || {};
        const ownerId = shop.ownerId ?? shop.userId;
        if (ownerId && ownerId !== uid) {
            throw new HttpsError("permission-denied", "You can only subscribe for your own shop.");
        }

        const { keyId } = getRazorpayKeys();
        if (!keyId) {
            throw new HttpsError("failed-precondition", "Razorpay is not configured (missing key id).");
        }

        // India shops pay the base INR price; non-India shops pay the higher INR tier.
        const countryCode = String(shop.countryCode || shop.settings?.countryCode || "IN").toUpperCase();
        const region = countryCode === "IN" ? "india" : "intl";

        const rzpPlanId = await getRazorpayPlanId(planId, region);
        if (!rzpPlanId) {
            throw new HttpsError(
                "failed-precondition",
                `Razorpay plan id for ${planId} (${region}) is not set in platformSettings/subscription.`,
            );
        }

        let sub;
        try {
            sub = await rzpCreateSubscription({
                planId: rzpPlanId,
                notes: { shopId, planId, uid, region },
            });
        } catch (e: unknown) {
            const detail = (e as { response?: { data?: unknown }; message?: string })?.response?.data
                ?? (e as { message?: string })?.message ?? e;
            console.error("rzpCreateSubscription failed:", JSON.stringify(detail));
            throw new HttpsError("internal", "Could not start the subscription. Please try again.");
        }

        // Record a pending pointer; leave planId/status untouched until payment is verified.
        const now = admin.firestore.Timestamp.now();
        await db.collection("subscriptions").doc(shopId).set(
            {
                shopId,
                pendingRazorpay: {
                    subscriptionId: sub.id,
                    planId,
                    status: sub.status || "created",
                    createdAt: now,
                },
                updatedAt: now,
            },
            { merge: true },
        );

        return {
            subscriptionId: sub.id,
            keyId,
            shortUrl: sub.short_url || null,
            status: sub.status || "created",
        };
    },
);
