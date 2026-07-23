/**
 * Capture the agent's current GPS position at the customer's door and save it:
 *  - on the ORDER (deliveryLat/deliveryLng) → this order's maps links work now;
 *  - on the CUSTOMER (lat/lng) → future orders copy it at creation, so the next
 *    pickup/delivery navigates precisely even with a different agent.
 */
import * as Location from 'expo-location';
import { firestore } from './db';

export async function captureAndSaveCustomerLocation(
  shopId: string,
  orderId: string,
  customerId?: string | null,
): Promise<{ lat: number; lng: number }> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission is needed to save the customer location. Enable it in Settings.');
  }
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;

  await firestore().collection(`shops/${shopId}/orders`).doc(orderId).update({
    deliveryLat: lat,
    deliveryLng: lng,
    updatedAt: new Date(),
  });

  if (customerId) {
    try {
      await firestore().collection(`shops/${shopId}/customers`).doc(customerId).update({
        lat,
        lng,
        locationUpdatedAt: new Date(),
      });
    } catch {
      // Customer doc missing (guest order) — the order still has the pin.
    }
  }

  return { lat, lng };
}
