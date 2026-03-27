"use strict";
/**
 * Canonical subscription tiers: Free + one paid plan (Pro).
 * Legacy Firestore values pro_plus / business are treated as Pro.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.planDisplayName = exports.normalizePlanId = void 0;
function normalizePlanId(planId) {
    const r = String(planId !== null && planId !== void 0 ? planId : "").toLowerCase().trim();
    if (r === "pro" || r === "pro_plus" || r === "business")
        return "pro";
    return "free";
}
exports.normalizePlanId = normalizePlanId;
function planDisplayName(planId) {
    return normalizePlanId(planId) === "pro" ? "Pro" : "Free";
}
exports.planDisplayName = planDisplayName;
//# sourceMappingURL=plan-normalize.js.map