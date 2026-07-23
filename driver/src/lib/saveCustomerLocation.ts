/**
 * Customer-location helpers for the delivery/pickup screens. The agent stands at
 * the customer's door, confirms the spot on an OpenStreetMap preview, and saves:
 *  - on the ORDER (deliveryLat/Lng + deliveryAddress) → maps links work now;
 *  - on the CUSTOMER (lat/lng + address) → future orders copy it, so the next
 *    pickup/delivery navigates precisely even with a different agent.
 * Map tiles + reverse geocoding both use OpenStreetMap (keyless).
 */
import * as Location from 'expo-location';
import { firestore } from './db';

export type LatLng = { lat: number; lng: number };

/** Get the agent's current GPS position (asks for permission first). */
export async function getCurrentPosition(): Promise<LatLng> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission is needed. Enable it in Settings to save the customer location.');
  }
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

/**
 * Reverse-geocode a coordinate to a human address via OpenStreetMap Nominatim.
 * Best-effort — returns '' on any failure (network, rate limit, etc.).
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=0`;
    const res = await fetch(url, {
      headers: {
        // Nominatim requires an identifiable User-Agent.
        'User-Agent': 'LaundrybillTeam/1.0 (support@laundrybill.com)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return '';
    const data = await res.json();
    return typeof data?.display_name === 'string' ? data.display_name : '';
  } catch {
    return '';
  }
}

/** Persist the confirmed location + address on the order and (if any) the customer. */
export async function saveCustomerLocation(
  shopId: string,
  orderId: string,
  customerId: string | null | undefined,
  loc: { lat: number; lng: number; address?: string },
): Promise<void> {
  const addr = (loc.address || '').trim();
  await firestore().collection(`shops/${shopId}/orders`).doc(orderId).update({
    deliveryLat: loc.lat,
    deliveryLng: loc.lng,
    ...(addr ? { deliveryAddress: addr } : {}),
    updatedAt: new Date(),
  });

  if (customerId) {
    try {
      await firestore().collection(`shops/${shopId}/customers`).doc(customerId).update({
        lat: loc.lat,
        lng: loc.lng,
        ...(addr ? { address: addr } : {}),
        locationUpdatedAt: new Date(),
      });
    } catch {
      // Guest order (no customer doc) — the order still has the pin + address.
    }
  }
}
