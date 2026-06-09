import { useEffect, useState } from 'react';
import { firestore } from './db';

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
  const [count, setCount] = useState<number | null>(null);

  const currentPeriodSeconds =
    subscriptionData?.currentPeriodStart?.seconds ??
    (subscriptionData?.currentPeriodStart &&
    typeof subscriptionData.currentPeriodStart.toDate === 'function'
      ? Math.floor(subscriptionData.currentPeriodStart.toDate().getTime() / 1000)
      : null);

  const now = new Date();
  const calendarMonthKey = `${now.getFullYear()}-${now.getMonth()}`;

  useEffect(() => {
    if (!shopId) {
      setCount(null);
      return;
    }

    setCount(null);
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
        setCount(n);
      },
      (err: any) => {
        console.warn('useBillingPeriodOrderCount', err?.message || err);
        setCount(null);
      }
    );

    return () => unsub();
  }, [shopId, currentPeriodSeconds, calendarMonthKey]);

  return count;
}

/**
 * Prefer live Firestore count; fall back to subscription.usage.ordersThisMonth when the query fails.
 */
export function useMergedOrdersUsed(
  subscriptionData: any | null,
  shopId: string | null | undefined
): number {
  const live = useBillingPeriodOrderCount(shopId, subscriptionData);
  const reported = subscriptionData?.usage?.ordersThisMonth ?? 0;
  return live !== null ? live : reported;
}
