"use strict";
/**
 * Razorpay Subscriptions service.
 *
 * Thin REST wrapper (axios + HTTP Basic auth) + signature verification.
 * No SDK dependency — axios is already a functions dependency.
 *
 * Keys are injected at runtime from Firebase secrets (process.env) by the
 * functions that declare `secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, ...]`.
 *
 * Razorpay monthly Plan IDs (created in the Razorpay dashboard) live in Firestore
 * at platformSettings/subscription:
 *   razorpayProPlusMonthlyPlanId: "plan_xxx"
 *   razorpayBusinessMonthlyPlanId: "plan_yyy"
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWebhookSignature = exports.verifyPaymentSignature = exports.rzpCancelSubscription = exports.rzpFetchSubscription = exports.rzpCreateSubscription = exports.getRazorpayPlanId = exports.getWebhookSecret = exports.getRazorpayKeys = void 0;
const admin = require("firebase-admin");
const crypto = require("crypto");
const axios_1 = require("axios");
const RZP_API = "https://api.razorpay.com/v1";
function getRazorpayKeys() {
    return {
        keyId: process.env.RAZORPAY_KEY_ID || "",
        keySecret: process.env.RAZORPAY_KEY_SECRET || "",
    };
}
exports.getRazorpayKeys = getRazorpayKeys;
function getWebhookSecret() {
    return process.env.RAZORPAY_WEBHOOK_SECRET || "";
}
exports.getWebhookSecret = getWebhookSecret;
/**
 * Resolve the Razorpay monthly plan id for a tier + region from platformSettings/subscription.
 * India shops use the base price; non-India shops use the higher INR tier (separate Razorpay plan).
 */
async function getRazorpayPlanId(planId, region) {
    const snap = await admin.firestore().collection("platformSettings").doc("subscription").get();
    const d = snap.data() || {};
    const key = region === "intl"
        ? planId === "pro_plus"
            ? "razorpayProPlusMonthlyPlanIdIntl"
            : "razorpayBusinessMonthlyPlanIdIntl"
        : planId === "pro_plus"
            ? "razorpayProPlusMonthlyPlanId"
            : "razorpayBusinessMonthlyPlanId";
    const v = d[key];
    return typeof v === "string" && v.trim() ? v.trim() : null;
}
exports.getRazorpayPlanId = getRazorpayPlanId;
function authHeader() {
    const { keyId, keySecret } = getRazorpayKeys();
    const token = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    return `Basic ${token}`;
}
/** Create a recurring subscription. total_count = number of billing cycles (120 ≈ 10y monthly). */
async function rzpCreateSubscription(params) {
    var _a;
    const res = await axios_1.default.post(`${RZP_API}/subscriptions`, {
        plan_id: params.planId,
        total_count: (_a = params.totalCount) !== null && _a !== void 0 ? _a : 120,
        quantity: 1,
        customer_notify: 1,
        notes: params.notes || {},
    }, { headers: { Authorization: authHeader(), "Content-Type": "application/json" } });
    return res.data;
}
exports.rzpCreateSubscription = rzpCreateSubscription;
async function rzpFetchSubscription(subscriptionId) {
    const res = await axios_1.default.get(`${RZP_API}/subscriptions/${subscriptionId}`, {
        headers: { Authorization: authHeader() },
    });
    return res.data;
}
exports.rzpFetchSubscription = rzpFetchSubscription;
async function rzpCancelSubscription(subscriptionId, cancelAtCycleEnd = true) {
    const res = await axios_1.default.post(`${RZP_API}/subscriptions/${subscriptionId}/cancel`, { cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 }, { headers: { Authorization: authHeader(), "Content-Type": "application/json" } });
    return res.data;
}
exports.rzpCancelSubscription = rzpCancelSubscription;
function safeEqual(a, b) {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length)
        return false;
    return crypto.timingSafeEqual(ba, bb);
}
/** Verify the Razorpay Checkout handler signature for a subscription payment. */
function verifyPaymentSignature(p) {
    const { keySecret } = getRazorpayKeys();
    if (!keySecret)
        return false;
    // For subscriptions the signed payload is `payment_id|subscription_id`.
    const expected = crypto
        .createHmac("sha256", keySecret)
        .update(`${p.paymentId}|${p.subscriptionId}`)
        .digest("hex");
    return safeEqual(expected, p.signature);
}
exports.verifyPaymentSignature = verifyPaymentSignature;
/** Verify the webhook X-Razorpay-Signature over the exact raw request body. */
function verifyWebhookSignature(rawBody, signature) {
    const secret = getWebhookSecret();
    if (!secret || !signature)
        return false;
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    return safeEqual(expected, signature);
}
exports.verifyWebhookSignature = verifyWebhookSignature;
//# sourceMappingURL=razorpay.js.map