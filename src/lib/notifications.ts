/**
 * WhatsApp Notification Templates
 * 
 * Templates for order status notifications via WhatsApp
 */

import type { Order, OrderStatus } from "@/types/order";
import { format } from "date-fns";
import { getTrackingUrl } from "./qr-code";

type NotificationTemplate = (order: Order, shopName: string, currencySymbol?: string) => string;

export const statusNotifications: Record<OrderStatus, NotificationTemplate | null> = {
    pending: (order, shopName, currencySymbol = "₹") => `
🧺 *Order Received!*

Hi ${order.customerName},

Your laundry order #${order.publicId} has been received at ${shopName}.

📦 Items: ${order.items.length}
💰 Total: ${currencySymbol}${order.financials.total}
📅 Expected: ${format(order.expectedDelivery.toDate(), "EEE, MMM d")}

Track your order: ${getTrackingUrl(order.trackingId || order.id)}

Thank you for choosing us!
    `.trim(),

    processing: (order, _shopName) => `
🔄 *Processing Started*

Hi ${order.customerName},

Your order #${order.publicId} is now being processed.

We'll notify you when it's ready!

Track: ${getTrackingUrl(order.trackingId || order.id)}
    `.trim(),

    picked_up: null, // No notification for internal status

    ready: (order, shopName, currencySymbol = "₹") => `
✅ *Order Ready!*

Hi ${order.customerName},

Great news! Your order #${order.publicId} is ready for pickup at ${shopName}.

${order.financials.balance > 0 ? `💰 Balance due: ${currencySymbol}${order.financials.balance}` : "✓ Fully paid"}

Please collect at your earliest convenience.

Track: ${getTrackingUrl(order.trackingId || order.id)}
    `.trim(),

    ready_for_pickup: (order, shopName, currencySymbol = "₹") => `
✅ *Ready for Pickup!*

Hi ${order.customerName},

Your order #${order.publicId} is ready for pickup at ${shopName}.

${order.financials.balance > 0 ? `💰 Balance due: ${currencySymbol}${order.financials.balance}` : "✓ Fully paid"}

Please collect at your earliest convenience.

Track: ${getTrackingUrl(order.trackingId || order.id)}
    `.trim(),

    pickup_scheduled: (order, _shopName) => `
📅 *Pickup Scheduled*

Hi ${order.customerName},

We have scheduled pickup for your order #${order.publicId}.

${order.scheduledPickupDate ? `📍 Pickup: ${format(order.scheduledPickupDate.toDate(), "EEE, MMM d")}` : ""}
${order.scheduledPickupTime ? `⏰ Time: ${order.scheduledPickupTime}` : ""}

Our team will collect your clothes. Please keep them ready!

Track: ${getTrackingUrl(order.trackingId || order.id)}
    `.trim(),

    pickup_completed: null, // Internal status

    out_for_delivery: (order, _shopName, currencySymbol = "₹") => `
🚚 *Out for Delivery*

Hi ${order.customerName},

Your order #${order.publicId} is on its way!

Our delivery partner will reach you soon.

${order.financials.balance > 0 ? `💰 Amount to collect: ${currencySymbol}${order.financials.balance}` : ""}

Track: ${getTrackingUrl(order.trackingId || order.id)}
    `.trim(),

    delivered: (order, shopName) => `
🎉 *Delivered!*

Hi ${order.customerName},

Your order #${order.publicId} has been delivered.

Thank you for choosing ${shopName}! We hope to serve you again.

Rate us: ⭐⭐⭐⭐⭐
    `.trim(),

    cancelled: (order, _shopName) => `
❌ *Order Cancelled*

Hi ${order.customerName},

Your order #${order.publicId} has been cancelled.

If you have any questions, please contact us.

Thank you for your understanding.
    `.trim(),
};

// Generate WhatsApp URL
export function getWhatsAppUrl(phone: string, message: string): string {
    const formattedPhone = phone.replace(/\D/g, "");
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/91${formattedPhone}?text=${encodedMessage}`;
}

// Send notification (opens WhatsApp)
export function sendWhatsAppNotification(
    order: Order,
    status: OrderStatus,
    shopName: string,
    currencySymbol: string = "₹"
): void {
    const template = statusNotifications[status];
    if (!template) return;

    const message = template(order, shopName, currencySymbol);
    const url = getWhatsAppUrl(order.customerPhone, message);
    window.open(url, "_blank");
}

// Generate notification message for a given status
export function getNotificationMessage(
    order: Order,
    status: OrderStatus,
    shopName: string,
    currencySymbol: string = "₹"
): string | null {
    const template = statusNotifications[status];
    if (!template) return null;
    return template(order, shopName, currencySymbol);
}
