"use strict";
/**
 * Trigger: When a new order is created
 * - orderSource === 'online': customer confirmation email + FCM to shop + FCM to assigned agent (if any)
 * - orderSource === 'pos': FCM to shop; if pickup_home/delivery_home and assigned agent, also FCM to agent
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.onPublicOrderCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const zeptomail_1 = require("../services/zeptomail");
const platform_settings_1 = require("../services/platform-settings");
const public_order_email_1 = require("../services/public-order-email");
const order_notifications_1 = require("../services/order-notifications");
const currency_helper_1 = require("../services/currency-helper");
const db = admin.firestore();
function getTrackingUrl(publicId, appUrl) {
    const base = appUrl.replace(/\/$/, "");
    return `${base}/track/${publicId}`;
}
exports.onPublicOrderCreated = (0, firestore_1.onDocumentCreated)("shops/{shopId}/orders/{orderId}", async (event) => {
    var _a, _b, _c, _d;
    const orderData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    const shopId = event.params.shopId;
    const orderId = event.params.orderId;
    if (!orderData)
        return;
    const publicId = orderData.publicId || orderData.orderNumber;
    const customerName = orderData.customerName || "Customer";
    const orderNumber = orderData.orderNumber;
    // ---------- Online order: customer email + shop + agent notifications ----------
    if (orderData.orderSource === "online") {
        const settings = await (0, platform_settings_1.getPlatformSettings)();
        const appUrl = settings.appUrl || "https://app.laundrybill.com";
        const trackingUrl = getTrackingUrl(publicId, appUrl);
        // 1. Email to customer (if email present)
        const customerEmail = orderData.customerEmail;
        if (customerEmail && typeof customerEmail === "string" && customerEmail.includes("@")) {
            try {
                const items = (orderData.items || []).map((i) => ({
                    name: [i.serviceName, i.categoryName].filter(Boolean).join(" ") || "Item",
                    quantity: i.quantity || 1,
                    total: i.total,
                }));
                const pickupDate = ((_c = (_b = orderData.scheduledPickupDate) === null || _b === void 0 ? void 0 : _b.toDate) === null || _c === void 0 ? void 0 : _c.call(_b))
                    ? orderData.scheduledPickupDate.toDate().toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                    })
                    : "TBD";
                const pickupSlot = orderData.scheduledPickupTime || "TBD";
                const [shopName, shopAddress, shopPhone, currencySymbol] = await Promise.all([
                    getShopName(shopId),
                    getShopAddress(shopId),
                    getShopPhone(shopId),
                    (0, currency_helper_1.getShopCurrencySymbol)(shopId),
                ]);
                const html = (0, public_order_email_1.getPublicOrderConfirmationCustomerEmail)({
                    customerName,
                    shopName,
                    shopAddress,
                    shopPhone,
                    orderId: publicId,
                    trackingUrl,
                    pickupDate,
                    pickupSlot,
                    deliveryArea: orderData.deliveryArea || "",
                    items,
                    total: ((_d = orderData.financials) === null || _d === void 0 ? void 0 : _d.total) || 0,
                    isQuickOrder: orderData.isQuickOrder === true,
                    currencySymbol,
                    settings,
                });
                await (0, zeptomail_1.sendEmail)({
                    to: [{ address: customerEmail, name: customerName }],
                    subject: `Order confirmed #${publicId} – ${orderData.shopName || "Your laundry"}`,
                    htmlBody: html,
                });
                console.log(`Order confirmation email sent to ${customerEmail}`);
            }
            catch (err) {
                console.error("Failed to send order confirmation email:", err);
            }
        }
        // 2. FCM to shop and assigned agent
        try {
            await (0, order_notifications_1.sendOrderNotification)({
                shopId,
                orderId,
                publicId,
                orderNumber,
                customerName,
                type: "new_online_order",
                recipient: orderData.assignedAgentId ? "both" : "shop",
                assignedAgentId: orderData.assignedAgentId || null,
            });
        }
        catch (err) {
            console.error("Failed to send FCM for online order:", err);
        }
        return;
    }
    // ---------- POS order: shop + agent (if delivery and assigned) ----------
    if (orderData.orderSource === "pos") {
        try {
            const isDelivery = orderData.deliveryType === "pickup_home" || orderData.deliveryType === "delivery_home";
            const assignedAgentId = orderData.assignedAgentId || null;
            if (isDelivery && assignedAgentId) {
                await (0, order_notifications_1.sendOrderNotification)({
                    shopId,
                    orderId,
                    publicId,
                    orderNumber,
                    customerName,
                    type: "new_pos_order",
                    recipient: "shop",
                });
                await (0, order_notifications_1.sendOrderNotification)({
                    shopId,
                    orderId,
                    publicId,
                    orderNumber,
                    customerName,
                    type: "new_pos_order_assigned",
                    recipient: "agent",
                    assignedAgentId,
                });
            }
            else {
                await (0, order_notifications_1.sendOrderNotification)({
                    shopId,
                    orderId,
                    publicId,
                    orderNumber,
                    customerName,
                    type: "new_pos_order",
                    recipient: "shop",
                });
            }
        }
        catch (err) {
            console.error("Failed to send FCM for POS order:", err);
        }
    }
});
async function getShopName(shopId) {
    var _a;
    const doc = await db.collection("shops").doc(shopId).get();
    return ((_a = doc.data()) === null || _a === void 0 ? void 0 : _a.name) || "Shop";
}
async function getShopAddress(shopId) {
    var _a;
    const doc = await db.collection("shops").doc(shopId).get();
    const loc = (_a = doc.data()) === null || _a === void 0 ? void 0 : _a.location;
    if (!loc)
        return undefined;
    return [loc.address, loc.city, loc.pincode].filter(Boolean).join(", ") || undefined;
}
async function getShopPhone(shopId) {
    var _a;
    const doc = await db.collection("shops").doc(shopId).get();
    return (_a = doc.data()) === null || _a === void 0 ? void 0 : _a.phone;
}
//# sourceMappingURL=on-public-order-created.js.map