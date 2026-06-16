/**
 * Quick-action helpers for task cards/details — call, WhatsApp, and "navigate"
 * (deep link to the device maps app), matching the web driver app's behaviour.
 */
import { Linking, Platform } from 'react-native';

function digits(phone: string): string {
  return String(phone || '').replace(/[^\d+]/g, '');
}

export function callCustomer(phone: string) {
  const p = digits(phone);
  if (p) Linking.openURL(`tel:${p}`).catch(() => {});
}

export function whatsappCustomer(phone: string) {
  let p = digits(phone).replace(/^\+/, '');
  if (p && p.length === 10) p = `91${p}`; // default to India when no country code
  if (p) Linking.openURL(`https://wa.me/${p}`).catch(() => {});
}

export function navigateToAddress(address: string, lat?: number, lng?: number) {
  if (typeof lat === 'number' && typeof lng === 'number') {
    const geo =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?daddr=${lat},${lng}`
        : `geo:${lat},${lng}?q=${lat},${lng}`;
    Linking.openURL(geo).catch(() =>
      Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`).catch(() => {}),
    );
    return;
  }
  const q = encodeURIComponent(address || '');
  Linking.openURL(`https://maps.google.com/?q=${q}`).catch(() => {});
}
