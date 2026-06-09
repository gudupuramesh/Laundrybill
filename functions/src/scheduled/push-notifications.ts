/**
 * Scheduled & Callable Push Notification Functions
 *
 * 1. sendUpgradeReminders — Scheduled (runs daily), sends push to free/trial users
 * 2. sendAdminNotification — Callable, admin sends custom push to user segments
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { sendPush, PushTarget } from "../services/push-sender";

const db = admin.firestore();

/** Collect push targets (token + tokenType) from a shop's notificationTokens. */
async function collectShopTargets(
  shopId: string,
): Promise<{ targets: PushTarget[]; refByToken: Map<string, FirebaseFirestore.DocumentReference> }> {
  const snap = await db.collection(`shops/${shopId}/notificationTokens`).get();
  const targets: PushTarget[] = [];
  const refByToken = new Map<string, FirebaseFirestore.DocumentReference>();
  snap.docs.forEach((d) => {
    const data = d.data();
    const token = data.token;
    if (token && typeof token === "string") {
      targets.push({ token, tokenType: data.tokenType });
      refByToken.set(token, d.ref);
    }
  });
  return { targets, refByToken };
}

// ────────────────────────────────────────────────────────────────────────
// 1. SCHEDULED: Upgrade Reminders
//    Runs every day at 10:00 AM IST (04:30 UTC)
// ────────────────────────────────────────────────────────────────────────

export const sendUpgradeReminders = functions.pubsub
  .schedule("30 4 * * *") // 10:00 AM IST daily
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    try {
      // 1. Read notification settings from admin config
      const configSnap = await db.collection("platformSettings").doc("notifications").get();
      const config = configSnap.data() || {};

      if (config.upgradeRemindersEnabled === false) {
        console.log("Upgrade reminders disabled by admin");
        return;
      }

      const intervalDays = config.upgradeReminderIntervalDays || 2; // default every 2 days
      const reminderTitle = config.upgradeReminderTitle || "Upgrade to Pro";
      const reminderBody = config.upgradeReminderBody || "Get unlimited orders, reports & more. Upgrade to Pro today!";

      // 2. Find all free plan subscriptions
      const subsSnap = await db.collection("subscriptions")
        .where("planId", "==", "free")
        .get();

      if (subsSnap.empty) {
        console.log("No free users found");
        return;
      }

      let sentCount = 0;
      let skipCount = 0;

      for (const subDoc of subsSnap.docs) {
        const shopId = subDoc.id;
        const subData = subDoc.data();

        // Check interval — skip if reminded too recently
        const lastReminder = subData.lastUpgradeReminder?.toDate?.() || null;
        if (lastReminder) {
          const daysSince = (Date.now() - lastReminder.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince < intervalDays) {
            skipCount++;
            continue;
          }
        }

        // Get all device tokens (Expo + FCM) for this shop
        const { targets, refByToken } = await collectShopTargets(shopId);

        if (targets.length === 0) {
          skipCount++;
          continue;
        }

        // Send push notification (routed to Expo / FCM per token)
        try {
          const response = await sendPush(targets, {
            title: reminderTitle,
            body: reminderBody,
            data: { type: "upgrade_reminder", shopId },
            channelId: "upgrade_reminders",
            priority: "normal",
          });

          // Clean up invalid tokens
          response.invalidTokens.forEach((invalidToken) => {
            refByToken.get(invalidToken)?.delete().catch(() => {});
          });

          // Update last reminder timestamp
          await subDoc.ref.update({ lastUpgradeReminder: admin.firestore.FieldValue.serverTimestamp() });
          sentCount++;
        } catch (e) {
          console.error(`Failed to send upgrade reminder to shop ${shopId}:`, e);
        }
      }

      console.log(`Upgrade reminders: sent=${sentCount}, skipped=${skipCount}`);
    } catch (e) {
      console.error("sendUpgradeReminders error:", e);
    }
  });

// ────────────────────────────────────────────────────────────────────────
// 2. CALLABLE: Admin Send Custom Notification
//    Admin can send push to: all, free, trial, pro, or specific shop
// ────────────────────────────────────────────────────────────────────────

export const sendAdminNotification = functions.https.onCall(async (data, context) => {
  // Verify caller is super admin
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  }
  const adminSnap = await db.collection("super_admins").doc(context.auth.uid).get();
  if (!adminSnap.exists) {
    throw new functions.https.HttpsError("permission-denied", "Super admin access required");
  }

  const { title, body, target, shopId: specificShopId, imageUrl } = data as {
    title: string;
    body: string;
    target: "all" | "free" | "trial" | "pro" | "specific";
    shopId?: string;
    imageUrl?: string;
  };

  if (!title || !body) {
    throw new functions.https.HttpsError("invalid-argument", "Title and body are required");
  }

  let shopIds: string[] = [];

  if (target === "specific" && specificShopId) {
    shopIds = [specificShopId];
  } else if (target === "all") {
    const shopsSnap = await db.collection("shops").select().get();
    shopIds = shopsSnap.docs.map((d) => d.id);
  } else {
    // Filter by subscription plan
    const planFilter = target === "free" ? ["free"] :
                       target === "pro" ? ["pro", "pro_monthly", "pro_yearly"] : [];
    if (planFilter.length > 0) {
      const subsSnap = await db.collection("subscriptions")
        .where("planId", "in", planFilter)
        .get();
      shopIds = subsSnap.docs.map((d) => d.id);
    }
  }

  let totalSent = 0;
  let totalFailed = 0;

  // Process in batches to avoid memory issues
  const batchSize = 50;
  for (let i = 0; i < shopIds.length; i += batchSize) {
    const batch = shopIds.slice(i, i + batchSize);

    await Promise.all(batch.map(async (sid) => {
      const { targets, refByToken } = await collectShopTargets(sid);

      if (targets.length === 0) return;

      try {
        const response = await sendPush(targets, {
          title,
          body,
          data: { type: "admin_notification" },
          imageUrl,
          channelId: "admin_notifications",
          priority: "high",
        });
        totalSent += response.successCount;
        totalFailed += response.failureCount;

        // Clean invalid tokens
        response.invalidTokens.forEach((invalidToken) => {
          refByToken.get(invalidToken)?.delete().catch(() => {});
        });
      } catch (e) {
        console.error(`Failed to send to shop ${sid}:`, e);
        totalFailed += targets.length;
      }
    }));
  }

  // Log the notification for history
  await db.collection("platformSettings").doc("notifications").collection("history").add({
    title,
    body,
    target,
    shopId: specificShopId || null,
    sentBy: context.auth.uid,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    totalShops: shopIds.length,
    totalSent,
    totalFailed,
  });

  return { success: true, totalShops: shopIds.length, totalSent, totalFailed };
});
