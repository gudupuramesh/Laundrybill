import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Order } from "@/types/order";
import { useShop } from "@/hooks/use-shop";
import { LResponsiveDialog } from "@/components/laundry";
import { Tag, ShoppingBag, ArrowLeft, Download, Printer, QrCode as QrCodeIcon, Barcode as BarcodeIcon } from "lucide-react";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface TagGeneratorModalProps {
    open: boolean;
    onClose: () => void;
    order: Order;
}

// "basket" = one tag PER SERVICE (service name + qty); "items" = one tag per garment.
type TagType = "basket" | "items";
type Step = "select" | "preview";
// Code style — QR (default) or Code128 barcode, shared with the apps via settings.tagStyle.
type TagCodeStyle = "qr" | "barcode";

/**
 * Code128 barcode as a PNG data URL — rendered by the same bwip-js service the
 * owner/Team apps use, so labels look identical everywhere. The PNG carries the
 * human-readable value under the bars. Needs the network (like the apps).
 */
async function barcodeDataUrl(value: string): Promise<string> {
    const url = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(value)}&scale=3&height=10&includetext&textsize=11&paddingwidth=6&paddingheight=4&backgroundcolor=ffffff`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Barcode render failed (${res.status})`);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Barcode read failed"));
        r.readAsDataURL(blob);
    });
}

// ============================================================
// Single fixed label size — 50mm wide × 60mm tall, one tag per page.
// The PDF is exported at exactly these page dimensions so an external
// print app prints it 1:1 (it never reflows onto A4/Letter).
// ============================================================
const TAG_W_MM = 50;         // label width
const TAG_H_MM = 60;         // QR label height
const TAG_H_BARCODE_MM = 30; // barcode labels are half-height — tighter layout (matches the apps)
const QR_MM = 32;            // QR code square inside the label
const BARCODE_W_MM = 44;     // barcode strip inside the label
const BARCODE_H_MM = 9;

// One garment tag — numbered within its own service (1/3, 2/3 …), not globally.
interface ItemTag {
    service: string;        // service name (e.g. "Wash & Fold")
    idxInService: number;   // position within this service
    serviceTotal: number;   // total garments of this service
    imgDataUrl: string;     // QR = `${order.id}:${idx}`; barcode = `${publicId}:${idx}`
}

const truncate = (s: string, maxLen: number) => (s.length <= maxLen ? s : s.slice(0, maxLen - 1) + "…");
const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function TagGeneratorModal({ open, onClose, order }: TagGeneratorModalProps) {
    const { t } = useTranslation();
    const { shop } = useShop();
    const shopName = shop?.name || "LaundryBill";
    const [tagType, setTagType] = useState<TagType>("basket");
    const [step, setStep] = useState<Step>("select");
    const [generating, setGenerating] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [itemTags, setItemTags] = useState<ItemTag[]>([]);
    const [basketQr, setBasketQr] = useState<string>("");   // order-level code image (shared by every service tag)

    // Code style — QR (default) or Code128 barcode. Remembered per shop in
    // settings.tagStyle, the same field the owner/Team apps read and write.
    const [tagStyleOverride, setTagStyleOverride] = useState<TagCodeStyle | null>(null);
    const tagStyle: TagCodeStyle = tagStyleOverride ?? (shop?.settings?.tagStyle === "barcode" ? "barcode" : "qr");
    const isBarcode = tagStyle === "barcode";
    const tagH = isBarcode ? TAG_H_BARCODE_MM : TAG_H_MM;
    const setTagStyle = (style: TagCodeStyle) => {
        setTagStyleOverride(style);
        if (shop?.id) updateDoc(doc(db, "shops", shop.id), { "settings.tagStyle": style }).catch(() => { /* remember-per-shop is best-effort */ });
    };

    const totalQuantity = order.items?.reduce((acc, item) => acc + (item.quantity || 1), 0) || 0;
    const displayName = shopName || "LaundryBill";
    const customerName = order.customerName || "";

    // The "service" is the category (Wash & Fold / Iron / Dry Clean); serviceName is the garment.
    const svcOf = (it: { categoryName?: string }) => (it.categoryName || "").trim() || "Other";

    // Services grouped → one tag each (basket mode).
    const serviceList = Array.from(
        (order.items || []).reduce(
            (m, it) => m.set(svcOf(it), (m.get(svcOf(it)) || 0) + (it.quantity || 1)),
            new Map<string, number>(),
        ),
    ).map(([name, qty]) => ({ name, qty }));

    // Reset when modal opens/closes
    useEffect(() => {
        if (!open) {
            setStep("select");
            setItemTags([]);
            setBasketQr("");
        }
    }, [open]);

    // Generate QR codes when moving to preview step
    const generatePreviews = async () => {
        setGenerating(true);
        try {
            if (tagType === "basket") {
                // Every service tag carries the same order-level code (scan opens the order):
                // QR encodes the doc id; the barcode encodes the short order number — a doc
                // id makes an unscannably dense Code128 on a small label (same as the apps).
                const img = isBarcode
                    ? await barcodeDataUrl(order.publicId)
                    : await QRCode.toDataURL(order.id, { width: 320, margin: 1 });
                setBasketQr(img);
            } else {
                // Per-garment tags. QR keeps the global `orderId:index` payload (scan-compatible),
                // while the printed number is per-service (Wash 1/2, Iron 1/3 …).
                const serviceTotals = new Map<string, number>();
                (order.items || []).forEach((it) => serviceTotals.set(svcOf(it), (serviceTotals.get(svcOf(it)) || 0) + it.quantity));

                const tags: ItemTag[] = [];
                const perService = new Map<string, number>();
                let globalIdx = 0;
                for (const item of (order.items || [])) {
                    const svc = svcOf(item);
                    for (let i = 0; i < item.quantity; i++) {
                        globalIdx++;
                        const c = (perService.get(svc) || 0) + 1;
                        perService.set(svc, c);
                        const img = isBarcode
                            ? await barcodeDataUrl(`${order.publicId}:${globalIdx}`)
                            : await QRCode.toDataURL(`${order.id}:${globalIdx}`, { width: 320, margin: 1 });
                        tags.push({
                            service: svc,
                            idxInService: c,
                            serviceTotal: serviceTotals.get(svc) || item.quantity,
                            imgDataUrl: img,
                        });
                    }
                }
                setItemTags(tags);
            }
            setStep("preview");
        } catch (error) {
            console.error("Failed to generate tag codes:", error);
            alert(t("plant.tagGenFailed", "Could not generate the tags. Check your internet connection and try again."));
        } finally {
            setGenerating(false);
        }
    };

    // Unified rows to preview / export. Both layouts: shop · QR · service name · count line · order# · customer.
    type Row = { imgDataUrl: string; service: string; line2: string };
    const rows: Row[] = tagType === "basket"
        ? (basketQr ? serviceList.map((s) => ({ imgDataUrl: basketQr, service: s.name, line2: `${s.qty} ${s.qty === 1 ? t("orders.item", "item") : t("orders.items", "items")}` })) : [])
        : itemTags.map((it) => ({ imgDataUrl: it.imgDataUrl, service: it.service, line2: `${it.idxInService}/${it.serviceTotal}` }));

    // Download a PDF whose pages are exactly 50mm × 60mm (one tag per page).
    const handleDownload = async () => {
        if (rows.length === 0) return;
        setDownloading(true);
        try {
            // jsPDF normalizes pages to the orientation: a 50×30 label must be
            // declared landscape or jsPDF silently swaps it to 30×50.
            const pageOrient = isBarcode ? "landscape" as const : "portrait" as const;
            const doc = new jsPDF({ orientation: pageOrient, unit: "mm", format: [TAG_W_MM, tagH] });

            rows.forEach((row, i) => {
                if (i > 0) doc.addPage([TAG_W_MM, tagH], pageOrient);

                if (isBarcode) {
                    // Half-height barcode label — the apps' tighter 50×30 layout.
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(6.5);
                    doc.text(displayName, TAG_W_MM / 2, 4, { align: "center", maxWidth: TAG_W_MM - 4 });
                    if (row.imgDataUrl) doc.addImage(row.imgDataUrl, "PNG", (TAG_W_MM - BARCODE_W_MM) / 2, 5.2, BARCODE_W_MM, BARCODE_H_MM);
                    doc.setFontSize(8.5);
                    doc.text(truncate(row.service, 22), TAG_W_MM / 2, 17.8, { align: "center", maxWidth: TAG_W_MM - 4 });
                    doc.setFontSize(8);
                    doc.text(row.line2, TAG_W_MM / 2, 21.2, { align: "center" });
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(6);
                    doc.text(`#${order.orderNumber}`, TAG_W_MM / 2, 24.4, { align: "center" });
                    if (customerName) doc.text(truncate(customerName, 30), TAG_W_MM / 2, 27.2, { align: "center", maxWidth: TAG_W_MM - 4 });
                    return;
                }

                // Shop name (top)
                doc.setFont("helvetica", "bold");
                doc.setFontSize(7.5);
                doc.text(displayName, TAG_W_MM / 2, 5.5, { align: "center", maxWidth: TAG_W_MM - 6 });

                // QR code (centered)
                const qrX = (TAG_W_MM - QR_MM) / 2;
                if (row.imgDataUrl) doc.addImage(row.imgDataUrl, "PNG", qrX, 7.5, QR_MM, QR_MM);

                // Service name (title)
                doc.setFont("helvetica", "bold");
                doc.setFontSize(11);
                doc.text(truncate(row.service, 22), TAG_W_MM / 2, 43.5, { align: "center", maxWidth: TAG_W_MM - 4 });

                // Count line — "3 items" (service tag) or "1/3" (item tag)
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.text(row.line2, TAG_W_MM / 2, 48, { align: "center" });

                // Order number
                doc.setFont("helvetica", "normal");
                doc.setFontSize(7.5);
                doc.text(`#${order.orderNumber}`, TAG_W_MM / 2, 52, { align: "center" });

                // Customer
                if (customerName) {
                    doc.setFontSize(7.5);
                    doc.text(truncate(customerName, 30), TAG_W_MM / 2, 55.5, { align: "center", maxWidth: TAG_W_MM - 4 });
                }
            });

            doc.save(`tags-${order.orderNumber}-${Date.now()}.pdf`);
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            alert("Failed to generate PDF. Please try again.");
        } finally {
            setDownloading(false);
        }
    };

    // Print via the browser dialog — pages declared at exactly 50mm × 60mm.
    const handlePrint = () => {
        if (rows.length === 0) return;
        const tagsHtml = rows.map((row) => `
            <div class="tag">
                <div class="shop">${esc(displayName)}</div>
                ${row.imgDataUrl ? `<img class="qr" src="${row.imgDataUrl}" alt="code" />` : ""}
                <div class="title">${esc(truncate(row.service, 22))}</div>
                <div class="line2">${esc(row.line2)}</div>
                <div class="meta">#${esc(order.orderNumber)}</div>
                ${customerName ? `<div class="meta">${esc(customerName)}</div>` : ""}
            </div>`).join("");
        // Barcode labels are half-height (30mm) with the apps' tighter type scale.
        const codeCss = isBarcode
            ? `.qr { width: ${BARCODE_W_MM}mm; height: ${BARCODE_H_MM}mm; object-fit: contain; margin-top: 1mm; }`
            : `.qr { width: ${QR_MM}mm; height: ${QR_MM}mm; margin-top: 1.5mm; }`;
        const pad = isBarcode ? 2 : 3;
        const shopPt = isBarcode ? 6.5 : 7.5;
        const titlePt = isBarcode ? 8.5 : 11;
        const line2Pt = isBarcode ? 8 : 10;
        const metaPt = isBarcode ? 6 : 7.5;
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Tags ${esc(order.orderNumber)}</title><style>
            @page { size: 50mm ${tagH}mm; margin: 0; }
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
            html, body { margin: 0; padding: 0; background: #fff; }
            /* No fixed .tag height: a full-page-height box + page-break-after can emit a blank
               page after every tag. Letting content flow + break between tags = one label per page. */
            .tag { width: 50mm; padding: ${pad}mm; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; text-align: center; overflow: hidden; page-break-after: always; break-after: page; }
            .tag:last-child { page-break-after: auto; break-after: auto; }
            .shop { font-size: ${shopPt}pt; font-weight: 700; line-height: 1.1; }
            ${codeCss}
            .title { font-size: ${titlePt}pt; font-weight: 700; margin-top: ${isBarcode ? 0.5 : 1.5}mm; line-height: 1.1; }
            .line2 { font-size: ${line2Pt}pt; font-weight: 700; margin-top: 0.5mm; }
            .meta { font-size: ${metaPt}pt; color: #444; margin-top: 0.5mm; line-height: 1.2; }
        </style></head><body>${tagsHtml}<script>window.onload=function(){setTimeout(function(){window.print();},250);}<\/script></body></html>`;
        const w = window.open("", "_blank", "width=420,height=640");
        if (!w) { alert("Please allow pop-ups to print."); return; }
        w.document.write(html);
        w.document.close();
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
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    {/* Code style — QR or Code128 barcode, remembered per shop (settings.tagStyle, shared with the apps) */}
                    <div style={{ display: "flex", gap: 10 }}>
                        {([
                            { key: "qr" as TagCodeStyle, Icon: QrCodeIcon, label: t('plant.tagStyleQr', 'QR code') },
                            { key: "barcode" as TagCodeStyle, Icon: BarcodeIcon, label: t('plant.tagStyleBarcode', 'Barcode') },
                        ]).map(({ key, Icon, label }) => {
                            const on = tagStyle === key;
                            return (
                                <button key={key} type="button" onClick={() => setTagStyle(key)}
                                    style={{ flex: 1, cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 12px", borderRadius: 10, fontSize: 13.5, fontWeight: 700, border: `1.5px solid ${on ? "var(--c-primary)" : "var(--c-border)"}`, background: on ? "var(--c-primary-soft)" : "var(--c-surface)", color: on ? "var(--c-primary)" : "var(--c-text-2)" }}>
                                    <Icon size={17} />{label}
                                </button>
                            );
                        })}
                    </div>
                    <div style={{ display: "flex", gap: 14 }}>
                        {([
                            { key: "basket" as TagType, Icon: ShoppingBag, title: t('plant.serviceTags', 'Service Tags'), sub: `${serviceList.length} ${serviceList.length === 1 ? t('plant.tagOne', 'tag') : t('plant.tagMany', 'tags')} · ${t('plant.onePerService', 'one per service')}` },
                            { key: "items" as TagType, Icon: Tag, title: t('plant.itemTags', 'Item Tags'), sub: `${totalQuantity} ${t('plant.tagsPerGarment', 'tags (one per garment)')}` },
                        ]).map(({ key, Icon, title, sub }) => {
                            const on = tagType === key;
                            return (
                                <button key={key} type="button" onClick={() => setTagType(key)}
                                    style={{ flex: 1, cursor: "pointer", font: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "20px 12px", borderRadius: 14, border: `1.5px solid ${on ? "var(--c-primary)" : "var(--c-border)"}`, background: on ? "var(--c-primary-soft)" : "var(--c-surface)" }}>
                                    <Icon size={28} strokeWidth={1.7} style={{ color: on ? "var(--c-primary)" : "var(--c-text-3)" }} />
                                    <span style={{ fontSize: 16, fontWeight: 700, color: on ? "var(--c-primary)" : "var(--c-text)" }}>{title}</span>
                                    <span style={{ fontSize: 12, textAlign: "center", color: on ? "var(--c-primary)" : "var(--c-text-3)" }}>{sub}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Services in this order */}
                    {serviceList.length > 0 && (
                        <div style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 9 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", color: "var(--c-text-3)" }}>{t('plant.servicesInOrder', 'SERVICES IN THIS ORDER')}</span>
                            {serviceList.map((s) => (
                                <div key={s.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                                    <span style={{ fontFamily: "'IBM Plex Mono'", color: "var(--c-primary)", fontWeight: 700 }}>×{s.qty}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Fixed label size note */}
                    <div style={{ fontSize: 12.5, color: "var(--c-text-3)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 10, padding: "11px 14px" }}>
                        {t('plant.labelSizeNoteDyn', 'Labels are exported as a PDF at 50mm × {{h}}mm (one tag per page) — print at exact size from your label printer app.', { h: tagH })}
                    </div>

                    {/* Order Info Summary */}
                    <div style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "var(--c-text-3)" }}>{t('orders.order', 'Order')}:</span><span style={{ fontWeight: 700, fontFamily: "'IBM Plex Mono'" }}>{order.orderNumber}</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "var(--c-text-3)" }}>{t('customer.title', 'Customer')}:</span><span style={{ fontWeight: 600 }}>{order.customerName}</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "var(--c-text-3)" }}>{t('orders.items', 'Items')}:</span><span style={{ fontWeight: 700, fontFamily: "'IBM Plex Mono'", color: "var(--c-primary)" }}>{totalQuantity}</span></div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
                        <button type="button" onClick={onClose} style={{ cursor: "pointer", font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 10, padding: "10px 18px" }}>{t('common.cancel', 'Cancel')}</button>
                        <button type="button" onClick={generatePreviews} disabled={generating} style={{ cursor: generating ? "wait" : "pointer", font: "inherit", fontSize: 13.5, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 10, padding: "10px 18px", boxShadow: "var(--sh-sm)", opacity: generating ? 0.6 : 1 }}>{generating ? t('common.loading', 'Loading...') : t('plant.generatePreview', 'Generate Preview')}</button>
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

                    {/* Scrollable Preview Area — each card is the real 50mm × 60mm label */}
                    <div className="max-h-[60vh] overflow-y-auto border border-border rounded-lg bg-gray-100 p-4">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, justifyContent: "center" }}>
                            {rows.map((row, i) => (
                                <div key={i} style={{ width: TAG_W_MM + "mm", height: tagH + "mm", background: "#fff", border: "1px solid #000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: isBarcode ? "2mm" : "3mm", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.15)" }}>
                                    <div style={{ fontSize: isBarcode ? "6.5pt" : "7.5pt", fontWeight: 700, textAlign: "center", color: "#000", lineHeight: 1.1 }}>{displayName}</div>
                                    {row.imgDataUrl && (isBarcode
                                        ? <img src={row.imgDataUrl} alt="barcode" style={{ width: BARCODE_W_MM + "mm", height: BARCODE_H_MM + "mm", objectFit: "contain", marginTop: "1mm" }} />
                                        : <img src={row.imgDataUrl} alt="QR" style={{ width: QR_MM + "mm", height: QR_MM + "mm", marginTop: "1.5mm" }} />)}
                                    <div style={{ fontSize: isBarcode ? "8.5pt" : "11pt", fontWeight: 700, marginTop: isBarcode ? ".5mm" : "1.5mm", textAlign: "center", color: "#000", lineHeight: 1.1 }}>{truncate(row.service, 22)}</div>
                                    <div style={{ fontSize: isBarcode ? "8pt" : "10pt", fontWeight: 700, marginTop: ".5mm", textAlign: "center", color: "#000" }}>{row.line2}</div>
                                    <div style={{ fontSize: isBarcode ? "6pt" : "7.5pt", color: "#444", marginTop: ".5mm", textAlign: "center" }}>#{order.orderNumber}</div>
                                    {customerName && <div style={{ fontSize: isBarcode ? "6pt" : "7.5pt", color: "#444", textAlign: "center" }}>{customerName}</div>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tag Count Info */}
                    <p className="text-center text-sm text-muted-foreground">
                        {tagType === "basket"
                            ? `${rows.length} ${rows.length === 1 ? t('plant.serviceTagReady', 'service tag') : t('plant.serviceTagsReady', 'service tags')} · 50mm × ${tagH}mm`
                            : `${rows.length} ${t('plant.tagsReadyDyn', 'tags · 50mm × {{h}}mm each', { h: tagH })}`
                        }
                    </p>

                    {/* Action Buttons — Print (browser dialog) or Download the exact-size PDF */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4, flexWrap: "wrap" }}>
                        <button type="button" onClick={onClose} style={{ cursor: "pointer", font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 10, padding: "10px 18px" }}>{t('common.cancel', 'Cancel')}</button>
                        <button type="button" onClick={handleDownload} disabled={downloading} style={{ cursor: downloading ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 10, padding: "10px 18px", opacity: downloading ? 0.6 : 1 }}><Download size={16} />{downloading ? t('common.loading', 'Loading...') : t('plant.downloadPdf', 'Download PDF')}</button>
                        <button type="button" onClick={handlePrint} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 10, padding: "10px 18px", boxShadow: "var(--sh-sm)" }}><Printer size={16} />{t('plant.print', 'Print')}</button>
                    </div>
                </div>
            )}
        </LResponsiveDialog>
    );
}
