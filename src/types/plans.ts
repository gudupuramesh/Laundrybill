/**
 * Plan Types
 *
 * Three-tier model:
 *   Free    — Getting started, limited orders/customers
 *   Pro     — Small shops: staff, attendance, expenses, reports, QR, WhatsApp
 *   Business — Big shops / entrepreneurs: plant login, driver/agent app,
 *              multi-staff, public ordering page, web dashboard, unlimited everything
 *
 * Legacy Firestore values (pro_plus, premium) are normalized at read time.
 */

/** Canonical plan ids */
export type PlanType = "free" | "pro" | "pro_plus" | "business";

/** Normalize legacy / variant tier ids from older data */
export function normalizePlanId(raw: string | null | undefined): PlanType {
    if (!raw) return "free";
    const r = String(raw).toLowerCase().replace(/[_\s-]/g, "");
    // Pro+ tier — must be tested BEFORE business and bare-pro
    if (r === "proplus" || r === "pro+") return "pro_plus";
    // Business tier aliases
    if (r === "business" || r === "enterprise" || r === "premium") return "business";
    // Pro tier
    if (r === "pro" || r === "starter") return "pro";
    return "free";
}

// Feature flags for each plan
export interface PlanFeatures {
    // Core Features (all plans including free)
    orders: boolean;
    customers: boolean;
    services: boolean;
    orderTracking: boolean;
    whatsappReceipts: boolean;
    multiLanguage: boolean;

    // Staff & Operations (Pro+)
    staffManagement: boolean;
    attendance: boolean;
    payroll: boolean;
    expenses: boolean;
    reports: boolean;

    // Advanced (Business only)
    damagePhotos: boolean;
    staffApp: boolean;
    driverApp: boolean;
    plantApp: boolean;
    qrScans: boolean;
    /** Public ordering page */
    publicOrderingPage: boolean;
    /** Web dashboard access for staff */
    webDashboard: boolean;
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
