import { useState, useEffect } from "react";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import { startOfMonth, endOfMonth, startOfToday } from "date-fns";
import type { Order } from "@/types/order";

export interface OrderSummaryMetrics {
    revenue: number;    // This Month
    collected: number;  // This Month
    due: number;        // All Time outstanding amount
    pendingCount: number; // Overdue (Missed Pickup or Delivery)
    unpaidCount: number;  // Delivered but unpaid
    onlineOrdersCount: number; // Orders from public page (pending/active)
    /** IDs of active online orders (for unseen-badge logic) */
    onlineOrderIds: string[];
    loading: boolean;
}

export function useOrderSummary(): OrderSummaryMetrics {
    const { shopId } = useAuth();
    const [metrics, setMetrics] = useState<OrderSummaryMetrics>({
        revenue: 0,
        collected: 0,
        due: 0,
        pendingCount: 0,
        unpaidCount: 0,
        onlineOrdersCount: 0,
        onlineOrderIds: [],
        loading: true
    });

    useEffect(() => {
        if (!shopId) {
            setMetrics(prev => ({ ...prev, loading: false }));
            return;
        }

        const fetchMetrics = async () => {
            try {
                const now = new Date();
                const start = startOfMonth(now);
                const end = endOfMonth(now);
                const today = startOfToday();

                const ordersRef = collection(db, "shops", shopId, "orders");

                // 1. Current Month Metrics (Revenue & Collected)
                const monthQuery = query(
                    ordersRef,
                    where("createdAt", ">=", Timestamp.fromDate(start)),
                    where("createdAt", "<=", Timestamp.fromDate(end))
                );

                // 2. All Time Due Metrics (Outstanding Balance)
                const dueQuery = query(
                    ordersRef,
                    where("financials.balance", ">", 0)
                );

                // 3. Unpaid Delivered Orders (Status Count)
                // Status = delivered AND Balance > 0
                const unpaidDeliveredQuery = query(
                    ordersRef,
                    where("status", "==", "delivered"),
                    where("financials.balance", ">", 0)
                );

                // 4. Pending / Overdue (Missed Delivery)
                // Expected Delivery < Today AND Status is ACTIVE (not delivered/cancelled)
                // FIX: Firestore forbids range (<) and not-in on different fields.
                // We must use 'in' with explicit active statuses.
                const activeStatuses = [
                    "pending",
                    "processing",
                    "ready",
                    "ready_for_pickup",
                    "out_for_delivery",
                    "pickup_scheduled",
                    "pickup_completed"
                ];

                const overdueDeliveryQuery = query(
                    ordersRef,
                    where("expectedDelivery", "<", Timestamp.fromDate(today)),
                    where("status", "in", activeStatuses)
                );

                // 5. Pending / Overdue (Missed Pickup)
                // Scheduled Pickup < Today AND Status = pickup_scheduled OR pending
                const overduePickupQuery = query(
                    ordersRef,
                    where("deliveryType", "==", "pickup_home"),
                    where("status", "in", ["pending", "pickup_scheduled"]),
                    where("scheduledPickupDate", "<", Timestamp.fromDate(today))
                );

                // 6. Online orders count (from public page, active statuses)
                const onlineOrdersQuery = query(
                    ordersRef,
                    where("orderSource", "==", "online"),
                    where("status", "in", ["pending", "pickup_scheduled", "pickup_completed", "processing", "ready", "out_for_delivery"])
                );

                const results = await Promise.allSettled([
                    getDocs(monthQuery),
                    getDocs(dueQuery),
                    getDocs(unpaidDeliveredQuery),
                    getDocs(overdueDeliveryQuery),
                    getDocs(overduePickupQuery),
                    getDocs(onlineOrdersQuery)
                ]);

                // Helper to safely get docs
                const getDocsFromResult = (result: PromiseSettledResult<any>, label: string) => {
                    if (result.status === 'fulfilled') {
                        return result.value.docs;
                    } else {
                        console.error(`Query failed: ${label}`, result.reason);
                        return [];
                    }
                };

                const monthDocs = getDocsFromResult(results[0], "month");
                const dueDocs = getDocsFromResult(results[1], "due");
                const unpaidDocs = getDocsFromResult(results[2], "unpaid");
                const overdueDelDocs = getDocsFromResult(results[3], "overdueDel");
                const overduePickDocs = getDocsFromResult(results[4], "overduePick");
                const onlineDocs = getDocsFromResult(results[5], "online");

                // Process Month Data
                let revenue = 0;
                let collected = 0;

                monthDocs.forEach((doc: any) => {
                    const data = doc.data() as Order;
                    if (data.status === 'cancelled') return;
                    revenue += data.financials?.total || 0;
                    collected += data.financials?.amountPaid || 0;
                });

                // Process Due Data (All Time Amount)
                let dueAmount = 0;
                dueDocs.forEach((doc: any) => {
                    const data = doc.data() as Order;
                    if (data.status === 'cancelled') return;
                    // Null-safe + clamp + (total−paid) fallback, matching canonical orderBalance.
                    dueAmount += Math.max(0, data.financials?.balance ?? ((data.financials?.total || 0) - (data.financials?.amountPaid || 0)));
                });

                // Counts
                const unpaidCount = unpaidDocs.length;
                // Dedup: an order overdue on BOTH pickup and delivery must count once.
                const overdueIds = new Set<string>([
                    ...overdueDelDocs.map((d: { id: string }) => d.id),
                    ...overduePickDocs.map((d: { id: string }) => d.id),
                ]);
                const pendingCount = overdueIds.size;
                const onlineOrdersCount = onlineDocs.length;
                const onlineOrderIds = onlineDocs.map((d: { id: string }) => d.id);

                setMetrics({
                    revenue,
                    collected,
                    due: dueAmount,
                    pendingCount,
                    unpaidCount,
                    onlineOrdersCount,
                    onlineOrderIds,
                    loading: false
                });

            } catch (err) {
                console.error("Failed to fetch order summary metrics:", err);
                setMetrics(prev => ({ ...prev, loading: false }));
            }
        };

        fetchMetrics();
    }, [shopId]);

    return metrics;
}
