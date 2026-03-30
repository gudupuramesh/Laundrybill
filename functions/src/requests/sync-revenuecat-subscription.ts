import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

type SyncPayload = {
    shopId: string;
    planId: string;
    productIdentifier: string;
    expirationDate: string | null;
    isActive: boolean;
    willRenew: boolean;
    store: string;
};

/**
 * Called from the mobile app after a RevenueCat purchase/restore
 * to sync entitlement state into Firestore (subscriptions/{shopId}).
 *
 * This is a lightweight "optimistic" sync so the app sees the change
 * immediately. The RevenueCat webhook is the authoritative source and
 * will overwrite on renewal/cancellation/expiry.
 */
export const syncRevenueCatSubscription = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const data = request.data as SyncPayload;
    const { shopId, planId, productIdentifier, expirationDate, isActive, willRenew, store } = data || {};

    if (!shopId || !planId) {
        throw new HttpsError("invalid-argument", "Missing shopId or planId.");
    }

    const now = admin.firestore.Timestamp.now();
    const subRef = db.collection("subscriptions").doc(shopId);

    const provider =
        store === "app_store" ? "apple_iap"
            : store === "play_store" ? "google_play"
                : `revenuecat_${store || "unknown"}`;

    const endDate = expirationDate
        ? admin.firestore.Timestamp.fromDate(new Date(expirationDate))
        : null;

    const billingCycle = productIdentifier.includes("yearly") || productIdentifier.includes("annual")
        ? "yearly"
        : productIdentifier.includes("lifetime")
            ? "lifetime"
            : "monthly";

    await subRef.set({
        shopId,
        planId,
        planName: planId === "pro" ? "Pro" : planId,
        billingCycle,
        status: isActive ? "active" : "expired",
        provider,
        providerRef: `rc_${productIdentifier}`,
        isAutoRenew: willRenew,
        purchaseState: isActive ? "active" : "expired",
        currentPeriodStart: now,
        ...(endDate ? { currentPeriodEnd: endDate, endDate } : {}),
        updatedAt: now,
        lastPaymentDate: now,
        lastPurchaseError: null,
    }, { merge: true });

    return { success: true, status: isActive ? "active" : "expired" };
});
