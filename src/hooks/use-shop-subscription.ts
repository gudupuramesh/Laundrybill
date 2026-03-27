import { useState, useEffect } from "react";
import { doc, getDoc, collection, query, where, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth";
import { PLANS, getPlan } from "@/config/plans";
import { normalizePlanId } from "@/types/plans";
import type { Plan } from "@/types/plans";
import { useShop } from "@/hooks/use-shop"; // Hybrid Source
import { usePlans } from "@/features/super-admin/hooks/use-plans";
import type { ShopSubscription } from "@/types";

// Removed local ShopUsage interface as it is now imported from @/types
// Removed local ShopSubscription interface as it is now imported from @/types

export function useShopSubscription() {
    const { shopId } = useAuth();
    const [subscription, setSubscription] = useState<ShopSubscription | null>(null);
    const [loading, setLoading] = useState(true);
    const { plans } = usePlans(); // Fetch dynamic plans

    useEffect(() => {
        async function fetchSubscription() {
            if (!shopId) {
                setLoading(false);
                return;
            }

            try {
                let data: any = null;
                let subId: string = shopId;

                // 1. Try direct document fetch first
                try {
                    const subDoc = await getDoc(doc(db, "subscriptions", shopId));
                    if (subDoc.exists()) {
                        data = subDoc.data();
                        subId = subDoc.id;
                    }
                } catch (e: any) {
                    // Ignore permission errors - user might not have a subscription doc yet
                    // and rules might deny reading non-existent docs
                    if (e.code !== 'permission-denied') {
                        console.warn("Subscription fetch failed:", e);
                    }
                }

                // 2. Fallback: Query by shopId if no direct doc and no data yet
                if (!data) {
                    try {
                        const q = query(
                            collection(db, "subscriptions"),
                            where("shopId", "==", shopId),
                            limit(1)
                        );
                        const snapshot = await getDocs(q);
                        if (!snapshot.empty) {
                            data = snapshot.docs[0].data();
                            subId = snapshot.docs[0].id;
                        }
                    } catch (e: any) {
                        // Ignore permission errors
                        if (e.code !== 'permission-denied') {
                            console.warn("Subscription query failed:", e);
                        }
                    }
                }

                if (data) {
                    const planId = normalizePlanId(data.planId);
                    const planDef =
                        plans.find((p) => normalizePlanId(p.id) === planId) || getPlan(planId);

                    const endDate = data.endDate?.toDate?.() || null;
                    const trialEndDateAt = data.trialEndDate?.toDate?.() || null;

                    let daysRemaining = null;
                    if (endDate) {
                        daysRemaining = Math.ceil(
                            (endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                        );
                    }

                    console.log("Subscription loaded:", { planId, status: data.status, endDate });

                    setSubscription({
                        id: subId,
                        planId,
                        planName: planDef.name,
                        status: data.status || "free",
                        expiresAt: endDate,
                        endDate: data.endDate,
                        trialEndDate: data.trialEndDate,
                        trialEndDateAt,
                        graceEndDate: data.graceEndDate,
                        activeUntil: data.activeUntil,
                        pendingDowngrade: data.pendingDowngrade,
                        usage: data.usage || { ordersThisMonth: 0, totalCustomers: 0, totalStaff: 0, totalServices: 0 },
                        daysRemaining,
                    });
                } else {
                    // No subscription = Free plan
                    const freePlan = plans.find(p => p.id === "free") || PLANS.free;

                    setSubscription({
                        planId: "free",
                        planName: freePlan?.name || "Free",
                        status: "free",
                        expiresAt: null,
                        endDate: null,
                        trialEndDate: null,
                        graceEndDate: null,
                        activeUntil: null,
                        usage: { ordersThisMonth: 0, totalCustomers: 0, totalStaff: 0, totalServices: 0 },
                        daysRemaining: null,
                    });
                }
            } catch (err: any) {
                // Only log real errors, not permission denied
                if (err?.code !== 'permission-denied') {
                    console.error("Error fetching subscription:", err);
                }

                setSubscription({
                    planId: "free",
                    planName: "Free",
                    status: "free",
                    expiresAt: null,
                    endDate: null,
                    trialEndDate: null,
                    graceEndDate: null,
                    activeUntil: null,
                    usage: { ordersThisMonth: 0, totalCustomers: 0, totalStaff: 0, totalServices: 0 },
                    daysRemaining: null,
                });
            } finally {
                setLoading(false);
            }
        }

        fetchSubscription();
    }, [shopId, plans]); // Add plans dependency to refetch if plans load late


    // Also fetch Shop Profile (Robust Backup)
    const { shop } = useShop();

    return { subscription: getRobustSubscription(subscription, shop, plans), loading };
}

// Helper to merge sources
function getRobustSubscription(
    subDoc: ShopSubscription | null,
    shop: any,
    plans: Plan[]
): ShopSubscription | null {
    // 1. If we have a valid Sub Doc that is NOT Free, trust it (it has billing info)
    const normalizedSubPlan = normalizePlanId(subDoc?.planId);
    if (subDoc && normalizedSubPlan !== "free") {
        return { ...subDoc, planId: normalizedSubPlan, planName: getPlan(normalizedSubPlan).name };
    }

    // 2. If Shop Profile has a plan (synced via Cloud Function/Admin Override)
    // AND it is better than Free, use it.
    const shopPlanId = normalizePlanId(String(shop?.subscription?.planId || shop?.plan || ""));
    const shopSub = shop?.subscription;

    if (shopPlanId && shopPlanId !== "free") {
        const planId = shopPlanId;
        const planDef = plans.find((p) => normalizePlanId(p.id) === planId) || getPlan(planId);

        // Construct a synthetic subscription object from Shop data
        return {
            id: "shop-profile-sync", // virtual ID
            planId: planId,
            planName: planDef.name,
            status: shopSub?.status || shop?.subscriptionStatus || "active",
            expiresAt: shopSub?.endDate?.toDate?.() || null,
            endDate: shopSub?.endDate,
            activeUntil: shopSub?.activeUntil,
            usage: subDoc?.usage || { ordersThisMonth: 0, totalCustomers: 0, totalStaff: 0, totalServices: 0 },
            daysRemaining: subDoc?.daysRemaining ?? 30, // Fallback
            billingCycle: shopSub?.billingCycle || "monthly"
        };
    }

    // 3. Fallback to whatever we found (Free or Null)
    return subDoc;
}
