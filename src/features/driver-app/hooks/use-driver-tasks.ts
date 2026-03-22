/**
 * Driver Tasks Hook
 * 
 * Fetches pickup and delivery tasks assigned to the current agent.
 * Tasks are derived from orders with assignedAgentId matching the logged-in agent.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, arrayUnion, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useDriverAuth } from "@/features/driver-app/DriverAuthContext";
import type { Order, OrderStatus, OrderItem, PaymentStatus, OrderFinancials } from "@/types/order";
import type { TaskStatus, TaskType, TaskPriority } from "@/types/delivery-agent";

export interface DriverTask {
    id: string;
    type: TaskType;
    orderId: string;
    orderPublicId: string;
    customer: {
        name: string;
        phone: string;
        address: string;
    };
    itemCount: number;
    items: OrderItem[]; // Added for detailed view
    financials: OrderFinancials; // Added for tax/subtotal display
    amountToCollect?: number;
    orderTotal?: number; // Total order value for payment calculation
    previouslyPaid?: number; // Amount already paid before delivery
    paymentStatus?: PaymentStatus;
    scheduledDate: Date;
    timeSlot?: { start: string; end: string };
    priority: TaskPriority;
    status: TaskStatus;
    orderStatus: OrderStatus;
    instructions?: string;
    /** Order source: 'online' = public page, 'pos' = in-shop */
    orderSource?: "online" | "pos" | "phone";
}

interface UseDriverTasksOptions {
    type?: TaskType;
    status?: TaskStatus;
    date?: Date;
}

/**
 * Hook to fetch tasks for the current agent
 * Returns orders assigned to this agent that need pickup or delivery
 */
export function useDriverTasks(options: UseDriverTasksOptions = {}) {
    const { agent, shopId } = useDriverAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!shopId || !agent?.id) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const ordersRef = collection(db, `shops/${shopId}/orders`);

        // Query orders assigned to this agent
        const q = query(
            ordersRef,
            where("assignedAgentId", "==", agent.id)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const ordersList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Order[];

            setOrders(ordersList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [shopId, agent?.id]);

    // Transform orders into pickup tasks
    // For pickup_home orders, we show them in Pickups tab throughout their lifecycle
    // so agents can see their completed pickup history
    const pickupTasks = useMemo((): DriverTask[] => {
        return orders
            .filter(order => {
                // Only pickup_home orders need agent pickup
                if (order.deliveryType !== "pickup_home") return false;
                // Include ALL statuses so completed pickups remain visible in history
                // Exclude only cancelled orders
                if (order.status === "cancelled") return false;
                return true;
            })
            .map(order => {
                // Determine pickup task status based on order status
                // Pending = not yet picked up
                // Completed = pickup has been done (pickup_completed or any status after)
                const isPickupDone = !["pending", "pickup_scheduled"].includes(order.status);

                return {
                    id: `pickup-${order.id}`,
                    type: "pickup" as TaskType,
                    orderId: order.id,
                    orderPublicId: order.publicId || order.orderNumber,
                    customer: {
                        name: order.customerName,
                        phone: order.customerPhone,
                        address: order.pickupAddress || order.deliveryAddress || order.customerAddress || "",
                    },
                    itemCount: order.items?.length || 0,
                    items: order.items || [],
                    financials: order.financials || { subtotal: 0, discountAmount: 0, expressCharge: 0, deliveryCharge: 0, total: 0, amountPaid: 0, balance: 0 },
                    scheduledDate: order.scheduledPickupDate?.toDate() || order.createdAt?.toDate() || new Date(),
                    timeSlot: order.scheduledPickupTime ? { start: order.scheduledPickupTime, end: "" } : undefined,
                    priority: "normal" as TaskPriority,
                    status: isPickupDone ? "completed" : "pending" as TaskStatus,
                    orderStatus: order.status,
                };
            });
    }, [orders]);

    // Transform orders into delivery tasks
    const deliveryTasks = useMemo((): DriverTask[] => {
        return orders
            .filter(order => {
                // delivery_home and pickup_home orders need delivery after processing
                if (!["delivery_home", "pickup_home"].includes(order.deliveryType)) return false;
                // Include processing/pickup_completed for "Upcoming" view
                if (!["processing", "pickup_completed", "ready", "out_for_delivery", "delivered"].includes(order.status)) return false;
                return true;
            })
            .map(order => ({
                id: `delivery-${order.id}`,
                type: "delivery" as TaskType,
                orderId: order.id,
                orderPublicId: order.publicId || order.orderNumber,
                customer: {
                    name: order.customerName,
                    phone: order.customerPhone,
                    address: order.deliveryAddress || order.customerAddress || "",
                },
                itemCount: order.items?.length || 0,
                items: order.items || [],
                financials: order.financials || { subtotal: 0, discountAmount: 0, expressCharge: 0, deliveryCharge: 0, total: 0, amountPaid: 0, balance: 0 },
                amountToCollect: order.financials?.balance || 0,
                orderTotal: order.financials?.total || 0,
                previouslyPaid: order.financials?.amountPaid || 0,
                paymentStatus: (order.paymentStatus as PaymentStatus) || "unpaid",
                scheduledDate: order.expectedDelivery?.toDate() || new Date(),
                priority: "normal" as TaskPriority,
                status: order.status === "delivered" ? "completed" : "pending" as TaskStatus,
                orderStatus: order.status,
                orderSource: order.orderSource,
            }));
    }, [orders]);



    // Filter tasks based on options
    const filteredTasks = useMemo(() => {
        let tasks = options.type === "pickup" ? pickupTasks :
            options.type === "delivery" ? deliveryTasks :
                [...pickupTasks, ...deliveryTasks];

        if (options.status) {
            tasks = tasks.filter(t => t.status === options.status);
        }

        if (options.date) {
            const dateStr = options.date.toDateString();
            tasks = tasks.filter(t => t.scheduledDate.toDateString() === dateStr);
        }

        // Sort by scheduled date
        return tasks.sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());
    }, [pickupTasks, deliveryTasks, options.type, options.status, options.date]);

    // Stats for today - filter tasks that are for today only, exclude cancelled
    const todayStats = useMemo(() => {
        const today = new Date();
        const todayStr = today.toDateString();

        // Get today's pickup tasks for pickup_home orders (exclude cancelled)
        const todayPickupOrders = orders.filter(o =>
            o.deliveryType === "pickup_home" &&
            o.status !== "cancelled" &&
            (o.scheduledPickupDate?.toDate()?.toDateString() === todayStr ||
                o.createdAt?.toDate()?.toDateString() === todayStr)
        );

        const todayPickupsTotal = todayPickupOrders.length;
        const todayPickupsCompleted = todayPickupOrders.filter(o =>
            !["pending", "pickup_scheduled"].includes(o.status)
        ).length;

        // Get today's delivery orders (exclude cancelled, only those ready for delivery)
        const todayDeliveryOrders = orders.filter(o =>
            ["delivery_home", "pickup_home"].includes(o.deliveryType) &&
            o.status !== "cancelled" &&
            (o.expectedDelivery?.toDate()?.toDateString() === todayStr ||
                (o.status === "delivered" && o.deliveredAt?.toDate()?.toDateString() === todayStr))
        );

        const todayDeliveriesTotal = todayDeliveryOrders.length;
        const todayDeliveriesCompleted = todayDeliveryOrders.filter(o =>
            o.status === "delivered"
        ).length;

        // Amount collected today
        const todayCollected = orders
            .filter(o =>
                o.status === "delivered" &&
                o.deliveredAt?.toDate()?.toDateString() === todayStr
            )
            .reduce((sum, o) => sum + (o.financials?.amountPaid || 0), 0);

        return {
            pickups: { completed: todayPickupsCompleted, total: todayPickupsTotal },
            deliveries: { completed: todayDeliveriesCompleted, total: todayDeliveriesTotal },
            collected: todayCollected,
        };
    }, [orders]);

    // Lifetime stats for profile page - total orders completed by this agent
    const lifetimeStats = useMemo(() => {
        // Total pickups completed (all time)
        const pickupsCompleted = orders.filter(o =>
            o.deliveryType === "pickup_home" &&
            !["pending", "pickup_scheduled", "cancelled"].includes(o.status)
        ).length;

        // Total deliveries completed (all time)
        const deliveriesCompleted = orders.filter(o =>
            ["delivery_home", "pickup_home"].includes(o.deliveryType) &&
            o.status === "delivered"
        ).length;

        return {
            pickupsCompleted,
            deliveriesCompleted,
        };
    }, [orders]);

    return {
        tasks: filteredTasks,
        pickupTasks,
        deliveryTasks,
        todayStats,
        lifetimeStats,
        loading,
    };
}

/**
 * Hook for completing a pickup task
 */
export function useCompletePickup() {
    const { shopId, agent } = useDriverAuth();
    const [loading, setLoading] = useState(false);

    const completePickup = useCallback(async (
        orderId: string,
        data: { itemsCollected: number; photoUrl?: string; notes?: string }
    ) => {
        if (!shopId) throw new Error("No shop ID");

        setLoading(true);
        try {
            const orderRef = doc(db, `shops/${shopId}/orders`, orderId);

            // Create timeline event for pickup completion
            const timelineEvent = {
                id: `t-${Date.now()}`,
                status: "pickup_completed" as OrderStatus,
                timestamp: Timestamp.now(),
                staffId: agent?.id || "agent",
                staffName: agent?.name || "Pickup Agent",
                notes: data.notes || "Items collected from customer",
                notifiedCustomer: true,
            };

            await updateDoc(orderRef, {
                status: "pickup_completed" as OrderStatus,
                pickupCompletedAt: serverTimestamp(),
                pickupNotes: data.notes || null,
                pickupPhoto: data.photoUrl || null,
                itemsCollected: data.itemsCollected,
                timeline: arrayUnion(timelineEvent),
                updatedAt: serverTimestamp(),
            });
            setLoading(false);
            return true;
        } catch (error) {
            console.error("Failed to complete pickup:", error);
            setLoading(false);
            throw error;
        }
    }, [shopId, agent]);

    return { completePickup, loading };
}

/**
 * Hook for completing a delivery task
 */
export function useCompleteDelivery() {
    const { shopId, agent } = useDriverAuth();
    const [loading, setLoading] = useState(false);

    const completeDelivery = useCallback(async (
        orderId: string,
        data: {
            collectedAmount: number;
            paymentMethod: "cash" | "upi" | "paid_already";
            photoUrl?: string;
            signature?: string;
            notes?: string;
        },
        orderTotal?: number,
        previouslyPaid?: number
    ) => {
        if (!shopId) throw new Error("No shop ID");

        setLoading(true);
        try {
            const orderRef = doc(db, `shops/${shopId}/orders`, orderId);

            // Calculate payment status based on collected amount + previous payments
            const totalPaid = (previouslyPaid || 0) + (data.paymentMethod === "paid_already" ? 0 : data.collectedAmount);
            const total = orderTotal || 0;
            const newBalance = Math.max(0, total - totalPaid);

            let paymentStatus: "paid" | "partial" | "unpaid" = "unpaid";
            if (data.paymentMethod === "paid_already" || newBalance <= 0) {
                paymentStatus = "paid";
            } else if (totalPaid > 0) {
                paymentStatus = "partial";
            }

            // Create timeline event for delivery
            const timelineEvent = {
                id: `t-${Date.now()}`,
                status: "delivered" as OrderStatus,
                timestamp: Timestamp.now(),
                staffId: agent?.id || "agent",
                staffName: agent?.name || "Delivery Agent",
                notes: data.notes || "Order delivered",
                notifiedCustomer: true,
            };

            await updateDoc(orderRef, {
                status: "delivered" as OrderStatus,
                deliveredAt: serverTimestamp(),
                deliveryNotes: data.notes || null,
                deliveryPhoto: data.photoUrl || null,
                deliverySignature: data.signature || null,
                collectedAmount: data.collectedAmount,
                collectedPaymentMethod: data.paymentMethod,
                paymentStatus,
                "financials.amountPaid": totalPaid,
                "financials.balance": newBalance,
                timeline: arrayUnion(timelineEvent),
                updatedAt: serverTimestamp(),
            });
            setLoading(false);
            return true;
        } catch (error) {
            console.error("Failed to complete delivery:", error);
            setLoading(false);
            throw error;
        }
    }, [shopId, agent]);

    return { completeDelivery, loading };
}
