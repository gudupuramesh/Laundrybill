/**
 * Cancel Order Sheet
 * 
 * Confirmation dialog to cancel order with reason selection
 * Includes refund information if payment was made
 */

import { useState } from "react";
import {
    LResponsiveDialog,
    LRadioGroup,
    LTextArea,
    LButton,
    LSpacer,
    LAmount,
    useLToast,
} from "@/components/laundry";
import { useOrderMutations } from "@/hooks/use-orders";
import type { Order } from "@/types/order";
import { AlertTriangle } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { useTranslation } from "react-i18next";

interface CancelOrderSheetProps {
    open: boolean;
    onClose: () => void;
    order: Order;
}

const cancellationReasons = [
    { value: "customer_request", label: "Customer requested cancellation" },
    { value: "items_unavailable", label: "Items/services unavailable" },
    { value: "payment_issue", label: "Payment issue" },
    { value: "duplicate_order", label: "Duplicate order" },
    { value: "shop_closed", label: "Shop closed / Cannot process" },
    { value: "other", label: "Other reason" },
];

export function CancelOrderSheet({ open, onClose, order }: CancelOrderSheetProps) {
    const { t } = useTranslation();
    const { updateStatus } = useOrderMutations();
    const { addToast } = useLToast();
    const [reason, setReason] = useState("");
    const [otherReason, setOtherReason] = useState("");
    const { formatAmount } = useCurrency();
    const [loading, setLoading] = useState(false);

    const hasPayment = order.financials.amountPaid > 0;
    const refundAmount = order.financials.amountPaid;

    const handleCancel = async () => {
        if (!reason) {
            addToast({ type: "error", title: "Please select a reason" });
            return;
        }

        if (reason === "other" && !otherReason.trim()) {
            addToast({ type: "error", title: "Please enter the reason" });
            return;
        }

        setLoading(true);
        try {
            const notes = reason === "other"
                ? `Cancelled: ${otherReason}`
                : `Cancelled: ${cancellationReasons.find(r => r.value === reason)?.label}`;

            await updateStatus(order.id, "cancelled", notes, true);

            addToast({
                type: "success",
                title: "Order cancelled",
                description: hasPayment ? `Refund of ${formatAmount(refundAmount)} required` : undefined
            });

            onClose();
            // Reset state
            setReason("");
            setOtherReason("");
        } catch (error) {
            console.error("Failed to cancel order:", error);
            addToast({ type: "error", title: "Failed to cancel order" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title={t('orders.cancelOrder')}
            size="sm"
            snapPoints={[0.7]}
        >
            <div className="space-y-4">
                {/* Warning */}
                <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-xl">
                    <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium text-destructive">
                            {t('orders.cancelWarning')}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t('orders.cancelDescription')}
                        </p>
                    </div>
                </div>

                {/* Refund Info */}
                {hasPayment && (
                    <div className="p-3 bg-warning/10 rounded-xl">
                        <p className="text-sm font-medium text-warning-foreground">
                            {t('orders.refundRequired')}
                        </p>
                        <div className="flex justify-between mt-2">
                            <span className="text-sm text-muted-foreground">Amount paid</span>
                            <LAmount value={refundAmount} className="font-medium" />
                        </div>
                    </div>
                )}

                {/* Reason Selection */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                        {t('orders.cancellationReason')}
                    </label>
                    <LRadioGroup
                        name="cancelReason"
                        value={reason}
                        onChange={(v) => setReason(v)}
                        options={cancellationReasons}
                    />
                </div>

                {/* Other Reason Input */}
                {reason === "other" && (
                    <LTextArea
                        label="Specify reason"
                        value={otherReason}
                        onChange={(e) => setOtherReason(e.target.value)}
                        placeholder="Enter cancellation reason..."
                        minRows={2}
                    />
                )}

                <LSpacer size="md" />

                {/* Buttons */}
                <div className="flex gap-3">
                    <LButton
                        variant="secondary"
                        fullWidth
                        onClick={onClose}
                        disabled={loading}
                    >
                        {t('common.back')}
                    </LButton>
                    <LButton
                        variant="destructive"
                        fullWidth
                        onClick={handleCancel}
                        loading={loading}
                        disabled={!reason}
                    >
                        {t('orders.confirmCancel')}
                    </LButton>
                </div>
            </div>
        </LResponsiveDialog>
    );
}
