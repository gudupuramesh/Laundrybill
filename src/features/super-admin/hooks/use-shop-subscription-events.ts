/**
 * Shop Subscription Events Hook (super-admin)
 *
 * Loads a single shop's audit timeline from `activity_logs`, newest-first and
 * capped at 50 rows — activity_logs is the global append-only platform log and a
 * long-lived shop accumulates events without bound, so this MUST be limited.
 * Uses the activity_logs (shopId ASC, createdAt DESC) composite index.
 */

import { useState, useEffect, useCallback } from "react";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ActivityLog } from "@/types/super-admin";

const EVENTS_LIMIT = 50;

export function useShopSubscriptionEvents(shopId: string | null) {
    const [events, setEvents] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchEvents = useCallback(async () => {
        if (!shopId) {
            setEvents([]);
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            setError(null);
            const snap = await getDocs(
                query(
                    collection(db, "activity_logs"),
                    where("shopId", "==", shopId),
                    orderBy("createdAt", "desc"),
                    limit(EVENTS_LIMIT)
                )
            );
            setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog)));
        } catch (err) {
            console.error("Failed to load shop subscription events:", err);
            setError("Failed to load history");
        } finally {
            setLoading(false);
        }
    }, [shopId]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    return { events, loading, error, refetch: fetchEvents };
}
