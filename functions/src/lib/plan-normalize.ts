/**
 * Canonical subscription tiers: Free + one paid plan (Pro).
 * Legacy Firestore values pro_plus / business are treated as Pro.
 */

export type CanonicalPlanId = "free" | "pro";

export function normalizePlanId(planId: string | undefined | null): CanonicalPlanId {
    const r = String(planId ?? "").toLowerCase().trim();
    if (r === "pro" || r === "pro_plus" || r === "business") return "pro";
    return "free";
}

export function planDisplayName(planId: string | undefined | null): string {
    return normalizePlanId(planId) === "pro" ? "Pro" : "Free";
}
