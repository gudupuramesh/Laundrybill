/**
 * Order Types
 * 
 * Enhanced with delivery types, status flows, and service-aware items
 */

import { Timestamp } from "firebase/firestore";

// ============================================
// DELIVERY TYPES
// ============================================

export type DeliveryType = "pickup_store" | "delivery_home" | "pickup_home";

export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
    pickup_store: "Shop Pickup",
    delivery_home: "Home Delivery",
    pickup_home: "Pickup & Delivery",
};

export const DELIVERY_TYPE_ICONS: Record<DeliveryType, string> = {
    pickup_store: "🏪",
    delivery_home: "🚚",
    pickup_home: "🏠",
};

// ============================================
// ORDER STATUS
// ============================================

export type OrderStatus =
    // Common
    | "pending"
    | "processing"
    | "ready"
    | "cancelled"
    // Shop Pickup specific
    | "ready_for_pickup"
    | "picked_up"
    // Home Delivery specific
    | "out_for_delivery"
    | "delivered"
    // Pickup from Home specific
    | "pickup_scheduled"
    | "pickup_completed";

// Status flow per delivery type
export const STATUS_FLOW: Record<DeliveryType, OrderStatus[]> = {
    pickup_store: ["pending", "processing", "ready_for_pickup", "picked_up"],
    delivery_home: ["pending", "processing", "ready", "out_for_delivery", "delivered"],
    pickup_home: ["pending", "pickup_scheduled", "pickup_completed", "processing", "ready", "out_for_delivery", "delivered"],
};

// Status display labels
export const STATUS_LABELS: Record<OrderStatus, string> = {
    pending: "Order Placed",
    processing: "Processing",
    ready: "Ready",
    ready_for_pickup: "Ready for Pickup",
    picked_up: "Picked Up",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    pickup_scheduled: "Pickup Scheduled",
    pickup_completed: "Picked Up from Customer",
    cancelled: "Cancelled",
};

// Status colors for badges
export const STATUS_COLORS: Record<OrderStatus, "warning" | "primary" | "success" | "destructive"> = {
    pending: "warning",
    processing: "primary",
    ready: "success",
    ready_for_pickup: "success",
    picked_up: "success",
    out_for_delivery: "primary",
    delivered: "success",
    pickup_scheduled: "warning",
    pickup_completed: "primary",
    cancelled: "destructive",
};

// ============================================
// PAYMENT
// ============================================

export type PaymentMethod = "cash" | "upi" | "card" | "pay_later";
export type PaymentStatus = "unpaid" | "partial" | "paid";

// ============================================
// ORDER ITEM
// ============================================

export interface OrderItem {
    id: string;
    serviceId: string;
    serviceName: string;
    categoryId?: string;
    categoryName?: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
    pricingType?: "piece" | "kg" | "sqft";
    turnaroundDays?: number;
    expectedDate?: Timestamp;
    express: boolean;
    expressMultiplier?: number;
    expressCharge?: number;
    notes?: string;
    damages?: { description: string; photoUrl: string }[];
}

// ============================================
// ORDER FINANCIALS
// ============================================

export interface OrderFinancials {
    subtotal: number;
    discountType?: "percent" | "flat";
    discountValue?: number;
    discountAmount: number;
    taxAmount?: number;
    taxRate?: number;
    taxName?: string;
    expressCharge: number;
    deliveryCharge: number;
    total: number;
    amountPaid: number;
    balance: number;
    /** Total amount refunded (e.g. auto-refund on cancel). Net collected = amountPaid is kept 0 after a full refund; this field is the audit total. */
    refundedAmount?: number;
}

// ============================================
// ORDER TIMELINE
// ============================================

export interface OrderTimelineEvent {
    id: string;
    status: OrderStatus;
    timestamp: Timestamp;
    staffId?: string;
    staffName?: string;
    notes?: string | null;
    notifiedCustomer: boolean;
}

// ============================================
// ORDER PAYMENT
// ============================================

export interface OrderPayment {
    id: string;
    amount: number;
    method: PaymentMethod;
    reference?: string | null;
    collectedBy?: string;
    collectedAt: Timestamp;
}

// ============================================
// ORDER REFUND (audit trail — e.g. auto-refund on cancel)
// ============================================

export interface OrderRefund {
    id: string;
    amount: number;
    reason?: string | null;
    refundedBy?: string;
    refundedAt: Timestamp;
}

// ============================================
// ITEM-WISE DELIVERY DATE
// ============================================

export interface ItemWiseDeliveryDate {
    serviceId: string;
    serviceName: string;
    categoryName?: string;
    expectedDate: Timestamp;
}

// ============================================
// ORDER
// ============================================

export interface Order {
    id: string;
    orderNumber: string;
    publicId: string;
    trackingId?: string;

    // Customer
    customerId?: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    customerAddress?: string;
    isGuest: boolean;

    // Items
    items: OrderItem[];
    financials: OrderFinancials;

    // Status
    status: OrderStatus;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    paymentReference?: string;

    // Delivery Type
    deliveryType: DeliveryType;
    deliveryAddress?: string;
    deliveryArea?: string;
    /** Lat/lng for pickup/delivery (enables "Get directions" for shop and agent). */
    deliveryLat?: number;
    deliveryLng?: number;
    deliveryNotes?: string;

    // Expected Dates
    expectedDelivery: Timestamp;
    itemWiseDeliveryDates?: ItemWiseDeliveryDate[];
    isManualDate?: boolean;
    manualDeliveryDate?: Timestamp;

    // Pickup from Home specific
    scheduledPickupDate?: Timestamp;
    scheduledPickupTime?: string; // Slot like "9:00 AM - 11:00 AM"
    pickupAddress?: string;

    // Delivery
    deliveredAt?: Timestamp;
    deliverySlot?: string; // Slot like "9:00 AM - 11:00 AM"

    // Staff
    staffId: string;
    staffName: string;
    shopId: string;

    /** Order source: 'online' = public page, 'pos' = in-shop, 'phone' = phone order */
    orderSource?: "online" | "pos" | "phone";
    /** True when placed as quick order from public page (no items at placement) */
    isQuickOrder?: boolean;
    /** Customer's pickup estimate from the public Book Pickup page (e.g. "< 5 kg", "1–5 pcs"). */
    estimatedWeight?: string;
    estimatedPieces?: string;

    // Agent Assignment (for pickup/delivery orders)
    assignedAgentId?: string;
    assignedAgentName?: string;
    assignedAt?: Timestamp;

    /** Order-level damage/stain photo URLs (R2) from checkout */
    damagePhotoUrls?: string[];

    /** Pickup proof photo URL (driver app) */
    pickupPhoto?: string;
    /** Delivery proof photo URL (driver app) */
    deliveryPhoto?: string;
    /** Plant proof photo URL (plant app – processing/wash proof) */
    plantPhoto?: string;

    // History
    timeline?: OrderTimelineEvent[];
    payments?: OrderPayment[];
    /** Refund audit trail (amount + who + when), e.g. auto-refund on cancel. */
    refunds?: OrderRefund[];

    // Timestamps
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// ============================================
// LEGACY SUPPORT
// ============================================

/**
 * Map legacy delivery types to new ones
 * Use this for backward compatibility with existing orders
 */
export function mapLegacyDeliveryType(legacy: string): DeliveryType {
    switch (legacy) {
        case "pickup":
            return "pickup_store";
        case "delivery":
            return "delivery_home";
        default:
            return legacy as DeliveryType;
    }
}

/**
 * Get valid next statuses based on current status and delivery type
 */
export function getNextStatuses(currentStatus: OrderStatus, deliveryType: DeliveryType): OrderStatus[] {
    const flow = STATUS_FLOW[deliveryType];
    const currentIndex = flow.indexOf(currentStatus);

    if (currentIndex === -1 || currentIndex >= flow.length - 1) {
        return [];
    }

    const nextStatuses: OrderStatus[] = [flow[currentIndex + 1]];

    // Can cancel from certain statuses
    if (["pending", "processing", "pickup_scheduled"].includes(currentStatus)) {
        nextStatuses.push("cancelled");
    }

    return nextStatuses;
}
