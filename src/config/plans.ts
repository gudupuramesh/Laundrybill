/**
 * Plans Configuration
 *
 * Single paid tier: Free + Pro (all product features unlocked on Pro).
 */

import type { Plan, PlanType, PlanFeatures } from "@/types/plans";

const BASE_FEATURES: PlanFeatures = {
    orders: true,
    customers: true,
    services: true,
    posBasic: true,
    orderTracking: true,
    whatsappReceipts: true,
    multiLanguage: true,
    staffManagement: false,
    attendance: false,
    payroll: false,
    expenses: false,
    reports: false,
    damagePhotos: false,
    staffApp: false,
    driverApp: false,
    plantApp: false,
    qrScans: false,
    publicOrderingPage: false,
};

export const PLANS: Record<PlanType, Plan> = {
    free: {
        id: "free",
        name: "Free",
        description: "Perfect for getting started",
        prices: { monthly: 0, yearly: 0 },
        features: { ...BASE_FEATURES },
        limits: {
            maxOrders: 50,
            maxCustomers: 100,
            maxStaff: 1,
            maxDeliveryAgents: 0,
            maxPlantStaff: 0,
            maxRoster: 50,
            maxServices: -1,
            storageGB: 0.5,
        },
        apps: ["admin"],
        isActive: true,
    },

    pro: {
        id: "pro",
        name: "Pro",
        description: "Full access — staff apps, delivery, plant, public ordering, and more",
        badge: "Pro",
        prices: { monthly: 499, yearly: 4999 },
        features: {
            ...BASE_FEATURES,
            staffManagement: true,
            attendance: true,
            payroll: true,
            expenses: true,
            reports: true,
            damagePhotos: true,
            staffApp: true,
            driverApp: true,
            plantApp: true,
            qrScans: true,
            publicOrderingPage: true,
        },
        limits: {
            maxOrders: -1,
            maxCustomers: -1,
            maxStaff: -1,
            maxDeliveryAgents: -1,
            maxPlantStaff: -1,
            maxRoster: -1,
            maxServices: -1,
            storageGB: 100,
        },
        apps: ["admin", "staff", "driver", "plant"],
        isActive: true,
    },
};

export function getPlan(planId: string | PlanType | null | undefined): Plan {
    const id = planId === "free" || planId === "pro" ? planId : null;
    if (id) return PLANS[id];
    // Legacy ids
    const n = String(planId || "").toLowerCase();
    if (n === "pro_plus" || n === "business") return PLANS.pro;
    return PLANS.free;
}

export function formatPlanPrice(plan: Plan, cycle: "monthly" | "yearly"): string {
    const price = plan.prices[cycle];
    if (price === 0) return "Free";
    return `₹${price.toLocaleString()}/${cycle === "monthly" ? "mo" : "yr"}`;
}

export function hasFeature(planId: PlanType | string, feature: keyof PlanFeatures): boolean {
    const plan = getPlan(planId);
    return plan.features[feature] ?? false;
}

export function isWithinLimit(
    planId: PlanType | string,
    limitType: "maxOrders" | "maxCustomers" | "maxStaff" | "maxServices",
    currentCount: number
): boolean {
    const plan = getPlan(planId);
    const limit = plan.limits[limitType];
    if (limit === -1) return true;
    return currentCount < limit;
}

/** Free vs Pro comparison (single paid tier) */
export const PLAN_COMPARISON = [
    { feature: "Monthly Orders", free: "50", pro: "Unlimited" },
    { feature: "Customers", free: "100", pro: "Unlimited" },
    { feature: "Staff & apps", free: "1 admin", pro: "Unlimited staff, Staff / Driver / Plant apps" },
    { feature: "Staff Management & Payroll", free: false, pro: true },
    { feature: "Reports & Analytics", free: false, pro: true },
    { feature: "Damage photos & QR", free: false, pro: true },
    { feature: "Public ordering page", free: false, pro: true },
];
