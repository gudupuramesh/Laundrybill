/**
 * Subscription audit events (Cloud Functions / system side).
 *
 * Appends immutable records to `activity_logs` so provider webhooks and scheduled
 * jobs leave a real trail (who/what/when) — the same collection the web super-admin
 * mutations write to, and the same shape the Activity page + shop-detail timeline
 * read. Best-effort: NEVER throws, so a dropped audit line can't break a webhook or
 * a nightly job.
 */

import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();

/** Subset of the web ActivityType union relevant to system-driven subscription changes. */
export type SubEventType =
    | "subscription_created"
    | "subscription_upgraded"
    | "subscription_downgraded"
    | "subscription_cancelled"
    | "subscription_expired"
    | "subscription_renewed"
    | "payment_received"
    | "payment_failed";

export interface SubscriptionEventInput {
    type: SubEventType;
    shopId: string;
    shopName?: string | null;
    /** Human-readable summary shown on the Activity page + shop timeline. */
    description: string;
    /** razorpay | apple_iap | google_play | system … */
    provider?: string | null;
    metadata?: Record<string, unknown>;
}

export async function logSubscriptionEvent(input: SubscriptionEventInput): Promise<void> {
    try {
        await db.collection("activity_logs").add({
            type: input.type,
            shopId: input.shopId,
            shopName: input.shopName ?? null,
            description: input.description,
            source: "system",
            provider: input.provider ?? null,
            metadata: input.metadata ?? {},
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (e) {
        console.warn("[audit] logSubscriptionEvent failed (non-fatal):", e);
    }
}

/**
 * Record a successful gateway payment in the global `payments` ledger.
 * `amount` is in the shop's display currency (rupees), NOT paise — callers convert.
 * Best-effort — never throws.
 */
export async function recordPayment(input: {
    shopId: string;
    shopName?: string | null;
    amount: number;
    currency?: string;
    planId: string;
    billingCycle?: string;
    method: string;
    gatewayPaymentId?: string | null;
    gatewayOrderId?: string | null;
    periodStart?: admin.firestore.Timestamp | null;
    periodEnd?: admin.firestore.Timestamp | null;
}): Promise<void> {
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
            if (existing.exists) return; // already recorded — idempotent no-op
        }
        await ref.set({
            shopId: input.shopId,
            shopName: input.shopName ?? "",
            subscriptionId: input.shopId,
            amount: input.amount,
            currency: input.currency ?? "INR",
            planId: input.planId,
            billingCycle: input.billingCycle ?? "monthly",
            status: "success",
            method: input.method,
            gatewayPaymentId: input.gatewayPaymentId ?? null,
            gatewayOrderId: input.gatewayOrderId ?? null,
            invoiceNumber: input.gatewayPaymentId
                ? `INV-RZP-${input.gatewayPaymentId}`
                : `INV-RZP-${now.toMillis()}-${input.shopId}`,
            periodStart: input.periodStart ?? null,
            periodEnd: input.periodEnd ?? null,
            createdAt: now,
            updatedAt: now,
        });
    } catch (e) {
        console.warn("[audit] recordPayment failed (non-fatal):", e);
    }
}
