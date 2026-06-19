/**
 * Status Update Sheet
 * 
 * Update order status with valid transitions
 */

import { useState } from "react";
import {
    LResponsiveDialog,
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
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {/* Status Options */}
                <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{t('orders.newStatus', 'New Status')}</label>
                    {availableStatuses.length === 0 ? (
                        <div style={{ fontSize: 13, color: "var(--c-text-3)", background: "var(--c-surface-2)", borderRadius: 10, padding: 14, textAlign: "center" }}>{t('orders.noStatusChange', 'No further status changes available.')}</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {availableStatuses.map((status) => {
                                const on = newStatus === status;
                                const danger = status === "cancelled";
                                const accent = danger ? "var(--c-error)" : "var(--c-primary)";
                                return (
                                    <button key={status} type="button" onClick={() => setNewStatus(status)} aria-pressed={on}
                                        style={{ cursor: "pointer", font: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", borderRadius: 11, border: `1.5px solid ${on ? accent : "var(--c-border)"}`, background: on ? (danger ? "var(--c-error-soft)" : "var(--c-primary-soft)") : "var(--c-surface)" }}>
                                        <span style={{ width: 20, height: 20, flex: "none", borderRadius: "50%", border: `2px solid ${on ? accent : "var(--c-border-strong)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{on && <span style={{ width: 10, height: 10, borderRadius: "50%", background: accent }} />}</span>
                                        <span style={{ minWidth: 0 }}>
                                            <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: on && danger ? "var(--c-error)" : "var(--c-text)" }}>{STATUS_LABELS[status]}</span>
                                            {danger && <span style={{ display: "block", fontSize: 12, color: "var(--c-text-3)", marginTop: 1 }}>{t('orders.cannotUndo', 'This action cannot be undone')}</span>}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Notes */}
                <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 7 }}>{t('orders.notes', 'Notes (optional)')}</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={t('orders.notesPlaceholder', 'Add any notes about this status change…')}
                        style={{ width: "100%", font: "inherit", fontSize: 13.5, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 10, padding: "11px 12px", resize: "vertical", outline: "none" }} />
                </div>

                {/* Share status via WhatsApp */}
                <button type="button" onClick={handleWhatsAppShare} disabled={!newStatus || loading}
                    style={{ width: "100%", cursor: !newStatus ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 14, fontWeight: 600, color: "var(--c-success)", background: "var(--c-success-soft)", border: "1px solid var(--c-success-soft)", borderRadius: 11, padding: 13, opacity: !newStatus ? 0.55 : 1 }}>
                    <MessageCircle size={18} />{t("orders.shareStatusWhatsApp", "Share via WhatsApp")}
                </button>

                {/* Submit */}
                <button type="button" onClick={handleUpdateClick} disabled={!newStatus || loading}
                    style={{ width: "100%", cursor: (!newStatus || loading) ? "not-allowed" : "pointer", font: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 11, padding: 14, boxShadow: "var(--sh-sm)", opacity: (!newStatus || loading) ? 0.55 : 1 }}>
                    {loading ? t('common.loading', 'Please wait…') : t('orders.updateStatus', 'Update Status')}
                </button>
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
