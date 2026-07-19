"use strict";
/**
 * Subscription audit events (Cloud Functions / system side).
 *
 * Appends immutable records to `activity_logs` so provider webhooks and scheduled
 * jobs leave a real trail (who/what/when) — the same collection the web super-admin
 * mutations write to, and the same shape the Activity page + shop-detail timeline
 * read. Best-effort: NEVER throws, so a dropped audit line can't break a webhook or
 * a nightly job.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordPayment = exports.logSubscriptionEvent = void 0;
const admin = require("firebase-admin");
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
async function logSubscriptionEvent(input) {
    var _a, _b, _c;
    try {
        await db.collection("activity_logs").add({
            type: input.type,
            shopId: input.shopId,
            shopName: (_a = input.shopName) !== null && _a !== void 0 ? _a : null,
            description: input.description,
            source: "system",
            provider: (_b = input.provider) !== null && _b !== void 0 ? _b : null,
            metadata: (_c = input.metadata) !== null && _c !== void 0 ? _c : {},
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (e) {
        console.warn("[audit] logSubscriptionEvent failed (non-fatal):", e);
    }
}
exports.logSubscriptionEvent = logSubscriptionEvent;
/**
 * Record a successful gateway payment in the global `payments` ledger.
 * `amount` is in the shop's display currency (rupees), NOT paise — callers convert.
 * Best-effort — never throws.
 */
async function recordPayment(input) {
    var _a, _b, _c, _d, _e, _f, _g;
    try {
        const now = admin.firestore.Timestamp.now();
        // Idempotency: when we have a gateway payment id, use it as a STABLE doc id so a
        // redelivered webhook overwrites the same ledger row instead of appending a duplicate
        // (which would double-count revenue/MRR). Skip if already recorded.
        const ref = input.gatewayPaymentId
            ? db.collection("payments").doc(`rzp_${input.gatewayPaymentId}`)
            : db.collection("payments").doc();
        if (input.gatewayPaymentId) {
            const existing = await ref.get();
            if (existing.exists)
                return; // already recorded — idempotent no-op
        }
        await ref.set({
            shopId: input.shopId,
            shopName: (_a = input.shopName) !== null && _a !== void 0 ? _a : "",
            subscriptionId: input.shopId,
            amount: input.amount,
            currency: (_b = input.currency) !== null && _b !== void 0 ? _b : "INR",
            planId: input.planId,
            billingCycle: (_c = input.billingCycle) !== null && _c !== void 0 ? _c : "monthly",
            status: "success",
            method: input.method,
            gatewayPaymentId: (_d = input.gatewayPaymentId) !== null && _d !== void 0 ? _d : null,
            gatewayOrderId: (_e = input.gatewayOrderId) !== null && _e !== void 0 ? _e : null,
            invoiceNumber: input.gatewayPaymentId
                ? `INV-RZP-${input.gatewayPaymentId}`
                : `INV-RZP-${now.toMillis()}-${input.shopId}`,
            periodStart: (_f = input.periodStart) !== null && _f !== void 0 ? _f : null,
            periodEnd: (_g = input.periodEnd) !== null && _g !== void 0 ? _g : null,
            createdAt: now,
            updatedAt: now,
        });
    }
    catch (e) {
        console.warn("[audit] recordPayment failed (non-fatal):", e);
    }
}
exports.recordPayment = recordPayment;
//# sourceMappingURL=subscription-events.js.map