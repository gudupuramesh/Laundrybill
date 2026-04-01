"use strict";
/**
 * Cancel subscription at period end (user-initiated).
 * Sets status to cancelled, activeUntil = current period end.
 * Billing (Google Play / App Store) is managed in the store; this updates Firestore only.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelSubscriptionAtPeriodEnd = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
exports.cancelSubscriptionAtPeriodEnd = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d;
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "You must be signed in to cancel.");
    }
    const { shopId } = request.data;
    if (!shopId || typeof shopId !== "string") {
        throw new https_1.HttpsError("invalid-argument", "Missing or invalid shopId.");
    }
    const uid = request.auth.uid;
    try {
        const shopRef = db.collection("shops").doc(shopId);
        const shopDoc = await shopRef.get();
        if (!shopDoc.exists) {
            throw new https_1.HttpsError("not-found", "Shop not found.");
        }
        const shopData = shopDoc.data();
        const ownerId = (_a = shopData === null || shopData === void 0 ? void 0 : shopData.ownerId) !== null && _a !== void 0 ? _a : shopData === null || shopData === void 0 ? void 0 : shopData.userId;
        if (ownerId && ownerId !== uid) {
            throw new https_1.HttpsError("permission-denied", "You can only cancel your own shop's subscription.");
        }
        const subRef = db.collection("subscriptions").doc(shopId);
        const subDoc = await subRef.get();
        if (!subDoc.exists) {
            throw new https_1.HttpsError("failed-precondition", "No subscription found for this shop.");
        }
        const subData = subDoc.data();
        const status = subData === null || subData === void 0 ? void 0 : subData.status;
        if (status !== "active") {
            throw new https_1.HttpsError("failed-precondition", "Only active subscriptions can be cancelled.");
        }
        const now = admin.firestore.Timestamp.now();
        const activeUntil = (_c = (_b = subData === null || subData === void 0 ? void 0 : subData.currentPeriodEnd) !== null && _b !== void 0 ? _b : subData === null || subData === void 0 ? void 0 : subData.endDate) !== null && _c !== void 0 ? _c : now;
        await subRef.update({
            status: "cancelled",
            cancelledAt: now,
            cancelledBy: "user",
            activeUntil,
            updatedAt: now,
        });
        const activeUntilDate = (_d = activeUntil === null || activeUntil === void 0 ? void 0 : activeUntil.toDate) === null || _d === void 0 ? void 0 : _d.call(activeUntil);
        return {
            success: true,
            activeUntil: activeUntilDate ? activeUntilDate.toISOString() : null,
            message: "Subscription will end at the current period. You keep access until then.",
        };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        console.error("Cancel subscription error:", error);
        throw new https_1.HttpsError("internal", "Failed to cancel subscription.");
    }
});
//# sourceMappingURL=cancel-subscription.js.map