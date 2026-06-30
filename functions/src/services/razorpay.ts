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

import * as admin from "firebase-admin";
import * as crypto from "crypto";
import axios from "axios";

const RZP_API = "https://api.razorpay.com/v1";

export function getRazorpayKeys(): { keyId: string; keySecret: string } {
    return {
        keyId: process.env.RAZORPAY_KEY_ID || "",
        keySecret: process.env.RAZORPAY_KEY_SECRET || "",
    };
}

export function getWebhookSecret(): string {
    return process.env.RAZORPAY_WEBHOOK_SECRET || "";
}

export type BillingRegion = "india" | "intl";

/**
 * Resolve the Razorpay monthly plan id for a tier + region from platformSettings/subscription.
 * India shops use the base price; non-India shops use the higher INR tier (separate Razorpay plan).
 */
export async function getRazorpayPlanId(
    planId: "pro_plus" | "business",
    region: BillingRegion,
): Promise<string | null> {
    const snap = await admin.firestore().collection("platformSettings").doc("subscription").get();
    const d = snap.data() || {};
    const key =
        region === "intl"
            ? planId === "pro_plus"
                ? "razorpayProPlusMonthlyPlanIdIntl"
                : "razorpayBusinessMonthlyPlanIdIntl"
            : planId === "pro_plus"
                ? "razorpayProPlusMonthlyPlanId"
                : "razorpayBusinessMonthlyPlanId";
    const v = d[key];
    return typeof v === "string" && v.trim() ? v.trim() : null;
}

function authHeader(): string {
    const { keyId, keySecret } = getRazorpayKeys();
    const token = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    return `Basic ${token}`;
}

export interface RzpSubscription {
    id: string;
    status: string;
    short_url?: string;
    current_end?: number;
    notes?: Record<string, string>;
    [k: string]: unknown;
}

/** Create a recurring subscription. total_count = number of billing cycles (120 ≈ 10y monthly). */
export async function rzpCreateSubscription(params: {
    planId: string;
    totalCount?: number;
    notes?: Record<string, string>;
}): Promise<RzpSubscription> {
    const res = await axios.post<RzpSubscription>(
        `${RZP_API}/subscriptions`,
        {
            plan_id: params.planId,
            total_count: params.totalCount ?? 120,
            quantity: 1,
            customer_notify: 1,
            notes: params.notes || {},
        },
        { headers: { Authorization: authHeader(), "Content-Type": "application/json" } },
    );
    return res.data;
}

export async function rzpFetchSubscription(subscriptionId: string): Promise<RzpSubscription> {
    const res = await axios.get<RzpSubscription>(`${RZP_API}/subscriptions/${subscriptionId}`, {
        headers: { Authorization: authHeader() },
    });
    return res.data;
}

export async function rzpCancelSubscription(subscriptionId: string, cancelAtCycleEnd = true): Promise<RzpSubscription> {
    const res = await axios.post<RzpSubscription>(
        `${RZP_API}/subscriptions/${subscriptionId}/cancel`,
        { cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 },
        { headers: { Authorization: authHeader(), "Content-Type": "application/json" } },
    );
    return res.data;
}

function safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
}

/** Verify the Razorpay Checkout handler signature for a subscription payment. */
export function verifyPaymentSignature(p: {
    paymentId: string;
    subscriptionId: string;
    signature: string;
}): boolean {
    const { keySecret } = getRazorpayKeys();
    if (!keySecret) return false;
    // For subscriptions the signed payload is `payment_id|subscription_id`.
    const expected = crypto
        .createHmac("sha256", keySecret)
        .update(`${p.paymentId}|${p.subscriptionId}`)
        .digest("hex");
    return safeEqual(expected, p.signature);
}

/** Verify the webhook X-Razorpay-Signature over the exact raw request body. */
export function verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
    const secret = getWebhookSecret();
    if (!secret || !signature) return false;
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    return safeEqual(expected, signature);
}
