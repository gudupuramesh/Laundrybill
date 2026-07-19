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
const subscription_events_1 = require("../lib/subscription-events");
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
exports.razorpayWebhook = (0, https_1.onRequest)({ secrets: [secrets_1.RAZORPAY_WEBHOOK_SECRET] }, async (req, res) => {
    var _a, _b, _c, _d, _e;
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
        // ── Audit trail + payment ledger (best-effort; never throws) ──
        const paymentEntity = (_d = (_c = body === null || body === void 0 ? void 0 : body.payload) === null || _c === void 0 ? void 0 : _c.payment) === null || _d === void 0 ? void 0 : _d.entity;
        const amountRupees = (paymentEntity === null || paymentEntity === void 0 ? void 0 : paymentEntity.amount) ? Number(paymentEntity.amount) / 100 : 0;
        const planName = (0, plan_normalize_1.planDisplayName)(planId);
        const paidCount = Number(subEntity.paid_count) || 0;
        switch (eventType) {
            case "subscription.activated":
            case "subscription.charged":
            case "subscription.resumed": {
                // Razorpay fires BOTH subscription.activated and subscription.charged on the
                // FIRST payment. Log activation on "activated"; log a renewal on "charged" only
                // for the 2nd+ charge (paid_count > 1), or on "resumed" — so a new subscription
                // never shows a spurious "renewed" entry alongside its "activated" one.
                const isFirstCharge = eventType === "subscription.charged" && paidCount <= 1;
                if (!isFirstCharge) {
                    await (0, subscription_events_1.logSubscriptionEvent)({
                        type: eventType === "subscription.activated" ? "subscription_upgraded" : "subscription_renewed",
                        shopId,
                        provider: "razorpay",
                        description: eventType === "subscription.activated"
                            ? `Razorpay subscription activated — ${planName}`
                            : eventType === "subscription.resumed"
                                ? `Razorpay subscription resumed — ${planName}`
                                : `Razorpay renewal charged — ${planName}`,
                        metadata: { toPlan: planId, toStatus: "active", providerRef: subEntity.id, amount: amountRupees || null },
                    });
                }
                // Only "charged" writes a payment record (recordPayment is idempotent on the
                // gateway payment id, so redelivery / the activated+charged dual-fire is safe).
                if (amountRupees > 0 && eventType === "subscription.charged") {
                    await (0, subscription_events_1.recordPayment)({
                        shopId,
                        amount: amountRupees,
                        planId,
                        method: "razorpay",
                        gatewayPaymentId: (_e = paymentEntity === null || paymentEntity === void 0 ? void 0 : paymentEntity.id) !== null && _e !== void 0 ? _e : null,
                        periodEnd: currentEnd,
                    });
                }
                break;
            }
            case "subscription.halted":
                await (0, subscription_events_1.logSubscriptionEvent)({
                    type: "payment_failed",
                    shopId,
                    provider: "razorpay",
                    description: `Razorpay payment failed after retries — grace period (${planName})`,
                    metadata: { toStatus: "grace_period", providerRef: subEntity.id },
                });
                break;
            case "subscription.cancelled":
                await (0, subscription_events_1.logSubscriptionEvent)({
                    type: "subscription_cancelled",
                    shopId,
                    provider: "razorpay",
                    description: `Razorpay subscription cancelled${currentEnd ? ` — access until ${currentEnd.toDate().toLocaleDateString()}` : ""}`,
                    metadata: { toStatus: "cancelled", providerRef: subEntity.id },
                });
                break;
            case "subscription.completed":
                await (0, subscription_events_1.logSubscriptionEvent)({
                    type: "subscription_expired",
                    shopId,
                    provider: "razorpay",
                    description: "Razorpay subscription completed — reverted to Free",
                    metadata: { fromPlan: planId, toPlan: "free", toStatus: "expired", providerRef: subEntity.id },
                });
                break;
        }
    }
    catch (e) {
        console.error(`[RZP webhook] failed to process ${eventType} for ${shopId}:`, e);
        // Still 200 so Razorpay doesn't hammer retries on a transient Firestore blip;
        // the next charge event will re-assert state.
    }
    res.status(200).send("OK");
});
//# sourceMappingURL=razorpay-webhook.js.map