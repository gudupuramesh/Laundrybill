/**
 * Store Health Hook
 *
 * Computes a high-level operational health snapshot for the shop from the
 * last 30 days of orders. Every metric is derived from data that is actually
 * persisted (see mobile/src/theme.ts data audit):
 *   - On-Time Delivery : deliveredAt vs expectedDelivery (calendar-day)
 *   - On-Time Pickup   : timeline 'pickup_completed' vs scheduledPickupDate
 *   - Order Flow       : active orders NOT overdue (expectedDelivery >= today)
 *   - Collection Rate  : Σ amountPaid / Σ total (non-cancelled)
 * Processing-stage on-time is intentionally omitted — no processing SLA is
 * stored, so it cannot be measured honestly. Metrics with no sample return
 * null ("No data") and are excluded from the composite score.
 */

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import { subDays, startOfToday, startOfDay } from "date-fns";
import type { Order } from "@/types/order";

export interface HealthMetric {
    /** 0-100, or null when there is no sample to measure */
    value: number | null;
    /** number of orders the metric was computed from */
    sample: number;
}

export type HealthStatus = "excellent" | "good" | "attention" | "critical" | "nodata";

export interface StoreHealthData {
    /** composite 0-100, or null when nothing measurable yet */
    score: number | null;
    status: HealthStatus;
    onTimeDelivery: HealthMetric;
    onTimePickup: HealthMetric;
    orderFlow: HealthMetric;
    collectionRate: HealthMetric;
    overdueCount: number;
    activeCount: number;
    windowDays: number;
    loading: boolean;
}

const WINDOW_DAYS = 30;
const ACTIVE_STATUSES = [
    "pending", "processing", "ready", "ready_for_pickup",
    "out_for_delivery", "pickup_scheduled", "pickup_completed",
];

function statusLabel(score: number | null): HealthStatus {
    if (score == null) return "nodata";
    if (score >= 85) return "excellent";
    if (score >= 70) return "good";
    if (score >= 55) return "attention";
    return "critical";
}

const toDate = (v: unknown): Date | null => {
    const ts = v as Timestamp | undefined;
    return ts && typeof ts.toDate === "function" ? ts.toDate() : null;
};
const dayMs = (d: Date) => startOfDay(d).getTime();

export function useStoreHealth(): StoreHealthData {
    const { shopId } = useAuth();
    const [data, setData] = useState<StoreHealthData>({
        score: null,
        status: "nodata",
        onTimeDelivery: { value: null, sample: 0 },
        onTimePickup: { value: null, sample: 0 },
        orderFlow: { value: null, sample: 0 },
        collectionRate: { value: null, sample: 0 },
        overdueCount: 0,
        activeCount: 0,
        windowDays: WINDOW_DAYS,
        loading: true,
    });

    useEffect(() => {
        if (!shopId) {
            setData((d) => ({ ...d, loading: false }));
            return;
        }
        let cancelled = false;

        (async () => {
            try {
                const since = subDays(new Date(), WINDOW_DAYS);
                const today = startOfToday().getTime();
                const ordersRef = collection(db, "shops", shopId, "orders");
                const snap = await getDocs(
                    query(ordersRef, where("createdAt", ">=", Timestamp.fromDate(since)))
                );

                let deliveredTot = 0, deliveredOnTime = 0;
                let pickupTot = 0, pickupOnTime = 0;
                let active = 0, onSchedule = 0, overdue = 0;
                let billed = 0, collected = 0;

                snap.forEach((doc) => {
                    const o = doc.data() as Order;
                    if (o.status === "cancelled") return;

                    billed += o.financials?.total || 0;
                    collected += o.financials?.amountPaid || 0;

                    // On-time delivery (delivered or shop-pickup handoff)
                    if (o.status === "delivered" || o.status === "picked_up") {
                        const done = toDate(o.deliveredAt);
                        const due = toDate(o.expectedDelivery);
                        if (done && due) {
                            deliveredTot++;
                            if (dayMs(done) <= dayMs(due)) deliveredOnTime++;
                        }
                    }

                    // On-time pickup (home pickup → use timeline event)
                    if (o.deliveryType === "pickup_home") {
                        const ev = o.timeline?.find(
                            (e) => e.status === "pickup_completed" || e.status === "picked_up"
                        );
                        const picked = toDate(ev?.timestamp);
                        const sched = toDate(o.scheduledPickupDate);
                        if (picked && sched) {
                            pickupTot++;
                            if (dayMs(picked) <= dayMs(sched)) pickupOnTime++;
                        }
                    }

                    // Order flow / overdue load (active orders only)
                    if (ACTIVE_STATUSES.includes(o.status)) {
                        active++;
                        const due = toDate(o.expectedDelivery);
                        const pickupDue =
                            o.deliveryType === "pickup_home" &&
                            (o.status === "pending" || o.status === "pickup_scheduled")
                                ? toDate(o.scheduledPickupDate)
                                : null;
                        const isOverdue =
                            (due != null && due.getTime() < today) ||
                            (pickupDue != null && pickupDue.getTime() < today);
                        if (isOverdue) overdue++;
                        else onSchedule++;
                    }
                });

                const pct = (n: number, d: number): number | null =>
                    d > 0 ? Math.round((n / d) * 100) : null;

                const onTimeDelivery: HealthMetric = { value: pct(deliveredOnTime, deliveredTot), sample: deliveredTot };
                const onTimePickup: HealthMetric = { value: pct(pickupOnTime, pickupTot), sample: pickupTot };
                const orderFlow: HealthMetric = { value: pct(onSchedule, active), sample: active };
                const collectionRate: HealthMetric = { value: billed > 0 ? Math.round((collected / billed) * 100) : null, sample: snap.size };

                // Weighted composite over the metrics that have data
                const parts = [
                    { v: onTimeDelivery.value, w: 0.3 },
                    { v: onTimePickup.value, w: 0.2 },
                    { v: orderFlow.value, w: 0.25 },
                    { v: collectionRate.value, w: 0.25 },
                ].filter((p) => p.v != null) as { v: number; w: number }[];
                const totalW = parts.reduce((s, p) => s + p.w, 0);
                const score = totalW > 0 ? Math.round(parts.reduce((s, p) => s + p.v * p.w, 0) / totalW) : null;

                if (cancelled) return;
                setData({
                    score,
                    status: statusLabel(score),
                    onTimeDelivery,
                    onTimePickup,
                    orderFlow,
                    collectionRate,
                    overdueCount: overdue,
                    activeCount: active,
                    windowDays: WINDOW_DAYS,
                    loading: false,
                });
            } catch (err) {
                console.error("useStoreHealth failed:", err);
                if (!cancelled) setData((d) => ({ ...d, loading: false }));
            }
        })();

        return () => { cancelled = true; };
    }, [shopId]);

    return data;
}
