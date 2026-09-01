/**
 * Paginated Orders Hook
 * 
 * Fetches orders with pagination and infinite scroll support
 * Reduces Firestore read costs by 95%+ compared to loading all orders
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    onSnapshot,
    getDocs,
    DocumentSnapshot,
    QueryConstraint,
    Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/features/auth/AuthContext';
import type { Order, OrderStatus, DeliveryType } from '@/types/order';
import { PAGINATION } from '@/constants/pagination';
import { startOfToday, endOfToday } from 'date-fns';

export type OrderSourceFilter = 'all' | 'online' | 'pos';

interface UseOrdersOptions {
    status?: OrderStatus | 'all';
    deliveryType?: DeliveryType | 'all';
    orderSource?: OrderSourceFilter;
    searchTerm?: string;
    specialFilter?: 'pending_overdue' | 'payment_due' | 'scheduled_upcoming' | null;
    /** Filter by order creation date. Reuses the createdAt ordering, so no new index needed. */
    dateStart?: Date | null;
    dateEnd?: Date | null;
}

/**
 * When a scheduled order is next DUE: the home-pickup date while it's still
 * awaiting pickup, otherwise the expected delivery. Used to sort the Scheduled
 * list soonest-first and to label rows.
 */
export function upcomingAt(order: Order): Date | null {
    const awaitingPickup =
        order.deliveryType === 'pickup_home' && ['pending', 'pickup_scheduled'].includes(order.status);
    const src = awaitingPickup ? order.scheduledPickupDate : order.expectedDelivery;
    return src?.toDate?.() ?? null;
}

function upcomingAtMillis(order: Order): number {
    return upcomingAt(order)?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

interface UseOrdersReturn {
    orders: Order[];
    loading: boolean;
    loadingMore: boolean;
    error: string | null;
    hasMore: boolean;
    totalCount: number;
    loadMore: () => Promise<void>;
    refresh: () => void;
}

export function useOrdersPaginated(options: UseOrdersOptions = {}): UseOrdersReturn {
    const { shopId } = useAuth();
    const { status = 'all', deliveryType = 'all', orderSource = 'all', searchTerm, specialFilter, dateStart, dateEnd } = options;
    const dateStartMs = dateStart ? dateStart.getTime() : null;
    const dateEndMs = dateEnd ? dateEnd.getTime() : null;

    // The period chip (Today / This Week / This Month …) also applies to the
    // special views (Due / Overdue / Scheduled). Those load their full result
    // set client-side, so the creation-date range is applied here instead of
    // in the Firestore query.
    const inDateRange = (o: Order): boolean => {
        const ms = o.createdAt?.toMillis?.() || 0;
        if (dateStartMs && ms < dateStartMs) return false;
        if (dateEndMs && ms > dateEndMs) return false;
        return true;
    };

    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [totalCount, setTotalCount] = useState(0);

    const lastDocRef = useRef<DocumentSnapshot | null>(null);
    const unsubscribeRef = useRef<(() => void) | null>(null);

    // Build query constraints
    const buildConstraints = useCallback((): QueryConstraint[] => {
        const constraints: QueryConstraint[] = [
            orderBy('createdAt', 'desc'),
        ];

        if (status !== 'all') {
            constraints.unshift(where('status', '==', status));
        }

        if (deliveryType !== 'all') {
            constraints.unshift(where('deliveryType', '==', deliveryType));
        }

        if (orderSource === 'online') {
            constraints.unshift(where('orderSource', '==', 'online'));
        }

        // Creation-date range — same field as the orderBy above, so it reuses the
        // existing (status/deliveryType/orderSource + createdAt) indexes.
        if (dateStartMs) constraints.push(where('createdAt', '>=', Timestamp.fromDate(new Date(dateStartMs))));
        if (dateEndMs) constraints.push(where('createdAt', '<=', Timestamp.fromDate(new Date(dateEndMs))));

        return constraints;
    }, [status, deliveryType, orderSource, dateStartMs, dateEndMs]);

    // Initial load with real-time updates
    useEffect(() => {
        if (!shopId) {
            setLoading(false);
            return;
        }

        // Cleanup previous subscription
        if (unsubscribeRef.current) {
            unsubscribeRef.current();
        }

        setLoading(true);
        setOrders([]);
        lastDocRef.current = null;

        // HANDLE SPECIAL FILTERS
        if (specialFilter === 'pending_overdue') {
            // "Pending/Overdue" = Missed Delivery OR Missed Pickup
            // Complex merged query - One-time fetch (no real-time pagination for merged queries for simplicity)
            const fetchOverdue = async () => {
                try {
                    const today = startOfToday();
                    const ordersRef = collection(db, 'shops', shopId, 'orders');

                    const activeStatuses = [
                        "pending", "processing", "ready", "ready_for_pickup",
                        "out_for_delivery", "pickup_scheduled", "pickup_completed",
                        "partially_delivered"
                    ];

                    const deliveryQuery = query(
                        ordersRef,
                        where("expectedDelivery", "<", Timestamp.fromDate(today)),
                        where("status", "in", activeStatuses)
                    );

                    const pickupQuery = query(
                        ordersRef,
                        where("deliveryType", "==", "pickup_home"),
                        where("status", "in", ["pending", "pickup_scheduled"]),
                        where("scheduledPickupDate", "<", Timestamp.fromDate(today))
                    );

                    const [delSnap, pickSnap] = await Promise.all([
                        getDocs(deliveryQuery),
                        getDocs(pickupQuery)
                    ]);

                    // Merge and Deduplicate
                    const merged = new Map();
                    [...delSnap.docs, ...pickSnap.docs].forEach(doc => {
                        merged.set(doc.id, { id: doc.id, ...doc.data() });
                    });

                    let results = Array.from(merged.values()) as Order[];
                    if (orderSource === 'online') {
                        results = results.filter((o) => o.orderSource === 'online');
                    } else if (orderSource === 'pos') {
                        results = results.filter((o) => o.orderSource !== 'online');
                    }
                    if (deliveryType !== 'all') results = results.filter((o) => (o.deliveryType || 'pickup_store') === deliveryType);
                    results = results.filter(inDateRange);
                    results.sort((a, b) => {
                        const tA = a.createdAt?.toMillis() || 0;
                        const tB = b.createdAt?.toMillis() || 0;
                        return tB - tA;
                    });

                    setOrders(results);
                    setHasMore(false); // Disable load more for special filter
                    setTotalCount(results.length);
                    setLoading(false);
                } catch (err: any) {
                    console.error("Overdue fetch error:", err);
                    setError(err.message);
                    setLoading(false);
                }
            };
            fetchOverdue();
            return;
        }

        if (specialFilter === 'scheduled_upcoming') {
            // "Scheduled" = work booked for a FUTURE day: a home pickup due after
            // today, or an order whose expected delivery is after today. Mirrors
            // the Team app's Upcoming chip so web/app/agent all agree.
            const fetchUpcoming = async () => {
                try {
                    const endToday = endOfToday();
                    const ordersRef = collection(db, 'shops', shopId, 'orders');

                    const activeStatuses = [
                        "pending", "processing", "ready", "ready_for_pickup",
                        "out_for_delivery", "pickup_scheduled", "pickup_completed",
                        "partially_delivered"
                    ];

                    const deliveryQuery = query(
                        ordersRef,
                        where("expectedDelivery", ">", Timestamp.fromDate(endToday)),
                        where("status", "in", activeStatuses)
                    );

                    const pickupQuery = query(
                        ordersRef,
                        where("deliveryType", "==", "pickup_home"),
                        where("status", "in", ["pending", "pickup_scheduled"]),
                        where("scheduledPickupDate", ">", Timestamp.fromDate(endToday))
                    );

                    const [delSnap, pickSnap] = await Promise.all([
                        getDocs(deliveryQuery),
                        getDocs(pickupQuery)
                    ]);

                    const merged = new Map();
                    [...delSnap.docs, ...pickSnap.docs].forEach(doc => {
                        merged.set(doc.id, { id: doc.id, ...doc.data() });
                    });

                    let results = Array.from(merged.values()) as Order[];
                    if (orderSource === 'online') {
                        results = results.filter((o) => o.orderSource === 'online');
                    } else if (orderSource === 'pos') {
                        results = results.filter((o) => o.orderSource !== 'online');
                    }
                    if (deliveryType !== 'all') results = results.filter((o) => (o.deliveryType || 'pickup_store') === deliveryType);
                    results = results.filter(inDateRange);
                    // Soonest first — the list reads as a work queue, not creation order.
                    results.sort((a, b) => upcomingAtMillis(a) - upcomingAtMillis(b));

                    setOrders(results);
                    setHasMore(false);
                    setTotalCount(results.length);
                    setLoading(false);
                } catch (err: any) {
                    console.error("Upcoming fetch error:", err);
                    setError(err.message);
                    setLoading(false);
                }
            };
            fetchUpcoming();
            return;
        }

        if (specialFilter === 'payment_due') {
            // "Due" = ANY non-cancelled order with an unpaid balance — including orders
            // still in progress (pending/processing/ready). Matches the apps' Due filter,
            // so web and app always show the same count. Cancelled orders have their
            // balance voided to 0 on cancel, but we filter them client-side as a guard.
            const q = query(
                collection(db, 'shops', shopId, 'orders'),
                where("financials.balance", ">", 0)
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                let orderList = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Order[];
                orderList = orderList.filter((o) => o.status !== 'cancelled').filter(inDateRange);
                if (orderSource === 'online') {
                    orderList = orderList.filter((o) => o.orderSource === 'online');
                } else if (orderSource === 'pos') {
                    orderList = orderList.filter((o) => o.orderSource !== 'online');
                }
                if (deliveryType !== 'all') orderList = orderList.filter((o) => (o.deliveryType || 'pickup_store') === deliveryType);
                orderList.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
                setOrders(orderList);
                setHasMore(false); // full dues list is loaded in one go
                setTotalCount(orderList.length);
                setLoading(false);
            });
            unsubscribeRef.current = unsubscribe;
            return;
        }

        const constraints = buildConstraints();
        const q = query(
            collection(db, 'shops', shopId, 'orders'),
            ...constraints,
            limit(PAGINATION.ORDERS_PER_PAGE)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const orderList = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Order[];

                // Client-side search filter
                let filteredOrders = orderList;
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    filteredOrders = orderList.filter(
                        (o) =>
                            o.publicId.toLowerCase().includes(term) ||
                            o.customerName.toLowerCase().includes(term) ||
                            o.customerPhone.includes(term)
                    );
                }

                setOrders(filteredOrders);
                lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
                setHasMore(snapshot.docs.length === PAGINATION.ORDERS_PER_PAGE);
                setTotalCount(snapshot.size);
                setLoading(false);
            },
            (err) => {
                console.error('Orders fetch error:', err);
                setError(err.message);
                setLoading(false);
            }
        );

        unsubscribeRef.current = unsubscribe;

        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, [shopId, status, deliveryType, orderSource, searchTerm, buildConstraints, specialFilter]);

    // Load more (pagination)
    const loadMore = useCallback(async () => {
        if (!shopId || !lastDocRef.current || !hasMore || loadingMore || specialFilter === 'pending_overdue') {
            return;
        }

        setLoadingMore(true);

        try {
            let q;

            if (specialFilter === 'payment_due') {
                q = query(
                    collection(db, 'shops', shopId, 'orders'),
                    where("status", "in", ["delivered", "picked_up", "partially_delivered"]),
                    where("financials.balance", ">", 0),
                    orderBy('createdAt', 'desc'),
                    startAfter(lastDocRef.current),
                    limit(PAGINATION.ORDERS_PER_PAGE)
                );
            } else {
                const constraints = buildConstraints();
                q = query(
                    collection(db, 'shops', shopId, 'orders'),
                    ...constraints,
                    startAfter(lastDocRef.current),
                    limit(PAGINATION.ORDERS_PER_PAGE)
                );
            }

            const snapshot = await getDocs(q);
            const newOrders = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Order[];

            // Client-side search filter
            let filteredOrders = newOrders;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                filteredOrders = newOrders.filter(
                    (o) =>
                        o.publicId.toLowerCase().includes(term) ||
                        o.customerName.toLowerCase().includes(term) ||
                        o.customerPhone.includes(term)
                );
            }

            setOrders((prev) => [...prev, ...filteredOrders]);
            lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
            setHasMore(snapshot.docs.length === PAGINATION.ORDERS_PER_PAGE);
            setTotalCount((prev) => prev + snapshot.size);
        } catch (err) {
            console.error('Load more error:', err);
            setError(err instanceof Error ? err.message : 'Failed to load more');
        } finally {
            setLoadingMore(false);
        }
    }, [shopId, hasMore, loadingMore, buildConstraints, searchTerm, orderSource, specialFilter]);

    // Refresh
    const refresh = useCallback(() => {
        lastDocRef.current = null;
        setOrders([]);
        setHasMore(true);
        setLoading(true);
    }, []);

    return {
        orders,
        loading,
        loadingMore,
        error,
        hasMore,
        totalCount,
        loadMore,
        refresh,
    };
}
