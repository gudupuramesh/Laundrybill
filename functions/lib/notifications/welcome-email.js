"use strict";
/**
 * Welcome Email Trigger
 * Sends a welcome email when a new shop is created
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWelcomeEmail = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const zeptomail_1 = require("../services/zeptomail");
const email_templates_1 = require("../services/email-templates");
const platform_settings_1 = require("../services/platform-settings");
const db = admin.firestore();
exports.sendWelcomeEmail = (0, firestore_1.onDocumentCreated)("shops/{shopId}", async (event) => {
    var _a;
    const shopData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!shopData) {
        console.log("No shop data found");
        return;
    }
    const shopName = shopData.name || "New Shop";
    const ownerEmail = shopData.email;
    if (!ownerEmail) {
        console.log("No owner email found for shop:", event.params.shopId);
        return;
    }
    console.log(`Sending welcome email to ${ownerEmail} for shop: ${shopName}`);
    // Fetch platform settings for dynamic branding
    const settings = await (0, platform_settings_1.getPlatformSettings)();
    const htmlBody = (0, email_templates_1.getWelcomeEmailTemplate)(shopName, settings);
    const result = await (0, zeptomail_1.sendEmail)({
        to: [{ address: ownerEmail, name: shopName }],
        subject: `🎉 Welcome to ${settings.brandName} - Let's Get Started!`,
        htmlBody: htmlBody,
    });
    if (result.success) {
        console.log(`Welcome email sent successfully to ${ownerEmail}`);
        // Log the email send event
        await db.collection("email_logs").add({
            type: "welcome",
            shopId: event.params.shopId,
            email: ownerEmail,
            status: "sent",
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    else {
        console.error(`Failed to send welcome email to ${ownerEmail}:`, result.error);
        await db.collection("email_logs").add({
            type: "welcome",
            shopId: event.params.shopId,
            email: ownerEmail,
            status: "failed",
            error: result.error,
            attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
});
//# sourceMappingURL=welcome-email.js.map