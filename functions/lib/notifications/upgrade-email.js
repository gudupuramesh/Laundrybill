"use strict";
/**
 * Upgrade Confirmation Email Trigger
 * Sends confirmation when a subscription is upgraded to a paid plan
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendUpgradeConfirmationEmail = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const zeptomail_1 = require("../services/zeptomail");
const email_upgrade_1 = require("../services/email-upgrade");
const platform_settings_1 = require("../services/platform-settings");
const currency_helper_1 = require("../services/currency-helper");
const db = admin.firestore();
exports.sendUpgradeConfirmationEmail = (0, firestore_1.onDocumentUpdated)("subscriptions/{subscriptionId}", async (event) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    console.log("=== Subscription Update Detected ===");
    console.log("Subscription ID:", event.params.subscriptionId);
    const beforeData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const afterData = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
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
    const wasFreePlan = freePlans.includes(oldPlanId);
    const isNowPaidPlan = !freePlans.includes(newPlanId);
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
        name: shopData === null || shopData === void 0 ? void 0 : shopData.name,
        email: shopData === null || shopData === void 0 ? void 0 : shopData.email,
        phone: shopData === null || shopData === void 0 ? void 0 : shopData.phone
    }));
    const shopName = (shopData === null || shopData === void 0 ? void 0 : shopData.name) || "Your Shop";
    // Try multiple email sources
    const ownerEmail = (shopData === null || shopData === void 0 ? void 0 : shopData.email) || (shopData === null || shopData === void 0 ? void 0 : shopData.ownerEmail) || afterData.userEmail;
    if (!ownerEmail) {
        console.log("❌ No owner email found for shop:", shopId);
        console.log("  Available fields:", Object.keys(shopData || {}));
        return;
    }
    const planName = afterData.planName || newPlanId || "Premium";
    const billingCycle = afterData.billingCycle === "yearly" ? "Annual" : "Monthly";
    const planPrice = String((_d = (_c = afterData.lastPaymentAmount) !== null && _c !== void 0 ? _c : afterData.planPrice) !== null && _d !== void 0 ? _d : "999");
    // Extract subscription dates
    const startDate = ((_f = (_e = afterData.startDate) === null || _e === void 0 ? void 0 : _e.toDate) === null || _f === void 0 ? void 0 : _f.call(_e))
        ? afterData.startDate.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
        : new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const endDate = ((_h = (_g = afterData.endDate) === null || _g === void 0 ? void 0 : _g.toDate) === null || _h === void 0 ? void 0 : _h.call(_g))
        ? afterData.endDate.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
        : undefined;
    console.log(`📧 Sending upgrade confirmation to ${ownerEmail} for plan: ${planName}`);
    console.log(`   Start: ${startDate}, End: ${endDate || 'Not set'}`);
    // Fetch platform settings for dynamic branding
    const [settings, currencySymbol] = await Promise.all([
        (0, platform_settings_1.getPlatformSettings)(),
        (0, currency_helper_1.getShopCurrencySymbol)(shopId),
    ]);
    const htmlBody = (0, email_upgrade_1.getUpgradeConfirmationTemplate)({
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
    const result = await (0, zeptomail_1.sendEmail)({
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
    }
    else {
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
});
//# sourceMappingURL=upgrade-email.js.map