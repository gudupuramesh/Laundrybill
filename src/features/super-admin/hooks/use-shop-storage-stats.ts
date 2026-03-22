/**
 * Shop Storage Stats Hook (Super Admin)
 *
 * Fetches total compressed storage (bytes) and image count for a shop.
 */

import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface ShopStorageStats {
    totalBytes: number;
    imageCount: number;
    updatedAt: Date | null;
}

const SUMMARY_DOC_ID = "summary";

export function useShopStorageStats(shopId: string | null) {
    const [stats, setStats] = useState<ShopStorageStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!shopId) {
            setStats(null);
            setLoading(false);
            return;
        }

        const sid = shopId;
        let cancelled = false;

        async function fetchStats() {
            setLoading(true);
            setError(null);
            try {
                const ref = doc(db, "shops", sid, "storageStats", SUMMARY_DOC_ID);
                const snap = await getDoc(ref);
                if (cancelled) return;
                if (snap.exists()) {
                    const d = snap.data();
                    setStats({
                        totalBytes: d.totalBytes ?? 0,
                        imageCount: d.imageCount ?? 0,
                        updatedAt: d.updatedAt?.toDate?.() ?? null,
                    });
                } else {
                    setStats({ totalBytes: 0, imageCount: 0, updatedAt: null });
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Failed to load storage stats");
                    setStats(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchStats();
        return () => {
            cancelled = true;
        };
    }, [shopId]);

    return { stats, loading, error };
}

/** Format bytes to human-readable (e.g. "2.5 MB") */
export function formatStorageBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(i > 1 ? 1 : 0)} ${sizes[i]}`;
}
