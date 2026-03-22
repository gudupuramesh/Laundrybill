import type { PlanType } from "./plans";

export type ShopSubscriptionStatus = "active" | "expired" | "cancelled" | "grace_period" | "past_due" | "trial" | "free";

export interface ShopUsage {
    ordersThisMonth: number;
    totalCustomers: number;
    totalStaff: number;
    totalServices: number;
}

export interface ShopSubscription {
    id?: string;
    planId: PlanType;
    planName: string;
    status: ShopSubscriptionStatus;

    // Dates
    expiresAt: Date | null;
    endDate: any; // Firestore Timestamp
    trialEndDate?: any;
    /** Parsed trial end date (for trial users) */
    trialEndDateAt?: Date | null;
    graceEndDate?: any;
    activeUntil?: any;

    // Usage stats
    usage: ShopUsage;
    daysRemaining: number | null;

    // Billing info if available
    billingCycle?: "monthly" | "yearly" | "3_months" | "6_months" | "9_months" | "12_months";
    pendingDowngrade?: {
        toPlan: PlanType;
        effectiveDate: any;
        requestedAt?: any;
    };
    manualOverride?: {
        reason: string;
        overriddenBy: string;
        overriddenAt: any;
    };
}
