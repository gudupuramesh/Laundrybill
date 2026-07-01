/**
 * All Shops Hook (super-admin)
 *
 * Loads EVERY shop once (two collection reads: shops + subscriptions), then does
 * search / plan-filter / sort / pagination entirely client-side. This makes:
 *   - the newest shop always sit on top (client sort, so shops missing createdAt
 *     still show up instead of being dropped by a Firestore orderBy),
 *   - search match the WHOLE platform (name, email, phone, whatsapp, code, city,
 *     slug…), not just the 20 rows that happened to be paged in,
 *   - navigating into a shop and back instant — the module cache renders the list
 *     with no spinner and no re-query.
 *
 * Stale-while-revalidate: a cached list paints immediately and is refreshed
 * silently in the background, so plan overrides and new signups still appear.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Shop } from "@/types/shop";
import type { PlanType } from "@/types/plans";
import { normalizePlanId } from "@/types/plans";

interface UseAllShopsOptions {
    searchTerm?: string;
    planFilter?: PlanType | "all";
    pageSize?: number;
}

interface ShopSubscriptionInfo {
    planId: PlanType;
    status: string;
    endDate?: Date;
    billingCycle?: string;
}

export interface ShopWithSubscription extends Shop {
    subscription?: ShopSubscriptionInfo;
}

// ── Module-level session cache: survives unmount so returning from a shop detail
//    renders the list instantly (no spinner, no re-query). ──
let shopsCache: ShopWithSubscription[] | null = null;

function toMillis(ts: unknown): number {
    const viaToDate = (ts as { toDate?: () => Date })?.toDate?.();
    if (viaToDate instanceof Date) return viaToDate.getTime();
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === "number") return ts;
    return 0;
}

async function loadAllShops(): Promise<ShopWithSubscription[]> {
    // Two collection reads total — NOT one-getDoc-per-shop.
    const [shopsSnap, subsSnap] = await Promise.all([
        getDocs(collection(db, "shops")),
        getDocs(collection(db, "subscriptions")).catch(() => null),
    ]);

    // subscriptions doc id === shopId
    const subById = new Map<string, ShopSubscriptionInfo>();
    subsSnap?.docs.forEach((d) => {
        const data = d.data();
        subById.set(d.id, {
            planId: normalizePlanId(data.planId),
            status: data.status || "active",
            endDate: data.endDate?.toDate?.(),
            billingCycle: data.billingCycle,
        });
    });

    const shops: ShopWithSubscription[] = shopsSnap.docs.map((docSnap) => {
        const shopData = { id: docSnap.id, ...docSnap.data() } as Shop;
        return {
            ...shopData,
            subscription:
                subById.get(docSnap.id) ?? { planId: "free" as PlanType, status: "free" },
        };
    });

    // Newest first. Done client-side (not via Firestore orderBy) so shops missing a
    // createdAt still appear — they sink to the bottom instead of vanishing.
    shops.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    return shops;
}

/** Read a shop straight from the session cache — used to seed the detail page instantly. */
export function getCachedShop(id: string): ShopWithSubscription | undefined {
    return shopsCache?.find((s) => s.id === id);
}

function shopMatches(shop: ShopWithSubscription, term: string, digits: string): boolean {
    const loc = (shop as unknown as { location?: Record<string, unknown> }).location;
    const haystack = [
        shop.name,
        shop.email,
        shop.shopCode,
        shop.publicOrdering?.slug,
        loc?.city,
        loc?.state,
        loc?.pincode,
        loc?.address,
        shop.id,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    if (haystack.includes(term)) return true;
    // Phone / whatsapp: compare digits only, so "+91 98765 43210" matches "9876543210".
    if (digits) {
        const phoneDigits = `${shop.phone ?? ""} ${shop.whatsappNumber ?? ""}`.replace(/\D/g, "");
        if (phoneDigits.includes(digits)) return true;
    }
    return false;
}

export function useAllShops(options: UseAllShopsOptions = {}) {
    const { searchTerm = "", planFilter = "all", pageSize = 20 } = options;

    const [allShops, setAllShops] = useState<ShopWithSubscription[]>(() => shopsCache ?? []);
    const [loading, setLoading] = useState<boolean>(() => shopsCache === null);
    const [error, setError] = useState<string | null>(null);
    const [visibleCount, setVisibleCount] = useState(pageSize);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const load = useCallback(async (force = false) => {
        const hadCache = shopsCache !== null;
        // Stale-while-revalidate: paint the cache instantly, refresh silently.
        if (hadCache && !force) {
            setAllShops(shopsCache!);
            setLoading(false);
        } else {
            setLoading(true);
        }
        try {
            setError(null);
            const shops = await loadAllShops();
            shopsCache = shops;
            if (mountedRef.current) setAllShops(shops);
        } catch (err) {
            console.error("Failed to fetch shops:", err);
            // Only surface an error when there's nothing cached to show.
            if (mountedRef.current && !hadCache) setError("Failed to load shops");
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    // Reset how many rows are shown whenever the query changes.
    useEffect(() => {
        setVisibleCount(pageSize);
    }, [searchTerm, planFilter, pageSize]);

    const filtered = useMemo(() => {
        let list = allShops;
        if (planFilter !== "all") {
            list = list.filter((s) => normalizePlanId(s.subscription?.planId) === planFilter);
        }
        const term = searchTerm.trim().toLowerCase();
        if (term) {
            const digits = term.replace(/\D/g, "");
            list = list.filter((s) => shopMatches(s, term, digits));
        }
        return list;
    }, [allShops, searchTerm, planFilter]);

    const shops = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
    const hasMore = visibleCount < filtered.length;

    const loadMore = useCallback(() => {
        setVisibleCount((c) => c + pageSize);
    }, [pageSize]);

    const refresh = useCallback(() => load(true), [load]);

    return {
        shops,
        // Cold load only — a cached revisit never shows the loading state.
        loading: loading && allShops.length === 0,
        // Background refresh with data already on screen (for a subtle indicator).
        refreshing: loading && allShops.length > 0,
        error,
        hasMore,
        total: allShops.length,
        matchedCount: filtered.length,
        loadMore,
        refresh,
    };
}
