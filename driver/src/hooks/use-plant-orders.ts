/**
 * Plant orders — buckets + status transitions for the Plant role, ported 1:1
 * from the web `src/features/plant-app/hooks/use-plant-orders.ts` to the RN
 * chained facade. Orders live at shops/{shopId}/orders.
 *
 * Generic: `usePlantOrders(statuses)` streams orders whose status is in the set
 * (sorted updatedAt desc client-side to avoid a composite-index dependency).
 * The four buckets are defined by the caller screens:
 *   inbound     → ['pickup_completed','pending'] then filterInbound()
 *   processing  → ['processing']
 *   ready       → ['ready','ready_for_pickup']
 *   completed   → ['delivered','picked_up']  (history)
 */
import { useState, useEffect, useCallback } from 'react';
import { firestore } from '../lib/firebase';
import { useDriverAuth } from '../lib/DriverAuthContext';
import type { Order, OrderStatus } from '../types/order';

function tsMillis(v: any): number {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return 0;
}

/**
 * Inbound = clothes physically at the shop and awaiting processing:
 * all `pickup_completed`, plus `pending` that is NOT an un-collected home pickup.
 * Mirrors the web in-memory filter exactly.
 */
export function filterInbound(orders: Order[]): Order[] {
  return orders.filter((o) => {
    if (o.status === 'pickup_completed') return true;
    if (o.status === 'pending' && o.deliveryType !== 'pickup_home') return true;
    return false;
  });
}

export function usePlantOrders(statuses: OrderStatus[]) {
  const { shopId, agent } = useDriverAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stringify to avoid re-subscribing on array identity changes.
  const statusKey = JSON.stringify(statuses);

  useEffect(() => {
    if (!shopId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    let unsub: (() => void) | undefined;
    try {
      unsub = firestore()
        .collection(`shops/${shopId}/orders`)
        .where('status', 'in', JSON.parse(statusKey))
        .onSnapshot(
          (snap) => {
            const list = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as object) }) as Order)
              .sort((a, b) => tsMillis(b.updatedAt) - tsMillis(a.updatedAt));
            setOrders(list);
            setLoading(false);
          },
          (err) => {
            console.error('Plant orders snapshot error:', err);
            setError('Failed to load orders');
            setLoading(false);
          },
        );
    } catch (err) {
      console.error('Plant orders query error:', err);
      setError('Failed to load orders');
      setLoading(false);
    }
    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, statusKey]);

  /** Append a timeline event + status + updatedAt to an order (matches web/driver shape). */
  const writeTransition = useCallback(
    async (orderId: string, status: OrderStatus, notes: string) => {
      if (!shopId) throw new Error('Not authenticated');
      const timelineEvent = {
        id: `t-${Date.now()}`,
        status,
        timestamp: firestore.Timestamp.now(),
        staffId: agent?.id || 'plant',
        staffName: agent?.name || 'Plant',
        notes,
        notifiedCustomer: false,
      };
      await firestore().doc(`shops/${shopId}/orders/${orderId}`).update({
        status,
        updatedAt: firestore.FieldValue.serverTimestamp(),
        timeline: firestore.FieldValue.arrayUnion(timelineEvent),
      });
    },
    [shopId, agent],
  );

  const startProcessing = useCallback(
    (orderId: string) => writeTransition(orderId, 'processing', 'Started processing at plant'),
    [writeTransition],
  );

  const markReady = useCallback(
    (orderId: string, order: Order) => {
      const status: OrderStatus = order.deliveryType === 'pickup_store' ? 'ready_for_pickup' : 'ready';
      const notes = order.deliveryType === 'pickup_store' ? 'Ready for customer pickup' : 'Processing completed';
      return writeTransition(orderId, status, notes);
    },
    [writeTransition],
  );

  const markOutForDelivery = useCallback(
    (orderId: string, order: Order) => {
      if (order.deliveryType === 'pickup_store') {
        throw new Error('Shop Pickup orders cannot be dispatched for delivery');
      }
      return writeTransition(orderId, 'out_for_delivery', 'Dispatched from plant');
    },
    [writeTransition],
  );

  return { orders, loading, error, startProcessing, markReady, markOutForDelivery };
}
