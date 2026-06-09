"use strict";
/**
 * Order notification helpers: collect device tokens and send order-related push
 * notifications to the shop (main app) and/or assigned agent (driver app).
 *
 * Tokens are routed through {@link sendPush}, which delivers Expo push tokens via
 * the Expo push service and FCM tokens via Firebase Cloud Messaging.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOrderNotification = void 0;
const admin = require("firebase-admin");
const push_sender_1 = require("./push-sender");
const db = admin.firestore();
/** Collect all push targets for the shop (main app users). */
async function getShopPushTargets(shopId) {
    const snapshot = await db
        .collection("shops")
        .doc(shopId)
        .collection("notificationTokens")
        .get();
    const targets = [];
    snapshot.docs.forEach((d) => {
        const data = d.data();
        const token = data.token;
        if (token && typeof token === "string") {
            targets.push({ token, tokenType: data.tokenType, ref: d.ref });
        }
    });
    return targets;
}
/** Collect push targets for an agent (driver app). Returns web + android tokens. */
async function getAgentPushTargets(shopId, agentId) {
    const col = db.collection("shops").doc(shopId).collection("agentNotificationTokens");
    // Fetch web token ({agentId}) and android token ({agentId}_android) in parallel
    const [webSnap, androidSnap] = await Promise.all([
        col.doc(agentId).get(),
        col.doc(`${agentId}_android`).get(),
    ]);
    const targets = [];
    for (const snap of [webSnap, androidSnap]) {
        const data = snap.data();
        const token = data === null || data === void 0 ? void 0 : data.token;
        if (token && typeof token === "string") {
            targets.push({ token, tokenType: data === null || data === void 0 ? void 0 : data.tokenType, ref: snap.ref });
        }
    }
    return targets;
}
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
/** Send order notification to shop and/or assigned agent. Invalid tokens are pruned. */
async function sendOrderNotification(payload) {
    const { shopId, orderId, publicId, orderNumber, customerName, type, recipient, assignedAgentId } = payload;
    const data = {
        type,
        orderId,
        shopId,
        publicId: publicId || orderNumber || orderId,
    };
    const { title, body } = buildNotification(type, publicId || orderNumber || orderId, customerName);
    const targets = [];
    if (recipient === "shop" || recipient === "both") {
        targets.push(...(await getShopPushTargets(shopId)));
    }
    if ((recipient === "agent" || recipient === "both") && assignedAgentId) {
        targets.push(...(await getAgentPushTargets(shopId, assignedAgentId)));
    }
    if (targets.length === 0)
        return;
    const result = await (0, push_sender_1.sendPush)(targets, {
        title,
        body,
        data,
        channelId: "order_updates",
        priority: "high",
    });
    // Prune invalid/expired tokens.
    if (result.invalidTokens.length > 0) {
        const invalid = new Set(result.invalidTokens);
        await Promise.allSettled(targets.filter((t) => invalid.has(t.token)).map((t) => t.ref.delete()));
    }
    if (result.successCount > 0) {
        console.log(`Order notification "${type}" sent to ${result.successCount} device(s) for shop ${shopId}`);
    }
}
exports.sendOrderNotification = sendOrderNotification;
//# sourceMappingURL=order-notifications.js.map