/**
 * Cancel subscription at period end (user-initiated).
 * Sets status to cancelled, activeUntil = current period end.
 * Billing (Google Play / App Store) is managed in the store; this updates Firestore only.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } from "../lib/secrets";
import { rzpCancelSubscription } from "../services/razorpay";

if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();

export const cancelSubscriptionAtPeriodEnd = onCall(
    { secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] },
    async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be signed in to cancel.");
    }

    const { shopId } = request.data;

    if (!shopId || typeof shopId !== "string") {
        throw new HttpsError("invalid-argument", "Missing or invalid shopId.");
    }

    const uid = request.auth.uid;

    try {
        const shopRef = db.collection("shops").doc(shopId);
        const shopDoc = await shopRef.get();
        if (!shopDoc.exists) {
            throw new HttpsError("not-found", "Shop not found.");
        }

        const shopData = shopDoc.data();
        const ownerId = shopData?.ownerId ?? shopData?.userId;
        if (ownerId && ownerId !== uid) {
            throw new HttpsError("permission-denied", "You can only cancel your own shop's subscription.");
        }

        const subRef = db.collection("subscriptions").doc(shopId);
        const subDoc = await subRef.get();
        if (!subDoc.exists) {
            throw new HttpsError("failed-precondition", "No subscription found for this shop.");
        }

        const subData = subDoc.data();
        const status = subData?.status;
        if (status !== "active") {
            throw new HttpsError("failed-precondition", "Only active subscriptions can be cancelled.");
        }

        const now = admin.firestore.Timestamp.now();
        const activeUntil = subData?.currentPeriodEnd ?? subData?.endDate ?? now;

        await subRef.update({
            status: "cancelled",
            cancelledAt: now,
            cancelledBy: "user",
            activeUntil,
            updatedAt: now,
        });

        // For Razorpay subscriptions, also cancel the recurring mandate at cycle end so
        // no further monthly charge is taken. (Store subs are managed in the store.)
        if (subData?.provider === "razorpay" && subData?.providerRef) {
            try {
                await rzpCancelSubscription(subData.providerRef, true);
            } catch (e) {
                // Don't fail the user's cancel if Razorpay errors — the webhook will reconcile.
                console.error("Razorpay cancel failed (Firestore already marked cancelled):", e);
            }
        }

        const activeUntilDate = activeUntil?.toDate?.();
        return {
            success: true,
            activeUntil: activeUntilDate ? activeUntilDate.toISOString() : null,
            message: "Subscription will end at the current period. You keep access until then.",
        };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error("Cancel subscription error:", error);
        throw new HttpsError("internal", "Failed to cancel subscription.");
    }
});
