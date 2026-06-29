"use strict";
/**
 * Canonical subscription tiers: Free, Pro, Pro+, Business.
 * Legacy aliases (proplus, enterprise, premium, starter) are normalized here.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.planDisplayName = exports.normalizePlanId = void 0;
function normalizePlanId(planId) {
    const r = String(planId !== null && planId !== void 0 ? planId : "").toLowerCase().replace(/[_\s-]/g, "");
    if (r === "proplus" || r === "pro+")
        return "pro_plus";
    if (r === "business" || r === "enterprise" || r === "premium")
        return "business";
    if (r === "pro" || r === "starter")
        return "pro";
    return "free";
}
exports.normalizePlanId = normalizePlanId;
function planDisplayName(planId) {
    const c = normalizePlanId(planId);
    return c === "business" ? "Business" : c === "pro_plus" ? "Pro+" : c === "pro" ? "Pro" : "Free";
}
exports.planDisplayName = planDisplayName;
//# sourceMappingURL=plan-normalize.js.map