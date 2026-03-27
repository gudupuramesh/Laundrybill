import { usePlans } from "@/features/super-admin/hooks/use-plans";
import type { PlanType, PlanFeatures } from "@/types/plans";
import { normalizePlanId } from "@/types/plans";
import { PLANS, getPlan } from "@/config/plans";

import { useShop } from "@/hooks/use-shop";
import { useShopSubscription } from "@/hooks/use-shop-subscription";

export function useShopLimits() {
    const { subscription, loading } = useShopSubscription();
    const { shop, loading: shopLoading } = useShop(); // Read directly from Shop Profile (synced by Cloud Function)
    const { plans } = usePlans();

    // Strategy: Prefer Shop Document Plan (synced by Cloud Function) if available,
    // otherwise fallback to Subscription Document Plan,
    // otherwise Free.
    const shopPlanId = normalizePlanId(
        String(shop?.subscription?.planId || shop?.plan || "")
    );
    const subPlanId = normalizePlanId(String(subscription?.planId || ""));

    // ============================================
    // CRITICAL: Check if subscription is ACTIVE
    // ============================================
    // Get status from subscription document OR shop document
    const subscriptionStatus = subscription?.status || shop?.subscription?.status || shop?.subscriptionStatus || "free";

    const now = new Date();
    const subActiveUntil = subscription?.activeUntil?.toDate?.();
    const shopActiveUntil = (shop?.subscription as { activeUntil?: { toDate?: () => Date } } | undefined)?.activeUntil?.toDate?.();
    const activeUntil = subActiveUntil || shopActiveUntil;

    const isCancelledButActive =
        subscriptionStatus === "cancelled" &&
        activeUntil &&
        activeUntil > now;

    // Valid statuses that allow paid plan access
    const isActiveSubscription =
        subscriptionStatus === "active" ||
        subscriptionStatus === "trial" ||
        subscriptionStatus === "grace_period" ||
        isCancelledButActive;

    if (!isActiveSubscription && subscriptionStatus !== "free") {
        console.log(`Subscription status is "${subscriptionStatus}" - downgrading to free plan features`);
    }

    let currentPlanId: PlanType = "free";

    if (isActiveSubscription) {
        if (shopPlanId && shopPlanId !== "free") {
            currentPlanId = shopPlanId;
        } else if (subPlanId && subPlanId !== "free") {
            currentPlanId = subPlanId;
        }
    } else {
        currentPlanId = "free";
    }

    currentPlanId = normalizePlanId(currentPlanId);
    if (!PLANS[currentPlanId]) currentPlanId = "free";

    // Find plan definition: Prefer Firestore (Super Admin edits) over config defaults
    const planFromFirestore = plans.find((p) => normalizePlanId(p.id) === currentPlanId);
    const configPlan = getPlan(currentPlanId);
    // Merge features: Firestore overrides config only when value is explicitly set.
    // This fixes trial/legacy plans where Firestore may lack new feature keys (e.g. publicOrderingPage).
    const mergeFeatures = () => {
        const cfg = configPlan.features;
        const fs = planFromFirestore?.features;
        const out = { ...cfg };
        (Object.keys(cfg) as (keyof PlanFeatures)[]).forEach((k) => {
            if (fs && fs[k] !== undefined) out[k] = fs[k];
        });
        return out;
    };
    const plan = planFromFirestore
        ? {
            ...configPlan,
            ...planFromFirestore,
            limits: { ...configPlan.limits, ...(planFromFirestore.limits || {}) },
            features: mergeFeatures(),
        }
        : configPlan;

    // Feature Check
    const hasFeature = (feature: keyof PlanFeatures) => {
        return plan.features[feature] === true;
    };

    // Limits Check Helpers (We will need actual counts)
    // For now, simpler version just checks the numbers against static limits
    // In real app, we would pass in current counts or fetch them here

    const checkLimit = (
        type: keyof import("@/types/plans").PlanLimits,
        currentCount: number
    ) => {
        const limit = plan.limits[type];
        // Undefined/null (e.g. old plans in DB): treat as unlimited
        if (limit == null) return { allowed: true, limit: -1, current: currentCount };
        if (limit === -1) return { allowed: true, limit: -1, current: currentCount };

        return {
            allowed: currentCount < limit,
            limit,
            current: currentCount,
            remaining: Math.max(0, limit - currentCount)
        };
    };

    return {
        plan,
        hasFeature,
        checkLimit,
        isPro: currentPlanId !== "free",
        /** @deprecated Same as paid tier (single Pro plan). Use isPro. */
        isBusiness: currentPlanId !== "free",
        loading: loading || shopLoading
    };
}
