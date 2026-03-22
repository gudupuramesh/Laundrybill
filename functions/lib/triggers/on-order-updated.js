"use strict";
/**
 * Trigger: When an order is updated.
 * Sends FCM to shop and/or assigned agent when:
 * - status → ready | ready_for_pickup (material ready)
 * - status → out_for_delivery (dispatched from plant)
 * - status → cancelled (notify assigned agent)
 * - assignedAgentId changed (notify new agent)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.onOrderUpdated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const order_notifications_1 = require("../services/order-notifications");
exports.onOrderUpdated = (0, firestore_1.onDocumentUpdated)("shops/{shopId}/orders/{orderId}", async (event) => {
    var _a, _b;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    const shopId = event.params.shopId;
    const orderId = event.params.orderId;
    if (!before || !after)
        return;
    const publicId = after.publicId || after.orderNumber || orderId;
    const customerName = after.customerName || "Customer";
    const orderNumber = after.orderNumber;
    const prevStatus = before.status;
    const newStatus = after.status;
    const prevAgentId = before.assignedAgentId || null;
    const newAgentId = after.assignedAgentId || null;
    const payload = {
        shopId,
        orderId,
        publicId,
        orderNumber,
        customerName,
        assignedAgentId: null,
    };
    try {
        // Status → ready or ready_for_pickup: notify shop + assigned agent
        if (newStatus === "ready" || newStatus === "ready_for_pickup") {
            if (prevStatus === newStatus)
                return; // no change
            await (0, order_notifications_1.sendOrderNotification)(Object.assign(Object.assign({}, payload), { type: "order_ready", recipient: after.assignedAgentId ? "both" : "shop", assignedAgentId: after.assignedAgentId || null }));
            return;
        }
        // Status → out_for_delivery: notify shop + assigned agent
        if (newStatus === "out_for_delivery") {
            if (prevStatus === newStatus)
                return;
            await (0, order_notifications_1.sendOrderNotification)(Object.assign(Object.assign({}, payload), { type: "order_out_for_delivery", recipient: after.assignedAgentId ? "both" : "shop", assignedAgentId: after.assignedAgentId || null }));
            return;
        }
        // Status → cancelled: notify assigned agent (from before or after; use before so we notify who had it)
        if (newStatus === "cancelled") {
            const agentToNotify = prevAgentId || newAgentId;
            if (agentToNotify) {
                await (0, order_notifications_1.sendOrderNotification)(Object.assign(Object.assign({}, payload), { type: "order_cancelled", recipient: "agent", assignedAgentId: agentToNotify }));
            }
            return;
        }
        // assignedAgentId changed: notify new agent
        if (newAgentId && newAgentId !== prevAgentId) {
            await (0, order_notifications_1.sendOrderNotification)(Object.assign(Object.assign({}, payload), { type: "order_assigned_to_you", recipient: "agent", assignedAgentId: newAgentId }));
        }
    }
    catch (err) {
        console.error("Failed to send order update notification:", err);
    }
});
//# sourceMappingURL=on-order-updated.js.map