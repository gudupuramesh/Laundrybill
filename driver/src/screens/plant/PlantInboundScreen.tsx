import React, { useMemo } from 'react';
import { Alert } from 'react-native';
import { usePlantOrders, filterInbound } from '../../hooks/use-plant-orders';
import { PlantListView } from '../../components/PlantListView';
import { useNav } from '../../lib/nav';
import type { Order } from '../../types/order';

export default function PlantInboundScreen() {
  const nav = useNav();
  const { orders, loading, startProcessing } = usePlantOrders(['pickup_completed', 'pending']);
  const inbound = useMemo(() => filterInbound(orders), [orders]);

  const onAction = (order: Order) =>
    new Promise<void>((resolve) => {
      Alert.alert('Start Processing?', 'This will move the order to the Processing queue.', [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
        {
          text: 'Start',
          onPress: async () => {
            try {
              await startProcessing(order.id);
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
      title="Inbound"
      subtitle={`${inbound.length} ${inbound.length === 1 ? 'order' : 'orders'} waiting`}
      orders={inbound}
      loading={loading}
      emptyMessage="No pending inbound orders"
      actionLabel="Start Processing"
      actionVariant="primary"
      onAction={onAction}
      onView={(o) => nav.navigate({ name: 'plantOrderDetail', orderId: o.id })}
    />
  );
}
