/**
 * Subscriptions Hook (super-admin)
 *
 * Loads every subscription once (2 collection reads: subscriptions + shops) and
 * does view / search / plan filtering client-side. Mirrors the shops-list design:
 *   - module-level session cache + stale-while-revalidate → instant back-nav,
 *   - a "view" that defaults to ACTIVE PAID subscriptions so the tab stops looking
 *     like the Shops list (which showed every free shop),
 *   - KPI roll-up (active count, estimated MRR, per-plan, trialing, expiring).
 *
 * Also exports the super-admin plan mutations, which now append an audit event to
 * `activity_logs` (see ./../lib/subscription-events) so plan history is preserved.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    collection,
    getDocs,
    getDoc,
    doc,
    updateDoc,
    setDoc,
    serverTimestamp,
    Timestamp,
    deleteField,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Subscription } from "@/types/super-admin";
import type { PlanType } from "@/types/plans";
import { normalizePlanId } from "@/types/plans";
import {
    logSubscriptionEvent,
    planChangeActivityType,
    planLabel,
    monthlyPrice,
} from "../lib/subscription-events";
import { invalidateShopsCache } from "./use-all-shops";

// Extended subscription with shop details for the list view
export interface SubscriptionWithShop extends Subscription {
    shopPhone?: string;
    shopJoinedAt?: Timestamp;
}

export type SubscriptionView = "active" | "trialing" | "expiring" | "past" | "free" | "all";

export interface SubscriptionKpis {
    total: number;
    activePaid: number;
    mrr: number;
    trialing: number;
    expiring: number;
    past: number;
    free: number;
    byPlan: { pro: number; pro_plus: number; business: number; franchise: number };
}

interface UseSubscriptionsOptions {
    view?: SubscriptionView;
    planFilter?: PlanType | "all";
    searchTerm?: string;
}

const EXPIRING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// ── Module-level session cache (survives unmount → instant return from a detail). ──
let subsCache: SubscriptionWithShop[] | null = null;

/** Drop the cache so the next load re-reads Firestore (call after a plan mutation). */
export function invalidateSubscriptionsCache() {
    subsCache = null;
}

function tsMillis(ts: unknown): number {
    const viaToDate = (ts as { toDate?: () => Date })?.toDate?.();
    if (viaToDate instanceof Date) return viaToDate.getTime();
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === "number") return ts;
    return 0;
}

function normalizeProvider(sub: SubscriptionWithShop): SubscriptionWithShop {
    const legacy = sub as unknown as {
        razorpayPaymentId?: string;
        razorpaySubscriptionId?: string;
        razorpayOrderId?: string;
    };
    sub.provider =
        sub.provider || (legacy.razorpayPaymentId || legacy.razorpaySubscriptionId ? "razorpay" : undefined);
    sub.providerRef = sub.providerRef || legacy.razorpaySubscriptionId || legacy.razorpayPaymentId;
    sub.providerOrderId = sub.providerOrderId || legacy.razorpayOrderId;
    return sub;
}

async function loadAllSubscriptions(): Promise<SubscriptionWithShop[]> {
    // Two collection reads total — NOT one getDoc(shop) per subscription.
    const [subsSnap, shopsSnap] = await Promise.all([
        getDocs(collection(db, "subscriptions")),
        getDocs(collection(db, "shops")).catch(() => null),
    ]);

    const shopById = new Map<string, Record<string, unknown>>();
    shopsSnap?.docs.forEach((d) => shopById.set(d.id, d.data()));

    const results: SubscriptionWithShop[] = subsSnap.docs.map((d) => {
        const sub = { id: d.id, ...d.data() } as SubscriptionWithShop;
        const shop = shopById.get(sub.shopId || d.id);
        if (shop) {
            if (!sub.shopName) sub.shopName = (shop.name as string) || "";
            if (!sub.ownerEmail) sub.ownerEmail = (shop.email as string) || "";
            if (!sub.ownerPhone) sub.ownerPhone = (shop.phone as string) || "";
            sub.shopPhone = (shop.phone as string) || "";
            sub.shopJoinedAt = (shop.createdAt as Timestamp) || undefined;
        }
        return normalizeProvider(sub);
    });

    // Most-recently-changed first (updatedAt → startDate → createdAt fallback).
    results.sort(
        (a, b) =>
            tsMillis(b.updatedAt ?? b.startDate ?? b.createdAt) -
            tsMillis(a.updatedAt ?? a.startDate ?? a.createdAt)
    );
    return results;
}

const isPaidPlan = (s: SubscriptionWithShop) => normalizePlanId(s.planId) !== "free";
const isActivePaid = (s: SubscriptionWithShop) =>
    isPaidPlan(s) && (s.status === "active" || s.status === "grace_period");
const isExpiringSoon = (s: SubscriptionWithShop) => {
    const end = s.endDate?.toDate?.()?.getTime();
    return isActivePaid(s) && !!end && end <= Date.now() + EXPIRING_WINDOW_MS && end >= Date.now();
};

function matchesView(s: SubscriptionWithShop, view: SubscriptionView): boolean {
    switch (view) {
        case "active":
            return isActivePaid(s);
        case "trialing":
            return s.status === "trial";
        case "expiring":
            return isExpiringSoon(s);
        case "past":
            return s.status === "expired" || s.status === "cancelled";
        case "free":
            return !isPaidPlan(s);
        case "all":
        default:
            return true;
    }
}

function matchesSearch(s: SubscriptionWithShop, term: string, digits: string): boolean {
    const hay = [
        s.shopName,
        s.ownerEmail,
        s.providerRef,
        s.providerOrderId,
        planLabel(s.planId),
        s.shopId,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    if (hay.includes(term)) return true;
    if (digits) {
        const phoneDigits = `${s.shopPhone ?? ""} ${s.ownerPhone ?? ""}`.replace(/\D/g, "");
        if (phoneDigits.includes(digits)) return true;
    }
    return false;
}

export function useSubscriptions(options: UseSubscriptionsOptions = {}) {
    const { view = "active", planFilter = "all", searchTerm = "" } = options;

    const [all, setAll] = useState<SubscriptionWithShop[]>(() => subsCache ?? []);
    const [loading, setLoading] = useState<boolean>(() => subsCache === null);
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const load = useCallback(async (force = false) => {
        const hadCache = subsCache !== null;
        if (hadCache && !force) {
            setAll(subsCache!);
            setLoading(false);
        } else {
            setLoading(true);
        }
        try {
            setError(null);
            const rows = await loadAllSubscriptions();
            subsCache = rows;
            if (mountedRef.current) setAll(rows);
        } catch (err) {
            console.error("Failed to fetch subscriptions:", err);
            if (mountedRef.current && !hadCache) setError("Failed to load subscriptions");
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const kpis: SubscriptionKpis = useMemo(() => {
        const k: SubscriptionKpis = {
            total: all.length,
            activePaid: 0,
            mrr: 0,
            trialing: 0,
            expiring: 0,
            past: 0,
            free: 0,
            byPlan: { pro: 0, pro_plus: 0, business: 0, franchise: 0 },
        };
        for (const s of all) {
            if (isActivePaid(s)) {
                k.activePaid++;
                // MRR = currently-collected recurring revenue only. grace_period is a
                // dunning/at-risk window (last renewal failed), so exclude it from MRR
                // even though it counts as an active-paid subscriber for the view.
                if (s.status === "active") k.mrr += monthlyPrice(s.planId, s.billingCycle);
                const p = normalizePlanId(s.planId);
                if (p === "pro" || p === "business" || p === "franchise") k.byPlan[p]++;
                else if (p === "pro_plus") k.byPlan.pro_plus++;
            }
            if (s.status === "trial") k.trialing++;
            if (isExpiringSoon(s)) k.expiring++;
            if (s.status === "expired" || s.status === "cancelled") k.past++;
            if (!isPaidPlan(s)) k.free++;
        }
        return k;
    }, [all]);

    const subscriptions = useMemo(() => {
        let list = all.filter((s) => matchesView(s, view));
        if (planFilter !== "all") {
            list = list.filter((s) => normalizePlanId(s.planId) === planFilter);
        }
        const term = searchTerm.trim().toLowerCase();
        if (term) {
            const digits = term.replace(/\D/g, "");
            list = list.filter((s) => matchesSearch(s, term, digits));
        }
        return list;
    }, [all, view, planFilter, searchTerm]);

    const refresh = useCallback(() => load(true), [load]);

    return {
        subscriptions,
        kpis,
        loading: loading && all.length === 0,
        refreshing: loading && all.length > 0,
        error,
        matchedCount: subscriptions.length,
        refresh,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan mutations (super-admin). Each now records an audit event + busts the cache.
// ─────────────────────────────────────────────────────────────────────────────

// Plan override mutation
export function useOverridePlan() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const overridePlan = async (
        subscriptionId: string,
        newPlanId: PlanType,
        newEndDate: Date,
        reason: string,
        adminId: string,
        targetShopId?: string // Optional but recommended
    ) => {
        setLoading(true);
        setError(null);

        try {
            const subRef = doc(db, "subscriptions", subscriptionId);

            // Read current state first — needed both to resolve the shopId and to
            // capture the previous plan/status for the audit trail.
            const beforeSnap = await getDoc(subRef);
            const subData: Record<string, any> = beforeSnap.exists() ? beforeSnap.data() : {};
            const shopId = targetShopId || subData.shopId || subscriptionId;

            if (!shopId) throw new Error("Could not determine Shop ID");

            const shopRef = doc(db, "shops", shopId);

            // 1. Update Subscription
            await updateDoc(subRef, {
                shopId: shopId, // Repair/Ensure link
                planId: newPlanId,
                endDate: Timestamp.fromDate(newEndDate),
                status: "active",
                manualOverride: {
                    reason,
                    overriddenBy: adminId,
                    overriddenAt: serverTimestamp(),
                    originalEndDate: subData?.endDate || serverTimestamp(),
                },
                updatedAt: serverTimestamp(),
            });

            // 2. Update Shop Profile (Critical for User Access)
            await updateDoc(shopRef, {
                plan: newPlanId, // ROOT LEVEL for admin list
                subscriptionStatus: "active", // ROOT LEVEL
                "subscription.planId": newPlanId,
                "subscription.status": "active",
                "subscription.endDate": Timestamp.fromDate(newEndDate),
                updatedAt: serverTimestamp(),
            });

            // 3. Verification Step
            const verifySnap = await getDoc(shopRef);
            const verifyData = verifySnap.data();
            if (verifyData?.plan !== newPlanId) {
                console.error("CRITICAL: Shop Plan update failed verification!", verifyData);
                throw new Error(`Verification Failed: Shop plan is still ${verifyData?.plan}`);
            }

            invalidateSubscriptionsCache();
            invalidateShopsCache();
            await logSubscriptionEvent({
                type: planChangeActivityType(subData.planId, newPlanId),
                shopId,
                shopName: subData.shopName ?? verifyData?.name ?? null,
                superAdminId: adminId,
                description: `Plan overridden to ${planLabel(newPlanId)} until ${newEndDate.toLocaleDateString()}${reason ? ` — ${reason}` : ""}`,
                metadata: {
                    action: "plan_override",
                    fromPlan: normalizePlanId(subData.planId),
                    toPlan: newPlanId,
                    fromStatus: subData.status ?? null,
                    toStatus: "active",
                    endDate: newEndDate.toISOString(),
                    reason: reason || null,
                    actor: "super_admin",
                },
            });

            return { success: true, shopId };
        } catch (err) {
            console.error("Failed to override plan:", err);
            setError("Failed to update subscription");
            return { success: false, error: err };
        } finally {
            setLoading(false);
        }
    };

    return { overridePlan, loading, error };
}

// Create subscription for Free plan shops
export function useCreateSubscription() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createSubscription = async (
        shopId: string,
        shopName: string,
        ownerEmail: string,
        planId: PlanType,
        endDate: Date,
        reason: string,
        adminId: string
    ) => {
        setLoading(true);
        setError(null);

        try {
            const subRef = doc(db, "subscriptions", shopId);
            const shopRef = doc(db, "shops", shopId);

            // 1. Create Subscription
            await setDoc(subRef, {
                shopId,
                shopName,
                ownerEmail,
                planId,
                status: "active",
                billingCycle: "monthly",
                startDate: serverTimestamp(),
                endDate: Timestamp.fromDate(endDate),
                manualOverride: {
                    reason,
                    overriddenBy: adminId,
                    overriddenAt: serverTimestamp(),
                },
                usage: {
                    ordersThisMonth: 0,
                    totalCustomers: 0,
                    totalStaff: 0,
                    totalServices: 0,
                },
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            // 2. Update Shop Profile
            await updateDoc(shopRef, {
                plan: planId, // ROOT LEVEL
                subscriptionStatus: "active", // ROOT LEVEL
                subscription: {
                    planId,
                    status: "active",
                    startDate: serverTimestamp(),
                    endDate: Timestamp.fromDate(endDate),
                },
                updatedAt: serverTimestamp(),
            });

            invalidateSubscriptionsCache();
            invalidateShopsCache();
            await logSubscriptionEvent({
                type: "subscription_created",
                shopId,
                shopName,
                superAdminId: adminId,
                description: `Subscription created: ${planLabel(planId)} until ${endDate.toLocaleDateString()}${reason ? ` — ${reason}` : ""}`,
                metadata: {
                    action: "subscription_created",
                    toPlan: planId,
                    toStatus: "active",
                    endDate: endDate.toISOString(),
                    reason: reason || null,
                    actor: "super_admin",
                },
            });

            return true;
        } catch (err) {
            console.error("Failed to create subscription:", err);
            setError("Failed to create subscription");
            return false;
        } finally {
            setLoading(false);
        }
    };

    return { createSubscription, loading, error };
}

/**
 * Super Admin: set a shop’s subscription to canonical Free (clears trial / pending downgrade / legacy plan ids).
 * Matches the shape used when a trial expires (see checkTrialExpiry in Cloud Functions).
 */
export function useMoveSubscriptionToFree() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const moveToFree = async (
        subscriptionDocId: string,
        targetShopId: string | undefined,
        reason: string,
        adminId: string
    ) => {
        setLoading(true);
        setError(null);

        try {
            const subRef = doc(db, "subscriptions", subscriptionDocId);
            const subSnap = await getDoc(subRef);
            if (!subSnap.exists()) {
                throw new Error("Subscription document not found");
            }
            const subData = subSnap.data();
            const shopId = targetShopId || subData?.shopId || subscriptionDocId;
            const shopRef = doc(db, "shops", shopId);

            const reasonText = reason.trim() || "Super admin: moved subscription to Free plan";

            await updateDoc(subRef, {
                planId: "free",
                planName: "Free",
                status: "free",
                endDate: null,
                currentPeriodEnd: null,
                currentPeriodStart: null,
                trialEndDate: deleteField(),
                pendingDowngrade: deleteField(),
                activeUntil: deleteField(),
                graceEndDate: deleteField(),
                lastTrialReminderSent: deleteField(),
                manualOverride: {
                    reason: reasonText,
                    overriddenBy: adminId,
                    overriddenAt: serverTimestamp(),
                    originalEndDate: subData?.endDate || serverTimestamp(),
                },
                updatedAt: serverTimestamp(),
            });

            await updateDoc(shopRef, {
                plan: "free",
                subscriptionStatus: "free",
                "subscription.planId": "free",
                "subscription.status": "free",
                "subscription.endDate": null,
                updatedAt: serverTimestamp(),
            });

            invalidateSubscriptionsCache();
            invalidateShopsCache();
            await logSubscriptionEvent({
                type: planChangeActivityType(subData?.planId, "free"),
                shopId,
                shopName: subData?.shopName ?? null,
                superAdminId: adminId,
                description: `Moved to Free plan — ${reasonText}`,
                metadata: {
                    action: "moved_to_free",
                    fromPlan: normalizePlanId(subData?.planId),
                    toPlan: "free",
                    fromStatus: subData?.status ?? null,
                    toStatus: "free",
                    reason: reasonText,
                    actor: "super_admin",
                },
            });

            return { success: true as const, shopId };
        } catch (err) {
            console.error("moveToFree failed:", err);
            setError("Failed to move to Free plan");
            return { success: false as const, error: err };
        } finally {
            setLoading(false);
        }
    };

    return { moveToFree, loading, error };
}
