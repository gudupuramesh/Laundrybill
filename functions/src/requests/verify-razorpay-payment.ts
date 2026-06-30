/**
 * Verify a Razorpay subscription payment (called from the web checkout handler).
 *
 * Confirms the signature, then optimistically activates the plan so the UI updates
 * immediately. The razorpayWebhook remains the durable source of truth and will
 * reconcile on every monthly charge.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } from "../lib/secrets";
import { verifyPaymentSignature, rzpFetchSubscription } from "../services/razorpay";
import { normalizePlanId, planDisplayName } from "../lib/plan-normalize";

if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();

export const verifyRazorpayPayment = onCall(
    { secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "You must be signed in.");
        }
        const uid = request.auth.uid;
        const {
            shopId,
            razorpay_payment_id: paymentId,
            razorpay_subscription_id: subscriptionId,
            razorpay_signature: signature,
        } = request.data || {};

        if (!shopId || !paymentId || !subscriptionId || !signature) {
            throw new HttpsError("invalid-argument", "Missing payment verification fields.");
        }

        if (!verifyPaymentSignature({ paymentId, subscriptionId, signature })) {
            throw new HttpsError("permission-denied", "Payment signature verification failed.");
        }

        // Ownership check
        const shopSnap = await db.collection("shops").doc(shopId).get();
        if (!shopSnap.exists) {
            throw new HttpsError("not-found", "Shop not found.");
        }
        const shop = shopSnap.data() || {};
        const ownerId = shop.ownerId ?? shop.userId;
        if (ownerId && ownerId !== uid) {
            throw new HttpsError("permission-denied", "Not your shop.");
        }

        // Resolve the plan + period from Razorpay (notes are the source of truth).
        let planId: string = "pro_plus";
        let currentEnd: number | null = null;
        try {
            const sub = await rzpFetchSubscription(subscriptionId);
            planId = normalizePlanId(sub?.notes?.planId || "pro_plus");
            currentEnd = sub?.current_end ? Number(sub.current_end) : null;
        } catch (e) {
            console.warn("verifyRazorpayPayment: fetch subscription failed, defaulting to pro_plus", e);
        }

        const now = admin.firestore.Timestamp.now();
        const periodEnd = currentEnd ? admin.firestore.Timestamp.fromMillis(currentEnd * 1000) : null;

        await db.collection("subscriptions").doc(shopId).set(
            {
                shopId,
                planId,
                planName: planDisplayName(planId),
                status: "active",
                billingCycle: "monthly",
                provider: "razorpay",
                providerRef: subscriptionId,
                isAutoRenew: true,
                purchaseState: "active",
                ...(periodEnd ? { currentPeriodEnd: periodEnd, endDate: periodEnd } : {}),
                lastPaymentDate: now,
                lastPurchaseError: null,
                pendingRazorpay: admin.firestore.FieldValue.delete(),
                updatedAt: now,
            },
            { merge: true },
        );

        return { success: true, planId };
    },
);
