/**
 * Expiry Reminder Email Template
 * Dynamic urgency levels based on days remaining
 * Uses dynamic PlatformSettings for branding
 */

import { PlatformSettings, DEFAULT_SETTINGS } from "./platform-settings";
import { getEmailHeader, getEmailFooter, commonStyles } from "./email-templates";

interface ExpiryEmailData {
    shopName: string;
    planName: string;
    planPrice?: string;
    daysRemaining: number;
    expiryDate: string;
    startDate?: string;
    renewalUrl: string;
    currentMonthOrders?: number;
    currencySymbol?: string;
    settings?: PlatformSettings;
}

export function getExpiryReminderTemplate(data: ExpiryEmailData): string {
    const {
        shopName,
        planName,
        planPrice = "999",
        daysRemaining,
        expiryDate,
        renewalUrl,
        currencySymbol = "₹",
        settings = DEFAULT_SETTINGS
    } = data;

    const isUrgent = daysRemaining <= 3;
    const isFinalDay = daysRemaining <= 1;
    const urgentBg = isUrgent ? "#fef2f2" : "#fffbeb";
    const urgentBorder = isUrgent ? "#fecaca" : "#fcd34d";
    const urgentBadgeBg = isUrgent ? "#dc2626" : "#f59e0b";
    const ctaBg = isUrgent ? "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)" : "linear-gradient(135deg, #0f766e 0%, #0891b2 100%)";
    const badgeText = isFinalDay ? "⏰ FINAL DAY" : `⏳ ${daysRemaining} Days Left`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your ${settings.brandName} Plan Expires Soon</title>
    <style>${commonStyles}</style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #18181b;">
    <div style="display: none;">Action Required: Your ${planName} plan expires in ${daysRemaining} days. Renew now to avoid interruption.</div>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
        <tr><td align="center" style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="w-full" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                ${getEmailHeader(settings, "Subscription Expiring")}
                
                <!-- Alert Banner -->
                <tr><td style="background-color: ${urgentBg}; border-bottom: 1px solid ${urgentBorder}; padding: 16px 40px; text-align: center;" class="mobile-padding">
                    <span style="display: inline-block; background-color: ${urgentBadgeBg}; color: white; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                        ${badgeText}
                    </span>
                </td></tr>
                
                <!-- Content -->
                <tr><td style="padding: 40px;" class="mobile-padding">
                    <h2 style="margin: 0 0 16px; color: #18181b; font-size: 26px; font-weight: 700; line-height: 1.3; text-align: center;" class="text-dark">
                        ${isFinalDay ? "Your Plan Expires Today!" : `Your ${planName} Plan Expires Soon`}
                    </h2>
                    <p style="margin: 0 0 24px; color: #52525b; font-size: 16px; line-height: 1.6; text-align: center;">
                        Hi <strong style="color: #18181b;">${shopName}</strong>,<br><br>
                        Your ${planName} subscription expires on <strong style="color: #18181b;">${expiryDate}</strong> (${daysRemaining} days from now). Renew now to avoid service interruption.
                    </p>
                    
                    <!-- Expiry Details -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fafafa; border-radius: 12px; border: 1px solid #e4e4e7; border-left: 4px solid ${urgentBadgeBg}; margin-bottom: 24px;">
                        <tr><td style="padding: 20px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td width="50%">
                                        <p style="margin: 0 0 4px; color: #71717a; font-size: 12px; font-weight: 600; text-transform: uppercase;">Current Plan</p>
                                        <p style="margin: 0; color: #18181b; font-size: 18px; font-weight: 700;">${planName}</p>
                                        <p style="margin: 4px 0 0; color: #0f766e; font-size: 14px; font-weight: 600;">${currencySymbol}${planPrice}/month</p>
                                    </td>
                                    <td width="50%">
                                        <p style="margin: 0 0 4px; color: #71717a; font-size: 12px; font-weight: 600; text-transform: uppercase;">Expiry Date</p>
                                        <p style="margin: 0; color: ${isUrgent ? "#dc2626" : "#18181b"}; font-size: 18px; font-weight: 700;">${expiryDate}</p>
                                    </td>
                                </tr>
                            </table>
                        </td></tr>
                    </table>
                    
                    <!-- What You Lose -->
                    <h3 style="margin: 0 0 16px; color: #18181b; font-size: 16px; font-weight: 700;">What You'll Miss Without Renewal:</h3>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 24px;">
                        <tr><td style="padding: 12px; background: #fff; border: 1px solid #fee2e2; border-radius: 8px; margin-bottom: 8px;">
                            <span style="color: #dc2626;">⚠️</span> <strong style="color: #18181b;">Order Limit</strong> - Drop from unlimited to only <strong style="color: #dc2626;">50 orders/month</strong>
                        </td></tr>
                        <tr><td style="height: 8px;"></td></tr>
                        <tr><td style="padding: 12px; background: #fff; border: 1px solid #fee2e2; border-radius: 8px;">
                            <span style="color: #dc2626;">⚠️</span> <strong style="color: #18181b;">Premium Features</strong> - No QR tracking, staff management, or advanced reports
                        </td></tr>
                        <tr><td style="height: 8px;"></td></tr>
                        <tr><td style="padding: 12px; background: #fff; border: 1px solid #fee2e2; border-radius: 8px;">
                            <span style="color: #dc2626;">⚠️</span> <strong style="color: #18181b;">Public Tracking</strong> - Customers can't track their orders online
                        </td></tr>
                    </table>
                    
                    <!-- Annual Savings -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #f0fdfa 0%, #ecfeff 100%); border-radius: 12px; border: 1px solid #ccfbf1; margin-bottom: 24px;">
                        <tr><td style="padding: 20px; text-align: center;">
                            <span style="display: inline-block; background-color: #0f766e; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 700; margin-bottom: 8px;">SAVE 20%</span>
                            <h4 style="margin: 0 0 8px; color: #0f766e; font-size: 18px; font-weight: 700;">Switch to Annual Billing</h4>
                            <p style="margin: 0; color: #52525b; font-size: 14px;">Get 2 months free with yearly subscription!</p>
                        </td></tr>
                    </table>
                    
                    <!-- CTA -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                        <tr><td style="background: ${ctaBg}; border-radius: 50px; text-align: center; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);">
                            <a href="${renewalUrl}" style="display: inline-block; padding: 18px 48px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                                ${isFinalDay ? "Renew Now - Last Chance" : "Renew My Plan"}
                            </a>
                        </td></tr>
                    </table>
                    <p style="margin: 16px 0 0; color: #71717a; font-size: 13px; text-align: center;">Secure checkout • Cancel anytime • Instant activation</p>
                    
                    <!-- Support Link -->
                    <p style="margin: 24px 0 0; text-align: center; color: #71717a; font-size: 14px;">
                        Need help? <a href="mailto:${settings.supportEmail}" style="color: #0f766e; text-decoration: underline; font-weight: 600;">Contact support</a>
                        ${settings.videoTutorialUrl ? ` | <a href="${settings.videoTutorialUrl}" style="color: #0f766e; text-decoration: underline; font-weight: 600;">📹 Watch Tutorial</a>` : ""}
                    </p>
                </td></tr>
                
                <!-- Trust Badges -->
                <tr><td style="padding: 24px 40px; border-top: 1px solid #e4e4e7; text-align: center;">
                    <p style="margin: 0 0 8px; color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Trusted by 500+ Laundry Businesses</p>
                    <p style="margin: 0; color: #9ca3af; font-size: 13px;">
                        <span style="color: #fbbf24;">★★★★★</span> 4.9/5 Rating | 2M+ Orders Processed | 24/7 Support
                    </p>
                </td></tr>
                
                ${getEmailFooter(settings)}
            </table>
        </td></tr>
    </table>
</body>
</html>`;
}
