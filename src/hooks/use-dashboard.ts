/**
 * Dashboard Hook
 * 
 * Fetches real-time dashboard statistics from Firebase
 */

import { useState, useEffect, useMemo } from "react";
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    Timestamp,
    getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import type { Order, OrderStatus } from "@/types/order";
import { startOfDay, endOfDay, startOfMonth, subDays, startOfToday } from "date-fns";

interface DashboardStats {
    // Today's stats
    todayRevenue: number;
    todayCollected: number;
    /** How many distinct orders received a payment today. */
    todayCollectedOrders: number;
    todayOrders: number;

    // Order status counts
    pendingOrders: number;
    processingOrders: number;
    readyOrders: number;
    outForDeliveryOrders: number;

    // Customer stats
    totalCustomers: number;
    newCustomersToday: number;

    // Financial
    outstandingAmount: number;
    monthlyRevenue: number;
    monthlyExpenses: number;

    // Order type breakdown
    storePickupOrders: number;
    homePickupOrders: number;
    homeDeliveryOrders: number;

    // Trend vs yesterday (percentage). null = no comparable base yesterday (chip shows "—").
    revenueTrend: number | null;
    ordersTrend: number | null;
    monthlyOrders: number;

    /** Today's collections split by payment method (cash / upi / card / other). */
    todayCollectedByMethod: Record<string, number>;
    /** Non-cancelled orders still carrying a balance. */
    outstandingOrders: number;
    /** Active orders whose expected delivery/pickup falls today. */
    dueTodayCount: number;
    /** Ready (any variant) with a balance still owed. */
    readyUnpaidCount: number;
    /** Pipeline stages — counts and order value per stage. */
    stages: { key: "placed" | "processing" | "ready" | "out" | "delivered"; count: number; amount: number }[];
}

interface RecentOrder {
    id: string;
    publicId: string;
    customerName: string;
    customerPhone: string;
    status: OrderStatus;
    total: number;
    amountPaid: number;
    balance: number;
    itemCount: number;
    createdAt: Date;
    deliveryType: string;
    /** "3 Shirts, 2 Pants" — first two lines, "+N more". */
    itemsSummary: string;
    /** Dominant service category, e.g. "Wash & Fold". */
    serviceSummary: string;
    /** Expected delivery / scheduled pickup, whichever applies. */
    due: Date | null;
}

interface StaffAttendanceSummary {
    totalStaff: number;
    presentToday: number;
    absentToday: number;
    onLeaveToday: number;
}

interface UseDashboardReturn {
    stats: DashboardStats;
    recentOrders: RecentOrder[];
    pendingOrdersList: RecentOrder[];
    staffAttendance: StaffAttendanceSummary;
    loading: boolean;
    error: string | null;
}

export function useDashboard(): UseDashboardReturn {
    const { shopId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Orders state
    const [allOrders, setAllOrders] = useState<Order[]>([]);
    const [todayOrders, setTodayOrders] = useState<Order[]>([]);
    // Money actually RECEIVED today: every payments[] entry stamped today (advance
    // at order placement + balances collected on delivery), minus refunds issued
    // today. Independent of when the order was created.
    const [todayCollectedCash, setTodayCollectedCash] = useState(0);
    const [todayCollectedCount, setTodayCollectedCount] = useState(0);
    const [todayCollectedByMethod, setTodayCollectedByMethod] = useState<Record<string, number>>({});

    // Customer count
    const [totalCustomers, setTotalCustomers] = useState(0);
    const [newCustomersToday, setNewCustomersToday] = useState(0);

    // Staff attendance
    const [staffAttendance, setStaffAttendance] = useState<StaffAttendanceSummary>({
        totalStaff: 0,
        presentToday: 0,
        absentToday: 0,
        onLeaveToday: 0,
    });

    // Month expenses
    const [monthlyExpenses, setMonthlyExpenses] = useState(0);

    // Previous period data for trends
    const [previousRevenue, setPreviousRevenue] = useState(0);
    const [previousOrderCount, setPreviousOrderCount] = useState(0);

    // Date calculations
    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);
    const monthStart = startOfMonth(today);
    const weekAgo = subDays(today, 7);
    const twoWeeksAgo = subDays(today, 14);

    // Fetch today's orders (real-time)
    useEffect(() => {
        if (!shopId) {
            setLoading(false);
            return;
        }

        const ordersRef = collection(db, `shops/${shopId}/orders`);
        const todayQuery = query(
            ordersRef,
            where("createdAt", ">=", Timestamp.fromDate(todayStart)),
            where("createdAt", "<=", Timestamp.fromDate(todayEnd)),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(
            todayQuery,
            (snapshot) => {
                const orders = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Order[];
                setTodayOrders(orders);
            },
            (err) => {
                console.error("Error fetching today's orders:", err);
                setError("Failed to load today's orders");
            }
        );

        return () => unsubscribe();
    }, [shopId, todayStart.getTime(), todayEnd.getTime()]);

    // Collected today — every payment write bumps updatedAt (web + both apps),
    // so orders touched today form a reliable superset; each payment/refund is
    // then filtered by its own timestamp.
    useEffect(() => {
        if (!shopId) return;

        const touchedTodayQuery = query(
            collection(db, `shops/${shopId}/orders`),
            where("updatedAt", ">=", Timestamp.fromDate(todayStart))
        );

        const unsubscribe = onSnapshot(
            touchedTodayQuery,
            (snapshot) => {
                let collected = 0;
                let paidOrderCount = 0;
                const byMethod: Record<string, number> = {};
                snapshot.docs.forEach((d) => {
                    const o = d.data() as Order;
                    let orderGotPaymentToday = false;
                    (o.payments || []).forEach((pmt) => {
                        const at = pmt.collectedAt?.toDate?.();
                        if (at && at >= todayStart && at <= todayEnd) {
                            collected += pmt.amount || 0; orderGotPaymentToday = true;
                            const m = String(pmt.method || "cash").toLowerCase();
                            byMethod[m] = (byMethod[m] || 0) + (pmt.amount || 0);
                        }
                    });
                    if (orderGotPaymentToday) paidOrderCount += 1;
                    ((o as unknown as { refunds?: { amount?: number; refundedAt?: Timestamp }[] }).refunds || []).forEach((r) => {
                        const at = r.refundedAt?.toDate?.();
                        if (at && at >= todayStart && at <= todayEnd) collected -= r.amount || 0;
                    });
                });
                setTodayCollectedCash(Math.max(0, collected));
                setTodayCollectedCount(paidOrderCount);
                setTodayCollectedByMethod(byMethod);
            },
            (err) => console.error("Error computing today's collections:", err)
        );

        return () => unsubscribe();
    }, [shopId, todayStart.getTime(), todayEnd.getTime()]);

    // Fetch recent orders for list (last 50)
    useEffect(() => {
        if (!shopId) return;

        const ordersRef = collection(db, `shops/${shopId}/orders`);
        const recentQuery = query(
            ordersRef,
            orderBy("createdAt", "desc"),
            limit(50)
        );

        const unsubscribe = onSnapshot(
            recentQuery,
            (snapshot) => {
                const orders = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Order[];
                setAllOrders(orders);
                setLoading(false);
            },
            (err) => {
                console.error("Error fetching orders:", err);
                setError("Failed to load orders");
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [shopId]);

    // Fetch customer count
    useEffect(() => {
        if (!shopId) return;

        const customersRef = collection(db, `shops/${shopId}/customers`);

        const unsubscribe = onSnapshot(
            customersRef,
            (snapshot) => {
                setTotalCustomers(snapshot.size);

                // Count new customers today
                const newToday = snapshot.docs.filter((doc) => {
                    const createdAt = doc.data().createdAt?.toDate?.();
                    return createdAt && createdAt >= todayStart;
                }).length;
                setNewCustomersToday(newToday);
            },
            (err) => {
                console.error("Error fetching customers:", err);
            }
        );

        return () => unsubscribe();
    }, [shopId, todayStart.getTime()]);

    // Fetch staff attendance for today
    useEffect(() => {
        if (!shopId) return;

        const fetchAttendance = async () => {
            try {
                // Get all staff
                const staffRef = collection(db, `shops/${shopId}/staff`);
                const staffQuery = query(staffRef, where("isActive", "==", true));
                const staffSnap = await getDocs(staffQuery);
                const totalStaff = staffSnap.size;

                // Get today's attendance
                const todayStr = today.toISOString().split('T')[0];
                let present = 0;
                let absent = 0;
                let onLeave = 0;

                for (const staffDoc of staffSnap.docs) {
                    const attendanceRef = collection(db, `shops/${shopId}/staff/${staffDoc.id}/attendance`);
                    const attendanceQuery = query(attendanceRef, where("date", "==", todayStr));
                    const attendanceSnap = await getDocs(attendanceQuery);

                    if (attendanceSnap.empty) {
                        // No record yet - count as pending
                    } else {
                        const status = attendanceSnap.docs[0].data().status;
                        if (status === "present" || status === "half_day") present++;
                        else if (status === "absent") absent++;
                        else if (status === "leave") onLeave++;
                    }
                }

                setStaffAttendance({
                    totalStaff,
                    presentToday: present,
                    absentToday: absent,
                    onLeaveToday: onLeave,
                });
            } catch (err) {
                console.error("Error fetching attendance:", err);
            }
        };

        fetchAttendance();
    }, [shopId]);

    // Fetch monthly expenses
    useEffect(() => {
        if (!shopId) return;

        const expensesRef = collection(db, `shops/${shopId}/expenses`);
        const monthQuery = query(
            expensesRef,
            where("date", ">=", Timestamp.fromDate(monthStart)),
            where("date", "<=", Timestamp.fromDate(todayEnd))
        );

        const unsubscribe = onSnapshot(
            monthQuery,
            (snapshot) => {
                const total = snapshot.docs.reduce((sum, doc) => {
                    return sum + (doc.data().amount || 0);
                }, 0);
                setMonthlyExpenses(total);
            },
            (err) => {
                console.error("Error fetching expenses:", err);
            }
        );

        return () => unsubscribe();
    }, [shopId, monthStart.getTime()]);

    // Fetch previous week's data for trends
    useEffect(() => {
        if (!shopId) return;

        const fetchPreviousPeriod = async () => {
            try {
                const ordersRef = collection(db, `shops/${shopId}/orders`);
                const previousQuery = query(
                    ordersRef,
                    where("createdAt", ">=", Timestamp.fromDate(twoWeeksAgo)),
                    where("createdAt", "<", Timestamp.fromDate(weekAgo))
                );
                const snapshot = await getDocs(previousQuery);

                let revenue = 0;
                let orderCount = 0;
                snapshot.docs.forEach((doc) => {
                    const data = doc.data();
                    if (data.status === "cancelled") return;
                    revenue += data.financials?.total || 0;
                    orderCount += 1;
                });

                setPreviousRevenue(revenue);
                setPreviousOrderCount(orderCount);
            } catch (err) {
                console.error("Error fetching previous period:", err);
            }
        };

        fetchPreviousPeriod();
    }, [shopId]);

    // Monthly Orders Count (Detailed Count)
    const [monthlyOrdersCount, setMonthlyOrdersCount] = useState(0);

    // Fetch accurate monthly order count
    useEffect(() => {
        if (!shopId) return;

        const fetchMonthlyCount = async () => {
            try {
                const ordersRef = collection(db, `shops/${shopId}/orders`);
                const monthQuery = query(
                    ordersRef,
                    where("createdAt", ">=", Timestamp.fromDate(monthStart)),
                    where("createdAt", "<=", Timestamp.fromDate(todayEnd))
                );

                // Use counting aggregation for accuracy > 50 docs
                const { getCountFromServer } = await import("firebase/firestore");
                const snapshot = await getCountFromServer(monthQuery);
                setMonthlyOrdersCount(snapshot.data().count);
            } catch (err) {
                console.error("Error counting monthly orders:", err);
            }
        };

        fetchMonthlyCount();
    }, [shopId, monthStart.getTime(), todayEnd.getTime()]);

    // Calculate stats from orders (cancelled orders never count toward revenue or order counts)
    const stats = useMemo<DashboardStats>(() => {
        const nonCancelledToday = todayOrders.filter((o) => o.status !== "cancelled");

        // Today's calculations — exclude cancelled
        const todayRevenue = nonCancelledToday.reduce((sum, order) => {
            return sum + (order.financials?.total || 0);
        }, 0);

        // Payment-timestamp based (see the updatedAt listener) — NOT limited to
        // orders created today, so delivery-day balance collections count too.
        const todayCollected = todayCollectedCash;
        const todayCollectedOrders = todayCollectedCount;

        // Status counts from recent orders
        const pendingOrders = allOrders.filter(o => o.status === "pending").length;
        const processingOrders = allOrders.filter(o =>
            ["processing", "washing", "drying", "ironing", "folding"].includes(o.status)
        ).length;
        const readyOrders = allOrders.filter(o =>
            ["ready", "ready_for_pickup", "ready_for_delivery"].includes(o.status)
        ).length;
        const outForDeliveryOrders = allOrders.filter(o => o.status === "out_for_delivery").length;

        // Outstanding = receivables: every non-cancelled order with a positive
        // balance, INCLUDING delivered/picked-up-but-unpaid (money still owed).
        // Null-safe + clamp + (total−paid) fallback, matching canonical orderBalance.
        const outstandingAmount = allOrders
            .filter(o => o.status !== "cancelled")
            .reduce((sum, order) => {
                const total = order.financials?.total || 0;
                const paid = order.financials?.amountPaid || 0;
                const bal = order.financials?.balance ?? (total - paid);
                return sum + Math.max(0, bal);
            }, 0);

        // Monthly revenue — exclude cancelled
        const monthlyRevenue = allOrders
            .filter(o => {
                if (o.status === "cancelled") return false;
                const createdAt = o.createdAt?.toDate?.();
                return createdAt && createdAt >= monthStart;
            })
            .reduce((sum, order) => sum + (order.financials?.total || 0), 0);

        // Order type breakdown (using correct DeliveryType values)
        const storePickupOrders = todayOrders.filter(o => o.deliveryType === "pickup_store").length;
        const homePickupOrders = todayOrders.filter(o => o.deliveryType === "pickup_home").length;
        const homeDeliveryOrders = todayOrders.filter(o => o.deliveryType === "delivery_home").length;

        // Trend = today vs YESTERDAY (the chips are labelled "vs yesterday"). Yesterday's
        // orders are already within the last-7-days `allOrders` fetch, so filter locally.
        // When yesterday's base is 0 the percentage is meaningless → null (chip shows "—"),
        // so "Orders today: 0" never displays a spurious ▲growth.
        const yesterdayStart = subDays(todayStart, 1);
        const yesterdayOrders = allOrders.filter((o) => {
            if (o.status === "cancelled") return false;
            const createdAt = o.createdAt?.toDate?.();
            return createdAt && createdAt >= yesterdayStart && createdAt < todayStart;
        });
        const prevDayRevenue = yesterdayOrders.reduce((sum, order) => sum + (order.financials?.total || 0), 0);
        const prevDayOrders = yesterdayOrders.length;

        const revenueTrend = prevDayRevenue > 0
            ? Math.round(((todayRevenue - prevDayRevenue) / prevDayRevenue) * 100)
            : null;

        const ordersTrend = prevDayOrders > 0
            ? Math.round(((nonCancelledToday.length - prevDayOrders) / prevDayOrders) * 100)
            : null;

        // ── New-dashboard derivations (all from the live last-50 window, like the status counts) ──
        const live = allOrders.filter((o) => o.status !== "cancelled");
        const balOf = (o: Order) => Math.max(0, o.financials?.balance ?? ((o.financials?.total || 0) - (o.financials?.amountPaid || 0)));
        const outstandingOrders = live.filter((o) => balOf(o) > 0).length;
        const ACTIVE = new Set(["pending", "pickup_scheduled", "pickup_completed", "processing", "ready", "ready_for_pickup", "out_for_delivery"]);
        const dueTodayCount = live.filter((o) => {
            if (!ACTIVE.has(o.status)) return false;
            const d = (o.deliveryType === "pickup_home" && ["pending", "pickup_scheduled"].includes(o.status)
                ? o.scheduledPickupDate : o.expectedDelivery)?.toDate?.();
            return !!d && d >= todayStart && d <= todayEnd;
        }).length;
        const readyUnpaidCount = live.filter((o) => ["ready", "ready_for_pickup"].includes(o.status) && balOf(o) > 0).length;
        const STAGE: Record<string, "placed" | "processing" | "ready" | "out" | "delivered"> = {
            pending: "placed", pickup_scheduled: "placed", pickup_completed: "placed",
            processing: "processing", ready: "ready", ready_for_pickup: "ready",
            out_for_delivery: "out", delivered: "delivered", picked_up: "delivered", partially_delivered: "delivered",
        };
        const stageMap = { placed: { count: 0, amount: 0 }, processing: { count: 0, amount: 0 }, ready: { count: 0, amount: 0 }, out: { count: 0, amount: 0 }, delivered: { count: 0, amount: 0 } };
        live.forEach((o) => { const k = STAGE[o.status]; if (k) { stageMap[k].count += 1; stageMap[k].amount += o.financials?.total || 0; } });
        const stages = (["placed", "processing", "ready", "out", "delivered"] as const).map((key) => ({ key, ...stageMap[key] }));

        return {
            todayRevenue,
            todayCollected,
            todayCollectedOrders,
            todayOrders: nonCancelledToday.length,
            monthlyOrders: monthlyOrdersCount, // Updated to use accurate usage
            pendingOrders,
            processingOrders,
            readyOrders,
            outForDeliveryOrders,
            totalCustomers,
            newCustomersToday,
            outstandingAmount,
            monthlyRevenue,
            monthlyExpenses,
            storePickupOrders,
            homePickupOrders,
            homeDeliveryOrders,
            revenueTrend,
            ordersTrend,
            todayCollectedByMethod,
            outstandingOrders,
            dueTodayCount,
            readyUnpaidCount,
            stages,
        };
    }, [todayOrders, allOrders, totalCustomers, newCustomersToday, monthlyExpenses, previousRevenue, previousOrderCount, monthlyOrdersCount, todayCollectedCash, todayCollectedCount, todayCollectedByMethod, todayStart, todayEnd]);

    // Transform orders for display
    const recentOrders = useMemo<RecentOrder[]>(() => {
        return allOrders.slice(0, 10).map((order) => {
            const items = order.items || [];
            const lines = items.slice(0, 2).map((it) => `${it.quantity || 1} ${it.serviceName || "item"}`);
            const itemsSummary = lines.join(", ") + (items.length > 2 ? ` +${items.length - 2} more` : "");
            const cats = new Map<string, number>();
            items.forEach((it) => { const c = it.categoryName || ""; if (c) cats.set(c, (cats.get(c) || 0) + 1); });
            const serviceSummary = [...cats.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
            const dueTs = order.deliveryType === "pickup_home" && ["pending", "pickup_scheduled"].includes(order.status)
                ? order.scheduledPickupDate : order.expectedDelivery;
            return {
                id: order.id,
                publicId: order.publicId,
                customerName: order.customerName,
                customerPhone: order.customerPhone,
                status: order.status,
                total: order.financials?.total || 0,
                amountPaid: order.financials?.amountPaid || 0,
                balance: order.financials?.balance || 0,
                itemCount: items.length,
                createdAt: order.createdAt?.toDate?.() || new Date(),
                deliveryType: order.deliveryType,
                itemsSummary,
                serviceSummary,
                due: dueTs?.toDate?.() || null,
            };
        });
    }, [allOrders]);

    // Fetch Overdue Orders (Real Pending)
    const [overdueOrders, setOverdueOrders] = useState<Order[]>([]);

    useEffect(() => {
        if (!shopId) return;

        const fetchOverdue = async () => {
            try {
                const today = startOfToday();
                const ordersRef = collection(db, `shops/${shopId}/orders`);

                const activeStatuses = [
                    "pending", "processing", "ready", "ready_for_pickup",
                    "out_for_delivery", "pickup_scheduled", "pickup_completed"
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

                const results = Array.from(merged.values()) as Order[];
                // Sort by date (desc) - oldest first might be better for overdue? 
                // Let's stick to newest first for consistency, or oldest first to show most urgent?
                // User requirement: "how many orders will it shown... hundreds... show up 5".
                // Usually overdue you want to see the ones requiring immediate attention (oldest). 
                // But dashboard usually shows recent activity. Let's sort by createdAt desc (newest overdue first).
                results.sort((a, b) => {
                    const tA = a.createdAt?.toMillis() || 0;
                    const tB = b.createdAt?.toMillis() || 0;
                    return tB - tA; // Descending
                });

                setOverdueOrders(results.slice(0, 5)); // Limit to 5
            } catch (err) {
                console.error("Error fetching overdue orders:", err);
            }
        };

        fetchOverdue();
        // Poll every minute or just run once on mount/shopId change
        const interval = setInterval(fetchOverdue, 60000);
        return () => clearInterval(interval);
    }, [shopId]);

    // Pending orders list (Overdue Only)
    const pendingOrdersList = useMemo<RecentOrder[]>(() => {
        return overdueOrders.map((order) => ({
            id: order.id,
            publicId: order.publicId,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            status: order.status,
            total: order.financials?.total || 0,
            amountPaid: order.financials?.amountPaid || 0,
            balance: order.financials?.balance || 0,
            itemCount: order.items?.length || 0,
            createdAt: order.createdAt?.toDate?.() || new Date(),
            deliveryType: order.deliveryType,
            itemsSummary: "",
            serviceSummary: "",
            due: order.expectedDelivery?.toDate?.() || null,
        }));
    }, [overdueOrders]);

    return {
        stats,
        recentOrders,
        pendingOrdersList,
        staffAttendance,
        loading,
        error,
    };
}
