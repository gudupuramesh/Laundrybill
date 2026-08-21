/**
 * PDF Receipt Generator
 * 
 * Generates a downloadable PDF receipt for an order.
 * Layout: Clean, Modern, Professional (Whitespace-based, no heavy boxes)
 */

import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { Order, DeliveryType } from "@/types/order";
import { mapLegacyDeliveryType } from "@/types/order";
import { format } from "date-fns";
import { getTaxIdLabel } from "@/config/countries";
import { buildPaymentQrTarget } from "@/lib/payment-qr";

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
    /** ISO country code (shop.settings.countryCode) — picks the tax-reg label (GSTIN/TRN/VAT No.). */
    countryCode?: string;
    /** Shop currency — symbol (e.g. ₹, د.إ, $) and/or ISO code (INR, AED, USD). */
    currencySymbol?: string;
    currencyCode?: string;
    /** Owner-configured Terms & Conditions printed near the bottom of the receipt. */
    receiptTerms?: string;
    /** false hides the "Track your order online" link (shop settings.trackingEnabled). */
    showTracking?: boolean;
    /** Shop logo URL (shops/{id}.logo) — printed centered at the top of the receipt. */
    logoUrl?: string;
    /** UPI ID (bankDetails.upiId) — printed as a scan-to-pay QR when a balance is due. */
    upiId?: string;
    /** Payment page URL — the pay-QR fallback when no UPI ID is set. */
    paymentLink?: string;
    /** false hides the scan-to-pay QR (shop settings.receiptPaymentQr). */
    showPaymentQr?: boolean;
}

/** A rendered scan-to-pay QR ready for jsPDF. */
interface PayQr {
    dataUrl: string;
    /** The UPI ID printed under the QR (absent for payment-link QRs). */
    upiId?: string;
}

/** Render the scan-to-pay QR, or null when none applies (paid up / disabled / nothing configured). */
async function loadPaymentQr(order: Order, shopInfo: ShopInfo): Promise<PayQr | null> {
    const target = buildPaymentQrTarget(
        { shopName: shopInfo.name, upiId: shopInfo.upiId, paymentLink: shopInfo.paymentLink, showPaymentQr: shopInfo.showPaymentQr },
        order.financials?.balance || 0,
        order.publicId,
    );
    if (!target) return null;
    try {
        const dataUrl = await QRCode.toDataURL(target, { margin: 0, width: 512, errorCorrectionLevel: "M" });
        return { dataUrl, upiId: (shopInfo.upiId || "").trim() || undefined };
    } catch {
        return null; // QR failure must never block a print
    }
}

/** A decoded, jsPDF-ready logo (PNG data URL + pixel size for aspect math). */
interface LogoImage {
    dataUrl: string;
    width: number;
    height: number;
}

/**
 * Fetch + decode the shop logo for jsPDF. Returns null on ANY failure (no URL,
 * CORS, timeout, decode error) so the receipt simply prints without a logo —
 * a broken image must never block a print. Re-encoded to PNG via canvas so
 * webp/avif uploads (which jsPDF can't ingest) work too.
 */
async function loadReceiptLogo(url?: string): Promise<LogoImage | null> {
    if (!url) return null;
    try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        const loaded = new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("logo load failed"));
        });
        img.src = url;
        await Promise.race([
            loaded,
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("logo timeout")), 6000)),
        ]);
        if (!img.naturalWidth || !img.naturalHeight) return null;
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(img, 0, 0);
        return { dataUrl: canvas.toDataURL("image/png"), width: img.naturalWidth, height: img.naturalHeight };
    } catch {
        return null;
    }
}

/** Fit the logo into a max box (mm) preserving aspect ratio. */
function fitLogo(logo: LogoImage, maxW: number, maxH: number): { w: number; h: number } {
    const scale = Math.min(maxW / logo.width, maxH / logo.height);
    return { w: logo.width * scale, h: logo.height * scale };
}

/**
 * jsPDF's built-in Helvetica only renders Latin-1, so glyphs like ₹ or د.إ
 * print as blanks/boxes. Use the symbol when it's ASCII-safe (e.g. $, £ is not),
 * otherwise fall back to a readable ASCII label from the ISO code.
 */
function currencyLabel(symbol?: string, code?: string): string {
    if (symbol && /^[\x20-\x7E]+$/.test(symbol.trim())) return symbol.trim();
    const c = (code || "").toUpperCase();
    if (c === "INR") return "Rs.";
    if (c) return c; // AED, USD, GBP, SAR, …
    return "Rs.";
}

// Constants for Layout
const MARGIN = 12; // Reduced from 20 to fit more
const FOOTER_HEIGHT = 20; // Space reserved for footer at bottom
const FONT_NORMAL = "helvetica";

/**
 * Shared function to draw the receipt content onto a jsPDF document
 */
const drawReceipt = (doc: jsPDF, order: Order, shopInfo: ShopInfo, logo?: LogoImage | null, payQr?: PayQr | null) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentHeight = pageHeight - MARGIN - FOOTER_HEIGHT; // Max Y allowed for content

    let y = MARGIN + 5; // Start tighter at top

    const cur = currencyLabel(shopInfo.currencySymbol, shopInfo.currencyCode);
    const money = (n: number) => `${cur} ${(n || 0).toFixed(2)}`;

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
            doc.setTextColor(90, 90, 90);
            doc.text(`Order #${order.publicId} (Cont.)`, MARGIN, MARGIN);
            y += 5;
        }
    };

    // --- CONTENT GENERATION ---

    // UAE FTA: a VAT-registered shop's invoice must be titled "Tax Invoice".
    const isTaxInvoice = (shopInfo.countryCode || "").toUpperCase() === "AE" && !!shopInfo.gstNumber;
    // jsPDF's built-in Helvetica renders Latin-1 only — a non-Latin configured tax
    // name would print as garbage, so fall back past it (same policy as currencyLabel).
    const rawTaxName = order.financials.taxName;
    const safeTaxName = rawTaxName && /^[\x20-\x7E\xA0-\xFF]+$/.test(rawTaxName) ? rawTaxName : undefined;

    // 1. SHOP HEADER
    if (logo) {
        const { w, h } = fitLogo(logo, 45, 14);
        const top = y - 5;
        doc.addImage(logo.dataUrl, "PNG", (pageWidth - w) / 2, top, w, h);
        y = top + h + 7; // shop name baseline sits below the logo
    }
    centerText(shopInfo.name.toUpperCase() || "LAUNDRY SERVICE", 18, "bold");
    y += 2;
    if (shopInfo.phone) centerText(`Tel: ${shopInfo.phone}`, 10);
    if (shopInfo.address) centerText(shopInfo.address, 9, "normal", [100, 100, 100]);
    if (shopInfo.gstNumber) centerText(`${getTaxIdLabel(shopInfo.countryCode, safeTaxName)}: ${shopInfo.gstNumber}`, 9, "normal", [100, 100, 100]);

    if (isTaxInvoice) {
        y += 3;
        centerText("TAX INVOICE", 12, "bold");
    }

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

    // Header Row — dark enough to survive thermal/laser printing
    doc.setFontSize(9);
    doc.setTextColor(70, 70, 70);
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
        const totalStr = money(itemTotal);
        doc.setFont(FONT_NORMAL, "bold");
        const totalWidth = doc.getTextWidth(totalStr);
        doc.text(totalStr, pageWidth - MARGIN - totalWidth, y);

        y += 5;

        // Details row — printed BLACK: shop owners reported the grey
        // "2 x Rs.49" line disappearing on thermal/laser printouts.
        doc.setFont(FONT_NORMAL, "normal");
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);

        let detailText = `${item.quantity} x ${cur}${item.unitPrice}`;
        doc.text(detailText, MARGIN, y);

        // Express charge line
        const expressMultiplier = (item as { expressMultiplier?: number }).expressMultiplier;
        if (expressMultiplier && expressMultiplier > 1) {
            y += 4;
            const expressCharge = Math.round(itemTotal * (expressMultiplier - 1));
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 0);
            doc.text(`Express Charge (${expressMultiplier}x): +${cur}${expressCharge}`, MARGIN, y);
        }

        y += 6; // Compact spacer
    });

    divider();

    // 6. TOTALS
    checkOverflow(60); // Ensure space for entire Totals

    const paySummaryTop = y; // the scan-to-pay QR floats in the summary's empty middle

    row("Subtotal", money(order.financials.subtotal));

    if (order.financials.expressCharge > 0) {
        row("Express Charges", money(order.financials.expressCharge));
    }
    if (order.financials.deliveryCharge > 0) {
        row("Delivery Charge", money(order.financials.deliveryCharge));
    }

    // Add Tax Row — named + rated as configured (e.g. "VAT (5%)", "GST (18%)");
    // tax-invoice rules (UAE FTA etc.) require the actual tax name and rate, and a
    // document titled TAX INVOICE always shows the line (zero-rated → "VAT (0%)").
    if ((order.financials.taxAmount || 0) > 0 || isTaxInvoice) {
        const hasTax = (order.financials.taxAmount || 0) > 0;
        const rate = order.financials.taxRate;
        // A zero-charged line on a TAX INVOICE is a compliance line — always "VAT",
        // never a stale stored name like GST (UAE's tax is VAT, not GST). The stored
        // name is only honoured when that tax was actually charged.
        const name = hasTax ? (safeTaxName || (isTaxInvoice ? "VAT" : "Tax")) : "VAT";
        const taxLabel = `${name}${rate ? ` (${rate}%)` : isTaxInvoice ? " (0%)" : ""}`;
        row(taxLabel, money(order.financials.taxAmount || 0));
    }

    if (order.financials.discountAmount > 0) {
        row("Discount", `- ${money(order.financials.discountAmount)}`, 10, "normal", [0, 128, 0]);
    }

    y += 2;
    // Total Line
    doc.setFont(FONT_NORMAL, "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    const totalLabel = "TOTAL";
    const totalVal = money(order.financials.total);
    doc.text(totalLabel, MARGIN, y);
    doc.text(totalVal, pageWidth - MARGIN - doc.getTextWidth(totalVal), y);
    y += 8;

    row("Amount Paid", money(order.financials.amountPaid), 10);

    if (order.financials.balance > 0) {
        row("Balance Due", money(order.financials.balance), 11, "bold", [220, 38, 38]);
    } else {
        row("Balance Due", money(0), 11, "bold", [0, 128, 0]);
    }

    // SCAN-TO-PAY QR — centered in the open middle of the payment summary
    // (labels hug the left edge, amounts the right), so a short bill still
    // fits one page. If the summary is shorter than the QR, flow continues
    // below the QR instead.
    if (payQr) {
        const qrSize = 26;
        let qy = paySummaryTop - 2;
        doc.setFont(FONT_NORMAL, "bold");
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text("SCAN TO PAY", (pageWidth - doc.getTextWidth("SCAN TO PAY")) / 2, qy);
        qy += 3;
        doc.addImage(payQr.dataUrl, "PNG", (pageWidth - qrSize) / 2, qy, qrSize, qrSize);
        qy += qrSize + 5;
        doc.setFontSize(8.5);
        const payLine = `Pay balance: ${money(order.financials.balance)}`;
        doc.text(payLine, (pageWidth - doc.getTextWidth(payLine)) / 2, qy);
        if (payQr.upiId) {
            qy += 4;
            doc.setFont(FONT_NORMAL, "normal");
            doc.setTextColor(70, 70, 70);
            const upiLine = `UPI: ${payQr.upiId}`;
            doc.text(upiLine, (pageWidth - doc.getTextWidth(upiLine)) / 2, qy);
            doc.setTextColor(0, 0, 0);
        }
        y = Math.max(y, qy + 5);
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
        doc.setTextColor(60, 60, 60);
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

    if (shopInfo.showTracking !== false) {
        centerText("Track your order online:", 8, "normal", [70, 70, 70]);
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
    }

    // QR Code Removed as per request

    // --- Terms & Conditions (owner-configured) ---
    const terms = (shopInfo.receiptTerms || "").trim();
    if (terms) {
        y += 4;
        divider();
        y += 4;
        centerText("Terms & Conditions", 9, "bold", [80, 80, 80]);
        y += 1;
        doc.setFont(FONT_NORMAL, "normal");
        doc.setFontSize(8);
        doc.setTextColor(70, 70, 70);
        // jsPDF's Helvetica is Latin-1 only — non-Latin scripts (e.g. Arabic/Hindi)
        // may not render here; they DO render in the app/HTML receipts.
        const wrapped = doc.splitTextToSize(terms, pageWidth - MARGIN * 2) as string[];
        for (const line of wrapped) {
            if (y > pageHeight - FOOTER_HEIGHT) { doc.addPage(); y = MARGIN + 6; }
            doc.text(line, MARGIN, y);
            y += 8 * 0.3527 + 1.6;
        }
        doc.setTextColor(0, 0, 0);
    }

    y += 5;
    // The closing line may sit closer to the branding footer (at pageHeight-10)
    // than regular content — it saves a near-empty page 2 when the logo header
    // makes an already-full bill run a few mm long.
    if (y > pageHeight - 16) { doc.addPage(); y = MARGIN + 6; }
    centerText("Thank you for your business!", 9, "bold");

    // --- GLOBAL FOOTER LOOP ---
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont(FONT_NORMAL, "normal");
        doc.setFontSize(8);
        doc.setTextColor(110, 110, 110);

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

export async function generateOrderReceipt(order: Order, shopInfo: ShopInfo): Promise<void> {
    const [logo, payQr] = await Promise.all([loadReceiptLogo(shopInfo.logoUrl), loadPaymentQr(order, shopInfo)]);
    const doc = createDoc();
    drawReceipt(doc, order, shopInfo, logo, payQr);
    doc.save(getReceiptFileName(order));
}

export async function getReceiptBlob(order: Order, shopInfo: ShopInfo): Promise<Blob> {
    const [logo, payQr] = await Promise.all([loadReceiptLogo(shopInfo.logoUrl), loadPaymentQr(order, shopInfo)]);
    const doc = createDoc();
    drawReceipt(doc, order, shopInfo, logo, payQr);
    return doc.output("blob");
}

export function getReceiptFileName(order: Order): string {
    return `LaundryBill_Order_${order.publicId}.pdf`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 80mm THERMAL / POS RECEIPT
// Standard POS roll width (80mm). Everything solid black — thermal heads have
// no greyscale, so grey text simply vanishes. Height is measured with a probe
// pass, then the real document is cut to fit like a till roll.
// ─────────────────────────────────────────────────────────────────────────────

const T_WIDTH = 80;   // mm — standard thermal roll
const T_MARGIN = 5;

const drawThermal = (doc: jsPDF, order: Order, shopInfo: ShopInfo, logo?: LogoImage | null, payQr?: PayQr | null): number => {
    const W = T_WIDTH, M = T_MARGIN, CW = W - M * 2;
    const cur = currencyLabel(shopInfo.currencySymbol, shopInfo.currencyCode);
    const money = (n: number) => `${cur} ${(n || 0).toFixed(2)}`;
    const lh = (size: number) => size * 0.42 + 1.4; // line height in mm
    let y = 8;

    doc.setTextColor(0, 0, 0);

    const center = (text: string, size: number, style: string = "normal") => {
        doc.setFont(FONT_NORMAL, style);
        doc.setFontSize(size);
        for (const line of doc.splitTextToSize(text, CW) as string[]) {
            doc.text(line, W / 2, y, { align: "center" });
            y += lh(size);
        }
    };
    const dashed = () => {
        y += 0.6;
        doc.setLineDashPattern([1, 1], 0);
        doc.setDrawColor(0);
        doc.setLineWidth(0.3);
        doc.line(M, y, W - M, y);
        doc.setLineDashPattern([], 0);
        y += 3.4;
    };
    const kv = (label: string, value: string, size: number = 8, style: string = "normal") => {
        doc.setFont(FONT_NORMAL, style);
        doc.setFontSize(size);
        doc.text(label, M, y);
        doc.text(value, W - M - doc.getTextWidth(value), y);
        y += lh(size);
    };

    // Shop header (thermal heads are 1-bit — the logo prints dithered, which is standard)
    if (logo) {
        const { w, h } = fitLogo(logo, 36, 16);
        const top = y - 4;
        doc.addImage(logo.dataUrl, "PNG", (W - w) / 2, top, w, h);
        y = top + h + 6;
    }
    center(shopInfo.name.toUpperCase(), 12, "bold");
    if (shopInfo.phone) center(`Tel: ${shopInfo.phone}`, 8);
    if (shopInfo.address) center(shopInfo.address, 8);
    if (shopInfo.gstNumber) center(`${getTaxIdLabel(shopInfo.countryCode)}: ${shopInfo.gstNumber}`, 8);

    dashed();
    center(`ORDER #${order.publicId}`, 10.5, "bold");
    if (order.createdAt) center(format(order.createdAt.toDate(), "dd MMM yyyy, hh:mm a"), 8);
    const deliveryType = mapLegacyDeliveryType(order.deliveryType);
    center(`[ ${DELIVERY_TYPE_LABELS[deliveryType].toUpperCase()} ]`, 8.5, "bold");

    dashed();
    doc.setFont(FONT_NORMAL, "bold"); doc.setFontSize(8.5);
    doc.text("CUSTOMER", M, y); y += lh(8.5);
    kv("Name:", order.customerName || "Walk-in");
    if (order.customerPhone) kv("Phone:", order.customerPhone);
    if (!order.customerPhone && order.customerEmail) kv("Email:", order.customerEmail);

    dashed();
    // Items — name (wrapped) with amount right-aligned on the first line, then
    // the qty x rate line. All black at 8pt: thermal-legible.
    order.items.forEach((item) => {
        const isExpress = (item as { express?: boolean }).express || ((item as { expressMultiplier?: number }).expressMultiplier || 1) > 1;
        const name = `${item.serviceName}${isExpress ? " (Express)" : ""}${item.categoryName ? ` (${item.categoryName})` : ""}`;
        const amount = money(item.quantity * item.unitPrice);

        doc.setFont(FONT_NORMAL, "bold");
        doc.setFontSize(8.5);
        const amtW = doc.getTextWidth(amount);
        const nameLines = doc.splitTextToSize(name, CW - amtW - 3) as string[];
        doc.text(nameLines[0], M, y);
        doc.text(amount, W - M - amtW, y);
        y += lh(8.5);
        for (const extra of nameLines.slice(1)) { doc.text(extra, M, y); y += lh(8.5); }

        doc.setFont(FONT_NORMAL, "normal");
        doc.setFontSize(8);
        doc.text(`${item.quantity} x ${cur}${item.unitPrice}`, M + 1, y);
        y += lh(8);

        const mult = (item as { expressMultiplier?: number }).expressMultiplier;
        if (mult && mult > 1) {
            const extraCharge = Math.round(item.quantity * item.unitPrice * (mult - 1));
            doc.text(`Express (${mult}x): +${cur}${extraCharge}`, M + 1, y);
            y += lh(8);
        }
        y += 0.6;
    });

    dashed();
    kv("Subtotal", money(order.financials.subtotal));
    if (order.financials.expressCharge > 0) kv("Express Charges", money(order.financials.expressCharge));
    if (order.financials.deliveryCharge > 0) kv("Delivery Charge", money(order.financials.deliveryCharge));
    if ((order.financials.taxAmount || 0) > 0) {
        const name = order.financials.taxName || "Tax";
        kv(`${name}${order.financials.taxRate ? ` (${order.financials.taxRate}%)` : ""}`, money(order.financials.taxAmount || 0));
    }
    if (order.financials.discountAmount > 0) kv("Discount", `- ${money(order.financials.discountAmount)}`);
    y += 1;
    kv("TOTAL", money(order.financials.total), 11.5, "bold");
    kv("Amount Paid", money(order.financials.amountPaid));
    kv("Balance Due", money(Math.max(0, order.financials.balance)), 9.5, "bold");

    dashed();
    kv("Order Status:", order.status.toUpperCase());
    kv("Payment:", order.paymentMethod.toUpperCase());
    if (order.expectedDelivery) {
        y += 1.5;
        const dateLabel = deliveryType === "pickup_store" ? "Ready for Pickup" : "Expected Delivery";
        center(`${dateLabel}: ${format(order.expectedDelivery.toDate(), "dd MMM yyyy")}`, 9, "bold");
    }

    // Scan-to-pay QR — the customer settles the balance from the printed bill
    if (payQr) {
        dashed();
        center("SCAN TO PAY", 9.5, "bold");
        y += 0.5;
        const qrSize = 28;
        doc.addImage(payQr.dataUrl, "PNG", (W - qrSize) / 2, y, qrSize, qrSize);
        y += qrSize + 4;
        center(`Pay balance: ${money(Math.max(0, order.financials.balance))}`, 8.5, "bold");
        if (payQr.upiId) center(`UPI: ${payQr.upiId}`, 7.5);
    }

    if (shopInfo.receiptTerms?.trim()) {
        dashed();
        center("Terms & Conditions", 8, "bold");
        doc.setFont(FONT_NORMAL, "normal");
        doc.setFontSize(7);
        for (const line of doc.splitTextToSize(shopInfo.receiptTerms.trim(), CW) as string[]) {
            doc.text(line, M, y);
            y += lh(7);
        }
    }

    dashed();
    center("Thank you for your business!", 8.5, "bold");
    center("Powered by laundrybill.com", 7);
    return y;
};

/** 80mm-wide receipt PDF, trimmed to content height like a till roll. */
export async function getThermalReceiptBlob(order: Order, shopInfo: ShopInfo): Promise<Blob> {
    const [logo, payQr] = await Promise.all([loadReceiptLogo(shopInfo.logoUrl), loadPaymentQr(order, shopInfo)]);
    // Probe pass on an oversized page measures the exact height needed.
    const probe = new jsPDF({ orientation: "portrait", unit: "mm", format: [T_WIDTH, 2000] });
    const contentHeight = drawThermal(probe, order, shopInfo, logo, payQr);
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [T_WIDTH, Math.max(90, contentHeight + 6)] });
    drawThermal(doc, order, shopInfo, logo, payQr);
    return doc.output("blob");
}

export function getThermalReceiptFileName(order: Order): string {
    return `LaundryBill_Order_${order.publicId}_80mm.pdf`;
}
