/**
 * Plans Configuration
 * 
 * Defines all subscription plans with features and limits
 */

import type { Plan, PlanType, PlanFeatures } from "@/types/plans";

// Base features template
const BASE_FEATURES: PlanFeatures = {
    // Core
    orders: true,
    customers: true,
    services: true,
    posBasic: true,
    orderTracking: true,
    whatsappReceipts: true,
    multiLanguage: true,

    // Staff & Operations
    staffManagement: false,
    attendance: false,
    payroll: false,
    expenses: false,
    reports: false,

    // Advanced
    damagePhotos: false,
    staffApp: false,
    driverApp: false,
    plantApp: false,
    qrScans: false,
    publicOrderingPage: false,
};

// Plan definitions
export const PLANS: Record<PlanType, Plan> = {
    free: {
        id: "free",
        name: "Free",
        description: "Perfect for getting started",
        prices: { monthly: 0, yearly: 0 },
        features: {
            ...BASE_FEATURES,
        },
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
        description: "For growing businesses",
        badge: "Most Popular",
        prices: { monthly: 499, yearly: 4999 },
        features: {
            ...BASE_FEATURES,
            staffManagement: true,
            attendance: true,
            payroll: true,
            expenses: true,
            reports: true,
        },
        limits: {
            maxOrders: -1,
            maxCustomers: -1,
            maxStaff: 5,
            maxDeliveryAgents: 2,
            maxPlantStaff: 0,
            maxRoster: -1,
            maxServices: -1,
            storageGB: 5,
        },
        apps: ["admin"],
        isActive: true,
    },

    pro_plus: {
        id: "pro_plus",
        name: "Pro Plus",
        description: "Advanced features for efficient operations",
        prices: { monthly: 799, yearly: 7999 },
        features: {
            ...BASE_FEATURES,
            staffManagement: true,
            attendance: true,
            payroll: true,
            expenses: true,
            reports: true,
            damagePhotos: true,
            staffApp: true,
        },
        limits: {
            maxOrders: -1,
            maxCustomers: -1,
            maxStaff: -1,
            maxDeliveryAgents: 5,
            maxPlantStaff: 3,
            maxRoster: -1,
            maxServices: -1,
            storageGB: 20,
        },
        apps: ["admin", "staff"],
        isActive: true,
    },

    business: {
        id: "business",
        name: "Business",
        description: "Complete solution for large operations",
        prices: { monthly: 1599, yearly: 15999 },
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

// Helper functions
export function getPlan(planId: PlanType): Plan {
    return PLANS[planId] || PLANS.free;
}

// TODO: formatPlanPrice uses ₹ as static default; components that display plan prices
// should use useCurrency().formatAmount() for shop-specific currency.
export function formatPlanPrice(plan: Plan, cycle: "monthly" | "yearly"): string {
    const price = plan.prices[cycle];
    if (price === 0) return "Free";
    return `₹${price.toLocaleString()}/${cycle === "monthly" ? "mo" : "yr"}`;
}

export function hasFeature(planId: PlanType, feature: keyof PlanFeatures): boolean {
    const plan = getPlan(planId);
    return plan.features[feature] ?? false;
}

export function isWithinLimit(
    planId: PlanType,
    limitType: "maxOrders" | "maxCustomers" | "maxStaff" | "maxServices",
    currentCount: number
): boolean {
    const plan = getPlan(planId);
    const limit = plan.limits[limitType];
    if (limit === -1) return true; // Unlimited
    return currentCount < limit;
}

// Plan comparison for pricing page
export const PLAN_COMPARISON = [
    { feature: "Monthly Orders", free: "50", pro: "Unlimited", pro_plus: "Unlimited", business: "Unlimited" },
    { feature: "Customers", free: "100", pro: "Unlimited", pro_plus: "Unlimited", business: "Unlimited" },
    { feature: "Staff Members", free: "1", pro: "5", pro_plus: "Unlimited", business: "Unlimited" },
    { feature: "Staff Management", free: false, pro: true, pro_plus: true, business: true },
    { feature: "Reports & Analytics", free: false, pro: true, pro_plus: true, business: true },
    { feature: "📸 Damage Photo Upload", free: false, pro: false, pro_plus: true, business: true },
    { feature: "👷 Staff App", free: false, pro: false, pro_plus: true, business: true },
    { feature: "SMS Notifications", free: false, pro: false, pro_plus: true, business: true },
    { feature: "Custom Branding", free: false, pro: false, pro_plus: true, business: true },
    { feature: "🚚 Delivery Agent App", free: false, pro: false, pro_plus: false, business: true },
    { feature: "🏭 Processing Dashboard", free: false, pro: false, pro_plus: false, business: true },
    { feature: "🏷️ QR Code per Garment", free: false, pro: false, pro_plus: false, business: true },
    { feature: "Multi-Branch Support", free: false, pro: false, pro_plus: false, business: true },
    { feature: "API Access", free: false, pro: false, pro_plus: false, business: true },
];
