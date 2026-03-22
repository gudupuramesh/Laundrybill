/**
 * Shop Storage Events Hook (Super Admin)
 *
 * Fetches upload/delete log for a shop's R2 storage.
 * Used in Shop Detail to show image activity.
 */

import { useState, useEffect } from "react";
import {
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface StorageEventDoc {
    id: string;
    action: "upload" | "delete";
    key: string;
    url?: string;
    folder: string;
    createdAt: Date | null;
}

export function useShopStorageEvents(shopId: string | null) {
    const [events, setEvents] = useState<StorageEventDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!shopId) {
            setEvents([]);
            setLoading(false);
            return;
        }

        const sid = shopId;
        let cancelled = false;

        async function fetchEvents() {
            setLoading(true);
            setError(null);
            try {
                const ref = collection(db, "shops", sid, "storageEvents");
                const q = query(
                    ref,
                    orderBy("createdAt", "desc"),
                    limit(50)
                );
                const snap = await getDocs(q);
                if (cancelled) return;
                const list: StorageEventDoc[] = snap.docs.map((doc) => {
                    const d = doc.data();
                    const createdAt = d.createdAt instanceof Timestamp
                        ? d.createdAt.toDate()
                        : d.createdAt
                            ? new Date(d.createdAt)
                            : null;
                    return {
                        id: doc.id,
                        action: d.action === "delete" ? "delete" : "upload",
                        key: d.key ?? "",
                        url: d.url,
                        folder: d.folder ?? "",
                        createdAt,
                    };
                });
                setEvents(list);
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Failed to load storage events");
                    setEvents([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchEvents();
        return () => {
            cancelled = true;
        };
    }, [shopId]);

    return { events, loading, error };
}
