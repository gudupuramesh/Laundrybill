import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PlantOrderList } from "../components/PlantOrderList";
import { usePlantOrders } from "../hooks/use-plant-orders";
import { useLToast, LConfirmDialog } from "@/components/laundry";
import { TagGeneratorModal } from "../components/TagGeneratorModal";
import type { Order } from "@/types/order";

export function PlantProcessingPage() {
    const { t } = useTranslation();
    const { orders, loading, markReady } = usePlantOrders(["processing"]);
    const { addToast } = useLToast();

    // Dialog States - now storing the full order
    const [confirmState, setConfirmState] = useState<{ open: boolean; order: Order | null }>({
        open: false,
        order: null
    });

    // Tag Modal State
    const [tagModalState, setTagModalState] = useState<{ open: boolean; order: Order | null }>({
        open: false,
        order: null
    });

    const openConfirm = (order: Order) => {
        setConfirmState({ open: true, order });
    };

    const handleConfirmReady = async () => {
        if (!confirmState.order) return;
        try {
            await markReady(confirmState.order.id, confirmState.order);

            // Show appropriate message based on order type
            const isShopPickup = confirmState.order.deliveryType === 'pickup_store';
            addToast({
                type: "success",
                title: isShopPickup
                    ? t('plant.successReadyPickup', 'Ready for Customer Pickup')
                    : t('plant.successReady', 'Order marked as Ready'),
                description: isShopPickup
                    ? t('plant.successReadyPickupDesc', 'Customer can now pick up their order')
                    : t('plant.successReadyDesc', 'Order moved to Ready for Dispatch')
            });
        } catch (error) {
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
                    title={t('plant.processing', 'Processing')}
                    status="processing"
                    orders={orders}
                    loading={loading}
                    emptyMessage={t('plant.noProcessing', 'No orders in processing')}
                    actionLabel={t('plant.markReady', 'Mark Ready')}
                    onAction={(orderId) => {
                        const order = orders.find(o => o.id === orderId);
                        if (order) openConfirm(order);
                    }}
                    actionVariant="success"
                    // Add secondary action for Tags
                    secondaryActionLabel={t('plant.tags', 'Tags')}
                    onSecondaryAction={handleOpenTags}
                />
            </div>

            <LConfirmDialog
                open={confirmState.open}
                onClose={() => setConfirmState({ open: false, order: null })}
                onConfirm={handleConfirmReady}
                title={t('plant.confirmMarkReady', 'Mark as Ready?')}
                description={
                    confirmState.order?.deliveryType === 'pickup_store'
                        ? t('plant.confirmReadyPickupDesc', 'Customer will be notified to pick up their order.')
                        : t('plant.confirmReadyDesc', 'This will move the order to the Ready for Dispatch queue.')
                }
                confirmText={t('plant.markReady', 'Mark Ready')}
                cancelText={t('common.cancel', 'Cancel')}
            />

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
