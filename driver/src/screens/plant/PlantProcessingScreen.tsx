import React from 'react';
import { Alert } from 'react-native';
import { usePlantOrders } from '../../hooks/use-plant-orders';
import { PlantListView } from '../../components/PlantListView';
import { useNav } from '../../lib/nav';
import type { Order } from '../../types/order';

export default function PlantProcessingScreen() {
  const nav = useNav();
  const { orders, loading, markReady } = usePlantOrders(['processing']);

  const onAction = (order: Order) =>
    new Promise<void>((resolve) => {
      const desc =
        order.deliveryType === 'pickup_store'
          ? 'Customer will be notified to pick up their order.'
          : 'This will move the order to the Ready for Dispatch queue.';
      Alert.alert('Mark as Ready?', desc, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
        {
          text: 'Mark Ready',
          onPress: async () => {
            try {
              await markReady(order.id, order);
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to update order');
            }
            resolve();
          },
        },
      ]);
    });

  return (
    <PlantListView
      title="Processing"
      subtitle={`${orders.length} ${orders.length === 1 ? 'order' : 'orders'} active`}
      orders={orders}
      loading={loading}
      emptyMessage="No orders in processing"
      actionLabel="Mark Ready"
      actionVariant="success"
      onAction={onAction}
      onView={(o) => nav.navigate({ name: 'plantOrderDetail', orderId: o.id })}
    />
  );
}
