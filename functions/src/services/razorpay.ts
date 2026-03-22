/**
 * Razorpay Service
 * 
 * SDK initialization and helper functions for:
 * - Creating subscriptions
 * - Managing payments
 * - Webhook verification
 */

import * as crypto from "crypto";
const Razorpay = require("razorpay");

// Initialize Razorpay instance
let razorpayInstance: any = null;

export function getRazorpay(): any {
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

/**
 * Verify Razorpay webhook signature
 * CRITICAL: Always verify webhooks to prevent spoofing
 */
export function verifyWebhookSignature(
    body: string,
    signature: string,
    secret?: string
): boolean {
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

        return crypto.timingSafeEqual(
            Buffer.from(expectedSignature),
            Buffer.from(signature)
        );
    } catch (error) {
        console.error("Webhook signature verification failed:", error);
        return false;
    }
}

/**
 * Create a Razorpay Order (for one-time payments)
 * Used when the user pays for the first time or reactivates
 */
export async function createOrder(params: {
    amount: number; // in paise (₹499 = 49900)
    currency?: string;
    receipt: string;
    notes?: Record<string, string>;
}) {
    const razorpay = getRazorpay();

    return razorpay.orders.create({
        amount: params.amount,
        currency: params.currency || "INR",
        receipt: params.receipt,
        notes: params.notes || {},
    });
}

/**
 * Create a Razorpay Subscription
 * For recurring payments
 */
export async function createSubscription(params: {
    planId: string; // Razorpay plan ID (not our internal plan ID)
    customerId?: string;
    totalCount?: number; // Number of billing cycles
    notes?: Record<string, string>;
}) {
    const razorpay = getRazorpay();

    return razorpay.subscriptions.create({
        plan_id: params.planId,
        customer_id: params.customerId,
        total_count: params.totalCount || 12, // Default 12 months
        notes: params.notes || {},
    });
}

/**
 * Cancel a Razorpay Subscription
 * cancel_at_cycle_end = true means user keeps access until period ends
 */
export async function cancelSubscription(
    subscriptionId: string,
    cancelAtCycleEnd: boolean = true
) {
    const razorpay = getRazorpay();

    return razorpay.subscriptions.cancel(subscriptionId, cancelAtCycleEnd);
}

/**
 * Fetch subscription details
 */
export async function getSubscription(subscriptionId: string) {
    const razorpay = getRazorpay();
    return razorpay.subscriptions.fetch(subscriptionId);
}

/**
 * Fetch payment details
 */
export async function getPayment(paymentId: string) {
    const razorpay = getRazorpay();
    return razorpay.payments.fetch(paymentId);
}

/**
 * Create a refund
 */
export async function createRefund(params: {
    paymentId: string;
    amount?: number; // Partial refund amount in paise (optional for full refund)
    notes?: Record<string, string>;
}) {
    const razorpay = getRazorpay();

    return razorpay.payments.refund(params.paymentId, {
        amount: params.amount,
        notes: params.notes || {},
    });
}

/**
 * Create or fetch Razorpay Customer
 */
export async function createCustomer(params: {
    name: string;
    email: string;
    contact: string;
    notes?: Record<string, string>;
}) {
    const razorpay = getRazorpay();

    return razorpay.customers.create({
        name: params.name,
        email: params.email,
        contact: params.contact,
        notes: params.notes || {},
    });
}

// ============================================
// PLAN MAPPING
// ============================================
// Maps our internal plan IDs to Razorpay Plan IDs
// These need to be created in Razorpay Dashboard first

export const RAZORPAY_PLAN_MAP: Record<string, {
    monthly?: string;
    yearly?: string;
}> = {
    // TODO: Create these plans in Razorpay Dashboard and add IDs here
    // Format: plan_XXXXXXXXXXXX
    pro: {
        monthly: "", // e.g., "plan_NxYZ123abc"
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
export function getRazorpayPlanId(
    planId: string,
    billingCycle: "monthly" | "yearly"
): string | null {
    const planConfig = RAZORPAY_PLAN_MAP[planId];
    if (!planConfig) return null;
    return planConfig[billingCycle] || null;
}
