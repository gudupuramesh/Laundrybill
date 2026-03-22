/**
 * Payments Hook
 * 
 * Manages payment data for super admin
 */

import { useState, useEffect, useCallback } from "react";
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    doc,
    updateDoc,
    serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Payment, PaymentStatus } from "@/types/super-admin";

interface UsePaymentsOptions {
    statusFilter?: PaymentStatus | "all";
    searchTerm?: string;
    shopId?: string;
}

export function usePayments(options: UsePaymentsOptions = {}) {
    const { statusFilter = "all", searchTerm = "", shopId } = options;

    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPayments = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            let q = query(
                collection(db, "payments"),
                orderBy("createdAt", "desc")
            );

            // Filter by shop
            if (shopId) {
                q = query(
                    collection(db, "payments"),
                    where("shopId", "==", shopId),
                    orderBy("createdAt", "desc")
                );
            }

            // Filter by status
            if (statusFilter !== "all" && !shopId) {
                q = query(
                    collection(db, "payments"),
                    where("status", "==", statusFilter),
                    orderBy("createdAt", "desc")
                );
            }

            const snapshot = await getDocs(q);
            let results: Payment[] = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            } as Payment));

            // Client-side status filter if combined with shopId
            if (statusFilter !== "all" && shopId) {
                results = results.filter((p) => p.status === statusFilter);
            }

            // Client-side search
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                results = results.filter(
                    (p) =>
                        p.shopName?.toLowerCase().includes(term) ||
                        p.invoiceNumber?.toLowerCase().includes(term) ||
                        p.gatewayPaymentId?.toLowerCase().includes(term)
                );
            }

            setPayments(results);
        } catch (err) {
            console.error("Failed to fetch payments:", err);
            setError("Failed to load payments");
        } finally {
            setLoading(false);
        }
    }, [statusFilter, searchTerm, shopId]);

    useEffect(() => {
        fetchPayments();
    }, [fetchPayments]);

    return {
        payments,
        loading,
        error,
        refetch: fetchPayments,
    };
}

export interface PaymentStats {
    totalRevenue: number;
    successCount: number;
    failedCount: number;
    refundedCount: number;
    pendingCount: number;
    recentFailedCount: number;
}

const RECENT_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const STATS_LIMIT = 2000;

/**
 * Aggregate payment stats for Super Admin (revenue, counts, failed alerts).
 */
export function usePaymentStats() {
    const [stats, setStats] = useState<PaymentStats>({
        totalRevenue: 0,
        successCount: 0,
        failedCount: 0,
        refundedCount: 0,
        pendingCount: 0,
        recentFailedCount: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            try {
                setLoading(true);
                const q = query(
                    collection(db, "payments"),
                    orderBy("createdAt", "desc"),
                    limit(STATS_LIMIT)
                );
                const snapshot = await getDocs(q);
                const now = Date.now();
                const recentCutoff = now - RECENT_DAYS_MS;

                let totalRevenue = 0;
                let successCount = 0;
                let failedCount = 0;
                let refundedCount = 0;
                let pendingCount = 0;
                let recentFailedCount = 0;

                snapshot.docs.forEach((d) => {
                    const p = d.data() as { status?: string; amount?: number; createdAt?: { toDate?: () => Date } };
                    const status = p.status ?? "";
                    const amount = Number(p.amount) || 0;
                    const createdMs = p.createdAt?.toDate?.()?.getTime() ?? 0;

                    if (status === "success") {
                        successCount++;
                        totalRevenue += amount;
                    } else if (status === "failed") {
                        failedCount++;
                        if (createdMs >= recentCutoff) recentFailedCount++;
                    } else if (status === "refunded") {
                        refundedCount++;
                    } else if (status === "pending") {
                        pendingCount++;
                    }
                });

                setStats({
                    totalRevenue,
                    successCount,
                    failedCount,
                    refundedCount,
                    pendingCount,
                    recentFailedCount,
                });
            } catch (err) {
                console.error("Failed to fetch payment stats:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, []);

    return { stats, loading };
}

// Verify manual payment
export function useVerifyPayment() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const verifyPayment = async (
        paymentId: string,
        reference: string,
        notes: string,
        adminId: string
    ) => {
        setLoading(true);
        setError(null);

        try {
            const paymentRef = doc(db, "payments", paymentId);

            await updateDoc(paymentRef, {
                status: "success",
                manualDetails: {
                    reference,
                    notes,
                    verifiedBy: adminId,
                    verifiedAt: serverTimestamp(),
                },
                updatedAt: serverTimestamp(),
            });

            return true;
        } catch (err) {
            console.error("Failed to verify payment:", err);
            setError("Failed to verify payment");
            return false;
        } finally {
            setLoading(false);
        }
    };

    return { verifyPayment, loading, error };
}
