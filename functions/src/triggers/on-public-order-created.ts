/**
 * Trigger: When a new order is created
 * - orderSource === 'online': customer confirmation email + FCM to shop + FCM to assigned agent (if any)
 * - orderSource === 'pos': FCM to shop; if pickup_home/delivery_home and assigned agent, also FCM to agent
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { sendEmail } from "../services/zeptomail";
import { getPlatformSettings } from "../services/platform-settings";
import { getPublicOrderConfirmationCustomerEmail } from "../services/public-order-email";
import { sendOrderNotification } from "../services/order-notifications";
import { getShopCurrencySymbol } from "../services/currency-helper";

const db = admin.firestore();

function getTrackingUrl(publicId: string, appUrl: string): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/track/${publicId}`;
}

export const onPublicOrderCreated = onDocumentCreated(
  "shops/{shopId}/orders/{orderId}",
  async (event) => {
    const orderData = event.data?.data();
    const shopId = event.params.shopId;
    const orderId = event.params.orderId;

    if (!orderData) return;

    const publicId = orderData.publicId || orderData.orderNumber;
    const customerName = orderData.customerName || "Customer";
    const orderNumber = orderData.orderNumber;

    // ---------- Plant: a drop-off order enters the processing queue at creation ----------
    // (Home-pickup orders enter the queue later, on pickup_completed — see on-order-updated.)
    if (orderData.status === "pending" && orderData.deliveryType !== "pickup_home") {
      try {
        await sendOrderNotification({
          shopId,
          orderId,
          publicId,
          orderNumber,
          customerName,
          type: "plant_new_order",
          recipient: "plant",
        });
      } catch (err) {
        console.error("Failed to send plant new-order FCM:", err);
      }
    }

    // ---------- Online order: customer email + shop + agent notifications ----------
    if (orderData.orderSource === "online") {
      const settings = await getPlatformSettings();
      const appUrl = settings.appUrl || "https://app.laundrybill.com";
      const trackingUrl = getTrackingUrl(publicId, appUrl);

      // 1. Email to customer (if email present)
      const customerEmail = orderData.customerEmail;
      if (customerEmail && typeof customerEmail === "string" && customerEmail.includes("@")) {
        try {
          const items = (orderData.items || []).map(
            (i: { serviceName?: string; categoryName?: string; quantity: number; total?: number }) => ({
              name: [i.serviceName, i.categoryName].filter(Boolean).join(" ") || "Item",
              quantity: i.quantity || 1,
              total: i.total,
            })
          );
          const pickupDate = orderData.scheduledPickupDate?.toDate?.()
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
            getShopCurrencySymbol(shopId),
          ]);
          const html = getPublicOrderConfirmationCustomerEmail({
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
            total: orderData.financials?.total || 0,
            isQuickOrder: orderData.isQuickOrder === true,
            currencySymbol,
            settings,
          });
          await sendEmail({
            to: [{ address: customerEmail, name: customerName }],
            subject: `Order confirmed #${publicId} – ${orderData.shopName || "Your laundry"}`,
            htmlBody: html,
          });
          console.log(`Order confirmation email sent to ${customerEmail}`);
        } catch (err) {
          console.error("Failed to send order confirmation email:", err);
        }
      }

      // 2. FCM to shop (owner) and assigned agent
      try {
        await sendOrderNotification({
          shopId,
          orderId,
          publicId,
          orderNumber,
          customerName,
          type: "new_online_order",
          recipient: orderData.assignedAgentId ? "both" : "shop",
          assignedAgentId: orderData.assignedAgentId || null,
        });
      } catch (err) {
        console.error("Failed to send FCM for online order:", err);
      }

      // 3. Team-app staff + manager: a new online order needs confirmation/handling.
      try {
        await sendOrderNotification({
          shopId, orderId, publicId, orderNumber, customerName,
          type: "staff_new_online_order", recipient: "staff",
        });
        await sendOrderNotification({
          shopId, orderId, publicId, orderNumber, customerName,
          type: "manager_new_online_order", recipient: "manager",
        });
      } catch (err) {
        console.error("Failed to send staff/manager FCM for online order:", err);
      }
      return;
    }

    // ---------- POS order: shop + agent (if delivery and assigned) ----------
    if (orderData.orderSource === "pos") {
      try {
        const isDelivery =
          orderData.deliveryType === "pickup_home" || orderData.deliveryType === "delivery_home";
        const assignedAgentId = orderData.assignedAgentId || null;

        if (isDelivery && assignedAgentId) {
          await sendOrderNotification({
            shopId,
            orderId,
            publicId,
            orderNumber,
            customerName,
            type: "new_pos_order",
            recipient: "shop",
          });
          await sendOrderNotification({
            shopId,
            orderId,
            publicId,
            orderNumber,
            customerName,
            type: "new_pos_order_assigned",
            recipient: "agent",
            assignedAgentId,
          });
        } else {
          await sendOrderNotification({
            shopId,
            orderId,
            publicId,
            orderNumber,
            customerName,
            type: "new_pos_order",
            recipient: "shop",
          });
        }
      } catch (err) {
        console.error("Failed to send FCM for POS order:", err);
      }
    }
  }
);

async function getShopName(shopId: string): Promise<string> {
  const doc = await db.collection("shops").doc(shopId).get();
  return doc.data()?.name || "Shop";
}

async function getShopAddress(shopId: string): Promise<string | undefined> {
  const doc = await db.collection("shops").doc(shopId).get();
  const loc = doc.data()?.location;
  if (!loc) return undefined;
  return [loc.address, loc.city, loc.pincode].filter(Boolean).join(", ") || undefined;
}

async function getShopPhone(shopId: string): Promise<string | undefined> {
  const doc = await db.collection("shops").doc(shopId).get();
  return doc.data()?.phone;
}
