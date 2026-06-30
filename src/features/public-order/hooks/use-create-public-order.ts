/**
 * Create Public Order – calls Cloud Function (no auth required)
 */

import { useState, useCallback } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { PublicCartItem, PublicDeliveryAddress } from "./use-public-cart";
import type { Shop } from "@/types/shop";

interface CreatePublicOrderPayload {
  shopId: string;
  shopSlug: string;
  deliveryArea: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  items: {
    serviceId: string;
    serviceName: string;
    categoryId?: string;
    categoryName?: string;
    quantity: number;
    unitPrice: number;
    total: number;
    unit?: string;
    express?: boolean;
    notes?: string;
  }[];
  financials: {
    subtotal: number;
    discountType?: "percent" | "flat";
    discountValue?: number;
    discountAmount?: number;
    taxAmount: number;
    taxRate?: number;
    taxName?: string;
    deliveryCharge: number;
    total: number;
  };
  deliveryType?: "pickup_home" | "delivery_home";
  pickupDate: string;
  pickupSlot: string;
  deliveryAddress: PublicDeliveryAddress;
  customerNotes?: string;
  isQuickOrder: boolean;
  deliveryBandId?: string;
  estimatedWeight?: string;
  estimatedPieces?: string;
  requestedServices?: string[];
}

interface CreatePublicOrderResult {
  orderId: string;
  publicId: string;
  shopId: string;
}

export function useCreatePublicOrder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createOrder = useCallback(
    async (
      shop: Shop,
      input: {
        deliveryArea: string;
        customerName: string;
        customerPhone: string;
        customerEmail?: string;
        items: PublicCartItem[];
        subtotal: number;
        discountType?: "percent" | "flat";
        discountValue?: number;
        discountAmount?: number;
        taxAmount: number;
        taxRate?: number;
        taxName?: string;
        deliveryCharge: number;
        total: number;
        pickupDate: string;
        pickupSlot: string;
        deliveryAddress: PublicDeliveryAddress;
        customerNotes?: string;
        isQuickOrder: boolean;
        deliveryBandId?: string;
        estimatedWeight?: string;
        estimatedPieces?: string;
        requestedServices?: string[];
      }
    ): Promise<CreatePublicOrderResult | null> => {
      const slug = shop.publicOrdering?.slug || "";
      if (!slug) {
        setError("Public ordering not configured");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const fn = httpsCallable<CreatePublicOrderPayload, CreatePublicOrderResult>(
          functions,
          "createPublicOrder"
        );

        const payload: CreatePublicOrderPayload = {
          shopId: shop.id,
          shopSlug: slug,
          deliveryArea: input.deliveryArea,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          customerEmail: input.customerEmail,
          items: input.items.map((i) => ({
            serviceId: i.service.id,
            serviceName: i.service.name,
            categoryId: i.service.categoryId,
            categoryName: i.service.categoryName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.total,
            unit: i.service.pricingType || "piece",
            express: i.express,
            notes: i.notes,
          })),
          financials: {
            subtotal: input.subtotal,
            discountType: input.discountType,
            discountValue: input.discountValue,
            discountAmount: input.discountAmount,
            taxAmount: input.taxAmount,
            taxRate: input.taxRate,
            taxName: input.taxName,
            deliveryCharge: input.deliveryCharge,
            total: input.total,
          },
          deliveryType: "pickup_home",
          pickupDate: input.pickupDate,
          pickupSlot: input.pickupSlot,
          deliveryAddress: input.deliveryAddress,
          customerNotes: input.customerNotes,
          isQuickOrder: input.isQuickOrder,
          deliveryBandId: input.deliveryBandId,
          estimatedWeight: input.estimatedWeight,
          estimatedPieces: input.estimatedPieces,
          requestedServices: input.requestedServices,
        };

        const result = await fn(payload);
        const data = result.data;

        setLoading(false);
        return data;
      } catch (err: unknown) {
        const msg =
          err && typeof err === "object" && "message" in err
            ? String((err as { message?: string }).message)
            : "Failed to create order";
        setError(msg);
        setLoading(false);
        return null;
      }
    },
    []
  );

  return { createOrder, loading, error };
}
