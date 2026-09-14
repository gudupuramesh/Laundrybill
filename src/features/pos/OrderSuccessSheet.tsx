/**
 * Order Success Sheet
 * 
 * Shown after successful order creation with:
 * - Order confirmation
 * - Print/Download receipt button
 * - WhatsApp share with comprehensive order details
 * - Track order link
 */

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { TagGeneratorModal } from "@/features/plant-app/components/TagGeneratorModal";
import { useOrder } from "@/hooks/use-orders";
import { useShop } from "@/hooks/use-shop";
import { getReceiptBlob, getReceiptFileName, getThermalReceiptBlob } from "@/lib/generateReceipt";
import { isAndroidPrintEnv } from "@/lib/receipt-print";
import { useReceiptPrint } from "@/context/ReceiptPrintContext";
import { shareReceiptViaWhatsApp, shareReceiptPdfViaWhatsApp } from "@/lib/whatsappShare";
import { useCurrency } from "@/hooks/use-currency";
import { mapLegacyDeliveryType } from "@/types/order";
import { Check, MessageCircle, ExternalLink, Printer, PlusCircle, FileText, Link2 } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";


interface OrderSuccessSheetProps {
    open: boolean;
    onClose: () => void;
    orderId: string;
    onViewOrder: () => void;
}



export function OrderSuccessSheet({
    open,
    onClose,
    orderId,
    onViewOrder,
}: OrderSuccessSheetProps) {
    const { t } = useTranslation();
    const { order, loading } = useOrder(orderId);
    const { shop } = useShop();
    const { currencySymbol, formatAmount } = useCurrency();
    const { triggerReceiptPrint } = useReceiptPrint();
    const [sharing, setSharing] = useState(false);
    const [sharingPdf, setSharingPdf] = useState(false);

    // Generate tracking URL (publicId is now globally unique with shopCode prefix)
    const trackingUrl = `${window.location.origin}/track/${order?.publicId || ""}`;


    // Get shop info for receipt generation
    const getShopInfo = () => {
        if (!shop) return { name: "LaundryBill" };
        const location = shop.location;
        return {
            name: shop.name || "LaundryBill",
            phone: shop.phone,
            address: location?.address
                ? `${location.address}, ${location.city || ""} ${location.pincode || ""}`
                : undefined,
            gstNumber: shop.gstNumber,
            countryCode: shop.settings?.countryCode,
            currencySymbol,
            currencyCode: shop.settings?.currency,
            receiptTerms: shop.settings?.receiptTerms,
            showTracking: shop.settings?.trackingEnabled !== false,
            logoUrl: shop.settings?.receiptShowLogo === false ? undefined : shop.logo,
            upiId: shop.bankDetails?.upiId,
            paymentLink: shop.bankDetails?.paymentLink,
            showPaymentQr: shop.settings?.receiptPaymentQr !== false,
        };
    };

    // Handle print receipt (Android: window.print() for native dialog; else PDF in new tab)
    const handlePrintReceipt = async (format: "a4" | "thermal" = "a4") => {
        if (!order || !shop) return;

        const shopInfo = getShopInfo();
        if (format === "a4" && isAndroidPrintEnv()) {
            triggerReceiptPrint(order, {
                name: shopInfo.name,
                address: shopInfo.address,
                phone: shopInfo.phone,
                gstNumber: shopInfo.gstNumber,
                countryCode: shopInfo.countryCode,
                receiptTerms: shopInfo.receiptTerms,
                showTracking: shopInfo.showTracking,
                logoUrl: shopInfo.logoUrl,
                upiId: shopInfo.upiId,
                paymentLink: shopInfo.paymentLink,
                showPaymentQr: shopInfo.showPaymentQr,
            });
            return;
        }

        // Open the tab synchronously (before any await) so popup blockers allow it.
        const previewWindow = window.open("", "_blank");
        try {
            const blob = format === "thermal" ? await getThermalReceiptBlob(order, shopInfo) : await getReceiptBlob(order, shopInfo);
            const url = URL.createObjectURL(blob);
            if (previewWindow) previewWindow.location.href = url; else window.open(url, "_blank");
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (error) {
            previewWindow?.close();
            console.error("Failed to generate receipt:", error);
        }
    };

    // Handle WhatsApp share with PDF file attachment
    const handleWhatsAppShare = async () => {
        if (!order || !shop) return;

        await shareReceiptViaWhatsApp({
            order,
            shop,
            currencySymbol,
            onStart: () => setSharing(true),
            onComplete: () => setSharing(false),
            onError: () => setSharing(false),
        });
    };

    // Share the actual PDF bill to WhatsApp (share sheet on phones; download + chat on desktop)
    const handleWhatsAppPdfShare = async () => {
        if (!order || !shop) return;
        setSharingPdf(true);
        try {
            const blob = await getReceiptBlob(order, getShopInfo());
            await shareReceiptPdfViaWhatsApp({ order, shop, blob, fileName: getReceiptFileName(order) });
        } catch (e) {
            console.error("WhatsApp PDF share failed:", e);
        }
        setSharingPdf(false);
    };

    // Handle open tracking link
    const handleOpenTracking = () => {
        window.open(trackingUrl, "_blank");
    };

    const [copied, setCopied] = useState(false);
    const [tagOpen, setTagOpen] = useState(false);
    const handleCopyTracking = async () => {
        try {
            await navigator.clipboard.writeText(trackingUrl);
        } catch {
            // Clipboard API blocked (insecure context) — fall back to a hidden field.
            const ta = document.createElement("textarea");
            ta.value = trackingUrl; document.body.appendChild(ta); ta.select();
            try { document.execCommand("copy"); } catch { /* ignore */ }
            ta.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Esc closes (same as starting a new order).
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !tagOpen) onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose, tagOpen]);

    if (!open || loading || !order) {
        return null;
    }

    const itemCount = order.items?.length || 0;
    const paidAmt = order.financials.amountPaid || 0;
    const balance = Math.max(0, order.financials.balance ?? (order.financials.total - paidAmt));
    const method = paidAmt > 0 ? String(order.payments?.[0]?.method || order.paymentMethod || "cash") : "";
    const methodLabel = method === "upi" ? "UPI" : method ? method.charAt(0).toUpperCase() + method.slice(1) : "";
    const deliveryType = mapLegacyDeliveryType(order.deliveryType);
    const firstItem = order.items?.[0];
    const firstItemLabel = firstItem
        ? `${firstItem.serviceName}${firstItem.unit && /kg/i.test(firstItem.unit) ? ` ${firstItem.quantity} kg` : firstItem.quantity > 1 ? ` × ${firstItem.quantity}` : ""}`
        : "";
    const trackingOn = shop?.settings?.trackingEnabled !== false;

    const outBtn: React.CSSProperties = { cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, font: "inherit", fontSize: 14.5, fontWeight: 500, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 11, padding: "14px 12px", whiteSpace: "nowrap" };
    const statCol: React.CSSProperties = { flex: 1, textAlign: "center", padding: "4px 8px" };
    const statLbl: React.CSSProperties = { fontSize: 14.5, color: "var(--ds-text)" };
    const DOTS = [[-78, -30], [-62, 6], [-44, -52], [60, -46], [78, -18], [66, 22], [-70, 40], [48, 44]];

    return (
        <div className="lb-ds" role="dialog" aria-modal="true" aria-label={t("checkout.orderPlaced", "Order placed")}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(17,24,39,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}>
            <div style={{ width: "100%", maxWidth: 570, background: "var(--ds-card)", borderRadius: 18, boxShadow: "0 24px 64px rgba(16,24,40,.24)", padding: "36px 26px 30px", margin: "auto" }}>
                {/* check + dots */}
                <div style={{ position: "relative", width: 84, height: 84, margin: "0 auto" }}>
                    {DOTS.map(([x, y], i) => (
                        <span key={i} style={{ position: "absolute", left: 42 + x - 2.5, top: 42 + y - 2.5, width: 5, height: 5, borderRadius: "50%", background: "var(--ds-tile-green)", opacity: 0.55 }} />
                    ))}
                    <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#22C55E", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={44} strokeWidth={3} /></span>
                </div>

                <div style={{ textAlign: "center", marginTop: 20 }}>
                    <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-.02em" }}>{t("checkout.orderPlaced", "Order placed")}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 44, fontWeight: 700, letterSpacing: ".01em", marginTop: 6, lineHeight: 1.15 }}>{order.publicId}</div>
                    <div style={{ fontSize: 15.5, color: "var(--ds-text-2)", marginTop: 10, display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "4px 12px" }}>
                        <span>{order.customerName}</span><span>·</span>
                        <span>{itemCount} {itemCount === 1 ? t("checkout.itemSingular", "item") : t("checkout.itemsPlural", "items")}</span>
                        {order.expectedDelivery && <><span>·</span><span>{deliveryType === "pickup_store" ? t("checkout.expectedReadyLbl", "Expected ready") : t("checkout.expectedBy", "Expected by")} {format(order.expectedDelivery.toDate(), "EEE d MMM")}</span></>}
                    </div>
                </div>

                {/* totals strip */}
                <div style={{ display: "flex", alignItems: "stretch", marginTop: 26, border: "1px solid var(--ds-border)", borderRadius: 12, padding: "16px 6px" }}>
                    <div style={statCol}>
                        <div style={statLbl}>{t("pos.total", "Total")}</div>
                        <div style={{ fontSize: 22, fontWeight: 600, marginTop: 8 }}>{formatAmount(order.financials.total)}</div>
                    </div>
                    <div style={{ ...statCol, borderLeft: "1px solid var(--ds-divider)", borderRight: "1px solid var(--ds-divider)" }}>
                        <div style={statLbl}>{t("orders.paid", "Paid")}</div>
                        <div style={{ fontSize: 22, fontWeight: 600, marginTop: 8, color: paidAmt > 0 ? "var(--ds-tile-green)" : "var(--ds-text-2)" }}>
                            {formatAmount(paidAmt)}{methodLabel && <span style={{ fontSize: 16, fontWeight: 500, color: "var(--ds-text)" }}> · {methodLabel}</span>}
                        </div>
                    </div>
                    <div style={statCol}>
                        <div style={statLbl}>{t("checkout.balance", "Balance")}</div>
                        <div style={{ fontSize: 22, fontWeight: 600, marginTop: 8, color: balance > 0 ? "var(--ds-negative)" : "var(--ds-tile-green)" }}>{formatAmount(balance)}</div>
                    </div>
                </div>

                {/* tag */}
                <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 16, border: "1px solid var(--ds-border)", borderRadius: 12, padding: "14px 14px" }}>
                    <span style={{ flex: "none", display: "flex" }}><QRCodeSVG value={order.id} size={60} /></span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14, display: "flex", flexWrap: "wrap", gap: "2px 10px", alignItems: "center" }}>
                        <b style={{ fontWeight: 600 }}>{order.publicId}</b><span>·</span>
                        <span style={{ fontWeight: 500 }}>{order.customerName}</span>
                        {firstItemLabel && <><span>·</span><span style={{ color: "var(--ds-text-2)" }}>{firstItemLabel}{itemCount > 1 ? ` +${itemCount - 1}` : ""}</span></>}
                    </span>
                    <button onClick={() => setTagOpen(true)} style={{ flex: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, font: "inherit", fontSize: 14, fontWeight: 600, color: "var(--ds-blue)", background: "var(--ds-card)", border: "1px solid var(--ds-blue)", borderRadius: 10, padding: "10px 14px" }}>
                        <Printer size={17} />{t("orders.printTags", "Print tag")}
                    </button>
                </div>

                {/* print + share */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 22 }}>
                    <button onClick={() => handlePrintReceipt("a4")} style={outBtn}><Printer size={18} />{t("checkout.printReceiptA4", "Print receipt A4")}</button>
                    <button onClick={() => handlePrintReceipt("thermal")} title={t("orders.printThermalHint", "POS thermal printer receipt (80mm roll)")} style={outBtn}><Printer size={18} />{t("checkout.print80", "Print 80 mm")}</button>
                    <button onClick={handleWhatsAppShare} disabled={sharing} style={{ ...outBtn, color: "var(--ds-whatsapp)", opacity: sharing ? 0.6 : 1 }}><MessageCircle size={18} />{t("checkout.whatsappBill", "WhatsApp bill")}</button>
                    {trackingOn && (
                        <button onClick={handleCopyTracking} style={outBtn}><Link2 size={18} />{copied ? t("checkout.linkCopied", "Link copied") : t("checkout.copyTracking", "Copy tracking link")}</button>
                    )}
                    <button onClick={handleWhatsAppPdfShare} disabled={sharingPdf} title={t("checkout.shareWhatsAppPdfHint", "Send the PDF bill on WhatsApp — on desktop it downloads and opens the chat to attach")}
                        style={{ ...outBtn, opacity: sharingPdf ? 0.6 : 1 }}><FileText size={18} />{t("checkout.pdfBill", "PDF bill")}</button>
                    {trackingOn && (
                        <button onClick={handleOpenTracking} style={outBtn}><ExternalLink size={18} />{t("checkout.openTracking", "Open tracking")}</button>
                    )}
                </div>

                {/* primary actions */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 30 }}>
                    <button onClick={onClose} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, font: "inherit", fontSize: 17, fontWeight: 600, color: "#fff", background: "var(--ds-blue)", border: "1px solid var(--ds-blue)", borderRadius: 12, padding: "17px 14px" }}>
                        <PlusCircle size={22} />{t("pos.newOrder", "New order")}
                    </button>
                    <button onClick={onViewOrder} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, font: "inherit", fontSize: 17, fontWeight: 600, color: "var(--ds-blue)", background: "var(--ds-card)", border: "1px solid var(--ds-blue)", borderRadius: 12, padding: "17px 14px" }}>
                        <FileText size={21} />{t("checkout.viewOrder", "View order")}
                    </button>
                </div>
            </div>
            {tagOpen && <TagGeneratorModal open={tagOpen} onClose={() => setTagOpen(false)} order={order} />}
        </div>
    );
}
