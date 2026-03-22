/**
 * Cart for public ordering – item selection and customer details
 */

import { useState, useCallback, useMemo } from "react";
import type { InventoryItem } from "@/types/inventory";
import type { Shop } from "@/types/shop";
import { getDeliveryCharge } from "@/hooks/use-shop";

export interface PublicCartItem {
  id: string;
  service: InventoryItem;
  quantity: number;
  express: boolean;
  notes?: string;
  unitPrice: number;
  total: number;
}

export interface PublicDeliveryAddress {
  lat?: number;
  lng?: number;
  flatNumber?: string;
  landmark?: string;
  fullAddress?: string;
}

interface PublicCartState {
  items: PublicCartItem[];
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryCharge: number;
  pickupDate: string;
  pickupSlot: string;
  deliveryAddress: PublicDeliveryAddress | null;
  customerNotes: string;
  discountType?: "percent" | "flat";
  discountValue?: number;
}

const initialState: PublicCartState = {
  items: [],
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  deliveryCharge: 0,
  pickupDate: "",
  pickupSlot: "",
  deliveryAddress: null,
  customerNotes: "",
  discountType: undefined,
  discountValue: undefined,
};

export function usePublicCart(shop: Shop | null) {
  const [state, setState] = useState<PublicCartState>(initialState);

  const taxSettings = shop?.settings?.tax;

  const addItem = useCallback(
    (service: InventoryItem, quantity = 1, express = false, notes?: string) => {
      setState((prev) => {
        const existingIndex = prev.items.findIndex(
          (item) =>
            item.service.id === service.id && !item.express && !express
        );

        if (existingIndex >= 0 && !express) {
          const items = [...prev.items];
          items[existingIndex] = {
            ...items[existingIndex],
            quantity: items[existingIndex].quantity + quantity,
            total:
              (items[existingIndex].quantity + quantity) *
              items[existingIndex].unitPrice,
          };
          return { ...prev, items };
        }

        const mult = express ? service.expressMultiplier : 1;
        const unitPrice = service.basePrice * mult;
        const newItem: PublicCartItem = {
          id: `${service.id}-${Date.now()}`,
          service,
          quantity,
          express,
          notes,
          unitPrice,
          total: quantity * unitPrice,
        };
        return { ...prev, items: [...prev.items, newItem] };
      });
    },
    []
  );

  const updateItem = useCallback(
    (itemId: string, updates: Partial<PublicCartItem>) => {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) => {
          if (item.id !== itemId) return item;
          const updated = { ...item, ...updates };
          if (
            updates.quantity !== undefined ||
            updates.express !== undefined
          ) {
            const mult = updated.express
              ? updated.service.expressMultiplier
              : 1;
            updated.unitPrice = updated.service.basePrice * mult;
            updated.total = updated.quantity * updated.unitPrice;
          }
          return updated;
        }),
      }));
    },
    []
  );

  const removeItem = useCallback((itemId: string) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }));
  }, []);

  const setCustomer = useCallback(
    (name: string, phone: string, email: string) => {
      setState((prev) => ({
        ...prev,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
      }));
    },
    []
  );

  const setDeliveryCharge = useCallback((charge: number) => {
    setState((prev) => ({ ...prev, deliveryCharge: charge }));
  }, []);

  const setPickupSlot = useCallback((date: string, slot: string) => {
    setState((prev) => ({ ...prev, pickupDate: date, pickupSlot: slot }));
  }, []);

  const setDeliveryAddress = useCallback((addr: PublicDeliveryAddress | null) => {
    setState((prev) => ({ ...prev, deliveryAddress: addr }));
  }, []);

  const setDeliveryAddressMerge = useCallback(
    (partial: Partial<PublicDeliveryAddress>) => {
      setState((prev) => ({
        ...prev,
        deliveryAddress: prev.deliveryAddress
          ? { ...prev.deliveryAddress, ...partial }
          : Object.keys(partial).length ? (partial as PublicDeliveryAddress) : null,
      }));
    },
    []
  );

  const setCustomerNotes = useCallback((notes: string) => {
    setState((prev) => ({ ...prev, customerNotes: notes }));
  }, []);

  const setDiscount = useCallback((type?: "percent" | "flat", value?: number) => {
    setState((prev) => ({
      ...prev,
      discountType: type,
      discountValue: value,
    }));
  }, []);

  const clearCart = useCallback(() => {
    setState(initialState);
  }, []);

  const totals = useMemo(() => {
    const subtotal = state.items.reduce((sum, i) => sum + i.total, 0);

    let discountAmount = 0;
    if (state.discountType && state.discountValue) {
      if (state.discountType === "percent") {
        discountAmount = (subtotal * state.discountValue) / 100;
      } else {
        discountAmount = state.discountValue;
      }
    }
    const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);

    const isDelivery = state.deliveryAddress != null;
    const deliveryCharge = !isDelivery
      ? 0
      : getDeliveryCharge(shop?.settings?.delivery, subtotalAfterDiscount, "delivery_home");

    const taxableAmount = subtotalAfterDiscount;
    let taxAmount = 0;
    if (taxSettings?.enabled) {
      taxAmount = (taxableAmount * taxSettings.rate) / 100;
    }

    const total = subtotal - discountAmount + taxAmount + deliveryCharge;
    return {
      subtotal,
      discountAmount,
      discountType: state.discountType,
      discountValue: state.discountValue,
      taxAmount,
      taxRate: taxSettings?.rate,
      taxName: taxSettings?.name,
      deliveryCharge,
      total,
      itemCount: state.items.reduce((s, i) => s + i.quantity, 0),
    };
  }, [
    state.items,
    state.discountType,
    state.discountValue,
    state.deliveryAddress,
    shop?.settings?.delivery,
    taxSettings?.enabled,
    taxSettings?.rate,
    taxSettings?.name,
  ]);

  return {
    ...state,
    ...totals,
    addItem,
    updateItem,
    removeItem,
    setCustomer,
    setDeliveryCharge,
    setPickupSlot,
    setDeliveryAddress,
    setDeliveryAddressMerge,
    setCustomerNotes,
    setDiscount,
    clearCart,
  };
}
