import React from 'react';
import { Alert } from 'react-native';
import { firestore } from '../lib/firebase';
import { useDriverAuth } from '../lib/DriverAuthContext';
import { useNav } from '../lib/nav';
import { QrScanner } from '../components/QrScanner';

/** Order/tag QR encodes the order doc id (a `/track/<id>` link or `orderId:itemIndex`). */
function resolveOrderId(raw: string): string {
  const data = raw.trim();
  const m = data.match(/\/track\/([^/?#]+)/);
  if (m) return m[1];
  return data.split(':')[0];
}

/**
 * Staff scan — read an order/garment tag and open the order so staff can check
 * or update its status. Staff see every order in the shop, so look the order up
 * directly (same model as the plant scan, but routed to the staff order detail).
 */
export default function StaffScanScreen({ onBack }: { onBack?: () => void } = {}) {
  const nav = useNav();
  const { shopId } = useDriverAuth();

  const onResult = async (raw: string, reset: () => void) => {
    if (!shopId) return;
    const orderId = resolveOrderId(raw);
    try {
      const snap = await firestore().doc(`shops/${shopId}/orders/${orderId}`).get();
      if (snap.exists) {
        nav.navigate({ name: 'orderDetail', orderId });
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
      onBack={onBack}
      title="Scan order"
      instruction="Point at an order or garment tag QR"
      permissionTitle="Scan an order"
      permissionBody="Laundrybill needs the camera only to scan an order QR tag and open it. Scanning just reads the code — no photo or video is taken or stored."
      onResult={onResult}
    />
  );
}
