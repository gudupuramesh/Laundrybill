import { useEffect, useRef, useState } from 'react';
import { firestore } from './db';

// Session-lived cache of the last known live count, keyed by shop + period.
// Survives screen unmount/remount so the usage badge never flashes a stale
// fallback value while the snapshot re-attaches (fixes the "2/10 → 3/0" flicker).
const orderCountCache = new Map<string, number>();
const countKey = (shopId: string, periodKey: string | number) => `${shopId}|${periodKey}`;

/**
 * Start of the usage window: subscription billing period if set, else calendar month (local).
 */
export function getBillingPeriodStart(subscriptionData: any | null): Date {
  const raw = subscriptionData?.currentPeriodStart;
  if (raw) {
    if (typeof raw.toDate === 'function') return raw.toDate();
    if (raw.seconds != null) return new Date(raw.seconds * 1000);
  }
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function timestampFromDate(d: Date): any {
  try {
    const { Timestamp } = require('firebase/firestore');
    return Timestamp.fromDate(d);
  } catch {
    return d;
  }
}

/**
 * Live count of non-cancelled orders with createdAt >= billing period start.
 * Keeps UI accurate when subscription.usage.ordersThisMonth is not updated by the backend.
 */
export function useBillingPeriodOrderCount(
  shopId: string | null | undefined,
  subscriptionData: any | null
): number | null {
  const currentPeriodSeconds =
    subscriptionData?.currentPeriodStart?.seconds ??
    (subscriptionData?.currentPeriodStart &&
    typeof subscriptionData.currentPeriodStart.toDate === 'function'
      ? Math.floor(subscriptionData.currentPeriodStart.toDate().getTime() / 1000)
      : null);

  const now = new Date();
  const calendarMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const periodKey = currentPeriodSeconds ?? calendarMonthKey;
  const cacheKey = shopId ? countKey(shopId, periodKey) : null;

  // Seed from cache so a remount starts at the last known count, not null.
  const [count, setCount] = useState<number | null>(() =>
    cacheKey && orderCountCache.has(cacheKey) ? orderCountCache.get(cacheKey)! : null
  );

  useEffect(() => {
    if (!shopId) {
      setCount(null);
      return;
    }

    // Don't blank the count while re-attaching — keep the cached value visible.
    const seeded = cacheKey ? orderCountCache.get(cacheKey) : undefined;
    if (seeded !== undefined) setCount(seeded);

    const periodStart = getBillingPeriodStart(subscriptionData);
    const ts = timestampFromDate(periodStart);

    const fs = firestore();
    const q = fs
      .collection('shops')
      .doc(shopId)
      .collection('orders')
      .where('createdAt', '>=', ts)
      .orderBy('createdAt', 'desc');

    const unsub = q.onSnapshot(
      (snapshot: any) => {
        const docs = snapshot.docs || [];
        let n = 0;
        for (const d of docs) {
          const data = typeof d.data === 'function' ? d.data() : d.data;
          if (data?.status !== 'cancelled') n++;
        }
        if (cacheKey) orderCountCache.set(cacheKey, n);
        setCount(n);
      },
      (err: any) => {
        // Keep the last known value on a transient error — never flash to null,
        // which would make the badge fall back to the stale reported usage.
        console.warn('useBillingPeriodOrderCount', err?.message || err);
      }
    );

    return () => unsub();
  }, [shopId, currentPeriodSeconds, calendarMonthKey]);

  return count;
}

/**
 * Prefer the live Firestore count. While it's loading (null), hold the last
 * known live value rather than the backend's stale `usage.ordersThisMonth`,
 * which lags and caused the badge to jump (e.g. 2 → 3) on every screen change.
 */
export function useMergedOrdersUsed(
  subscriptionData: any | null,
  shopId: string | null | undefined
): number {
  const live = useBillingPeriodOrderCount(shopId, subscriptionData);
  const reported = subscriptionData?.usage?.ordersThisMonth ?? 0;
  const lastLive = useRef<number | null>(null);
  if (live !== null) lastLive.current = live;
  return live !== null ? live : lastLive.current ?? reported;
}
