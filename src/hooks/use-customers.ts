/**
 * Customers Hook
 * 
 * Fetch and manage customers from Firestore
 */

import { useState, useEffect, useCallback } from "react";
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    getDocs,
    getDoc,
    doc,
    addDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp,
    DocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import { toTitleCase, normalizePhone, normalizeEmail, isValidIndianPhone, isValidEmail } from "@/lib/utils";
import type { Customer } from "@/types/customer";

const PAGE_SIZE = 10;

export function useCustomers(searchQuery?: string) {
    const { shopId } = useAuth();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);

    // Initial load with real-time listener
    useEffect(() => {
        if (!shopId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const customersRef = collection(db, `shops/${shopId}/customers`);

        const q = query(
            customersRef,
            orderBy("name"),
            limit(PAGE_SIZE)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const docs = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Customer[];

                setCustomers(docs);
                setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
                setHasMore(snapshot.docs.length === PAGE_SIZE);
                setLoading(false);
            },
            (error) => {
                console.error("Error loading customers:", error);
                setLoading(false);
            }
        );

        return unsubscribe;
    }, [shopId]);

    // Filter locally by search query
    const filteredCustomers = searchQuery
        ? customers.filter((c) => {
            const q = searchQuery.toLowerCase();
            return (
                c.name.toLowerCase().includes(q) ||
                c.phone.includes(q) ||
                c.email?.toLowerCase().includes(q)
            );
        })
        : customers;

    // Load more (pagination)
    const loadMore = useCallback(async () => {
        if (!shopId || !lastDoc || !hasMore) return;

        const customersRef = collection(db, `shops/${shopId}/customers`);
        const q = query(
            customersRef,
            orderBy("name"),
            startAfter(lastDoc),
            limit(PAGE_SIZE)
        );

        const snapshot = await getDocs(q);
        const newDocs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as Customer[];

        setCustomers((prev) => [...prev, ...newDocs]);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
        setHasMore(snapshot.docs.length === PAGE_SIZE);
    }, [shopId, lastDoc, hasMore]);

    // Create customer with validation, normalization, and unique-phone check
    const createCustomer = useCallback(async (data: Partial<Customer>): Promise<Customer | null> => {
        if (!shopId) return null;

        // Validate phone
        if (!data.phone || !isValidIndianPhone(data.phone)) {
            console.error("Invalid phone number");
            return null;
        }

        // Validate email if provided
        if (data.email && !isValidEmail(data.email)) {
            console.error("Invalid email address");
            return null;
        }

        const normalized = normalizePhone(data.phone);

        try {
            const customersRef = collection(db, `shops/${shopId}/customers`);
            // Enforce unique phone per shop: do not allow same number for multiple customers
            const existingQ = query(customersRef, where("phone", "==", normalized));
            const existingSnap = await getDocs(existingQ);
            if (!existingSnap.empty) {
                throw new Error("DUPLICATE_PHONE");
            }

            const customerData = {
                name: toTitleCase(data.name || ""),
                phone: normalized,
                email: data.email ? normalizeEmail(data.email) : null,
                address: data.address ? toTitleCase(data.address) : null,
                notes: data.notes || null,
                totalOrders: 0,
                totalSpent: 0,
                isActive: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            const docRef = await addDoc(customersRef, customerData);
            return { id: docRef.id, ...customerData } as unknown as Customer;
        } catch (error) {
            if (error instanceof Error && error.message === "DUPLICATE_PHONE") throw error;
            console.error("Error creating customer:", error);
            return null;
        }
    }, [shopId]);

    // Update customer with validation, normalization, and unique-phone check
    const updateCustomer = useCallback(async (customerId: string, data: Partial<Customer>) => {
        if (!shopId) return;

        const customerRef = doc(db, `shops/${shopId}/customers/${customerId}`);
        const updateData: Record<string, unknown> = {
            updatedAt: serverTimestamp(),
        };

        // Normalize fields if provided
        if (data.name) {
            updateData.name = toTitleCase(data.name);
        }
        if (data.phone) {
            if (!isValidIndianPhone(data.phone)) {
                console.error("Invalid phone number");
                return;
            }
            const normalized = normalizePhone(data.phone);
            // Enforce unique phone: another customer (not this one) must not have this number
            const customersRef = collection(db, `shops/${shopId}/customers`);
            const existingQ = query(customersRef, where("phone", "==", normalized));
            const existingSnap = await getDocs(existingQ);
            const takenByOther = existingSnap.docs.some((d) => d.id !== customerId);
            if (takenByOther) {
                throw new Error("DUPLICATE_PHONE");
            }
            updateData.phone = normalized;
        }
        if (data.email !== undefined) {
            if (data.email && !isValidEmail(data.email)) {
                console.error("Invalid email address");
                return;
            }
            updateData.email = data.email ? normalizeEmail(data.email) : null;
        }
        if (data.address !== undefined) {
            updateData.address = data.address ? toTitleCase(data.address) : null;
        }
        if (data.notes !== undefined) {
            updateData.notes = data.notes || null;
        }

        await updateDoc(customerRef, updateData);
    }, [shopId]);

    // Add an address to a customer
    const addAddress = useCallback(async (
        customerId: string,
        address: string,
        label?: string,
        isDefault?: boolean
    ) => {
        if (!shopId || !customerId || !address) return;

        const customerRef = doc(db, `shops/${shopId}/customers/${customerId}`);
        const customerDoc = await getDoc(customerRef);

        if (!customerDoc.exists()) return;

        const customer = customerDoc.data() as Customer;
        const currentAddresses = customer.addresses || [];

        // Check if address already exists
        const normalizedAddress = address.toLowerCase().trim();
        const exists = currentAddresses.some(
            (a) => a.address.toLowerCase().trim() === normalizedAddress
        );

        if (exists) return; // Don't add duplicate

        const newAddress = {
            id: `addr-${Date.now()}`,
            label: label || (currentAddresses.length === 0 ? "Home" : `Address ${currentAddresses.length + 1}`),
            address: toTitleCase(address),
            isDefault: isDefault ?? currentAddresses.length === 0, // First address is default
        };

        // If new address is default, unset others
        let updatedAddresses = currentAddresses;
        if (newAddress.isDefault) {
            updatedAddresses = currentAddresses.map((a) => ({ ...a, isDefault: false }));
        }

        await updateDoc(customerRef, {
            addresses: [...updatedAddresses, newAddress],
            // Also update legacy address field if this is first address
            ...(currentAddresses.length === 0 && { address: newAddress.address }),
            updatedAt: serverTimestamp(),
        });
    }, [shopId]);

    return {
        customers: filteredCustomers,
        loading,
        hasMore,
        loadMore,
        createCustomer,
        updateCustomer,
        addAddress,
    };
}

// Single customer hook
export function useCustomer(customerId: string) {
    const { shopId } = useAuth();
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!shopId || !customerId) {
            setLoading(false);
            return;
        }

        const customerRef = doc(db, `shops/${shopId}/customers/${customerId}`);

        const unsubscribe = onSnapshot(
            customerRef,
            (doc) => {
                if (doc.exists()) {
                    setCustomer({ id: doc.id, ...doc.data() } as Customer);
                } else {
                    setCustomer(null);
                }
                setLoading(false);
            },
            (error) => {
                console.error("Error loading customer:", error);
                setLoading(false);
            }
        );

        return unsubscribe;
    }, [shopId, customerId]);

    return { customer, loading };
}

// Customer stats hook
export function useCustomerStats() {
    const { shopId } = useAuth();
    const [stats, setStats] = useState({
        totalCustomers: 0,
        newThisMonth: 0,
        activeCustomers: 0,
    });

    useEffect(() => {
        if (!shopId) return;

        const customersRef = collection(db, `shops/${shopId}/customers`);

        // Get start of current month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Get date 30 days ago for active customers
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const unsubscribe = onSnapshot(
            customersRef,
            (snapshot) => {
                const customers = snapshot.docs.map((d) => d.data() as Customer);

                const newThisMonth = customers.filter((c) => {
                    const created = c.createdAt?.toDate?.();
                    return created && created >= startOfMonth;
                }).length;

                const activeCustomers = customers.filter((c) => {
                    const lastOrder = c.lastOrderAt?.toDate?.();
                    return lastOrder && lastOrder >= thirtyDaysAgo;
                }).length;

                setStats({
                    totalCustomers: customers.length,
                    newThisMonth,
                    activeCustomers,
                });
            },
            (error) => {
                console.error("Error loading customer stats:", error);
            }
        );

        return unsubscribe;
    }, [shopId]);

    return stats;
}
