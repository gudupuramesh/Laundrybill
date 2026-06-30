/**
 * Plans Configuration
 *
 * Three-tier model:
 *   Free     — Getting started
 *   Pro      — Small laundry shops (staff, attendance, expenses, reports)
 *   Business — Big shops & entrepreneurs (plant, driver, multi-staff, public page, web login)
 *
 * Pricing:
 *   Pro      — app stores (RevenueCat): Android ₹299/mo, iOS ₹499/mo  (LIVE)
 *   Pro+     — web (Razorpay recurring): ₹799/mo
 *   Business — web (Razorpay recurring): ₹1,999/mo
 *
 * NOTE: the live displayed prices come from Firestore `plans/{id}` (super-admin);
 * the values below are the code fallback and must be kept in sync with Firestore.
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
            webDashboard: true,
            // Pro is owner-only: no team logins of any type. The *App feature flags
            // are what the Firestore rules gate login creation on, so they MUST be false.
            staffApp: false,
            damagePhotos: false,
            driverApp: false,
            plantApp: false,
            publicOrderingPage: false,
        },
        limits: {
            maxOrders: -1,
            maxCustomers: -1,
            // Pro is owner-only: no team logins of any type (staff/agent/plant).
            // Creating logins requires Pro+ or Business.
            maxStaff: 0,
            maxDeliveryAgents: 0,
            maxPlantStaff: 0,
            maxRoster: 20,
            maxServices: -1,
            storageGB: 5,
        },
        apps: ["admin"],
        isActive: true,
    },

    pro_plus: {
        id: "pro_plus",
        name: "Pro+",
        description: "For single shops that need a team — staff, agent & plant logins plus public booking",
        badge: "Most Powerful",
        prices: { monthly: 799, yearly: 7990 },
        pricesIntl: { monthly: 15, yearly: 150 }, // USD — international tier
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
            webDashboard: true,
            // Pro+ unlocks all three login types + public booking (lower caps than Business).
            staffApp: true,
            driverApp: true,
            plantApp: true,
            publicOrderingPage: true,
            // Business-only extras stay off.
            damagePhotos: false,
        },
        limits: {
            maxOrders: -1,
            maxCustomers: -1,
            maxStaff: 3,
            maxDeliveryAgents: 2,
            maxPlantStaff: 1,
            maxRoster: -1,
            maxServices: -1,
            storageGB: 20,
        },
        apps: ["admin", "staff", "driver", "plant"],
        isActive: true,
    },

    business: {
        id: "business",
        name: "Business",
        description: "Scale with plant processing, drivers, multi-staff & public bookings",
        badge: "Enterprise",
        prices: { monthly: 1999, yearly: 19990 },
        pricesIntl: { monthly: 35, yearly: 350 }, // USD — international tier
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
            // Finite (large) login caps — Business is also capped per the plan policy.
            maxStaff: 15,
            maxDeliveryAgents: 15,
            maxPlantStaff: 15,
            maxRoster: -1,
            maxServices: -1,
            storageGB: 100,
        },
        apps: ["admin", "staff", "driver", "plant"],
        isActive: true,
    },
};

export function getPlan(planId: string | PlanType | null | undefined): Plan {
    const id = planId === "free" || planId === "pro" || planId === "pro_plus" || planId === "business" ? planId : null;
    if (id) return PLANS[id];
    // Legacy ids
    const n = String(planId || "").toLowerCase().replace(/[_\s-]/g, "");
    if (n === "proplus" || n === "pro+") return PLANS.pro_plus;
    if (n === "business" || n === "enterprise" || n === "premium") return PLANS.business;
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

/** Free vs Pro vs Pro+ vs Business comparison */
export const PLAN_COMPARISON = [
    { feature: "Monthly Orders", free: "50", pro: "Unlimited", pro_plus: "Unlimited", business: "Unlimited" },
    { feature: "Customers", free: "100", pro: "Unlimited", pro_plus: "Unlimited", business: "Unlimited" },
    { feature: "Team logins", free: "Owner only", pro: "Owner only", pro_plus: "3 staff · 2 agents · 1 plant", business: "15 each" },
    { feature: "Order Tracking Link", free: false, pro: true, pro_plus: true, business: true },
    { feature: "WhatsApp Receipts", free: false, pro: true, pro_plus: true, business: true },
    { feature: "QR Code Scanning", free: false, pro: true, pro_plus: true, business: true },
    { feature: "Staff Management", free: false, pro: true, pro_plus: true, business: true },
    { feature: "Attendance & Payroll", free: false, pro: true, pro_plus: true, business: true },
    { feature: "Expenses Tracking", free: false, pro: true, pro_plus: true, business: true },
    { feature: "Reports & Analytics", free: false, pro: true, pro_plus: true, business: true },
    { feature: "Driver / Agent App", free: false, pro: false, pro_plus: true, business: true },
    { feature: "Plant Processing", free: false, pro: false, pro_plus: true, business: true },
    { feature: "Public Ordering Page", free: false, pro: false, pro_plus: true, business: true },
    { feature: "Web Dashboard Access", free: false, pro: true, pro_plus: true, business: true },
    { feature: "Damage Photos", free: false, pro: false, pro_plus: false, business: true },
];
