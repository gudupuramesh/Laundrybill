"use strict";
/**
 * Razorpay Webhook Handler
 *
 * HTTP endpoint to receive and process Razorpay payment events.
 *
 * Events handled:
 * - payment.captured: Payment successful
 * - payment.failed: Payment failed
 * - subscription.activated: Subscription started
 * - subscription.charged: Subscription renewal success
 * - subscription.cancelled: Subscription cancelled
 * - refund.created: Refund processed
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.razorpayWebhook = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const razorpay_1 = require("../services/razorpay");
const zeptomail_1 = require("../services/zeptomail");
const email_upgrade_1 = require("../services/email-upgrade");
const email_reactivation_1 = require("../services/email-reactivation");
const email_payment_failed_1 = require("../services/email-payment-failed");
const email_renewal_1 = require("../services/email-renewal");
const platform_settings_1 = require("../services/platform-settings");
const currency_helper_1 = require("../services/currency-helper");
// Ensure Firestore is initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * Main Razorpay Webhook Endpoint
 */
exports.razorpayWebhook = (0, https_1.onRequest)({
    cors: false,
    maxInstances: 10,
}, async (req, res) => {
    var _a, _b;
    // Only accept POST
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }
    // Get raw body for signature verification
    const rawBody = JSON.stringify(req.body);
    const signature = req.headers["x-razorpay-signature"];
    console.log("Received Razorpay webhook:", (_a = req.body) === null || _a === void 0 ? void 0 : _a.event);
    // Verify signature
    if (!signature || !(0, razorpay_1.verifyWebhookSignature)(rawBody, signature)) {
        console.error("Invalid webhook signature");
        res.status(401).send("Invalid signature");
        return;
    }
    // Parse event
    const event = req.body;
    const eventType = event.event;
    try {
        // Route to appropriate handler
        switch (eventType) {
            case "payment.captured":
                await handlePaymentCaptured(event.payload.payment.entity);
                break;
            case "payment.failed":
                await handlePaymentFailed(event.payload.payment.entity);
                break;
            case "subscription.activated":
                await handleSubscriptionActivated(event.payload.subscription.entity);
                break;
            case "subscription.charged":
                await handleSubscriptionCharged(event.payload.subscription.entity, (_b = event.payload.payment) === null || _b === void 0 ? void 0 : _b.entity);
                break;
            case "subscription.cancelled":
                await handleSubscriptionCancelled(event.payload.subscription.entity);
                break;
            case "refund.created":
                await handleRefundCreated(event.payload.refund.entity);
                break;
            default:
                console.log(`Unhandled event type: ${eventType}`);
        }
        // Return 200 quickly to acknowledge receipt
        res.status(200).send("OK");
    }
    catch (error) {
        console.error(`Error processing webhook ${eventType}:`, error);
        // Still return 200 to prevent Razorpay from retrying
        // Log the error for manual investigation
        res.status(200).send("Processed with errors");
    }
});
// ============================================
// EVENT HANDLERS
// ============================================
/**
 * Handle successful payment capture
 * Used for one-time payments (first subscription)
 */
async function handlePaymentCaptured(payment) {
    var _a;
    console.log(`Payment captured: ${payment.id}, Amount: ₹${payment.amount / 100}`);
    const { shopId, planId, billingCycle } = payment.notes;
    if (!shopId || !planId) {
        console.error("Missing shopId or planId in payment notes");
        return;
    }
    const subRef = db.collection("subscriptions").doc(shopId);
    // Idempotency: skip if this payment was already processed
    const existingPayments = await subRef.collection("payments")
        .where("paymentId", "==", payment.id)
        .limit(1)
        .get();
    if (!existingPayments.empty) {
        console.log(`Payment ${payment.id} already processed for shop ${shopId}, skipping.`);
        return;
    }
    const now = admin.firestore.Timestamp.now();
    const notesPeriodDays = ((_a = payment.notes) === null || _a === void 0 ? void 0 : _a.periodDays) != null ? parseInt(String(payment.notes.periodDays), 10) : NaN;
    const periodDays = Number.isFinite(notesPeriodDays) && notesPeriodDays > 0
        ? notesPeriodDays
        : (billingCycle === "yearly" ? 365 : 30);
    // Check for existing active subscription to handle Proration/Credit Days
    const subDoc = await subRef.get();
    const existingSub = subDoc.data();
    let endDate = new Date();
    endDate.setDate(endDate.getDate() + periodDays);
    // If upgrading mid-cycle, add remaining days from previous plan
    if ((existingSub === null || existingSub === void 0 ? void 0 : existingSub.status) === "active" && existingSub.endDate) {
        const currentEndDate = existingSub.endDate.toDate();
        if (currentEndDate > now.toDate()) { // Check if not expired
            const diffMs = currentEndDate.getTime() - now.toDate().getTime();
            const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            if (remainingDays > 0) {
                console.log(`Adding ${remainingDays} credit days from previous plan.`);
                endDate.setDate(endDate.getDate() + remainingDays);
            }
        }
    }
    await subRef.set({
        shopId,
        planId,
        planName: getPlanName(planId),
        status: "active",
        billingCycle: billingCycle || "monthly",
        currentPeriodStart: now,
        currentPeriodEnd: admin.firestore.Timestamp.fromDate(endDate),
        endDate: admin.firestore.Timestamp.fromDate(endDate),
        lastPaymentDate: now,
        lastPaymentAmount: payment.amount / 100,
        lastPaymentId: payment.id,
        razorpayPaymentId: payment.id,
        razorpayOrderId: payment.order_id,
        failedPaymentAttempts: 0,
        createdAt: now,
        updatedAt: now,
    }, { merge: true });
    // Record payment in history
    await subRef.collection("payments").add({
        type: "subscription",
        paymentId: payment.id,
        orderId: payment.order_id,
        amount: payment.amount / 100,
        currency: payment.currency,
        method: payment.method,
        status: "success",
        date: now,
        notes: payment.notes,
    });
    // Super Admin: write to top-level payments
    await writePaymentForSuperAdmin({
        shopId,
        amount: payment.amount / 100,
        currency: payment.currency,
        status: "success",
        planId,
        billingCycle: billingCycle || "monthly",
        method: "razorpay",
        gatewayPaymentId: payment.id,
        gatewayOrderId: payment.order_id,
        type: "subscription",
        periodStart: now,
        periodEnd: admin.firestore.Timestamp.fromDate(endDate),
    });
    const wasExpiredOrFree = (existingSub === null || existingSub === void 0 ? void 0 : existingSub.status) === "expired" || (existingSub === null || existingSub === void 0 ? void 0 : existingSub.status) === "free";
    if (wasExpiredOrFree) {
        await sendReactivationEmail(shopId, planId, payment.amount / 100, billingCycle, endDate);
    }
    else {
        await sendUpgradeEmail(shopId, planId, payment.amount / 100, billingCycle, endDate);
    }
    console.log(`Subscription activated for shop ${shopId} on plan ${planId}`);
}
/**
 * Handle failed payment
 * Enter grace period if subscription renewal fails
 */
async function handlePaymentFailed(payment) {
    console.log(`Payment failed: ${payment.id}, Error: ${payment.error_description}`);
    const { shopId } = payment.notes;
    if (!shopId) {
        console.error("Missing shopId in payment notes");
        return;
    }
    const now = admin.firestore.Timestamp.now();
    const subRef = db.collection("subscriptions").doc(shopId);
    const subDoc = await subRef.get();
    const subData = subDoc.data();
    const failedAttempts = ((subData === null || subData === void 0 ? void 0 : subData.failedPaymentAttempts) || 0) + 1;
    // Calculate grace period end (7 days from now)
    const graceEndDate = new Date();
    graceEndDate.setDate(graceEndDate.getDate() + 7);
    // Update subscription status
    await subRef.update({
        status: failedAttempts === 1 ? "grace_period" : subData === null || subData === void 0 ? void 0 : subData.status,
        failedPaymentAttempts: failedAttempts,
        lastFailedPaymentDate: now,
        lastFailedPaymentReason: payment.error_description || payment.error_code || "Unknown error",
        graceEndDate: failedAttempts === 1 ? admin.firestore.Timestamp.fromDate(graceEndDate) : subData === null || subData === void 0 ? void 0 : subData.graceEndDate,
        updatedAt: now,
    });
    // Record failed payment
    await subRef.collection("payments").add({
        type: "renewal_failed",
        paymentId: payment.id,
        amount: payment.amount / 100,
        status: "failed",
        errorCode: payment.error_code,
        errorDescription: payment.error_description,
        date: now,
        attemptNumber: failedAttempts,
    });
    // Super Admin: write to top-level payments
    await writePaymentForSuperAdmin({
        shopId,
        amount: payment.amount / 100,
        currency: payment.currency || "INR",
        status: "failed",
        planId: (subData === null || subData === void 0 ? void 0 : subData.planId) || "free",
        billingCycle: (subData === null || subData === void 0 ? void 0 : subData.billingCycle) || "monthly",
        method: "razorpay",
        gatewayPaymentId: payment.id,
        type: "renewal_failed",
    });
    // Send payment failed email
    try {
        const shopDoc = await db.collection("shops").doc(shopId).get();
        const shopData = shopDoc.data();
        const ownerEmail = (shopData === null || shopData === void 0 ? void 0 : shopData.email) || (shopData === null || shopData === void 0 ? void 0 : shopData.ownerEmail) || (subData === null || subData === void 0 ? void 0 : subData.userEmail);
        if (ownerEmail) {
            const settings = await (0, platform_settings_1.getPlatformSettings)();
            const updatePaymentUrl = `${settings.appUrl}/settings/subscription`;
            const graceEndStr = graceEndDate.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
            });
            const htmlBody = (0, email_payment_failed_1.getPaymentFailedTemplate)({
                shopName: (shopData === null || shopData === void 0 ? void 0 : shopData.name) || "Shop Owner",
                planName: (subData === null || subData === void 0 ? void 0 : subData.planName) || "Premium",
                errorDescription: payment.error_description || payment.error_code || undefined,
                graceEndDate: graceEndStr,
                updatePaymentUrl,
                attemptNumber: failedAttempts,
                settings,
            });
            await (0, zeptomail_1.sendEmail)({
                to: [{ address: ownerEmail, name: (shopData === null || shopData === void 0 ? void 0 : shopData.name) || "Shop Owner" }],
                subject: "Action Required: Payment failed for LaundryBill",
                htmlBody,
            });
            console.log(`Payment failed email sent to ${ownerEmail}`);
        }
    }
    catch (err) {
        console.error("Failed to send payment failed email:", err);
    }
    console.log(`Payment failed for shop ${shopId}. Attempt ${failedAttempts}. Grace period until ${graceEndDate}`);
}
/**
 * Handle subscription activation
 * Called when a Razorpay subscription becomes active
 */
async function handleSubscriptionActivated(subscription) {
    console.log(`Subscription activated: ${subscription.id}`);
    const { shopId, planId } = subscription.notes;
    if (!shopId) {
        console.error("Missing shopId in subscription notes");
        return;
    }
    const now = admin.firestore.Timestamp.now();
    const periodEnd = new Date(subscription.current_end * 1000);
    // Update subscription document
    const subRef = db.collection("subscriptions").doc(shopId);
    await subRef.set({
        shopId,
        planId: planId || "pro",
        status: "active",
        razorpaySubscriptionId: subscription.id,
        razorpayCustomerId: subscription.customer_id,
        currentPeriodStart: admin.firestore.Timestamp.fromMillis(subscription.current_start * 1000),
        currentPeriodEnd: admin.firestore.Timestamp.fromDate(periodEnd),
        endDate: admin.firestore.Timestamp.fromDate(periodEnd),
        updatedAt: now,
    }, { merge: true });
    console.log(`Subscription ${subscription.id} activated for shop ${shopId}`);
}
/**
 * Handle subscription charged (renewal)
 */
async function handleSubscriptionCharged(subscription, payment) {
    console.log(`Subscription charged: ${subscription.id}`);
    const { shopId } = subscription.notes;
    if (!shopId) {
        console.error("Missing shopId in subscription notes");
        return;
    }
    const subRef = db.collection("subscriptions").doc(shopId);
    // Idempotency: if we have a payment, skip if already recorded
    if (payment) {
        const existingPayments = await subRef.collection("payments")
            .where("paymentId", "==", payment.id)
            .limit(1)
            .get();
        if (!existingPayments.empty) {
            console.log(`Renewal payment ${payment.id} already processed for shop ${shopId}, skipping.`);
            return;
        }
    }
    const now = admin.firestore.Timestamp.now();
    const periodEnd = new Date(subscription.current_end * 1000);
    const periodStartTs = admin.firestore.Timestamp.fromMillis(subscription.current_start * 1000);
    const periodEndTs = admin.firestore.Timestamp.fromDate(periodEnd);
    const subDocBefore = await subRef.get();
    const subDataBefore = subDocBefore.data();
    // Update subscription document
    await subRef.update({
        status: "active",
        currentPeriodStart: periodStartTs,
        currentPeriodEnd: periodEndTs,
        endDate: periodEndTs,
        lastPaymentDate: now,
        lastPaymentAmount: payment ? payment.amount / 100 : null,
        lastPaymentId: (payment === null || payment === void 0 ? void 0 : payment.id) || null,
        failedPaymentAttempts: 0,
        updatedAt: now,
    });
    // Record payment
    if (payment) {
        await subRef.collection("payments").add({
            type: "renewal",
            paymentId: payment.id,
            amount: payment.amount / 100,
            currency: payment.currency,
            method: payment.method,
            status: "success",
            date: now,
        });
        // Super Admin: write to top-level payments
        await writePaymentForSuperAdmin({
            shopId,
            amount: payment.amount / 100,
            currency: payment.currency || "INR",
            status: "success",
            planId: (subDataBefore === null || subDataBefore === void 0 ? void 0 : subDataBefore.planId) || "free",
            billingCycle: (subDataBefore === null || subDataBefore === void 0 ? void 0 : subDataBefore.billingCycle) || "monthly",
            method: "razorpay",
            gatewayPaymentId: payment.id,
            gatewayOrderId: payment.order_id,
            type: "renewal",
            periodStart: periodStartTs,
            periodEnd: periodEndTs,
        });
    }
    // Send renewal receipt email
    try {
        const subDoc = await subRef.get();
        const subData = subDoc.data();
        const shopDoc = await db.collection("shops").doc(shopId).get();
        const shopData = shopDoc.data();
        const ownerEmail = (shopData === null || shopData === void 0 ? void 0 : shopData.email) || (shopData === null || shopData === void 0 ? void 0 : shopData.ownerEmail) || (subData === null || subData === void 0 ? void 0 : subData.userEmail);
        if (ownerEmail && payment) {
            const settings = await (0, platform_settings_1.getPlatformSettings)();
            const currencySymbol = await (0, currency_helper_1.getShopCurrencySymbol)(shopId);
            const nextBillingStr = periodEnd.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
            });
            const htmlBody = (0, email_renewal_1.getRenewalReceiptTemplate)({
                shopName: (shopData === null || shopData === void 0 ? void 0 : shopData.name) || "Shop Owner",
                planName: (subData === null || subData === void 0 ? void 0 : subData.planName) || "Premium",
                amount: payment.amount / 100,
                nextBillingDate: nextBillingStr,
                currencySymbol,
                settings,
            });
            await (0, zeptomail_1.sendEmail)({
                to: [{ address: ownerEmail, name: (shopData === null || shopData === void 0 ? void 0 : shopData.name) || "Shop Owner" }],
                subject: "Payment received - LaundryBill subscription renewed",
                htmlBody,
            });
            console.log(`Renewal receipt email sent to ${ownerEmail}`);
        }
    }
    catch (err) {
        console.error("Failed to send renewal receipt email:", err);
    }
    console.log(`Subscription renewed for shop ${shopId} until ${periodEnd}`);
}
/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCancelled(subscription) {
    console.log(`Subscription cancelled: ${subscription.id}`);
    const { shopId } = subscription.notes;
    if (!shopId) {
        console.error("Missing shopId in subscription notes");
        return;
    }
    const now = admin.firestore.Timestamp.now();
    // Update subscription - user keeps access until period end
    const subRef = db.collection("subscriptions").doc(shopId);
    const subDoc = await subRef.get();
    const subData = subDoc.data();
    await subRef.update({
        status: "cancelled",
        cancelledAt: now,
        cancelledBy: "razorpay",
        activeUntil: (subData === null || subData === void 0 ? void 0 : subData.currentPeriodEnd) || (subData === null || subData === void 0 ? void 0 : subData.endDate),
        updatedAt: now,
    });
    console.log(`Subscription cancelled for shop ${shopId}`);
}
/**
 * Handle refund creation
 * Full refund → downgrade subscription to free, remove paid features.
 */
async function handleRefundCreated(refund) {
    var _a;
    console.log(`Refund created: ${refund.id}, Amount: ₹${refund.amount / 100}`);
    const { shopId } = refund.notes;
    if (!shopId) {
        console.error("Missing shopId in refund notes");
        return;
    }
    const now = admin.firestore.Timestamp.now();
    const subRef = db.collection("subscriptions").doc(shopId);
    const subDoc = await subRef.get();
    const subDataRefund = subDoc.data();
    // Record refund in subscription payments
    await subRef.collection("payments").add({
        type: "refund",
        refundId: refund.id,
        originalPaymentId: refund.payment_id,
        amount: refund.amount / 100,
        status: refund.status,
        date: now,
    });
    // Super Admin: write to top-level payments
    await writePaymentForSuperAdmin({
        shopId,
        amount: refund.amount / 100,
        currency: "INR",
        status: "refunded",
        planId: (subDataRefund === null || subDataRefund === void 0 ? void 0 : subDataRefund.planId) || "free",
        billingCycle: (subDataRefund === null || subDataRefund === void 0 ? void 0 : subDataRefund.billingCycle) || "monthly",
        method: "razorpay",
        gatewayPaymentId: refund.payment_id,
        type: "refund",
    });
    // Full refund → downgrade to free, remove paid features immediately
    let isFullRefund = false;
    try {
        const payment = await (0, razorpay_1.getPayment)(refund.payment_id);
        const originalAmount = (_a = payment.amount) !== null && _a !== void 0 ? _a : 0;
        isFullRefund = refund.amount >= originalAmount;
    }
    catch (e) {
        console.warn("Could not fetch original payment for refund check:", e);
    }
    if (isFullRefund) {
        await subRef.update({
            status: "expired",
            previousPlanId: (subDataRefund === null || subDataRefund === void 0 ? void 0 : subDataRefund.planId) || "free",
            planId: "free",
            planName: "Free",
            refundedAt: now,
            refundAmount: refund.amount / 100,
            endDate: null,
            currentPeriodEnd: null,
            activeUntil: null,
            updatedAt: now,
        });
        const shopRef = db.collection("shops").doc(shopId);
        await shopRef.update({
            plan: "free",
            subscriptionStatus: "expired",
            "subscription.planId": "free",
            "subscription.status": "expired",
            "subscription.endDate": null,
            updatedAt: now,
        });
        console.log(`Full refund: shop ${shopId} downgraded to free.`);
    }
    console.log(`Refund recorded for shop ${shopId}`);
}
/**
 * Write a payment doc to top-level `payments` so Super Admin can see all platform payments.
 */
async function writePaymentForSuperAdmin(p) {
    var _a, _b, _c, _d, _e;
    try {
        let shopName = p.shopName;
        if (!shopName) {
            const shopDoc = await db.collection("shops").doc(p.shopId).get();
            shopName = ((_a = shopDoc.data()) === null || _a === void 0 ? void 0 : _a.name) || "Unknown Shop";
        }
        const now = admin.firestore.Timestamp.now();
        const invoiceNumber = `INV-${Date.now()}-${p.shopId.slice(0, 8)}`;
        await db.collection("payments").add({
            shopId: p.shopId,
            shopName,
            subscriptionId: p.shopId,
            amount: p.amount,
            currency: p.currency,
            status: p.status,
            planId: p.planId,
            billingCycle: p.billingCycle,
            method: p.method,
            gatewayPaymentId: (_b = p.gatewayPaymentId) !== null && _b !== void 0 ? _b : null,
            gatewayOrderId: (_c = p.gatewayOrderId) !== null && _c !== void 0 ? _c : null,
            invoiceNumber,
            gstAmount: 0,
            periodStart: (_d = p.periodStart) !== null && _d !== void 0 ? _d : now,
            periodEnd: (_e = p.periodEnd) !== null && _e !== void 0 ? _e : now,
            createdAt: now,
            updatedAt: now,
        });
        console.log(`Super Admin payment recorded: ${p.type} ${p.status} shop=${p.shopId} ₹${p.amount}`);
    }
    catch (err) {
        console.error("Failed to write payment for Super Admin:", err);
    }
}
function getPlanName(planId) {
    const names = {
        free: "Free",
        pro: "Pro",
        pro_plus: "Pro Plus",
        business: "Business",
    };
    return names[planId] || "Premium";
}
async function sendUpgradeEmail(shopId, planId, amount, billingCycle, endDate) {
    try {
        const shopDoc = await db.collection("shops").doc(shopId).get();
        const shopData = shopDoc.data();
        if (!(shopData === null || shopData === void 0 ? void 0 : shopData.email)) {
            console.warn(`No email found for shop ${shopId}`);
            return;
        }
        const [settings, currencySymbol] = await Promise.all([
            (0, platform_settings_1.getPlatformSettings)(),
            (0, currency_helper_1.getShopCurrencySymbol)(shopId),
        ]);
        const today = new Date().toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });
        const expiryStr = endDate.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });
        const htmlBody = (0, email_upgrade_1.getUpgradeConfirmationTemplate)({
            shopName: shopData.name || "Shop Owner",
            planName: getPlanName(planId),
            planPrice: String(amount),
            billingCycle: billingCycle === "yearly" ? "Annual" : "Monthly",
            startDate: today,
            endDate: expiryStr,
            currencySymbol,
            settings,
        });
        await (0, zeptomail_1.sendEmail)({
            to: [{ address: shopData.email, name: shopData.name || "Shop Owner" }],
            subject: `🎉 Welcome to LaundryBill ${getPlanName(planId)}!`,
            htmlBody,
        });
        console.log(`Upgrade email sent to ${shopData.email}`);
    }
    catch (error) {
        console.error("Failed to send upgrade email:", error);
    }
}
async function sendReactivationEmail(shopId, planId, amount, billingCycle, endDate) {
    try {
        const shopDoc = await db.collection("shops").doc(shopId).get();
        const shopData = shopDoc.data();
        if (!(shopData === null || shopData === void 0 ? void 0 : shopData.email)) {
            console.warn(`No email found for shop ${shopId}`);
            return;
        }
        const [settings, currencySymbol] = await Promise.all([
            (0, platform_settings_1.getPlatformSettings)(),
            (0, currency_helper_1.getShopCurrencySymbol)(shopId),
        ]);
        const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
        const expiryStr = endDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
        const htmlBody = (0, email_reactivation_1.getReactivationTemplate)({
            shopName: shopData.name || "Shop Owner",
            planName: getPlanName(planId),
            planPrice: String(amount),
            billingCycle: billingCycle === "yearly" ? "Annual" : "Monthly",
            startDate: today,
            endDate: expiryStr,
            currencySymbol,
            settings,
        });
        await (0, zeptomail_1.sendEmail)({
            to: [{ address: shopData.email, name: shopData.name || "Shop Owner" }],
            subject: `Welcome back to LaundryBill – ${getPlanName(planId)} is active again`,
            htmlBody,
        });
        console.log(`Reactivation email sent to ${shopData.email}`);
    }
    catch (error) {
        console.error("Failed to send reactivation email:", error);
    }
}
//# sourceMappingURL=razorpay-webhook.js.map