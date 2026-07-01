/**
 * Shop Subscription Events Hook (super-admin)
 *
 * Loads a single shop's audit timeline from `activity_logs`. Queries by shopId
 * equality ONLY (no orderBy) so it needs no composite index — the small per-shop
 * result set is sorted newest-first client-side.
 */

import { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ActivityLog } from "@/types/super-admin";

function ms(ts: unknown): number {
    return (ts as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
}

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
            const snap = await getDocs(query(collection(db, "activity_logs"), where("shopId", "==", shopId)));
            const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog));
            rows.sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
            setEvents(rows);
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
