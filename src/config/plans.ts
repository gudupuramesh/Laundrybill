/**
 * Plans Configuration
 *
 * Three-tier model:
 *   Free     — Getting started
 *   Pro      — Small laundry shops (staff, attendance, expenses, reports)
 *   Business — Big shops & entrepreneurs (plant, driver, multi-staff, public page, web login)
 *
 * Platform-specific pricing (actual prices come from RevenueCat → store):
 *   Android (Google Play) — Pro: ₹299/mo, Business: ₹1,299/mo  (LIVE with real users)
 *   iOS (App Store)       — Pro: ₹499/mo, Business: ₹1,499/mo
 *
 * The prices below are the Android (base) prices shown on the web dashboard.
 */

import type { Plan, PlanType, PlanFeatures } from "@/types/plans";

const BASE_FEATURES: PlanFeatures = {
    orders: true,
    customers: true,
    services: true,
    orderTracking: false,
    whatsappReceipts: false,
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
    webDashboard: false,
};

export const PLANS: Record<PlanType, Plan> = {
    free: {
        id: "free",
        name: "Free",
        description: "Perfect for getting started with basic order management",
        prices: { monthly: 0, yearly: 0 },
        features: { ...BASE_FEATURES },
        limits: {
            maxOrders: 50,
            maxCustomers: 100,
            maxStaff: 1,
            maxDeliveryAgents: 0,
            maxPlantStaff: 0,
            maxRoster: 5,
            maxServices: -1,
            storageGB: 0.5,
        },
        apps: ["admin"],
        isActive: true,
    },

    pro: {
        id: "pro",
        name: "Pro",
        description: "Run your laundry on autopilot — unlimited orders, staff tools & analytics",
        badge: "Best Value",
        prices: { monthly: 299, yearly: 2999 },
        features: {
            ...BASE_FEATURES,
            orderTracking: true,
            whatsappReceipts: true,
            staffManagement: true,
            attendance: true,
            payroll: true,
            expenses: true,
            reports: true,
            qrScans: true,
            staffApp: true,
            webDashboard: false,
            damagePhotos: false,
            driverApp: false,
            plantApp: false,
            publicOrderingPage: false,
        },
        limits: {
            maxOrders: -1,
            maxCustomers: -1,
            maxStaff: 1,
            maxDeliveryAgents: 0,
            maxPlantStaff: 0,
            maxRoster: 20,
            maxServices: -1,
            storageGB: 5,
        },
        apps: ["admin", "staff"],
        isActive: true,
    },

    business: {
        id: "business",
        name: "Business",
        description: "Scale with plant processing, drivers, multi-staff & public bookings",
        badge: "Enterprise",
        prices: { monthly: 1299, yearly: 12999 },
        features: {
            ...BASE_FEATURES,
            orderTracking: true,
            whatsappReceipts: true,
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
            webDashboard: true,
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
    const id = planId === "free" || planId === "pro" || planId === "business" ? planId : null;
    if (id) return PLANS[id];
    // Legacy ids
    const n = String(planId || "").toLowerCase().replace(/[_\s-]/g, "");
    if (n === "business" || n === "enterprise" || n === "proplus" || n === "premium") return PLANS.business;
    if (n === "pro" || n === "starter") return PLANS.pro;
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

/** Free vs Pro vs Business comparison */
export const PLAN_COMPARISON = [
    { feature: "Monthly Orders", free: "50", pro: "Unlimited", business: "Unlimited" },
    { feature: "Customers", free: "100", pro: "Unlimited", business: "Unlimited" },
    { feature: "Staff accounts", free: "1 admin", pro: "1 staff login", business: "Unlimited" },
    { feature: "Order Tracking Link", free: false, pro: true, business: true },
    { feature: "WhatsApp Receipts", free: false, pro: true, business: true },
    { feature: "QR Code Scanning", free: false, pro: true, business: true },
    { feature: "Staff Management", free: false, pro: true, business: true },
    { feature: "Attendance & Payroll", free: false, pro: true, business: true },
    { feature: "Expenses Tracking", free: false, pro: true, business: true },
    { feature: "Reports & Analytics", free: false, pro: true, business: true },
    { feature: "Damage Photos", free: false, pro: false, business: true },
    { feature: "Driver / Agent App", free: false, pro: false, business: true },
    { feature: "Plant Processing", free: false, pro: false, business: true },
    { feature: "Public Ordering Page", free: false, pro: false, business: true },
    { feature: "Web Dashboard Access", free: false, pro: false, business: true },
];
