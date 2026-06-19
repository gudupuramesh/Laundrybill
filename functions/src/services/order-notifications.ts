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

/**
 * A push target plus the Firestore doc it came from (for invalid-token cleanup).
 * `cleanup` says HOW to prune an invalid token:
 *  - "delete"      → the doc is a disposable token doc (notificationTokens /
 *                    agentNotificationTokens) → delete the whole doc.
 *  - "clearFields" → the doc is a teamMembers doc → only clear the pushToken*
 *                    fields; NEVER delete the member document.
 */
interface TargetWithRef extends PushTarget {
  ref: DocRef;
  cleanup?: "delete" | "clearFields";
}

export type OrderNotificationType =
  | "new_online_order"
  | "new_pos_order"
  | "new_pos_order_assigned"
  | "order_ready"
  | "order_out_for_delivery"
  | "order_cancelled"
  | "order_assigned_to_you"
  // Team-app role-targeted notifications:
  | "plant_new_order"
  | "staff_new_online_order"
  | "manager_new_online_order"
  | "manager_order_cancelled";

export interface OrderNotificationPayload {
  shopId: string;
  orderId: string;
  publicId: string;
  orderNumber?: string;
  customerName?: string;
  type: OrderNotificationType;
  recipient: "shop" | "agent" | "both" | "plant" | "staff" | "manager";
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

/**
 * Collect push targets for Team-app roles (plant / staff / manager) by reading
 * the `pushToken` stored on each `teamMembers` doc. Uses single-field equality/in
 * queries (no composite index) and filters role/active in code.
 *  - managerOnly:        memberType=='staff' && role=='manager'
 *  - memberTypes:['staff']  → memberType=='staff' EXCLUDING role=='manager'
 *                             (managers get the manager-specific notification instead)
 *  - memberTypes:['plant']  → memberType=='plant'
 * Skips deactivated members (isActive===false) and docs without a pushToken.
 * Targets are tagged cleanup:"clearFields" so an invalid token never deletes the member.
 */
async function getTeamRolePushTargets(
  shopId: string,
  filter: { memberTypes?: Array<"plant" | "staff">; managerOnly?: boolean },
): Promise<TargetWithRef[]> {
  const col = db.collection("shops").doc(shopId).collection("teamMembers");

  let query: FirebaseFirestore.Query = col;
  if (filter.managerOnly) {
    query = col.where("memberType", "==", "staff");
  } else if (filter.memberTypes && filter.memberTypes.length > 0) {
    query = col.where("memberType", "in", filter.memberTypes);
  } else {
    return [];
  }

  const snap = await query.get();
  const targets: TargetWithRef[] = [];
  snap.docs.forEach((d) => {
    const data = d.data();
    if (data.isActive === false) return;
    if (filter.managerOnly && data.role !== "manager") return;
    // Plain-staff targeting must exclude managers (they get the manager variant).
    if (!filter.managerOnly && filter.memberTypes?.includes("staff") && data.role === "manager") return;
    const token = data.pushToken;
    if (token && typeof token === "string") {
      targets.push({
        token,
        tokenType: data.pushTokenType || "expo",
        ref: d.ref,
        cleanup: "clearFields",
      });
    }
  });
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
    case "plant_new_order":
      return { title: "New Order to Process", body: `Order #${publicId} is ready for processing` };
    case "staff_new_online_order":
    case "manager_new_online_order":
      return { title: "New Online Order", body: `Order #${publicId} from ${customerName || "Customer"}` };
    case "manager_order_cancelled":
      return { title: "Order Cancelled", body: `Order #${publicId} has been cancelled` };
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

  // Owner-app tokens and Team-app tokens belong to DIFFERENT Expo projects
  // (@gudupuramesh/laundrybill vs @gudupuramesh/laundrybill-driver). Expo rejects
  // a single push request that mixes tokens from more than one project
  // (PUSH_TOO_MANY_EXPERIENCE_IDS), so collect each app's tokens separately and
  // send them in their own request.
  const ownerTargets: TargetWithRef[] = [];
  const teamTargets: TargetWithRef[] = [];

  if (recipient === "shop" || recipient === "both") {
    ownerTargets.push(...(await getShopPushTargets(shopId)));
  }
  if ((recipient === "agent" || recipient === "both") && assignedAgentId) {
    teamTargets.push(...(await getAgentPushTargets(shopId, assignedAgentId)));
  }
  if (recipient === "plant") {
    teamTargets.push(...(await getTeamRolePushTargets(shopId, { memberTypes: ["plant"] })));
  }
  if (recipient === "staff") {
    teamTargets.push(...(await getTeamRolePushTargets(shopId, { memberTypes: ["staff"] })));
  }
  if (recipient === "manager") {
    teamTargets.push(...(await getTeamRolePushTargets(shopId, { managerOnly: true })));
  }

  const allTargets = [...ownerTargets, ...teamTargets];
  if (allTargets.length === 0) return;

  // One sendPush per app → each request's Expo tokens are all from one project.
  const groups = [ownerTargets, teamTargets].filter((g) => g.length > 0);
  const results = await Promise.all(
    groups.map((g) =>
      sendPush(g, { title, body, data, channelId: "order_updates", priority: "high" }),
    ),
  );

  const successCount = results.reduce((sum, r) => sum + r.successCount, 0);
  const invalid = new Set(results.flatMap((r) => r.invalidTokens));

  // Prune invalid/expired tokens. Token docs are deleted outright; teamMembers
  // docs only get their pushToken* fields cleared (never delete the member).
  if (invalid.size > 0) {
    const FieldValue = admin.firestore.FieldValue;
    await Promise.allSettled(
      allTargets
        .filter((t) => invalid.has(t.token))
        .map((t) =>
          t.cleanup === "clearFields"
            ? t.ref.update({
                pushToken: FieldValue.delete(),
                pushTokenType: FieldValue.delete(),
                pushTokenPlatform: FieldValue.delete(),
                pushTokenUpdatedAt: FieldValue.delete(),
              })
            : t.ref.delete(),
        ),
    );
  }

  if (successCount > 0) {
    console.log(`Order notification "${type}" sent to ${successCount} device(s) for shop ${shopId}`);
  }
}
