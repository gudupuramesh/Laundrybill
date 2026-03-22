"use strict";
/**
 * Grace Period Ended Email Template
 * Uses dynamic PlatformSettings for branding
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGraceEndedTemplate = void 0;
const platform_settings_1 = require("./platform-settings");
const email_templates_1 = require("./email-templates");
function getGraceEndedTemplate(data) {
    const { shopName, previousPlanName, upgradeUrl, settings = platform_settings_1.DEFAULT_SETTINGS } = data;
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Subscription Has Expired</title>
    <style>${email_templates_1.commonStyles}</style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <div style="display: none;">Your ${previousPlanName} plan has expired. Upgrade to restore features.</div>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
        <tr><td align="center" style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="w-full" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                ${(0, email_templates_1.getEmailHeader)(settings, "Subscription Expired")}
                <tr><td style="padding: 40px;" class="mobile-padding">
                    <h2 style="margin: 0 0 16px; color: #18181b; font-size: 24px; font-weight: 700; text-align: center;">Your Subscription Has Ended</h2>
                    <p style="margin: 0 0 20px; color: #52525b; font-size: 15px; line-height: 1.6; text-align: center;">
                        Hi <strong style="color: #18181b;">${shopName}</strong>,<br><br>
                        Your ${previousPlanName} plan has expired after the grace period. You're now on the Free plan.
                    </p>
                    <p style="margin: 0 0 24px; color: #52525b; font-size: 14px; line-height: 1.6; text-align: center;">
                        Upgrade anytime to restore your premium features and limits.
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                        <tr><td style="background: linear-gradient(135deg, #0f766e 0%, #0891b2 100%); border-radius: 50px; text-align: center;">
                            <a href="${upgradeUrl}" style="display: inline-block; padding: 16px 36px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700;">Upgrade Now</a>
                        </td></tr>
                    </table>
                </td></tr>
                ${(0, email_templates_1.getEmailFooter)(settings)}
            </table>
        </td></tr>
    </table>
</body>
</html>`;
}
exports.getGraceEndedTemplate = getGraceEndedTemplate;
//# sourceMappingURL=email-grace.js.map