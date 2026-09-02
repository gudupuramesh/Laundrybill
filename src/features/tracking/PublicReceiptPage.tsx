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
    LTextInput,
} from "@/components/laundry";
import { useTranslation } from "react-i18next";
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
    const { t } = useTranslation();
    // Phone verifier — passed from the tracking page via router state. A customer
    // opening a receipt link directly (e.g. from WhatsApp) has no state, so the
    // page asks for the number itself instead of dead-ending.
    const phoneFromState = (location.state as { phone?: string } | null)?.phone || "";
    const [phoneEntry, setPhoneEntry] = useState("");
    const [phoneVerifier, setPhoneVerifier] = useState(phoneFromState);
    const { data, loading, error } = useOrderTracking(orderId || "", phoneVerifier);
    const canVerify = phoneEntry.replace(/\D/g, "").replace(/^0+/, "").length >= 8;
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
                pieceCount: item.pieceCount || undefined,
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
    const handleDownload = async () => {
        const order = buildOrderForReceipt();
        if (!order) return;

        setDownloading(true);

        try {
            const shopInfo = {
                name: data?.shopName || "LaundryBill",
                phone: data?.shopPhone,
                address: data?.shopAddress,
                gstNumber: data?.gstNumber,
                countryCode: data?.countryCode,
                receiptTerms: data?.receiptTerms,
                showTracking: data?.trackingEnabled !== false,
                currencySymbol,
                currencyCode,
                logoUrl: data?.shopLogo,
                upiId: data?.shopUpiId,
                paymentLink: data?.shopPaymentLink,
            };

            const blob = await getReceiptBlob(order, shopInfo);
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
    const handleView = async () => {
        const order = buildOrderForReceipt();
        if (!order) return;

        // Open the tab synchronously (before any await) so popup blockers allow it.
        const win = window.open("", "_blank");
        try {
            const shopInfo = {
                name: data?.shopName || "LaundryBill",
                phone: data?.shopPhone,
                address: data?.shopAddress,
                gstNumber: data?.gstNumber,
                countryCode: data?.countryCode,
                receiptTerms: data?.receiptTerms,
                showTracking: data?.trackingEnabled !== false,
                currencySymbol,
                currencyCode,
                logoUrl: data?.shopLogo,
                upiId: data?.shopUpiId,
                paymentLink: data?.shopPaymentLink,
            };

            const blob = await getReceiptBlob(order, shopInfo);
            const url = URL.createObjectURL(blob);
            if (win) win.location.href = url; else window.open(url, "_blank");

            // Clean up after delay
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (err) {
            win?.close();
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

    // No data yet — either the phone still needs verifying (direct link / wrong
    // number) or the order genuinely can't be found.
    if (error || !data) {
        return (
            <div className="min-h-screen bg-background p-4">
                <LCard variant="elevated" padding="lg" className="max-w-md mx-auto mt-20">
                    <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-primary-muted flex items-center justify-center mx-auto mb-4">
                            <FileText className="h-8 w-8 text-primary" />
                        </div>
                        <h2 className="text-xl font-bold text-foreground mb-2">
                            {t("receipt.verifyTitle", "View your receipt")}
                        </h2>
                        <p className="text-muted-foreground mb-4">
                            {t("receipt.verifyHint", "For your privacy, enter the mobile number used on the order — with or without the country code.")}
                        </p>
                    </div>
                    <LTextInput
                        label={t("tracking.phoneVerify", "Mobile number on the order")}
                        value={phoneEntry}
                        onChange={(e) => setPhoneEntry(e.target.value.replace(/[^\d+]/g, "").slice(0, 16))}
                        placeholder={t("tracking.phoneVerifyPlaceholder", "Mobile number")}
                        inputMode="tel"
                        onKeyDown={(e) => e.key === "Enter" && canVerify && setPhoneVerifier(phoneEntry)}
                    />
                    {error && (
                        <>
                            <LSpacer size="xs" />
                            <p className="text-sm text-destructive flex items-center gap-1.5"><XCircle className="h-4 w-4 flex-none" />{error}</p>
                        </>
                    )}
                    <LSpacer size="md" />
                    <LButton variant="primary" size="lg" fullWidth disabled={!canVerify}
                        onClick={() => setPhoneVerifier(phoneEntry)}>
                        {t("receipt.viewReceipt", "View receipt")}
                    </LButton>
                    <LSpacer size="sm" />
                    <LButton variant="ghost" size="sm" fullWidth onClick={() => navigate("/track")} leftIcon={<ArrowLeft className="h-4 w-4" />}>
                        {t("receipt.trackInstead", "Track order instead")}
                    </LButton>
                </LCard>
            </div>
        );
    }

    return (
        <div className="min-h-screen" style={{ background: "linear-gradient(180deg, var(--c-primary), #11338E)" }}>
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

                    {/* Track Order Link (hidden when the shop turned tracking off) */}
                    {data.trackingEnabled !== false && (
                        <button
                            onClick={() => navigate(`/track/${data.publicId}`)}
                            className="flex items-center justify-center gap-2 w-full py-2 text-sm text-primary hover:underline"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Track Order Status
                        </button>
                    )}
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
