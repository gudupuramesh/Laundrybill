# Notifications Implementation Plan – Shop Owner & Assigned Agent

## 1. Goal

Ensure the **shop owner** and the **assigned agent** (when applicable) receive push notifications for the right order events, with no important scenarios missed.

---

## 2. Current State

| What exists today | Details |
|------------------|--------|
| **FCM for shop** | Main app (owner/staff) registers FCM token at `shops/{shopId}/notificationTokens/{userId}`. Used for “new online order” only. |
| **Trigger** | `onPublicOrderCreated` runs when an order is **created** with `orderSource === 'online'`. It (1) sends customer confirmation email, (2) sends FCM to **all shop tokens** (everyone logged into main app). |
| **Agent FCM** | **Not implemented.** Driver app does not register FCM; there is no token storage or backend send to agents. |
| **POS orders** | Created in client via `useCreateOrder()` → `addDoc(ordersRef, orderData)` with `orderSource: "pos"`. No trigger today, so **no notification** for new POS orders. |
| **Order status updates** | Plant/Shop update status in Firestore (e.g. `ready`, `ready_for_pickup`, `out_for_delivery`). No Firestore trigger on order **update**, so **no notification** when status changes. |

---

## 3. Notification Scenarios (Complete List)

### 3.1 New order placed

| Scenario | Who should be notified | Notes |
|----------|-------------------------|--------|
| **New online order** (public page) | Shop owner (+ staff on main app), **Assigned agent** (if any) | Already: shop. **Add:** assigned agent. |
| **New POS order** with **home pickup/delivery** and **assigned agent** | Shop owner, **Assigned agent** | New. Trigger on order create when `orderSource === 'pos'` and delivery type is pickup_home/delivery_home and `assignedAgentId` is set. |
| **New POS order – shop pickup only** | Optional: shop only (same as “new order” badge). | Can use same “new order” trigger and send to shop only when no agent. |

### 3.2 Plant / status updates (material ready / dispatched)

| Scenario | Who should be notified | Notes |
|----------|-------------------------|--------|
| **Order marked “Ready” or “Ready for pickup”** (plant finished processing) | Shop owner, **Assigned agent** (if any) | “Material is ready” / “Ready for delivery”. Agent can plan pickup/delivery. |
| **Order marked “Out for delivery”** (plant dispatched) | Shop owner, **Assigned agent** | “Order dispatched from plant” – agent should go deliver. |

### 3.3 Other useful scenarios (recommended)

| Scenario | Who | Priority |
|----------|-----|----------|
| **Order cancelled** | Assigned agent (if any) | So agent doesn’t go for pickup/delivery. |
| **Agent reassigned to order** | New agent | “You have been assigned to order #XXX.” |
| **Payment collected at delivery** | Shop owner | Optional; can be phase 2. |

---

## 4. Scenarios Summary Table

| # | Event | Shop owner | Assigned agent |
|---|--------|------------|----------------|
| 1 | New **online** order | ✅ (existing) | ✅ (new) |
| 2 | New **POS** order (pickup_home / delivery_home) with agent | ✅ (new) | ✅ (new) |
| 3 | Order status → **ready** / **ready_for_pickup** | ✅ (new) | ✅ (new) |
| 4 | Order status → **out_for_delivery** | ✅ (new) | ✅ (new) |
| 5 | Order **cancelled** (has assigned agent) | Optional | ✅ (new) |
| 6 | **Agent reassigned** to order | Optional | ✅ (new – notify new agent) |

---

## 5. Architecture

### 5.1 Where to send from

- **Backend only:** All FCM sends from **Firebase Cloud Functions** (Firestore triggers). No FCM send from client.
- **Triggers:**
  - **onDocumentCreated** `shops/{shopId}/orders/{orderId}` – new order (online + POS).
  - **onDocumentUpdated** (or **onDocumentWritten**) `shops/{shopId}/orders/{orderId}` – status/field changes (ready, out_for_delivery, cancelled, reassign).

### 5.2 Token storage for agents

- **Shop tokens (existing):** `shops/{shopId}/notificationTokens/{userId}` — `userId` = Firebase Auth UID of anyone using the **main app** (owner/staff). No change.
- **Agent tokens (new):** `shops/{shopId}/agentNotificationTokens/{agentId}` where `agentId` = **teamMember id** (same as `order.assignedAgentId`).
  - Document: `{ token: string, updatedAt: Timestamp }`.
  - One doc per agent; driver app overwrites `token` when it gets a new FCM token (e.g. on login or token refresh).
- **Why by agentId:** Orders store `assignedAgentId` (teamMember id). Trigger can directly read `shops/{shopId}/agentNotificationTokens/{assignedAgentId}` to get the token(s). No need to resolve auth UID in the trigger.

### 5.3 Helper in Cloud Functions

- **Existing:** `getShopFcmTokens(shopId)` → returns array of FCM tokens for the shop (from `notificationTokens` subcollection).
- **New:** `getAgentFcmToken(shopId, agentId)` → returns the token string (or array if we support multiple devices later) for that agent from `shops/{shopId}/agentNotificationTokens/{agentId}`. If no doc or no `token`, return empty array.

### 5.4 Notification payloads (data + optional notification)

- **data** (always): `type`, `orderId`, `shopId`, `publicId` (or `orderNumber`) so the app can open the right order.
- **notification** (optional): `title`, `body` for display when app is in background.
- **Types:** e.g. `new_online_order`, `new_pos_order_assigned`, `order_ready`, `order_out_for_delivery`, `order_cancelled`, `order_assigned_to_you`.

---

## 6. Implementation Steps

### Phase 1 – Agent FCM registration (driver app)

1. **Firestore**
   - Add collection: `shops/{shopId}/agentNotificationTokens/{agentId}`.
   - Rules: allow **create/update** only if the authenticated user is that agent (e.g. `get(..., teamMembers/{agentId}).authUid == request.auth.uid`). Allow **read** for shop members if needed for debugging; Cloud Functions use admin SDK and bypass rules.

2. **Driver app**
   - Reuse same FCM setup as main app (same `firebase-messaging-sw.js`, same VAPID key; optional: separate sender id if you use a different Firebase project for driver app).
   - After successful login and when `agent.id` and `shopId` are available: request notification permission, get FCM token, then `setDoc(shops/{shopId}/agentNotificationTokens/{agent.id}, { token, updatedAt: serverTimestamp() }, { merge: true })`.
   - On token refresh (e.g. `onTokenRefresh` if using Firebase Messaging in a native wrapper, or when app resumes and token might have changed), update the same doc.
   - Optional: foreground handler to play sound / show in-app message when a notification is received (e.g. “New order assigned to you”).

### Phase 2 – Backend: shared notification helper

3. **Functions**
   - Add a small **notifications** helper module (e.g. `functions/src/services/order-notifications.ts`):
     - `getShopFcmTokens(shopId)` – move or duplicate from current trigger.
     - `getAgentFcmToken(shopId, agentId)` – read `shops/{shopId}/agentNotificationTokens/{agentId}` and return token(s).
     - `sendOrderNotification({ shopId, orderId, publicId, orderNumber, customerName, type, recipient: 'shop' | 'agent' | 'both', assignedAgentId?: string })`:
       - Resolve tokens: shop from `getShopFcmTokens`, agent from `getAgentFcmToken(shopId, assignedAgentId)` when recipient includes agent.
       - Build `data` + `notification` by `type`.
       - Call `admin.messaging().send()` for each token (or `sendEachForMulticast`), handle invalid token removal if needed.

### Phase 3 – New order created (online + POS)

4. **onDocumentCreated** `shops/{shopId}/orders/{orderId}` (extend or unify)
   - **If** `orderSource === 'online'`:
     - Keep existing: customer email + FCM to **shop**.
     - **Add:** If `assignedAgentId` is set, call `sendOrderNotification(..., recipient: 'agent', assignedAgentId)` (or include agent in a single “both” call).
   - **Else if** `orderSource === 'pos'`:
     - If `deliveryType` is `pickup_home` or `delivery_home` **and** `assignedAgentId` is set:
       - Send FCM to **shop** (e.g. “New POS order #XXX – assigned to &lt;agent&gt;”).
       - Send FCM to **agent** (e.g. “New order #XXX assigned to you”).
   - Optional: for POS shop-pickup-only orders, send only to shop (e.g. “New order #XXX”) so shop owner sees it.

### Phase 4 – Order updated (ready / out_for_delivery / cancelled / reassign)

5. **onDocumentUpdated** `shops/{shopId}/orders/{orderId}`  
   - Compare **before** and **after** (`event.data.before.data()`, `event.data.after.data()`).
   - **Status changed to `ready` or `ready_for_pickup`:**
     - Notify **shop**: “Order #XXX is ready.”
     - If `assignedAgentId` present, notify **agent**: “Order #XXX is ready for delivery.”
   - **Status changed to `out_for_delivery`:**
     - Notify **shop**: “Order #XXX is out for delivery.”
     - If `assignedAgentId` present, notify **agent**: “Order #XXX is out for delivery – dispatch from plant.”
   - **Status changed to `cancelled`:**
     - If there was an `assignedAgentId` (from before or after), notify **agent**: “Order #XXX has been cancelled.”
   - **assignedAgentId changed** (reassign):
     - Notify **new** agent: “Order #XXX has been assigned to you.” (Use `after.assignedAgentId`; optionally notify old agent “Order #XXX unassigned from you” – can be phase 2.)

### Phase 5 – Frontend (main app) – optional

6. **Main app** already registers FCM and receives “new online order”. Extend foreground handler to support new `data.type` values (e.g. `order_ready`, `order_out_for_delivery`) so that when the app is in foreground, it can show a toast or play sound and/or refresh order list.

### Phase 6 – Cleanup and edge cases

7. **Invalid tokens**
   - When FCM returns `messaging/registration-token-not-registered` (or similar), delete that token doc so we don’t keep sending. For shop: delete `notificationTokens/{userId}`; for agent: clear or delete `agentNotificationTokens/{agentId}` (or remove that token from a list if we support multiple devices later).
8. **No token**
   - If `getAgentFcmToken` returns empty (agent never opened driver app or denied permission), skip send; no error. Same for shop.

---

## 7. File / Code Touch Points

| Area | File(s) | Change |
|------|--------|--------|
| Firestore rules | `firestore.rules` | Add `shops/{shopId}/agentNotificationTokens/{agentId}` with write for the agent (authUid match). |
| Driver app FCM | New hook e.g. `useAgentFcmToken.ts` (or inside `DriverAuthContext` / layout) | Register FCM, write token to `shops/{shopId}/agentNotificationTokens/{agent.id}`. |
| Functions – helpers | New `functions/src/services/order-notifications.ts` | `getShopFcmTokens`, `getAgentFcmToken`, `sendOrderNotification`. |
| Functions – trigger create | `functions/src/triggers/on-public-order-created.ts` (or rename to `on-order-created.ts`) | Handle both online (add agent notify) and POS (shop + agent when delivery + assigned). |
| Functions – trigger update | New `functions/src/triggers/on-order-updated.ts` | onDocumentUpdated orders; on status/assignedAgentId change, call `sendOrderNotification`. |
| Functions – index | `functions/src/index.ts` | Export new trigger `onOrderUpdated`. |
| Main app foreground | `use-fcm-token.ts` or `AppLayout` | Optionally handle new `data.type` for order_ready / order_out_for_delivery. |
| Driver app foreground | Driver app layout | Optional: handle FCM foreground and show “New order assigned” / “Order ready” etc. |

---

## 8. What We Are Not Changing

- Customer email flow (order confirmation) – unchanged.
- Main app FCM registration path (`notificationTokens/{userId}`) – unchanged.
- Order creation logic (public or POS) – no change; only adding triggers that react to created/updated docs.

---

## 9. Testing Checklist

- [ ] New **online** order: shop gets FCM; **assigned agent** gets FCM (if agent has token).
- [ ] New **POS** order (pickup_home/delivery_home + assigned agent): shop and that agent get FCM.
- [ ] New POS order (shop pickup only): at least shop gets FCM (if we add that).
- [ ] Plant marks order **ready** / **ready_for_pickup**: shop and assigned agent get FCM.
- [ ] Plant marks order **out_for_delivery**: shop and assigned agent get FCM.
- [ ] Order **cancelled** (had assigned agent): agent gets FCM.
- [ ] **Reassign** agent: new agent gets FCM.
- [ ] Agent never opened driver app: no token; no crash; only shop gets notifications.
- [ ] Invalid token: after send failure, token is removed so we don’t keep retrying.

---

## 10. Summary

- **Scenarios covered:** New online order (shop + agent), new POS delivery order (shop + agent), order ready/ready_for_pickup (shop + agent), order out_for_delivery (shop + agent), order cancelled (agent), agent reassigned (new agent).
- **New pieces:** Agent FCM token storage and driver-app registration; shared `order-notifications` helper in Functions; one trigger on order **create** (unified for online + POS), one trigger on order **update** (status + reassign).
- **No rollbacks, no change to existing order creation or status update logic** – only additive triggers and client-side FCM registration for the driver app.

Once you approve this plan, we can implement it step by step (e.g. Phase 1 → 2 → 3 → 4) and then run through the testing checklist.
