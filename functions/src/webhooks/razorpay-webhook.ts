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

import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { verifyWebhookSignature, getPayment } from "../services/razorpay";
import { sendEmail } from "../services/zeptomail";
import { getUpgradeConfirmationTemplate } from "../services/email-upgrade";
import { getReactivationTemplate } from "../services/email-reactivation";
import { getPaymentFailedTemplate } from "../services/email-payment-failed";
import { getRenewalReceiptTemplate } from "../services/email-renewal";
import { getPlatformSettings } from "../services/platform-settings";
import { getShopCurrencySymbol } from "../services/currency-helper";

// Ensure Firestore is initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();

// Event type definitions
interface RazorpayWebhookEvent {
    event: string;
    payload: {
        payment?: {
            entity: RazorpayPayment;
        };
        subscription?: {
            entity: RazorpaySubscription;
        };
        refund?: {
            entity: RazorpayRefund;
        };
    };
    created_at: number;
}

interface RazorpayPayment {
    id: string;
    amount: number;
    currency: string;
    status: string;
    order_id: string;
    method: string;
    email: string;
    contact: string;
    notes: Record<string, string>;
    error_code?: string;
    error_description?: string;
    created_at: number;
}

interface RazorpaySubscription {
    id: string;
    plan_id: string;
    status: string;
    current_start: number;
    current_end: number;
    ended_at?: number;
    quantity: number;
    notes: Record<string, string>;
    customer_id: string;
}

interface RazorpayRefund {
    id: string;
    payment_id: string;
    amount: number;
    status: string;
    notes: Record<string, string>;
}

/**
 * Main Razorpay Webhook Endpoint
 */
export const razorpayWebhook = onRequest(
    {
        cors: false, // Webhooks don't need CORS
        maxInstances: 10,
    },
    async (req, res) => {
        // Only accept POST
        if (req.method !== "POST") {
            res.status(405).send("Method Not Allowed");
            return;
        }

        // Get raw body for signature verification
        const rawBody = JSON.stringify(req.body);
        const signature = req.headers["x-razorpay-signature"] as string;

        console.log("Received Razorpay webhook:", req.body?.event);

        // Verify signature
        if (!signature || !verifyWebhookSignature(rawBody, signature)) {
            console.error("Invalid webhook signature");
            res.status(401).send("Invalid signature");
            return;
        }

        // Parse event
        const event = req.body as RazorpayWebhookEvent;
        const eventType = event.event;

        try {
            // Route to appropriate handler
            switch (eventType) {
                case "payment.captured":
                    await handlePaymentCaptured(event.payload.payment!.entity);
                    break;

                case "payment.failed":
                    await handlePaymentFailed(event.payload.payment!.entity);
                    break;

                case "subscription.activated":
                    await handleSubscriptionActivated(event.payload.subscription!.entity);
                    break;

                case "subscription.charged":
                    await handleSubscriptionCharged(event.payload.subscription!.entity, event.payload.payment?.entity);
                    break;

                case "subscription.cancelled":
                    await handleSubscriptionCancelled(event.payload.subscription!.entity);
                    break;

                case "refund.created":
                    await handleRefundCreated(event.payload.refund!.entity);
                    break;

                default:
                    console.log(`Unhandled event type: ${eventType}`);
            }

            // Return 200 quickly to acknowledge receipt
            res.status(200).send("OK");
        } catch (error) {
            console.error(`Error processing webhook ${eventType}:`, error);
            // Still return 200 to prevent Razorpay from retrying
            // Log the error for manual investigation
            res.status(200).send("Processed with errors");
        }
    }
);

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Handle successful payment capture
 * Used for one-time payments (first subscription)
 */
async function handlePaymentCaptured(payment: RazorpayPayment) {
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

    const notesPeriodDays = payment.notes?.periodDays != null ? parseInt(String(payment.notes.periodDays), 10) : NaN;
    const periodDays = Number.isFinite(notesPeriodDays) && notesPeriodDays > 0
        ? notesPeriodDays
        : (billingCycle === "yearly" ? 365 : 30);

    // Check for existing active subscription to handle Proration/Credit Days
    const subDoc = await subRef.get();
    const existingSub = subDoc.data();

    let endDate = new Date();
    endDate.setDate(endDate.getDate() + periodDays);

    // If upgrading mid-cycle, add remaining days from previous plan
    if (existingSub?.status === "active" && existingSub.endDate) {
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
        lastPaymentAmount: payment.amount / 100, // Convert paise to rupees
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
        billingCycle: (billingCycle as "monthly" | "yearly") || "monthly",
        method: "razorpay",
        gatewayPaymentId: payment.id,
        gatewayOrderId: payment.order_id,
        type: "subscription",
        periodStart: now,
        periodEnd: admin.firestore.Timestamp.fromDate(endDate),
    });

    const wasExpiredOrFree = existingSub?.status === "expired" || existingSub?.status === "free";
    if (wasExpiredOrFree) {
        await sendReactivationEmail(shopId, planId, payment.amount / 100, billingCycle, endDate);
    } else {
        await sendUpgradeEmail(shopId, planId, payment.amount / 100, billingCycle, endDate);
    }

    console.log(`Subscription activated for shop ${shopId} on plan ${planId}`);
}

/**
 * Handle failed payment
 * Enter grace period if subscription renewal fails
 */
async function handlePaymentFailed(payment: RazorpayPayment) {
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

    const failedAttempts = (subData?.failedPaymentAttempts || 0) + 1;

    // Calculate grace period end (7 days from now)
    const graceEndDate = new Date();
    graceEndDate.setDate(graceEndDate.getDate() + 7);

    // Update subscription status
    await subRef.update({
        status: failedAttempts === 1 ? "grace_period" : subData?.status,
        failedPaymentAttempts: failedAttempts,
        lastFailedPaymentDate: now,
        lastFailedPaymentReason: payment.error_description || payment.error_code || "Unknown error",
        graceEndDate: failedAttempts === 1 ? admin.firestore.Timestamp.fromDate(graceEndDate) : subData?.graceEndDate,
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
        planId: subData?.planId || "free",
        billingCycle: (subData?.billingCycle as "monthly" | "yearly") || "monthly",
        method: "razorpay",
        gatewayPaymentId: payment.id,
        type: "renewal_failed",
    });

    // Send payment failed email
    try {
        const shopDoc = await db.collection("shops").doc(shopId).get();
        const shopData = shopDoc.data();
        const ownerEmail = shopData?.email || shopData?.ownerEmail || subData?.userEmail;
        if (ownerEmail) {
            const settings = await getPlatformSettings();
            const updatePaymentUrl = `${settings.appUrl}/settings/subscription`;
            const graceEndStr = graceEndDate.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
            });
            const htmlBody = getPaymentFailedTemplate({
                shopName: shopData?.name || "Shop Owner",
                planName: subData?.planName || "Premium",
                errorDescription: payment.error_description || payment.error_code || undefined,
                graceEndDate: graceEndStr,
                updatePaymentUrl,
                attemptNumber: failedAttempts,
                settings,
            });
            await sendEmail({
                to: [{ address: ownerEmail, name: shopData?.name || "Shop Owner" }],
                subject: "Action Required: Payment failed for LaundryBill",
                htmlBody,
            });
            console.log(`Payment failed email sent to ${ownerEmail}`);
        }
    } catch (err) {
        console.error("Failed to send payment failed email:", err);
    }
    console.log(`Payment failed for shop ${shopId}. Attempt ${failedAttempts}. Grace period until ${graceEndDate}`);
}

/**
 * Handle subscription activation
 * Called when a Razorpay subscription becomes active
 */
async function handleSubscriptionActivated(subscription: RazorpaySubscription) {
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
async function handleSubscriptionCharged(
    subscription: RazorpaySubscription,
    payment?: RazorpayPayment
) {
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
        lastPaymentId: payment?.id || null,
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
            planId: subDataBefore?.planId || "free",
            billingCycle: (subDataBefore?.billingCycle as "monthly" | "yearly") || "monthly",
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
        const ownerEmail = shopData?.email || shopData?.ownerEmail || subData?.userEmail;
        if (ownerEmail && payment) {
            const settings = await getPlatformSettings();
            const currencySymbol = await getShopCurrencySymbol(shopId);
            const nextBillingStr = periodEnd.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
            });
            const htmlBody = getRenewalReceiptTemplate({
                shopName: shopData?.name || "Shop Owner",
                planName: subData?.planName || "Premium",
                amount: payment.amount / 100,
                nextBillingDate: nextBillingStr,
                currencySymbol,
                settings,
            });
            await sendEmail({
                to: [{ address: ownerEmail, name: shopData?.name || "Shop Owner" }],
                subject: "Payment received - LaundryBill subscription renewed",
                htmlBody,
            });
            console.log(`Renewal receipt email sent to ${ownerEmail}`);
        }
    } catch (err) {
        console.error("Failed to send renewal receipt email:", err);
    }
    console.log(`Subscription renewed for shop ${shopId} until ${periodEnd}`);
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCancelled(subscription: RazorpaySubscription) {
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
        cancelledBy: "razorpay", // Could be 'user' if we triggered it
        activeUntil: subData?.currentPeriodEnd || subData?.endDate,
        updatedAt: now,
    });

    console.log(`Subscription cancelled for shop ${shopId}`);
}

/**
 * Handle refund creation
 * Full refund → downgrade subscription to free, remove paid features.
 */
async function handleRefundCreated(refund: RazorpayRefund) {
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
        planId: subDataRefund?.planId || "free",
        billingCycle: (subDataRefund?.billingCycle as "monthly" | "yearly") || "monthly",
        method: "razorpay",
        gatewayPaymentId: refund.payment_id,
        type: "refund",
    });

    // Full refund → downgrade to free, remove paid features immediately
    let isFullRefund = false;
    try {
        const payment = await getPayment(refund.payment_id);
        const originalAmount = (payment as { amount?: number }).amount ?? 0;
        isFullRefund = refund.amount >= originalAmount;
    } catch (e) {
        console.warn("Could not fetch original payment for refund check:", e);
    }

    if (isFullRefund) {
        await subRef.update({
            status: "expired",
            previousPlanId: subDataRefund?.planId || "free",
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

// ============================================
// HELPER FUNCTIONS
// ============================================

type SuperAdminPaymentStatus = "success" | "failed" | "refunded" | "pending";
type SuperAdminPaymentMethod = "razorpay" | "manual" | "bank_transfer" | "free";

/**
 * Write a payment doc to top-level `payments` so Super Admin can see all platform payments.
 */
async function writePaymentForSuperAdmin(p: {
    shopId: string;
    shopName?: string;
    amount: number;
    currency: string;
    status: SuperAdminPaymentStatus;
    planId: string;
    billingCycle: "monthly" | "yearly";
    method: SuperAdminPaymentMethod;
    gatewayPaymentId?: string;
    gatewayOrderId?: string;
    type: "subscription" | "renewal" | "renewal_failed" | "refund";
    periodStart?: admin.firestore.Timestamp;
    periodEnd?: admin.firestore.Timestamp;
}): Promise<void> {
    try {
        let shopName = p.shopName;
        if (!shopName) {
            const shopDoc = await db.collection("shops").doc(p.shopId).get();
            shopName = shopDoc.data()?.name || "Unknown Shop";
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
            gatewayPaymentId: p.gatewayPaymentId ?? null,
            gatewayOrderId: p.gatewayOrderId ?? null,
            invoiceNumber,
            gstAmount: 0,
            periodStart: p.periodStart ?? now,
            periodEnd: p.periodEnd ?? now,
            createdAt: now,
            updatedAt: now,
        });
        console.log(`Super Admin payment recorded: ${p.type} ${p.status} shop=${p.shopId} ₹${p.amount}`);
    } catch (err) {
        console.error("Failed to write payment for Super Admin:", err);
    }
}

function getPlanName(planId: string): string {
    const names: Record<string, string> = {
        free: "Free",
        pro: "Pro",
        pro_plus: "Pro Plus",
        business: "Business",
    };
    return names[planId] || "Premium";
}

async function sendUpgradeEmail(shopId: string, planId: string, amount: number, billingCycle: string, endDate: Date) {
    try {
        const shopDoc = await db.collection("shops").doc(shopId).get();
        const shopData = shopDoc.data();

        if (!shopData?.email) {
            console.warn(`No email found for shop ${shopId}`);
            return;
        }

        const [settings, currencySymbol] = await Promise.all([
            getPlatformSettings(),
            getShopCurrencySymbol(shopId),
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

        const htmlBody = getUpgradeConfirmationTemplate({
            shopName: shopData.name || "Shop Owner",
            planName: getPlanName(planId),
            planPrice: String(amount),
            billingCycle: billingCycle === "yearly" ? "Annual" : "Monthly",
            startDate: today,
            endDate: expiryStr,
            currencySymbol,
            settings,
        });

        await sendEmail({
            to: [{ address: shopData.email, name: shopData.name || "Shop Owner" }],
            subject: `🎉 Welcome to LaundryBill ${getPlanName(planId)}!`,
            htmlBody,
        });

        console.log(`Upgrade email sent to ${shopData.email}`);
    } catch (error) {
        console.error("Failed to send upgrade email:", error);
    }
}

async function sendReactivationEmail(shopId: string, planId: string, amount: number, billingCycle: string, endDate: Date) {
    try {
        const shopDoc = await db.collection("shops").doc(shopId).get();
        const shopData = shopDoc.data();
        if (!shopData?.email) {
            console.warn(`No email found for shop ${shopId}`);
            return;
        }
        const [settings, currencySymbol] = await Promise.all([
            getPlatformSettings(),
            getShopCurrencySymbol(shopId),
        ]);
        const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
        const expiryStr = endDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
        const htmlBody = getReactivationTemplate({
            shopName: shopData.name || "Shop Owner",
            planName: getPlanName(planId),
            planPrice: String(amount),
            billingCycle: billingCycle === "yearly" ? "Annual" : "Monthly",
            startDate: today,
            endDate: expiryStr,
            currencySymbol,
            settings,
        });
        await sendEmail({
            to: [{ address: shopData.email, name: shopData.name || "Shop Owner" }],
            subject: `Welcome back to LaundryBill – ${getPlanName(planId)} is active again`,
            htmlBody,
        });
        console.log(`Reactivation email sent to ${shopData.email}`);
    } catch (error) {
        console.error("Failed to send reactivation email:", error);
    }
}