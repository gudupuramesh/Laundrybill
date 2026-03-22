/**
 * Upgrade Confirmation Email Trigger
 * Sends confirmation when a subscription is upgraded to a paid plan
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { sendEmail } from "../services/zeptomail";
import { getUpgradeConfirmationTemplate } from "../services/email-upgrade";
import { getPlatformSettings } from "../services/platform-settings";
import { getShopCurrencySymbol } from "../services/currency-helper";

const db = admin.firestore();

export const sendUpgradeConfirmationEmail = onDocumentUpdated(
    "subscriptions/{subscriptionId}",
    async (event) => {
        console.log("=== Subscription Update Detected ===");
        console.log("Subscription ID:", event.params.subscriptionId);

        const beforeData = event.data?.before.data();
        const afterData = event.data?.after.data();

        if (!beforeData || !afterData) {
            console.log("❌ Missing subscription data - before or after is null");
            return;
        }

        // Log all relevant fields for debugging
        console.log("Before Data:", JSON.stringify({
            planId: beforeData.planId,
            planName: beforeData.planName,
            status: beforeData.status,
            shopId: beforeData.shopId
        }));
        console.log("After Data:", JSON.stringify({
            planId: afterData.planId,
            planName: afterData.planName,
            status: afterData.status,
            shopId: afterData.shopId
        }));

        const oldPlanId = beforeData.planId || "";
        const newPlanId = afterData.planId || "";
        const oldStatus = beforeData.status || "";
        const newStatus = afterData.status || "";

        // Detect upgrade scenarios more broadly:
        // 1. Status changed to 'active' from anything else (new activation or renewal)
        // 2. Plan changed from 'free' or 'trial' to any paid plan
        // 3. Plan changed to any different plan (tier change)
        // 4. Manual override by Super Admin (any plan change where new is not free/trial)

        const freePlans = ["free", "trial", "", undefined, null];
        const wasFreePlan = freePlans.includes(oldPlanId as any);
        const isNowPaidPlan = !freePlans.includes(newPlanId as any);
        const planChanged = oldPlanId !== newPlanId;

        const isNewActivation = oldStatus !== "active" && newStatus === "active";
        const isUpgradeFromFree = wasFreePlan && isNowPaidPlan;
        const isPaidPlanChange = planChanged && isNowPaidPlan && !wasFreePlan;

        console.log("Detection Results:", JSON.stringify({
            isNewActivation,
            isUpgradeFromFree,
            isPaidPlanChange,
            planChanged,
            wasFreePlan,
            isNowPaidPlan
        }));

        // Trigger email if any upgrade scenario is detected
        const shouldSendEmail = isNewActivation || isUpgradeFromFree || isPaidPlanChange;

        if (!shouldSendEmail) {
            console.log("ℹ️ Not an upgrade event, skipping email");
            console.log("  Reason: No matching upgrade condition");
            return;
        }

        console.log("✅ Upgrade detected! Proceeding to send email...");

        // Get shop details
        const shopId = afterData.shopId;
        if (!shopId) {
            console.log("❌ No shopId found in subscription");
            return;
        }

        console.log("Looking up shop:", shopId);
        const shopDoc = await db.collection("shops").doc(shopId).get();
        if (!shopDoc.exists) {
            console.log("❌ Shop not found:", shopId);
            return;
        }

        const shopData = shopDoc.data();
        console.log("Shop data found:", JSON.stringify({
            name: shopData?.name,
            email: shopData?.email,
            phone: shopData?.phone
        }));

        const shopName = shopData?.name || "Your Shop";
        // Try multiple email sources
        const ownerEmail = shopData?.email || shopData?.ownerEmail || afterData.userEmail;

        if (!ownerEmail) {
            console.log("❌ No owner email found for shop:", shopId);
            console.log("  Available fields:", Object.keys(shopData || {}));
            return;
        }

        const planName = afterData.planName || newPlanId || "Premium";
        const billingCycle = afterData.billingCycle === "yearly" ? "Annual" : "Monthly";
        const planPrice = String(afterData.lastPaymentAmount ?? afterData.planPrice ?? "999");

        // Extract subscription dates
        const startDate = afterData.startDate?.toDate?.()
            ? afterData.startDate.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
            : new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

        const endDate = afterData.endDate?.toDate?.()
            ? afterData.endDate.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
            : undefined;

        console.log(`📧 Sending upgrade confirmation to ${ownerEmail} for plan: ${planName}`);
        console.log(`   Start: ${startDate}, End: ${endDate || 'Not set'}`);

        // Fetch platform settings for dynamic branding
        const [settings, currencySymbol] = await Promise.all([
            getPlatformSettings(),
            getShopCurrencySymbol(shopId),
        ]);

        const htmlBody = getUpgradeConfirmationTemplate({
            shopName,
            planName,
            planPrice,
            billingCycle,
            startDate,
            endDate,
            subscriptionId: event.params.subscriptionId,
            currencySymbol,
            settings
        });

        const result = await sendEmail({
            to: [{ address: ownerEmail, name: shopName }],
            subject: `🚀 Upgrade Successful - Welcome to ${planName}!`,
            htmlBody: htmlBody,
        });

        if (result.success) {
            console.log(`✅ Upgrade confirmation email sent to ${ownerEmail}`);
            await db.collection("email_logs").add({
                type: "upgrade_confirmation",
                shopId: shopId,
                subscriptionId: event.params.subscriptionId,
                email: ownerEmail,
                planId: newPlanId,
                planName: planName,
                oldPlanId: oldPlanId,
                status: "sent",
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        } else {
            console.error(`❌ Failed to send upgrade email to ${ownerEmail}:`, result.error);
            await db.collection("email_logs").add({
                type: "upgrade_confirmation",
                shopId: shopId,
                subscriptionId: event.params.subscriptionId,
                email: ownerEmail,
                status: "failed",
                error: JSON.stringify(result.error),
                attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    }
);
