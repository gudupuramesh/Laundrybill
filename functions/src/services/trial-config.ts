/**
 * Trial configuration for new user signups.
 * Stored in Firestore: platformSettings/subscription
 */

import * as admin from "firebase-admin";

const TRIAL_CONFIG_DOC = "subscription";
const DEFAULT_TRIAL_DAYS = 14;
const DEFAULT_TRIAL_PLAN_ID = "pro";

export interface TrialConfig {
    trialDurationDays: number;
    trialPlanId: string;
}

/** Raw stored shape: value + unit for display in Super Admin */
export interface TrialConfigStored {
    trialDurationValue?: number;
    trialDurationUnit?: "days" | "months";
    trialPlanId?: string;
}

const PLAN_NAMES: Record<string, string> = {
    pro: "Pro",
    pro_plus: "Pro Plus",
    business: "Business",
};

export function getTrialPlanName(planId: string): string {
    return PLAN_NAMES[planId] || "Pro";
}

/**
 * Fetch trial config from Firestore (platformSettings/subscription).
 * Used when creating trial subscription on new shop.
 */
export async function getTrialConfig(): Promise<TrialConfig> {
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
        const value = Number(data?.trialDurationValue);
        const unit = data?.trialDurationUnit as "days" | "months" | undefined;
        let days = Number.isFinite(value) && value > 0 ? value : 0;
        if (unit === "months") days = Math.round(days * 30);
        if (days <= 0) days = DEFAULT_TRIAL_DAYS;
        days = Math.min(days, 365);

        const planId = data?.trialPlanId as string | undefined;
        const validPlans = ["pro", "pro_plus", "business"];
        return {
            trialDurationDays: days,
            trialPlanId: planId && validPlans.includes(planId) ? planId : DEFAULT_TRIAL_PLAN_ID,
        };
    } catch (e) {
        console.warn("getTrialConfig failed, using defaults:", e);
        return {
            trialDurationDays: DEFAULT_TRIAL_DAYS,
            trialPlanId: DEFAULT_TRIAL_PLAN_ID,
        };
    }
}

/** Duration discount % for 3/6/9/12 months (0–100). Stored in platformSettings/subscription */
export const DEFAULT_DURATION_DISCOUNTS: Record<number, number> = { 3: 0, 6: 5, 9: 10, 12: 17 };

export async function getDurationDiscounts(): Promise<Record<number, number>> {
    const db = admin.firestore();
    try {
        const docSnap = await db.collection("platformSettings").doc(TRIAL_CONFIG_DOC).get();
        if (!docSnap.exists) return { ...DEFAULT_DURATION_DISCOUNTS };
        const d = docSnap.data();
        const get = (key: string, def: number) => {
            const v = Number(d?.[key]);
            return Number.isFinite(v) && v >= 0 && v <= 100 ? v : def;
        };
        return {
            3: get("discount3Months", DEFAULT_DURATION_DISCOUNTS[3]),
            6: get("discount6Months", DEFAULT_DURATION_DISCOUNTS[6]),
            9: get("discount9Months", DEFAULT_DURATION_DISCOUNTS[9]),
            12: get("discount12Months", DEFAULT_DURATION_DISCOUNTS[12]),
        };
    } catch (e) {
        console.warn("getDurationDiscounts failed, using defaults:", e);
        return { ...DEFAULT_DURATION_DISCOUNTS };
    }
}

/** Check if subscription buttons are enabled (Super Admin toggle). Default: true */
export async function getSubscriptionButtonsEnabled(): Promise<boolean> {
    const db = admin.firestore();
    try {
        const docSnap = await db.collection("platformSettings").doc(TRIAL_CONFIG_DOC).get();
        if (!docSnap.exists) return true; // enabled by default
        const data = docSnap.data();
        // Enabled unless explicitly set to false
        return data?.subscriptionButtonsEnabled !== false;
    } catch (e) {
        console.warn("getSubscriptionButtonsEnabled failed, using default (true):", e);
        return true;
    }
}
