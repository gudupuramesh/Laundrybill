/**
 * OpenStreetMap raster-tile helpers (keyless, no WebView) shared by the
 * location-capture sheet and the route-optimizer map. Slippy-map (Web Mercator)
 * projection: world pixels at zoom z, 256px tiles served from the OSM tile CDN.
 */
export const TILE = 256;

export type LatLng = { lat: number; lng: number };
export type Tile = { uri: string; left: number; top: number };

export const lngToWorldX = (lng: number, z: number) => ((lng + 180) / 360) * Math.pow(2, z) * TILE;
export const latToWorldY = (lat: number, z: number) => {
  const rad = (lat * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
  return y * Math.pow(2, z) * TILE;
};

/** Tiles + offsets to fill a w×h box centered on (centerLat,centerLng) at zoom z. */
export function tilesForView(centerLat: number, centerLng: number, w: number, h: number, z = 16): Tile[] {
  const n = Math.pow(2, z);
  const originX = lngToWorldX(centerLng, z) - w / 2;
  const originY = latToWorldY(centerLat, z) - h / 2;
  const tiles: Tile[] = [];
  for (let tx = Math.floor(originX / TILE); tx <= Math.floor((originX + w) / TILE); tx++) {
    for (let ty = Math.floor(originY / TILE); ty <= Math.floor((originY + h) / TILE); ty++) {
      if (ty < 0 || ty >= n) continue;
      const wx = ((tx % n) + n) % n;
      tiles.push({
        uri: `https://tile.openstreetmap.org/${z}/${wx}/${ty}.png`,
        left: tx * TILE - originX,
        top: ty * TILE - originY,
      });
    }
  }
  return tiles;
}

/** Pixel position of (lat,lng) inside a w×h box centered on (centerLat,centerLng) at zoom z. */
export function projectToBox(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  w: number,
  h: number,
  z: number,
): { x: number; y: number } {
  const originX = lngToWorldX(centerLng, z) - w / 2;
  const originY = latToWorldY(centerLat, z) - h / 2;
  return { x: lngToWorldX(lng, z) - originX, y: latToWorldY(lat, z) - originY };
}

/** Geographic center of a set of points (midpoint of their bounding box). */
export function boundsCenter(points: LatLng[]): LatLng {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  };
}

/** Largest zoom (≤ maxZoom) at which every point fits within a padded w×h box. */
export function fitZoom(points: LatLng[], w: number, h: number, pad = 0.82, maxZoom = 16, minZoom = 2): number {
  if (points.length <= 1) return maxZoom;
  const c = boundsCenter(points);
  for (let z = maxZoom; z >= minZoom; z--) {
    const cx = lngToWorldX(c.lng, z);
    const cy = latToWorldY(c.lat, z);
    const fits = points.every((p) => {
      const dx = Math.abs(lngToWorldX(p.lng, z) - cx);
      const dy = Math.abs(latToWorldY(p.lat, z) - cy);
      return dx <= (w / 2) * pad && dy <= (h / 2) * pad;
    });
    if (fits) return z;
  }
  return minZoom;
}
