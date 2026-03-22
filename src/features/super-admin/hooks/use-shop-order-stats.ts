/**
 * Shop order stats for Super Admin – count and total amount by period
 */

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

export interface OrderPeriodStats {
  count: number;
  totalAmount: number;
}

export interface ShopOrderStatsResult {
  thisMonth: OrderPeriodStats;
  lastMonth: OrderPeriodStats;
  overall: OrderPeriodStats;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function getMonthRange(monthOffset: 0 | -1): { start: Date; end: Date } {
  const now = new Date();
  const ref = monthOffset === 0 ? now : subMonths(now, 1);
  return {
    start: startOfMonth(ref),
    end: endOfMonth(ref),
  };
}

async function fetchOrdersInRange(
  shopId: string,
  start: Date,
  end: Date
): Promise<OrderPeriodStats> {
  const q = query(
    collection(db, "shops", shopId, "orders"),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<=", Timestamp.fromDate(end))
  );
  const snapshot = await getDocs(q);
  let count = 0;
  let totalAmount = 0;
  snapshot.docs.forEach((d) => {
    const data = d.data();
    count += 1;
    const total = data.financials?.total ?? data.total ?? 0;
    totalAmount += typeof total === "number" ? total : 0;
  });
  return { count, totalAmount };
}

async function fetchOverallStats(shopId: string): Promise<OrderPeriodStats> {
  const q = collection(db, "shops", shopId, "orders");
  const snapshot = await getDocs(q);
  let count = 0;
  let totalAmount = 0;
  snapshot.docs.forEach((d) => {
    const data = d.data();
    count += 1;
    const total = data.financials?.total ?? data.total ?? 0;
    totalAmount += typeof total === "number" ? total : 0;
  });
  return { count, totalAmount };
}

export function useShopOrderStats(shopId: string | null): ShopOrderStatsResult {
  const [thisMonth, setThisMonth] = useState<OrderPeriodStats>({
    count: 0,
    totalAmount: 0,
  });
  const [lastMonth, setLastMonth] = useState<OrderPeriodStats>({
    count: 0,
    totalAmount: 0,
  });
  const [overall, setOverall] = useState<OrderPeriodStats>({
    count: 0,
    totalAmount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!shopId) {
      setThisMonth({ count: 0, totalAmount: 0 });
      setLastMonth({ count: 0, totalAmount: 0 });
      setOverall({ count: 0, totalAmount: 0 });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { start: thisStart, end: thisEnd } = getMonthRange(0);
      const { start: lastStart, end: lastEnd } = getMonthRange(-1);

      const [thisMonthStats, lastMonthStats, overallStats] = await Promise.all([
        fetchOrdersInRange(shopId, thisStart, thisEnd),
        fetchOrdersInRange(shopId, lastStart, lastEnd),
        fetchOverallStats(shopId),
      ]);

      setThisMonth(thisMonthStats);
      setLastMonth(lastMonthStats);
      setOverall(overallStats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load order stats");
      setThisMonth({ count: 0, totalAmount: 0 });
      setLastMonth({ count: 0, totalAmount: 0 });
      setOverall({ count: 0, totalAmount: 0 });
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    thisMonth,
    lastMonth,
    overall,
    loading,
    error,
    refresh: load,
  };
}
