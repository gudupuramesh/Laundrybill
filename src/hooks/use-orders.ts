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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import type { Order, OrderItem, OrderStatus, PaymentMethod, DeliveryType, OrderFinancials, OrderTimelineEvent } from "@/types/order";
import { formatOrderId } from "@/lib/generateShopCode";

const PAGE_SIZE = 50;

interface CreateOrderInput {
    customerId?: string;
    customerName: string;
    customerPhone: string;
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

        // Set deliveredAt when delivered
        if (newStatus === "delivered") {
            updateData.deliveredAt = serverTimestamp();
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
                    await updateDoc(customerRef, {
                        totalOrders: increment(-1),
                        totalSpent: increment(-(fin.total || 0)),
                        updatedAt: serverTimestamp(),
                    });
                } catch {
                    // Non-fatal: customer doc may be missing; order cancel still proceeds.
                }
            }
        }

        await updateDoc(orderRef, updateData);

        return { ...currentOrder, ...updateData, id: orderId };
    }, [shopId, user]);

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

    return { updateStatus, collectPayment, updateOrder, reassignAgent };
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
                await updateDoc(customerRef, {
                    totalOrders: increment(1),
                    totalSpent: increment(input.financials.total),
                    lastOrderAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
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
