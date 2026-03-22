/**
 * Status Update Sheet
 * 
 * Update order status with valid transitions
 */

import { useState } from "react";
import {
    LResponsiveDialog,
    LRadioGroup,
    LTextArea,
    LButton,
    LSpacer,
    LConfirmDialog,
    useLToast,
} from "@/components/laundry";
import { useOrderMutations } from "@/hooks/use-orders";
import { STATUS_LABELS, mapLegacyDeliveryType, STATUS_FLOW } from "@/types/order";
import type { Order, OrderStatus } from "@/types/order";
import { MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface StatusUpdateSheetProps {
    open: boolean;
    onClose: () => void;
    order: Order;
    onSuccess?: () => void;
}

// Old static transitions removed in favor of delivery-type aware getNextStatuses

export function StatusUpdateSheet({ open, onClose, order, onSuccess }: StatusUpdateSheetProps) {
    const { t } = useTranslation();
    const { updateStatus } = useOrderMutations();
    const [newStatus, setNewStatus] = useState<OrderStatus | "">("");
    const [notes, setNotes] = useState("");
    const [sharedOnWhatsApp, setSharedOnWhatsApp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const { addToast } = useLToast();

    const deliveryType = mapLegacyDeliveryType(order.deliveryType);

    // Only allow the next logical step(s) – no skipping to Delivered until previous steps are done
    const availableStatuses = (() => {
        const flow = STATUS_FLOW[deliveryType];
        let currentIndex = flow.indexOf(order.status);

        // Handle cross-flow statuses (e.g. ready ↔ ready_for_pickup)
        if (currentIndex === -1) {
            const statusEquivalents: Record<string, OrderStatus[]> = {
                ready: ["ready_for_pickup"],
                ready_for_pickup: ["ready"],
                out_for_delivery: ["picked_up"],
                delivered: ["picked_up"],
            };
            const equivalents = statusEquivalents[order.status] || [];
            for (const eqStatus of equivalents) {
                const eqIndex = flow.indexOf(eqStatus);
                if (eqIndex !== -1) {
                    currentIndex = eqIndex;
                    break;
                }
            }
        }

        const terminalStates: OrderStatus[] = ["delivered", "picked_up", "cancelled"];
        if (terminalStates.includes(order.status)) {
            return [];
        }

        if (currentIndex === -1) {
            currentIndex = 0;
        }

        if (currentIndex >= flow.length - 1) return [];

        // Only the immediate next step – no skipping (e.g. cannot jump to Delivered from Processing)
        const nextStatus = flow[currentIndex + 1];
        const options: OrderStatus[] = [nextStatus];

        if (["pending", "processing", "pickup_scheduled", "pickup_completed"].includes(order.status)) {
            options.push("cancelled");
        }

        return options;
    })();

    const performUpdate = async () => {
        if (!newStatus) return;

        setLoading(true);
        try {
            await updateStatus(order.id, newStatus, notes || undefined, sharedOnWhatsApp);
            onSuccess?.();
            onClose();
            // Reset state
            setNewStatus("");
            setNotes("");
            setSharedOnWhatsApp(false);
        } catch (error) {
            console.error("Failed to update status:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateClick = () => {
        if (!newStatus) return;
        if (newStatus === "cancelled") {
            setShowCancelConfirm(true);
            return;
        }
        void performUpdate();
    };

    const handleWhatsAppShare = () => {
        if (!newStatus) {
            return;
        }

        const rawPhone = order.customerPhone || "";
        const phoneNumber = rawPhone.replace(/[^0-9]/g, "");

        if (!phoneNumber) {
            addToast({
                type: "error",
                title: t("orders.whatsappNoPhoneTitle", "Cannot open WhatsApp"),
                description: t("orders.whatsappNoPhoneDesc", "This order does not have a valid customer phone number."),
            });
            return;
        }

        const fullPhone = phoneNumber.startsWith("91") ? phoneNumber : `91${phoneNumber}`;
        const statusLabel = STATUS_LABELS[newStatus] || newStatus;

        const lines: string[] = [
            `🧺 *${order.customerName || "Customer"}*`,
            ``,
            t("orders.whatsappStatusLine", "Your order status has been updated."),
            `*Order ID:* #${order.publicId}`,
            `*New Status:* ${statusLabel}`,
        ];

        if (notes.trim()) {
            lines.push("", `${t("orders.notes", "Notes")}: ${notes.trim()}`);
        }

        const message = lines.join("\n");
        const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;

        window.open(whatsappUrl, "_blank");
        setSharedOnWhatsApp(true);
    };

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title={t('orders.updateStatus')}
            size="sm"
            snapPoints={[0.6]}
        >
            <div className="space-y-6">
                {/* Status Options */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                        {t('orders.newStatus')}
                    </label>
                    <LRadioGroup
                        name="status"
                        value={newStatus}
                        onChange={(v) => setNewStatus(v as OrderStatus)}
                        options={availableStatuses.map((status) => ({
                            value: status,
                            label: STATUS_LABELS[status],
                            description: status === "cancelled" ? t('orders.cannotUndo') : undefined,
                        }))}
                    />

                    {/* Notes */}
                    <LTextArea
                        label={t('orders.notes')}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={t('orders.notesPlaceholder')}
                        minRows={2}
                    />

                    {/* Share status via WhatsApp */}
                    <LButton
                        variant="outline"
                        size="lg"
                        fullWidth
                        leftIcon={<MessageCircle className="h-5 w-5" />}
                        onClick={handleWhatsAppShare}
                        disabled={!newStatus || loading}
                    >
                        {t("orders.shareStatusWhatsApp", "Share status via WhatsApp")}
                    </LButton>

                    <LSpacer size="md" />

                    {/* Submit */}
                    <LButton
                        variant="primary"
                        size="lg"
                        fullWidth
                        onClick={handleUpdateClick}
                        loading={loading}
                        disabled={!newStatus}
                    >
                        {t('orders.updateStatus')}
                    </LButton>
                </div>
            </div>
            {/* Cancel confirmation dialog */}
            <LConfirmDialog
                open={showCancelConfirm}
                onClose={() => setShowCancelConfirm(false)}
                onConfirm={() => {
                    void performUpdate();
                }}
                title={t("orders.confirmCancelTitle", "Cancel this order?")}
                description={t(
                    "orders.confirmCancelDesc",
                    "This action cannot be undone. Are you sure you want to cancel this order?"
                )}
                confirmText={t("orders.confirmCancelButton", "Yes, cancel order")}
                cancelText={t("common.goBack", "No, keep order")}
                variant="destructive"
                loading={loading}
            />
        </LResponsiveDialog>
    );
}
