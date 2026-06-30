"use strict";
/**
 * Verify a Razorpay subscription payment (called from the web checkout handler).
 *
 * Confirms the signature, then optimistically activates the plan so the UI updates
 * immediately. The razorpayWebhook remains the durable source of truth and will
 * reconcile on every monthly charge.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRazorpayPayment = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const secrets_1 = require("../lib/secrets");
const razorpay_1 = require("../services/razorpay");
const plan_normalize_1 = require("../lib/plan-normalize");
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
exports.verifyRazorpayPayment = (0, https_1.onCall)({ secrets: [secrets_1.RAZORPAY_KEY_ID, secrets_1.RAZORPAY_KEY_SECRET] }, async (request) => {
    var _a, _b;
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "You must be signed in.");
    }
    const uid = request.auth.uid;
    const { shopId, razorpay_payment_id: paymentId, razorpay_subscription_id: subscriptionId, razorpay_signature: signature, } = request.data || {};
    if (!shopId || !paymentId || !subscriptionId || !signature) {
        throw new https_1.HttpsError("invalid-argument", "Missing payment verification fields.");
    }
    if (!(0, razorpay_1.verifyPaymentSignature)({ paymentId, subscriptionId, signature })) {
        throw new https_1.HttpsError("permission-denied", "Payment signature verification failed.");
    }
    // Ownership check
    const shopSnap = await db.collection("shops").doc(shopId).get();
    if (!shopSnap.exists) {
        throw new https_1.HttpsError("not-found", "Shop not found.");
    }
    const shop = shopSnap.data() || {};
    const ownerId = (_a = shop.ownerId) !== null && _a !== void 0 ? _a : shop.userId;
    if (ownerId && ownerId !== uid) {
        throw new https_1.HttpsError("permission-denied", "Not your shop.");
    }
    // Resolve the plan + period from Razorpay (notes are the source of truth).
    let planId = "pro_plus";
    let currentEnd = null;
    try {
        const sub = await (0, razorpay_1.rzpFetchSubscription)(subscriptionId);
        planId = (0, plan_normalize_1.normalizePlanId)(((_b = sub === null || sub === void 0 ? void 0 : sub.notes) === null || _b === void 0 ? void 0 : _b.planId) || "pro_plus");
        currentEnd = (sub === null || sub === void 0 ? void 0 : sub.current_end) ? Number(sub.current_end) : null;
    }
    catch (e) {
        console.warn("verifyRazorpayPayment: fetch subscription failed, defaulting to pro_plus", e);
    }
    const now = admin.firestore.Timestamp.now();
    const periodEnd = currentEnd ? admin.firestore.Timestamp.fromMillis(currentEnd * 1000) : null;
    await db.collection("subscriptions").doc(shopId).set(Object.assign(Object.assign({ shopId,
        planId, planName: (0, plan_normalize_1.planDisplayName)(planId), status: "active", billingCycle: "monthly", provider: "razorpay", providerRef: subscriptionId, isAutoRenew: true, purchaseState: "active" }, (periodEnd ? { currentPeriodEnd: periodEnd, endDate: periodEnd } : {})), { lastPaymentDate: now, lastPurchaseError: null, pendingRazorpay: admin.firestore.FieldValue.delete(), updatedAt: now }), { merge: true });
    return { success: true, planId };
});
//# sourceMappingURL=verify-razorpay-payment.js.map