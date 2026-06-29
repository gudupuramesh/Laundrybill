import React from 'react';
import { Alert } from 'react-native';
import { firestore } from '../../lib/firebase';
import { useDriverAuth } from '../../lib/DriverAuthContext';
import { useNav } from '../../lib/nav';
import { QrScanner } from '../../components/QrScanner';

/** Plant tag QR encodes the order doc id (or `orderId:itemIndex`). */
function resolveOrderId(raw: string): string {
  const data = raw.trim();
  const m = data.match(/\/track\/([^/?#]+)/);
  if (m) return m[1];
  return data.split(':')[0];
}

/**
 * Plant scan — read a bag/garment tag and open the order. Plant sees every
 * order in the shop, so it looks the order up directly (not the agent task list).
 */
export default function PlantScanScreen() {
  const nav = useNav();
  const { shopId } = useDriverAuth();

  const onResult = async (raw: string, reset: () => void) => {
    if (!shopId) return;
    const orderId = resolveOrderId(raw);
    try {
      const snap = await firestore().doc(`shops/${shopId}/orders/${orderId}`).get();
      if (snap.exists) {
        nav.navigate({ name: 'plantOrderDetail', orderId });
      } else {
        Alert.alert('Order not found', 'No order matches this tag in your shop.', [
          { text: 'Scan again', onPress: reset },
        ]);
      }
    } catch {
      Alert.alert('Lookup failed', 'Could not read the order. Try again.', [
        { text: 'Scan again', onPress: reset },
      ]);
    }
  };

  return (
    <QrScanner
      title="Scan tag"
      instruction="Point at a bag or garment tag QR"
      permissionTitle="Scan a tag"
      permissionBody="Laundrybill needs the camera only to scan a bag or garment QR tag and open its order. Scanning just reads the code — no photo or video is taken or stored."
      onResult={onResult}
    />
  );
}
