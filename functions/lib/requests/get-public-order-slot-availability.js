"use strict";
/**
 * Get Public Order Slot Availability - Callable Cloud Function
 *
 * Returns for each pickup slot: capacity and booked count for the given date.
 * Used by the public ordering page to show "Full" when slot is at capacity.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicOrderSlotAvailability = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const db = admin.firestore();
exports.getPublicOrderSlotAvailability = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    try {
        const data = request.data;
        if (!(data === null || data === void 0 ? void 0 : data.shopSlug) || !(data === null || data === void 0 ? void 0 : data.date)) {
            throw new https_1.HttpsError("invalid-argument", "shopSlug and date required");
        }
        const dateStr = data.date.trim();
        const dateMatch = /^\d{4}-\d{2}-\d{2}$/.exec(dateStr);
        if (!dateMatch) {
            throw new https_1.HttpsError("invalid-argument", "date must be YYYY-MM-DD");
        }
        const shopSnapshot = await db
            .collection("shops")
            .where("publicOrdering.enabled", "==", true)
            .where("publicOrdering.slug", "==", data.shopSlug)
            .limit(1)
            .get();
        if (shopSnapshot.empty) {
            throw new https_1.HttpsError("permission-denied", "Public ordering not available");
        }
        const shopDoc = shopSnapshot.docs[0];
        const shopId = shopDoc.id;
        const shopData = shopDoc.data();
        const delivery = (_a = shopData.settings) === null || _a === void 0 ? void 0 : _a.delivery;
        const slots = Array.isArray(delivery === null || delivery === void 0 ? void 0 : delivery.pickupTimeSlots) ? delivery.pickupTimeSlots : [];
        const dateStart = new Date(dateStr + "T00:00:00.000Z");
        const dateEnd = new Date(dateStr + "T23:59:59.999Z");
        const startTs = admin.firestore.Timestamp.fromDate(dateStart);
        const endTs = admin.firestore.Timestamp.fromDate(dateEnd);
        const result = {};
        for (const slot of slots) {
            const value = typeof slot === "object" && slot !== null && "value" in slot
                ? String((_b = slot.value) !== null && _b !== void 0 ? _b : "")
                : "";
            const capacity = typeof slot === "object" && slot !== null && "capacity" in slot && typeof slot.capacity === "number" && slot.capacity > 0
                ? slot.capacity
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
                }
                catch (queryErr) {
                    console.warn("Slot availability query failed for slot", value, queryErr);
                }
            }
            result[value] = { capacity, booked };
        }
        return result;
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        console.error("getPublicOrderSlotAvailability error:", err);
        return {};
    }
});
//# sourceMappingURL=get-public-order-slot-availability.js.map