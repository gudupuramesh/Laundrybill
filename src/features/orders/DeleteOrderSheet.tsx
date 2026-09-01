/**
 * Delete Order Sheet — permanent deletion by the shop OWNER or a MANAGER
 * (for test/mistake orders); Firestore rules allow exactly that pair.
 *
 * The order is removed completely from the database (not cancelled, not hidden):
 * it disappears from orders, reports and the customer's history, and its tracking
 * link stops working. To prevent accidents the owner must TYPE THE ORDER NUMBER
 * exactly before the delete button unlocks.
 */

import { useState } from "react";
import {
    LResponsiveDialog,
    LTextInput,
    LButton,
    LSpacer,
    useLToast,
} from "@/components/laundry";
import { useOrderMutations } from "@/hooks/use-orders";
import type { Order } from "@/types/order";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface DeleteOrderSheetProps {
    open: boolean;
    onClose: () => void;
    order: Order;
    /** Called after a successful deletion (navigate away — the order no longer exists). */
    onDeleted: () => void;
}

export function DeleteOrderSheet({ open, onClose, order, onDeleted }: DeleteOrderSheetProps) {
    const { t } = useTranslation();
    const { deleteOrder } = useOrderMutations();
    const { addToast } = useLToast();
    const [confirmText, setConfirmText] = useState("");
    const [loading, setLoading] = useState(false);

    const orderNumber = order.publicId || order.orderNumber || "";
    const matches = confirmText.trim().toUpperCase() === orderNumber.trim().toUpperCase();

    const handleClose = () => {
        setConfirmText("");
        onClose();
    };

    const handleDelete = async () => {
        if (!matches || loading) return;
        setLoading(true);
        try {
            await deleteOrder(order.id);
            addToast({
                type: "success",
                title: t("orders.deleteDone", "Order deleted"),
                description: t("orders.deleteDoneDesc", "#{{id}} was permanently removed from the database.", { id: orderNumber }),
            });
            setConfirmText("");
            onDeleted();
        } catch (error) {
            console.error("Failed to delete order:", error);
            addToast({ type: "error", title: t("orders.deleteFailed", "Failed to delete order") });
            setLoading(false);
        }
    };

    return (
        <LResponsiveDialog
            open={open}
            onClose={handleClose}
            title={t("orders.deleteOrder", "Delete Order Permanently")}
            size="sm"
            snapPoints={[0.6]}
        >
            <div className="space-y-4">
                {/* Warning */}
                <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-xl">
                    <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium text-destructive">
                            {t("orders.deleteWarningTitle", "This cannot be undone")}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t(
                                "orders.deleteWarningDesc",
                                "Order #{{id}} will be deleted COMPLETELY from the database — it will disappear from orders, reports and the customer's history, and its tracking link will stop working. Use this only for test or mistake orders. To keep a record instead, cancel the order.",
                                { id: orderNumber }
                            )}
                        </p>
                    </div>
                </div>

                {/* Typed confirmation */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                        {t("orders.deleteTypeToConfirm", "Type the order number {{id}} to confirm", { id: orderNumber })}
                    </label>
                    <LTextInput
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                        placeholder={orderNumber}
                        autoComplete="off"
                        spellCheck={false}
                    />
                </div>

                <LSpacer size="sm" />

                {/* Buttons */}
                <div className="flex gap-3">
                    <LButton variant="secondary" fullWidth onClick={handleClose} disabled={loading}>
                        {t("common.back", "Back")}
                    </LButton>
                    <LButton
                        variant="destructive"
                        fullWidth
                        onClick={handleDelete}
                        loading={loading}
                        disabled={!matches}
                        leftIcon={<Trash2 className="h-4 w-4" />}
                    >
                        {t("orders.deleteConfirmBtn", "Delete Forever")}
                    </LButton>
                </div>
            </div>
        </LResponsiveDialog>
    );
}
