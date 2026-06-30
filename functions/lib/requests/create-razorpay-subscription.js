"use strict";
/**
 * Create a Razorpay recurring subscription for a Pro+ / Business upgrade (web).
 *
 * Does NOT change the live plan — only records a pending pointer. The plan is
 * activated by verifyRazorpayPayment (instant) and/or the razorpayWebhook
 * (subscription.charged) which is the source of truth.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRazorpaySubscription = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const secrets_1 = require("../lib/secrets");
const razorpay_1 = require("../services/razorpay");
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
exports.createRazorpaySubscription = (0, https_1.onCall)({ secrets: [secrets_1.RAZORPAY_KEY_ID, secrets_1.RAZORPAY_KEY_SECRET] }, async (request) => {
    var _a, _b, _c, _d, _e;
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "You must be signed in to subscribe.");
    }
    const uid = request.auth.uid;
    const { shopId, planId } = request.data || {};
    if (!shopId || typeof shopId !== "string") {
        throw new https_1.HttpsError("invalid-argument", "Missing or invalid shopId.");
    }
    if (planId !== "pro_plus" && planId !== "business") {
        throw new https_1.HttpsError("invalid-argument", "Plan must be 'pro_plus' or 'business'.");
    }
    // Ownership check (same pattern as cancelSubscriptionAtPeriodEnd)
    const shopSnap = await db.collection("shops").doc(shopId).get();
    if (!shopSnap.exists) {
        throw new https_1.HttpsError("not-found", "Shop not found.");
    }
    const shop = shopSnap.data() || {};
    const ownerId = (_a = shop.ownerId) !== null && _a !== void 0 ? _a : shop.userId;
    if (ownerId && ownerId !== uid) {
        throw new https_1.HttpsError("permission-denied", "You can only subscribe for your own shop.");
    }
    const { keyId } = (0, razorpay_1.getRazorpayKeys)();
    if (!keyId) {
        throw new https_1.HttpsError("failed-precondition", "Razorpay is not configured (missing key id).");
    }
    // India shops pay the base INR price; non-India shops pay the higher INR tier.
    const countryCode = String(shop.countryCode || ((_b = shop.settings) === null || _b === void 0 ? void 0 : _b.countryCode) || "IN").toUpperCase();
    const region = countryCode === "IN" ? "india" : "intl";
    const rzpPlanId = await (0, razorpay_1.getRazorpayPlanId)(planId, region);
    if (!rzpPlanId) {
        throw new https_1.HttpsError("failed-precondition", `Razorpay plan id for ${planId} (${region}) is not set in platformSettings/subscription.`);
    }
    let sub;
    try {
        sub = await (0, razorpay_1.rzpCreateSubscription)({
            planId: rzpPlanId,
            notes: { shopId, planId, uid, region },
        });
    }
    catch (e) {
        const detail = (_e = (_d = (_c = e === null || e === void 0 ? void 0 : e.response) === null || _c === void 0 ? void 0 : _c.data) !== null && _d !== void 0 ? _d : e === null || e === void 0 ? void 0 : e.message) !== null && _e !== void 0 ? _e : e;
        console.error("rzpCreateSubscription failed:", JSON.stringify(detail));
        throw new https_1.HttpsError("internal", "Could not start the subscription. Please try again.");
    }
    // Record a pending pointer; leave planId/status untouched until payment is verified.
    const now = admin.firestore.Timestamp.now();
    await db.collection("subscriptions").doc(shopId).set({
        shopId,
        pendingRazorpay: {
            subscriptionId: sub.id,
            planId,
            status: sub.status || "created",
            createdAt: now,
        },
        updatedAt: now,
    }, { merge: true });
    return {
        subscriptionId: sub.id,
        keyId,
        shortUrl: sub.short_url || null,
        status: sub.status || "created",
    };
});
//# sourceMappingURL=create-razorpay-subscription.js.map