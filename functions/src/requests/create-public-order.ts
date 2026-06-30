/**
 * Create Public Order - Callable Cloud Function
 *
 * Allows unauthenticated users to create orders from the public ordering page.
 * Validates shop has publicOrdering enabled, creates order and customer.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const db = admin.firestore();

function formatOrderId(shopCode: string, orderNumber: number): string {
  const padded = orderNumber.toString().padStart(5, "0");
  return `${shopCode}-${padded}`;
}

interface CreatePublicOrderInput {
  shopId: string;
  shopSlug: string;
  deliveryArea: string;
  customerName: string;
  customerPhone: string;
  /** Dial code from the shop's country (e.g. "+91", "+971"). Defaults to +91. */
  phoneCountryCode?: string;
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
  pickupDate: string;
  pickupSlot: string;
  deliveryAddress: {
    lat?: number;
    lng?: number;
    flatNumber?: string;
    landmark?: string;
    fullAddress?: string;
  };
  customerNotes?: string;
  isQuickOrder?: boolean;
  /** Selected distance band id when the shop uses distance-band delivery fees. */
  deliveryBandId?: string;
  /** Quick-order estimates (no itemised list) — shown to the shop so they know what's coming. */
  estimatedWeight?: string;
  estimatedPieces?: string;
  /** Services the customer selected in Book Pickup — become 0-priced placeholder lines. */
  requestedServices?: string[];
}

export const createPublicOrder = onCall(async (request) => {
  const data = request.data as CreatePublicOrderInput;

  if (!data?.shopId || !data?.customerName || !data?.customerPhone) {
    throw new HttpsError("invalid-argument", "Missing required fields");
  }

  // Phone: prefix with the shop's country dial code (e.g. +91, +971), not hardcoded India.
  const dialCode = ((data.phoneCountryCode || "+91").replace(/[^\d+]/g, "")) || "+91";
  const dialDigits = dialCode.replace(/\D/g, "");
  let phoneNorm = (data.customerPhone || "").replace(/\D/g, "");
  // If the customer also typed the country code into the number field, drop it.
  if (dialDigits && phoneNorm.startsWith(dialDigits) && phoneNorm.length > dialDigits.length + 5) {
    phoneNorm = phoneNorm.slice(dialDigits.length);
  }
  if (phoneNorm.length < 6) {
    throw new HttpsError("invalid-argument", "Invalid phone number");
  }
  const fullPhone = (dialCode.startsWith("+") ? dialCode : "+" + dialCode) + phoneNorm;

  // Address: a typed address is fine — coordinates are optional (no forced geolocation).
  if (!data.deliveryAddress?.flatNumber?.trim()) {
    throw new HttpsError("invalid-argument", "Pickup address required");
  }

  const shopRef = db.collection("shops").doc(data.shopId);
  const shopDoc = await shopRef.get();

  if (!shopDoc.exists) {
    throw new HttpsError("not-found", "Shop not found");
  }

  const shopData = shopDoc.data()!;
  const publicOrdering = shopData.publicOrdering || {};

  if (!publicOrdering.enabled || publicOrdering.slug !== data.shopSlug) {
    throw new HttpsError("permission-denied", "Public ordering not available for this shop");
  }

  const settings = shopData.settings || {};
  const delivery = settings.delivery || {};
  const pickupSlots = delivery.pickupTimeSlots || [];
  const bufferMinutes = typeof delivery.bufferMinutes === "number" && delivery.bufferMinutes > 0
    ? delivery.bufferMinutes
    : 0;
  const pickupSlotValue = (data.pickupSlot || "").trim();
  if (pickupSlotValue) {
    const slotConfig = pickupSlots.find(
      (s: { value?: string }) => (s.value || "").trim() === pickupSlotValue
    );
    const capacity = typeof slotConfig?.capacity === "number" && slotConfig.capacity > 0 ? slotConfig.capacity : 0;
    if (capacity > 0 && data.pickupDate) {
      const dateStr = data.pickupDate.trim();
      const dateStart = new Date(dateStr + "T00:00:00.000Z");
      const dateEnd = new Date(dateStr + "T23:59:59.999Z");
      const startTs = admin.firestore.Timestamp.fromDate(dateStart);
      const endTs = admin.firestore.Timestamp.fromDate(dateEnd);
      const ordersSnapshot = await shopRef
        .collection("orders")
        .where("scheduledPickupDate", ">=", startTs)
        .where("scheduledPickupDate", "<=", endTs)
        .where("scheduledPickupTime", "==", pickupSlotValue)
        .get();
      if (ordersSnapshot.size >= capacity) {
        throw new HttpsError("resource-exhausted", "This time slot is full. Please choose another.");
      }
    }
    // Buffer: reject if booking for today and within buffer window (slot start - now < bufferMinutes)
    if (bufferMinutes > 0 && data.pickupDate) {
      const todayUtc = new Date().toISOString().slice(0, 10);
      if (data.pickupDate.trim() === todayUtc) {
        const startStr = pickupSlotValue.split(/\s*[-–]\s*/).map((s: string) => s.trim())[0] || "";
        const match = startStr.match(/^(\d{1,2})(?::\d{2})?\s*(AM|PM)/i);
        if (match) {
          let hour = parseInt(match[1], 10);
          if (match[2].toUpperCase() === "PM" && hour < 12) hour += 12;
          if (match[2].toUpperCase() === "AM" && hour === 12) hour = 0;
          const slotStart = new Date(data.pickupDate.trim() + "T" + String(hour).padStart(2, "0") + ":00:00.000Z");
          const now = Date.now();
          const minutesUntilStart = (slotStart.getTime() - now) / 60000;
          if (minutesUntilStart > 0 && minutesUntilStart < bufferMinutes) {
            throw new HttpsError(
              "failed-precondition",
              "This slot is no longer available. Please choose a later slot or another day."
            );
          }
        }
      }
    }
  }

  const nextOrderNumber = settings.nextOrderNumber || 1;
  let shopCode = shopData.shopCode;

  if (!shopCode) {
    const name = (shopData.name || "Shop").toUpperCase().replace(/[^A-Z]/g, "");
    const prefix = name.length >= 2 ? name.slice(0, 2) : "SH";
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    shopCode =
      prefix +
      chars.charAt(Math.floor(Math.random() * chars.length)) +
      chars.charAt(Math.floor(Math.random() * chars.length));
    await shopRef.update({ shopCode });
  }

  const orderNumber = formatOrderId(shopCode, nextOrderNumber);

  // Create or find customer by phone, then by email (so POS and public-page orders stay on same customer)
  const customersRef = shopRef.collection("customers");
  const phoneFormats = [fullPhone, phoneNorm, dialDigits + phoneNorm];
  let customerId: string | null = null;

  for (const fmt of phoneFormats) {
    const phoneQuery = await customersRef
      .where("phone", "==", fmt)
      .limit(1)
      .get();
    if (!phoneQuery.empty) {
      customerId = phoneQuery.docs[0].id;
      break;
    }
  }

  // If no match by phone, try by email so same person ordering with different number still links
  if (!customerId && data.customerEmail?.trim()) {
    const emailNorm = data.customerEmail.trim().toLowerCase();
    const emailQuery = await customersRef
      .where("email", "==", emailNorm)
      .limit(1)
      .get();
    if (!emailQuery.empty) {
      customerId = emailQuery.docs[0].id;
    }
  }

  if (customerId) {
    await customersRef.doc(customerId).update({
      name: data.customerName,
      phone: fullPhone,
      email: data.customerEmail?.trim() || null,
      address: buildAddressString(data.deliveryAddress),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  if (!customerId) {
    const newCustomer = await customersRef.add({
      name: data.customerName,
      phone: fullPhone,
      email: data.customerEmail || null,
      address: buildAddressString(data.deliveryAddress),
      totalOrders: 0,
      totalSpent: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    customerId = newCustomer.id;
  }

  const now = admin.firestore.Timestamp.now();
  const pickupDateObj = data.pickupDate ? new Date(data.pickupDate) : new Date();
  const expectedDelivery = new Date(pickupDateObj);
  expectedDelivery.setDate(expectedDelivery.getDate() + 2);

  // Auto-assign agent: pick from agents serving this delivery area
  let assignedAgentId: string | null = null;
  let assignedAgentName: string | null = null;
  const deliveryAreaValue = (data.deliveryArea || "").trim();
  if (deliveryAreaValue) {
    try {
      const tmRef = shopRef.collection("teamMembers");
      const tmQuery = tmRef
        .where("memberType", "==", "agent")
        .where("serviceAreas", "array-contains", deliveryAreaValue);
      const tmSnapshot = await tmQuery.get();
      const agents = tmSnapshot.docs
        .filter((d) => d.data().isActive !== false)
        .map((d) => ({
          id: d.id,
          name: (d.data().name as string) || (d.data().email as string) || "Agent",
        }));
      if (agents.length === 1) {
        assignedAgentId = agents[0].id;
        assignedAgentName = agents[0].name;
      } else if (agents.length > 1) {
        const picked = agents[Math.floor(Math.random() * agents.length)];
        assignedAgentId = picked.id;
        assignedAgentName = picked.name;
      }
    } catch (err) {
      console.warn("Auto-assign agent failed:", err);
    }
  }

  const orderItems = (data.items || []).map((item, idx) => ({
    id: `i-${item.serviceId}-${idx}`,
    serviceId: item.serviceId,
    serviceName: item.serviceName,
    categoryId: item.categoryId || null,
    categoryName: item.categoryName || null,
    quantity: item.quantity || 1,
    unit: item.unit || "piece",
    unitPrice: item.unitPrice || 0,
    total: item.total || 0,
    express: item.express ?? false,
    notes: item.notes || null,
  }));

  const isQuickOrder = data.isQuickOrder === true || orderItems.length === 0;

  // Quick orders carry no priced items — but if the customer ticked which services
  // they need, create one 0-priced placeholder line per service so the shop sees the
  // requested services on the order and prices them at intake.
  const placeholderItems = (data.requestedServices || [])
    .filter((s) => typeof s === "string" && s.trim())
    .map((svc, idx) => ({
      id: `i-svc-${idx}`,
      serviceId: `svc-${idx}`,
      serviceName: svc.trim(),
      categoryId: null,
      categoryName: svc.trim(),
      quantity: 1,
      unit: "piece",
      unitPrice: 0,
      total: 0,
      express: false,
      notes: "Requested online — price at intake",
    }));
  const finalItems = orderItems.length > 0 ? orderItems : placeholderItems;
  const rawFinancials = data.financials || {
    subtotal: 0,
    taxAmount: 0,
    deliveryCharge: 0,
    total: 0,
  };

  // Quick orders are always pickup_home: ensure a default delivery charge when client sent 0
  let deliveryCharge = rawFinancials.deliveryCharge || 0;
  // Distance-band mode: compute the fee SERVER-SIDE from the selected band so the
  // client can't tamper with the amount. Public orders are always pickup_home.
  const distanceBands = Array.isArray(delivery.distanceBands) ? delivery.distanceBands : [];
  if (delivery.distanceFeeEnabled === true && distanceBands.length > 0) {
    const sel = distanceBands.find(
      (b: { id?: string }) => b.id === data.deliveryBandId
    ) || distanceBands[0];
    deliveryCharge = typeof sel?.fee === "number" && sel.fee >= 0 ? sel.fee : 0;
  } else if (isQuickOrder && deliveryCharge === 0 && delivery) {
    const fee = (delivery.deliveryFeeEnabled === true)
      ? (delivery.deliveryFeeAmount ?? delivery.defaultCharge ?? 50)
      : (delivery.defaultCharge ?? 50);
    deliveryCharge = typeof fee === "number" && fee >= 0 ? fee : 50;
  }

  const subtotal = rawFinancials.subtotal || 0;

  // Minimum order value (priced orders only — quick orders are priced at intake).
  const minOrderValue = typeof publicOrdering.minOrderValue === "number" ? publicOrdering.minOrderValue : 0;
  if (!isQuickOrder && minOrderValue > 0 && subtotal < minOrderValue) {
    throw new HttpsError("failed-precondition", `Minimum order value is ${minOrderValue}.`);
  }

  const discountAmount = rawFinancials.discountAmount || 0;
  const taxAmount = rawFinancials.taxAmount || 0;
  const total = Math.max(0, subtotal - discountAmount + taxAmount + deliveryCharge);

  const financials = {
    subtotal: rawFinancials.subtotal || 0,
    discountType: rawFinancials.discountType || null,
    discountValue: rawFinancials.discountValue || 0,
    discountAmount,
    expressCharge: 0,
    deliveryCharge,
    taxAmount,
    taxRate: rawFinancials.taxRate || 0,
    taxName: rawFinancials.taxName || "Tax",
    total,
    amountPaid: 0,
    balance: total,
  };

  const orderData = {
    orderNumber,
    publicId: orderNumber,
    customerId,
    customerName: data.customerName,
    customerPhone: fullPhone,
    customerEmail: data.customerEmail || null,
    isGuest: false,
    items: finalItems,
    financials,
    status: "pending",
    paymentMethod: "cash",
    paymentStatus: "unpaid",
    deliveryType: "pickup_home",
    deliveryAddress: buildAddressString(data.deliveryAddress),
    ...(data.deliveryAddress?.lat != null && data.deliveryAddress?.lng != null
      ? { deliveryLat: data.deliveryAddress.lat, deliveryLng: data.deliveryAddress.lng }
      : {}),
    deliveryNotes: data.customerNotes || null,
    pickupAddress: buildAddressString(data.deliveryAddress),
    scheduledPickupDate: admin.firestore.Timestamp.fromDate(pickupDateObj),
    scheduledPickupTime: data.pickupSlot || null,
    expectedDelivery: admin.firestore.Timestamp.fromDate(expectedDelivery),
    staffId: "online",
    staffName: "Online",
    assignedAgentId: assignedAgentId,
    assignedAgentName: assignedAgentName,
    assignedAt: assignedAgentId ? now : null,
    shopId: data.shopId,
    orderSource: "online",
    publicPageSlug: data.shopSlug,
    shopName: shopData.name || shopData.shopName || "Shop",
    deliveryArea: data.deliveryArea || null,
    isQuickOrder: data.isQuickOrder ?? isQuickOrder,
    estimatedWeight: data.estimatedWeight || null,
    estimatedPieces: data.estimatedPieces || null,
    timeline: [
      {
        id: `t-${Date.now()}`,
        status: "pending",
        timestamp: now,
        staffId: "online",
        staffName: "Online",
        notes: null,
        notifiedCustomer: false,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  await shopRef.update({
    "settings.nextOrderNumber": nextOrderNumber + 1,
  });

  const orderRef = await shopRef.collection("orders").add(orderData);

  await customersRef.doc(customerId).update({
    totalOrders: admin.firestore.FieldValue.increment(1),
    totalSpent: admin.firestore.FieldValue.increment(financials.total || 0),
    lastOrderAt: now,
    updatedAt: now,
  });

  return {
    orderId: orderRef.id,
    publicId: orderNumber,
    shopId: data.shopId,
  };
});

function buildAddressString(addr: CreatePublicOrderInput["deliveryAddress"]): string {
  if (!addr) return "";
  const parts: string[] = [];
  if (addr.flatNumber) parts.push(addr.flatNumber);
  if (addr.landmark) parts.push(addr.landmark);
  if (addr.fullAddress) parts.push(addr.fullAddress);
  return parts.join(", ") || `${addr.lat}, ${addr.lng}`;
}
