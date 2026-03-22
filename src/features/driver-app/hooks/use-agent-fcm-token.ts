/**
 * Agent FCM Token Registration
 *
 * Registers the current device for push notifications and saves the token
 * to Firestore at shops/{shopId}/agentNotificationTokens/{agentId}.
 * Used to notify the assigned agent for new orders, order ready, out for delivery, etc.
 * Only runs when memberType === 'agent' (not for plant users).
 */

import { useEffect, useRef } from "react";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, app } from "@/lib/firebase";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

/** Save Android FCM token for agent to Firestore (agentNotificationTokens/{agentId}_android). */
async function saveAgentAndroidFcmToken(shopId: string, agentId: string, token: string): Promise<void> {
  const tokenRef = doc(db, "shops", shopId, "agentNotificationTokens", `${agentId}_android`);
  await setDoc(
    tokenRef,
    {
      token,
      agentId,
      updatedAt: serverTimestamp(),
      platform: "android",
    },
    { merge: true }
  );
  console.log("[Agent FCM] Android token saved for agent", agentId, "shop", shopId);
}

export function useAgentFcmToken(
  shopId: string | null,
  agentId: string | null,
  memberType?: string
) {
  const hasRequested = useRef(false);

  // Web FCM: VAPID + service worker token
  useEffect(() => {
    if (!shopId || !agentId || memberType !== "agent" || !VAPID_KEY) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (hasRequested.current) return;

    let mounted = true;

    const register = async () => {
      try {
        const supported = await isSupported();
        if (!supported || !mounted) return;

        const permission = await Notification.requestPermission();
        if (permission !== "granted" || !mounted) return;

        hasRequested.current = true;

        const registration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
          { scope: "/" }
        );

        const messaging = getMessaging(app);
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: registration,
        });

        if (token && mounted) {
          const tokenRef = doc(db, "shops", shopId, "agentNotificationTokens", agentId);
          await setDoc(
            tokenRef,
            {
              token,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch (err) {
        console.warn("Agent FCM registration failed:", err);
      }
    };

    register();

    return () => {
      mounted = false;
    };
  }, [shopId, agentId, memberType]);

  // Android WebView: listen for FCM token from native app (window.androidFcmToken / android-fcm-token event)
  useEffect(() => {
    if (!shopId || !agentId || memberType !== "agent" || typeof window === "undefined") return;

    const handleToken = (token: string) => {
      if (!token || typeof token !== "string") return;
      saveAgentAndroidFcmToken(shopId, agentId, token).catch((err) =>
        console.warn("[Agent FCM] Failed to save Android token:", err)
      );
    };

    const onFcmToken = (e: Event) => {
      const d = (e as CustomEvent).detail;
      // Android may dispatch detail as a plain string or as { token: string }
      const token = typeof d === "string" ? d : d?.token;
      if (token) handleToken(token);
    };

    window.addEventListener("android-fcm-token", onFcmToken);

    // Token may have been set before React mounted
    const w = window as Window & { androidFcmToken?: string };
    if (w.androidFcmToken) {
      handleToken(w.androidFcmToken);
    }

    return () => window.removeEventListener("android-fcm-token", onFcmToken);
  }, [shopId, agentId, memberType]);
}
