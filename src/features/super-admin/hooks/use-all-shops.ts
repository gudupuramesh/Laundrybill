/**
 * All Shops Hook
 * 
 * Fetches all shops for super admin with search and filtering
 */

import { useState, useEffect, useCallback } from "react";
import {
    collection,
    query,
    orderBy,
    limit,
    startAfter,
    getDocs,
    getDoc,
    doc,
} from "firebase/firestore";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Shop } from "@/types/shop";
import type { PlanType } from "@/types/plans";

interface UseAllShopsOptions {
    searchTerm?: string;
    planFilter?: PlanType | "all";
    sortBy?: "createdAt" | "name" | "lastOrderAt";
    pageSize?: number;
}

export interface ShopStorageStatsSummary {
    totalBytes: number;
    imageCount: number;
}

interface ShopWithSubscription extends Shop {
    subscription?: {
        planId: PlanType;
        status: string;
        endDate?: Date;
        billingCycle?: string;
    };
    storageStats?: ShopStorageStatsSummary;
}

export function useAllShops(options: UseAllShopsOptions = {}) {
    const {
        searchTerm = "",
        planFilter = "all",
        sortBy = "createdAt",
        pageSize = 20,
    } = options;

    const [shops, setShops] = useState<ShopWithSubscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [total, setTotal] = useState(0);

    // Initial fetch
    const fetchShops = useCallback(async (isLoadMore = false) => {
        try {
            setLoading(true);
            setError(null);

            let q = query(
                collection(db, "shops"),
                orderBy(sortBy, "desc"),
                limit(pageSize)
            );

            // Add cursor for pagination
            if (isLoadMore && lastDoc) {
                q = query(
                    collection(db, "shops"),
                    orderBy(sortBy, "desc"),
                    startAfter(lastDoc),
                    limit(pageSize)
                );
            }

            const snapshot = await getDocs(q);

            // Process shops (subscription + storage stats)
            const fetchedShops: ShopWithSubscription[] = await Promise.all(
                snapshot.docs.map(async (docSnap) => {
                    const shopData = { id: docSnap.id, ...docSnap.data() } as Shop;

                    // Try to fetch subscription (subscriptions doc id = shopId)
                    let subscription: ShopWithSubscription["subscription"];
                    try {
                        const subRef = doc(db, "subscriptions", docSnap.id);
                        const subSnap = await getDoc(subRef);
                        if (subSnap.exists()) {
                            const subData = subSnap.data();
                            subscription = {
                                planId: subData.planId || "free",
                                status: subData.status || "active",
                                endDate: subData.endDate?.toDate?.(),
                                billingCycle: subData.billingCycle,
                            };
                        }
                    } catch {
                        // Subscription not found
                    }

                    // Fetch storage stats (Super Admin reads shops/{id}/storageStats/summary)
                    let storageStats: ShopStorageStatsSummary | undefined;
                    try {
                        const statsRef = doc(db, "shops", docSnap.id, "storageStats", "summary");
                        const statsSnap = await getDoc(statsRef);
                        if (statsSnap.exists()) {
                            const d = statsSnap.data();
                            storageStats = {
                                totalBytes: d.totalBytes ?? 0,
                                imageCount: d.imageCount ?? 0,
                            };
                        }
                    } catch {
                        // Stats not found or no access
                    }

                    return {
                        ...shopData,
                        subscription: subscription || {
                            planId: "free" as PlanType,
                            status: "active",
                        },
                        storageStats,
                    };
                })
            );

            // Apply client-side search filter
            let filteredShops = fetchedShops;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                filteredShops = fetchedShops.filter(
                    (shop) =>
                        shop.name?.toLowerCase().includes(term) ||
                        shop.phone?.includes(term) ||
                        shop.email?.toLowerCase().includes(term)
                );
            }

            // Apply plan filter
            if (planFilter !== "all") {
                filteredShops = filteredShops.filter(
                    (shop) => shop.subscription?.planId === planFilter
                );
            }

            // Update state
            if (isLoadMore) {
                setShops((prev) => [...prev, ...filteredShops]);
            } else {
                setShops(filteredShops);
            }

            setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
            setHasMore(snapshot.docs.length === pageSize);

            // Get total count (first fetch only)
            if (!isLoadMore) {
                const countSnapshot = await getDocs(collection(db, "shops"));
                setTotal(countSnapshot.size);
            }
        } catch (err) {
            console.error("Failed to fetch shops:", err);
            setError("Failed to load shops");
        } finally {
            setLoading(false);
        }
    }, [searchTerm, planFilter, sortBy, pageSize, lastDoc]);

    // Initial load
    useEffect(() => {
        setLastDoc(null);
        fetchShops(false);
    }, [searchTerm, planFilter, sortBy]);

    // Load more function
    const loadMore = useCallback(() => {
        if (!loading && hasMore) {
            fetchShops(true);
        }
    }, [loading, hasMore, fetchShops]);

    // Refresh function
    const refresh = useCallback(() => {
        setLastDoc(null);
        setShops([]);
        fetchShops(false);
    }, [fetchShops]);

    return {
        shops,
        loading,
        error,
        hasMore,
        total,
        loadMore,
        refresh,
    };
}
