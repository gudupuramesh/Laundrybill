/**
 * All shops with location for Super Admin map view.
 * Fetches shops that have latitude/longitude (from registration/settings).
 */

import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Shop } from "@/types/shop";

const MAX_SHOPS = 3000;

export interface ShopMapPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export function useAllShopsForMap(): {
  pins: ShopMapPin[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [pins, setPins] = useState<ShopMapPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await getDocs(
        query(collection(db, "shops"), limit(MAX_SHOPS))
      );
      const items: ShopMapPin[] = [];
      snapshot.docs.forEach((d) => {
        const data = d.data() as Shop;
        const loc = data.location;
        const lat = loc?.latitude;
        const lng = loc?.longitude;
        if (typeof lat !== "number" || typeof lng !== "number") return;
        items.push({
          id: d.id,
          name: data.name || "Shop",
          lat,
          lng,
          address: loc?.address,
          city: loc?.city,
          state: loc?.state,
          pincode: loc?.pincode,
        });
      });
      setPins(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load shops");
      setPins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { pins, loading, error, refresh: load };
}
