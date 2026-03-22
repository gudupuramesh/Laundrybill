"use strict";
/**
 * Professional Email Templates for LaundryBill
 * Features: Dark mode support, responsive design, MSO compatibility
 * Note: Uses dynamic settings from Firestore via PlatformSettings
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmailFooter = exports.getEmailHeader = exports.commonStyles = exports.getWelcomeEmailTemplate = void 0;
const platform_settings_1 = require("./platform-settings");
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
exports.commonStyles = commonStyles;
/**
 * Generate email header with logo and brand name
 */
function getEmailHeader(settings, subtitle) {
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
exports.getEmailHeader = getEmailHeader;
/**
 * Generate email footer with company details and social links
 */
function getEmailFooter(settings) {
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
exports.getEmailFooter = getEmailFooter;
/**
 * Welcome Email - Sent when a new shop is registered
 */
function getWelcomeEmailTemplate(shopName, settings = platform_settings_1.DEFAULT_SETTINGS) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to ${settings.brandName}</title>
    <style>${commonStyles}</style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <div style="display: none; max-height: 0; overflow: hidden;">Welcome to ${settings.brandName}! Your account is now active.</div>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
        <tr><td align="center" style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="w-full" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                ${getEmailHeader(settings, "Welcome Aboard!")}
                <!-- Content -->
                <tr><td style="padding: 40px;">
                    <div style="background-color: #f0fdfa; border: 2px solid #ccfbf1; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 24px;">
                        <span style="color: #0f766e; font-size: 14px; font-weight: 600;">🎉 Account Created Successfully</span>
                    </div>
                    <h2 style="margin: 0 0 16px; color: #18181b; font-size: 24px; font-weight: 700; text-align: center;">Welcome, ${shopName}!</h2>
                    <p style="margin: 0 0 24px; color: #52525b; font-size: 16px; line-height: 1.6; text-align: center;">
                        Thank you for joining ${settings.brandName}! Your smart laundry management solution is ready. Start streamlining your business today.
                    </p>
                    <!-- Features -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 24px;">
                        <tr><td style="padding: 12px; background: #fafafa; border-radius: 8px; border: 1px solid #e4e4e7; margin-bottom: 8px;">
                            <strong style="color: #0f766e;">✓ Order Management</strong><br><span style="color: #71717a; font-size: 13px;">Create & track orders effortlessly</span>
                        </td></tr>
                        <tr><td style="height: 8px;"></td></tr>
                        <tr><td style="padding: 12px; background: #fafafa; border-radius: 8px; border: 1px solid #e4e4e7;">
                            <strong style="color: #0f766e;">✓ Customer Database</strong><br><span style="color: #71717a; font-size: 13px;">Build relationships with preferences</span>
                        </td></tr>
                        <tr><td style="height: 8px;"></td></tr>
                        <tr><td style="padding: 12px; background: #fafafa; border-radius: 8px; border: 1px solid #e4e4e7;">
                            <strong style="color: #0f766e;">✓ Business Analytics</strong><br><span style="color: #71717a; font-size: 13px;">Real-time insights dashboard</span>
                        </td></tr>
                    </table>
                    <!-- CTA -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                        <tr><td style="background: linear-gradient(135deg, #0f766e 0%, #0891b2 100%); border-radius: 50px; text-align: center;">
                            <a href="${settings.dashboardUrl}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">Open Dashboard →</a>
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
exports.getWelcomeEmailTemplate = getWelcomeEmailTemplate;
//# sourceMappingURL=email-templates.js.map