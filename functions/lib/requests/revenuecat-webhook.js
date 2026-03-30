"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revenueCatWebhook = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * RevenueCat Server-to-Server Webhook.
 *
 * Configure this URL in RevenueCat Dashboard → Project Settings → Integrations → Webhooks:
 *   https://<region>-<project>.cloudfunctions.net/revenueCatWebhook
 *
 * Optional: set REVENUECAT_WEBHOOK_AUTH_KEY in Firebase env to validate
 * the Authorization header sent by RevenueCat.
 */
exports.revenueCatWebhook = (0, https_1.onRequest)(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }
    // Optional auth header validation
    const expectedKey = process.env.REVENUECAT_WEBHOOK_AUTH_KEY;
    if (expectedKey) {
        const authHeader = req.headers.authorization || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
        if (token !== expectedKey) {
            res.status(401).send("Unauthorized");
            return;
        }
    }
    const body = req.body;
    if (!(body === null || body === void 0 ? void 0 : body.event)) {
        res.status(400).send("Missing event");
        return;
    }
    const event = body.event;
    const appUserId = event.app_user_id;
    const eventType = event.type;
    if (!appUserId) {
        console.warn("[RC webhook] No app_user_id in event", eventType);
        res.status(200).send("OK");
        return;
    }
    // app_user_id = Firebase UID = shopId
    const shopId = appUserId;
    const subRef = db.collection("subscriptions").doc(shopId);
    const now = admin.firestore.Timestamp.now();
    const productId = event.product_id || "";
    const store = event.store || "";
    const provider = store === "APP_STORE" ? "apple_iap"
        : store === "PLAY_STORE" ? "google_play"
            : `revenuecat_${store.toLowerCase() || "unknown"}`;
    const expiresAt = event.expiration_at_ms
        ? admin.firestore.Timestamp.fromMillis(event.expiration_at_ms)
        : null;
    const billingCycle = productId.includes("yearly") || productId.includes("annual")
        ? "yearly"
        : productId.includes("lifetime")
            ? "lifetime"
            : "monthly";
    const activeEvents = [
        "INITIAL_PURCHASE",
        "RENEWAL",
        "PRODUCT_CHANGE",
        "UNCANCELLATION",
        "SUBSCRIBER_ALIAS",
    ];
    const expiredEvents = [
        "EXPIRATION",
        "BILLING_ISSUE",
    ];
    const cancelledEvents = [
        "CANCELLATION",
    ];
    if (activeEvents.includes(eventType)) {
        await subRef.set(Object.assign(Object.assign({ shopId, planId: "pro", planName: "Pro", billingCycle, status: "active", provider, providerRef: `rc_${productId}`, isAutoRenew: eventType !== "CANCELLATION", purchaseState: "active" }, (expiresAt ? { currentPeriodEnd: expiresAt, endDate: expiresAt } : {})), { updatedAt: now, lastPaymentDate: now, lastPurchaseError: null }), { merge: true });
        console.log(`[RC webhook] ${eventType} → active for ${shopId}`);
    }
    else if (cancelledEvents.includes(eventType)) {
        await subRef.set(Object.assign(Object.assign({ status: "cancelled", isAutoRenew: false, cancelledAt: now, cancelledBy: "user" }, (expiresAt ? { activeUntil: expiresAt } : {})), { updatedAt: now }), { merge: true });
        console.log(`[RC webhook] ${eventType} → cancelled for ${shopId}`);
    }
    else if (expiredEvents.includes(eventType)) {
        const newStatus = eventType === "BILLING_ISSUE" ? "grace_period" : "expired";
        await subRef.set(Object.assign(Object.assign(Object.assign({ status: newStatus, isAutoRenew: false }, (newStatus === "expired" ? { expiredAt: now } : { graceEndDate: expiresAt || now })), { updatedAt: now }), (eventType === "BILLING_ISSUE" ? { lastPurchaseError: "Billing issue detected by RevenueCat" } : {})), { merge: true });
        console.log(`[RC webhook] ${eventType} → ${newStatus} for ${shopId}`);
    }
    else {
        console.log(`[RC webhook] Unhandled event type: ${eventType} for ${shopId}`);
    }
    res.status(200).send("OK");
});
//# sourceMappingURL=revenuecat-webhook.js.map