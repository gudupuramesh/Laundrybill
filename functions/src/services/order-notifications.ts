/**
 * Order notification helpers: get FCM tokens and send order-related push notifications
 * to shop (main app) and/or assigned agent (driver app).
 */

import * as admin from "firebase-admin";

const db = admin.firestore();

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

/** Get all FCM tokens for the shop (main app users). */
export async function getShopFcmTokens(shopId: string): Promise<string[]> {
  const snapshot = await db
    .collection("shops")
    .doc(shopId)
    .collection("notificationTokens")
    .get();

  const tokens: string[] = [];
  snapshot.docs.forEach((d) => {
    const t = d.data().token;
    if (t && typeof t === "string") tokens.push(t);
  });
  return tokens;
}

/** Get FCM tokens for an agent (driver app). Returns web + android tokens. */
export async function getAgentFcmToken(shopId: string, agentId: string): Promise<string[]> {
  const tokens: string[] = [];
  const col = db.collection("shops").doc(shopId).collection("agentNotificationTokens");

  // Fetch web token ({agentId}) and android token ({agentId}_android) in parallel
  const [webSnap, androidSnap] = await Promise.all([
    col.doc(agentId).get(),
    col.doc(`${agentId}_android`).get(),
  ]);

  const webToken = webSnap.data()?.token;
  if (webToken && typeof webToken === "string") tokens.push(webToken);

  const androidToken = androidSnap.data()?.token;
  if (androidToken && typeof androidToken === "string") tokens.push(androidToken);

  return tokens;
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

/** Send order notification to shop and/or assigned agent. Invalid tokens are not removed (caller can handle). */
export async function sendOrderNotification(payload: OrderNotificationPayload): Promise<void> {
  const { shopId, orderId, publicId, orderNumber, customerName, type, recipient, assignedAgentId } = payload;
  const data: Record<string, string> = {
    type,
    orderId,
    shopId,
    publicId: publicId || orderNumber || orderId,
  };
  const { title, body } = buildNotification(type, publicId || orderNumber || orderId, customerName);

  const messaging = admin.messaging();
  const toSend: { token: string; isAgent: boolean }[] = [];

  if (recipient === "shop" || recipient === "both") {
    const shopTokens = await getShopFcmTokens(shopId);
    shopTokens.forEach((token) => toSend.push({ token, isAgent: false }));
  }

  if ((recipient === "agent" || recipient === "both") && assignedAgentId) {
    const agentTokens = await getAgentFcmToken(shopId, assignedAgentId);
    agentTokens.forEach((token) => toSend.push({ token, isAgent: true }));
  }

  const results = await Promise.allSettled(
    toSend.map(({ token }) =>
      messaging.send({
        token,
        notification: { title, body },
        data: { ...data },
        android: {
          priority: "high" as const,
          notification: {
            channelId: "order_updates",
            icon: "ic_launcher",
          },
        },
      })
    )
  );

  let sent = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") sent++;
    if (r.status === "rejected") {
      const err = r.reason;
      const code = err?.code ?? err?.message ?? "";
      if (
        String(code).includes("registration-token-not-registered") ||
        String(code).includes("invalid-registration-token")
      ) {
        // Optionally remove invalid token (would need tokenId for shop; agentId for agent)
        console.warn("Invalid FCM token, consider removing:", toSend[i]?.token?.slice(0, 20) + "...");
      }
    }
  });
  if (sent > 0) {
    console.log(`Order notification "${type}" sent to ${sent} device(s) for shop ${shopId}`);
  }
}
