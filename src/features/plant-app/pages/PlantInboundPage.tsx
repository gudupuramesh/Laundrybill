import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PlantOrderList } from "../components/PlantOrderList";
import { usePlantOrders } from "../hooks/use-plant-orders";
import { useLToast, LConfirmDialog } from "@/components/laundry";
import { TagGeneratorModal } from "../components/TagGeneratorModal";
import type { Order } from "@/types/order";

export function PlantInboundPage() {
    const { t } = useTranslation();

    // Fetch orders that are "pickup_completed" (from agents) OR "pending" (from POS)
    const { orders: allOrders, loading, startProcessing } = usePlantOrders(["pickup_completed", "pending"]);

    // Filter out "pending" orders that are "pickup_home" type (clothes not collected yet)
    // Only show: 
    // - All "pickup_completed" orders (agent collected from customer)
    // - "pending" orders for "pickup_store" and "delivery_home" (clothes already at shop)
    const orders = allOrders.filter(order => {
        if (order.status === "pickup_completed") return true;
        if (order.status === "pending" && order.deliveryType !== "pickup_home") return true;
        return false;
    });

    const { addToast } = useLToast();
    const [confirmState, setConfirmState] = useState<{ open: boolean; orderId: string | null }>({
        open: false,
        orderId: null
    });

    // Tag Modal State
    const [tagModalState, setTagModalState] = useState<{ open: boolean; order: Order | null }>({
        open: false,
        order: null
    });

    const openConfirm = (orderId: string) => {
        setConfirmState({ open: true, orderId });
    };

    const handleConfirmProcess = async () => {
        if (!confirmState.orderId) return;

        try {
            await startProcessing(confirmState.orderId);
            addToast({
                type: "success",
                title: t('plant.successStart', 'Order started processing'),
                description: t('plant.successStartDesc', 'Order moved to Processing tab')
            });
        } catch (error: any) {
            console.error(error);
            addToast({
                type: "error",
                title: t('plant.errorUpdate', 'Failed to update order'),
                description: "An error occurred."
            });
        }
    };

    // Handler for the "Tags" secondary action
    const handleOpenTags = (order: Order) => {
        setTagModalState({ open: true, order });
    };

    return (
        <>
            <div className="space-y-6">
                <PlantOrderList
                    title={t('plant.inbound', 'Inbound Orders')}
                    status="pickup_completed"
                    orders={orders}
                    loading={loading}
                    emptyMessage={t('plant.noInbound', 'No pending inbound orders')}
                    actionLabel={t('plant.startProcessing', 'Start Processing')}
                    onAction={openConfirm}
                    actionVariant="primary"
                    // Add Tags button
                    secondaryActionLabel={t('plant.tags', 'Tags')}
                    onSecondaryAction={handleOpenTags}
                />
            </div>

            {/* Beautiful Confirm Dialog */}
            <LConfirmDialog
                open={confirmState.open}
                onClose={() => setConfirmState({ open: false, orderId: null })}
                onConfirm={handleConfirmProcess}
                title={t('plant.confirmStartProcessing', 'Start Processing?')}
                description={t('plant.confirmStartDesc', 'This will move the order to the Processing queue.')}
                confirmText={t('plant.startProcessing', 'Start Processing')}
                cancelText={t('common.cancel', 'Cancel')}
            />

            {/* Tag Generator Modal */}
            {tagModalState.order && (
                <TagGeneratorModal
                    open={tagModalState.open}
                    onClose={() => setTagModalState({ open: false, order: null })}
                    order={tagModalState.order}
                />
            )}
        </>
    );
}
