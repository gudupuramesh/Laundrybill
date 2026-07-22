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
import { STATUS_LABELS, mapLegacyDeliveryType, STATUS_FLOW, getItemProgress } from "@/types/order";
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
    const [showDeliverConfirm, setShowDeliverConfirm] = useState(false);
    const { addToast } = useLToast();

    const deliveryType = mapLegacyDeliveryType(order.deliveryType);
    // Piece progress — marking the order Delivered cascades to every remaining piece.
    const pieceProg = (order.items || []).map(getItemProgress);
    const deliveredPieces = pieceProg.reduce((a, p) => a + p.delivered, 0);
    const undeliveredPieces = pieceProg.reduce((a, p) => a + (p.qty - p.delivered), 0);

    // Show the WHOLE journey like the apps do: completed steps (✓), the current step,
    // and every future step — any future step is selectable so staff can jump straight
    // ahead (e.g. Processing → Delivered). Skipping still cascades pieces in updateStatus.
    const { steps, canCancel, hasFuture } = (() => {
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

        const isCancelled = order.status === "cancelled";
        // A cancelled order has no position in the flow; everything else defaults to step 1.
        if (currentIndex === -1) currentIndex = isCancelled ? flow.length : 0;

        const list = flow.map((status, i) => ({
            status,
            state: (i < currentIndex ? "done" : i === currentIndex ? "current" : "future") as
                "done" | "current" | "future",
            index: i,
        }));

        return {
            steps: list,
            canCancel: ["pending", "processing", "pickup_scheduled", "pickup_completed"].includes(order.status),
            hasFuture: list.some((s) => s.state === "future"),
        };
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
        // Confirm only when partial delivery has actually started (some pieces delivered,
        // some not) — a fresh order marked Delivered cascades silently, as expected.
        if ((newStatus === "delivered" || newStatus === "picked_up") && deliveredPieces > 0 && undeliveredPieces > 0) {
            setShowDeliverConfirm(true);
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
                    {!hasFuture && !canCancel ? (
                        <div style={{ fontSize: 13, color: "var(--c-text-3)", background: "var(--c-surface-2)", borderRadius: 10, padding: 14, textAlign: "center" }}>{t('orders.noStatusChange', 'No further status changes available.')}</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {/* Whole journey: ✓ done · ● current · selectable future steps (same as the apps) */}
                            {steps.map(({ status, state, index }) => {
                                const selectable = state === "future";
                                const on = newStatus === status;
                                const done = state === "done";
                                const current = state === "current";
                                return (
                                    <button
                                        key={status}
                                        type="button"
                                        onClick={() => selectable && setNewStatus(status)}
                                        disabled={!selectable}
                                        aria-pressed={on}
                                        style={{
                                            cursor: selectable ? "pointer" : "default",
                                            font: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 12,
                                            padding: "12px 14px", borderRadius: 11,
                                            border: `1.5px solid ${on ? "var(--c-primary)" : current ? "var(--c-primary-soft)" : "var(--c-border)"}`,
                                            background: on ? "var(--c-primary-soft)" : current ? "var(--c-primary-soft)" : "var(--c-surface)",
                                            opacity: done ? 0.65 : 1,
                                        }}
                                    >
                                        {/* Step indicator: check when done, dot when current/selected, number when future */}
                                        <span style={{
                                            width: 22, height: 22, flex: "none", borderRadius: "50%",
                                            border: `2px solid ${done ? "var(--c-success)" : on || current ? "var(--c-primary)" : "var(--c-border-strong)"}`,
                                            background: done ? "var(--c-success)" : on || current ? "var(--c-primary)" : "transparent",
                                            color: done || on || current ? "#fff" : "var(--c-text-3)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: 10, fontWeight: 700,
                                        }}>
                                            {done ? "✓" : on || current ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} /> : index + 1}
                                        </span>
                                        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)" }}>{STATUS_LABELS[status]}</span>
                                            {current && (
                                                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--c-primary)", background: "var(--c-surface)", border: "1px solid var(--c-primary)", borderRadius: 5, padding: "1px 6px" }}>
                                                    {t('orders.currentStep', 'Current')}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                );
                            })}

                            {/* Cancel — separate, destructive */}
                            {canCancel && (
                                <button
                                    type="button"
                                    onClick={() => setNewStatus("cancelled")}
                                    aria-pressed={newStatus === "cancelled"}
                                    style={{
                                        marginTop: 4, cursor: "pointer", font: "inherit", textAlign: "left",
                                        display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 11,
                                        border: `1.5px solid ${newStatus === "cancelled" ? "var(--c-error)" : "var(--c-error-soft)"}`,
                                        background: newStatus === "cancelled" ? "var(--c-error-soft)" : "var(--c-surface)",
                                    }}
                                >
                                    <span style={{
                                        width: 22, height: 22, flex: "none", borderRadius: "50%",
                                        border: "2px solid var(--c-error)",
                                        background: newStatus === "cancelled" ? "var(--c-error)" : "transparent",
                                        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700,
                                    }}>
                                        {newStatus === "cancelled" ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} /> : <span style={{ color: "var(--c-error)" }}>×</span>}
                                    </span>
                                    <span style={{ minWidth: 0 }}>
                                        <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--c-error)" }}>{STATUS_LABELS["cancelled"]}</span>
                                        <span style={{ display: "block", fontSize: 12, color: "var(--c-text-3)", marginTop: 1 }}>{t('orders.cannotUndo', 'This action cannot be undone')}</span>
                                    </span>
                                </button>
                            )}
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
            {/* Deliver-all confirmation: order-level Delivered cascades to every remaining piece */}
            <LConfirmDialog
                open={showDeliverConfirm}
                onClose={() => setShowDeliverConfirm(false)}
                onConfirm={() => {
                    setShowDeliverConfirm(false);
                    void performUpdate();
                }}
                title={t("orders.confirmDeliverAllTitle", "Deliver all items?")}
                description={t(
                    "orders.confirmDeliverAllDesc",
                    "{{count}} piece(s) are not marked delivered yet. Marking the order as delivered will mark every item as delivered.",
                    { count: undeliveredPieces }
                )}
                confirmText={t("orders.confirmDeliverAllButton", "Yes, deliver all")}
                cancelText={t("common.goBack", "Go back")}
                loading={loading}
            />
        </LResponsiveDialog>
    );
}
