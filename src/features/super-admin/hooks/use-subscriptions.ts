/**
 * Subscriptions Hook
 * 
 * Manages subscription data for super admin
 */

import { useState, useEffect, useCallback } from "react";
import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    doc,
    updateDoc,
    serverTimestamp,
    Timestamp,
    deleteField,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Subscription, SubscriptionStatus } from "@/types/super-admin";
import type { PlanType } from "@/types/plans";
import { normalizePlanId } from "@/types/plans";

// Extended subscription with shop details for the list view
export interface SubscriptionWithShop extends Subscription {
    shopPhone?: string;
    shopJoinedAt?: Timestamp;
}

interface UseSubscriptionsOptions {
    statusFilter?: SubscriptionStatus | "all" | "expiring";
    planFilter?: PlanType | "all";
    searchTerm?: string;
}

export function useSubscriptions(options: UseSubscriptionsOptions = {}) {
    const { statusFilter = "all", planFilter = "all", searchTerm = "" } = options;

    const [subscriptions, setSubscriptions] = useState<SubscriptionWithShop[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSubscriptions = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            let q = query(
                collection(db, "subscriptions")
            );

            // Apply status filter
            if (statusFilter !== "all" && statusFilter !== "expiring") {
                q = query(
                    collection(db, "subscriptions"),
                    where("status", "==", statusFilter)
                );
            }

            const snapshot = await getDocs(q);
            let results: SubscriptionWithShop[] = snapshot.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            } as SubscriptionWithShop));
            results = results.map((sub) => ({
                ...sub,
                provider:
                    sub.provider ||
                    ((sub as any).razorpayPaymentId || (sub as any).razorpaySubscriptionId
                        ? "razorpay"
                        : undefined),
                providerRef:
                    sub.providerRef ||
                    (sub as any).razorpaySubscriptionId ||
                    (sub as any).razorpayPaymentId,
                providerOrderId:
                    sub.providerOrderId ||
                    (sub as any).razorpayOrderId,
            }));

            // Enrich with shop data: fetch each shop doc to get shopName, phone, email, joinedAt.
            // This handles existing subscriptions that were created before shopName/ownerEmail/ownerPhone
            // were added to the subscription document, and provides joinedAt (shop.createdAt).
            const enrichPromises = results.map(async (sub) => {
                const shopId = sub.shopId || sub.id;
                try {
                    const shopSnap = await getDoc(doc(db, "shops", shopId));
                    if (shopSnap.exists()) {
                        const shopData = shopSnap.data();
                        // Fill missing fields from shop document
                        if (!sub.shopName) sub.shopName = shopData.name || "";
                        if (!sub.ownerEmail) sub.ownerEmail = shopData.email || "";
                        if (!sub.ownerPhone) sub.ownerPhone = shopData.phone || "";
                        // Always use shop phone as the most up-to-date source
                        sub.shopPhone = shopData.phone || "";
                        // Shop creation date for "Joined on"
                        sub.shopJoinedAt = shopData.createdAt || null;
                    }
                } catch {
                    // Ignore per-shop fetch errors
                }
                return sub;
            });
            results = await Promise.all(enrichPromises);

            // Sort client-side to avoid index requirement
            results.sort((a, b) => {
                const dateA = a.endDate?.toDate?.()?.getTime() || 0;
                const dateB = b.endDate?.toDate?.()?.getTime() || 0;
                return dateA - dateB;
            });

            // Filter expiring (next 7 days)
            if (statusFilter === "expiring") {
                const sevenDaysFromNow = new Date();
                sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
                results = results.filter((sub) => {
                    const endDate = sub.endDate?.toDate?.();
                    return endDate && endDate <= sevenDaysFromNow && sub.status === "active";
                });
            }

            // Client-side plan filter (legacy pro_plus/business count as pro)
            if (planFilter !== "all") {
                results = results.filter((sub) => normalizePlanId(sub.planId) === planFilter);
            }

            // Client-side search (also search by phone)
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                results = results.filter(
                    (sub) =>
                        sub.shopName?.toLowerCase().includes(term) ||
                        sub.ownerEmail?.toLowerCase().includes(term) ||
                        sub.shopPhone?.includes(term) ||
                        sub.ownerPhone?.includes(term)
                );
            }

            setSubscriptions(results);
        } catch (err) {
            console.error("Failed to fetch subscriptions:", err);
            setError("Failed to load subscriptions");
        } finally {
            setLoading(false);
        }
    }, [statusFilter, planFilter, searchTerm]);

    useEffect(() => {
        fetchSubscriptions();
    }, [fetchSubscriptions]);

    return {
        subscriptions,
        loading,
        error,
        refetch: fetchSubscriptions,
    };
}

// Plan override mutation
export function useOverridePlan() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const overridePlan = async (
        subscriptionId: string,
        newPlanId: PlanType,
        newEndDate: Date,
        reason: string,
        adminId: string,
        targetShopId?: string // Optional but recommended
    ) => {
        setLoading(true);
        setError(null);

        try {
            const subRef = doc(db, "subscriptions", subscriptionId);

            // If targetShopId provided, use it. Otherwise try to find it.
            let shopId = targetShopId;
            let subData: any = {};

            if (!shopId) {
                const subSnap = await getDoc(subRef);
                if (subSnap.exists()) {
                    subData = subSnap.data();
                    shopId = subData.shopId || subscriptionId;
                } else {
                    shopId = subscriptionId; // Fallback
                }
            }

            if (!shopId) throw new Error("Could not determine Shop ID");

            const shopRef = doc(db, "shops", shopId);

            // 1. Update Subscription
            await updateDoc(subRef, {
                shopId: shopId, // Repair/Ensure link
                planId: newPlanId,
                endDate: Timestamp.fromDate(newEndDate),
                status: "active",
                manualOverride: {
                    reason,
                    overriddenBy: adminId,
                    overriddenAt: serverTimestamp(),
                    originalEndDate: subData?.endDate || serverTimestamp(),
                },
                updatedAt: serverTimestamp(),
            });

            // 2. Update Shop Profile (Critical for User Access)
            await updateDoc(shopRef, {
                plan: newPlanId, // ROOT LEVEL for admin list
                subscriptionStatus: "active", // ROOT LEVEL
                "subscription.planId": newPlanId,
                "subscription.status": "active",
                "subscription.endDate": Timestamp.fromDate(newEndDate),
                updatedAt: serverTimestamp()
            });

            // 3. Verification Step (Nuclear Option)
            const verifySnap = await getDoc(shopRef);
            const verifyData = verifySnap.data();
            if (verifyData?.plan !== newPlanId) {
                console.error("CRITICAL: Shop Plan update failed verification!", verifyData);
                throw new Error(`Verification Failed: Shop plan is still ${verifyData?.plan}`);
            }

            console.log(`NUCLEAR UPDATE SUCCESS: Shop ${shopId} is now ${newPlanId}`);

            return { success: true, shopId };
        } catch (err) {
            console.error("Failed to override plan:", err);
            setError("Failed to update subscription");
            return { success: false, error: err };
        } finally {
            setLoading(false);
        }
    };

    return { overridePlan, loading, error };
}

// Create subscription for Free plan shops
export function useCreateSubscription() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createSubscription = async (
        shopId: string,
        shopName: string,
        ownerEmail: string,
        planId: PlanType,
        endDate: Date,
        reason: string,
        adminId: string
    ) => {
        setLoading(true);
        setError(null);

        try {
            const { setDoc, updateDoc } = await import("firebase/firestore");
            const subRef = doc(db, "subscriptions", shopId);
            const shopRef = doc(db, "shops", shopId);

            // 1. Create Subscription
            await setDoc(subRef, {
                shopId,
                shopName,
                ownerEmail,
                planId,
                status: "active",
                billingCycle: "monthly",
                startDate: serverTimestamp(),
                endDate: Timestamp.fromDate(endDate),
                manualOverride: {
                    reason,
                    overriddenBy: adminId,
                    overriddenAt: serverTimestamp(),
                },
                usage: {
                    ordersThisMonth: 0,
                    totalCustomers: 0,
                    totalStaff: 0,
                    totalServices: 0,
                },
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            // 2. Update Shop Profile
            await updateDoc(shopRef, {
                plan: planId, // ROOT LEVEL
                subscriptionStatus: "active", // ROOT LEVEL
                subscription: {
                    planId,
                    status: "active",
                    startDate: serverTimestamp(),
                    endDate: Timestamp.fromDate(endDate),
                },
                updatedAt: serverTimestamp()
            });

            return true;
        } catch (err) {
            console.error("Failed to create subscription:", err);
            setError("Failed to create subscription");
            return false;
        } finally {
            setLoading(false);
        }
    };

    return { createSubscription, loading, error };
}

/**
 * Super Admin: set a shop’s subscription to canonical Free (clears trial / pending downgrade / legacy plan ids).
 * Matches the shape used when a trial expires (see checkTrialExpiry in Cloud Functions).
 */
export function useMoveSubscriptionToFree() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const moveToFree = async (
        subscriptionDocId: string,
        targetShopId: string | undefined,
        reason: string,
        adminId: string
    ) => {
        setLoading(true);
        setError(null);

        try {
            const subRef = doc(db, "subscriptions", subscriptionDocId);
            const subSnap = await getDoc(subRef);
            if (!subSnap.exists()) {
                throw new Error("Subscription document not found");
            }
            const subData = subSnap.data();
            const shopId = targetShopId || subData?.shopId || subscriptionDocId;
            const shopRef = doc(db, "shops", shopId);

            const reasonText = reason.trim() || "Super admin: moved subscription to Free plan";

            await updateDoc(subRef, {
                planId: "free",
                planName: "Free",
                status: "free",
                endDate: null,
                currentPeriodEnd: null,
                currentPeriodStart: null,
                trialEndDate: deleteField(),
                pendingDowngrade: deleteField(),
                activeUntil: deleteField(),
                graceEndDate: deleteField(),
                lastTrialReminderSent: deleteField(),
                manualOverride: {
                    reason: reasonText,
                    overriddenBy: adminId,
                    overriddenAt: serverTimestamp(),
                    originalEndDate: subData?.endDate || serverTimestamp(),
                },
                updatedAt: serverTimestamp(),
            });

            await updateDoc(shopRef, {
                plan: "free",
                subscriptionStatus: "free",
                "subscription.planId": "free",
                "subscription.status": "free",
                "subscription.endDate": null,
                updatedAt: serverTimestamp(),
            });

            return { success: true as const, shopId };
        } catch (err) {
            console.error("moveToFree failed:", err);
            setError("Failed to move to Free plan");
            return { success: false as const, error: err };
        } finally {
            setLoading(false);
        }
    };

    return { moveToFree, loading, error };
}
