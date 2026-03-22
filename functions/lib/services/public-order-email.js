"use strict";
/**
 * Email templates for public order placement
 * Customer: order confirmation with shop details and tracking link
 * Shop owner: new online order alert
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicOrderAlertShopOwnerEmail = exports.getPublicOrderConfirmationCustomerEmail = void 0;
const email_templates_1 = require("./email-templates");
function getPublicOrderConfirmationCustomerEmail(params) {
    const { customerName, shopName, shopAddress, shopPhone, orderId, trackingUrl, pickupDate, pickupSlot, deliveryArea, items, total, isQuickOrder, currencySymbol = "₹", settings, } = params;
    const itemsHtml = isQuickOrder
        ? "<p>Quick order – Agent will assess items at pickup.</p>"
        : items
            .map((i) => `<tr><td style="padding: 8px 0; border-bottom: 1px solid #e4e4e7;">
              <span>${i.name} × ${i.quantity}</span>
              ${i.total != null ? `<span style="float:right;">${currencySymbol}${i.total.toLocaleString()}</span>` : ""}
            </td></tr>`)
            .join("");
    const totalSection = isQuickOrder
        ? "<p style='color:#71717a;'>Agent will update you the pricing at pickup.</p>"
        : `<p style="font-weight: 600; font-size: 18px; margin-top: 12px;">Total: ${currencySymbol}${total.toLocaleString()}</p>`;
    const shopInfo = [shopAddress, shopPhone].filter(Boolean).join(" | ");
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmed - ${shopName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
    <tr><td align="center" style="padding: 40px 20px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        ${(0, email_templates_1.getEmailHeader)(settings, "Order Confirmed")}
        <tr><td style="padding: 40px;">
          <h2 style="margin: 0 0 16px; color: #18181b;">Hi ${customerName},</h2>
          <p style="margin: 0 0 24px; color: #52525b; line-height: 1.6;">
            Your order has been received at <strong>${shopName}</strong>.
          </p>
          ${shopInfo ? `<p style="margin: 0 0 24px; color: #71717a; font-size: 14px;">📍 ${shopInfo}</p>` : ""}
          <div style="background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px; font-weight: 600; color: #0f766e;">Order #${orderId}</p>
            <p style="margin: 0; color: #52525b; font-size: 14px;">
              Pickup: ${pickupDate} • ${pickupSlot}<br/>
              Area: ${deliveryArea}
            </p>
          </div>
          <h3 style="margin: 0 0 12px; font-size: 16px;">Items</h3>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 16px;">
            ${itemsHtml}
          </table>
          ${totalSection}
          <p style="margin: 24px 0 0;">
            <a href="${trackingUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0f766e 0%, #0891b2 100%); color: white; text-decoration: none; font-weight: 600; border-radius: 8px;">
              Track your order →
            </a>
          </p>
        </td></tr>
        ${(0, email_templates_1.getEmailFooter)(settings)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
exports.getPublicOrderConfirmationCustomerEmail = getPublicOrderConfirmationCustomerEmail;
function getPublicOrderAlertShopOwnerEmail(params) {
    const { orderId, customerName, customerPhone, deliveryArea, pickupDate, pickupSlot, itemsSummary, total, isQuickOrder, ordersUrl, currencySymbol = "₹", settings, } = params;
    const totalLine = isQuickOrder
        ? "Pricing at pickup"
        : `${currencySymbol}${total.toLocaleString()} (estimated)`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Online Order - ${params.shopName} - ${orderId}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
    <tr><td align="center" style="padding: 40px 20px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        ${(0, email_templates_1.getEmailHeader)(settings, "New Online Order")}
        <tr><td style="padding: 40px;">
          <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: center;">
            <span style="color: #92400e; font-weight: 600;">🌐 New order from your public page</span>
          </div>
          <h2 style="margin: 0 0 8px;">Order #${orderId}</h2>
          <p style="margin: 0 0 24px; color: #71717a;">${customerName} • ${customerPhone}</p>
          <table role="presentation" width="100%" style="margin-bottom: 24px;">
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e4e4e7;">Area</td><td style="text-align: right;">${deliveryArea}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e4e4e7;">Pickup</td><td style="text-align: right;">${pickupDate} • ${pickupSlot}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e4e4e7;">Items</td><td style="text-align: right;">${itemsSummary}</td></tr>
            <tr><td style="padding: 8px 0;">Total</td><td style="text-align: right; font-weight: 600;">${totalLine}</td></tr>
          </table>
          <a href="${ordersUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0f766e 0%, #0891b2 100%); color: white; text-decoration: none; font-weight: 600; border-radius: 8px;">
            View order →
          </a>
        </td></tr>
        ${(0, email_templates_1.getEmailFooter)(settings)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
exports.getPublicOrderAlertShopOwnerEmail = getPublicOrderAlertShopOwnerEmail;
//# sourceMappingURL=public-order-email.js.map