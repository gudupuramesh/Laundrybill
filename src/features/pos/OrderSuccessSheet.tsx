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
import {
    LResponsiveDialog,
    LButton,
    LCard,
    LAmount,
    LDivider,
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
            <div className="space-y-6 text-center">
                {/* Success Icon */}
                <div className="flex justify-center">
                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="w-12 h-12 text-green-600" />
                    </div>
                </div>

                {/* Success Message */}
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-foreground">
                        {t('checkout.orderPlaced')}
                    </h2>
                    <p className="text-muted-foreground">
                        {t('checkout.orderConfirmation')}
                    </p>
                </div>

                {/* Order Summary Card */}
                <LCard className="text-left">
                    <div className="space-y-3">
                        {/* Order ID */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">{t('orders.orderId')}</span>
                            <span className="font-bold text-lg">#{order.publicId}</span>
                        </div>

                        {/* Delivery Type */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">{t('orders.orderType')}</span>
                            <div className="flex items-center gap-2">
                                <DeliveryIcon className="h-4 w-4 text-primary" />
                                <span className="font-medium">
                                    {deliveryType === "pickup_store" && t('orders.shopPickup')}
                                    {deliveryType === "delivery_home" && t('orders.homeDelivery')}
                                    {deliveryType === "pickup_home" && t('orders.pickupFromHome')}
                                </span>
                            </div>
                        </div>

                        <LDivider />

                        {/* Items List */}
                        <div className="space-y-1">
                            <span className="text-sm text-muted-foreground">{t('orders.items')}</span>
                            {order.items.map((item, index) => (
                                <div key={index} className="flex justify-between text-sm">
                                    <span>
                                        {item.serviceName}
                                        {item.categoryName && (
                                            <span className="text-muted-foreground text-xs ml-1">
                                                ({item.categoryName})
                                            </span>
                                        )}
                                        {item.express && (
                                            <span className="ml-2 text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">
                                                ⚡ Express
                                            </span>
                                        )}
                                    </span>
                                    <span>× {item.quantity}</span>
                                </div>
                            ))}
                        </div>

                        <LDivider />

                        {/* Financial Breakdown */}
                        <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between text-muted-foreground">
                                <span>{t('pos.subtotal')}</span>
                                <LAmount value={order.financials.subtotal} size="sm" />
                            </div>

                            {order.financials.discountAmount > 0 && (
                                <div className="flex justify-between text-success">
                                    <span>{t('checkout.discount', 'Discount')}</span>
                                    <span>-<LAmount value={order.financials.discountAmount} size="sm" /></span>
                                </div>
                            )}

                            <div className="flex justify-between text-muted-foreground">
                                <span>{t('checkout.delivery')}</span>
                                <LAmount value={order.financials.deliveryCharge ?? 0} size="sm" />
                            </div>

                            {(order.financials.taxAmount || 0) > 0 && (
                                <div className="flex justify-between text-foreground">
                                    <span>{t('pos.tax', { name: order.financials.taxName, rate: order.financials.taxRate })}</span>
                                    <LAmount value={order.financials.taxAmount || 0} size="sm" />
                                </div>
                            )}
                        </div>

                        <LDivider />

                        {/* Total */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-foreground">{t('pos.total')}</span>
                            <LAmount value={order.financials.total} size="lg" />
                        </div>

                        {/* Payment Status */}
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{t('checkout.paymentStatus')}</span>
                            <span className={`font-medium ${order.financials.balance > 0 ? "text-orange-600" : "text-green-600"}`}>
                                {order.financials.balance > 0
                                    ? <span className="flex items-center gap-1">{t('orders.balanceDue')}: <LAmount value={order.financials.balance} size="sm" /></span>
                                    : t('checkout.paidInFull')}
                            </span>
                        </div>

                        {/* Expected Date */}
                        {order.expectedDelivery && (
                            <div className="flex items-center justify-between text-sm pt-2 border-t border-border border-dashed">
                                <span className="text-muted-foreground">
                                    {deliveryType === "pickup_store" ? t('orders.readyBy') : t('orders.expectedBy')}
                                </span>
                                <span className="font-medium">
                                    {format(order.expectedDelivery.toDate(), "EEE, dd MMM")}
                                </span>
                            </div>
                        )}
                    </div>
                </LCard>

                {/* Action Buttons */}
                <div className="space-y-3">
                    {/* Primary Actions */}
                    <div className="grid grid-cols-2 gap-3">
                        <LButton
                            variant="outline"
                            leftIcon={<Printer className="h-4 w-4" />}
                            onClick={handlePrintReceipt}
                            fullWidth
                        >
                            {t('orders.printReceipt')}
                        </LButton>

                        <LButton
                            variant="primary"
                            leftIcon={<MessageCircle className="h-4 w-4" />}
                            onClick={handleWhatsAppShare}
                            loading={sharing}
                            fullWidth
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {t('checkout.shareWhatsApp')}
                        </LButton>
                    </div>

                    {/* Track Order Link */}
                    <button
                        onClick={handleOpenTracking}
                        className="flex items-center justify-center gap-2 w-full py-2 text-sm text-primary hover:underline"
                    >
                        <ExternalLink className="h-4 w-4" />
                        {t('checkout.openTrackingLink')}
                    </button>

                    <LDivider />

                    {/* View Order Button */}
                    <LButton
                        variant="ghost"
                        onClick={onViewOrder}
                        fullWidth
                    >
                        {t('checkout.viewOrderDetails')}
                    </LButton>
                </div>
            </div>
        </LResponsiveDialog>
    );
}
