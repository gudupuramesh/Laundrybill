/**
 * Cart Hook
 * 
 * Shopping cart state management for POS
 */

import { useState, useCallback, useMemo } from "react";
import type { InventoryItem } from "@/types/inventory";
import type { DeliveryType } from "@/types/order";
import type { CustomerAddress } from "@/types/customer";
import type { ShopTaxSettings } from "@/types/shop";
import { useShop, getDeliveryCharge } from "@/hooks/use-shop";
import { useCartShopOverride } from "@/features/pos/CartShopOverrideContext";
import { Timestamp } from "firebase/firestore";
import { useEffect } from "react";

export interface CartItem {
    id: string;
    service: InventoryItem;
    quantity: number;
    express: boolean;
    notes?: string;
    damages?: { description: string; photoUrl: string }[];
    unitPrice: number;
    total: number;
}

interface CartState {
    items: CartItem[];
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    customerAddresses?: CustomerAddress[]; // Customer's saved addresses
    isGuest: boolean;
    discountType?: "percent" | "flat";
    discountValue?: number;
    deliveryType: DeliveryType;
    deliveryAddress?: string;
    deliveryNotes?: string;
    deliveryCharge: number;
    expectedDays: number;
    taxSettings?: ShopTaxSettings;
    taxEnabled: boolean;
    /** When true, delivery fee is waived for this order (POS only) */
    deliveryFeeWaived: boolean;
}

const initialState: CartState = {
    items: [],
    isGuest: false,
    deliveryType: "pickup_store",
    deliveryCharge: 0,
    expectedDays: 2,
    taxEnabled: true,
    deliveryFeeWaived: false,
};

export function useCart(persistKey?: string) {
    const { shop: authShop } = useShop();
    const overrideShop = useCartShopOverride();
    const shop = overrideShop ?? authShop;
    const [state, setState] = useState<CartState>(() => {
        if (persistKey) {
            try {
                const saved = sessionStorage.getItem(persistKey);
                if (saved) return { ...initialState, ...JSON.parse(saved) };
            } catch { /* ignore corrupt draft */ }
        }
        return initialState;
    });

    // Persist the cart draft so it survives navigating to other screens and back.
    // Cleared on order placement (clearCart). sessionStorage = lives for the tab session.
    useEffect(() => {
        if (!persistKey) return;
        try { sessionStorage.setItem(persistKey, JSON.stringify(state)); } catch { /* quota/serialize */ }
    }, [persistKey, state]);

    // Auto-apply delivery charge from settings (min-order rule) for delivery_home / pickup_home.
    // When shop is null (e.g. agent app), do not overwrite – preserve order's deliveryCharge.
    useEffect(() => {
        if (state.deliveryType === "pickup_store") {
            setState((prev) => (prev.deliveryCharge !== 0 || prev.deliveryFeeWaived
                ? { ...prev, deliveryCharge: 0, deliveryFeeWaived: false }
                : prev));
            return;
        }
        if (!shop?.settings?.delivery) return; // Agent app may have no shop; keep existing charge
        const subtotal = state.items.reduce((sum, i) => sum + i.total, 0);
        let discountAmount = 0;
        if (state.discountType && state.discountValue) {
            discountAmount = state.discountType === "percent"
                ? (subtotal * state.discountValue) / 100
                : state.discountValue;
        }
        const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);
        const suggested = getDeliveryCharge(
            shop.settings.delivery,
            subtotalAfterDiscount,
            state.deliveryType
        );
        // Agent editing an order: preserve existing delivery charge (e.g. ₹50 for quick order)
        // when shop recalc would zero it (e.g. deliveryFeeEnabled false or legacy defaultCharge 0).
        if (
            overrideShop &&
            state.deliveryCharge > 0 &&
            suggested === 0 &&
            (state.deliveryType === "pickup_home" || state.deliveryType === "delivery_home")
        ) {
            return;
        }
        const charge = state.deliveryFeeWaived ? 0 : suggested;
        setState((prev) => (prev.deliveryCharge !== charge ? { ...prev, deliveryCharge: charge } : prev));
    }, [
        state.deliveryType,
        state.deliveryCharge,
        state.items,
        state.discountType,
        state.discountValue,
        state.deliveryFeeWaived,
        shop?.settings?.delivery,
        overrideShop,
    ]);

    const addItem = useCallback((service: InventoryItem, quantity: number = 1, express: boolean = false, notes?: string) => {
        setState((prev) => {
            // Combine with an existing line of the SAME item AND same express mode.
            // (Express and normal stay as separate lines — they're priced differently —
            //  but adding the same express item again increments its quantity.)
            const existingIndex = prev.items.findIndex(
                (item) => item.service.id === service.id && item.express === express
            );

            if (existingIndex >= 0) {
                const items = [...prev.items];
                const existing = items[existingIndex];
                const newQty = existing.quantity + quantity;
                items[existingIndex] = {
                    ...existing,
                    quantity: newQty,
                    total: newQty * existing.unitPrice,
                };
                return { ...prev, items };
            }

            const expressMultiplier = express ? service.expressMultiplier : 1;
            const unitPrice = service.basePrice * expressMultiplier;
            const newItem: CartItem = {
                id: `${service.id}-${express ? "x" : "n"}-${Date.now()}`,
                service,
                quantity,
                express,
                notes,
                unitPrice,
                total: quantity * unitPrice,
            };

            return { ...prev, items: [...prev.items, newItem] };
        });
    }, []);

    const updateItem = useCallback((itemId: string, updates: Partial<CartItem>) => {
        setState((prev) => ({
            ...prev,
            items: prev.items.map((item) => {
                if (item.id !== itemId) return item;

                const updated = { ...item, ...updates };

                // Recalculate total if quantity or express changed
                if (updates.quantity !== undefined || updates.express !== undefined) {
                    const expressMultiplier = updated.express ? updated.service.expressMultiplier : 1;
                    updated.unitPrice = updated.service.basePrice * expressMultiplier;
                    updated.total = updated.quantity * updated.unitPrice;
                }

                return updated;
            }),
        }));
    }, []);

    const removeItem = useCallback((itemId: string) => {
        setState((prev) => ({
            ...prev,
            items: prev.items.filter((item) => item.id !== itemId),
        }));
    }, []);

    const setCustomer = useCallback((
        customerId: string | undefined,
        customerName: string | undefined,
        customerPhone: string | undefined,
        isGuest: boolean = false,
        addresses?: CustomerAddress[]
    ) => {
        // Find default address or first address
        const defaultAddress = addresses?.find((a) => a.isDefault) || addresses?.[0];

        setState((prev) => ({
            ...prev,
            customerId,
            customerName,
            customerPhone,
            customerAddresses: addresses,
            isGuest,
            // Auto-fill delivery address from customer's saved address
            deliveryAddress: defaultAddress?.address || prev.deliveryAddress,
        }));
    }, []);

    const setDiscount = useCallback((type?: "percent" | "flat", value?: number) => {
        setState((prev) => ({
            ...prev,
            discountType: type,
            discountValue: value,
        }));
    }, []);

    const setDelivery = useCallback((
        type: DeliveryType,
        address?: string,
        notes?: string,
        charge?: number
    ) => {
        setState((prev) => {
            const next: Partial<CartState> = {
                ...prev,
                deliveryType: type,
            };
            if (address !== undefined) {
                next.deliveryAddress = address;
            } else if ((type === "delivery_home" || type === "pickup_home") && !prev.deliveryAddress?.trim() && prev.customerAddresses?.length) {
                // Auto-fill delivery address from customer's saved address when switching to Home Delivery / Pickup & Home
                const defaultAddr = prev.customerAddresses.find((a) => a.isDefault) || prev.customerAddresses[0];
                if (defaultAddr?.address) next.deliveryAddress = defaultAddr.address;
            }
            if (notes !== undefined) next.deliveryNotes = notes;
            if (type === "pickup_store") {
                next.deliveryCharge = 0;
                next.deliveryFeeWaived = false;
            } else if (charge !== undefined) {
                next.deliveryCharge = charge;
            }
            return next as CartState;
        });
    }, []);

    const setTaxSettings = useCallback((settings?: ShopTaxSettings) => {
        setState((prev) => ({
            ...prev,
            taxSettings: settings,
            // Auto-enable tax if shop has it enabled, otherwise disable
            taxEnabled: settings?.enabled ?? false,
        }));
    }, []);

    const toggleTax = useCallback(() => {
        setState((prev) => ({
            ...prev,
            taxEnabled: !prev.taxEnabled,
        }));
    }, []);

    const setDeliveryFeeWaived = useCallback((waived: boolean) => {
        setState((prev) => {
            if (waived) {
                return { ...prev, deliveryFeeWaived: true, deliveryCharge: 0 };
            }
            const subtotal = prev.items.reduce((s, i) => s + i.total, 0);
            let discountAmount = 0;
            if (prev.discountType && prev.discountValue) {
                discountAmount = prev.discountType === "percent"
                    ? (subtotal * prev.discountValue) / 100
                    : prev.discountValue;
            }
            const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);
            const charge = getDeliveryCharge(
                shop?.settings?.delivery,
                subtotalAfterDiscount,
                prev.deliveryType
            );
            return { ...prev, deliveryFeeWaived: false, deliveryCharge: charge };
        });
    }, [shop?.settings?.delivery]);

    // Load edit order items into cart
    const loadEditOrder = useCallback((orderItems: {
        serviceId: string;
        serviceName: string;
        categoryId: string;
        categoryName: string;
        quantity: number;
        unitPrice: number;
        unit?: string;
        express?: boolean;
        notes?: string;
    }[], inventoryItems: InventoryItem[]) => {
        setState((prev) => {
            const newItems: CartItem[] = orderItems.map((orderItem, index) => {
                // Try to find matching inventory item
                const matchedService = inventoryItems.find(inv => inv.id === orderItem.serviceId);

                // Create service object (use matched or create from order data)
                const service: InventoryItem = matchedService || {
                    id: orderItem.serviceId,
                    categoryId: orderItem.categoryId,
                    categoryName: orderItem.categoryName,
                    name: orderItem.serviceName,
                    basePrice: orderItem.unitPrice,
                    pricingType: (orderItem.unit as InventoryItem["pricingType"]) || "piece",
                    expressMultiplier: 1.5,
                    turnaroundDays: 2,
                    order: index,
                    isActive: true,
                    createdAt: new Date() as unknown as Timestamp,
                    updatedAt: new Date() as unknown as Timestamp,
                };

                return {
                    id: `${orderItem.serviceId}-edit-${index}`,
                    service,
                    quantity: orderItem.quantity,
                    express: orderItem.express || false,
                    notes: orderItem.notes,
                    unitPrice: orderItem.unitPrice,
                    total: orderItem.quantity * orderItem.unitPrice,
                };
            });

            return { ...prev, items: newItems };
        });
    }, []);

    const clearCart = useCallback(() => {
        setState(initialState);
        if (persistKey) { try { sessionStorage.removeItem(persistKey); } catch { /* ignore */ } }
    }, [persistKey]);

    // Calculate totals
    const totals = useMemo(() => {
        const subtotal = state.items.reduce((sum, item) => sum + item.total, 0);
        const expressCharge = state.items
            .filter((item) => item.express)
            .reduce((sum, item) => sum + (item.total - item.quantity * item.service.basePrice), 0);

        let discountAmount = 0;
        if (state.discountType && state.discountValue) {
            if (state.discountType === "percent") {
                discountAmount = (subtotal * state.discountValue) / 100;
            } else {
                discountAmount = state.discountValue;
            }
        }



        const taxableAmount = Math.max(0, subtotal - discountAmount);
        let taxAmount = 0;

        // Use cart's taxEnabled state instead of just settings.enabled
        if (state.taxSettings?.enabled && state.taxEnabled) {
            taxAmount = (taxableAmount * state.taxSettings.rate) / 100;
        }

        const total = subtotal - discountAmount + taxAmount + state.deliveryCharge;

        // Calculate expected delivery
        const maxTurnaround = Math.max(
            ...state.items.map((item) =>
                item.express ? 1 : item.service.turnaroundDays
            ),
            1
        );

        return {
            subtotal,
            expressCharge,
            discountAmount,
            deliveryCharge: state.deliveryCharge,
            taxAmount,
            taxRate: state.taxSettings?.rate,
            taxName: state.taxSettings?.name,
            total,
            itemCount: state.items.reduce((sum, item) => sum + item.quantity, 0),
            expectedDays: maxTurnaround,
        };
    }, [state.items, state.discountType, state.discountValue, state.deliveryCharge, state.taxSettings, state.taxEnabled]);

    return {
        ...state,
        ...totals,
        addItem,
        updateItem,
        removeItem,
        setCustomer,
        setDiscount,
        setDelivery,
        setTaxSettings,
        toggleTax,
        setDeliveryFeeWaived,
        loadEditOrder,
        clearCart,
    };
}
