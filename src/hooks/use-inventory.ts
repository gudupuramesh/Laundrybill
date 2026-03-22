/**
 * Inventory Hook
 * 
 * Fetch and manage categories and items from Firebase
 */

import { useState, useEffect, useCallback } from "react";
import {
    collection,
    query,
    orderBy,
    getDocs,
    doc,
    addDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp,
    writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toTitleCase } from "@/lib/utils";
import { useAuth } from "@/features/auth/AuthContext";
import type { InventoryCategory, InventoryItem } from "@/types/inventory";

/** Pass shopIdOverride when outside main auth (e.g. driver app). */
export function useInventory(options?: { shopIdOverride?: string | null }) {
    const { shopId: authShopId } = useAuth();
    const shopId = options?.shopIdOverride !== undefined ? options.shopIdOverride : authShopId;
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [categories, setCategories] = useState<InventoryCategory[]>([]);
    const [loading, setLoading] = useState(true);

    // Load categories and items with real-time listeners
    useEffect(() => {
        if (!shopId) {
            setLoading(false);
            return;
        }

        setLoading(true);

        const categoriesRef = collection(db, `shops/${shopId}/categories`);
        const itemsRef = collection(db, `shops/${shopId}/inventory`);

        // Listen to categories
        const unsubCategories = onSnapshot(
            query(categoriesRef, orderBy("order")),
            (snapshot) => {
                const docs = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as InventoryCategory[];
                setCategories(docs);
            },
            (error) => {
                console.error("Error loading categories:", error);
            }
        );

        // Listen to items
        const unsubItems = onSnapshot(
            query(itemsRef, orderBy("order")),
            (snapshot) => {
                const docs = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as InventoryItem[];
                setItems(docs);
                setLoading(false);
            },
            (error) => {
                console.error("Error loading items:", error);
                setLoading(false);
            }
        );

        return () => {
            unsubCategories();
            unsubItems();
        };
    }, [shopId]);

    // Get items by category
    const getItemsByCategory = useCallback(
        (categoryId: string) => {
            return items.filter((item) => item.categoryId === categoryId && item.isActive);
        },
        [items]
    );

    // Get active items only (item must be active AND its category must be active)
    const activeCategories = categories.filter((cat) => cat.isActive);
    const activeCategoryIds = new Set(activeCategories.map((cat) => cat.id));
    const activeItems = items.filter(
        (item) => item.isActive && activeCategoryIds.has(item.categoryId)
    );

    return {
        items: activeItems,
        allItems: items,
        categories: activeCategories,
        allCategories: categories,
        loading,
        getItemsByCategory,
    };
}

// Inventory mutations (admin only)
export function useInventoryMutations() {
    const { shopId } = useAuth();

    // Category CRUD
    const createCategory = async (data: Partial<InventoryCategory>) => {
        if (!shopId) return null;

        const categoriesRef = collection(db, `shops/${shopId}/categories`);

        // Get max order
        const snapshot = await getDocs(categoriesRef);
        const maxOrder = snapshot.docs.reduce((max, doc) => {
            const order = doc.data().order || 0;
            return order > max ? order : max;
        }, 0);

        const categoryData = {
            name: toTitleCase(data.name || ""),
            icon: data.icon || "",
            order: maxOrder + 1,
            turnaroundDays: data.turnaroundDays || 2,
            isActive: data.isActive !== undefined ? data.isActive : true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        const docRef = await addDoc(categoriesRef, categoryData);
        return { id: docRef.id, ...categoryData };
    };

    const updateCategory = async (categoryId: string, data: Partial<InventoryCategory>) => {
        if (!shopId) return;
        const categoryRef = doc(db, `shops/${shopId}/categories/${categoryId}`);
        const updateData = {
            ...data,
            updatedAt: serverTimestamp(),
        };
        // Normalize name if provided
        if (data.name) {
            updateData.name = toTitleCase(data.name);
        }
        await updateDoc(categoryRef, updateData);
    };

    const deleteCategory = async (categoryId: string) => {
        if (!shopId) return;
        const categoryRef = doc(db, `shops/${shopId}/categories/${categoryId}`);
        // Soft delete - just mark as inactive
        await updateDoc(categoryRef, { isActive: false, updatedAt: serverTimestamp() });
    };

    // Item CRUD
    const createItem = async (data: Partial<InventoryItem>) => {
        if (!shopId) return null;

        const itemsRef = collection(db, `shops/${shopId}/inventory`);

        // Get max order for this category
        const snapshot = await getDocs(itemsRef);
        const maxOrder = snapshot.docs
            .filter((d) => d.data().categoryId === data.categoryId)
            .reduce((max, doc) => {
                const order = doc.data().order || 0;
                return order > max ? order : max;
            }, 0);

        const itemData: Record<string, unknown> = {
            categoryId: data.categoryId || "",
            categoryName: toTitleCase(data.categoryName || ""),
            name: toTitleCase(data.name || ""),
            description: data.description || "",
            basePrice: data.basePrice || 0,
            pricingType: data.pricingType || "piece",
            expressMultiplier: data.expressMultiplier || 1.5,
            turnaroundDays: data.turnaroundDays || 2,
            order: maxOrder + 1,
            isActive: data.isActive !== undefined ? data.isActive : true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        // Add optional imageUrl if provided
        if (data.imageUrl) {
            itemData.imageUrl = data.imageUrl;
        }
        if (data.imageKey) {
            itemData.imageKey = data.imageKey;
        }
        if (data.imageBytes) {
            itemData.imageBytes = data.imageBytes;
        }

        const docRef = await addDoc(itemsRef, itemData);
        return { id: docRef.id, ...itemData };
    };

    const updateItem = async (itemId: string, data: Partial<InventoryItem>) => {
        if (!shopId) return;
        const itemRef = doc(db, `shops/${shopId}/inventory/${itemId}`);
        const updateData: Record<string, unknown> = {
            updatedAt: serverTimestamp(),
        };

        // Copy all fields except timestamps
        if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.basePrice !== undefined) updateData.basePrice = data.basePrice;
        if (data.pricingType !== undefined) updateData.pricingType = data.pricingType;
        if (data.expressMultiplier !== undefined) updateData.expressMultiplier = data.expressMultiplier;
        if (data.turnaroundDays !== undefined) updateData.turnaroundDays = data.turnaroundDays;
        if (data.order !== undefined) updateData.order = data.order;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;
        if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
        if (data.imageKey !== undefined) updateData.imageKey = data.imageKey;
        if (data.imageBytes !== undefined) updateData.imageBytes = data.imageBytes;

        // Normalize names if provided
        if (data.name) {
            updateData.name = toTitleCase(data.name);
        }
        if (data.categoryName) {
            updateData.categoryName = toTitleCase(data.categoryName);
        }

        await updateDoc(itemRef, updateData);
    };

    const deleteItem = async (itemId: string) => {
        if (!shopId) return;
        const itemRef = doc(db, `shops/${shopId}/inventory/${itemId}`);
        // Soft delete
        await updateDoc(itemRef, { isActive: false, updatedAt: serverTimestamp() });
    };

    // Reorder items
    const reorderItems = async (items: { id: string; order: number }[]) => {
        if (!shopId) return;

        const batch = writeBatch(db);
        items.forEach(({ id, order }) => {
            const ref = doc(db, `shops/${shopId}/inventory/${id}`);
            batch.update(ref, { order });
        });
        await batch.commit();
    };

    return {
        createCategory,
        updateCategory,
        deleteCategory,
        createItem,
        updateItem,
        deleteItem,
        reorderItems,
    };
}
