"use strict";
/**
 * Razorpay Service
 *
 * SDK initialization and helper functions for:
 * - Creating subscriptions
 * - Managing payments
 * - Webhook verification
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRazorpayPlanId = exports.RAZORPAY_PLAN_MAP = exports.createCustomer = exports.createRefund = exports.getPayment = exports.getSubscription = exports.cancelSubscription = exports.createSubscription = exports.createOrder = exports.verifyWebhookSignature = exports.getRazorpay = void 0;
const crypto = require("crypto");
const Razorpay = require("razorpay");
// Initialize Razorpay instance
let razorpayInstance = null;
function getRazorpay() {
    if (!razorpayInstance) {
        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keyId || !keySecret) {
            throw new Error("Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
        }
        razorpayInstance = new Razorpay({
            key_id: keyId,
            key_secret: keySecret,
        });
    }
    return razorpayInstance;
}
exports.getRazorpay = getRazorpay;
/**
 * Verify Razorpay webhook signature
 * CRITICAL: Always verify webhooks to prevent spoofing
 */
function verifyWebhookSignature(body, signature, secret) {
    const webhookSecret = secret || process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error("RAZORPAY_WEBHOOK_SECRET not configured");
        return false;
    }
    try {
        const expectedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(body)
            .digest("hex");
        return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
    }
    catch (error) {
        console.error("Webhook signature verification failed:", error);
        return false;
    }
}
exports.verifyWebhookSignature = verifyWebhookSignature;
/**
 * Create a Razorpay Order (for one-time payments)
 * Used when the user pays for the first time or reactivates
 */
async function createOrder(params) {
    const razorpay = getRazorpay();
    return razorpay.orders.create({
        amount: params.amount,
        currency: params.currency || "INR",
        receipt: params.receipt,
        notes: params.notes || {},
    });
}
exports.createOrder = createOrder;
/**
 * Create a Razorpay Subscription
 * For recurring payments
 */
async function createSubscription(params) {
    const razorpay = getRazorpay();
    return razorpay.subscriptions.create({
        plan_id: params.planId,
        customer_id: params.customerId,
        total_count: params.totalCount || 12,
        notes: params.notes || {},
    });
}
exports.createSubscription = createSubscription;
/**
 * Cancel a Razorpay Subscription
 * cancel_at_cycle_end = true means user keeps access until period ends
 */
async function cancelSubscription(subscriptionId, cancelAtCycleEnd = true) {
    const razorpay = getRazorpay();
    return razorpay.subscriptions.cancel(subscriptionId, cancelAtCycleEnd);
}
exports.cancelSubscription = cancelSubscription;
/**
 * Fetch subscription details
 */
async function getSubscription(subscriptionId) {
    const razorpay = getRazorpay();
    return razorpay.subscriptions.fetch(subscriptionId);
}
exports.getSubscription = getSubscription;
/**
 * Fetch payment details
 */
async function getPayment(paymentId) {
    const razorpay = getRazorpay();
    return razorpay.payments.fetch(paymentId);
}
exports.getPayment = getPayment;
/**
 * Create a refund
 */
async function createRefund(params) {
    const razorpay = getRazorpay();
    return razorpay.payments.refund(params.paymentId, {
        amount: params.amount,
        notes: params.notes || {},
    });
}
exports.createRefund = createRefund;
/**
 * Create or fetch Razorpay Customer
 */
async function createCustomer(params) {
    const razorpay = getRazorpay();
    return razorpay.customers.create({
        name: params.name,
        email: params.email,
        contact: params.contact,
        notes: params.notes || {},
    });
}
exports.createCustomer = createCustomer;
// ============================================
// PLAN MAPPING
// ============================================
// Maps our internal plan IDs to Razorpay Plan IDs
// These need to be created in Razorpay Dashboard first
exports.RAZORPAY_PLAN_MAP = {
    // TODO: Create these plans in Razorpay Dashboard and add IDs here
    // Format: plan_XXXXXXXXXXXX
    pro: {
        monthly: "",
        yearly: "",
    },
    pro_plus: {
        monthly: "",
        yearly: "",
    },
    business: {
        monthly: "",
        yearly: "",
    },
};
/**
 * Get Razorpay Plan ID for internal plan + billing cycle
 */
function getRazorpayPlanId(planId, billingCycle) {
    const planConfig = exports.RAZORPAY_PLAN_MAP[planId];
    if (!planConfig)
        return null;
    return planConfig[billingCycle] || null;
}
exports.getRazorpayPlanId = getRazorpayPlanId;
//# sourceMappingURL=razorpay.js.map