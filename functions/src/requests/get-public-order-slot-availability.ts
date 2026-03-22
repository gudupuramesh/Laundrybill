/**
 * Get Public Order Slot Availability - Callable Cloud Function
 *
 * Returns for each pickup slot: capacity and booked count for the given date.
 * Used by the public ordering page to show "Full" when slot is at capacity.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const db = admin.firestore();

interface GetSlotAvailabilityInput {
  shopSlug: string;
  date: string; // YYYY-MM-DD
}

interface SlotAvailability {
  capacity: number;
  booked: number;
}

export const getPublicOrderSlotAvailability = onCall(async (request) => {
  try {
    const data = request.data as GetSlotAvailabilityInput;

    if (!data?.shopSlug || !data?.date) {
      throw new HttpsError("invalid-argument", "shopSlug and date required");
    }

    const dateStr = data.date.trim();
    const dateMatch = /^\d{4}-\d{2}-\d{2}$/.exec(dateStr);
    if (!dateMatch) {
      throw new HttpsError("invalid-argument", "date must be YYYY-MM-DD");
    }

    const shopSnapshot = await db
      .collection("shops")
      .where("publicOrdering.enabled", "==", true)
      .where("publicOrdering.slug", "==", data.shopSlug)
      .limit(1)
      .get();

    if (shopSnapshot.empty) {
      throw new HttpsError("permission-denied", "Public ordering not available");
    }

    const shopDoc = shopSnapshot.docs[0];
    const shopId = shopDoc.id;
    const shopData = shopDoc.data();
    const delivery = shopData.settings?.delivery;
    const slots = Array.isArray(delivery?.pickupTimeSlots) ? delivery.pickupTimeSlots : [];

    const dateStart = new Date(dateStr + "T00:00:00.000Z");
    const dateEnd = new Date(dateStr + "T23:59:59.999Z");
    const startTs = admin.firestore.Timestamp.fromDate(dateStart);
    const endTs = admin.firestore.Timestamp.fromDate(dateEnd);

    const result: Record<string, SlotAvailability> = {};

    for (const slot of slots) {
      const value = typeof slot === "object" && slot !== null && "value" in slot
        ? String((slot as { value?: unknown }).value ?? "")
        : "";
      const capacity = typeof slot === "object" && slot !== null && "capacity" in slot && typeof (slot as { capacity?: number }).capacity === "number" && (slot as { capacity: number }).capacity > 0
        ? (slot as { capacity: number }).capacity
        : 0;

      let booked = 0;
      if (value) {
        try {
          const ordersSnapshot = await db
            .collection("shops")
            .doc(shopId)
            .collection("orders")
            .where("scheduledPickupDate", ">=", startTs)
            .where("scheduledPickupDate", "<=", endTs)
            .where("scheduledPickupTime", "==", value)
            .get();
          booked = ordersSnapshot.size;
        } catch (queryErr) {
          console.warn("Slot availability query failed for slot", value, queryErr);
        }
      }

      result[value] = { capacity, booked };
    }

    return result;
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("getPublicOrderSlotAvailability error:", err);
    return {};
  }
});
