/**
 * Activity Logs Hook
 * 
 * Fetches platform activity logs for super admin
 */

import { useState, useEffect, useCallback } from "react";
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    startAfter,
} from "firebase/firestore";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ActivityLog, ActivityType } from "@/types/super-admin";

interface UseActivityLogsOptions {
    typeFilter?: ActivityType | "all";
    shopId?: string;
    pageSize?: number;
}

export function useActivityLogs(options: UseActivityLogsOptions = {}) {
    const { typeFilter = "all", shopId, pageSize = 50 } = options;

    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);

    const fetchLogs = useCallback(async (isLoadMore = false) => {
        try {
            setLoading(true);
            setError(null);

            let q = query(
                collection(db, "activity_logs"),
                orderBy("createdAt", "desc"),
                limit(pageSize)
            );

            // Filter by type
            if (typeFilter !== "all") {
                q = query(
                    collection(db, "activity_logs"),
                    where("type", "==", typeFilter),
                    orderBy("createdAt", "desc"),
                    limit(pageSize)
                );
            }

            // Filter by shop
            if (shopId) {
                q = query(
                    collection(db, "activity_logs"),
                    where("shopId", "==", shopId),
                    orderBy("createdAt", "desc"),
                    limit(pageSize)
                );
            }

            // Pagination
            if (isLoadMore && lastDoc) {
                q = query(
                    collection(db, "activity_logs"),
                    orderBy("createdAt", "desc"),
                    startAfter(lastDoc),
                    limit(pageSize)
                );
            }

            const snapshot = await getDocs(q);
            const results: ActivityLog[] = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            } as ActivityLog));

            if (isLoadMore) {
                setLogs((prev) => [...prev, ...results]);
            } else {
                setLogs(results);
            }

            setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
            setHasMore(snapshot.docs.length === pageSize);
        } catch (err) {
            console.error("Failed to fetch activity logs:", err);
            setError("Failed to load activity logs");
        } finally {
            setLoading(false);
        }
    }, [typeFilter, shopId, pageSize, lastDoc]);

    useEffect(() => {
        setLastDoc(null);
        setLogs([]);
        fetchLogs(false);
    }, [typeFilter, shopId]);

    const loadMore = useCallback(() => {
        if (!loading && hasMore) {
            fetchLogs(true);
        }
    }, [loading, hasMore, fetchLogs]);

    return {
        logs,
        loading,
        error,
        hasMore,
        loadMore,
        refetch: () => {
            setLastDoc(null);
            setLogs([]);
            fetchLogs(false);
        },
    };
}

// Activity type labels and icons
export const ACTIVITY_TYPE_CONFIG: Record<ActivityType, { label: string; color: string }> = {
    shop_created: { label: "Shop Created", color: "green" },
    shop_updated: { label: "Shop Updated", color: "blue" },
    subscription_created: { label: "Subscription Created", color: "purple" },
    subscription_upgraded: { label: "Plan Upgraded", color: "green" },
    subscription_downgraded: { label: "Plan Downgraded", color: "orange" },
    subscription_cancelled: { label: "Subscription Cancelled", color: "red" },
    subscription_expired: { label: "Subscription Expired", color: "gray" },
    subscription_renewed: { label: "Subscription Renewed", color: "green" },
    payment_received: { label: "Payment Received", color: "green" },
    payment_failed: { label: "Payment Failed", color: "red" },
    plan_override: { label: "Plan Override", color: "purple" },
    login: { label: "Login", color: "blue" },
    feature_used: { label: "Feature Used", color: "gray" },
};
