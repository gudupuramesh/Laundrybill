import React from 'react';
import { Alert } from 'react-native';
import { useDriverTasks } from '../hooks/use-driver-tasks';
import { useNav } from '../lib/nav';
import { QrScanner } from '../components/QrScanner';

function resolveToken(raw: string): string {
  const data = raw.trim();
  const trackMatch = data.match(/\/track\/([^/?#]+)/);
  if (trackMatch) return trackMatch[1];
  if (data.includes(':')) return data.split(':')[0];
  return data;
}

/** Agent scan — match a scanned order against this agent's assigned pickup/delivery tasks. */
export default function ScanScreen() {
  const nav = useNav();
  const { pickupTasks, deliveryTasks } = useDriverTasks();

  const onResult = (raw: string, reset: () => void) => {
    const token = resolveToken(raw);
    const match = (t: { orderId: string; orderPublicId: string }) =>
      t.orderId === token || t.orderPublicId === token;

    const pickup = pickupTasks.find((t) => match(t) && t.status === 'pending');
    const delivery = deliveryTasks.find((t) => match(t) && t.status === 'pending');

    if (pickup) {
      nav.navigate({ name: 'pickupDetail', orderId: pickup.orderId });
    } else if (delivery) {
      nav.navigate({ name: 'deliveryDetail', orderId: delivery.orderId });
    } else {
      const anyMatch = [...deliveryTasks, ...pickupTasks].find(match);
      if (anyMatch) {
        nav.navigate(
          anyMatch.type === 'delivery'
            ? { name: 'deliveryDetail', orderId: anyMatch.orderId }
            : { name: 'pickupDetail', orderId: anyMatch.orderId },
        );
      } else {
        Alert.alert('Order not found', 'This QR is not one of your assigned orders.', [
          { text: 'Scan again', onPress: reset },
        ]);
      }
    }
  };

  return (
    <QrScanner
      title="Scan order"
      instruction="Point at the order QR to confirm pickup or delivery"
      permissionTitle="Scan order QR codes"
      permissionBody="Allow camera access to scan order tags and confirm pickups or deliveries."
      onResult={onResult}
    />
  );
}
