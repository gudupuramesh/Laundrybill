/**
 * Order Tracking Hook (public, phone-verified)
 *
 * Calls the `trackOrder` Cloud Function with an order number/ID + the phone
 * number on the order. The function runs server-side (Admin SDK) and only
 * returns data when the phone matches — so order documents are no longer
 * world-readable and can't be enumerated by sequential order number.
 */

import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { OrderStatus } from "@/types/order";

interface TrackingData {
    orderId: string;
    shopId: string;
    publicId: string;
    status: OrderStatus;
    customerPhone: string;
    customerName: string;
    deliveryAddress?: string;
    items: { name: string; quantity: number; price?: number; express?: boolean; categoryName?: string }[];
    total: number;
    amountPaid: number;
    balance: number;
    expectedDelivery: Date;
    deliveredAt?: Date;
    deliveryType: string;
    timeline: { status: OrderStatus; timestamp: Date; note?: string }[];
    shopName?: string;
    shopPhone?: string;
    shopAddress?: string;
    shopEmail?: string;
    assignedAgentId?: string;
    assignedAgentName?: string;
    assignedAgentPhone?: string;
    taxAmount?: number;
    taxName?: string;
    taxRate?: number;
    deliveryCharge?: number;
    discountAmount?: number;
    damagePhotoUrls?: string[];
    pickupPhoto?: string;
    deliveryPhoto?: string;
    plantPhoto?: string;
    orderSource?: "online" | "pos" | "phone";
}

function mapStatusForTimeline(status: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
        order_placed: "pending",
        pending: "pending",
        pickup_scheduled: "pickup_scheduled",
        picked_up: "picked_up",
        in_progress: "processing",
        processing: "processing",
        ready_for_delivery: "ready",
        ready_for_pickup: "ready_for_pickup",
        ready: "ready",
        out_for_delivery: "out_for_delivery",
        delivered: "delivered",
        cancelled: "cancelled",
    };
    return statusMap[status] || (status as OrderStatus);
}

const toDate = (ms: number | null | undefined): Date | undefined =>
    ms != null ? new Date(ms) : undefined;

/**
 * @param code  Order number / public ID / tracking ID
 * @param phone The customer's mobile number on the order (verifier). Tracking
 *              only runs once both are present.
 */
export function useOrderTracking(code: string, phone: string) {
    const [data, setData] = useState<TrackingData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const cleanCode = (code || "").trim();
        const cleanPhone = (phone || "").replace(/\D/g, "");

        if (!cleanCode) {
            setData(null);
            setLoading(false);
            setError(null);
            return;
        }
        if (cleanPhone.length < 10) {
            // Waiting for the phone verifier — not an error, just not ready.
            setData(null);
            setLoading(false);
            setError(null);
            return;
        }

        let cancelled = false;
        const run = async () => {
            setLoading(true);
            setError(null);
            try {
                const fn = httpsCallable<{ code: string; phone: string }, any>(functions, "trackOrder");
                const res = await fn({ code: cleanCode, phone: cleanPhone });
                if (cancelled) return;
                const r = res.data;

                const tracking: TrackingData = {
                    orderId: r.orderId,
                    shopId: r.shopId,
                    publicId: r.publicId,
                    status: mapStatusForTimeline(r.status || "pending"),
                    customerPhone: r.customerPhone || "",
                    customerName: r.customerName || "Customer",
                    deliveryAddress: r.deliveryAddress || undefined,
                    items: Array.isArray(r.items) ? r.items : [],
                    total: r.total || 0,
                    amountPaid: r.amountPaid || 0,
                    balance: r.balance || 0,
                    expectedDelivery: toDate(r.expectedDelivery) || new Date(Date.now() + 86400000 * 2),
                    deliveredAt: toDate(r.deliveredAt),
                    deliveryType: r.deliveryType || "pickup_store",
                    timeline: (Array.isArray(r.timeline) ? r.timeline : []).map((e: any) => ({
                        status: mapStatusForTimeline(e.status),
                        timestamp: toDate(e.timestamp) || new Date(),
                        note: e.note || undefined,
                    })),
                    shopName: r.shopName || undefined,
                    shopPhone: r.shopPhone || undefined,
                    shopAddress: r.shopAddress || undefined,
                    shopEmail: r.shopEmail || undefined,
                    assignedAgentId: r.assignedAgentId || undefined,
                    assignedAgentName: r.assignedAgentName || undefined,
                    assignedAgentPhone: r.assignedAgentPhone || undefined,
                    taxAmount: r.taxAmount || 0,
                    taxName: r.taxName || undefined,
                    taxRate: r.taxRate || undefined,
                    deliveryCharge: r.deliveryCharge || 0,
                    discountAmount: r.discountAmount || 0,
                    damagePhotoUrls: r.damagePhotoUrls || undefined,
                    pickupPhoto: r.pickupPhoto || undefined,
                    deliveryPhoto: r.deliveryPhoto || undefined,
                    plantPhoto: r.plantPhoto || undefined,
                    orderSource: r.orderSource || undefined,
                };
                setData(tracking);
                setError(null);
            } catch (err: any) {
                if (cancelled) return;
                const code2 = err?.code || "";
                if (code2.includes("not-found")) {
                    setError("No order matches that number and phone. Please check and try again.");
                } else if (code2.includes("invalid-argument")) {
                    setError(err?.message || "Enter a valid order number and mobile number.");
                } else {
                    setError("Failed to load order details. Please try again.");
                }
                setData(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        run();
        return () => { cancelled = true; };
    }, [code, phone]);

    return { data, loading, error };
}
