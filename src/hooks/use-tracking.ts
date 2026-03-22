/**
 * Order Tracking Hook
 * 
 * Fetches order details for public tracking page using tracking ID or public ID
 * This is a PUBLIC hook - no authentication required
 */

import { useState, useEffect } from "react";
import {
    query,
    where,
    getDocs,
    doc,
    getDoc,
    collectionGroup,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { OrderStatus } from "@/types/order";

interface TrackingData {
    orderId: string;
    shopId: string;
    publicId: string;
    status: OrderStatus;
    customerPhone: string;
    customerName: string;
    /** Pickup/delivery address (for pickup_home/delivery_home orders). */
    deliveryAddress?: string;
    items: { name: string; quantity: number; price?: number; express?: boolean; categoryName?: string }[];
    total: number;
    amountPaid: number;
    balance: number;
    expectedDelivery: Date;
    deliveredAt?: Date; // When order was actually delivered
    deliveryType: string;
    timeline: {
        status: OrderStatus;
        timestamp: Date;
        note?: string;
    }[];
    shopName?: string;
    shopPhone?: string;
    shopAddress?: string;
    shopEmail?: string;
    // Assigned agent info
    assignedAgentId?: string;
    assignedAgentName?: string;
    assignedAgentPhone?: string;
    // Financials
    taxAmount?: number;
    taxName?: string;
    taxRate?: number;
    deliveryCharge?: number;
    discountAmount?: number;
    // Photos (damage/stain, pickup proof, delivery proof, plant proof)
    damagePhotoUrls?: string[];
    pickupPhoto?: string;
    deliveryPhoto?: string;
    plantPhoto?: string;
    /** Order source: 'online' = public page quick order, 'pos' = in-shop */
    orderSource?: "online" | "pos" | "phone";
}

// Map internal status to display status for timeline
function mapStatusForTimeline(status: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
        "order_placed": "pending",
        "pending": "pending",
        "pickup_scheduled": "pickup_scheduled",
        "picked_up": "picked_up",
        "in_progress": "processing",
        "processing": "processing",
        "ready_for_delivery": "ready",
        "ready_for_pickup": "ready_for_pickup",
        "ready": "ready",
        "out_for_delivery": "out_for_delivery",
        "delivered": "delivered",
        "cancelled": "cancelled",
    };
    return statusMap[status] || (status as OrderStatus);
}

// Order IDs are now globally unique (format: XXXX-00001)
// Legacy IDs (A-001) may exist but will match the first shop
export function useOrderTracking(trackingId: string) {
    const [data, setData] = useState<TrackingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!trackingId || trackingId.trim() === "") {
            setLoading(false);
            setError("No tracking ID provided");
            return;
        }

        const fetchOrder = async () => {
            setLoading(true);
            setError(null);

            try {
                // Clean up the tracking ID
                const cleanId = trackingId.trim().toUpperCase();

                let orderData: any = null;
                let foundShopId = "";
                let orderId = "";

                // Query across all shops using collection group
                // New format (XXXX-00001) is globally unique, legacy format (A-001) matches first shop
                const queryMethods = [
                    // Method 1: Search by publicId (most common)
                    () => query(collectionGroup(db, "orders"), where("publicId", "==", cleanId)),
                    // Method 2: Search by orderNumber  
                    () => query(collectionGroup(db, "orders"), where("orderNumber", "==", cleanId)),
                    // Method 3: Search by trackingId
                    () => query(collectionGroup(db, "orders"), where("trackingId", "==", cleanId)),
                    // Method 4: Without hyphen (A001 instead of A-001)
                    () => query(collectionGroup(db, "orders"), where("publicId", "==", cleanId.replace(/-/g, ""))),
                    // Method 5: With hyphen added (A001 -> A-001)
                    () => query(collectionGroup(db, "orders"), where("publicId", "==", cleanId.replace(/^([A-Z]+)(\d+)$/, "$1-$2"))),
                ];

                for (const createQuery of queryMethods) {
                    try {
                        const querySnapshot = await getDocs(createQuery());

                        if (!querySnapshot.empty) {
                            const orderDoc = querySnapshot.docs[0];
                            orderData = orderDoc.data();
                            orderId = orderDoc.id;

                            // Extract shopId from the document path
                            // Path format: shops/{shopId}/orders/{orderId}
                            const pathParts = orderDoc.ref.path.split("/");
                            foundShopId = pathParts[1];
                            break;
                        }
                    } catch (queryErr) {
                        // Continue to next query method
                        console.log("Query method failed:", queryErr);
                    }
                }

                if (!orderData) {
                    setError("Order not found. Please check your tracking ID.");
                    setData(null);
                    setLoading(false);
                    return;
                }

                // Fetch shop details
                let shopName = "";
                let shopPhone = "";
                let shopAddress = "";
                let shopEmail = "";
                let agentPhone = "";

                try {
                    const shopDoc = await getDoc(doc(db, "shops", foundShopId));
                    if (shopDoc.exists()) {
                        const shopData = shopDoc.data();
                        shopName = shopData.name || shopData.shopName || "";
                        shopPhone = shopData.phone || shopData.shopPhone || shopData.whatsappNumber || "";
                        const loc = shopData.location;
                        if (loc?.address) {
                            const parts = [loc.address, loc.city, loc.pincode].filter(Boolean);
                            shopAddress = parts.join(", ");
                        } else {
                            shopAddress = shopData.address || "";
                        }
                        shopEmail = shopData.email || "";
                    }
                } catch (shopErr) {
                    console.log("Could not fetch shop details:", shopErr);
                }

                // Fetch agent phone if agent is assigned (try staff then teamMembers)
                if (orderData.assignedAgentId && foundShopId) {
                    try {
                        const staffDoc = await getDoc(doc(db, "shops", foundShopId, "staff", orderData.assignedAgentId));
                        if (staffDoc.exists()) {
                            const agentData = staffDoc.data();
                            agentPhone = agentData.phone || "";
                        }
                        if (!agentPhone) {
                            const tmDoc = await getDoc(doc(db, "shops", foundShopId, "teamMembers", orderData.assignedAgentId));
                            if (tmDoc.exists()) {
                                const tmData = tmDoc.data();
                                agentPhone = tmData.phone || "";
                            }
                        }
                    } catch (agentErr) {
                        console.log("Could not fetch agent details:", agentErr);
                    }
                }

                // Build timeline from order timeline array
                const timeline: TrackingData["timeline"] = [];

                if (orderData.timeline && Array.isArray(orderData.timeline)) {
                    orderData.timeline.forEach((event: any) => {
                        timeline.push({
                            status: mapStatusForTimeline(event.status),
                            timestamp: event.timestamp?.toDate ? event.timestamp.toDate() : new Date(event.timestamp),
                            note: event.note || event.notes,
                        });
                    });
                } else {
                    // Create basic timeline from order status and createdAt
                    timeline.push({
                        status: "pending",
                        timestamp: orderData.createdAt?.toDate ? orderData.createdAt.toDate() : new Date(),
                    });

                    if (orderData.status !== "order_placed" && orderData.status !== "pending") {
                        timeline.push({
                            status: mapStatusForTimeline(orderData.status),
                            timestamp: orderData.updatedAt?.toDate ? orderData.updatedAt.toDate() : new Date(),
                        });
                    }
                }

                // Extract order items
                const items: TrackingData["items"] = [];
                if (orderData.items && Array.isArray(orderData.items)) {
                    orderData.items.forEach((item: any) => {
                        items.push({
                            name: item.serviceName || item.name || "Item",
                            quantity: item.quantity || 1,
                            price: item.price || item.total,
                            express: item.express || false,
                            categoryName: item.categoryName || undefined,
                        });
                    });
                }

                // Build tracking data
                const trackingData: TrackingData = {
                    orderId,
                    shopId: foundShopId,
                    publicId: orderData.publicId || orderData.orderNumber || cleanId,
                    status: mapStatusForTimeline(orderData.status || "pending"),
                    customerPhone: orderData.customerPhone || "",
                    customerName: orderData.customerName || "Customer",
                    deliveryAddress: orderData.deliveryAddress || orderData.pickupAddress || undefined,
                    items,
                    total: orderData.financials?.total || orderData.totalAmount || 0,
                    amountPaid: orderData.financials?.amountPaid || orderData.paidAmount || 0,
                    balance: orderData.financials?.balance ||
                        ((orderData.financials?.total || 0) - (orderData.financials?.amountPaid || 0)),
                    expectedDelivery: orderData.expectedDelivery?.toDate ?
                        orderData.expectedDelivery.toDate() :
                        new Date(Date.now() + 86400000 * 2),
                    deliveredAt: orderData.deliveredAt?.toDate ?
                        orderData.deliveredAt.toDate() :
                        undefined,
                    deliveryType: orderData.deliveryType || "pickup_store",
                    timeline,
                    shopName,
                    shopPhone,
                    shopAddress,
                    shopEmail,
                    // Agent info (phone from staff doc, or from order if stored when assigned)
                    assignedAgentId: orderData.assignedAgentId || undefined,
                    assignedAgentName: orderData.assignedAgentName || undefined,
                    assignedAgentPhone: agentPhone || orderData.assignedAgentPhone || undefined,
                    // Financials
                    taxAmount: orderData.financials?.taxAmount || 0,
                    taxName: orderData.financials?.taxName,
                    taxRate: orderData.financials?.taxRate,
                    deliveryCharge: orderData.financials?.deliveryCharge || 0,
                    discountAmount: orderData.financials?.discountAmount || 0,
                    // Photos for customer/staff/agent visibility
                    damagePhotoUrls: orderData.damagePhotoUrls || undefined,
                    pickupPhoto: orderData.pickupPhoto || undefined,
                    deliveryPhoto: orderData.deliveryPhoto || undefined,
                    plantPhoto: orderData.plantPhoto || undefined,
                    orderSource: orderData.orderSource || undefined,
                };

                setData(trackingData);
                setError(null);

            } catch (err: any) {
                console.error("Tracking fetch error:", err);

                // Check for permission errors
                if (err.code === "permission-denied") {
                    setError("Unable to access order. Please contact the shop.");
                } else {
                    setError("Failed to load order details. Please try again.");
                }
                setData(null);
            }

            setLoading(false);
        };

        fetchOrder();
    }, [trackingId]);

    return { data, loading, error };
}
