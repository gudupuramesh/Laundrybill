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
    | "pickup_completed"
    // Some items handed over to the customer, the rest still in the shop
    | "partially_delivered";

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
    partially_delivered: "Partially Delivered",
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
    partially_delivered: "warning",
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
    /** For weight-priced lines (kg/lb): how many garments were inside the weighed
     *  bag — purely informational, so shop and customer agree on the count. */
    pieceCount?: number;
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
    /**
     * Per-item lifecycle. Absent on legacy orders (treat as "pending").
     * "processed" = washed/ironed and ready to hand over; "delivered" = taken by the customer.
     * Derived from the piece counters below; kept for backward compatibility.
     */
    itemStatus?: "pending" | "processed" | "delivered";
    /** Pieces of this line that finished processing (0..quantity). Absent = legacy. */
    processedQty?: number;
    /** Pieces of this line handed to the customer (0..processedQty). Absent = legacy. */
    deliveredQty?: number;
}

/** Item-status helpers shared by detail views + status derivation. */
export type ItemStatus = NonNullable<OrderItem["itemStatus"]>;
export function getItemStatus(item: OrderItem): ItemStatus {
    return item.itemStatus || "pending";
}

/**
 * A line tracks whole pieces only when the quantity is a positive integer > 1.
 * Weight/area units (kg, sqft…) and single-piece lines are all-or-nothing — no "2.5 of 3".
 */
export function isCountableLine(item: Pick<OrderItem, "quantity" | "pricingType" | "unit">): boolean {
    const q = item.quantity;
    if (!Number.isInteger(q) || q <= 1) return false;
    const u = (item.pricingType || item.unit || "").toLowerCase();
    return !["kg", "lb", "sqft", "sqm", "load", "bag"].includes(u);
}

/**
 * Normalised progress for a line, with legacy fallback: an item without counters
 * derives them from its itemStatus (delivered → all, processed → all, else 0).
 * Non-countable lines report qty=1 so the UI shows whole-line semantics.
 */
export function getItemProgress(item: OrderItem): { qty: number; processed: number; delivered: number } {
    const countable = isCountableLine(item);
    const qty = countable ? item.quantity : 1;
    if (item.processedQty === undefined && item.deliveredQty === undefined) {
        const st = getItemStatus(item);
        const all = st === "delivered" ? qty : 0;
        const proc = st === "delivered" || st === "processed" ? qty : 0;
        return { qty, processed: proc, delivered: all };
    }
    const delivered = Math.max(0, Math.min(qty, item.deliveredQty ?? 0));
    // Delivered pieces are always at least processed.
    const processed = Math.max(delivered, Math.min(qty, item.processedQty ?? 0));
    return { qty, processed, delivered };
}

/** Line-level display status derived from the piece counters. */
export function itemStatusFromProgress(p: { qty: number; processed: number; delivered: number }): ItemStatus {
    if (p.delivered >= p.qty && p.qty > 0) return "delivered";
    if (p.processed >= p.qty && p.qty > 0) return "processed";
    return "pending"; // partials still map to "pending" for legacy readers; UIs show the count
}

/**
 * Derive the order-level status from its items after a progress change.
 * Returns null when the items alone shouldn't move the order (e.g. nothing delivered
 * yet and not everything processed) — caller keeps the current status.
 */
export function deriveStatusFromItems(items: OrderItem[], deliveryType: DeliveryType): OrderStatus | null {
    if (!items.length) return null;
    const prog = items.map(getItemProgress);
    const allDelivered = prog.every((p) => p.delivered >= p.qty);
    if (allDelivered) return deliveryType === "pickup_store" ? "picked_up" : "delivered";
    const anyDelivered = prog.some((p) => p.delivered > 0);
    if (anyDelivered) return "partially_delivered";
    const allProcessed = prog.every((p) => p.processed >= p.qty);
    if (allProcessed) return deliveryType === "pickup_store" ? "ready_for_pickup" : "ready";
    return null;
}

// ============================================
// ORDER FINANCIALS
// ============================================

export interface OrderFinancials {
    subtotal: number;
    discountType?: "percent" | "flat";
    discountValue?: number;
    discountAmount: number;
    /** Coupon code that produced the discount (offers feature). */
    couponCode?: string | null;
    /** Loyalty points redeemed on this order (1 point = 1 currency unit; reduces total). */
    pointsRedeemed?: number;
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

/** Who added a photo to the order, their role, and when — shown under every
 *  photo on order detail screens and the customer's tracking page. */
export interface OrderPhotoMeta {
    url: string;
    byName: string;
    byRole: "owner" | "manager" | "staff" | "agent" | "plant" | string;
    at: Timestamp;
}

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
    /** Caption metadata for order photos: who added each photo, their role, and when.
     *  Covers damage photos AND pickup/delivery/plant proof photos (matched by url). */
    photoMeta?: OrderPhotoMeta[];

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

    /** Loyalty audit: points credited when this order became fully paid (idempotency guard). */
    loyalty?: { earnedPoints: number; earnedAt: Timestamp };

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
