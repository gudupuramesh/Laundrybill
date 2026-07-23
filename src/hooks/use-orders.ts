/**
 * Orders Hook
 * 
 * Create and manage orders in Firestore
 * Real-time listeners for order list and single order
 */

import { useState, useEffect, useCallback } from "react";
import {
    collection,
    query,
    orderBy,
    limit,
    where,
    doc,
    getDoc,
    addDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    runTransaction,
    increment,
    deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import type { Order, OrderItem, OrderStatus, PaymentMethod, DeliveryType, OrderFinancials, OrderTimelineEvent, ItemStatus } from "@/types/order";
import { deriveStatusFromItems, mapLegacyDeliveryType, getItemProgress, itemStatusFromProgress } from "@/types/order";
import { formatOrderId } from "@/lib/generateShopCode";

const PAGE_SIZE = 50;

interface CreateOrderInput {
    customerId?: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string | null;
    isGuest: boolean;
    items: OrderItem[];
    financials: Omit<OrderFinancials, "balance"> & { balance?: number };
    deliveryType: DeliveryType;
    deliveryAddress?: string;
    deliveryArea?: string;
    deliveryNotes?: string;
    expectedDelivery: Date;
    scheduledPickupDate?: Date;
    deliverySlot?: string;
    pickupSlot?: string;
    paymentMethod: PaymentMethod;
    paymentReference?: string;
    staffId?: string;
    staffName?: string;
    assignedAgentId?: string;
    assignedAgentName?: string;
    /** Order-level damage/stain photo URLs (R2) */
    damagePhotoUrls?: string[];
    /** Who added the photos (caption shown on detail screens + customer tracking). */
    photoMeta?: { url: string; byName: string; byRole: string; at: Timestamp }[];
}

interface UseOrdersOptions {
    status?: OrderStatus;
    customerId?: string;
    startDate?: Date;
    endDate?: Date;
}

// Main orders list hook with real-time updates
export function useOrders(options: UseOrdersOptions = {}) {
    const { shopId } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);

    useEffect(() => {
        if (!shopId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const ordersRef = collection(db, `shops/${shopId}/orders`);

        // Build query with filters
        const constraints: ReturnType<typeof where>[] = [];

        if (options.status) {
            constraints.push(where("status", "==", options.status));
        }
        if (options.customerId) {
            constraints.push(where("customerId", "==", options.customerId));
        }
        if (options.startDate) {
            constraints.push(where("createdAt", ">=", Timestamp.fromDate(options.startDate)));
        }
        if (options.endDate) {
            constraints.push(where("createdAt", "<=", Timestamp.fromDate(options.endDate)));
        }

        const q = query(
            ordersRef,
            ...constraints,
            orderBy("createdAt", "desc"),
            limit(PAGE_SIZE)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const docs = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Order[];

                setOrders(docs);
                setHasMore(docs.length === PAGE_SIZE);
                setLoading(false);
            },
            (error) => {
                console.error("Error loading orders:", error);
                setLoading(false);
            }
        );

        return unsubscribe;
    }, [shopId, options.status, options.customerId, options.startDate, options.endDate]);

    const loadMore = useCallback(async () => {
        // TODO: Implement pagination with startAfter
        setHasMore(false);
    }, []);

    return { orders, loading, hasMore, loadMore };
}

// Single order hook with real-time updates. Pass shopIdOverride when outside main auth (e.g. driver app).
export function useOrder(orderId: string, options?: { shopIdOverride?: string | null }) {
    const { shopId: authShopId } = useAuth();
    const shopId = options?.shopIdOverride !== undefined ? options.shopIdOverride : authShopId;
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!shopId || !orderId) {
            setLoading(false);
            return;
        }

        const orderRef = doc(db, `shops/${shopId}/orders/${orderId}`);

        const unsubscribe = onSnapshot(
            orderRef,
            (doc) => {
                if (doc.exists()) {
                    setOrder({ id: doc.id, ...doc.data() } as Order);
                } else {
                    setOrder(null);
                }
                setLoading(false);
            },
            (error) => {
                console.error("Error loading order:", error);
                setLoading(false);
            }
        );

        return unsubscribe;
    }, [shopId, orderId]);

    return { order, loading };
}

/**
 * Credit loyalty points for a fully-paid order — exactly once. Reads the shop's
 * loyalty config (settings.loyalty); no-op when disabled. Idempotent via the
 * order.loyalty stamp, written in the same transaction as the customer credit.
 */
async function creditLoyaltyIfDue(
    shopId: string,
    orderId: string,
    info: { customerId: string; total: number },
): Promise<void> {
    try {
        const shopSnap = await getDoc(doc(db, "shops", shopId));
        const loyalty = shopSnap.data()?.settings?.loyalty as
            | { enabled?: boolean; mode?: string; earnPercent?: number; earnFixed?: number }
            | undefined;
        if (!loyalty?.enabled) return;
        const earn = loyalty.mode === "fixed"
            ? Math.max(0, Math.round(loyalty.earnFixed || 0))
            : Math.max(0, Math.round(((info.total || 0) * (loyalty.earnPercent || 0)) / 100));
        if (earn <= 0) return;
        const orderRef = doc(db, `shops/${shopId}/orders/${orderId}`);
        const customerRef = doc(db, `shops/${shopId}/customers/${info.customerId}`);
        await runTransaction(db, async (tx) => {
            const o = await tx.get(orderRef);
            if (!o.exists() || o.data()?.loyalty?.earnedPoints) return; // already credited
            tx.update(orderRef, { loyalty: { earnedPoints: earn, earnedAt: Timestamp.now() } });
            tx.update(customerRef, {
                loyaltyPoints: increment(earn),
                loyaltyEarned: increment(earn),
                updatedAt: serverTimestamp(),
            });
        });
    } catch (e) {
        // Non-fatal: the payment itself succeeded; points can be granted on a later pass.
        console.error("Loyalty credit failed:", e);
    }
}

// Order mutations hook. Pass shopIdOverride when outside main auth (e.g. driver app).
export function useOrderMutations(options?: { shopIdOverride?: string | null }) {
    const { shopId: authShopId, user } = useAuth();
    const shopId = options?.shopIdOverride !== undefined ? options.shopIdOverride : authShopId;

    const updateStatus = useCallback(async (
        orderId: string,
        newStatus: OrderStatus,
        notes?: string,
        notifyCustomer: boolean = true
    ) => {
        if (!shopId) throw new Error("No shop ID");

        const orderRef = doc(db, `shops/${shopId}/orders/${orderId}`);
        const orderDoc = await getDoc(orderRef);

        if (!orderDoc.exists()) throw new Error("Order not found");

        const currentOrder = orderDoc.data() as Order;

        const timelineEvent: OrderTimelineEvent = {
            id: `t-${Date.now()}`,
            status: newStatus,
            timestamp: Timestamp.now(),
            staffId: user?.uid || "unknown",
            staffName: user?.displayName || "Unknown",
            notes: notes || null,
            notifiedCustomer: notifyCustomer,
        };

        const updateData: Record<string, unknown> = {
            status: newStatus,
            updatedAt: serverTimestamp(),
            timeline: [...(currentOrder.timeline || []), timelineEvent],
        };

        // Top-level status is the coarse control: cascade it down to the item piece
        // counters so the item list can never contradict the order status. The item
        // list stays the fine-grained path (it derives the order status upward).
        if (newStatus === "delivered" || newStatus === "picked_up") {
            updateData.deliveredAt = serverTimestamp();
            if (currentOrder.items?.length) {
                updateData.items = currentOrder.items.map((it) => {
                    const p = getItemProgress(it);
                    return { ...it, processedQty: p.qty, deliveredQty: p.qty, itemStatus: "delivered" as const };
                });
            }
        } else if (newStatus === "ready" || newStatus === "ready_for_pickup") {
            if (currentOrder.items?.length) {
                updateData.items = currentOrder.items.map((it) => {
                    const p = getItemProgress(it);
                    return { ...it, processedQty: p.qty, deliveredQty: p.delivered, itemStatus: p.delivered >= p.qty ? ("delivered" as const) : ("processed" as const) };
                });
            }
        }

        // Cancel → auto-refund: any cash already collected is refunded (audit-logged)
        // and the order is voided so it contributes nothing to sales/collected/dues.
        if (newStatus === "cancelled") {
            const fin = currentOrder.financials || ({} as Order["financials"]);
            const priorPaid = fin.amountPaid || 0;
            if (priorPaid > 0) {
                const refund = {
                    id: `r-${Date.now()}`,
                    amount: priorPaid,
                    reason: "order_cancelled",
                    refundedBy: user?.displayName || "Unknown",
                    refundedAt: Timestamp.now(),
                };
                updateData["financials.amountPaid"] = 0;
                updateData["financials.refundedAmount"] = (fin.refundedAmount || 0) + priorPaid;
                updateData.refunds = [...(currentOrder.refunds || []), refund];
            }
            // Voided: nothing is owed on a cancelled order.
            updateData["financials.balance"] = 0;
            // Reverse this order's contribution to the customer's lifetime stats.
            if (currentOrder.customerId && !currentOrder.isGuest) {
                try {
                    const customerRef = doc(db, `shops/${shopId}/customers/${currentOrder.customerId}`);
                    const reversal: Record<string, unknown> = {
                        totalOrders: increment(-1),
                        totalSpent: increment(-(fin.total || 0)),
                        updatedAt: serverTimestamp(),
                    };
                    // Loyalty: give redeemed points back, take earned points away.
                    const redeemedBack = fin.pointsRedeemed || 0;
                    const earnedRevoke = currentOrder.loyalty?.earnedPoints || 0;
                    if (redeemedBack - earnedRevoke !== 0) reversal.loyaltyPoints = increment(redeemedBack - earnedRevoke);
                    if (earnedRevoke > 0) reversal.loyaltyEarned = increment(-earnedRevoke);
                    await updateDoc(customerRef, reversal);
                } catch {
                    // Non-fatal: customer doc may be missing; order cancel still proceeds.
                }
            }
        }

        await updateDoc(orderRef, updateData);

        return { ...currentOrder, ...updateData, id: orderId };
    }, [shopId, user]);

    /**
     * PERMANENTLY delete an order from the database (owner-only in the UI; rules
     * also restrict deletes to the shop owner/admin). For test/mistake orders.
     * Non-cancelled orders first reverse their contribution to the customer's
     * lifetime stats + loyalty (a cancelled order already reversed on cancel).
     */
    const deleteOrder = useCallback(async (orderId: string) => {
        if (!shopId) throw new Error("No shop ID");

        const orderRef = doc(db, `shops/${shopId}/orders/${orderId}`);
        const orderDoc = await getDoc(orderRef);
        if (!orderDoc.exists()) throw new Error("Order not found");
        const order = orderDoc.data() as Order;

        if (order.status !== "cancelled" && order.customerId && !order.isGuest) {
            try {
                const fin = order.financials || ({} as Order["financials"]);
                const customerRef = doc(db, `shops/${shopId}/customers/${order.customerId}`);
                const reversal: Record<string, unknown> = {
                    totalOrders: increment(-1),
                    totalSpent: increment(-(fin.total || 0)),
                    updatedAt: serverTimestamp(),
                };
                const redeemedBack = fin.pointsRedeemed || 0;
                const earnedRevoke = order.loyalty?.earnedPoints || 0;
                if (redeemedBack - earnedRevoke !== 0) reversal.loyaltyPoints = increment(redeemedBack - earnedRevoke);
                if (earnedRevoke > 0) reversal.loyaltyEarned = increment(-earnedRevoke);
                await updateDoc(customerRef, reversal);
            } catch {
                // Non-fatal: customer doc may be missing; deletion still proceeds.
            }
        }

        await deleteDoc(orderRef);
    }, [shopId]);

    /**
     * Per-piece progress updates (partial delivery / per-item processing).
     * Each update sets absolute processed/delivered piece counts for a line
     * (clamped 0 ≤ delivered ≤ processed ≤ quantity — delivering implies processed),
     * writes a derived itemStatus for legacy readers, then derives the order status:
     * every piece delivered → delivered/picked_up · any delivered → partially_delivered ·
     * every piece processed → ready/ready_for_pickup · otherwise status is left alone.
     */
    const updateItemProgress = useCallback(async (
        orderId: string,
        updates: { index: number; processed?: number; delivered?: number }[],
    ) => {
        if (!shopId) throw new Error("No shop ID");
        if (!updates.length) return;

        const orderRef = doc(db, `shops/${shopId}/orders/${orderId}`);
        const orderDoc = await getDoc(orderRef);
        if (!orderDoc.exists()) throw new Error("Order not found");

        const currentOrder = orderDoc.data() as Order;
        if (currentOrder.status === "cancelled") throw new Error("Order is cancelled");

        const byIndex = new Map(updates.map((u) => [u.index, u]));
        // Track what actually changed, for the timeline note.
        const touched: { name: string; verb: string; n: number; qty: number }[] = [];

        const items = (currentOrder.items || []).map((it, i) => {
            const u = byIndex.get(i);
            if (!u) return it;
            const cur = getItemProgress(it);
            let processed = u.processed !== undefined ? u.processed : cur.processed;
            let delivered = u.delivered !== undefined ? u.delivered : cur.delivered;
            // Clamp: 0 ≤ delivered ≤ processed ≤ qty; delivered pieces are implicitly processed.
            delivered = Math.max(0, Math.min(cur.qty, Math.round(delivered)));
            processed = Math.max(delivered, Math.min(cur.qty, Math.round(processed)));
            const next = { ...it, processedQty: processed, deliveredQty: delivered };
            next.itemStatus = itemStatusFromProgress({ qty: cur.qty, processed, delivered });
            if (u.delivered !== undefined && delivered !== cur.delivered) touched.push({ name: it.serviceName, verb: "Delivered", n: delivered, qty: cur.qty });
            else if (u.processed !== undefined && processed !== cur.processed) touched.push({ name: it.serviceName, verb: "Processed", n: processed, qty: cur.qty });
            return next;
        });

        const deliveryType = mapLegacyDeliveryType(currentOrder.deliveryType);
        const derived = deriveStatusFromItems(items, deliveryType);
        const statusChanged = derived !== null && derived !== currentOrder.status;

        const summary = touched.length
            ? touched.slice(0, 4).map((t) => `${t.verb} ${t.n}${t.qty > 1 ? `/${t.qty}` : ""} × ${t.name}`).join(", ") + (touched.length > 4 ? "…" : "")
            : "Updated items";

        const timelineEvent: OrderTimelineEvent = {
            id: `t-${Date.now()}`,
            status: statusChanged ? (derived as OrderStatus) : currentOrder.status,
            timestamp: Timestamp.now(),
            staffId: user?.uid || "unknown",
            staffName: user?.displayName || "Unknown",
            notes: summary,
            notifiedCustomer: false,
        };

        const updateData: Record<string, unknown> = {
            items,
            updatedAt: serverTimestamp(),
            timeline: [...(currentOrder.timeline || []), timelineEvent],
        };
        if (statusChanged) {
            updateData.status = derived;
            if (derived === "delivered" || derived === "picked_up") {
                updateData.deliveredAt = serverTimestamp();
            }
        }

        await updateDoc(orderRef, updateData);
        return { ...currentOrder, ...updateData, id: orderId } as Order;
    }, [shopId, user]);

    /**
     * Compat wrapper: whole-line status change (all pieces). Kept so existing call
     * sites keep working; routes through updateItemProgress.
     */
    const updateItemStatuses = useCallback(async (
        orderId: string,
        itemIndexes: number[],
        newItemStatus: ItemStatus,
    ) => {
        if (!itemIndexes.length) return;
        const orderRef = doc(db, `shops/${shopId}/orders/${orderId}`);
        const orderDoc = await getDoc(orderRef);
        if (!orderDoc.exists()) throw new Error("Order not found");
        const items = (orderDoc.data() as Order).items || [];
        const updates = itemIndexes.map((index) => {
            const qty = getItemProgress(items[index]).qty;
            if (newItemStatus === "delivered") return { index, processed: qty, delivered: qty };
            if (newItemStatus === "processed") return { index, processed: qty, delivered: 0 };
            return { index, processed: 0, delivered: 0 };
        });
        return updateItemProgress(orderId, updates);
    }, [shopId, updateItemProgress]);

    const collectPayment = useCallback(async (
        orderId: string,
        amount: number,
        method: PaymentMethod,
        reference?: string
    ) => {
        if (!shopId) throw new Error("No shop ID");

        const orderRef = doc(db, `shops/${shopId}/orders/${orderId}`);
        const orderDoc = await getDoc(orderRef);

        if (!orderDoc.exists()) throw new Error("Order not found");

        const order = orderDoc.data() as Order;
        if (order.status === "cancelled") throw new Error("Cannot collect payment on a cancelled order");
        const newAmountPaid = order.financials.amountPaid + amount;
        const newBalance = order.financials.total - newAmountPaid;

        const payment = {
            id: `p-${Date.now()}`,
            amount,
            method,
            reference: reference || null,
            collectedBy: user?.displayName || "Unknown",
            collectedAt: Timestamp.now(),
        };

        await updateDoc(orderRef, {
            "financials.amountPaid": newAmountPaid,
            "financials.balance": newBalance,
            paymentStatus: newBalance <= 0 ? "paid" : newAmountPaid > 0 ? "partial" : "unpaid",
            payments: [...(order.payments || []), payment],
            updatedAt: serverTimestamp(),
        });

        // Loyalty: the order just became fully paid → credit points (once).
        if (newBalance <= 0 && order.customerId && !order.isGuest && !order.loyalty?.earnedPoints) {
            await creditLoyaltyIfDue(shopId, orderId, {
                customerId: order.customerId,
                total: order.financials.total || 0,
            });
        }

        return { ...order, id: orderId };
    }, [shopId, user]);

    // Update an existing order (for Edit Order functionality)
    const updateOrder = useCallback(async (
        orderId: string,
        input: {
            items: OrderItem[];
            financials: Omit<OrderFinancials, "balance"> & { balance?: number };
            deliveryType?: DeliveryType;
            deliveryAddress?: string;
            deliveryArea?: string;
            deliveryNotes?: string;
            expectedDelivery?: Date;
            deliverySlot?: string;
            pickupSlot?: string;
            scheduledPickupDate?: Date;
        }
    ) => {
        if (!shopId) throw new Error("No shop ID");

        const orderRef = doc(db, `shops/${shopId}/orders/${orderId}`);
        const orderDoc = await getDoc(orderRef);

        if (!orderDoc.exists()) throw new Error("Order not found");

        const currentOrder = orderDoc.data() as Order;

        // Don't allow editing delivered or cancelled orders
        if (currentOrder.status === "delivered" || currentOrder.status === "cancelled") {
            throw new Error("Cannot edit completed or cancelled orders");
        }

        const updateData: Record<string, unknown> = {
            items: input.items.map((item) => ({
                id: item.id || `i-${Date.now()}`,
                serviceId: item.serviceId || "",
                serviceName: item.serviceName || "",
                categoryName: item.categoryName,
                categoryId: item.categoryId,
                quantity: item.quantity || 1,
                unit: item.unit || "piece",
                unitPrice: item.unitPrice || 0,
                total: item.total || 0,
                express: item.express ?? false,
                notes: item.notes || null,
                damages: item.damages || null,
            })),
            financials: {
                subtotal: input.financials.subtotal || 0,
                discountType: input.financials.discountType || null,
                discountValue: input.financials.discountValue || 0,
                discountAmount: input.financials.discountAmount || 0,
                expressCharge: input.financials.expressCharge || 0,
                deliveryCharge: input.financials.deliveryCharge || 0,
                taxAmount: input.financials.taxAmount || 0,
                taxRate: input.financials.taxRate || 0,
                taxName: input.financials.taxName || "Tax",
                total: input.financials.total || 0,
                amountPaid: input.financials.amountPaid ?? currentOrder.financials.amountPaid,
                balance: (input.financials.total || 0) - (input.financials.amountPaid ?? currentOrder.financials.amountPaid),
            },
            // Keep paymentStatus in sync with the recomputed balance (it was left stale before).
            paymentStatus: ((input.financials.total || 0) - (input.financials.amountPaid ?? currentOrder.financials.amountPaid)) <= 0
                ? "paid"
                : (input.financials.amountPaid ?? currentOrder.financials.amountPaid) > 0
                    ? "partial"
                    : "unpaid",
            updatedAt: serverTimestamp(),
        };

        // Update delivery info if provided
        if (input.deliveryType) {
            updateData.deliveryType = input.deliveryType;
        }
        if (input.deliveryAddress !== undefined) {
            updateData.deliveryAddress = input.deliveryAddress || null;
        }
        if (input.deliveryArea !== undefined) {
            updateData.deliveryArea = input.deliveryArea || null;
        }
        if (input.deliveryNotes !== undefined) {
            updateData.deliveryNotes = input.deliveryNotes || null;
        }
        if (input.expectedDelivery) {
            updateData.expectedDelivery = Timestamp.fromDate(input.expectedDelivery);
        }
        if (input.deliverySlot !== undefined) {
            updateData.deliverySlot = input.deliverySlot || null;
        }
        if (input.pickupSlot !== undefined) {
            updateData.scheduledPickupTime = input.pickupSlot || null;
        }
        if (input.scheduledPickupDate) {
            updateData.scheduledPickupDate = Timestamp.fromDate(input.scheduledPickupDate);
        }

        await updateDoc(orderRef, updateData);

        return { ...currentOrder, ...updateData, id: orderId };
    }, [shopId]);

    // Reassign an agent to an order
    const reassignAgent = useCallback(async (
        orderId: string,
        agentId: string | null,
        agentName: string | null
    ) => {
        if (!shopId) throw new Error("No shop ID");

        const orderRef = doc(db, `shops/${shopId}/orders/${orderId}`);
        const orderDoc = await getDoc(orderRef);

        if (!orderDoc.exists()) throw new Error("Order not found");

        const currentOrder = orderDoc.data() as Order;

        const updateData: Record<string, unknown> = {
            assignedAgentId: agentId,
            assignedAgentName: agentName,
            assignedAt: agentId ? serverTimestamp() : null,
            updatedAt: serverTimestamp(),
        };

        // Add timeline event for reassignment
        const timelineEvent: OrderTimelineEvent = {
            id: `t-${Date.now()}`,
            status: currentOrder.status, // Keep current status
            timestamp: Timestamp.now(),
            staffId: user?.uid || "unknown",
            staffName: user?.displayName || "Unknown",
            notes: agentId
                ? `Agent reassigned to ${agentName}`
                : "Agent unassigned",
            notifiedCustomer: false,
        };

        updateData.timeline = [...(currentOrder.timeline || []), timelineEvent];

        await updateDoc(orderRef, updateData);

        return { ...currentOrder, ...updateData, id: orderId };
    }, [shopId, user]);

    return { updateStatus, updateItemStatuses, updateItemProgress, collectPayment, updateOrder, reassignAgent, deleteOrder };
}

// Create order hook with order number generation
export function useCreateOrder() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { shopId, user } = useAuth();

    const createOrder = useCallback(async (input: CreateOrderInput): Promise<Order | null> => {
        if (!shopId) {
            setError("No shop ID");
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            // Use transaction to generate order number atomically
            const shopRef = doc(db, `shops/${shopId}`);
            const ordersRef = collection(db, `shops/${shopId}/orders`);

            // Customer's saved GPS pin (captured by an agent at their door) —
            // copied onto new orders so navigation stays precise for any agent.
            // Fetched OUTSIDE the transaction (read-only, non-critical).
            let custGeo: { lat: number; lng: number } | null = null;
            if (input.customerId) {
                try {
                    const custSnap = await getDoc(doc(db, `shops/${shopId}/customers/${input.customerId}`));
                    const c = custSnap.data() as { lat?: number; lng?: number } | undefined;
                    if (typeof c?.lat === "number" && typeof c?.lng === "number") custGeo = { lat: c.lat, lng: c.lng };
                } catch { /* non-fatal */ }
            }

            const result = await runTransaction(db, async (transaction) => {
                const shopDoc = await transaction.get(shopRef);
                if (!shopDoc.exists()) throw new Error("Shop not found");

                const shopData = shopDoc.data();
                const settings = shopData.settings || {};
                let shopCode = shopData.shopCode; // 4-char unique shop code
                const nextOrderNumber = settings.nextOrderNumber || 1;

                // Auto-generate shop code if missing (first order creates it)
                if (!shopCode) {
                    // Generate from shop name + random suffix
                    const shopName = shopData.name || "Shop";
                    const cleanName = shopName.toUpperCase().replace(/[^A-Z]/g, "");
                    const prefix = cleanName.length >= 2 ? cleanName.slice(0, 2) : cleanName.padEnd(2, "X");
                    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
                    const suffix = chars.charAt(Math.floor(Math.random() * chars.length)) +
                        chars.charAt(Math.floor(Math.random() * chars.length));
                    shopCode = prefix + suffix;

                    // Save the generated shop code (will be updated in same transaction)
                    transaction.update(shopRef, { shopCode });
                }

                // Generate order number with universal format: XXXX-00001
                const orderNumber = formatOrderId(shopCode, nextOrderNumber);

                // Increment next order number in shop settings
                transaction.update(shopRef, {
                    "settings.nextOrderNumber": nextOrderNumber + 1,
                });

                const orderData = {
                    orderNumber,
                    publicId: orderNumber,
                    customerId: input.customerId || null,
                    customerName: input.customerName || "Guest",
                    customerPhone: input.customerPhone || "",
                    customerEmail: input.customerEmail || null,
                    isGuest: input.isGuest ?? true,
                    items: input.items.map((item) => ({
                        id: item.id || `i-${Date.now()}`,
                        serviceId: item.serviceId || "",
                        serviceName: item.serviceName || "",
                        categoryName: item.categoryName,
                        categoryId: item.categoryId,
                        quantity: item.quantity || 1,
                        unit: item.unit || "piece",
                        unitPrice: item.unitPrice || 0,
                        total: item.total || 0,
                        express: item.express ?? false,
                        notes: item.notes || null,
                        damages: item.damages || null,
                    })),
                    damagePhotoUrls: input.damagePhotoUrls && input.damagePhotoUrls.length > 0 ? input.damagePhotoUrls : null,
                    photoMeta: input.photoMeta && input.photoMeta.length > 0 ? input.photoMeta : null,
                    financials: {
                        subtotal: input.financials.subtotal || 0,
                        discountType: input.financials.discountType || null,
                        discountValue: input.financials.discountValue || 0,
                        discountAmount: input.financials.discountAmount || 0,
                        couponCode: input.financials.couponCode || null,
                        pointsRedeemed: input.financials.pointsRedeemed || 0,
                        expressCharge: input.financials.expressCharge || 0,
                        deliveryCharge: input.financials.deliveryCharge || 0,
                        taxAmount: input.financials.taxAmount || 0,
                        taxRate: input.financials.taxRate || 0,
                        taxName: input.financials.taxName || "Tax",
                        total: input.financials.total || 0,
                        amountPaid: input.financials.amountPaid || 0,
                        balance: (input.financials.total || 0) - (input.financials.amountPaid || 0),
                    },
                    status: "pending" as OrderStatus,
                    paymentMethod: input.paymentMethod || "cash",
                    paymentStatus: (input.financials.amountPaid || 0) >= (input.financials.total || 0)
                        ? "paid"
                        : (input.financials.amountPaid || 0) > 0
                            ? "partial"
                            : "unpaid",
                    paymentReference: input.paymentReference || null,
                    deliveryType: input.deliveryType || "pickup_store",
                    deliveryAddress: input.deliveryAddress || null,
                    // Reuse the customer's saved GPS pin (captured by an agent at
                    // their door) so navigation is precise on every future order.
                    ...(custGeo ? { deliveryLat: custGeo.lat, deliveryLng: custGeo.lng } : {}),
                    deliveryArea: input.deliveryArea || null,
                    deliveryNotes: input.deliveryNotes || null,
                    deliverySlot: input.deliverySlot || null,
                    scheduledPickupDate: input.scheduledPickupDate ? Timestamp.fromDate(input.scheduledPickupDate) : null,
                    scheduledPickupTime: input.pickupSlot || null,
                    expectedDelivery: Timestamp.fromDate(input.expectedDelivery),
                    staffId: input.staffId || user?.uid || "unknown",
                    staffName: input.staffName || user?.displayName || "Unknown",
                    orderSource: "pos",
                    assignedAgentId: input.assignedAgentId || null,
                    assignedAgentName: input.assignedAgentName || null,
                    assignedAt: input.assignedAgentId ? serverTimestamp() : null,
                    shopId,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    timeline: [{
                        id: `t-${Date.now()}`,
                        status: "pending",
                        timestamp: Timestamp.now(),
                        staffId: input.staffId || user?.uid || "unknown",
                        staffName: input.staffName || user?.displayName || "Unknown",
                        notifiedCustomer: false,
                    }],
                    // Seed payments[] with the upfront amount so sum(payments) === amountPaid.
                    payments: (input.financials.amountPaid || 0) > 0 ? [{
                        id: `p-${Date.now()}`,
                        amount: input.financials.amountPaid || 0,
                        method: input.paymentMethod || "cash",
                        reference: input.paymentReference || null,
                        collectedBy: input.staffName || user?.displayName || "Unknown",
                        collectedAt: Timestamp.now(),
                    }] : [],
                };

                // Create order document outside transaction (addDoc doesn't work in transactions)
                return { orderData, orderNumber };
            });

            // Create the order document
            const docRef = await addDoc(ordersRef, result.orderData);

            // Update customer stats if not guest
            if (input.customerId) {
                const customerRef = doc(db, `shops/${shopId}/customers/${input.customerId}`);
                const customerUpdate: Record<string, unknown> = {
                    totalOrders: increment(1),
                    totalSpent: increment(input.financials.total),
                    lastOrderAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                };
                // Loyalty: redeemed points leave the balance the moment the order is placed.
                const redeemed = input.financials.pointsRedeemed || 0;
                if (redeemed > 0) customerUpdate.loyaltyPoints = increment(-redeemed);
                await updateDoc(customerRef, customerUpdate);

                // Loyalty earn: an order that is FULLY PAID at creation credits points now
                // (same rule as collectPayment; guarded by order.loyalty for idempotency).
                if ((input.financials.amountPaid || 0) >= (input.financials.total || 0) && (input.financials.total || 0) > 0) {
                    await creditLoyaltyIfDue(shopId, docRef.id, {
                        customerId: input.customerId,
                        total: input.financials.total || 0,
                    });
                }
            }

            const order: Order = {
                id: docRef.id,
                ...result.orderData,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            } as Order;

            setLoading(false);
            return order;
        } catch (err) {
            console.error("Error creating order:", err);
            setError("Failed to create order");
            setLoading(false);
            return null;
        }
    }, [shopId, user]);

    return {
        createOrder,
        loading,
        error,
    };
}

// Order stats hook for dashboard
export function useOrderStats() {
    const { shopId } = useAuth();
    const [stats, setStats] = useState({
        todayOrders: 0,
        todayRevenue: 0,
        pendingPickups: 0,
        processingCount: 0,
    });

    useEffect(() => {
        if (!shopId) return;

        const ordersRef = collection(db, `shops/${shopId}/orders`);

        // Get today's start timestamp
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const unsubscribe = onSnapshot(
            ordersRef,
            (snapshot) => {
                const orders = snapshot.docs.map((d) => d.data() as Order);

                const todayOrders = orders.filter((o) => {
                    const created = o.createdAt?.toDate?.();
                    // Exclude cancelled so today's count/revenue match every other screen.
                    return created && created >= today && o.status !== "cancelled";
                });

                const readyOrders = orders.filter((o) => o.status === "ready");
                const processingOrders = orders.filter((o) => o.status === "processing");

                setStats({
                    todayOrders: todayOrders.length,
                    todayRevenue: todayOrders.reduce((sum, o) => sum + (o.financials?.total || 0), 0),
                    pendingPickups: readyOrders.length,
                    processingCount: processingOrders.length,
                });
            },
            (error) => {
                console.error("Error loading order stats:", error);
            }
        );

        return unsubscribe;
    }, [shopId]);

    return stats;
}
