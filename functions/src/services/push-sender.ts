/**
 * Unified push sender — routes each device token to the correct delivery
 * channel based on its type:
 *
 *  - Expo push tokens  (tokenType:"expo" or "ExponentPushToken[...]") → Expo push
 *    service (https://exp.host/--/api/v2/push/send). Used by the mobile app
 *    after the migration from native @react-native-firebase/messaging to
 *    expo-notifications.
 *  - FCM tokens (everything else) → admin.messaging() (Firebase Cloud Messaging).
 *    Used by the web app and the agent/driver app.
 *
 * Both paths return the set of invalid/expired tokens so callers can prune them.
 * No external dependency — uses Node 20's global fetch + firebase-admin.
 */

import * as admin from "firebase-admin";

export interface PushTarget {
  token: string;
  /** "expo" | "fcm" | undefined. When absent, the token string format decides. */
  tokenType?: string;
}

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  /** Android notification channel id. */
  channelId?: string;
  priority?: "high" | "normal";
}

export interface PushResult {
  successCount: number;
  failureCount: number;
  /** Tokens the providers reported as unregistered/invalid — safe to delete. */
  invalidTokens: string[];
}

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_CHUNK = 100; // Expo accepts up to 100 messages per request
const FCM_CHUNK = 500; // FCM multicast accepts up to 500 tokens per request

export function isExpoToken(t: PushTarget): boolean {
  if (t.tokenType === "expo") return true;
  if (t.tokenType === "fcm") return false;
  return (
    t.token.startsWith("ExponentPushToken[") ||
    t.token.startsWith("ExpoPushToken[")
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Send to FCM tokens via admin.messaging() multicast. */
async function sendViaFcm(targets: PushTarget[], msg: PushMessage): Promise<PushResult> {
  const result: PushResult = { successCount: 0, failureCount: 0, invalidTokens: [] };
  if (targets.length === 0) return result;

  const messaging = admin.messaging();
  for (const group of chunk(targets, FCM_CHUNK)) {
    const tokens = group.map((t) => t.token);
    try {
      const resp = await messaging.sendEachForMulticast({
        tokens,
        notification: {
          title: msg.title,
          body: msg.body,
          ...(msg.imageUrl ? { imageUrl: msg.imageUrl } : {}),
        },
        data: msg.data ?? {},
        android: {
          priority: (msg.priority ?? "high") as "high" | "normal",
          notification: {
            channelId: msg.channelId ?? "default",
            icon: "ic_launcher",
          },
        },
      });
      result.successCount += resp.successCount;
      result.failureCount += resp.failureCount;
      resp.responses.forEach((r, idx) => {
        if (!r.success && r.error?.code === "messaging/registration-token-not-registered") {
          result.invalidTokens.push(tokens[idx]);
        }
      });
    } catch (e) {
      console.error("FCM multicast failed:", e);
      result.failureCount += tokens.length;
    }
  }
  return result;
}

/** Send to Expo push tokens via the Expo push service. */
async function sendViaExpo(targets: PushTarget[], msg: PushMessage): Promise<PushResult> {
  const result: PushResult = { successCount: 0, failureCount: 0, invalidTokens: [] };
  if (targets.length === 0) return result;

  for (const group of chunk(targets, EXPO_CHUNK)) {
    const messages = group.map((t) => ({
      to: t.token,
      title: msg.title,
      body: msg.body,
      data: msg.data ?? {},
      sound: "default" as const,
      priority: (msg.priority === "normal" ? "normal" : "high") as "normal" | "high",
      ...(msg.channelId ? { channelId: msg.channelId } : {}),
      ...(msg.imageUrl ? { richContent: { image: msg.imageUrl } } : {}),
    }));

    try {
      const res = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });

      if (!res.ok) {
        console.error("Expo push HTTP error:", res.status, await res.text().catch(() => ""));
        result.failureCount += group.length;
        continue;
      }

      const json = (await res.json()) as {
        data?: Array<{
          status: "ok" | "error";
          id?: string;
          message?: string;
          details?: { error?: string };
        }>;
      };
      const tickets = json.data ?? [];
      tickets.forEach((ticket, idx) => {
        if (ticket.status === "ok") {
          result.successCount++;
        } else {
          result.failureCount++;
          if (ticket.details?.error === "DeviceNotRegistered") {
            result.invalidTokens.push(group[idx].token);
          }
        }
      });
    } catch (e) {
      console.error("Expo push request failed:", e);
      result.failureCount += group.length;
    }
  }
  return result;
}

/**
 * Send a push message to a mixed set of Expo + FCM tokens.
 * Routes each token to the correct provider and merges the results.
 */
export async function sendPush(targets: PushTarget[], msg: PushMessage): Promise<PushResult> {
  const valid = targets.filter((t) => t && typeof t.token === "string" && t.token.length > 0);
  const expo = valid.filter(isExpoToken);
  const fcm = valid.filter((t) => !isExpoToken(t));

  const [expoRes, fcmRes] = await Promise.all([sendViaExpo(expo, msg), sendViaFcm(fcm, msg)]);

  return {
    successCount: expoRes.successCount + fcmRes.successCount,
    failureCount: expoRes.failureCount + fcmRes.failureCount,
    invalidTokens: [...expoRes.invalidTokens, ...fcmRes.invalidTokens],
  };
}
