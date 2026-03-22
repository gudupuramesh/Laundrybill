import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PlantOrderList } from "../components/PlantOrderList";
import { usePlantOrders } from "../hooks/use-plant-orders";
import { useLToast, LConfirmDialog } from "@/components/laundry";
import { TagGeneratorModal } from "../components/TagGeneratorModal";
import type { Order } from "@/types/order";

export function PlantReadyPage() {
    const { t } = useTranslation();
    // Include both 'ready' and 'ready_for_pickup' - both are "ready" orders  
    const { orders, loading, markOutForDelivery } = usePlantOrders(["ready", "ready_for_pickup"]);
    const { addToast } = useLToast();
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
        // Shop Pickup orders should not be dispatched from Plant - they are picked up by customer
        if (order.deliveryType === 'pickup_store') {
            addToast({
                type: "warning",
                title: t('plant.shopPickupOrder', 'Shop Pickup Order'),
                description: t('plant.shopPickupDesc', 'This order will be picked up by customer at the shop. No delivery needed.')
            });
            return;
        }
        setConfirmState({ open: true, order });
    };

    const handleConfirmDispatch = async () => {
        if (!confirmState.order) return;
        try {
            await markOutForDelivery(confirmState.order.id, confirmState.order);
            addToast({
                type: "success",
                title: t('plant.successDispatch', 'Order Out for Delivery'),
                description: t('plant.successDispatchDesc', 'Order marked as dispatched from plant')
            });
        } catch (error: any) {
            console.error(error);
            addToast({
                type: "error",
                title: t('plant.errorUpdate', 'Failed to update order'),
                description: error.message || "An error occurred."
            });
        }
    };

    // Handler for the "Tags" secondary action
    const handleOpenTags = (order: Order) => {
        setTagModalState({ open: true, order });
    };

    // Separate orders by type for clarity
    const deliveryOrders = orders.filter(o => o.deliveryType !== 'pickup_store');
    const pickupOrders = orders.filter(o => o.deliveryType === 'pickup_store');

    return (
        <>
            <div className="space-y-6">
                {/* Delivery Orders - can be dispatched */}
                <PlantOrderList
                    title={t('plant.forDelivery', 'For Delivery')}
                    status="ready"
                    orders={deliveryOrders}
                    loading={loading}
                    emptyMessage={t('plant.noDeliveryOrders', 'No delivery orders ready')}
                    actionLabel={t('plant.dispatch', 'Mark Out for Delivery')}
                    onAction={(orderId) => {
                        const order = orders.find(o => o.id === orderId);
                        if (order) openConfirm(order);
                    }}
                    actionVariant="primary"
                    secondaryActionLabel={t('plant.tags', 'Tags')}
                    onSecondaryAction={handleOpenTags}
                />

                {/* Shop Pickup Orders - waiting for customer */}
                {pickupOrders.length > 0 && (
                    <PlantOrderList
                        title={t('plant.forPickup', 'For Customer Pickup')}
                        status="ready_for_pickup"
                        orders={pickupOrders}
                        loading={false}
                        emptyMessage=""
                        secondaryActionLabel={t('plant.tags', 'Tags')}
                        onSecondaryAction={handleOpenTags}
                    />
                )}
            </div>

            <LConfirmDialog
                open={confirmState.open}
                onClose={() => setConfirmState({ open: false, order: null })}
                onConfirm={handleConfirmDispatch}
                title={t('plant.confirmDispatch', 'Dispatch Order?')}
                description={t('plant.confirmDispatchDesc', 'This will mark the order as Out for Delivery.')}
                confirmText={t('plant.dispatch', 'Dispatch')}
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
