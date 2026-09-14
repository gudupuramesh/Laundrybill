/**
 * Dashboard insights — the 30-day picture behind the right-hand column:
 * daily revenue (by order date) vs collected (by payment date), payment mix,
 * top services, and delivery agents currently on route. One-shot fetches; the
 * live tiles come from useDashboard.
 */

import { useEffect, useState } from "react";
import { collection, getDocs, limit, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import type { Order } from "@/types/order";
import { format, startOfDay, subDays } from "date-fns";

export interface DayPoint { key: string; label: string; revenue: number; collected: number }
export interface ServiceStat { name: string; orders: number; revenue: number }
export interface AgentOnRoute { name: string; stops: number }

export interface DashboardInsights {
    series: DayPoint[];
    revenueTotal: number;
    collectedTotal: number;
    paymentMix: { method: string; amount: number }[];
    topServices: ServiceStat[];
    agents: AgentOnRoute[];
    loading: boolean;
}

export function useDashboardInsights(days = 30): DashboardInsights {
    const { shopId } = useAuth();
    const [data, setData] = useState<Omit<DashboardInsights, "loading">>({
        series: [], revenueTotal: 0, collectedTotal: 0, paymentMix: [], topServices: [], agents: [],
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!shopId) { setLoading(false); return; }
        let dead = false;
        (async () => {
            try {
                const since = startOfDay(subDays(new Date(), days - 1));
                const ordersRef = collection(db, `shops/${shopId}/orders`);
                const [createdSnap, touchedSnap, routeSnap] = await Promise.all([
                    getDocs(query(ordersRef, where("createdAt", ">=", Timestamp.fromDate(since)))),
                    getDocs(query(ordersRef, where("updatedAt", ">=", Timestamp.fromDate(since)))),
                    getDocs(query(ordersRef, where("status", "==", "out_for_delivery"), limit(200))),
                ]);

                const buckets = new Map<string, DayPoint>();
                for (let i = 0; i < days; i++) {
                    const d = subDays(new Date(), days - 1 - i);
                    buckets.set(format(d, "yyyy-MM-dd"), { key: format(d, "yyyy-MM-dd"), label: format(d, "d MMM"), revenue: 0, collected: 0 });
                }
                const services = new Map<string, ServiceStat>();
                let revenueTotal = 0;
                createdSnap.forEach((d) => {
                    const o = d.data() as Order;
                    if (o.status === "cancelled") return;
                    const dt = o.createdAt?.toDate?.(); if (!dt) return;
                    const b = buckets.get(format(dt, "yyyy-MM-dd"));
                    const total = o.financials?.total || 0;
                    if (b) b.revenue += total;
                    revenueTotal += total;
                    (o.items || []).forEach((it) => {
                        const name = it.categoryName || it.serviceName || "Other";
                        const cur = services.get(name) || { name, orders: 0, revenue: 0 };
                        cur.orders += 1;
                        cur.revenue += (it as { total?: number }).total ?? ((it.unitPrice || 0) * (it.quantity || 0));
                        services.set(name, cur);
                    });
                });

                const mix = new Map<string, number>();
                let collectedTotal = 0;
                touchedSnap.forEach((d) => {
                    const o = d.data() as Order;
                    (o.payments || []).forEach((pmt) => {
                        const at = pmt.collectedAt?.toDate?.();
                        if (!at || at < since) return;
                        const amt = pmt.amount || 0;
                        const b = buckets.get(format(at, "yyyy-MM-dd"));
                        if (b) b.collected += amt;
                        collectedTotal += amt;
                        const m = String(pmt.method || "cash").toLowerCase();
                        mix.set(m, (mix.get(m) || 0) + amt);
                    });
                });

                const agentMap = new Map<string, number>();
                routeSnap.forEach((d) => {
                    const o = d.data() as Order;
                    const name = o.assignedAgentName || "Unassigned";
                    agentMap.set(name, (agentMap.get(name) || 0) + 1);
                });

                if (dead) return;
                setData({
                    series: [...buckets.values()],
                    revenueTotal,
                    collectedTotal,
                    paymentMix: [...mix.entries()].map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount),
                    topServices: [...services.values()].sort((a, b) => b.orders - a.orders).slice(0, 4),
                    agents: [...agentMap.entries()].map(([name, stops]) => ({ name, stops })).sort((a, b) => b.stops - a.stops),
                });
            } catch (e) {
                console.error("dashboard insights", e);
            } finally {
                if (!dead) setLoading(false);
            }
        })();
        return () => { dead = true; };
    }, [shopId, days]);

    return { ...data, loading };
}
