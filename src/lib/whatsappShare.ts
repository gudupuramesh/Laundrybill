/**
 * WhatsApp Sharing Utility
 * 
 * Handles sharing order details via WhatsApp with links to track and view receipt
 */

import type { Order } from "@/types/order";
import type { Shop } from "@/types/shop";
import { mapLegacyDeliveryType, STATUS_LABELS } from "@/types/order";
import { getCountry, getCountryByCurrency } from "@/config/countries";
import { format } from "date-fns";

/**
 * Build a wa.me-ready phone number (digits only) with the correct country code.
 * Numbers stored with a country code (e.g. "+971501234567") are used as-is; a bare
 * local number gets the SHOP's dial code (from settings.countryCode / phoneCountryCode
 * / currency) — never a hardcoded +91.
 */
function buildWaPhone(rawPhone: string, shop?: Shop): string {
    const digits = (rawPhone || "").replace(/[^0-9]/g, "");
    if (!digits) return "";
    const country = shop?.settings?.countryCode
        ? getCountry(shop.settings.countryCode)
        : getCountryByCurrency(shop?.settings?.currency || "INR");
    const dialDigits = (shop?.settings?.phoneCountryCode || country.phoneCode || "+91").replace(/\D/g, "");
    const localLen = country.phoneDigits || 10;
    // Already includes a country code (stored as +<cc><number>) → use as-is.
    if (digits.length > localLen) return digits;
    // Bare local number → prepend the shop's dial code.
    return dialDigits + digits;
}

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
        // Get customer phone number with the shop's country code
        const fullPhone = buildWaPhone(order.customerPhone, shop);

        if (!fullPhone) {
            throw new Error("Customer phone number is required for WhatsApp sharing");
        }

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
    const fullPhone = buildWaPhone(order.customerPhone, shop);
    const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(whatsappUrl, "_blank");
}
