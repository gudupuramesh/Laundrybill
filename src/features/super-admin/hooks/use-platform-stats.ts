/**
 * Platform Stats Hook
 *
 * Fetches aggregated statistics for the super admin dashboard from real data
 */

import { useState, useEffect, useCallback } from "react";
import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    doc,
    getCountFromServer,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PlatformStats } from "@/types/super-admin";
import { normalizePlanId } from "@/types/plans";

export function usePlatformStats() {
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

            // Fetch all shops
            const shopsSnapshot = await getDocs(collection(db, "shops"));
            const shops = shopsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

            const newShopsThisMonth = shops.filter((s: Record<string, unknown>) => {
                const createdAt = (s.createdAt as { toDate?: () => Date })?.toDate?.();
                return createdAt && createdAt >= startOfMonth;
            }).length;

            // Subscriptions
            let planDistribution = { free: 0, pro: 0 };
            let activeSubscriptions = 0;
            let trialUsers = 0;
            let expiringSoon = 0;

            try {
                const subsSnapshot = await getDocs(collection(db, "subscriptions"));
                subsSnapshot.docs.forEach((d) => {
                    const sub = d.data();
                    const planId = normalizePlanId(sub.planId);
                    if (planId === "pro") planDistribution.pro++;
                    else planDistribution.free++;

                    if (sub.status === "active") activeSubscriptions++;
                    // Legacy trial users counted as free (no more trials)
                    if (sub.status === "trial") trialUsers++;

                    const endDate = (sub.endDate as { toDate?: () => Date })?.toDate?.();
                    if (endDate && endDate <= sevenDaysFromNow && sub.status === "active") {
                        expiringSoon++;
                    }
                });
            } catch {
                planDistribution.free = shops.length;
            }

            // Payments
            let monthlyRevenue = 0;
            let revenueToday = 0;
            try {
                const paymentsQuery = query(
                    collection(db, "payments"),
                    where("status", "==", "success"),
                    where("createdAt", ">=", Timestamp.fromDate(startOfMonth))
                );
                const paymentsSnapshot = await getDocs(paymentsQuery);
                paymentsSnapshot.docs.forEach((d) => {
                    const p = d.data();
                    monthlyRevenue += p.amount || 0;
                    const paidAt = (p.createdAt as { toDate?: () => Date })?.toDate?.();
                    if (paidAt && paidAt >= startOfDay) revenueToday += p.amount || 0;
                });
            } catch {
                // ignore
            }

            // Aggregate orders, customers, storage from ALL shops (real data)
            let totalOrders = 0;
            let ordersToday = 0;
            let totalCustomers = 0;
            let totalStorageBytes = 0;
            let totalStorageImageCount = 0;

            const shopPromises = shops.map(async (shop: { id: string }) => {
                const results = { orders: 0, ordersToday: 0, customers: 0, bytes: 0, images: 0 };
                try {
                    const ordersRef = collection(db, "shops", shop.id, "orders");
                    const todayQuery = query(ordersRef, where("createdAt", ">=", Timestamp.fromDate(startOfDay)));
                    const [ordersSnap, todaySnap, customersSnap] = await Promise.all([
                        getCountFromServer(ordersRef).catch(() => null),
                        getCountFromServer(todayQuery).catch(() => null),
                        getCountFromServer(collection(db, "shops", shop.id, "customers")).catch(() => null),
                    ]);
                    results.orders = ordersSnap?.data?.()?.count ?? 0;
                    results.ordersToday = todaySnap?.data?.()?.count ?? 0;
                    results.customers = customersSnap?.data?.()?.count ?? 0;
                } catch {
                    // ignore
                }
                try {
                    const statsSnap = await getDoc(doc(db, "shops", shop.id, "storageStats", "summary"));
                    if (statsSnap.exists()) {
                        const d = statsSnap.data();
                        results.bytes = d.totalBytes ?? 0;
                        results.images = d.imageCount ?? 0;
                    }
                } catch {
                    // ignore
                }
                return results;
            });

            const shopResults = await Promise.all(shopPromises);
            shopResults.forEach((r) => {
                totalOrders += r.orders;
                ordersToday += r.ordersToday;
                totalCustomers += r.customers;
                totalStorageBytes += r.bytes;
                totalStorageImageCount += r.images;
            });

            setStats({
                totalShops: shops.length,
                newShopsThisMonth,
                activeSubscriptions: activeSubscriptions || 0,
                trialUsers,
                expiringSoon,
                paymentsFailed: 0,
                monthlyRevenue,
                revenueGrowth: 0,
                totalOrders,
                totalCustomers,
                ordersToday,
                revenueToday,
                totalStorageBytes,
                totalStorageImageCount,
                planDistribution,
            });
        } catch (err) {
            console.error("Failed to fetch platform stats:", err);
            setError("Failed to load platform statistics");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return { stats, loading, error, refetch: fetchStats };
}
