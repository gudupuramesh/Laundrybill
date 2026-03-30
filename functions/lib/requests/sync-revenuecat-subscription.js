"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncRevenueCatSubscription = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * Called from the mobile app after a RevenueCat purchase/restore
 * to sync entitlement state into Firestore (subscriptions/{shopId}).
 *
 * This is a lightweight "optimistic" sync so the app sees the change
 * immediately. The RevenueCat webhook is the authoritative source and
 * will overwrite on renewal/cancellation/expiry.
 */
exports.syncRevenueCatSubscription = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "User must be logged in.");
    }
    const data = request.data;
    const { shopId, planId, productIdentifier, expirationDate, isActive, willRenew, store } = data || {};
    if (!shopId || !planId) {
        throw new https_1.HttpsError("invalid-argument", "Missing shopId or planId.");
    }
    const now = admin.firestore.Timestamp.now();
    const subRef = db.collection("subscriptions").doc(shopId);
    const provider = store === "app_store" ? "apple_iap"
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
    await subRef.set(Object.assign(Object.assign({ shopId,
        planId, planName: planId === "pro" ? "Pro" : planId, billingCycle, status: isActive ? "active" : "expired", provider, providerRef: `rc_${productIdentifier}`, isAutoRenew: willRenew, purchaseState: isActive ? "active" : "expired", currentPeriodStart: now }, (endDate ? { currentPeriodEnd: endDate, endDate } : {})), { updatedAt: now, lastPaymentDate: now, lastPurchaseError: null }), { merge: true });
    return { success: true, status: isActive ? "active" : "expired" };
});
//# sourceMappingURL=sync-revenuecat-subscription.js.map