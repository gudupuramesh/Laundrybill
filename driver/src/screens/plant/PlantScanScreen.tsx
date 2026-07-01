import React from 'react';
import { Alert } from 'react-native';
import { firestore } from '../../lib/firebase';
import { useDriverAuth } from '../../lib/DriverAuthContext';
import { useNav } from '../../lib/nav';
import { QrScanner } from '../../components/QrScanner';

/** QR tags encode the order doc id; barcode tags encode the short order number.
 *  Strip any `/track/<id>` wrapper and the `:itemIndex` suffix to get the raw token. */
function resolveToken(raw: string): string {
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
    const token = resolveToken(raw);
    const ordersRef = firestore().collection(`shops/${shopId}/orders`);
    try {
      // QR tags encode the doc id (direct lookup); barcode tags encode the short order
      // number → fall back to a query on orderNumber, then publicId.
      let orderId: string | null = null;
      const direct = await ordersRef.doc(token).get();
      if (direct.exists) {
        orderId = token;
      } else {
        let qs = await ordersRef.where('orderNumber', '==', token).limit(1).get();
        if (qs.empty) qs = await ordersRef.where('publicId', '==', token).limit(1).get();
        if (!qs.empty) orderId = qs.docs[0].id;
      }
      if (orderId) {
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
      instruction="Point at a bag or garment tag"
      permissionTitle="Scan a tag"
      permissionBody="Laundrybill needs the camera only to scan a bag or garment tag and open its order. Scanning just reads the code — no photo or video is taken or stored."
      onResult={onResult}
    />
  );
}
