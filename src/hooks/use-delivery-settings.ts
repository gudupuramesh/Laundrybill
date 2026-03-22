/**
 * Shop Settings Hook
 * 
 * Manages shop-level settings including:
 * - Service areas for delivery/pickup
 * - Time slots configuration
 * - Enable/disable toggles
 */

import { useState, useEffect, useCallback } from "react";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import type { DeliverySettings } from "@/types/shop";

const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
    enableServiceAreas: false,
    serviceAreas: [],
    enablePickupSlots: false,
    pickupTimeSlots: [
        { id: "slot1", value: "9:00 AM - 11:00 AM", isActive: true },
        { id: "slot2", value: "11:00 AM - 1:00 PM", isActive: true },
        { id: "slot3", value: "2:00 PM - 4:00 PM", isActive: true },
        { id: "slot4", value: "4:00 PM - 6:00 PM", isActive: true },
    ],
    enableDeliverySlots: false,
    deliveryTimeSlots: [
        { id: "slot1", value: "9:00 AM - 11:00 AM", isActive: true },
        { id: "slot2", value: "11:00 AM - 1:00 PM", isActive: true },
        { id: "slot3", value: "2:00 PM - 4:00 PM", isActive: true },
        { id: "slot4", value: "4:00 PM - 6:00 PM", isActive: true },
    ],
};

export function useDeliverySettings() {
    const { user } = useAuth();
    const shopId = user?.uid;

    const [settings, setSettings] = useState<DeliverySettings>(DEFAULT_DELIVERY_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Subscribe to settings updates
    useEffect(() => {
        if (!shopId) {
            setLoading(false);
            return;
        }

        const shopRef = doc(db, "shops", shopId);

        const unsubscribe = onSnapshot(shopRef, (snapshot) => {
            if (snapshot.exists()) {
                const shopData = snapshot.data();
                const deliverySettings = shopData.settings?.delivery;

                // Migrate legacy string arrays to objects if needed
                let mergedSettings = { ...DEFAULT_DELIVERY_SETTINGS };

                if (deliverySettings) {
                    mergedSettings = { ...mergedSettings, ...deliverySettings };

                    // Migration check: if serviceAreas contains strings (legacy)
                    if (Array.isArray(mergedSettings.serviceAreas) && typeof mergedSettings.serviceAreas[0] === 'string') {
                        mergedSettings.serviceAreas = (mergedSettings.serviceAreas as never as string[]).map(area => ({
                            id: crypto.randomUUID(),
                            value: area,
                            isActive: true
                        }));
                    }

                    // Migration check: pickupTimeSlots
                    if (Array.isArray(mergedSettings.pickupTimeSlots) && typeof mergedSettings.pickupTimeSlots[0] === 'string') {
                        mergedSettings.pickupTimeSlots = (mergedSettings.pickupTimeSlots as never as string[]).map(slot => ({
                            id: crypto.randomUUID(),
                            value: slot,
                            isActive: true
                        }));
                    }

                    // Migration check: deliveryTimeSlots
                    if (Array.isArray(mergedSettings.deliveryTimeSlots) && typeof mergedSettings.deliveryTimeSlots[0] === 'string') {
                        mergedSettings.deliveryTimeSlots = (mergedSettings.deliveryTimeSlots as never as string[]).map(slot => ({
                            id: crypto.randomUUID(),
                            value: slot,
                            isActive: true
                        }));
                    }
                }

                setSettings(mergedSettings);
            }
            setLoading(false);
        }, (err) => {
            console.error("Error loading delivery settings:", err);
            setError("Failed to load settings");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [shopId]);

    // Update delivery settings
    const updateSettings = useCallback(async (updates: Partial<DeliverySettings>) => {
        if (!shopId) return;

        setSaving(true);
        setError(null);

        try {
            const shopRef = doc(db, "shops", shopId);
            const newSettings = { ...settings, ...updates };

            await updateDoc(shopRef, {
                "settings.delivery": newSettings,
            });

            setSettings(newSettings);
        } catch (err) {
            console.error("Error updating delivery settings:", err);
            setError("Failed to save settings");
            throw err;
        } finally {
            setSaving(false);
        }
    }, [shopId, settings]);

    // Service Areas
    const addServiceArea = useCallback(async (areaValue: string) => {
        const trimmed = areaValue.trim();
        if (!trimmed || settings.serviceAreas.some(a => a.value.toLowerCase() === trimmed.toLowerCase())) return;

        const newArea = {
            id: crypto.randomUUID(),
            value: trimmed,
            isActive: true
        };

        await updateSettings({
            serviceAreas: [...settings.serviceAreas, newArea],
        });
    }, [settings.serviceAreas, updateSettings]);

    const removeServiceArea = useCallback(async (id: string) => {
        await updateSettings({
            serviceAreas: settings.serviceAreas.filter(a => a.id !== id),
        });
    }, [settings.serviceAreas, updateSettings]);

    const toggleServiceAreaItem = useCallback(async (id: string, isActive: boolean) => {
        await updateSettings({
            serviceAreas: settings.serviceAreas.map(a =>
                a.id === id ? { ...a, isActive } : a
            ),
        });
    }, [settings.serviceAreas, updateSettings]);

    const toggleServiceAreas = useCallback(async (enabled: boolean) => {
        await updateSettings({ enableServiceAreas: enabled });
    }, [updateSettings]);

    // Pickup Slots
    const addPickupSlot = useCallback(async (slotValue: string, capacity?: number) => {
        const trimmed = slotValue.trim();
        if (!trimmed || settings.pickupTimeSlots.some(s => s.value === trimmed)) return;

        const newSlot = {
            id: crypto.randomUUID(),
            value: trimmed,
            isActive: true,
            ...(capacity != null && capacity > 0 ? { capacity } : {}),
        };

        await updateSettings({
            pickupTimeSlots: [...settings.pickupTimeSlots, newSlot],
        });
    }, [settings.pickupTimeSlots, updateSettings]);

    const updatePickupSlotValue = useCallback(async (id: string, slotValue: string) => {
        const trimmed = slotValue.trim();
        if (!trimmed) return;
        await updateSettings({
            pickupTimeSlots: settings.pickupTimeSlots.map(s =>
                s.id === id ? { ...s, value: trimmed } : s
            ),
        });
    }, [settings.pickupTimeSlots, updateSettings]);

    const removePickupSlot = useCallback(async (id: string) => {
        await updateSettings({
            pickupTimeSlots: settings.pickupTimeSlots.filter(s => s.id !== id),
        });
    }, [settings.pickupTimeSlots, updateSettings]);

    const togglePickupSlotItem = useCallback(async (id: string, isActive: boolean) => {
        await updateSettings({
            pickupTimeSlots: settings.pickupTimeSlots.map(s =>
                s.id === id ? { ...s, isActive } : s
            ),
        });
    }, [settings.pickupTimeSlots, updateSettings]);

    const updatePickupSlotCapacity = useCallback(async (id: string, capacity: number | undefined) => {
        const value = capacity == null || capacity < 0 ? undefined : capacity === 0 ? undefined : capacity;
        await updateSettings({
            pickupTimeSlots: settings.pickupTimeSlots.map(s =>
                s.id === id ? { ...s, capacity: value } : s
            ),
        });
    }, [settings.pickupTimeSlots, updateSettings]);

    const togglePickupSlots = useCallback(async (enabled: boolean) => {
        await updateSettings({ enablePickupSlots: enabled });
    }, [updateSettings]);

    // Delivery Slots
    const addDeliverySlot = useCallback(async (slotValue: string, capacity?: number) => {
        const trimmed = slotValue.trim();
        if (!trimmed || settings.deliveryTimeSlots.some(s => s.value === trimmed)) return;

        const newSlot = {
            id: crypto.randomUUID(),
            value: trimmed,
            isActive: true,
            ...(capacity != null && capacity > 0 ? { capacity } : {}),
        };

        await updateSettings({
            deliveryTimeSlots: [...settings.deliveryTimeSlots, newSlot],
        });
    }, [settings.deliveryTimeSlots, updateSettings]);

    const updateDeliverySlotValue = useCallback(async (id: string, slotValue: string) => {
        const trimmed = slotValue.trim();
        if (!trimmed) return;
        await updateSettings({
            deliveryTimeSlots: settings.deliveryTimeSlots.map(s =>
                s.id === id ? { ...s, value: trimmed } : s
            ),
        });
    }, [settings.deliveryTimeSlots, updateSettings]);

    const removeDeliverySlot = useCallback(async (id: string) => {
        await updateSettings({
            deliveryTimeSlots: settings.deliveryTimeSlots.filter(s => s.id !== id),
        });
    }, [settings.deliveryTimeSlots, updateSettings]);

    const toggleDeliverySlotItem = useCallback(async (id: string, isActive: boolean) => {
        await updateSettings({
            deliveryTimeSlots: settings.deliveryTimeSlots.map(s =>
                s.id === id ? { ...s, isActive } : s
            ),
        });
    }, [settings.deliveryTimeSlots, updateSettings]);

    const updateDeliverySlotCapacity = useCallback(async (id: string, capacity: number | undefined) => {
        const value = capacity == null || capacity < 0 ? undefined : capacity === 0 ? undefined : capacity;
        await updateSettings({
            deliveryTimeSlots: settings.deliveryTimeSlots.map(s =>
                s.id === id ? { ...s, capacity: value } : s
            ),
        });
    }, [settings.deliveryTimeSlots, updateSettings]);

    const toggleDeliverySlots = useCallback(async (enabled: boolean) => {
        await updateSettings({ enableDeliverySlots: enabled });
    }, [updateSettings]);

    return {
        settings,
        loading,
        saving,
        error,

        // Service Areas
        addServiceArea,
        removeServiceArea,
        toggleServiceAreaItem,
        toggleServiceAreas,

        // Pickup Slots
        addPickupSlot,
        removePickupSlot,
        togglePickupSlotItem,
        updatePickupSlotCapacity,
        updatePickupSlotValue,
        togglePickupSlots,

        // Delivery Slots
        addDeliverySlot,
        removeDeliverySlot,
        toggleDeliverySlotItem,
        updateDeliverySlotCapacity,
        updateDeliverySlotValue,
        toggleDeliverySlots,

        // Generic update
        updateSettings,
    };
}


