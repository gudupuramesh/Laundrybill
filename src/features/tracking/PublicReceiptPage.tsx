/**
 * Public Receipt Page
 *
 * Customer-facing page to view/download order receipt PDF
 * Accessible via: /receipt/:trackingId
 *
 * Note: URL param is semantically a tracking identifier (publicId, orderNumber, or trackingId),
 * not the Firestore document ID. Resolves via useOrderTracking which queries by these fields.
 */

import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
    LCard,
    LButton,
    LPageLoader,
    LSpacer,
} from "@/components/laundry";
import { useOrderTracking } from "@/hooks/use-tracking";
import { getReceiptBlob, getReceiptFileName } from "@/lib/generateReceipt";
import {
    FileText,
    Download,
    ArrowLeft,
    XCircle,
    ExternalLink,
} from "lucide-react";
import type { Order } from "@/types/order";
import { Timestamp } from "firebase/firestore";
import { useCurrencyByShopId } from "@/hooks/use-currency";

export function PublicReceiptPage() {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    // Phone verifier — passed from the tracking page via router state.
    const phoneFromState = (location.state as { phone?: string } | null)?.phone || "";
    const { data, loading, error } = useOrderTracking(orderId || "", phoneFromState);
    const { formatAmount, currencySymbol, currencyCode } = useCurrencyByShopId(data?.shopId || null);
    const [downloading, setDownloading] = useState(false);

    // Convert tracking data to Order-like object for receipt generation
    const buildOrderForReceipt = (): Order | null => {
        if (!data) return null;

        const itemsSubtotal = data.items.reduce(
            (sum, item) => sum + (item.price || 0) * item.quantity,
            0
        );

        return {
            id: data.orderId,
            orderNumber: data.publicId,
            publicId: data.publicId,
            shopId: data.shopId,
            customerId: undefined,
            customerName: data.customerName,
            customerPhone: data.customerPhone,
            isGuest: true,
            items: data.items.map((item, index) => ({
                id: `item-${index}`,
                serviceId: "",
                serviceName: item.name,
                categoryName: item.categoryName || "",
                quantity: item.quantity,
                unit: "piece",
                unitPrice: item.price || 0,
                total: (item.price || 0) * item.quantity,
                express: item.express ?? false,
                notes: undefined,
            })),
            financials: {
                subtotal: itemsSubtotal,
                discountType: undefined,
                discountValue: 0,
                discountAmount: data.discountAmount ?? 0,
                taxAmount: data.taxAmount ?? 0,
                taxName: data.taxName,
                taxRate: data.taxRate,
                expressCharge: 0,
                deliveryCharge: data.deliveryCharge ?? 0,
                total: data.total,
                amountPaid: data.amountPaid,
                balance: data.balance,
            },
            status: data.status,
            paymentMethod: "cash",
            paymentStatus: data.balance > 0 ? "partial" : "paid",
            paymentReference: undefined,
            deliveryType: data.deliveryType as any,
            deliveryAddress: undefined,
            deliveryNotes: undefined,
            expectedDelivery: Timestamp.fromDate(data.expectedDelivery),
            staffId: "",
            staffName: "",
            createdAt: Timestamp.fromDate(data.timeline[0]?.timestamp || new Date()),
            updatedAt: Timestamp.now(),
            timeline: data.timeline.map((event, index) => ({
                id: `t-${index}`,
                status: event.status,
                timestamp: Timestamp.fromDate(event.timestamp),
                staffId: "",
                staffName: "",
                notifiedCustomer: false,
                note: event.note,
            })),
        };
    };

    // Handle PDF download
    const handleDownload = () => {
        const order = buildOrderForReceipt();
        if (!order) return;

        setDownloading(true);

        try {
            const shopInfo = {
                name: data?.shopName || "LaundryBill",
                phone: data?.shopPhone,
                address: data?.shopAddress,
                currencySymbol,
                currencyCode,
            };

            const blob = getReceiptBlob(order, shopInfo);
            const fileName = getReceiptFileName(order);

            // Create download link
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch (err) {
            console.error("Failed to generate receipt:", err);
        }

        setDownloading(false);
    };

    // Handle view in browser
    const handleView = () => {
        const order = buildOrderForReceipt();
        if (!order) return;

        try {
            const shopInfo = {
                name: data?.shopName || "LaundryBill",
                phone: data?.shopPhone,
                address: data?.shopAddress,
                currencySymbol,
                currencyCode,
            };

            const blob = getReceiptBlob(order, shopInfo);
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");

            // Clean up after delay
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (err) {
            console.error("Failed to generate receipt:", err);
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-background">
                <LPageLoader variant="machine" message="Loading receipt..." />
            </div>
        );
    }

    // Error state
    if (error || !data) {
        return (
            <div className="min-h-screen bg-background p-4">
                <LCard variant="elevated" padding="lg" className="max-w-md mx-auto mt-20">
                    <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-destructive-muted flex items-center justify-center mx-auto mb-4">
                            <XCircle className="h-8 w-8 text-destructive" />
                        </div>
                        <h2 className="text-xl font-bold text-foreground mb-2">
                            Receipt Not Found
                        </h2>
                        <p className="text-muted-foreground mb-6">
                            {error || "We couldn't find this order. Please check the link."}
                        </p>
                        <LButton
                            variant="primary"
                            onClick={() => navigate("/track")}
                            leftIcon={<ArrowLeft className="h-4 w-4" />}
                        >
                            Track Order
                        </LButton>
                    </div>
                </LCard>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-primary to-primary-dark">
            {/* Header */}
            <header className="p-6 pt-12 text-center text-white">
                <div className="max-w-md mx-auto">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <FileText className="h-8 w-8" />
                    </div>
                    <h1 className="text-2xl font-bold">Order Receipt</h1>
                    <p className="text-white/80 mt-1">
                        #{data.publicId}
                    </p>
                </div>
            </header>

            {/* Content */}
            <main className="p-4">
                <LCard variant="elevated" padding="lg" className="max-w-md mx-auto">
                    {/* Order Summary */}
                    <div className="text-center mb-6">
                        <p className="text-sm text-muted-foreground mb-1">
                            {data.shopName || "LaundryBill"}
                        </p>
                        <p className="text-2xl font-bold text-foreground">
                            {formatAmount(data.total)}
                        </p>
                        {data.balance > 0 && (
                            <p className="text-sm text-destructive mt-1">
                                Balance Due: {formatAmount(data.balance)}
                            </p>
                        )}
                    </div>

                    {/* Items Preview */}
                    <div className="bg-muted rounded-lg p-4 mb-6">
                        <p className="text-sm text-muted-foreground mb-2">
                            {data.items.length} item(s)
                        </p>
                        <div className="space-y-1 text-sm">
                            {data.items.slice(0, 3).map((item, i) => (
                                <div key={i} className="flex justify-between">
                                    <span>{item.name}</span>
                                    <span>×{item.quantity}</span>
                                </div>
                            ))}
                            {data.items.length > 3 && (
                                <p className="text-muted-foreground">
                                    +{data.items.length - 3} more...
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <LButton
                            variant="primary"
                            size="lg"
                            fullWidth
                            leftIcon={<ExternalLink className="h-5 w-5" />}
                            onClick={handleView}
                        >
                            View Receipt
                        </LButton>

                        <LButton
                            variant="outline"
                            size="lg"
                            fullWidth
                            leftIcon={<Download className="h-5 w-5" />}
                            onClick={handleDownload}
                            loading={downloading}
                        >
                            Download PDF
                        </LButton>
                    </div>

                    <LSpacer size="md" />

                    {/* Track Order Link */}
                    <button
                        onClick={() => navigate(`/track/${data.publicId}`)}
                        className="flex items-center justify-center gap-2 w-full py-2 text-sm text-primary hover:underline"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Track Order Status
                    </button>
                </LCard>
            </main>

            {/* Footer */}
            <footer className="p-4 mt-8 text-center">
                <p className="text-xs text-white/50">
                    Powered by LaundryBill
                </p>
            </footer>
        </div>
    );
}
