"use strict";
/**
 * Upgrade Confirmation Email Template
 * Professional MSO-compatible design with dark mode support
 * Uses dynamic PlatformSettings for branding
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUpgradeConfirmationTemplate = void 0;
const platform_settings_1 = require("./platform-settings");
const email_templates_1 = require("./email-templates");
function getUpgradeConfirmationTemplate(data) {
    const { shopName, planName, planPrice = "999", billingCycle, startDate, endDate, subscriptionId, currencySymbol = "₹", settings = platform_settings_1.DEFAULT_SETTINGS } = data;
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to ${settings.brandName} ${planName}</title>
    <style>${email_templates_1.commonStyles}</style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <div style="display: none;">Welcome to ${settings.brandName}! Your ${planName} plan is now active.</div>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
        <tr><td align="center" style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="w-full" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                ${(0, email_templates_1.getEmailHeader)(settings, "Subscription Confirmed")}
                
                <!-- Hero Section -->
                <tr><td style="padding: 40px 40px 20px;" class="mobile-padding">
                    <div style="background-color: #f0fdfa; border: 2px solid #ccfbf1; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 24px;">
                        <span style="color: #0f766e; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">🎉 Welcome to ${planName}</span>
                    </div>
                    <h2 style="margin: 0 0 16px; color: #18181b; font-size: 28px; font-weight: 700; line-height: 1.2; text-align: center;" class="text-dark">Your Laundry Business Just Got Smarter</h2>
                    <p style="margin: 0 0 24px; color: #52525b; font-size: 16px; line-height: 1.6; text-align: center;">
                        Hi <strong style="color: #18181b;">${shopName}</strong>,<br><br>
                        Thank you for upgrading to ${settings.brandName}! Your <strong style="color: #0f766e;">${planName}</strong> subscription is now active. You're about to save 10+ hours every week.
                    </p>
                </td></tr>
                
                <!-- Plan Details Card -->
                <tr><td style="padding: 0 40px 30px;" class="mobile-padding">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fafafa; border-radius: 12px; border: 1px solid #e4e4e7;">
                        <tr><td style="padding: 24px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td width="50%" class="mobile-stack" style="padding-bottom: 16px;">
                                        <p style="margin: 0 0 4px; color: #71717a; font-size: 12px; font-weight: 600; text-transform: uppercase;">Plan Type</p>
                                        <p style="margin: 0; color: #18181b; font-size: 20px; font-weight: 700;">${planName}</p>
                                        <p style="margin: 4px 0 0; color: #0f766e; font-size: 14px; font-weight: 600;">${currencySymbol}${planPrice}/${billingCycle === "Annual" ? "year" : "month"}</p>
                                    </td>
                                    <td width="50%" class="mobile-stack" style="text-align: right; padding-bottom: 16px;">
                                        <p style="margin: 0 0 4px; color: #71717a; font-size: 12px; font-weight: 600; text-transform: uppercase;">Status</p>
                                        <span style="display: inline-block; background-color: #dcfce7; color: #15803d; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 600;">● Active</span>
                                    </td>
                                </tr>
                                <tr><td colspan="2" style="padding-top: 16px; border-top: 1px solid #e4e4e7;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                        <tr>
                                            <td width="50%">
                                                <p style="margin: 0 0 4px; color: #71717a; font-size: 12px; font-weight: 600; text-transform: uppercase;">Start Date</p>
                                                <p style="margin: 0; color: #18181b; font-size: 15px; font-weight: 600;">${startDate}</p>
                                            </td>
                                            <td width="50%">
                                                <p style="margin: 0 0 4px; color: #71717a; font-size: 12px; font-weight: 600; text-transform: uppercase;">Next Billing</p>
                                                <p style="margin: 0; color: #18181b; font-size: 15px; font-weight: 600;">${endDate || "N/A"}</p>
                                            </td>
                                        </tr>
                                    </table>
                                </td></tr>
                                ${subscriptionId ? `<tr><td colspan="2" style="padding-top: 16px;">
                                    <p style="margin: 0 0 8px; color: #71717a; font-size: 12px; font-weight: 600; text-transform: uppercase;">Subscription ID</p>
                                    <p style="margin: 0; color: #52525b; font-size: 13px; font-family: monospace; background-color: #f4f4f5; padding: 8px 12px; border-radius: 6px; word-break: break-all;">${subscriptionId}</p>
                                </td></tr>` : ""}
                            </table>
                        </td></tr>
                    </table>
                </td></tr>
                
                <!-- Features -->
                <tr><td style="padding: 0 40px 30px;" class="mobile-padding">
                    <h3 style="margin: 0 0 16px; color: #18181b; font-size: 18px; font-weight: 700;">What's Included</h3>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr><td style="padding: 12px; background: #fff; border: 1px solid #e4e4e7; border-radius: 8px; margin-bottom: 8px;">
                            <span style="color: #0d9488; font-size: 16px;">✓</span> <strong style="color: #18181b;">Unlimited Orders</strong> - No restrictions
                        </td></tr>
                        <tr><td style="height: 8px;"></td></tr>
                        <tr><td style="padding: 12px; background: #fff; border: 1px solid #e4e4e7; border-radius: 8px;">
                            <span style="color: #0d9488; font-size: 16px;">✓</span> <strong style="color: #18181b;">QR Tracking</strong> - Track every garment
                        </td></tr>
                        <tr><td style="height: 8px;"></td></tr>
                        <tr><td style="padding: 12px; background: #fff; border: 1px solid #e4e4e7; border-radius: 8px;">
                            <span style="color: #0d9488; font-size: 16px;">✓</span> <strong style="color: #18181b;">Staff Management</strong> - Role-based access
                        </td></tr>
                        <tr><td style="height: 8px;"></td></tr>
                        <tr><td style="padding: 12px; background: #fff; border: 1px solid #e4e4e7; border-radius: 8px;">
                            <span style="color: #0d9488; font-size: 16px;">✓</span> <strong style="color: #18181b;">Payment Tracking</strong> - Auto-track all payments
                        </td></tr>
                        <tr><td style="height: 8px;"></td></tr>
                        <tr><td style="padding: 12px; background: #fff; border: 1px solid #e4e4e7; border-radius: 8px;">
                            <span style="color: #0d9488; font-size: 16px;">✓</span> <strong style="color: #18181b;">Advanced Reports</strong> - Business insights
                        </td></tr>
                    </table>
                </td></tr>
                
                <!-- CTA -->
                <tr><td style="padding: 0 40px 40px; text-align: center;" class="mobile-padding">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                        <tr><td style="background: linear-gradient(135deg, #0f766e 0%, #0891b2 100%); border-radius: 50px; text-align: center; box-shadow: 0 4px 6px rgba(15, 118, 110, 0.2);">
                            <a href="${settings.dashboardUrl}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">Access Your Dashboard →</a>
                        </td></tr>
                    </table>
                </td></tr>
                
                <!-- Support -->
                <tr><td style="padding: 0 40px 40px;" class="mobile-padding">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fafafa; border-radius: 12px; border: 1px solid #e4e4e7; border-left: 4px solid #0f766e;">
                        <tr><td style="padding: 20px;">
                            <h4 style="margin: 0 0 8px; color: #18181b; font-size: 15px; font-weight: 700;">Need Help?</h4>
                            <p style="margin: 0 0 12px; color: #52525b; font-size: 14px;">Our support team is here for you!</p>
                            <p style="margin: 0; font-size: 14px;"><a href="mailto:${settings.supportEmail}" style="color: #0f766e; text-decoration: none; font-weight: 600;">✉️ ${settings.supportEmail}</a></p>
                            <p style="margin: 4px 0 0; font-size: 14px;"><a href="${settings.whatsappUrl}" style="color: #0f766e; text-decoration: none; font-weight: 600;">💬 WhatsApp Support</a></p>
                            ${settings.videoTutorialUrl ? `<p style="margin: 8px 0 0; font-size: 14px;"><a href="${settings.videoTutorialUrl}" style="color: #0f766e; text-decoration: none; font-weight: 600;">📹 Watch Tutorial</a></p>` : ""}
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
exports.getUpgradeConfirmationTemplate = getUpgradeConfirmationTemplate;
//# sourceMappingURL=email-upgrade.js.map