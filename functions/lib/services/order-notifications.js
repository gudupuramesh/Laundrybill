"use strict";
/**
 * Order notification helpers: get FCM tokens and send order-related push notifications
 * to shop (main app) and/or assigned agent (driver app).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOrderNotification = exports.getAgentFcmToken = exports.getShopFcmTokens = void 0;
const admin = require("firebase-admin");
const db = admin.firestore();
/** Get all FCM tokens for the shop (main app users). */
async function getShopFcmTokens(shopId) {
    const snapshot = await db
        .collection("shops")
        .doc(shopId)
        .collection("notificationTokens")
        .get();
    const tokens = [];
    snapshot.docs.forEach((d) => {
        const t = d.data().token;
        if (t && typeof t === "string")
            tokens.push(t);
    });
    return tokens;
}
exports.getShopFcmTokens = getShopFcmTokens;
/** Get FCM tokens for an agent (driver app). Returns web + android tokens. */
async function getAgentFcmToken(shopId, agentId) {
    var _a, _b;
    const tokens = [];
    const col = db.collection("shops").doc(shopId).collection("agentNotificationTokens");
    // Fetch web token ({agentId}) and android token ({agentId}_android) in parallel
    const [webSnap, androidSnap] = await Promise.all([
        col.doc(agentId).get(),
        col.doc(`${agentId}_android`).get(),
    ]);
    const webToken = (_a = webSnap.data()) === null || _a === void 0 ? void 0 : _a.token;
    if (webToken && typeof webToken === "string")
        tokens.push(webToken);
    const androidToken = (_b = androidSnap.data()) === null || _b === void 0 ? void 0 : _b.token;
    if (androidToken && typeof androidToken === "string")
        tokens.push(androidToken);
    return tokens;
}
exports.getAgentFcmToken = getAgentFcmToken;
function buildNotification(type, publicId, customerName) {
    switch (type) {
        case "new_online_order":
            return { title: "New Online Order", body: `Order #${publicId} from ${customerName || "Customer"}` };
        case "new_pos_order":
            return { title: "New Order", body: `Order #${publicId} from ${customerName || "Customer"}` };
        case "new_pos_order_assigned":
            return { title: "New Order Assigned", body: `Order #${publicId} assigned to you` };
        case "order_ready":
            return { title: "Order Ready", body: `Order #${publicId} is ready for delivery` };
        case "order_out_for_delivery":
            return { title: "Out for Delivery", body: `Order #${publicId} dispatched from plant` };
        case "order_cancelled":
            return { title: "Order Cancelled", body: `Order #${publicId} has been cancelled` };
        case "order_assigned_to_you":
            return { title: "Order Assigned", body: `Order #${publicId} has been assigned to you` };
        default:
            return { title: "Order Update", body: `Order #${publicId}` };
    }
}
/** Send order notification to shop and/or assigned agent. Invalid tokens are not removed (caller can handle). */
async function sendOrderNotification(payload) {
    const { shopId, orderId, publicId, orderNumber, customerName, type, recipient, assignedAgentId } = payload;
    const data = {
        type,
        orderId,
        shopId,
        publicId: publicId || orderNumber || orderId,
    };
    const { title, body } = buildNotification(type, publicId || orderNumber || orderId, customerName);
    const messaging = admin.messaging();
    const toSend = [];
    if (recipient === "shop" || recipient === "both") {
        const shopTokens = await getShopFcmTokens(shopId);
        shopTokens.forEach((token) => toSend.push({ token, isAgent: false }));
    }
    if ((recipient === "agent" || recipient === "both") && assignedAgentId) {
        const agentTokens = await getAgentFcmToken(shopId, assignedAgentId);
        agentTokens.forEach((token) => toSend.push({ token, isAgent: true }));
    }
    const results = await Promise.allSettled(toSend.map(({ token }) => messaging.send({
        token,
        notification: { title, body },
        data: Object.assign({}, data),
        android: {
            priority: "high",
            notification: {
                channelId: "order_updates",
                icon: "ic_launcher",
            },
        },
    })));
    let sent = 0;
    results.forEach((r, i) => {
        var _a, _b, _c, _d;
        if (r.status === "fulfilled")
            sent++;
        if (r.status === "rejected") {
            const err = r.reason;
            const code = (_b = (_a = err === null || err === void 0 ? void 0 : err.code) !== null && _a !== void 0 ? _a : err === null || err === void 0 ? void 0 : err.message) !== null && _b !== void 0 ? _b : "";
            if (String(code).includes("registration-token-not-registered") ||
                String(code).includes("invalid-registration-token")) {
                // Optionally remove invalid token (would need tokenId for shop; agentId for agent)
                console.warn("Invalid FCM token, consider removing:", ((_d = (_c = toSend[i]) === null || _c === void 0 ? void 0 : _c.token) === null || _d === void 0 ? void 0 : _d.slice(0, 20)) + "...");
            }
        }
    });
    if (sent > 0) {
        console.log(`Order notification "${type}" sent to ${sent} device(s) for shop ${shopId}`);
    }
}
exports.sendOrderNotification = sendOrderNotification;
//# sourceMappingURL=order-notifications.js.map