/**
 * PDF Receipt Generator
 * 
 * Generates a downloadable PDF receipt for an order.
 * Layout: Clean, Modern, Professional (Whitespace-based, no heavy boxes)
 */

import { jsPDF } from "jspdf";
import type { Order, DeliveryType } from "@/types/order";
import { mapLegacyDeliveryType } from "@/types/order";
import { format } from "date-fns";

// Delivery type display labels
const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
    pickup_store: "Shop Pickup",
    delivery_home: "Home Delivery",
    pickup_home: "Pickup from Home",
};

interface ShopInfo {
    name: string;
    phone?: string;
    address?: string;
    gstNumber?: string;
}

// Constants for Layout
const MARGIN = 12; // Reduced from 20 to fit more
const FOOTER_HEIGHT = 20; // Space reserved for footer at bottom
const FONT_NORMAL = "helvetica";

/**
 * Shared function to draw the receipt content onto a jsPDF document
 */
const drawReceipt = (doc: jsPDF, order: Order, shopInfo: ShopInfo) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentHeight = pageHeight - MARGIN - FOOTER_HEIGHT; // Max Y allowed for content

    let y = MARGIN + 5; // Start tighter at top

    // --- HELPERS ---

    const centerText = (text: string, fontSize: number = 10, fontStyle: string = "normal", color: [number, number, number] = [0, 0, 0]) => {
        doc.setFont(FONT_NORMAL, fontStyle);
        doc.setFontSize(fontSize);
        doc.setTextColor(...color);
        const textWidth = doc.getTextWidth(text);
        doc.text(text, (pageWidth - textWidth) / 2, y);
        y += fontSize * 0.3527 + 2; // Adjusted line height factor (mm per pt approx)
    };

    const row = (label: string, value: string, fontSize: number = 10, fontStyle: string = "normal", color: [number, number, number] = [0, 0, 0]) => {
        doc.setFont(FONT_NORMAL, fontStyle);
        doc.setFontSize(fontSize);
        doc.setTextColor(...color);
        doc.text(label, MARGIN, y);
        const valWidth = doc.getTextWidth(value);
        doc.text(value, pageWidth - MARGIN - valWidth, y);
        y += fontSize * 0.3527 + 4;
    };

    const divider = () => {
        y += 2;
        doc.setDrawColor(230, 230, 230);
        doc.setLineWidth(0.5);
        doc.line(MARGIN, y, pageWidth - MARGIN, y);
        y += 6;
    };

    const checkOverflow = (neededSpace: number) => {
        if (y + neededSpace > contentHeight) {
            doc.addPage();
            y = MARGIN + 10;
            // Header for continuation
            doc.setFont(FONT_NORMAL, "normal");
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Order #${order.publicId} (Cont.)`, MARGIN, MARGIN);
            y += 5;
        }
    };

    // --- CONTENT GENERATION ---

    // 1. SHOP HEADER
    centerText(shopInfo.name.toUpperCase() || "LAUNDRY SERVICE", 18, "bold");
    y += 2;
    if (shopInfo.phone) centerText(`Tel: ${shopInfo.phone}`, 10);
    if (shopInfo.address) centerText(shopInfo.address, 9, "normal", [100, 100, 100]);
    if (shopInfo.gstNumber) centerText(`GSTIN: ${shopInfo.gstNumber}`, 9, "normal", [100, 100, 100]);

    y += 2;
    divider();

    // 2. ORDER ID & TYPE
    checkOverflow(35);
    centerText(`ORDER #${order.publicId}`, 14, "bold");
    y += 2;

    const deliveryType = mapLegacyDeliveryType(order.deliveryType);
    const deliveryLabel = DELIVERY_TYPE_LABELS[deliveryType];
    const dateStr = format(order.createdAt.toDate(), "dd MMM yyyy, hh:mm a");

    centerText(dateStr, 9, "normal", [80, 80, 80]);
    y += 3;
    centerText(`[ ${deliveryLabel.toUpperCase()} ]`, 10, "bold");

    y += 6;

    // 3. CUSTOMER DETAILS
    checkOverflow(30);
    doc.setFont(FONT_NORMAL, "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("Customer Details", MARGIN, y);
    y += 5;

    doc.setFont(FONT_NORMAL, "normal");
    doc.setFontSize(9);
    doc.text(`Name:  ${order.customerName}`, MARGIN, y);
    y += 5;
    doc.text(`Phone: ${order.customerPhone}`, MARGIN, y);
    y += 5;
    if (order.deliveryAddress) {
        doc.text(`Addr:  ${order.deliveryAddress}`, MARGIN, y);
        y += 5;
    }

    y += 4;

    // 4. ITEMS HEADER
    checkOverflow(15);
    doc.setFont(FONT_NORMAL, "bold");
    doc.setFontSize(10);
    doc.text("ORDER ITEMS", MARGIN, y);
    y += 6;

    // Header Row
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text("Item", MARGIN, y);
    const amtWidth = doc.getTextWidth("Amount");
    doc.text("Amount", pageWidth - MARGIN - amtWidth, y);
    y += 6;

    // 5. ITEMS LIST
    order.items.forEach((item) => {
        checkOverflow(20);

        doc.setTextColor(0, 0, 0);

        // Item Name + Category
        const categoryMatch = item.categoryName ? `(${item.categoryName})` : "";
        const isExpress = (item as any).express || (item as any).expressMultiplier > 1;
        const expressLabel = isExpress ? " (Express)" : "";

        doc.setFont(FONT_NORMAL, "bold");
        doc.setFontSize(9);
        doc.text(`${item.serviceName} ${expressLabel} ${categoryMatch}`, MARGIN, y);

        // Price
        const itemTotal = item.quantity * item.unitPrice;
        const totalStr = `Rs. ${itemTotal.toFixed(2)}`;
        doc.setFont(FONT_NORMAL, "bold");
        const totalWidth = doc.getTextWidth(totalStr);
        doc.text(totalStr, pageWidth - MARGIN - totalWidth, y);

        y += 5;

        // Details row
        doc.setFont(FONT_NORMAL, "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);

        let detailText = `${item.quantity} x Rs.${item.unitPrice}`;
        doc.text(detailText, MARGIN, y);

        // Express charge line
        const expressMultiplier = (item as { expressMultiplier?: number }).expressMultiplier;
        if (expressMultiplier && expressMultiplier > 1) {
            y += 4;
            const expressCharge = Math.round(itemTotal * (expressMultiplier - 1));
            doc.setFontSize(8);
            doc.setTextColor(200, 100, 0);
            doc.text(`Express Charge (${expressMultiplier}x): +Rs.${expressCharge}`, MARGIN, y);
        }

        y += 6; // Compact spacer
    });

    divider();

    // 6. TOTALS
    checkOverflow(60); // Ensure space for entire Totals

    row("Subtotal", `Rs. ${order.financials.subtotal.toFixed(2)}`);

    if (order.financials.expressCharge > 0) {
        row("Express Charges", `Rs. ${order.financials.expressCharge.toFixed(2)}`);
    }
    if (order.financials.deliveryCharge > 0) {
        row("Delivery Charge", `Rs. ${order.financials.deliveryCharge.toFixed(2)}`);
    }

    // Add Tax Row
    if ((order.financials.taxAmount || 0) > 0) {
        row("Tax", `Rs. ${(order.financials.taxAmount || 0).toFixed(2)}`);
    }

    if (order.financials.discountAmount > 0) {
        row("Discount", `- Rs. ${order.financials.discountAmount.toFixed(2)}`, 10, "normal", [0, 128, 0]);
    }

    y += 2;
    // Total Line
    doc.setFont(FONT_NORMAL, "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    const totalLabel = "TOTAL";
    const totalVal = `Rs. ${order.financials.total.toFixed(2)}`;
    doc.text(totalLabel, MARGIN, y);
    doc.text(totalVal, pageWidth - MARGIN - doc.getTextWidth(totalVal), y);
    y += 8;

    row("Amount Paid", `Rs. ${order.financials.amountPaid.toFixed(2)}`, 10);

    if (order.financials.balance > 0) {
        row("Balance Due", `Rs. ${order.financials.balance.toFixed(2)}`, 11, "bold", [220, 38, 38]);
    } else {
        row("Balance Due", `Rs. 0.00`, 11, "bold", [0, 128, 0]);
    }

    y += 4;
    divider();

    // 7. STATUS & DATES
    checkOverflow(20);

    const leftColX = MARGIN;
    const rightColX = pageWidth - MARGIN;

    const statusRow = (label: string, val: string) => {
        doc.setFont(FONT_NORMAL, "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(label, leftColX, y);

        doc.setTextColor(0, 0, 0);
        const w = doc.getTextWidth(val);
        doc.text(val, rightColX - w, y);
        y += 5;
    };

    statusRow("Order Status:", order.status.toUpperCase());
    statusRow("Payment Method:", order.paymentMethod.toUpperCase());

    y += 6;

    // 8. FOOTER CONTENT (Date, Link - NO QR)
    checkOverflow(30);

    if (order.expectedDelivery) {
        const dateLabel = deliveryType === "pickup_store" ? "Ready for Pickup" : "Expected Delivery";
        centerText(`${dateLabel}: ${format(order.expectedDelivery.toDate(), "dd MMM yyyy")}`, 11, "bold");
        y += 4;
    }

    centerText("Track your order online:", 8, "normal", [100, 100, 100]);
    y -= 1;
    const trackingUrl = `${window.location.origin}/track/${order.publicId}`;

    doc.setTextColor(0, 102, 204); // Blue color for link
    doc.setFontSize(8);
    const linkWidth = doc.getTextWidth(trackingUrl);
    const linkX = (pageWidth - linkWidth) / 2;

    doc.text(trackingUrl, linkX, y);
    // Add clickable annotation explicitly
    doc.link(linkX, y - 3, linkWidth, 4, { url: trackingUrl });

    doc.setTextColor(0, 0, 0);
    y += 6;

    // QR Code Removed as per request

    y += 5;
    centerText("Thank you for your business!", 9, "bold");

    // --- GLOBAL FOOTER LOOP ---
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont(FONT_NORMAL, "normal");
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);

        // Left: Branding
        const brandingText = "Powered by laundrybill.com";
        doc.text(brandingText, MARGIN, pageHeight - 10);
        const brandingWidth = doc.getTextWidth(brandingText);
        doc.link(MARGIN, pageHeight - 13, brandingWidth, 4, { url: "https://laundrybill.com" });

        // Right: Page Number
        const pageStr = `Page ${i} of ${totalPages}`;
        const pageStrWidth = doc.getTextWidth(pageStr);
        doc.text(pageStr, pageWidth - MARGIN - pageStrWidth, pageHeight - 10);
    }
};

// Shared PDF Instance Creator
const createDoc = () => {
    return new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });
};

export function generateOrderReceipt(order: Order, shopInfo: ShopInfo): void {
    const doc = createDoc();
    drawReceipt(doc, order, shopInfo);
    doc.save(getReceiptFileName(order));
}

export function getReceiptBlob(order: Order, shopInfo: ShopInfo): Blob {
    const doc = createDoc();
    drawReceipt(doc, order, shopInfo);
    return doc.output("blob");
}

export function getReceiptFileName(order: Order): string {
    return `LaundryBill_Order_${order.publicId}.pdf`;
}
