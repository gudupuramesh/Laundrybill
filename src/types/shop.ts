/**
 * Shop Types
 * 
 * Type definitions for shop/store data
 */

import type { Timestamp } from "firebase/firestore";

export interface ShopLocation {
    address: string;
    city?: string;
    state?: string;
    pincode?: string;
    latitude?: number;
    longitude?: number;
}

export interface ShopBankDetails {
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
    accountHolderName?: string;
    upiId?: string;
}

/**
 * Delivery/Pickup Settings for service areas and time slots
 */
export interface DeliverySettings {
    // Service Areas
    enableServiceAreas: boolean;        // Toggle to enable area selection
    serviceAreas: { id: string; value: string; isActive: boolean }[];             // List of service areas with status

    // Pickup Time Slots
    enablePickupSlots: boolean;         // Toggle to enable pickup slots
    pickupTimeSlots: { id: string; value: string; isActive: boolean; capacity?: number }[];          // capacity = max orders per slot per day; 0 or omit = unlimited

    // Delivery Time Slots
    enableDeliverySlots: boolean;       // Toggle to enable delivery slots
    deliveryTimeSlots: { id: string; value: string; isActive: boolean; capacity?: number }[];        // capacity = max orders per slot per day; 0 or omit = unlimited

    // Charges
    defaultCharge?: number;             // Legacy: flat delivery charge (used when deliveryFeeEnabled is false but charge was set)

    /** When true, delivery fee applies to home delivery & pickup_home when order subtotal is below min order */
    deliveryFeeEnabled?: boolean;
    /** Minimum order amount (e.g. 300) – orders at or above this get free delivery */
    deliveryFeeMinOrder?: number;
    /** Delivery fee amount when order is below min (e.g. 50) */
    deliveryFeeAmount?: number;

    // Buffer: minimum minutes before slot start to allow booking (e.g. 30 = cannot book 9–10 after 8:30)
    bufferMinutes?: number;             // 0 or omit = no buffer
}

export interface ShopTaxSettings {
    enabled: boolean;
    name: string; // e.g. "GST", "VAT"
    rate: number; // Percentage e.g. 18
}

/** Single testimonial/review for public page */
export interface PublicTestimonial {
    id: string;
    quote: string;
    author: string;
    location?: string;
    /** e.g. "50+ orders" – builds trust */
    ordersCount?: number;
}

/** Social links for public page header */
export interface PublicSocialLinks {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    youtube?: string;
    linkedin?: string;
    /** WhatsApp link (e.g. wa.me/919876543210) */
    whatsapp?: string;
}

/** Coupon for public ordering – shop owner creates; customer enters code at checkout */
export interface PublicCoupon {
    code: string;           // e.g. "SAVE10"
    type: "percent" | "flat";
    value: number;          // percent (1–100) or flat amount in currency
    minOrder?: number;      // optional minimum order amount to apply
}

export interface ShopSettings {
    currency: string;
    timezone: string;
    orderPrefix: string;
    nextOrderNumber: number;
    adsEnabled: boolean;
    showSelfPromo: boolean;
    whatsappNotifications: boolean;
    smsNotifications: boolean;

    // Multi-country settings (added during registration)
    countryCode?: string;        // ISO 3166-1 alpha-2, e.g. "IN", "US"
    currencySymbol?: string;     // e.g. "₹", "$"
    phoneCountryCode?: string;   // e.g. "+91", "+1"
    locale?: string;             // BCP 47, e.g. "en-IN", "en-US"

    // Delivery/Pickup Settings
    delivery?: DeliverySettings;

    // Tax Settings
    tax?: ShopTaxSettings;

    // Public ordering coupons (customer enters code; no manual discount entry)
    publicCoupons?: PublicCoupon[];
}

export interface Shop {
    id: string;
    name: string;
    ownerId: string;

    // Plan Override (Synced from subscriptions)
    plan?: string;
    subscriptionStatus?: string;
    subscription?: {
        planId: string;
        status: string;
        endDate?: any;
        billingCycle?: string;
    };

    // Universal Shop Code (4 alphanumeric chars, globally unique)
    // Used for order IDs: {shopCode}-{orderNumber} e.g., "FL7K-00142"
    shopCode?: string;

    // Contact
    phone?: string;
    email?: string;
    whatsappNumber?: string;

    // Branding
    logo?: string;
    logoKey?: string; // R2 storage key

    // Location
    location?: ShopLocation;

    // Business Details
    gstNumber?: string;
    panNumber?: string;

    // Bank Details
    bankDetails?: ShopBankDetails;

    // Settings
    settings: ShopSettings;

    /** Public ordering page (Business plan only) */
    publicOrdering?: {
        enabled: boolean;
        slug: string;
        template?: "minimal" | "warm" | "bold" | "pastel" | "corporate";
        /** Testimonials / reviews shown on public page (before area selector) */
        testimonials?: PublicTestimonial[];
        /** Social media links shown in header */
        socialLinks?: PublicSocialLinks;
        /** Optional offer/coupon banner: image URL shown at top of public page */
        offerCouponImageUrl?: string;
        /** Coupon code to display and copy (e.g. SAVE10); used at checkout */
        featuredCouponCode?: string;
    };

    /** Business hours for "shop open" check on public page. Times in HH:mm (24h) in shop timezone. null = clear / always open. */
    businessHours?: {
        openTime: string;  // e.g. "08:00"
        closeTime: string; // e.g. "21:00"
    } | null;

    // Timestamps
    createdAt: Timestamp;
    updatedAt: Timestamp;

    /** Set when the shop owner has dismissed the first-time welcome modal on dashboard */
    welcomeModalSeenAt?: Timestamp;
}

// Default shop settings
export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
    currency: "INR",
    timezone: "Asia/Kolkata",
    orderPrefix: "A",
    nextOrderNumber: 1,
    adsEnabled: true,
    showSelfPromo: true,
    whatsappNotifications: true,
    smsNotifications: false,
};
