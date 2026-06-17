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
import { cn } from "@/lib/utils";
import {
    LResponsiveDialog,
    LButton,
    LAmount,
} from "@/components/laundry";
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
    CheckCircle2,
    MessageCircle,
    ExternalLink,
    Store,
    Truck,
    Home,
    Printer,
} from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

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
    const { currencySymbol } = useCurrency();
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

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title=""
            size="sm"
            snapPoints={[0.85]}
        >
            <div className="space-y-6 text-center py-2 px-1">
                {/* Success Icon Celebration Banner */}
                <div className="flex justify-center mt-2">
                    <div className="relative flex h-24 w-24 items-center justify-center">
                        {/* Rippling Background Rings */}
                        <div className="absolute inset-0 rounded-full bg-success/10 animate-ping opacity-75" />
                        <div className="absolute h-20 w-20 rounded-full bg-success/20 animate-pulse-soft" />
                        <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-success shadow-lg shadow-success/20 text-white">
                            <CheckCircle2 className="w-9 h-9" />
                        </div>
                    </div>
                </div>

                {/* Success Message */}
                <div className="space-y-1.5">
                    <h2 className="text-2xl font-black text-foreground tracking-tight flex items-center justify-center gap-1.5">
                        {t('checkout.orderPlaced')}
                    </h2>
                    <p className="text-sm font-semibold text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
                        {t('checkout.orderConfirmation')}
                    </p>
                </div>

                {/* Receipt Card Breakdown (Thermal Receipt Style) */}
                <div className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-background p-6 text-left shadow-lg shadow-primary/5">
                    {/* Top Decorative Gradient Strip */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-primary-light to-primary-dark" />
                    
                    <div className="space-y-4 pt-1">
                        {/* Order ID & Type */}
                        <div className="flex items-center justify-between pb-3 border-b border-border/60">
                            <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{t('orders.orderId')}</span>
                                <p className="font-extrabold text-lg text-foreground mt-0.5">#{order.publicId}</p>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{t('orders.orderType')}</span>
                                <p className="flex items-center gap-1.5 font-bold text-sm text-foreground mt-0.5 justify-end">
                                    <DeliveryIcon className="h-4 w-4 text-primary" />
                                    <span>
                                        {deliveryType === "pickup_store" && t('orders.shopPickup')}
                                        {deliveryType === "delivery_home" && t('orders.homeDelivery')}
                                        {deliveryType === "pickup_home" && t('orders.pickupFromHome')}
                                    </span>
                                </p>
                            </div>
                        </div>



                        {/* Financial Breakdown */}
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between text-muted-foreground font-semibold">
                                <span>{t('pos.subtotal')}</span>
                                <LAmount value={order.financials.subtotal} size="sm" className="font-bold tabular-nums" />
                            </div>

                            {order.financials.discountAmount > 0 && (
                                <div className="flex justify-between text-success font-semibold">
                                    <span>{t('checkout.discount', 'Discount')}</span>
                                    <span className="font-bold tabular-nums">-<LAmount value={order.financials.discountAmount} size="sm" /></span>
                                </div>
                            )}

                            {order.financials.deliveryCharge > 0 && (
                                <div className="flex justify-between text-muted-foreground font-semibold">
                                    <span>{t('checkout.delivery')}</span>
                                    <LAmount value={order.financials.deliveryCharge ?? 0} size="sm" className="font-bold tabular-nums" />
                                </div>
                            )}

                            {(order.financials.taxAmount || 0) > 0 && (
                                <div className="flex justify-between text-muted-foreground font-semibold">
                                    <span>{t('pos.tax', { name: order.financials.taxName, rate: order.financials.taxRate })}</span>
                                    <LAmount value={order.financials.taxAmount || 0} size="sm" className="font-bold tabular-nums" />
                                </div>
                            )}
                        </div>

                        {/* Solid Divider line */}
                        <div className="border-t border-border/80 my-3" />

                        {/* Grand Total */}
                        <div className="flex items-center justify-between">
                            <span className="text-base font-extrabold text-foreground">{t('pos.total')}</span>
                            <LAmount value={order.financials.total} size="lg" className="font-extrabold text-primary tabular-nums" />
                        </div>

                        {/* Payment Status & Expected Delivery Date details block */}
                        <div className="rounded-2xl bg-card border border-border/60 p-4 mt-5 space-y-3 text-xs shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-muted-foreground">{t('checkout.paymentStatus')}</span>
                                <span className={cn(
                                    "px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider text-[9px]",
                                    order.financials.balance > 0 
                                        ? "bg-destructive/10 text-destructive border border-destructive/25" 
                                        : "bg-success/10 text-success border border-success/25"
                                )}>
                                    {order.financials.balance > 0
                                        ? `${t('orders.balanceDue')}: ${currencySymbol}${order.financials.balance}`
                                        : t('checkout.paidInFull')}
                                </span>
                            </div>

                            {order.expectedDelivery && (
                                <div className="flex items-center justify-between border-t border-border/30 pt-2 mt-2">
                                    <span className="font-bold text-muted-foreground">
                                        {deliveryType === "pickup_store" ? t('orders.readyBy') : t('orders.expectedBy')}
                                    </span>
                                    <span className="font-extrabold text-foreground">
                                        {format(order.expectedDelivery.toDate(), "EEE, dd MMM")}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Additional Details */}
                <div className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block">{t('customer.details', 'Customer')}</span>
                            <p className="font-bold text-foreground mt-0.5">{order.customerName}</p>
                            <p className="text-muted-foreground font-semibold">{order.customerPhone}</p>
                        </div>
                        {order.deliveryAddress && (
                            <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block">{t('orders.address', 'Address / Area')}</span>
                                <p className="font-bold text-foreground mt-0.5 line-clamp-2">{order.deliveryAddress}</p>
                            </div>
                        )}
                        {order.assignedAgentName && (
                            <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block">{t('orders.agent', 'Delivery Agent')}</span>
                                <p className="font-bold text-foreground mt-0.5">{order.assignedAgentName}</p>
                            </div>
                        )}
                        <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground block">{t('orders.staff', 'Staff')}</span>
                            <p className="font-bold text-foreground mt-0.5">{order.staffName}</p>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-4">
                    {/* Primary Actions Row */}
                    <div className="grid grid-cols-2 gap-3">
                        <LButton
                            variant="outline"
                            leftIcon={<Printer className="h-4 w-4" />}
                            onClick={handlePrintReceipt}
                            fullWidth
                            className="rounded-xl font-extrabold border-border text-foreground hover:bg-muted active:scale-95 transition-all duration-200 cursor-pointer shadow-sm hover:text-primary hover:border-primary/30"
                        >
                            {t('orders.printReceipt')}
                        </LButton>

                        <LButton
                            variant="primary"
                            leftIcon={<MessageCircle className="h-4 w-4" />}
                            onClick={handleWhatsAppShare}
                            loading={sharing}
                            fullWidth
                            className="rounded-xl font-extrabold bg-success hover:bg-success-dark text-white active:scale-95 transition-all duration-200 cursor-pointer shadow-sm"
                        >
                            {t('checkout.shareWhatsApp')}
                        </LButton>
                    </div>

                    {/* Track Order Link */}
                    <button
                        onClick={handleOpenTracking}
                        className="group flex items-center justify-center gap-1.5 w-full py-2 text-sm font-bold text-primary hover:text-primary-dark transition-all duration-200 cursor-pointer"
                    >
                        <ExternalLink className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        <span>{t('checkout.openTrackingLink')}</span>
                    </button>

                    <div className="border-t border-border/80 my-2" />

                    {/* View Order / Close */}
                    <div className="flex flex-col sm:flex-row gap-2">
                        <LButton
                            variant="primary"
                            onClick={onViewOrder}
                            fullWidth
                            className="rounded-xl font-bold hover:bg-primary-dark active:scale-95 transition-all duration-200 cursor-pointer shadow-sm"
                        >
                            {t('checkout.viewOrderDetails')}
                        </LButton>
                        <LButton
                            variant="ghost"
                            onClick={onClose}
                            fullWidth
                            className="rounded-xl font-bold hover:bg-muted text-muted-foreground cursor-pointer"
                        >
                            {t('pos.newOrder', 'Start New Order')}
                        </LButton>
                    </div>
                </div>
            </div>
        </LResponsiveDialog>
    );
}
