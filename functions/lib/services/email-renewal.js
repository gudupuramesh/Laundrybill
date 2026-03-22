"use strict";
/**
 * Renewal Receipt Email Template
 * Uses dynamic PlatformSettings for branding
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRenewalReceiptTemplate = void 0;
const platform_settings_1 = require("./platform-settings");
const email_templates_1 = require("./email-templates");
function getRenewalReceiptTemplate(data) {
    const { shopName, planName, amount, nextBillingDate, currencySymbol = "₹", settings = platform_settings_1.DEFAULT_SETTINGS } = data;
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Received - ${settings.brandName}</title>
    <style>${email_templates_1.commonStyles}</style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <div style="display: none;">Your ${planName} subscription was renewed. Next billing: ${nextBillingDate}.</div>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
        <tr><td align="center" style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="w-full" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                ${(0, email_templates_1.getEmailHeader)(settings, "Payment Received")}
                <tr><td style="background-color: #f0fdfa; border-bottom: 1px solid #ccfbf1; padding: 16px 40px; text-align: center;">
                    <span style="display: inline-block; background-color: #0f766e; color: white; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 700;">Subscription Renewed</span>
                </td></tr>
                <tr><td style="padding: 40px;" class="mobile-padding">
                    <h2 style="margin: 0 0 16px; color: #18181b; font-size: 24px; font-weight: 700; text-align: center;">Payment received</h2>
                    <p style="margin: 0 0 24px; color: #52525b; font-size: 15px; line-height: 1.6; text-align: center;">
                        Hi <strong style="color: #18181b;">${shopName}</strong>,<br><br>
                        Your ${planName} subscription has been renewed successfully.
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fafafa; border-radius: 12px; border: 1px solid #e4e4e7; margin-bottom: 24px;">
                        <tr><td style="padding: 24px;">
                            <p style="margin: 0 0 8px; color: #71717a; font-size: 12px; font-weight: 600; text-transform: uppercase;">Amount charged</p>
                            <p style="margin: 0 0 16px; color: #18181b; font-size: 24px; font-weight: 700;">${currencySymbol}${amount}</p>
                            <p style="margin: 0 0 4px; color: #71717a; font-size: 12px; font-weight: 600; text-transform: uppercase;">Next billing date</p>
                            <p style="margin: 0; color: #18181b; font-size: 16px; font-weight: 600;">${nextBillingDate}</p>
                        </td></tr>
                    </table>
                    <p style="margin: 0; color: #71717a; font-size: 13px; text-align: center;">Thank you for continuing with ${settings.brandName}.</p>
                </td></tr>
                ${(0, email_templates_1.getEmailFooter)(settings)}
            </table>
        </td></tr>
    </table>
</body>
</html>`;
}
exports.getRenewalReceiptTemplate = getRenewalReceiptTemplate;
//# sourceMappingURL=email-renewal.js.map