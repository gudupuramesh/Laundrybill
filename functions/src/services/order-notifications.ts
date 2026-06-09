/**
 * Order notification helpers: collect device tokens and send order-related push
 * notifications to the shop (main app) and/or assigned agent (driver app).
 *
 * Tokens are routed through {@link sendPush}, which delivers Expo push tokens via
 * the Expo push service and FCM tokens via Firebase Cloud Messaging.
 */

import * as admin from "firebase-admin";
import { sendPush, PushTarget } from "./push-sender";

const db = admin.firestore();

type DocRef = FirebaseFirestore.DocumentReference;

/** A push target plus the Firestore doc it came from (for invalid-token cleanup). */
interface TargetWithRef extends PushTarget {
  ref: DocRef;
}

export type OrderNotificationType =
  | "new_online_order"
  | "new_pos_order"
  | "new_pos_order_assigned"
  | "order_ready"
  | "order_out_for_delivery"
  | "order_cancelled"
  | "order_assigned_to_you";

export interface OrderNotificationPayload {
  shopId: string;
  orderId: string;
  publicId: string;
  orderNumber?: string;
  customerName?: string;
  type: OrderNotificationType;
  recipient: "shop" | "agent" | "both";
  assignedAgentId?: string | null;
}

/** Collect all push targets for the shop (main app users). */
async function getShopPushTargets(shopId: string): Promise<TargetWithRef[]> {
  const snapshot = await db
    .collection("shops")
    .doc(shopId)
    .collection("notificationTokens")
    .get();

  const targets: TargetWithRef[] = [];
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
async function getAgentPushTargets(shopId: string, agentId: string): Promise<TargetWithRef[]> {
  const col = db.collection("shops").doc(shopId).collection("agentNotificationTokens");

  // Fetch web token ({agentId}) and android token ({agentId}_android) in parallel
  const [webSnap, androidSnap] = await Promise.all([
    col.doc(agentId).get(),
    col.doc(`${agentId}_android`).get(),
  ]);

  const targets: TargetWithRef[] = [];
  for (const snap of [webSnap, androidSnap]) {
    const data = snap.data();
    const token = data?.token;
    if (token && typeof token === "string") {
      targets.push({ token, tokenType: data?.tokenType, ref: snap.ref });
    }
  }
  return targets;
}

function buildNotification(type: OrderNotificationType, publicId: string, customerName?: string) {
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
export async function sendOrderNotification(payload: OrderNotificationPayload): Promise<void> {
  const { shopId, orderId, publicId, orderNumber, customerName, type, recipient, assignedAgentId } = payload;
  const data: Record<string, string> = {
    type,
    orderId,
    shopId,
    publicId: publicId || orderNumber || orderId,
  };
  const { title, body } = buildNotification(type, publicId || orderNumber || orderId, customerName);

  const targets: TargetWithRef[] = [];

  if (recipient === "shop" || recipient === "both") {
    targets.push(...(await getShopPushTargets(shopId)));
  }

  if ((recipient === "agent" || recipient === "both") && assignedAgentId) {
    targets.push(...(await getAgentPushTargets(shopId, assignedAgentId)));
  }

  if (targets.length === 0) return;

  const result = await sendPush(targets, {
    title,
    body,
    data,
    channelId: "order_updates",
    priority: "high",
  });

  // Prune invalid/expired tokens.
  if (result.invalidTokens.length > 0) {
    const invalid = new Set(result.invalidTokens);
    await Promise.allSettled(
      targets.filter((t) => invalid.has(t.token)).map((t) => t.ref.delete()),
    );
  }

  if (result.successCount > 0) {
    console.log(`Order notification "${type}" sent to ${result.successCount} device(s) for shop ${shopId}`);
  }
}
