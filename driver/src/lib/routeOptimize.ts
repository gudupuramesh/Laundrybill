/**
 * Route optimizer for the delivery/pickup agent. Keyless — orders stops to cut
 * total driving with a nearest-neighbour seed + 2-opt refinement over
 * straight-line (haversine) distance. Good enough for the handful of stops an
 * agent runs at once, with no routing-API cost. Also builds the multi-stop
 * Google Maps directions URL for turn-by-turn navigation.
 */
import { Platform, Linking } from 'react-native';
import type { LatLng } from './osmTiles';

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Greedy nearest-neighbour ordering from `start`. */
function nearestNeighbour<T extends LatLng>(start: LatLng, stops: T[]): T[] {
  const remaining = [...stops];
  const order: T[] = [];
  let cur: LatLng = start;
  while (remaining.length) {
    let bestI = 0;
    let bestD = Infinity;
    remaining.forEach((s, i) => {
      const d = haversineKm(cur, s);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    });
    const [next] = remaining.splice(bestI, 1);
    order.push(next);
    cur = next;
  }
  return order;
}

/** 2-opt refinement of an open path that begins at `start` (start stays fixed). */
function twoOpt<T extends LatLng>(start: LatLng, route: T[]): T[] {
  if (route.length < 4) return route;
  const path = [...route];
  const legLength = (arr: T[]) => {
    let total = haversineKm(start, arr[0]);
    for (let i = 0; i < arr.length - 1; i++) total += haversineKm(arr[i], arr[i + 1]);
    return total;
  };
  let best = legLength(path);
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 60) {
    improved = false;
    for (let i = 0; i < path.length - 1; i++) {
      for (let k = i + 1; k < path.length; k++) {
        const candidate = [...path.slice(0, i), ...path.slice(i, k + 1).reverse(), ...path.slice(k + 1)];
        const len = legLength(candidate);
        if (len + 1e-9 < best) {
          path.splice(0, path.length, ...candidate);
          best = len;
          improved = true;
        }
      }
    }
  }
  return path;
}

/** Order stops to minimise total travel, starting from `start` (agent's GPS). */
export function optimizeRoute<T extends LatLng>(start: LatLng | null, stops: T[]): T[] {
  if (stops.length <= 1) return [...stops];
  const seed = start || stops[0];
  return twoOpt(seed, nearestNeighbour(seed, stops));
}

/** Total straight-line distance (km) along [start?, ...ordered]. */
export function totalDistanceKm(start: LatLng | null, ordered: LatLng[]): number {
  const pts = start ? [start, ...ordered] : ordered;
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += haversineKm(pts[i], pts[i + 1]);
  return total;
}

/** Google's directions URL accepts at most ~9 intermediate waypoints. */
export const MAX_WAYPOINTS = 9;

/**
 * Multi-stop Google Maps directions URL: origin (agent) → waypoints → last stop.
 * Google Maps opens it as a full route on iOS and Android. Returns the url plus
 * how many stops were dropped past the waypoint cap (0 if the whole route fits).
 */
export function multiStopMapsUrl(
  start: LatLng | null,
  ordered: LatLng[],
): { url: string; dropped: number } | null {
  if (!ordered.length) return null;
  const fmt = (p: LatLng) => `${p.lat},${p.lng}`;
  const seq = start ? [start, ...ordered] : [...ordered];
  if (seq.length === 1) return { url: `https://www.google.com/maps/dir/?api=1&destination=${fmt(seq[0])}&travelmode=driving`, dropped: 0 };
  const origin = seq[0];
  const middle = seq.slice(1, -1);
  const destination = seq[seq.length - 1];
  const waypoints = middle.slice(0, MAX_WAYPOINTS);
  const dropped = middle.length - waypoints.length;
  let q = `api=1&travelmode=driving&origin=${encodeURIComponent(fmt(origin))}&destination=${encodeURIComponent(fmt(destination))}`;
  if (waypoints.length) q += `&waypoints=${encodeURIComponent(waypoints.map(fmt).join('|'))}`;
  return { url: `https://www.google.com/maps/dir/?${q}`, dropped };
}

/** Open a single stop in the device's maps app (mirrors actions.navigateToAddress). */
export function openSingleStop(lat: number, lng: number) {
  const geo =
    Platform.OS === 'ios' ? `http://maps.apple.com/?daddr=${lat},${lng}` : `google.navigation:q=${lat},${lng}`;
  Linking.openURL(geo).catch(() =>
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`).catch(() => {}),
  );
}
