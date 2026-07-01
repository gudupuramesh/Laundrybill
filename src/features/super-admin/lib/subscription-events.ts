/**
 * Subscription audit events (super-admin, web write-side).
 *
 * Appends immutable records to the platform `activity_logs` collection so every
 * plan / subscription change builds a real history — surfaced both on the Activity
 * page and on a shop's detail-page timeline. The shape matches `ActivityLog`, so
 * existing readers render these events without any changes.
 *
 * Best-effort by design: logging NEVER throws and never blocks the mutation it
 * records. A dropped audit line must not fail a plan change.
 */

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ActivityType } from "@/types/super-admin";
import type { PlanType } from "@/types/plans";
import { normalizePlanId } from "@/types/plans";
import { PLANS } from "@/config/plans";

export interface SubscriptionEventInput {
    type: ActivityType;
    shopId: string;
    shopName?: string | null;
    /** Human-readable summary shown on the Activity page + shop timeline. */
    description: string;
    superAdminId?: string | null;
    /** Structured detail (fromPlan/toPlan/status/amount/reason/actor…). */
    metadata?: Record<string, unknown>;
}

export async function logSubscriptionEvent(input: SubscriptionEventInput): Promise<void> {
    try {
        await addDoc(collection(db, "activity_logs"), {
            type: input.type,
            shopId: input.shopId,
            shopName: input.shopName ?? null,
            description: input.description,
            superAdminId: input.superAdminId ?? null,
            metadata: input.metadata ?? {},
            createdAt: serverTimestamp(),
        });
    } catch (err) {
        console.warn("logSubscriptionEvent failed (non-fatal):", err);
    }
}

const PLAN_RANK: Record<PlanType, number> = { free: 0, pro: 1, pro_plus: 2, business: 3 };

/** Pick the ActivityType for a plan transition so the timeline colours it correctly. */
export function planChangeActivityType(
    fromPlan: PlanType | string | null | undefined,
    toPlan: PlanType
): ActivityType {
    if (toPlan === "free") return "subscription_downgraded";
    const f = PLAN_RANK[normalizePlanId(fromPlan)] ?? 0;
    const t = PLAN_RANK[toPlan] ?? 0;
    if (t > f) return "subscription_upgraded";
    if (t < f) return "subscription_downgraded";
    return "plan_override";
}

/** Display name for a plan id ("Free" | "Pro" | "Pro+" | "Business"). */
export function planLabel(planId: PlanType | string | null | undefined): string {
    return PLANS[normalizePlanId(planId)]?.name ?? "Free";
}

/** Monthly-equivalent list price for a plan (₹) — used for MRR estimates. */
export function monthlyPrice(
    planId: PlanType | string | null | undefined,
    billingCycle?: string | null
): number {
    const plan = PLANS[normalizePlanId(planId)];
    if (!plan) return 0;
    if (billingCycle === "yearly") return Math.round((plan.prices.yearly || 0) / 12);
    return plan.prices.monthly || 0;
}
