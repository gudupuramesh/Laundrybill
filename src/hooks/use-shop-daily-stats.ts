/**
 * Per-shop daily stats for the multi-shop "All shops" overview. Takes an
 * EXPLICIT shopId (super-admin pattern — no ambient auth context) so one page
 * can show several shops side by side. Live via onSnapshot.
 */
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface ShopDailyStats {
    todayOrders: number;
    todayRevenue: number;
    /** Orders not yet delivered/cancelled (whole shop, not just today). */
    pendingOrders: number;
    loading: boolean;
}

const ACTIVE_STATUSES = [
    "pending",
    "pickup_scheduled",
    "pickup_completed",
    "processing",
    "ready",
    "out_for_delivery",
    "partially_delivered",
];

export function useShopDailyStats(shopId: string | null | undefined): ShopDailyStats {
    const [stats, setStats] = useState<ShopDailyStats>({
        todayOrders: 0,
        todayRevenue: 0,
        pendingOrders: 0,
        loading: true,
    });

    useEffect(() => {
        if (!shopId) {
            setStats((s) => ({ ...s, loading: false }));
            return;
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const ordersRef = collection(db, `shops/${shopId}/orders`);

        // Today's orders → count + revenue (paid amounts recorded on the order).
        const unsubToday = onSnapshot(
            query(ordersRef, where("createdAt", ">=", Timestamp.fromDate(todayStart))),
            (snap) => {
                let revenue = 0;
                snap.docs.forEach((d) => {
                    const o = d.data() as { financials?: { amountPaid?: number }; status?: string };
                    if (o.status !== "cancelled") revenue += o.financials?.amountPaid || 0;
                });
                setStats((s) => ({ ...s, todayOrders: snap.size, todayRevenue: revenue, loading: false }));
            },
            () => setStats((s) => ({ ...s, loading: false })),
        );

        // Open workload across the shop.
        const unsubPending = onSnapshot(
            query(ordersRef, where("status", "in", ACTIVE_STATUSES)),
            (snap) => setStats((s) => ({ ...s, pendingOrders: snap.size })),
            () => { /* keep zeros on error */ },
        );

        return () => {
            unsubToday();
            unsubPending();
        };
    }, [shopId]);

    return stats;
}
