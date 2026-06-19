/**
 * Trigger: When an order is updated.
 * Sends FCM to shop and/or assigned agent when:
 * - status → ready | ready_for_pickup (material ready)
 * - status → out_for_delivery (dispatched from plant)
 * - status → cancelled (notify assigned agent)
 * - assignedAgentId changed (notify new agent)
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { sendOrderNotification } from "../services/order-notifications";

export const onOrderUpdated = onDocumentUpdated(
  "shops/{shopId}/orders/{orderId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const shopId = event.params.shopId;
    const orderId = event.params.orderId;

    if (!before || !after) return;

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
      assignedAgentId: null as string | null,
    };

    try {
      // Status → ready or ready_for_pickup: notify shop + assigned agent
      if (newStatus === "ready" || newStatus === "ready_for_pickup") {
        if (prevStatus === newStatus) return; // no change
        await sendOrderNotification({
          ...payload,
          type: "order_ready",
          recipient: after.assignedAgentId ? "both" : "shop",
          assignedAgentId: after.assignedAgentId || null,
        });
        return;
      }

      // Status → out_for_delivery: notify shop + assigned agent
      if (newStatus === "out_for_delivery") {
        if (prevStatus === newStatus) return;
        await sendOrderNotification({
          ...payload,
          type: "order_out_for_delivery",
          recipient: after.assignedAgentId ? "both" : "shop",
          assignedAgentId: after.assignedAgentId || null,
        });
        return;
      }

      // Status → pickup_completed: the home pickup just arrived → plant queue.
      if (newStatus === "pickup_completed" && prevStatus !== "pickup_completed") {
        await sendOrderNotification({
          ...payload,
          type: "plant_new_order",
          recipient: "plant",
          assignedAgentId: null,
        });
        return;
      }

      // Status → cancelled: notify the owner (shop) + the assigned agent who had
      // it (use the prior agent), and the Team-app manager.
      if (newStatus === "cancelled" && prevStatus !== "cancelled") {
        const agentToNotify = prevAgentId || newAgentId;
        await sendOrderNotification({
          ...payload,
          type: "order_cancelled",
          recipient: agentToNotify ? "both" : "shop",
          assignedAgentId: agentToNotify,
        });
        await sendOrderNotification({
          ...payload,
          type: "manager_order_cancelled",
          recipient: "manager",
          assignedAgentId: null,
        });
        return;
      }

      // assignedAgentId changed: notify new agent
      if (newAgentId && newAgentId !== prevAgentId) {
        await sendOrderNotification({
          ...payload,
          type: "order_assigned_to_you",
          recipient: "agent",
          assignedAgentId: newAgentId,
        });
      }
    } catch (err) {
      console.error("Failed to send order update notification:", err);
    }
  }
);
