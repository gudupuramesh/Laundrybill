"use strict";
/**
 * Reactivation Email Template
 * Sent when an expired/free user pays again and re-subscribes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReactivationTemplate = void 0;
const platform_settings_1 = require("./platform-settings");
const email_templates_1 = require("./email-templates");
function getReactivationTemplate(data) {
    const { shopName, planName, planPrice = "999", billingCycle, startDate, endDate, currencySymbol = "₹", settings = platform_settings_1.DEFAULT_SETTINGS, } = data;
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome back to ${settings.brandName}</title>
    <style>${email_templates_1.commonStyles}</style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <div style="display: none;">Welcome back! Your ${planName} subscription is active again.</div>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
        <tr><td align="center" style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="w-full" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                ${(0, email_templates_1.getEmailHeader)(settings, "Welcome Back")}
                <tr><td style="background-color: #f0fdfa; border-bottom: 1px solid #ccfbf1; padding: 16px 40px; text-align: center;">
                    <span style="display: inline-block; background-color: #0f766e; color: white; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 700;">Subscription reactivated</span>
                </td></tr>
                <tr><td style="padding: 40px;" class="mobile-padding">
                    <h2 style="margin: 0 0 16px; color: #18181b; font-size: 24px; font-weight: 700; text-align: center;">Welcome back, ${shopName}!</h2>
                    <p style="margin: 0 0 20px; color: #52525b; font-size: 15px; line-height: 1.6; text-align: center;">
                        Your <strong style="color: #18181b;">${planName}</strong> subscription is active again. You're all set to use premium features.
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fafafa; border-radius: 12px; border: 1px solid #e4e4e7;">
                        <tr><td style="padding: 20px;">
                            <p style="margin: 0 0 4px; color: #71717a; font-size: 12px; font-weight: 600;">Plan</p>
                            <p style="margin: 0 0 12px; color: #18181b; font-size: 18px; font-weight: 700;">${planName} · ${currencySymbol}${planPrice}/${billingCycle === "Annual" || billingCycle === "yearly" ? "year" : "month"}</p>
                            <p style="margin: 0 0 4px; color: #71717a; font-size: 12px; font-weight: 600;">Start</p>
                            <p style="margin: 0 0 12px; color: #18181b; font-size: 14px;">${startDate}</p>
                            ${endDate ? `<p style="margin: 0 0 4px; color: #71717a; font-size: 12px; font-weight: 600;">Next billing</p><p style="margin: 0; color: #18181b; font-size: 14px;">${endDate}</p>` : ""}
                        </td></tr>
                    </table>
                </td></tr>
                <tr><td style="padding: 0 40px 40px; text-align: center;">
                    <a href="${settings.dashboardUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #0f766e 0%, #0891b2 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 50px;">Open dashboard →</a>
                </td></tr>
                ${(0, email_templates_1.getEmailFooter)(settings)}
            </table>
        </td></tr>
    </table>
</body>
</html>`;
}
exports.getReactivationTemplate = getReactivationTemplate;
//# sourceMappingURL=email-reactivation.js.map