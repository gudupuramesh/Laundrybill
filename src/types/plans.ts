/**
 * Plan Types
 * 
 * Subscription plan definitions and feature flags
 */

// Plan identifiers
export type PlanType = "free" | "pro" | "pro_plus" | "business";

// Feature flags for each plan
export interface PlanFeatures {
    // Core Features (all plans)
    orders: boolean;
    customers: boolean;
    services: boolean;
    posBasic: boolean;
    orderTracking: boolean;
    whatsappReceipts: boolean;
    multiLanguage: boolean;

    // Staff & Operations (Pro+)
    staffManagement: boolean;
    attendance: boolean;
    payroll: boolean;
    expenses: boolean;
    reports: boolean;

    // Advanced Features (Pro Plus / Business)
    damagePhotos: boolean;
    staffApp: boolean;
    driverApp: boolean;
    plantApp: boolean;
    qrScans: boolean;
    /** Public ordering page (Business plan only) */
    publicOrderingPage: boolean;
}

// Usage limits for each plan
export interface PlanLimits {
    maxOrders: number; // per month, -1 = unlimited
    maxCustomers: number; // total, -1 = unlimited
    maxStaff: number; // Staff App users (total)
    maxDeliveryAgents: number; // Agent App users (total)
    maxPlantStaff: number; // Plant App users (total)
    maxRoster: number; // Roster for attendance/payroll (no app access), -1 = unlimited
    maxServices: number; // total, -1 = unlimited
    storageGB: number; // image storage
}

// App access by plan
export type AppType = "admin" | "staff" | "driver" | "plant";

// Complete plan definition
export interface Plan {
    id: PlanType;
    name: string;
    description: string;
    badge?: string;
    prices: {
        monthly: number;
        yearly: number;
    };
    features: PlanFeatures;
    limits: PlanLimits;
    apps: AppType[];
    isActive: boolean;
}
