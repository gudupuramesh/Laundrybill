import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Order } from "@/types/order";
import { useShop } from "@/hooks/use-shop";
import { LResponsiveDialog, LButton } from "@/components/laundry";
import { Printer, Tag, ShoppingBag, ArrowLeft, Download } from "lucide-react";
import { format } from "date-fns";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";

interface TagGeneratorModalProps {
    open: boolean;
    onClose: () => void;
    order: Order;
}

type TagType = "basket" | "items";
/** Standard 80mm tags (current) vs Roll labels 15×64mm, 3 per row (image size) */
type LabelFormat = "standard" | "roll";
type Step = "select" | "preview";

// ============================================================
// EXACT SPECIFICATIONS (from 27-THERMAL-PRINTER-QR-LABELS.md)
// ============================================================
// Paper: 50mm width × 100mm height (per row, continuous)
// Tag: 15mm width × 100mm height (64mm print + 36mm tail)
// 3 tags per row, side by side horizontally
// Gap: 1.25mm × 4 = 5mm total
// Top half (32mm): Order ID, Item#, QR (horizontal text)
// Bottom half (32mm): Service, Delivery, Order (vertical text, 3 cols)

const ROLL_PAPER_WIDTH_MM = 50;       // 50mm paper width
const ROLL_PAPER_HEIGHT_MM = 100;     // 100mm per row (continuous)
const ROLL_TAGS_PER_ROW = 3;          // ALWAYS 3 tags per row
const ROLL_GAP_MM = 1.25;             // 1.25mm gap (×4 = 5mm total)

const ROLL_TAG_WIDTH_MM = 15;         // 15mm tag width
const ROLL_TAG_HEIGHT_MM = 100;       // 100mm total tag height
const ROLL_TAG_PRINT_HEIGHT_MM = 64;  // 64mm print area
const ROLL_TAG_TAIL_MM = 36;          // 36mm tail (for jewelry wrap)
const ROLL_HALF_HEIGHT_MM = 32;       // each half = 32mm

const ROLL_QR_SIZE_MM = 12;           // 12mm × 12mm QR code
const ROLL_COL_WIDTH_MM = 5;          // 15mm ÷ 3 = 5mm per column in bottom half

interface GeneratedTag {
    name: string;           // Service name
    index: number;          // Item number (1, 2, 3...)
    total: number;          // Total items
    qrDataUrl: string;      // QR code data URL
    deliveryDate: string;   // Formatted delivery date
}

export function TagGeneratorModal({ open, onClose, order }: TagGeneratorModalProps) {
    const { t } = useTranslation();
    const { shop } = useShop();
    const shopName = shop?.name || "LaundryBill";
    const [tagType, setTagType] = useState<TagType>("basket");
    const [labelFormat, setLabelFormat] = useState<LabelFormat>("standard");
    const [step, setStep] = useState<Step>("select");
    const [generating, setGenerating] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [generatedTags, setGeneratedTags] = useState<GeneratedTag[]>([]);
    const [basketQr, setBasketQr] = useState<string>("");
    const printRef = useRef<HTMLDivElement>(null);

    // Calculate total quantity
    const totalQuantity = order.items?.reduce((acc, item) => acc + (item.quantity || 1), 0) || 0;
    const displayName = shopName || "LaundryBill";

    // Reset when modal opens/closes
    useEffect(() => {
        if (!open) {
            setStep("select");
            setGeneratedTags([]);
            setBasketQr("");
        }
    }, [open]);

    // Chunk item tags into rows of exactly 3 (for thermal roll)
    const tagRows: GeneratedTag[][] = [];
    if (labelFormat === "roll" && generatedTags.length > 0) {
        for (let i = 0; i < generatedTags.length; i += ROLL_TAGS_PER_ROW) {
            tagRows.push(generatedTags.slice(i, i + ROLL_TAGS_PER_ROW));
        }
    }

    /** Escape HTML special characters */
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    /**
     * Build one tag's HTML matching Python layout:
     * - Top half (32mm): Order ID, Item#, QR Code (horizontal)
     * - Bottom half (32mm): Service, Delivery, Order (vertical, 3 columns)
     * - Tail (36mm): blank
     */
    const rollTagHtml = (tag: GeneratedTag) => {
        const qrSrc = tag.qrDataUrl.replace(/"/g, "&quot;");
        return `
            <div class="roll-tag">
                <div class="tag-print-area">
                    <div class="tag-top-half">
                        <span class="order-id">${esc(order.orderNumber)}</span>
                        <span class="item-number">${tag.index}/${tag.total}</span>
                        <img src="${qrSrc}" alt="QR" class="qr-code" />
                    </div>
                    <div class="tag-bottom-half">
                        <div class="tag-col">${esc(tag.name)}</div>
                        <div class="tag-col">Del:${esc(tag.deliveryDate)}</div>
                        <div class="tag-col">${esc(order.orderNumber)}</div>
                    </div>
                </div>
                <div class="tag-tail"></div>
            </div>`;
    };

    /** Build roll print HTML: explicit rows of exactly 3 tags (matches Python layout) */
    const buildRollPrintContent = (): string => {
        const emptyTag = '<div class="roll-tag roll-tag-empty"></div>';
        const rows: string[] = [];
        
        if (tagType === "basket" && basketQr) {
            const basketQrEsc = basketQr.replace(/"/g, "&quot;");
            const basketTag = `
                <div class="roll-tag">
                    <div class="tag-print-area">
                        <div class="tag-top-half">
                            <span class="order-id">${esc(order.orderNumber)}</span>
                            <span class="item-number">BASKET</span>
                            <img src="${basketQrEsc}" alt="QR" class="qr-code" />
                        </div>
                        <div class="tag-bottom-half">
                            <div class="tag-col">${esc(order.customerName || '')}</div>
                            <div class="tag-col">${totalQuantity} items</div>
                            <div class="tag-col">${esc(order.orderNumber)}</div>
                        </div>
                    </div>
                    <div class="tag-tail"></div>
                </div>`;
            rows.push(`<div class="roll-row"><div class="roll-gap"></div>${basketTag}<div class="roll-gap"></div>${emptyTag}<div class="roll-gap"></div>${emptyTag}<div class="roll-gap"></div></div>`);
        } else {
            for (let i = 0; i < generatedTags.length; i += ROLL_TAGS_PER_ROW) {
                const rowTags = generatedTags.slice(i, i + ROLL_TAGS_PER_ROW);
                const cells = rowTags.map((t) => rollTagHtml(t));
                while (cells.length < ROLL_TAGS_PER_ROW) cells.push(emptyTag);
                // Add gaps: gap-tag-gap-tag-gap-tag-gap (4 gaps total)
                rows.push(`<div class="roll-row"><div class="roll-gap"></div>${cells.join('<div class="roll-gap"></div>')}<div class="roll-gap"></div></div>`);
            }
        }
        return `<div class="roll-print">${rows.join("")}</div>`;
    };

    // Generate QR codes when moving to preview step
    const generatePreviews = async () => {
        setGenerating(true);
        try {
            if (tagType === "basket") {
                const qrUrl = await QRCode.toDataURL(order.id, { width: 150, margin: 1 });
                setBasketQr(qrUrl);
            } else {
                const tags: GeneratedTag[] = [];
                let totalItems = 0;

                // First pass: count total items
                order.items?.forEach(item => {
                    totalItems += item.quantity;
                });

                // Second pass: generate tags
                let currentIndex = 0;
                // Get delivery date from order
                const deliveryDate = order.expectedDelivery?.toDate 
                    ? format(order.expectedDelivery.toDate(), "dd MMM")
                    : order.createdAt?.toDate 
                        ? format(order.createdAt.toDate(), "dd MMM")
                        : "N/A";
                
                for (const item of (order.items || [])) {
                    for (let i = 0; i < item.quantity; i++) {
                        currentIndex++;
                        const qrSize = labelFormat === "roll" ? 96 : 120; // 12mm @ 203 DPI = ~96px
                        // Scan page expects "orderId" or "orderId:itemIndex" (Firestore doc id, not orderNumber)
                        const qrData = `${order.id}:${currentIndex}`;
                        const qrUrl = await QRCode.toDataURL(qrData, { width: qrSize, margin: 0 });
                        tags.push({
                            name: item.serviceName,
                            index: currentIndex,
                            total: totalItems,
                            qrDataUrl: qrUrl,
                            deliveryDate: deliveryDate
                        });
                    }
                }
                setGeneratedTags(tags);
            }
            setStep("preview");
        } catch (error) {
            console.error("Failed to generate QR codes:", error);
        } finally {
            setGenerating(false);
        }
    };

    // Print handler - opens browser print and closes modal
    const handlePrint = () => {
        if (!printRef.current) return;

        const root = printRef.current;
        // Roll: build HTML from data (explicit rows of 3) so print always shows exactly 3 per row
        const content = labelFormat === "roll"
            ? buildRollPrintContent()
            : root.innerHTML;
        const isRoll = labelFormat === "roll";

        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (!printWindow) {
            alert('Please allow popups for printing');
            return;
        }

        // CSS matching Python ReportLab layout exactly:
        // Paper: 50mm × 100mm, Tag: 15mm × 100mm (64mm print + 36mm tail)
        // Top half (32mm): horizontal text, Bottom half (32mm): vertical text (3 cols)
        const rollCss = isRoll ? `
                    @page { size: ${ROLL_PAPER_WIDTH_MM}mm ${ROLL_PAPER_HEIGHT_MM}mm; margin: 0; }
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: Arial, sans-serif; background: white; width: ${ROLL_PAPER_WIDTH_MM}mm; margin: 0; }
                    
                    .roll-print { width: ${ROLL_PAPER_WIDTH_MM}mm; }
                    
                    .roll-row { 
                        display: flex; 
                        flex-direction: row; 
                        flex-wrap: nowrap; 
                        width: ${ROLL_PAPER_WIDTH_MM}mm; 
                        height: ${ROLL_PAPER_HEIGHT_MM}mm;
                        page-break-after: always;
                    }
                    .roll-row:last-child { page-break-after: auto; }
                    
                    .roll-gap { 
                        width: ${ROLL_GAP_MM}mm; 
                        min-width: ${ROLL_GAP_MM}mm;
                        flex-shrink: 0; 
                    }
                    
                    .roll-tag { 
                        width: ${ROLL_TAG_WIDTH_MM}mm; 
                        min-width: ${ROLL_TAG_WIDTH_MM}mm;
                        max-width: ${ROLL_TAG_WIDTH_MM}mm;
                        height: ${ROLL_TAG_HEIGHT_MM}mm; 
                        flex-shrink: 0; 
                        display: flex; 
                        flex-direction: column;
                        background: white;
                    }
                    
                    .tag-print-area {
                        width: ${ROLL_TAG_WIDTH_MM}mm;
                        height: ${ROLL_TAG_PRINT_HEIGHT_MM}mm;
                        display: flex;
                        flex-direction: column;
                    }
                    
                    /* TOP HALF: 32mm - Order ID, Item#, QR (horizontal text) */
                    .tag-top-half {
                        width: ${ROLL_TAG_WIDTH_MM}mm;
                        height: ${ROLL_HALF_HEIGHT_MM}mm;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: flex-start;
                        padding-top: 2mm;
                        border-bottom: 1px dashed #ccc;
                    }
                    
                    .order-id {
                        font-size: 5pt;
                        font-weight: bold;
                        text-align: center;
                        margin-bottom: 1mm;
                    }
                    
                    .item-number {
                        font-size: 9pt;
                        font-weight: bold;
                        text-align: center;
                        margin-bottom: 2mm;
                    }
                    
                    .qr-code {
                        width: ${ROLL_QR_SIZE_MM}mm;
                        height: ${ROLL_QR_SIZE_MM}mm;
                    }
                    
                    /* BOTTOM HALF: 32mm - Service, Delivery, Order (vertical text, 3 columns) */
                    .tag-bottom-half {
                        width: ${ROLL_TAG_WIDTH_MM}mm;
                        height: ${ROLL_HALF_HEIGHT_MM}mm;
                        display: flex;
                        flex-direction: row;
                    }
                    
                    .tag-col {
                        width: ${ROLL_COL_WIDTH_MM}mm;
                        height: ${ROLL_HALF_HEIGHT_MM}mm;
                        writing-mode: vertical-rl;
                        text-orientation: mixed;
                        transform: rotate(180deg);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 5pt;
                        font-weight: bold;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    
                    /* TAIL: 36mm blank */
                    .tag-tail {
                        width: ${ROLL_TAG_WIDTH_MM}mm;
                        height: ${ROLL_TAG_TAIL_MM}mm;
                        border-top: 1px dashed #ccc;
                    }
                    
                    .roll-tag-empty { 
                        background: #fafafa; 
                        border: 1px dashed #ccc; 
                    }
        ` : '';

        const standardCss = !isRoll ? `
                    @page { size: 80mm auto; margin: 2mm; }
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: Arial, sans-serif; background: white; width: 76mm; margin: 0 auto; }
                    .tag { border: 2px solid #000; padding: 3mm; margin-bottom: 3mm; width: 76mm; page-break-inside: avoid; page-break-after: always; background: white; }
                    .tag:last-child { page-break-after: auto; }
                    .header { font-weight: bold; font-size: 14pt; text-align: center; border-bottom: 1px dashed #000; padding-bottom: 2mm; margin-bottom: 2mm; }
                    .order-num { font-size: 9pt; font-weight: normal; margin-top: 1mm; }
                    .row { display: flex; justify-content: space-between; margin-bottom: 1mm; font-size: 10pt; }
                    .label { font-weight: bold; }
                    .item-count { font-size: 14pt; font-weight: bold; }
                    .qr { display: flex; justify-content: center; margin: 3mm 0; }
                    .qr img { width: 25mm; height: 25mm; }
                    .item-name { font-size: 12pt; font-weight: bold; text-align: center; margin: 2mm 0; }
                    .item-index { font-size: 20pt; font-weight: 900; text-align: center; margin: 2mm 0; }
                    .footer { font-size: 9pt; text-align: center; border-top: 1px dashed #000; padding-top: 2mm; margin-top: 2mm; }
                ` : '';

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Print Tags - ${order.orderNumber}</title>
                <style>${rollCss}${standardCss}</style>
            </head>
            <body>
                ${content}
                <script>
                    window.onload = function() {
                        setTimeout(function() { window.print(); }, 200);
                    }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();

        onClose();
    };

    /** Generate HTML document for tags (shared between print and download) */
    const _generateTagsHtml = (includeAutoprint: boolean = false): string => {
        if (!printRef.current) return '';

        const root = printRef.current;
        const content = labelFormat === "roll"
            ? buildRollPrintContent()
            : root.innerHTML;
        const isRoll = labelFormat === "roll";

        const rollCss = isRoll ? `
            @page { size: ${ROLL_PAPER_WIDTH_MM}mm ${ROLL_PAPER_HEIGHT_MM}mm; margin: 0; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; background: white; width: ${ROLL_PAPER_WIDTH_MM}mm; margin: 0; }
            .roll-print { width: ${ROLL_PAPER_WIDTH_MM}mm; }
            .roll-row { display: flex; flex-direction: row; flex-wrap: nowrap; width: ${ROLL_PAPER_WIDTH_MM}mm; height: ${ROLL_PAPER_HEIGHT_MM}mm; page-break-after: always; }
            .roll-row:last-child { page-break-after: auto; }
            .roll-gap { width: ${ROLL_GAP_MM}mm; min-width: ${ROLL_GAP_MM}mm; flex-shrink: 0; }
            .roll-tag { width: ${ROLL_TAG_WIDTH_MM}mm; min-width: ${ROLL_TAG_WIDTH_MM}mm; max-width: ${ROLL_TAG_WIDTH_MM}mm; height: ${ROLL_TAG_HEIGHT_MM}mm; flex-shrink: 0; display: flex; flex-direction: column; background: white; }
            .tag-print-area { width: ${ROLL_TAG_WIDTH_MM}mm; height: ${ROLL_TAG_PRINT_HEIGHT_MM}mm; display: flex; flex-direction: column; }
            .tag-top-half { width: ${ROLL_TAG_WIDTH_MM}mm; height: ${ROLL_HALF_HEIGHT_MM}mm; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 2mm; border-bottom: 1px dashed #ccc; }
            .order-id { font-size: 5pt; font-weight: bold; text-align: center; margin-bottom: 1mm; }
            .item-number { font-size: 9pt; font-weight: bold; text-align: center; margin-bottom: 2mm; }
            .qr-code { width: ${ROLL_QR_SIZE_MM}mm; height: ${ROLL_QR_SIZE_MM}mm; }
            .tag-bottom-half { width: ${ROLL_TAG_WIDTH_MM}mm; height: ${ROLL_HALF_HEIGHT_MM}mm; display: flex; flex-direction: row; }
            .tag-col { width: ${ROLL_COL_WIDTH_MM}mm; height: ${ROLL_HALF_HEIGHT_MM}mm; writing-mode: vertical-rl; text-orientation: mixed; transform: rotate(180deg); display: flex; align-items: center; justify-content: center; font-size: 5pt; font-weight: bold; overflow: hidden; text-overflow: ellipsis; }
            .tag-tail { width: ${ROLL_TAG_WIDTH_MM}mm; height: ${ROLL_TAG_TAIL_MM}mm; border-top: 1px dashed #ccc; }
            .roll-tag-empty { background: #fafafa; border: 1px dashed #ccc; }
        ` : '';

        const standardCss = !isRoll ? `
            @page { size: 80mm auto; margin: 2mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; background: white; width: 76mm; margin: 0 auto; }
            .tag { border: 2px solid #000; padding: 3mm; margin-bottom: 3mm; width: 76mm; page-break-inside: avoid; page-break-after: always; background: white; }
            .tag:last-child { page-break-after: auto; }
            .header { font-weight: bold; font-size: 14pt; text-align: center; border-bottom: 1px dashed #000; padding-bottom: 2mm; margin-bottom: 2mm; }
            .order-num { font-size: 9pt; font-weight: normal; margin-top: 1mm; }
            .row { display: flex; justify-content: space-between; margin-bottom: 1mm; font-size: 10pt; }
            .label { font-weight: bold; }
            .item-count { font-size: 14pt; font-weight: bold; }
            .qr { display: flex; justify-content: center; margin: 3mm 0; }
            .qr img { width: 25mm; height: 25mm; }
            .item-name { font-size: 12pt; font-weight: bold; text-align: center; margin: 2mm 0; }
            .item-index { font-size: 20pt; font-weight: 900; text-align: center; margin: 2mm 0; }
            .footer { font-size: 9pt; text-align: center; border-top: 1px dashed #000; padding-top: 2mm; margin-top: 2mm; }
        ` : '';

        const autoprintScript = includeAutoprint ? `
            <script>
                window.onload = function() {
                    setTimeout(function() { window.print(); }, 200);
                }
            </script>
        ` : '';

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Tags - ${order.orderNumber}</title>
    <style>${rollCss}${standardCss}</style>
</head>
<body>
    ${content}
    ${autoprintScript}
</body>
</html>`;
    };
    void _generateTagsHtml; // reserved for future use (print/download HTML)

    // Download handler - generates PDF with exact thermal printer dimensions
    const handleDownload = async () => {
        setDownloading(true);
        try {
            // Determine items to print
            const items = tagType === "basket" 
                ? [{ name: order.customerName || "Customer", index: 0, total: totalQuantity, qrDataUrl: basketQr, deliveryDate: "" }]
                : generatedTags;
            
            if (items.length === 0) {
                setDownloading(false);
                return;
            }

            // For standard format, use different dimensions
            if (labelFormat === "standard") {
                // Standard 80mm tags - one per page
                const tagHeight = 100; // approximate height per tag
                const doc = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: [80, tagHeight],
                });

                for (let i = 0; i < items.length; i++) {
                    if (i > 0) doc.addPage([80, tagHeight]);
                    const tag = items[i];
                    const isBasket = tagType === "basket";
                    
                    // Draw border
                    doc.setDrawColor(0);
                    doc.setLineWidth(0.5);
                    doc.rect(2, 2, 76, tagHeight - 4);
                    
                    // Header
                    doc.setFontSize(14);
                    doc.setFont("helvetica", "bold");
                    doc.text(displayName, 40, 10, { align: "center" });
                    
                    // Order number
                    doc.setFontSize(9);
                    doc.setFont("helvetica", "normal");
                    doc.text(order.orderNumber, 40, 16, { align: "center" });
                    
                    // Dashed line
                    doc.setLineDashPattern([1, 1], 0);
                    doc.line(5, 20, 75, 20);
                    doc.setLineDashPattern([], 0);
                    
                    if (isBasket) {
                        // Basket tag content
                        doc.setFontSize(10);
                        doc.text(`Customer: ${order.customerName || "N/A"}`, 5, 28);
                        doc.text(`Items: ${totalQuantity}`, 5, 35);
                        doc.text(`Date: ${order.createdAt?.toDate ? format(order.createdAt.toDate(), "dd MMM") : "N/A"}`, 5, 42);
                        
                        // QR Code
                        if (basketQr) {
                            doc.addImage(basketQr, 'PNG', 27.5, 48, 25, 25);
                        }
                        
                        // Footer
                        doc.setFontSize(9);
                        doc.text("BASKET TAG", 40, tagHeight - 8, { align: "center" });
                    } else {
                        // Item tag content
                        doc.setFontSize(12);
                        doc.setFont("helvetica", "bold");
                        doc.text(tag.name, 40, 30, { align: "center" });
                        
                        // QR Code
                        doc.addImage(tag.qrDataUrl, 'PNG', 27.5, 35, 25, 25);
                        
                        // Item index
                        doc.setFontSize(20);
                        doc.text(`${tag.index} / ${tag.total}`, 40, 70, { align: "center" });
                        
                        // Footer
                        doc.setFontSize(9);
                        doc.setFont("helvetica", "normal");
                        doc.text(`${order.customerName || ""} • ${format(new Date(), "dd/MM")}`, 40, tagHeight - 8, { align: "center" });
                    }
                }
                
                doc.save(`tags-${order.orderNumber}-${Date.now()}.pdf`);
                setDownloading(false);
                return;
            }

            // Roll format - exact thermal printer dimensions
            const numRows = Math.ceil(items.length / ROLL_TAGS_PER_ROW);
            const totalHeight = numRows * ROLL_PAPER_HEIGHT_MM;

            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: [ROLL_PAPER_WIDTH_MM, totalHeight],
            });

            // Draw each tag
            let itemIndex = 0;
            for (let row = 0; row < numRows; row++) {
                const rowY = row * ROLL_PAPER_HEIGHT_MM;
                
                for (let col = 0; col < ROLL_TAGS_PER_ROW; col++) {
                    if (itemIndex >= items.length) break;
                    
                    const tag = items[itemIndex];
                    const isBasket = tagType === "basket" && itemIndex === 0;
                    
                    // Calculate X position: gap + (tag + gap) * col
                    const tagX = ROLL_GAP_MM + col * (ROLL_TAG_WIDTH_MM + ROLL_GAP_MM);
                    
                    // ─────────────────────────────────────────────────────────
                    // TOP HALF (32mm) - Order ID, Item#, QR Code (horizontal)
                    // ─────────────────────────────────────────────────────────
                    const topHalfY = rowY;
                    
                    // Order ID - at the very top (5pt = ~1.76mm)
                    doc.setFontSize(5);
                    doc.setFont("helvetica", "bold");
                    doc.text(order.orderNumber, tagX + ROLL_TAG_WIDTH_MM / 2, topHalfY + 3, { align: "center" });
                    
                    // Item number (9pt = ~3.17mm)
                    doc.setFontSize(9);
                    doc.setFont("helvetica", "bold");
                    const itemLabel = isBasket ? "BASKET" : `${tag.index}/${tag.total}`;
                    doc.text(itemLabel, tagX + ROLL_TAG_WIDTH_MM / 2, topHalfY + 8, { align: "center" });
                    
                    // QR Code - centered (12mm × 12mm)
                    const qrX = tagX + (ROLL_TAG_WIDTH_MM - ROLL_QR_SIZE_MM) / 2;
                    const qrY = topHalfY + 10;
                    const qrDataUrl = isBasket ? basketQr : tag.qrDataUrl;
                    if (qrDataUrl) {
                        doc.addImage(qrDataUrl, 'PNG', qrX, qrY, ROLL_QR_SIZE_MM, ROLL_QR_SIZE_MM);
                    }
                    
                    // Divider line between top and bottom half
                    doc.setDrawColor(200);
                    doc.setLineDashPattern([0.5, 0.5], 0);
                    doc.line(tagX + 1, topHalfY + ROLL_HALF_HEIGHT_MM, tagX + ROLL_TAG_WIDTH_MM - 1, topHalfY + ROLL_HALF_HEIGHT_MM);
                    doc.setLineDashPattern([], 0);
                    doc.setDrawColor(0);
                    
                    // ─────────────────────────────────────────────────────────
                    // BOTTOM HALF (32mm) - Service, Delivery, Order (vertical)
                    // Draw each column's text separately with precise positioning
                    // ─────────────────────────────────────────────────────────
                    const bottomHalfY = topHalfY + ROLL_HALF_HEIGHT_MM;
                    const textCenterY = bottomHalfY + ROLL_HALF_HEIGHT_MM / 2;
                    
                    // Use smaller font (4pt) to prevent overflow between tags
                    doc.setFontSize(4);
                    
                    // Truncate text to fit within 32mm vertical space
                    const truncate = (s: string, maxLen: number) => (s.length <= maxLen ? s : s.slice(0, maxLen - 1) + "…");
                    
                    // Column 1: Service Name (leftmost)
                    const col1X = tagX + ROLL_COL_WIDTH_MM * 0.5;
                    doc.setFont("helvetica", "bold");
                    const col1Text = isBasket ? truncate(order.customerName || "Customer", 10) : truncate(tag.name, 10);
                    doc.text(col1Text, col1X, textCenterY, { angle: 90 });
                    
                    // Column 2: Delivery Date (middle)
                    const col2X = tagX + ROLL_COL_WIDTH_MM * 1.5;
                    doc.setFont("helvetica", "normal");
                    const col2Text = isBasket ? `${totalQuantity} items` : truncate(`Del:${tag.deliveryDate}`, 10);
                    doc.text(col2Text, col2X, textCenterY, { angle: 90 });
                    
                    // Column 3: Order Number (rightmost)
                    const col3X = tagX + ROLL_COL_WIDTH_MM * 2.5;
                    doc.setFont("helvetica", "bold");
                    doc.text(order.orderNumber, col3X, textCenterY, { angle: 90 });
                    
                    // ─────────────────────────────────────────────────────────
                    // TAIL DIVIDER (dashed line at 64mm mark)
                    // ─────────────────────────────────────────────────────────
                    const tailY = topHalfY + ROLL_TAG_PRINT_HEIGHT_MM;
                    doc.setDrawColor(200);
                    doc.setLineDashPattern([0.5, 1], 0);
                    doc.line(tagX, tailY, tagX + ROLL_TAG_WIDTH_MM, tailY);
                    doc.setLineDashPattern([], 0);
                    doc.setDrawColor(0);
                    
                    itemIndex++;
                }
            }
            
            // Add vertical cut guides between columns (dashed lines)
            doc.setDrawColor(200);
            doc.setLineDashPattern([2, 2], 0);
            
            // Line between column 1 and 2
            const cutX1 = ROLL_GAP_MM + ROLL_TAG_WIDTH_MM + ROLL_GAP_MM / 2;
            doc.line(cutX1, 0, cutX1, totalHeight);
            
            // Line between column 2 and 3
            const cutX2 = ROLL_GAP_MM + (ROLL_TAG_WIDTH_MM + ROLL_GAP_MM) * 2 - ROLL_GAP_MM / 2;
            doc.line(cutX2, 0, cutX2, totalHeight);
            
            doc.setLineDashPattern([], 0);
            doc.setDrawColor(0);

            // Save PDF
            doc.save(`tags-${order.orderNumber}-${Date.now()}.pdf`);
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            alert("Failed to generate PDF. Please try again.");
        } finally {
            setDownloading(false);
        }
    };

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title={step === "select"
                ? t('plant.generateTags', 'Generate Tags')
                : t('plant.tagPreview', 'Tag Preview')
            }
            size="lg"
        >
            {step === "select" ? (
                /* Step 1: Select Tag Type */
                <div className="space-y-6">
                    <div className="flex gap-4">
                        <button
                            onClick={() => setTagType("basket")}
                            className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${tagType === "basket"
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border hover:bg-muted"
                                }`}
                        >
                            <ShoppingBag className="h-8 w-8" />
                            <span className="font-medium">{t('plant.basketTag', 'Basket Tag')}</span>
                            <span className="text-xs text-muted-foreground text-center">
                                Single tag for the whole bag
                            </span>
                        </button>
                        <button
                            onClick={() => setTagType("items")}
                            className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${tagType === "items"
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border hover:bg-muted"
                                }`}
                        >
                            <Tag className="h-8 w-8" />
                            <span className="font-medium">{t('plant.itemTags', 'Item Tags')}</span>
                            <span className="text-xs text-muted-foreground text-center">
                                {totalQuantity} tags (one per garment)
                            </span>
                        </button>
                    </div>

                    {/* Label format: Standard vs Roll (image size) */}
                    <div className="space-y-2">
                        <span className="text-sm font-medium text-foreground">{t('plant.labelFormat', 'Label format')}</span>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setLabelFormat("standard")}
                                className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-left ${labelFormat === "standard"
                                    ? "border-primary bg-primary/5 text-primary"
                                    : "border-border hover:bg-muted"
                                    }`}
                            >
                                <span className="font-medium text-sm">{t('plant.option1Standard', 'Option 1: Standard')}</span>
                                <span className="text-xs text-muted-foreground">80mm width, one tag per block</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setLabelFormat("roll")}
                                className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-left ${labelFormat === "roll"
                                    ? "border-primary bg-primary/5 text-primary"
                                    : "border-border hover:bg-muted"
                                    }`}
                            >
                                <span className="font-medium text-sm">{t('plant.option2Roll', 'Option 2: Roll labels')}</span>
                                <span className="text-xs text-muted-foreground">50mm×100mm paper, 15mm×100mm tags, 3 per row</span>
                            </button>
                        </div>
                    </div>

                    {/* Order Info Summary */}
                    <div className="bg-muted/30 p-4 rounded-lg">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Order:</span>
                            <span className="font-bold">{order.orderNumber}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Customer:</span>
                            <span>{order.customerName}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Items:</span>
                            <span className="font-bold">{totalQuantity}</span>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <LButton variant="outline" onClick={onClose}>
                            {t('common.cancel', 'Cancel')}
                        </LButton>
                        <LButton onClick={generatePreviews} disabled={generating}>
                            {generating ? t('common.loading', 'Loading...') : t('plant.generatePreview', 'Generate Preview')}
                        </LButton>
                    </div>
                </div>
            ) : (
                /* Step 2: Preview with QR Codes */
                <div className="space-y-4">
                    {/* Back Button */}
                    <button
                        onClick={() => setStep("select")}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        {t('common.back', 'Back')}
                    </button>

                    {/* Scrollable Preview Area */}
                    <div className="max-h-[60vh] overflow-y-auto border border-border rounded-lg bg-gray-100 p-4">
                        <div ref={printRef} className="space-y-4 flex flex-col items-center">
                            {labelFormat === "roll" ? (
                                /* Roll labels: 50mm×100mm paper, 15mm×100mm tags, 3 per row */
                                /* Preview scaled to fit in modal - actual print is exact mm sizes */
                                <div className="inline-block origin-top-left overflow-auto" style={{ transform: 'scale(1.5)' }}>
                                <div
                                    className="roll-print bg-white"
                                    style={{ width: ROLL_PAPER_WIDTH_MM + 'mm' }}
                                >
                                    {tagType === "basket" ? (
                                        /* Single basket tag row */
                                        <div className="roll-row flex flex-nowrap" style={{ width: ROLL_PAPER_WIDTH_MM + 'mm', height: ROLL_PAPER_HEIGHT_MM + 'mm' }}>
                                            <div style={{ width: ROLL_GAP_MM + 'mm' }} />
                                            {/* Basket Tag */}
                                            <div className="roll-tag border border-border flex flex-col shrink-0" style={{ width: ROLL_TAG_WIDTH_MM + 'mm', height: ROLL_TAG_HEIGHT_MM + 'mm' }}>
                                                <div className="tag-print-area flex flex-col" style={{ height: ROLL_TAG_PRINT_HEIGHT_MM + 'mm' }}>
                                                    <div className="tag-top-half flex flex-col items-center justify-start pt-1 border-b border-dashed border-gray-300" style={{ height: ROLL_HALF_HEIGHT_MM + 'mm' }}>
                                                        <span className="text-[5pt] font-bold">{order.orderNumber}</span>
                                                        <span className="text-[9pt] font-bold">BASKET</span>
                                                        <img src={basketQr} alt="QR" style={{ width: ROLL_QR_SIZE_MM + 'mm', height: ROLL_QR_SIZE_MM + 'mm' }} />
                                                    </div>
                                                    <div className="tag-bottom-half flex flex-row" style={{ height: ROLL_HALF_HEIGHT_MM + 'mm' }}>
                                                        <div className="flex-1 flex items-center justify-center text-[5pt] font-bold" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{order.customerName}</div>
                                                        <div className="flex-1 flex items-center justify-center text-[5pt]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{totalQuantity} items</div>
                                                        <div className="flex-1 flex items-center justify-center text-[5pt] font-bold" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{order.orderNumber}</div>
                                                    </div>
                                                </div>
                                                <div className="tag-tail border-t border-dashed border-gray-300" style={{ height: ROLL_TAG_TAIL_MM + 'mm' }} />
                                            </div>
                                            <div style={{ width: ROLL_GAP_MM + 'mm' }} />
                                            {/* Empty placeholders */}
                                            <div className="roll-tag border border-dashed border-gray-300 bg-gray-50 shrink-0" style={{ width: ROLL_TAG_WIDTH_MM + 'mm', height: ROLL_TAG_HEIGHT_MM + 'mm' }} />
                                            <div style={{ width: ROLL_GAP_MM + 'mm' }} />
                                            <div className="roll-tag border border-dashed border-gray-300 bg-gray-50 shrink-0" style={{ width: ROLL_TAG_WIDTH_MM + 'mm', height: ROLL_TAG_HEIGHT_MM + 'mm' }} />
                                            <div style={{ width: ROLL_GAP_MM + 'mm' }} />
                                        </div>
                                    ) : (
                                        /* Item tags - 3 per row */
                                        tagRows.map((rowTags, rowIdx) => (
                                            <div key={rowIdx} className="roll-row flex flex-nowrap" style={{ width: ROLL_PAPER_WIDTH_MM + 'mm', height: ROLL_PAPER_HEIGHT_MM + 'mm' }}>
                                                <div style={{ width: ROLL_GAP_MM + 'mm' }} />
                                                {rowTags.map((tag) => (
                                                    <div key={tag.index} className="contents">
                                                        <div className="roll-tag border border-border flex flex-col shrink-0" style={{ width: ROLL_TAG_WIDTH_MM + 'mm', height: ROLL_TAG_HEIGHT_MM + 'mm' }}>
                                                            <div className="tag-print-area flex flex-col" style={{ height: ROLL_TAG_PRINT_HEIGHT_MM + 'mm' }}>
                                                                <div className="tag-top-half flex flex-col items-center justify-start pt-1 border-b border-dashed border-gray-300" style={{ height: ROLL_HALF_HEIGHT_MM + 'mm' }}>
                                                                    <span className="text-[5pt] font-bold">{order.orderNumber}</span>
                                                                    <span className="text-[9pt] font-bold">{tag.index}/{tag.total}</span>
                                                                    <img src={tag.qrDataUrl} alt="QR" style={{ width: ROLL_QR_SIZE_MM + 'mm', height: ROLL_QR_SIZE_MM + 'mm' }} />
                                                                </div>
                                                                <div className="tag-bottom-half flex flex-row" style={{ height: ROLL_HALF_HEIGHT_MM + 'mm' }}>
                                                                    <div className="flex-1 flex items-center justify-center text-[5pt] font-bold overflow-hidden" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{tag.name}</div>
                                                                    <div className="flex-1 flex items-center justify-center text-[5pt] overflow-hidden" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Del:{tag.deliveryDate}</div>
                                                                    <div className="flex-1 flex items-center justify-center text-[5pt] font-bold overflow-hidden" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{order.orderNumber}</div>
                                                                </div>
                                                            </div>
                                                            <div className="tag-tail border-t border-dashed border-gray-300" style={{ height: ROLL_TAG_TAIL_MM + 'mm' }} />
                                                        </div>
                                                        <div style={{ width: ROLL_GAP_MM + 'mm' }} />
                                                    </div>
                                                ))}
                                                {/* Empty placeholders for incomplete rows */}
                                                {Array.from({ length: ROLL_TAGS_PER_ROW - rowTags.length }).map((_, i) => (
                                                    <div key={`empty-${i}`} className="contents">
                                                        <div className="roll-tag border border-dashed border-gray-300 bg-gray-50 shrink-0" style={{ width: ROLL_TAG_WIDTH_MM + 'mm', height: ROLL_TAG_HEIGHT_MM + 'mm' }} />
                                                        <div style={{ width: ROLL_GAP_MM + 'mm' }} />
                                                    </div>
                                                ))}
                                            </div>
                                        ))
                                    )}
                                </div>
                                </div>
                            ) : tagType === "basket" ? (
                                /* Standard: Basket Tag Preview */
                                <div className="tag bg-white border-2 border-black p-4 w-[280px]">
                                    <div className="header text-center font-bold border-b border-dashed border-black pb-2 mb-2">
                                        {displayName}
                                    </div>
                                    <div className="row flex justify-between text-sm mb-1">
                                        <span className="label font-bold">Order #:</span>
                                        <span>{order.orderNumber}</span>
                                    </div>
                                    <div className="row flex justify-between text-sm mb-1">
                                        <span className="label font-bold">Customer:</span>
                                        <span>{order.customerName}</span>
                                    </div>
                                    <div className="row flex justify-between text-sm mb-1">
                                        <span className="label font-bold">Date:</span>
                                        <span>{order.createdAt?.toDate ? format(order.createdAt.toDate(), "dd MMM") : "N/A"}</span>
                                    </div>
                                    <div className="row flex justify-between text-sm mb-1">
                                        <span className="label font-bold">Items:</span>
                                        <span className="item-count text-lg font-bold">{totalQuantity}</span>
                                    </div>
                                    <div className="qr flex justify-center my-3">
                                        <img src={basketQr} alt="QR Code" className="w-24 h-24" />
                                    </div>
                                    <div className="footer text-center text-xs border-t border-dashed border-black pt-2">
                                        BASKET TAG
                                    </div>
                                </div>
                            ) : (
                                /* Standard: Item Tags Preview */
                                generatedTags.map((tag, idx) => (
                                    <div key={idx} className="tag bg-white border-2 border-black p-4 w-[280px]">
                                        <div className="header text-center font-bold border-b border-dashed border-black pb-2 mb-2">
                                            {displayName}
                                            <div className="order-num text-xs font-normal">{order.orderNumber}</div>
                                        </div>
                                        <div className="item-name text-center font-bold text-sm my-2">
                                            {tag.name}
                                        </div>
                                        <div className="qr flex justify-center my-2">
                                            <img src={tag.qrDataUrl} alt="QR Code" className="w-20 h-20" />
                                        </div>
                                        <div className="item-index text-center text-2xl font-black my-2">
                                            {tag.index} / {tag.total}
                                        </div>
                                        <div className="footer text-center text-xs border-t border-dashed border-black pt-2">
                                            {order.customerName} • {format(new Date(), "dd/MM")}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Tag Count Info */}
                    <p className="text-center text-sm text-muted-foreground">
                        {tagType === "basket"
                            ? "1 tag ready"
                            : labelFormat === "roll"
                                ? `${generatedTags.length} tags (3 per row on 50mm×100mm paper)`
                                : `${generatedTags.length} tags ready`
                        }
                    </p>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 pt-2">
                        <LButton variant="outline" onClick={onClose}>
                            {t('common.cancel', 'Cancel')}
                        </LButton>
                        <LButton variant="outline" onClick={handleDownload} disabled={downloading} className="gap-2">
                            <Download className="h-4 w-4" />
                            {downloading ? t('common.loading', 'Loading...') : t('plant.downloadPdf', 'Download PDF')}
                        </LButton>
                        <LButton onClick={handlePrint} className="gap-2">
                            <Printer className="h-4 w-4" />
                            {t('plant.print', 'Print')}
                        </LButton>
                    </div>
                </div>
            )}
        </LResponsiveDialog>
    );
}
