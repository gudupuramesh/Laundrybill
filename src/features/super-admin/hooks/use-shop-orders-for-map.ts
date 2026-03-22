/**
 * Orders with delivery/pickup coordinates for Super Admin delivery map.
 * Optional filters: month (this month, last month, all) and delivery type.
 */

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import type { DeliveryType } from "@/types/order";

export interface OrderMapPin {
  id: string;
  orderNumber: string;
  deliveryLat: number;
  deliveryLng: number;
  deliveryAddress?: string;
  deliveryType: DeliveryType;
  createdAt: Date;
  categoryNames: string[];
}

export type MapMonthFilter = "this" | "last" | "all";
export type MapDeliveryFilter = "all" | "delivery_home" | "pickup_home";

export interface UseShopOrdersForMapOptions {
  month?: MapMonthFilter;
  deliveryType?: MapDeliveryFilter;
}

const MAX_ORDERS = 1500;

function getMonthRange(month: MapMonthFilter): { start: Date; end: Date } | null {
  if (month === "all") return null;
  const now = new Date();
  const ref = month === "this" ? now : subMonths(now, 1);
  return {
    start: startOfMonth(ref),
    end: endOfMonth(ref),
  };
}

export function useShopOrdersForMap(
  shopId: string | null,
  options: UseShopOrdersForMapOptions = {}
): {
  pins: OrderMapPin[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const { month = "all", deliveryType: deliveryFilter = "all" } = options;
  const [pins, setPins] = useState<OrderMapPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!shopId) {
      setPins([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ordersRef = collection(db, "shops", shopId, "orders");
      const range = getMonthRange(month);
      const q = range
        ? query(
            ordersRef,
            where("createdAt", ">=", Timestamp.fromDate(range.start)),
            where("createdAt", "<=", Timestamp.fromDate(range.end)),
            limit(MAX_ORDERS)
          )
        : query(ordersRef, limit(MAX_ORDERS));
      const snapshot = await getDocs(q);
      const items: OrderMapPin[] = [];
      snapshot.docs.forEach((d) => {
        const data = d.data();
        const lat = data.deliveryLat;
        const lng = data.deliveryLng;
        if (typeof lat !== "number" || typeof lng !== "number") return;
        const type = (data.deliveryType || "delivery_home") as DeliveryType;
        if (deliveryFilter !== "all" && type !== deliveryFilter) return;
        const itemsList = (data.items || []) as Array<{ categoryName?: string }>;
        const categoryNames = itemsList
          .map((i) => i.categoryName)
          .filter(Boolean) as string[];
        items.push({
          id: d.id,
          orderNumber: data.orderNumber || d.id,
          deliveryLat: lat,
          deliveryLng: lng,
          deliveryAddress: data.deliveryAddress,
          deliveryType: type,
          createdAt: data.createdAt?.toDate?.() ?? new Date(),
          categoryNames: [...new Set(categoryNames)],
        });
      });
      setPins(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load map data");
      setPins([]);
    } finally {
      setLoading(false);
    }
  }, [shopId, month, deliveryFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return { pins, loading, error, refresh: load };
}
