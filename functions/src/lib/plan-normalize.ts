/**
 * Canonical subscription tiers: Free, Pro, Pro+, Business, Franchise.
 * Legacy aliases (proplus, enterprise, premium, starter) are normalized here.
 */

export type CanonicalPlanId = "free" | "pro" | "pro_plus" | "business" | "franchise";

export function normalizePlanId(planId: string | undefined | null): CanonicalPlanId {
    const r = String(planId ?? "").toLowerCase().replace(/[_\s-]/g, "");
    if (r === "franchise" || r === "multishop") return "franchise";
    if (r === "proplus" || r === "pro+") return "pro_plus";
    if (r === "business" || r === "enterprise" || r === "premium") return "business";
    if (r === "pro" || r === "starter") return "pro";
    return "free";
}

export function planDisplayName(planId: string | undefined | null): string {
    const c = normalizePlanId(planId);
    return c === "franchise"
        ? "Franchise"
        : c === "business"
          ? "Business"
          : c === "pro_plus"
            ? "Pro+"
            : c === "pro"
              ? "Pro"
              : "Free";
}
