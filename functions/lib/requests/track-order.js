"use strict";
/**
 * Track Order — Callable Cloud Function (public, phone-verified).
 *
 * Replaces the previous client-side collection-group lookup that required
 * orders to be world-readable. Customers track an order by order number/ID
 * PLUS their phone number; the function runs with the Admin SDK (bypassing
 * security rules) and returns only sanitized tracking data, and only when the
 * phone matches the order. This makes order documents non-public and kills
 * enumeration by sequential order numbers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackOrder = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const db = admin.firestore();
function normalizePhone(p) {
    return (p || "").replace(/\D/g, "").slice(-10);
}
function tsToMillis(v) {
    if (v == null)
        return null;
    if (typeof v.toMillis === "function")
        return v.toMillis();
    if (typeof v._seconds === "number")
        return v._seconds * 1000;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.getTime();
}
exports.trackOrder = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d, _e;
    const { code, phone } = (request.data || {});
    if (!code || !code.trim()) {
        throw new https_1.HttpsError("invalid-argument", "Order number is required.");
    }
    const phoneNorm = normalizePhone(phone || "");
    if (phoneNorm.length < 10) {
        throw new https_1.HttpsError("invalid-argument", "Enter the 10-digit mobile number used on the order.");
    }
    const cleanId = code.trim().toUpperCase();
    // Candidate lookups (mirror legacy client behaviour). Admin SDK bypasses rules.
    const candidates = [
        ["publicId", cleanId],
        ["orderNumber", cleanId],
        ["trackingId", cleanId],
        ["publicId", cleanId.replace(/-/g, "")],
        ["publicId", cleanId.replace(/^([A-Z]+)(\d+)$/, "$1-$2")],
    ];
    let orderDoc = null;
    for (const [field, value] of candidates) {
        if (!value)
            continue;
        let snap;
        try {
            snap = await db.collectionGroup("orders").where(field, "==", value).limit(10).get();
        }
        catch (_f) {
            continue; // missing index for a field — try the next
        }
        if (!snap.empty) {
            // Only return an order whose phone matches the verifier.
            const match = snap.docs.find((d) => normalizePhone(d.data().customerPhone || "") === phoneNorm);
            if (match) {
                orderDoc = match;
                break;
            }
        }
    }
    if (!orderDoc) {
        // Generic message — never reveal whether the order number exists.
        throw new https_1.HttpsError("not-found", "No order matches that number and phone. Please check and try again.");
    }
    const o = orderDoc.data();
    const shopId = orderDoc.ref.path.split("/")[1];
    // Shop details
    let shopName = "", shopPhone = "", shopAddress = "", shopEmail = "";
    try {
        const shopDoc = await db.collection("shops").doc(shopId).get();
        if (shopDoc.exists) {
            const s = shopDoc.data();
            shopName = s.name || s.shopName || "";
            shopPhone = s.phone || s.shopPhone || s.whatsappNumber || "";
            const loc = s.location;
            shopAddress = (loc === null || loc === void 0 ? void 0 : loc.address) ? [loc.address, loc.city, loc.pincode].filter(Boolean).join(", ") : (s.address || "");
            shopEmail = s.email || "";
        }
    }
    catch ( /* ignore */_g) { /* ignore */ }
    // Assigned agent phone (for customer to contact the driver)
    let agentPhone = "";
    if (o.assignedAgentId) {
        try {
            const staffDoc = await db.collection("shops").doc(shopId).collection("staff").doc(o.assignedAgentId).get();
            if (staffDoc.exists)
                agentPhone = staffDoc.data().phone || "";
            if (!agentPhone) {
                const tmDoc = await db.collection("shops").doc(shopId).collection("teamMembers").doc(o.assignedAgentId).get();
                if (tmDoc.exists)
                    agentPhone = tmDoc.data().phone || "";
            }
        }
        catch ( /* ignore */_h) { /* ignore */ }
    }
    const timeline = Array.isArray(o.timeline)
        ? o.timeline.map((e) => ({ status: e.status, timestamp: tsToMillis(e.timestamp), note: e.note || e.notes || null }))
        : [];
    const items = Array.isArray(o.items)
        ? o.items.map((it) => {
            var _a, _b;
            return ({
                name: it.serviceName || it.name || "Item",
                quantity: it.quantity || 1,
                price: (_b = (_a = it.total) !== null && _a !== void 0 ? _a : it.price) !== null && _b !== void 0 ? _b : 0,
                express: it.express || false,
                categoryName: it.categoryName || null,
            });
        })
        : [];
    const f = o.financials || {};
    return {
        orderId: orderDoc.id,
        shopId,
        publicId: o.publicId || o.orderNumber || cleanId,
        status: o.status || "pending",
        customerName: o.customerName || "Customer",
        customerPhone: o.customerPhone || "",
        deliveryAddress: o.deliveryAddress || o.pickupAddress || null,
        items,
        total: (_b = (_a = f.total) !== null && _a !== void 0 ? _a : o.totalAmount) !== null && _b !== void 0 ? _b : 0,
        amountPaid: (_d = (_c = f.amountPaid) !== null && _c !== void 0 ? _c : o.paidAmount) !== null && _d !== void 0 ? _d : 0,
        balance: (_e = f.balance) !== null && _e !== void 0 ? _e : ((f.total || 0) - (f.amountPaid || 0)),
        expectedDelivery: tsToMillis(o.expectedDelivery),
        deliveredAt: tsToMillis(o.deliveredAt),
        deliveryType: o.deliveryType || "pickup_store",
        timeline,
        createdAt: tsToMillis(o.createdAt),
        updatedAt: tsToMillis(o.updatedAt),
        shopName,
        shopPhone,
        shopAddress,
        shopEmail,
        assignedAgentId: o.assignedAgentId || null,
        assignedAgentName: o.assignedAgentName || null,
        assignedAgentPhone: agentPhone || o.assignedAgentPhone || null,
        taxAmount: f.taxAmount || 0,
        taxName: f.taxName || null,
        taxRate: f.taxRate || null,
        deliveryCharge: f.deliveryCharge || 0,
        discountAmount: f.discountAmount || 0,
        damagePhotoUrls: o.damagePhotoUrls || null,
        pickupPhoto: o.pickupPhoto || null,
        deliveryPhoto: o.deliveryPhoto || null,
        plantPhoto: o.plantPhoto || null,
        orderSource: o.orderSource || null,
    };
});
//# sourceMappingURL=track-order.js.map