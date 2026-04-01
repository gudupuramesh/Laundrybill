/**
 * WhatsApp Sharing Utility
 * 
 * Handles sharing order details via WhatsApp with links to track and view receipt
 */

import type { Order } from "@/types/order";
import type { Shop } from "@/types/shop";
import { mapLegacyDeliveryType, STATUS_LABELS } from "@/types/order";
import { format } from "date-fns";

const DELIVERY_TYPE_LABELS: Record<string, string> = {
    pickup_store: "Shop Pickup",
    delivery_home: "Home Delivery",
    pickup_home: "Pickup from Home",
};

interface ShareOptions {
    order: Order;
    shop: Shop;
    currencySymbol?: string;
    onStart?: () => void;
    onComplete?: () => void;
    onError?: (error: unknown) => void;
}

/**
 * Generate WhatsApp message with all order details
 * Includes shop name + order number at the top.
 */
export function generateOrderWhatsAppMessage(order: Order, shop?: Shop, currencySymbol: string = "₹"): string {
    const trackingUrl = `${window.location.origin}/track/${order.publicId}`;
    const receiptUrl = `${window.location.origin}/receipt/${order.publicId}`;
    const deliveryType = mapLegacyDeliveryType(order.deliveryType);
    const deliveryLabel = DELIVERY_TYPE_LABELS[deliveryType] || deliveryType;

    const shopName = shop?.name || "LaundryBill";

    const lines: string[] = [
        `🧺 *${shopName} - Order Confirmed!*`,
        ``,
        `*Order ID:* #${order.publicId}`,
        `*Date:* ${format(order.createdAt.toDate(), "dd MMM yyyy, hh:mm a")}`,
        `*Type:* ${deliveryLabel}`,
        ``,
        `📋 *Items:*`,
        ...order.items.map(i => {
            const category = i.categoryName ? `(${i.categoryName})` : "";
            return `• ${i.serviceName} ${category} × ${i.quantity}`;
        }),
        ``,
        `💰 *Payment Details:*`,
        `Total: ${currencySymbol}${order.financials.total}`,
        `Paid: ${currencySymbol}${order.financials.amountPaid}`,
        order.financials.balance > 0
            ? `Balance Due: ${currencySymbol}${order.financials.balance}`
            : `✅ Paid in Full`,
        `Payment Method: ${order.paymentMethod?.toUpperCase() || "N/A"}`,
    ];

    // Add address for delivery/pickup from home
    if ((deliveryType === "delivery_home" || deliveryType === "pickup_home") && order.deliveryAddress) {
        lines.push(``, `📍 *Address:*`, order.deliveryAddress);
    }

    // Add expected delivery date
    if (order.expectedDelivery) {
        const dateLabel = deliveryType === "pickup_store"
            ? "Ready for Pickup"
            : "Expected Delivery";
        lines.push(
            ``,
            `📅 *${dateLabel}:*`,
            format(order.expectedDelivery.toDate(), "EEEE, dd MMMM yyyy")
        );
    }

    // Add order status
    lines.push(
        ``,
        `📊 *Status:* ${STATUS_LABELS[order.status] || order.status}`,
    );

    // Add tracking and receipt links
    lines.push(
        ``,
        `━━━━━━━━━━━━━━━━━━━━`,
        `📱 *Track Your Order:*`,
        trackingUrl,
        ``,
        `🧾 *View Receipt:*`,
        receiptUrl,
        ``,
        `Any questions? Reply to this message!`,
    );

    return lines.join("\n");
}

/**
 * Share order receipt via WhatsApp
 * Opens WhatsApp directly to customer's chat with message containing:
 * - Order details
 * - Tracking link
 * - Receipt link (customer can tap to view/download PDF)
 */
export async function shareReceiptViaWhatsApp({
    order,
    shop,
    currencySymbol = "₹",
    onStart,
    onComplete,
    onError,
}: ShareOptions): Promise<void> {
    onStart?.();

    try {
        // Get customer phone number
        const phoneNumber = order.customerPhone.replace(/[^0-9]/g, "");

        if (!phoneNumber) {
            throw new Error("Customer phone number is required for WhatsApp sharing");
        }

        const fullPhone = phoneNumber.startsWith("91") ? phoneNumber : `91${phoneNumber}`;

        // Generate WhatsApp message with tracking and receipt links
        const whatsappMessage = generateOrderWhatsAppMessage(order, shop, currencySymbol);

        // Open WhatsApp directly to customer's chat
        const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(whatsappMessage)}`;
        window.open(whatsappUrl, "_blank");

        onComplete?.();
    } catch (error) {
        console.error("WhatsApp share failed:", error);
        onError?.(error);
    }
}


/**
 * Open WhatsApp with text message only (no PDF)
 */
export function openWhatsAppTextOnly(order: Order, shop?: Shop, currencySymbol: string = "₹"): void {
    const whatsappMessage = generateOrderWhatsAppMessage(order, shop, currencySymbol);
    const phoneNumber = order.customerPhone.replace(/[^0-9]/g, "");
    const fullPhone = phoneNumber.startsWith("91") ? phoneNumber : `91${phoneNumber}`;
    const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(whatsappUrl, "_blank");
}
