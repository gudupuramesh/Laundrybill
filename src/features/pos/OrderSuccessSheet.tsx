/**
 * Order Success Sheet
 * 
 * Shown after successful order creation with:
 * - Order confirmation
 * - Print/Download receipt button
 * - WhatsApp share with comprehensive order details
 * - Track order link
 */

import { useState } from "react";
import { LResponsiveDialog } from "@/components/laundry";
import { useOrder } from "@/hooks/use-orders";
import { useShop } from "@/hooks/use-shop";
import { getReceiptBlob, getReceiptFileName } from "@/lib/generateReceipt";
import { isAndroidPrintEnv } from "@/lib/receipt-print";
import { useReceiptPrint } from "@/context/ReceiptPrintContext";
import { shareReceiptViaWhatsApp } from "@/lib/whatsappShare";
import { useCurrency } from "@/hooks/use-currency";
import { mapLegacyDeliveryType } from "@/types/order";
import type { DeliveryType } from "@/types/order";
import {
    Check,
    MessageCircle,
    ExternalLink,
    Store,
    Truck,
    Home,
    Printer,
    ArrowRight,
    Plus,
} from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

const MONO = "'IBM Plex Mono'";

interface OrderSuccessSheetProps {
    open: boolean;
    onClose: () => void;
    orderId: string;
    onViewOrder: () => void;
}



const DELIVERY_TYPE_ICONS: Record<DeliveryType, typeof Store> = {
    pickup_store: Store,
    delivery_home: Truck,
    pickup_home: Home,
};

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
            currencySymbol,
            currencyCode: shop.settings?.currency,
        };
    };

    // Handle print receipt (Android: window.print() for native dialog; else PDF in new tab)
    const handlePrintReceipt = () => {
        if (!order || !shop) return;

        const shopInfo = getShopInfo();
        if (isAndroidPrintEnv()) {
            triggerReceiptPrint(order, {
                name: shopInfo.name,
                address: shopInfo.address,
                phone: shopInfo.phone,
            });
            return;
        }

        try {
            const blob = getReceiptBlob(order, shopInfo);
            const url = URL.createObjectURL(blob);
            const previewWindow = window.open(url, "_blank");
            if (previewWindow) {
                previewWindow.document.title = getReceiptFileName(order);
            }
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (error) {
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

    // Handle open tracking link
    const handleOpenTracking = () => {
        window.open(trackingUrl, "_blank");
    };

    if (loading || !order) {
        return null;
    }

    const deliveryType = mapLegacyDeliveryType(order.deliveryType);
    const DeliveryIcon = DELIVERY_TYPE_ICONS[deliveryType];
    const deliveryLabel = deliveryType === "pickup_store" ? t("orders.shopPickup", "Shop Pickup")
        : deliveryType === "delivery_home" ? t("orders.homeDelivery", "Home Delivery")
        : t("orders.pickupFromHome", "Pickup from Home");
    const anyExpress = order.items?.some((i) => i.express);
    const itemCount = order.items?.length || 0;
    const paid = order.financials.balance <= 0;

    const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", fontSize: 13.5 };
    const rowLbl: React.CSSProperties = { color: "var(--c-text-3)" };
    const ghostBtn: React.CSSProperties = { flex: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 10, padding: 11 };

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title=""
            size="sm"
            snapPoints={[0.9]}
        >
            <div style={{ width: "100%", maxWidth: 440, margin: "0 auto" }}>
                {/* header */}
                <div style={{ padding: "28px 8px 24px", textAlign: "center", borderBottom: "1px solid var(--c-border)" }}>
                    <span style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--c-success-soft)", color: "var(--c-success)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Check size={38} strokeWidth={2.6} /></span>
                    <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.01em", marginTop: 16 }}>{t("checkout.orderPlaced", "Order placed")}</div>
                    <div style={{ fontSize: 13.5, color: "var(--c-text-3)", marginTop: 5 }}>{t("checkout.orderConfirmation", "The order has been created and queued for processing.")}</div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16, padding: "8px 14px", background: "var(--c-surface-2)", borderRadius: 10 }}>
                        <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>{t("orders.orderId", "Order")}</span>
                        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 15 }}>#{order.publicId}</span>
                    </div>
                </div>

                {/* detail rows */}
                <div style={{ padding: "20px 4px", display: "flex", flexDirection: "column", gap: 11 }}>
                    <div style={row}><span style={rowLbl}>{t("customer.details", "Customer")}</span><span style={{ fontWeight: 600 }}>{order.customerName}</span></div>
                    <div style={row}><span style={rowLbl}>{t("orders.items", "Items")}</span><span style={{ fontWeight: 600, fontFamily: MONO }}>{itemCount}</span></div>
                    <div style={row}><span style={rowLbl}>{t("orders.orderType", "Fulfilment")}</span><span style={{ fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}><DeliveryIcon size={15} style={{ color: "var(--c-primary)" }} />{deliveryLabel}</span></div>
                    {anyExpress && <div style={row}><span style={rowLbl}>{t("checkout.priority", "Priority")}</span><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, color: "var(--c-warning)" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-warning)" }} />{t("pos.express", "Express")}</span></div>}
                    <div style={row}><span style={rowLbl}>{t("checkout.payment", "Payment")}</span><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, color: paid ? "var(--c-success)" : "var(--c-error)" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: paid ? "var(--c-success)" : "var(--c-error)" }} />{paid ? t("checkout.paidInFull", "Paid in full") : `${t("orders.balanceDue", "Balance")}: ${currencySymbol}${order.financials.balance}`}</span></div>
                    {order.expectedDelivery && (
                        <div style={row}><span style={rowLbl}>{deliveryType === "pickup_store" ? t("orders.readyBy", "Ready by") : t("orders.expectedBy", "Expected by")}</span><span style={{ fontWeight: 600 }}>{format(order.expectedDelivery.toDate(), "EEE, dd MMM")}</span></div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid var(--c-border)" }}><span style={{ fontWeight: 700 }}>{t("pos.total", "Total")}</span><span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 19 }}>{formatAmount(order.financials.total)}</span></div>
                </div>

                {/* actions */}
                <div style={{ padding: "6px 4px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
                    <button onClick={onClose} style={{ width: "100%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, font: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 11, padding: 14 }}><Plus size={17} />{t("pos.newOrder", "New order")}</button>
                    <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={handlePrintReceipt} style={ghostBtn}><Printer size={16} />{t("orders.printReceipt", "Print")}</button>
                        <button onClick={onViewOrder} style={ghostBtn}>{t("checkout.viewOrderDetails", "View order")}<ArrowRight size={16} /></button>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={handleWhatsAppShare} disabled={sharing} style={{ ...ghostBtn, color: "var(--c-success)", borderColor: "var(--c-success-soft)", background: "var(--c-success-soft)", opacity: sharing ? 0.6 : 1 }}><MessageCircle size={16} />{t("checkout.shareWhatsApp", "WhatsApp")}</button>
                        <button onClick={handleOpenTracking} style={ghostBtn}><ExternalLink size={16} />{t("checkout.track", "Track")}</button>
                    </div>
                </div>
            </div>
        </LResponsiveDialog>
    );
}
