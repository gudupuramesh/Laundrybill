import { useState, useEffect } from "react";
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    doc,
    updateDoc,
    serverTimestamp,
    arrayUnion,
    Timestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useDriverAuth } from "@/features/driver-app/DriverAuthContext"; // Reusing DriverAuth for Plant
import type { Order, OrderStatus } from "@/types/order";

export function usePlantOrders(statuses: OrderStatus[]) {
    const { shopId, agent } = useDriverAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!shopId) {
            setOrders([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Query orders in the specific shop's subcollection
            const q = query(
                collection(db, "shops", shopId, "orders"),
                where("status", "in", statuses),
                orderBy("updatedAt", "desc")
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const ordersData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Order[];
                setOrders(ordersData);
                setLoading(false);
            }, (err) => {
                console.error("Error fetching plant orders:", err);
                setError("Failed to load orders");
                setLoading(false);
            });

            return () => unsubscribe();
        } catch (err) {
            console.error("Error setting up plant orders listener:", err);
            setError("Failed to initialize order listener");
            setLoading(false);
        }
    }, [shopId, JSON.stringify(statuses)]);

    // Mutation: Start Processing
    const startProcessing = async (orderId: string) => {
        if (!agent || !shopId) throw new Error("Not authenticated");

        const orderRef = doc(db, "shops", shopId, "orders", orderId);
        const status: OrderStatus = "processing";

        await updateDoc(orderRef, {
            status,
            updatedAt: serverTimestamp(),
            timeline: arrayUnion({
                status,
                timestamp: Timestamp.now(),
                staffId: agent.id,
                staffName: agent.name,
                notes: "Started processing at plant"
            })
        });
    };

    // Mutation: Mark Ready - sets correct status based on order type
    const markReady = async (orderId: string, order: Order) => {
        if (!agent || !shopId) throw new Error("Not authenticated");

        const orderRef = doc(db, "shops", shopId, "orders", orderId);

        // For Shop Pickup, use ready_for_pickup; for others, use ready
        const status: OrderStatus = order.deliveryType === 'pickup_store'
            ? 'ready_for_pickup'
            : 'ready';

        await updateDoc(orderRef, {
            status,
            updatedAt: serverTimestamp(),
            timeline: arrayUnion({
                status,
                timestamp: Timestamp.now(),
                staffId: agent.id,
                staffName: agent.name,
                notes: order.deliveryType === 'pickup_store'
                    ? "Ready for customer pickup"
                    : "Processing completed"
            })
        });
    };

    // Mutation: Mark Out for Delivery (Dispatch) - only for delivery orders
    const markOutForDelivery = async (orderId: string, order: Order) => {
        if (!agent || !shopId) throw new Error("Not authenticated");

        // Shop Pickup orders don't get "out_for_delivery" - they go straight to picked_up by admin
        if (order.deliveryType === 'pickup_store') {
            throw new Error("Shop Pickup orders cannot be dispatched for delivery");
        }

        const orderRef = doc(db, "shops", shopId, "orders", orderId);
        const status: OrderStatus = "out_for_delivery";

        await updateDoc(orderRef, {
            status,
            updatedAt: serverTimestamp(),
            timeline: arrayUnion({
                status,
                timestamp: Timestamp.now(),
                staffId: agent.id,
                staffName: agent.name,
                notes: "Dispatched from plant"
            })
        });
    };

    return {
        orders,
        loading,
        error,
        startProcessing,
        markReady,
        markOutForDelivery
    };
}
