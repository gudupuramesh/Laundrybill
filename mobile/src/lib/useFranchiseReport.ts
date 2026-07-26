/**
 * Franchise master report (owner app) — per-branch financials over a period.
 * Same semantics as the web master dashboard and the single-shop Reports:
 *   revenue     = Σ financials.total   of non-cancelled orders (createdAt range)
 *   collected   = Σ financials.amountPaid
 *   outstanding = Σ positive balances
 *   expenses    = Σ shops/{id}/expenses.amount (date range)
 *   profit      = revenue − expenses
 * Growth compares revenue with the equal-length previous period.
 */
import { useState, useEffect } from 'react';
import { firestore } from './firebase';
import type { OwnedShop } from './activeShop';

export interface BranchReport {
  shopId: string;
  name: string;
  orders: number;
  revenue: number;
  collected: number;
  outstanding: number;
  expenses: number;
  profit: number;
  avgOrder: number;
  prevRevenue: number;
  growthPct: number;
}

async function reportForShop(
  shop: OwnedShop,
  start: Date,
  end: Date,
  prevStart: Date,
  prevEnd: Date,
): Promise<BranchReport> {
  const fs = firestore();
  const ordersPath = `shops/${shop.id}/orders`;
  const expensesPath = `shops/${shop.id}/expenses`;

  const [ordersSnap, prevSnap, expSnap] = await Promise.all([
    fs.collection(ordersPath).where('createdAt', '>=', start).where('createdAt', '<=', end).get(),
    fs.collection(ordersPath).where('createdAt', '>=', prevStart).where('createdAt', '<=', prevEnd).get(),
    fs.collection(expensesPath).where('date', '>=', start).where('date', '<=', end).get(),
  ]);

  let orders = 0;
  let revenue = 0;
  let collected = 0;
  let outstanding = 0;
  ordersSnap.docs.forEach((d: any) => {
    const o = d.data() || {};
    if (o.status === 'cancelled') return;
    const total = o.financials?.total || 0;
    const paid = o.financials?.amountPaid || 0;
    const balance = o.financials?.balance ?? total - paid;
    orders += 1;
    revenue += total;
    collected += paid;
    outstanding += balance > 0 ? balance : 0;
  });

  let prevRevenue = 0;
  prevSnap.docs.forEach((d: any) => {
    const o = d.data() || {};
    if (o.status === 'cancelled') return;
    prevRevenue += o.financials?.total || 0;
  });

  let expenses = 0;
  expSnap.docs.forEach((d: any) => {
    expenses += (d.data() || {}).amount || 0;
  });

  const profit = revenue - expenses;
  return {
    shopId: shop.id,
    name: shop.name,
    orders,
    revenue,
    collected,
    outstanding,
    expenses,
    profit,
    avgOrder: orders > 0 ? revenue / orders : 0,
    prevRevenue,
    growthPct: prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0,
  };
}

export function useFranchiseReport(
  shops: OwnedShop[],
  start: Date,
  end: Date,
  prevStart: Date,
  prevEnd: Date,
  reloadKey = 0,
): { reports: BranchReport[]; loading: boolean } {
  const [reports, setReports] = useState<BranchReport[]>([]);
  const [loading, setLoading] = useState(true);

  const shopsKey = shops.map((s) => s.id).join(',');
  const rangeKey = `${start.getTime()}_${end.getTime()}`;

  useEffect(() => {
    if (!shops.length) {
      setReports([]);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    Promise.all(shops.map((s) => reportForShop(s, start, end, prevStart, prevEnd)))
      .then((r) => {
        if (alive) setReports(r);
      })
      .catch((e) => {
        console.warn('Franchise report failed:', e);
        if (alive) setReports([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopsKey, rangeKey, reloadKey]);

  return { reports, loading };
}
