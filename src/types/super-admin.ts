/**
 * Super Admin Types
 * 
 * Types for platform administration, subscriptions, and payments
 */

import { Timestamp } from "firebase/firestore";
import type { PlanType } from "./plans";

// ============== SUPER ADMIN ==============

export type SuperAdminRole = "owner" | "admin" | "support";

export interface SuperAdmin {
    id: string;
    email: string;
    name: string;
    phone?: string;
    role: SuperAdminRole;

    permissions: {
        manageShops: boolean;
        manageSubscriptions: boolean;
        managePayments: boolean;
        manageAds: boolean;
        viewAnalytics: boolean;
        manageAdmins: boolean;
    };

    isActive: boolean;
    lastLoginAt?: Timestamp;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// ============== SUBSCRIPTION ==============

export type BillingCycle = "monthly" | "yearly";
export type SubscriptionStatus = "active" | "expired" | "cancelled" | "grace_period" | "trial" | "free";

export interface Subscription {
    id: string; // Same as shopId
    shopId: string;
    shopName: string;
    ownerEmail: string;
    ownerPhone: string;

    // Plan Details
    planId: PlanType;
    billingCycle: BillingCycle;
    status: SubscriptionStatus;

    // Dates
    startDate: Timestamp;
    endDate: Timestamp;
    trialEndDate?: Timestamp;
    cancelledAt?: Timestamp;

    // Billing
    amount: number;
    currency: string;
    lastPaymentDate?: Timestamp;
    nextPaymentDate?: Timestamp;

    // Usage (updated periodically)
    usage: {
        ordersThisMonth: number;
        totalCustomers: number;
        totalStaff: number;
        totalServices: number;
        storageUsedMB: number;
    };

    // Flags
    isTrialUsed: boolean;
    autoRenew: boolean;

    // Manual Override (Super Admin)
    manualOverride?: {
        reason: string;
        overriddenBy: string;
        overriddenAt: Timestamp;
        originalEndDate: Timestamp;
    };

    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// ============== PAYMENT ==============

export type PaymentStatus = "pending" | "success" | "failed" | "refunded";
export type PaymentMethod = "razorpay" | "manual" | "bank_transfer" | "free";

export interface Payment {
    id: string;
    shopId: string;
    shopName: string;
    subscriptionId: string;

    // Amount
    amount: number;
    currency: string;

    // Plan
    planId: PlanType;
    billingCycle: BillingCycle;

    // Payment Details
    status: PaymentStatus;
    method: PaymentMethod;

    // Gateway Details (if Razorpay)
    gatewayOrderId?: string;
    gatewayPaymentId?: string;
    gatewaySignature?: string;

    // Manual Payment (if bank transfer)
    manualDetails?: {
        reference: string;
        notes: string;
        verifiedBy: string;
        verifiedAt: Timestamp;
    };

    // Invoice
    invoiceNumber: string;
    invoiceUrl?: string;

    // Period
    periodStart: Timestamp;
    periodEnd: Timestamp;

    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// ============== ACTIVITY LOG ==============

export type ActivityType =
    | "shop_created"
    | "shop_updated"
    | "subscription_created"
    | "subscription_upgraded"
    | "subscription_downgraded"
    | "subscription_cancelled"
    | "subscription_expired"
    | "subscription_renewed"
    | "payment_received"
    | "payment_failed"
    | "plan_override"
    | "login"
    | "feature_used";

export interface ActivityLog {
    id: string;
    type: ActivityType;

    // Who
    shopId?: string;
    shopName?: string;
    userId?: string;
    userEmail?: string;
    superAdminId?: string;

    // What
    description: string;
    metadata?: Record<string, any>;

    // When
    createdAt: Timestamp;
}

// ============== PLATFORM STATS ==============

export interface PlatformStats {
    totalShops: number;
    newShopsThisMonth: number;
    activeSubscriptions: number;
    trialUsers: number;
    expiringSoon: number;
    paymentsFailed: number;
    monthlyRevenue: number;
    revenueGrowth: number;
    totalOrders: number;
    totalCustomers: number;
    ordersToday: number;
    revenueToday: number;
    totalStorageBytes: number;
    totalStorageImageCount: number;
    planDistribution: {
        free: number;
        pro: number;
        pro_plus: number;
        business: number;
    };
}
