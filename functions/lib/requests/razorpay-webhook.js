"use strict";
/**
 * Razorpay webhook — durable source of truth for subscription state.
 *
 * Configure in Razorpay Dashboard → Settings → Webhooks:
 *   URL:    https://<region>-<project>.cloudfunctions.net/razorpayWebhook
 *   Secret: same value you set as RAZORPAY_WEBHOOK_SECRET
 *   Events: subscription.activated, subscription.charged, subscription.pending,
 *           subscription.halted, subscription.cancelled, subscription.completed,
 *           subscription.resumed
 *
 * Writes only to subscriptions/{shopId}; the syncSubscriptionToShop trigger
 * propagates plan/status onto the shop document.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.razorpayWebhook = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const secrets_1 = require("../lib/secrets");
const razorpay_1 = require("../services/razorpay");
const plan_normalize_1 = require("../lib/plan-normalize");
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
exports.razorpayWebhook = (0, https_1.onRequest)({ secrets: [secrets_1.RAZORPAY_WEBHOOK_SECRET] }, async (req, res) => {
    var _a, _b;
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }
    const signature = req.headers["x-razorpay-signature"] || "";
    const rawBody = req.rawBody;
    if (!rawBody || !(0, razorpay_1.verifyWebhookSignature)(rawBody, signature)) {
        console.warn("[RZP webhook] signature verification failed");
        res.status(400).send("Invalid signature");
        return;
    }
    const body = req.body || {};
    const eventType = body.event || "";
    const subEntity = (_b = (_a = body === null || body === void 0 ? void 0 : body.payload) === null || _a === void 0 ? void 0 : _a.subscription) === null || _b === void 0 ? void 0 : _b.entity;
    if (!subEntity) {
        console.log("[RZP webhook] no subscription entity for event:", eventType);
        res.status(200).send("OK");
        return;
    }
    const notes = subEntity.notes || {};
    const shopId = notes.shopId;
    const planId = (0, plan_normalize_1.normalizePlanId)(notes.planId || "pro_plus");
    if (!shopId) {
        console.warn("[RZP webhook] missing shopId in subscription notes for", eventType);
        res.status(200).send("OK");
        return;
    }
    const subRef = db.collection("subscriptions").doc(shopId);
    const now = admin.firestore.Timestamp.now();
    const currentEnd = subEntity.current_end
        ? admin.firestore.Timestamp.fromMillis(Number(subEntity.current_end) * 1000)
        : null;
    const base = {
        shopId,
        provider: "razorpay",
        providerRef: subEntity.id,
        billingCycle: "monthly",
        updatedAt: now,
    };
    try {
        switch (eventType) {
            case "subscription.activated":
            case "subscription.charged":
            case "subscription.resumed":
                await subRef.set(Object.assign(Object.assign(Object.assign(Object.assign({}, base), { planId, planName: (0, plan_normalize_1.planDisplayName)(planId), status: "active", isAutoRenew: true, purchaseState: "active" }), (currentEnd ? { currentPeriodEnd: currentEnd, endDate: currentEnd } : {})), { lastPaymentDate: now, lastPurchaseError: null, pendingRazorpay: admin.firestore.FieldValue.delete() }), { merge: true });
                break;
            case "subscription.pending":
                await subRef.set(Object.assign(Object.assign({}, base), { status: "past_due", lastPurchaseError: "Payment pending / retrying (Razorpay)" }), { merge: true });
                break;
            case "subscription.halted":
                await subRef.set(Object.assign(Object.assign({}, base), { status: "grace_period", graceEndDate: currentEnd || now, isAutoRenew: false, lastPurchaseError: "Payment failed after retries (Razorpay)" }), { merge: true });
                break;
            case "subscription.cancelled":
                await subRef.set(Object.assign(Object.assign(Object.assign({}, base), { status: "cancelled", isAutoRenew: false, cancelledAt: now, cancelledBy: "user" }), (currentEnd ? { activeUntil: currentEnd } : {})), { merge: true });
                break;
            case "subscription.completed":
                await subRef.set(Object.assign(Object.assign({}, base), { status: "expired", isAutoRenew: false, expiredAt: now, planId: "free", planName: "Free", endDate: null, currentPeriodEnd: null }), { merge: true });
                break;
            default:
                console.log("[RZP webhook] unhandled event:", eventType);
        }
        console.log(`[RZP webhook] ${eventType} → ${shopId}`);
    }
    catch (e) {
        console.error(`[RZP webhook] failed to process ${eventType} for ${shopId}:`, e);
        // Still 200 so Razorpay doesn't hammer retries on a transient Firestore blip;
        // the next charge event will re-assert state.
    }
    res.status(200).send("OK");
});
//# sourceMappingURL=razorpay-webhook.js.map