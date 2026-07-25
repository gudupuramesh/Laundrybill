/**
 * Forward geocoding via OpenStreetMap Nominatim (keyless). Used by the route
 * optimizer to place older orders that only have a text address (no saved GPS
 * pin) onto the map. Best-effort — returns null on any failure. Results are
 * cached in-memory for the session so we never re-hit Nominatim for the same
 * address (its usage policy caps callers at ~1 request/second).
 */
import type { LatLng } from './osmTiles';

const UA = 'LaundrybillTeam/1.0 (support@laundrybill.com)';
const cache = new Map<string, LatLng | null>();

export async function forwardGeocode(address: string): Promise<LatLng | null> {
  const key = (address || '').trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const data = await res.json();
    const hit = Array.isArray(data) ? data[0] : null;
    if (hit && hit.lat && hit.lon) {
      const r: LatLng = { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) };
      cache.set(key, r);
      return r;
    }
    cache.set(key, null);
    return null;
  } catch {
    cache.set(key, null);
    return null;
  }
}

/** Small delay helper so sequential geocodes respect Nominatim's rate limit. */
export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
