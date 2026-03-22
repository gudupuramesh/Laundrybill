/**
 * Shop category/service analytics – most used categories and average bill per category
 */

import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface CategoryStat {
  categoryName: string;
  orderCount: number;
  totalAmount: number;
  avgOrderValue: number;
}

export interface ShopCategoryStatsResult {
  byCategory: CategoryStat[];
  overallAvgOrderValue: number;
  totalOrders: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const MAX_ORDERS = 2000;

export function useShopCategoryStats(shopId: string | null): ShopCategoryStatsResult {
  const [byCategory, setByCategory] = useState<CategoryStat[]>([]);
  const [overallAvgOrderValue, setOverallAvgOrderValue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!shopId) {
      setByCategory([]);
      setOverallAvgOrderValue(0);
      setTotalOrders(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ordersRef = collection(db, "shops", shopId, "orders");
      const q = query(ordersRef, limit(MAX_ORDERS));
      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map((d) => {
        const data = d.data();
        const total = data.financials?.total ?? data.total ?? 0;
        const items = (data.items || []) as Array<{ categoryName?: string; categoryId?: string }>;
        const categories = new Set<string>();
        items.forEach((item) => {
          const name = item.categoryName || item.categoryId || "Other";
          categories.add(name);
        });
        return { total: typeof total === "number" ? total : 0, categories };
      });

      setTotalOrders(orders.length);

      const categoryToOrders = new Map<string, { totalAmount: number; orderCount: number }>();
      let sumAllTotals = 0;

      orders.forEach((order) => {
        sumAllTotals += order.total;
        order.categories.forEach((cat) => {
          const prev = categoryToOrders.get(cat) ?? { totalAmount: 0, orderCount: 0 };
          categoryToOrders.set(cat, {
            totalAmount: prev.totalAmount + order.total,
            orderCount: prev.orderCount + 1,
          });
        });
      });

      const list: CategoryStat[] = Array.from(categoryToOrders.entries())
        .map(([categoryName, { orderCount, totalAmount }]) => ({
          categoryName,
          orderCount,
          totalAmount,
          avgOrderValue: orderCount > 0 ? totalAmount / orderCount : 0,
        }))
        .sort((a, b) => b.orderCount - a.orderCount);

      setByCategory(list);
      setOverallAvgOrderValue(orders.length > 0 ? sumAllTotals / orders.length : 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load category stats");
      setByCategory([]);
      setOverallAvgOrderValue(0);
      setTotalOrders(0);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    byCategory,
    overallAvgOrderValue,
    totalOrders,
    loading,
    error,
    refresh: load,
  };
}
