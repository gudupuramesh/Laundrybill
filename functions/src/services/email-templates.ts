/**
 * Professional Email Templates for LaundryBill
 * Features: Dark mode support, responsive design, MSO compatibility
 * Note: Uses dynamic settings from Firestore via PlatformSettings
 */

import { PlatformSettings, DEFAULT_SETTINGS } from "./platform-settings";

// Common email styles
const commonStyles = `
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    @media screen and (max-width: 600px) {
        .w-full { width: 100% !important; max-width: 100% !important; }
        .mobile-padding { padding: 20px !important; }
        .mobile-center { text-align: center !important; }
        .mobile-stack { display: block !important; width: 100% !important; }
    }
    @media (prefers-color-scheme: dark) {
        .email-wrapper { background-color: #1a1a1a !important; }
        .email-content { background-color: #2d2d2d !important; }
        .text-dark { color: #ffffff !important; }
        .text-muted { color: #a1a1aa !important; }
    }
`;

/**
 * Generate email header with logo and brand name
 */
function getEmailHeader(settings: PlatformSettings, subtitle: string): string {
    const logoSection = settings.logoUrl
        ? `<img src="${settings.logoUrl}" alt="${settings.brandName}" style="max-width: 150px; height: auto; margin: 0 auto 16px;" />`
        : `<div style="background-color: rgba(255, 255, 255, 0.2); width: 64px; height: 64px; border-radius: 16px; margin: 0 auto 16px; line-height: 64px;">
            <span style="color: white; font-size: 28px;">🧺</span>
           </div>
           <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Laundry<span style="font-weight: 300;">Bill</span></h1>`;

    return `
        <tr><td style="background: linear-gradient(135deg, #0f766e 0%, #0891b2 100%); padding: 40px; text-align: center;">
            ${logoSection}
            <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">${subtitle}</p>
        </td></tr>
    `;
}

/**
 * Generate email footer with company details and social links
 */
function getEmailFooter(settings: PlatformSettings): string {
    // Build social links if available
    let socialLinks = "";
    const socialIcons = [
        { url: settings.facebookUrl, name: "Facebook", emoji: "📘" },
        { url: settings.instagramUrl, name: "Instagram", emoji: "📷" },
        { url: settings.twitterUrl, name: "Twitter", emoji: "🐦" },
        { url: settings.linkedinUrl, name: "LinkedIn", emoji: "💼" }
    ];

    const activeSocials = socialIcons.filter(s => s.url);
    if (activeSocials.length > 0) {
        socialLinks = `
            <p style="margin: 16px 0 0;">
                ${activeSocials.map(s => `<a href="${s.url}" style="color: #0f766e; text-decoration: none; margin: 0 8px;">${s.emoji}</a>`).join("")}
            </p>
        `;
    }

    // Help links if available
    let helpLinks = "";
    if (settings.videoTutorialUrl || settings.helpDocsUrl) {
        const links = [];
        if (settings.videoTutorialUrl) {
            links.push(`<a href="${settings.videoTutorialUrl}" style="color: #0f766e; text-decoration: none;">📹 Video Tutorial</a>`);
        }
        if (settings.helpDocsUrl) {
            links.push(`<a href="${settings.helpDocsUrl}" style="color: #0f766e; text-decoration: none;">📚 Help Docs</a>`);
        }
        helpLinks = `<p style="margin: 12px 0;">${links.join(" | ")}</p>`;
    }

    return `
        <tr><td style="padding: 30px 40px; background-color: #fafafa; border-top: 1px solid #e4e4e7; text-align: center;" class="mobile-padding">
            <p style="margin: 0 0 8px; color: #18181b; font-size: 14px; font-weight: 600;">${settings.companyName}</p>
            <p style="margin: 0; color: #71717a; font-size: 13px;">${settings.address}<br>GST: ${settings.gstNumber}</p>
            <p style="margin: 12px 0 0; color: #52525b; font-size: 13px;">
                <a href="mailto:${settings.supportEmail}" style="color: #0f766e; text-decoration: none;">${settings.supportEmail}</a> | 
                <a href="${settings.whatsappUrl}" style="color: #0f766e; text-decoration: none;">${settings.supportPhone}</a>
            </p>
            ${helpLinks}
            ${socialLinks}
            <p style="margin: 16px 0 0; color: #a1a1aa; font-size: 12px;">© 2026 ${settings.brandName}. All rights reserved.</p>
        </td></tr>
    `;
}

/**
 * Welcome Email - Sent when a new shop is registered
 * Highlights free plan features + showcases Pro plan benefits
 */
export function getWelcomeEmailTemplate(shopName: string, settings: PlatformSettings = DEFAULT_SETTINGS): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to ${settings.brandName}</title>
    <style>${commonStyles}</style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <div style="display: none; max-height: 0; overflow: hidden;">Welcome to ${settings.brandName}! Your account is now active. Explore what you can do.</div>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
        <tr><td align="center" style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="w-full" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                ${getEmailHeader(settings, "Welcome Aboard!")}
                <!-- Content -->
                <tr><td style="padding: 40px;" class="mobile-padding">
                    <div style="background-color: #f0fdfa; border: 2px solid #ccfbf1; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 24px;">
                        <span style="color: #0f766e; font-size: 14px; font-weight: 600;">Account Created Successfully</span>
                    </div>
                    <h2 style="margin: 0 0 16px; color: #18181b; font-size: 24px; font-weight: 700; text-align: center;">Welcome, ${shopName}!</h2>
                    <p style="margin: 0 0 24px; color: #52525b; font-size: 16px; line-height: 1.6; text-align: center;">
                        Thank you for joining ${settings.brandName}! Your smart laundry management solution is ready. Here's what you can do right away:
                    </p>

                    <!-- Free Plan Features -->
                    <p style="margin: 0 0 12px; color: #18181b; font-size: 15px; font-weight: 700;">Your Free Plan includes:</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 24px;">
                        <tr><td style="padding: 10px 12px; background: #fafafa; border-radius: 8px; border: 1px solid #e4e4e7;">
                            <strong style="color: #0f766e;">&#10003; Order Management</strong> &mdash; <span style="color: #71717a; font-size: 13px;">Create, track & manage up to 50 orders/month</span>
                        </td></tr>
                        <tr><td style="height: 6px;"></td></tr>
                        <tr><td style="padding: 10px 12px; background: #fafafa; border-radius: 8px; border: 1px solid #e4e4e7;">
                            <strong style="color: #0f766e;">&#10003; Customer Database</strong> &mdash; <span style="color: #71717a; font-size: 13px;">Store up to 100 customers with preferences</span>
                        </td></tr>
                        <tr><td style="height: 6px;"></td></tr>
                        <tr><td style="padding: 10px 12px; background: #fafafa; border-radius: 8px; border: 1px solid #e4e4e7;">
                            <strong style="color: #0f766e;">&#10003; WhatsApp Receipts</strong> &mdash; <span style="color: #71717a; font-size: 13px;">Send order receipts to customers instantly</span>
                        </td></tr>
                        <tr><td style="height: 6px;"></td></tr>
                        <tr><td style="padding: 10px 12px; background: #fafafa; border-radius: 8px; border: 1px solid #e4e4e7;">
                            <strong style="color: #0f766e;">&#10003; POS &amp; Order Tracking</strong> &mdash; <span style="color: #71717a; font-size: 13px;">Point-of-sale billing and live order status</span>
                        </td></tr>
                    </table>

                    <!-- Pro Plan Upsell -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 24px; border: 2px solid #0f766e; border-radius: 12px; overflow: hidden;">
                        <tr><td style="background: linear-gradient(135deg, #0f766e 0%, #0891b2 100%); padding: 16px; text-align: center;">
                            <span style="color: #ffffff; font-size: 16px; font-weight: 700;">Unlock More with Pro</span>
                        </td></tr>
                        <tr><td style="padding: 16px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 6px 0; color: #18181b; font-size: 14px;" width="50%" valign="top">&#9733; Unlimited orders</td>
                                    <td style="padding: 6px 0; color: #18181b; font-size: 14px;" width="50%" valign="top">&#9733; Unlimited customers</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0; color: #18181b; font-size: 14px;" valign="top">&#9733; Staff management</td>
                                    <td style="padding: 6px 0; color: #18181b; font-size: 14px;" valign="top">&#9733; Attendance &amp; payroll</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0; color: #18181b; font-size: 14px;" valign="top">&#9733; Reports &amp; analytics</td>
                                    <td style="padding: 6px 0; color: #18181b; font-size: 14px;" valign="top">&#9733; Expense tracking</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0; color: #18181b; font-size: 14px;" valign="top">&#9733; Driver &amp; plant apps</td>
                                    <td style="padding: 6px 0; color: #18181b; font-size: 14px;" valign="top">&#9733; Public ordering page</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0; color: #18181b; font-size: 14px;" valign="top">&#9733; QR code scanning</td>
                                    <td style="padding: 6px 0; color: #18181b; font-size: 14px;" valign="top">&#9733; 100 GB storage</td>
                                </tr>
                            </table>
                        </td></tr>
                    </table>

                    <!-- CTA -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr><td align="center" style="padding-bottom: 12px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                <tr><td style="background: linear-gradient(135deg, #0f766e 0%, #0891b2 100%); border-radius: 50px; text-align: center;">
                                    <a href="${settings.dashboardUrl}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">Open Dashboard</a>
                                </td></tr>
                            </table>
                        </td></tr>
                        <tr><td align="center">
                            <a href="${settings.appUrl || settings.dashboardUrl}/settings/subscription" style="color: #0f766e; font-size: 14px; font-weight: 600; text-decoration: none;">View Pro Plan &amp; Pricing &rarr;</a>
                        </td></tr>
                    </table>
                </td></tr>
                ${getEmailFooter(settings)}
            </table>
        </td></tr>
    </table>
</body>
</html>`;
}

export { commonStyles, getEmailHeader, getEmailFooter };
