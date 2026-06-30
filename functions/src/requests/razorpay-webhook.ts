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

import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { RAZORPAY_WEBHOOK_SECRET } from "../lib/secrets";
import { verifyWebhookSignature } from "../services/razorpay";
import { normalizePlanId, planDisplayName } from "../lib/plan-normalize";

if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();

export const razorpayWebhook = onRequest({ secrets: [RAZORPAY_WEBHOOK_SECRET] }, async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }

    const signature = (req.headers["x-razorpay-signature"] as string) || "";
    const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
    if (!rawBody || !verifyWebhookSignature(rawBody, signature)) {
        console.warn("[RZP webhook] signature verification failed");
        res.status(400).send("Invalid signature");
        return;
    }

    const body = req.body || {};
    const eventType: string = body.event || "";
    const subEntity = body?.payload?.subscription?.entity;

    if (!subEntity) {
        console.log("[RZP webhook] no subscription entity for event:", eventType);
        res.status(200).send("OK");
        return;
    }

    const notes = subEntity.notes || {};
    const shopId: string | undefined = notes.shopId;
    const planId = normalizePlanId(notes.planId || "pro_plus");
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
                await subRef.set(
                    {
                        ...base,
                        planId,
                        planName: planDisplayName(planId),
                        status: "active",
                        isAutoRenew: true,
                        purchaseState: "active",
                        ...(currentEnd ? { currentPeriodEnd: currentEnd, endDate: currentEnd } : {}),
                        lastPaymentDate: now,
                        lastPurchaseError: null,
                        pendingRazorpay: admin.firestore.FieldValue.delete(),
                    },
                    { merge: true },
                );
                break;

            case "subscription.pending":
                await subRef.set(
                    { ...base, status: "past_due", lastPurchaseError: "Payment pending / retrying (Razorpay)" },
                    { merge: true },
                );
                break;

            case "subscription.halted":
                await subRef.set(
                    {
                        ...base,
                        status: "grace_period",
                        graceEndDate: currentEnd || now,
                        isAutoRenew: false,
                        lastPurchaseError: "Payment failed after retries (Razorpay)",
                    },
                    { merge: true },
                );
                break;

            case "subscription.cancelled":
                await subRef.set(
                    {
                        ...base,
                        status: "cancelled",
                        isAutoRenew: false,
                        cancelledAt: now,
                        cancelledBy: "user",
                        ...(currentEnd ? { activeUntil: currentEnd } : {}),
                    },
                    { merge: true },
                );
                break;

            case "subscription.completed":
                await subRef.set(
                    {
                        ...base,
                        status: "expired",
                        isAutoRenew: false,
                        expiredAt: now,
                        planId: "free",
                        planName: "Free",
                        endDate: null,
                        currentPeriodEnd: null,
                    },
                    { merge: true },
                );
                break;

            default:
                console.log("[RZP webhook] unhandled event:", eventType);
        }

        console.log(`[RZP webhook] ${eventType} → ${shopId}`);
    } catch (e) {
        console.error(`[RZP webhook] failed to process ${eventType} for ${shopId}:`, e);
        // Still 200 so Razorpay doesn't hammer retries on a transient Firestore blip;
        // the next charge event will re-assert state.
    }

    res.status(200).send("OK");
});
