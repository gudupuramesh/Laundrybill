/**
 * Driver tasks — pickup & delivery tasks for the current agent, derived from
 * orders where assignedAgentId == agent.id. Ported from the web
 * `src/features/driver-app/hooks/use-driver-tasks.ts` to the RN chained facade.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { firestore } from '../lib/firebase';
import { useDriverAuth } from '../lib/DriverAuthContext';
import type {
  Order,
  OrderStatus,
  OrderItem,
  PaymentStatus,
  OrderFinancials,
} from '../types/order';

export type TaskType = 'pickup' | 'delivery';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type TaskPriority = 'normal' | 'express' | 'urgent';

const EMPTY_FIN: OrderFinancials = {
  subtotal: 0,
  discountAmount: 0,
  expressCharge: 0,
  deliveryCharge: 0,
  total: 0,
  amountPaid: 0,
  balance: 0,
} as OrderFinancials;

export interface DriverTask {
  id: string;
  type: TaskType;
  orderId: string;
  /** The full raw order doc — used by the agent's full edit-order flow. */
  raw: Order;
  orderPublicId: string;
  customer: { name: string; phone: string; address: string };
  itemCount: number;
  items: OrderItem[];
  financials: OrderFinancials;
  amountToCollect?: number;
  orderTotal?: number;
  previouslyPaid?: number;
  paymentStatus?: PaymentStatus;
  scheduledDate: Date;
  expectedDelivery?: Date;
  pickupPhoto?: string;
  deliveryPhoto?: string;
  timeSlot?: { start: string; end: string };
  priority: TaskPriority;
  status: TaskStatus;
  orderStatus: OrderStatus;
  instructions?: string;
  orderSource?: 'online' | 'pos' | 'phone';
}

interface UseDriverTasksOptions {
  type?: TaskType;
  status?: TaskStatus;
  date?: Date;
}

export function useDriverTasks(options: UseDriverTasksOptions = {}) {
  const { agent, shopId } = useDriverAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId || !agent?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = firestore()
      .collection(`shops/${shopId}/orders`)
      .where('assignedAgentId', '==', agent.id)
      .onSnapshot(
        (snapshot) => {
          const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Order[];
          setOrders(list);
          setLoading(false);
        },
        (err) => {
          console.error('Driver tasks snapshot error:', err);
          setLoading(false);
        },
      );
    return () => unsubscribe();
  }, [shopId, agent?.id]);

  const pickupTasks = useMemo((): DriverTask[] => {
    return orders
      .filter((order) => order.deliveryType === 'pickup_home' && order.status !== 'cancelled')
      .map((order) => {
        const isPickupDone = !['pending', 'pickup_scheduled'].includes(order.status);
        return {
          id: `pickup-${order.id}`,
          type: 'pickup' as TaskType,
          raw: order,
          orderId: order.id,
          orderPublicId: order.publicId || order.orderNumber,
          customer: {
            name: order.customerName,
            phone: order.customerPhone,
            address: order.pickupAddress || order.deliveryAddress || order.customerAddress || '',
          },
          itemCount: order.items?.length || 0,
          items: order.items || [],
          financials: order.financials || EMPTY_FIN,
          scheduledDate: order.scheduledPickupDate?.toDate() || order.createdAt?.toDate() || new Date(),
          expectedDelivery: order.expectedDelivery?.toDate(),
          pickupPhoto: order.pickupPhoto,
          deliveryPhoto: order.deliveryPhoto,
          timeSlot: order.scheduledPickupTime ? { start: order.scheduledPickupTime, end: '' } : undefined,
          priority: 'normal' as TaskPriority,
          status: (isPickupDone ? 'completed' : 'pending') as TaskStatus,
          orderStatus: order.status,
        };
      });
  }, [orders]);

  const deliveryTasks = useMemo((): DriverTask[] => {
    return orders
      .filter((order) => {
        if (!['delivery_home', 'pickup_home'].includes(order.deliveryType)) return false;
        return ['processing', 'pickup_completed', 'ready', 'out_for_delivery', 'delivered'].includes(order.status);
      })
      .map((order) => ({
        id: `delivery-${order.id}`,
        type: 'delivery' as TaskType,
        raw: order,
        orderId: order.id,
        orderPublicId: order.publicId || order.orderNumber,
        customer: {
          name: order.customerName,
          phone: order.customerPhone,
          address: order.deliveryAddress || order.customerAddress || '',
        },
        itemCount: order.items?.length || 0,
        items: order.items || [],
        financials: order.financials || EMPTY_FIN,
        amountToCollect: order.financials?.balance || 0,
        orderTotal: order.financials?.total || 0,
        previouslyPaid: order.financials?.amountPaid || 0,
        paymentStatus: (order.paymentStatus as PaymentStatus) || 'unpaid',
        scheduledDate: order.expectedDelivery?.toDate() || new Date(),
        expectedDelivery: order.expectedDelivery?.toDate(),
        pickupPhoto: order.pickupPhoto,
        deliveryPhoto: order.deliveryPhoto,
        priority: 'normal' as TaskPriority,
        status: (order.status === 'delivered' ? 'completed' : 'pending') as TaskStatus,
        orderStatus: order.status,
        orderSource: order.orderSource,
      }));
  }, [orders]);

  const filteredTasks = useMemo(() => {
    let tasks =
      options.type === 'pickup'
        ? pickupTasks
        : options.type === 'delivery'
          ? deliveryTasks
          : [...pickupTasks, ...deliveryTasks];
    if (options.status) tasks = tasks.filter((t) => t.status === options.status);
    if (options.date) {
      const dateStr = options.date.toDateString();
      tasks = tasks.filter((t) => t.scheduledDate.toDateString() === dateStr);
    }
    return tasks.sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());
  }, [pickupTasks, deliveryTasks, options.type, options.status, options.date]);

  const todayStats = useMemo(() => {
    const todayStr = new Date().toDateString();
    const todayPickupOrders = orders.filter(
      (o) =>
        o.deliveryType === 'pickup_home' &&
        o.status !== 'cancelled' &&
        (o.scheduledPickupDate?.toDate()?.toDateString() === todayStr ||
          o.createdAt?.toDate()?.toDateString() === todayStr),
    );
    const todayDeliveryOrders = orders.filter(
      (o) =>
        ['delivery_home', 'pickup_home'].includes(o.deliveryType) &&
        o.status !== 'cancelled' &&
        (o.expectedDelivery?.toDate()?.toDateString() === todayStr ||
          (o.status === 'delivered' && o.deliveredAt?.toDate()?.toDateString() === todayStr)),
    );
    const todayCollected = orders
      .filter((o) => o.status === 'delivered' && o.deliveredAt?.toDate()?.toDateString() === todayStr)
      .reduce((sum, o) => sum + (o.financials?.amountPaid || 0), 0);

    return {
      pickups: {
        completed: todayPickupOrders.filter((o) => !['pending', 'pickup_scheduled'].includes(o.status)).length,
        total: todayPickupOrders.length,
      },
      deliveries: {
        completed: todayDeliveryOrders.filter((o) => o.status === 'delivered').length,
        total: todayDeliveryOrders.length,
      },
      collected: todayCollected,
    };
  }, [orders]);

  const lifetimeStats = useMemo(() => {
    return {
      pickupsCompleted: orders.filter(
        (o) => o.deliveryType === 'pickup_home' && !['pending', 'pickup_scheduled', 'cancelled'].includes(o.status),
      ).length,
      deliveriesCompleted: orders.filter(
        (o) => ['delivery_home', 'pickup_home'].includes(o.deliveryType) && o.status === 'delivered',
      ).length,
    };
  }, [orders]);

  return { tasks: filteredTasks, pickupTasks, deliveryTasks, todayStats, lifetimeStats, loading };
}

export function useCompletePickup() {
  const { shopId, agent } = useDriverAuth();
  const [loading, setLoading] = useState(false);

  const completePickup = useCallback(
    async (orderId: string, data: { itemsCollected: number; photoUrl?: string; notes?: string }) => {
      if (!shopId) throw new Error('No shop ID');
      setLoading(true);
      try {
        const timelineEvent = {
          id: `t-${Date.now()}`,
          status: 'pickup_completed' as OrderStatus,
          timestamp: firestore.Timestamp.now(),
          staffId: agent?.id || 'agent',
          staffName: agent?.name || 'Pickup Agent',
          notes: data.notes || 'Items collected from customer',
          notifiedCustomer: true,
        };
        await firestore().doc(`shops/${shopId}/orders/${orderId}`).update({
          status: 'pickup_completed',
          pickupCompletedAt: firestore.FieldValue.serverTimestamp(),
          pickupNotes: data.notes || null,
          pickupPhoto: data.photoUrl || null,
          itemsCollected: data.itemsCollected,
          timeline: firestore.FieldValue.arrayUnion(timelineEvent),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
        setLoading(false);
        return true;
      } catch (error) {
        console.error('Failed to complete pickup:', error);
        setLoading(false);
        throw error;
      }
    },
    [shopId, agent],
  );

  return { completePickup, loading };
}

export function useCompleteDelivery() {
  const { shopId, agent } = useDriverAuth();
  const [loading, setLoading] = useState(false);

  const completeDelivery = useCallback(
    async (
      orderId: string,
      data: {
        collectedAmount: number;
        paymentMethod: 'cash' | 'upi' | 'paid_already';
        photoUrl?: string;
        signature?: string;
        notes?: string;
      },
      orderTotal?: number,
      previouslyPaid?: number,
    ) => {
      if (!shopId) throw new Error('No shop ID');
      setLoading(true);
      try {
        const totalPaid = (previouslyPaid || 0) + (data.paymentMethod === 'paid_already' ? 0 : data.collectedAmount);
        const total = orderTotal || 0;
        const newBalance = Math.max(0, total - totalPaid);

        let paymentStatus: 'paid' | 'partial' | 'unpaid' = 'unpaid';
        if (data.paymentMethod === 'paid_already' || newBalance <= 0) paymentStatus = 'paid';
        else if (totalPaid > 0) paymentStatus = 'partial';

        const timelineEvent = {
          id: `t-${Date.now()}`,
          status: 'delivered' as OrderStatus,
          timestamp: firestore.Timestamp.now(),
          staffId: agent?.id || 'agent',
          staffName: agent?.name || 'Delivery Agent',
          notes: data.notes || 'Order delivered',
          notifiedCustomer: true,
        };

        await firestore().doc(`shops/${shopId}/orders/${orderId}`).update({
          status: 'delivered',
          deliveredAt: firestore.FieldValue.serverTimestamp(),
          deliveryNotes: data.notes || null,
          deliveryPhoto: data.photoUrl || null,
          deliverySignature: data.signature || null,
          collectedAmount: data.collectedAmount,
          collectedPaymentMethod: data.paymentMethod,
          paymentStatus,
          'financials.amountPaid': totalPaid,
          'financials.balance': newBalance,
          timeline: firestore.FieldValue.arrayUnion(timelineEvent),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
        setLoading(false);
        return true;
      } catch (error) {
        console.error('Failed to complete delivery:', error);
        setLoading(false);
        throw error;
      }
    },
    [shopId, agent],
  );

  return { completeDelivery, loading };
}

/**
 * Record a payment against an order WITHOUT changing its status — used when a
 * customer pays at pickup (or any time there's a balance). Updates
 * financials.amountPaid / balance and recomputes paymentStatus.
 */
export function useCollectPayment() {
  const { shopId, agent } = useDriverAuth();
  const [loading, setLoading] = useState(false);

  const collectPayment = useCallback(
    async (
      orderId: string,
      data: {
        amount: number;
        method: 'cash' | 'upi' | 'paid_already';
        notes?: string;
        currentStatus: OrderStatus;
      },
      orderTotal?: number,
      previouslyPaid?: number,
    ) => {
      if (!shopId) throw new Error('No shop ID');
      setLoading(true);
      try {
        const total = orderTotal || 0;
        const newPaid =
          data.method === 'paid_already' ? total : (previouslyPaid || 0) + (data.amount || 0);
        const newBalance = Math.max(0, total - newPaid);

        let paymentStatus: 'paid' | 'partial' | 'unpaid' = 'unpaid';
        if (newBalance <= 0) paymentStatus = 'paid';
        else if (newPaid > 0) paymentStatus = 'partial';

        const collected = data.method === 'paid_already' ? Math.max(0, total - (previouslyPaid || 0)) : data.amount;
        const timelineEvent = {
          id: `t-${Date.now()}`,
          status: data.currentStatus,
          timestamp: firestore.Timestamp.now(),
          staffId: agent?.id || 'agent',
          staffName: agent?.name || 'Agent',
          notes: `Payment collected: ${collected} (${data.method})${data.notes ? ` — ${data.notes}` : ''}`,
          notifiedCustomer: false,
        };

        await firestore().doc(`shops/${shopId}/orders/${orderId}`).update({
          paymentStatus,
          collectedAmount: collected,
          collectedPaymentMethod: data.method,
          'financials.amountPaid': newPaid,
          'financials.balance': newBalance,
          timeline: firestore.FieldValue.arrayUnion(timelineEvent),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
        setLoading(false);
        return true;
      } catch (error) {
        console.error('Failed to collect payment:', error);
        setLoading(false);
        throw error;
      }
    },
    [shopId, agent],
  );

  return { collectPayment, loading };
}
