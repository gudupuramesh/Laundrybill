"use strict";
/**
 * Trial configuration for new user signups.
 * Stored in Firestore: platformSettings/subscription
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSubscriptionButtonsEnabled = exports.getDurationDiscounts = exports.DEFAULT_DURATION_DISCOUNTS = exports.getTrialConfig = exports.getTrialPlanName = void 0;
const admin = require("firebase-admin");
const TRIAL_CONFIG_DOC = "subscription";
const DEFAULT_TRIAL_DAYS = 14;
const DEFAULT_TRIAL_PLAN_ID = "pro";
const PLAN_NAMES = {
    pro: "Pro",
    pro_plus: "Pro Plus",
    business: "Business",
};
function getTrialPlanName(planId) {
    return PLAN_NAMES[planId] || "Pro";
}
exports.getTrialPlanName = getTrialPlanName;
/**
 * Fetch trial config from Firestore (platformSettings/subscription).
 * Used when creating trial subscription on new shop.
 */
async function getTrialConfig() {
    const db = admin.firestore();
    try {
        const doc = await db.collection("platformSettings").doc(TRIAL_CONFIG_DOC).get();
        if (!doc.exists) {
            return {
                trialDurationDays: DEFAULT_TRIAL_DAYS,
                trialPlanId: DEFAULT_TRIAL_PLAN_ID,
            };
        }
        const data = doc.data();
        const value = Number(data === null || data === void 0 ? void 0 : data.trialDurationValue);
        const unit = data === null || data === void 0 ? void 0 : data.trialDurationUnit;
        let days = Number.isFinite(value) && value > 0 ? value : 0;
        if (unit === "months")
            days = Math.round(days * 30);
        if (days <= 0)
            days = DEFAULT_TRIAL_DAYS;
        days = Math.min(days, 365);
        const planId = data === null || data === void 0 ? void 0 : data.trialPlanId;
        const validPlans = ["pro", "pro_plus", "business"];
        return {
            trialDurationDays: days,
            trialPlanId: planId && validPlans.includes(planId) ? planId : DEFAULT_TRIAL_PLAN_ID,
        };
    }
    catch (e) {
        console.warn("getTrialConfig failed, using defaults:", e);
        return {
            trialDurationDays: DEFAULT_TRIAL_DAYS,
            trialPlanId: DEFAULT_TRIAL_PLAN_ID,
        };
    }
}
exports.getTrialConfig = getTrialConfig;
/** Duration discount % for 3/6/9/12 months (0–100). Stored in platformSettings/subscription */
exports.DEFAULT_DURATION_DISCOUNTS = { 3: 0, 6: 5, 9: 10, 12: 17 };
async function getDurationDiscounts() {
    const db = admin.firestore();
    try {
        const docSnap = await db.collection("platformSettings").doc(TRIAL_CONFIG_DOC).get();
        if (!docSnap.exists)
            return Object.assign({}, exports.DEFAULT_DURATION_DISCOUNTS);
        const d = docSnap.data();
        const get = (key, def) => {
            const v = Number(d === null || d === void 0 ? void 0 : d[key]);
            return Number.isFinite(v) && v >= 0 && v <= 100 ? v : def;
        };
        return {
            3: get("discount3Months", exports.DEFAULT_DURATION_DISCOUNTS[3]),
            6: get("discount6Months", exports.DEFAULT_DURATION_DISCOUNTS[6]),
            9: get("discount9Months", exports.DEFAULT_DURATION_DISCOUNTS[9]),
            12: get("discount12Months", exports.DEFAULT_DURATION_DISCOUNTS[12]),
        };
    }
    catch (e) {
        console.warn("getDurationDiscounts failed, using defaults:", e);
        return Object.assign({}, exports.DEFAULT_DURATION_DISCOUNTS);
    }
}
exports.getDurationDiscounts = getDurationDiscounts;
/** Check if subscription buttons are enabled (Super Admin toggle). Default: true */
async function getSubscriptionButtonsEnabled() {
    const db = admin.firestore();
    try {
        const docSnap = await db.collection("platformSettings").doc(TRIAL_CONFIG_DOC).get();
        if (!docSnap.exists)
            return true; // enabled by default
        const data = docSnap.data();
        // Enabled unless explicitly set to false
        return (data === null || data === void 0 ? void 0 : data.subscriptionButtonsEnabled) !== false;
    }
    catch (e) {
        console.warn("getSubscriptionButtonsEnabled failed, using default (true):", e);
        return true;
    }
}
exports.getSubscriptionButtonsEnabled = getSubscriptionButtonsEnabled;
//# sourceMappingURL=trial-config.js.map