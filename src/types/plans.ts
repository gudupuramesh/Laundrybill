/**
 * Plan Types
 *
 * Single product model: Free + one paid tier ("pro").
 * Legacy Firestore values pro_plus / business are normalized to "pro" at read time.
 */

/** Canonical plan ids only */
export type PlanType = "free" | "pro";

/** Normalize legacy tier ids from older data */
export function normalizePlanId(raw: string | null | undefined): PlanType {
    if (!raw) return "free";
    const r = String(raw).toLowerCase();
    if (r === "pro" || r === "pro_plus" || r === "business") return "pro";
    return "free";
}

// Feature flags for each plan
export interface PlanFeatures {
    // Core Features (all plans)
    orders: boolean;
    customers: boolean;
    services: boolean;
    orderTracking: boolean;
    whatsappReceipts: boolean;
    multiLanguage: boolean;

    // Staff & Operations (paid)
    staffManagement: boolean;
    attendance: boolean;
    payroll: boolean;
    expenses: boolean;
    reports: boolean;

    // Advanced (included in single paid tier)
    damagePhotos: boolean;
    staffApp: boolean;
    driverApp: boolean;
    plantApp: boolean;
    qrScans: boolean;
    /** Public ordering page */
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
