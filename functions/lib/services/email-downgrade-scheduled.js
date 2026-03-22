"use strict";
/**
 * Downgrade scheduled confirmation email.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDowngradeScheduledTemplate = void 0;
const platform_settings_1 = require("./platform-settings");
const email_templates_1 = require("./email-templates");
function getDowngradeScheduledTemplate(data) {
    const { shopName, currentPlanName, newPlanName, effectiveDate, settings = platform_settings_1.DEFAULT_SETTINGS } = data;
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Plan Change Scheduled - ${settings.brandName}</title>
    <style>${email_templates_1.commonStyles}</style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <div style="display: none;">Your plan will change to ${newPlanName} on ${effectiveDate}.</div>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
        <tr><td align="center" style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="w-full" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                ${(0, email_templates_1.getEmailHeader)(settings, "Plan Change Scheduled")}
                <tr><td style="background-color: #fffbeb; border-bottom: 1px solid #fcd34d; padding: 16px 40px; text-align: center;">
                    <span style="display: inline-block; background-color: #f59e0b; color: white; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 700;">Downgrade scheduled</span>
                </td></tr>
                <tr><td style="padding: 40px;" class="mobile-padding">
                    <h2 style="margin: 0 0 16px; color: #18181b; font-size: 24px; font-weight: 700; text-align: center;">Plan change confirmed</h2>
                    <p style="margin: 0 0 20px; color: #52525b; font-size: 15px; line-height: 1.6; text-align: center;">
                        Hi <strong style="color: #18181b;">${shopName}</strong>,<br><br>
                        You'll stay on <strong>${currentPlanName}</strong> until <strong>${effectiveDate}</strong>. After that, your plan will change to <strong>${newPlanName}</strong>.
                    </p>
                    <p style="margin: 0; color: #71717a; font-size: 14px; text-align: center;">You can upgrade again anytime from Settings → Subscription.</p>
                </td></tr>
                ${(0, email_templates_1.getEmailFooter)(settings)}
            </table>
        </td></tr>
    </table>
</body>
</html>`;
}
exports.getDowngradeScheduledTemplate = getDowngradeScheduledTemplate;
//# sourceMappingURL=email-downgrade-scheduled.js.map