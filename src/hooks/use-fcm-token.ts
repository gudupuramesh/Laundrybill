/**
 * FCM Token Registration
 *
 * Registers the current device for push notifications and saves the token
 * to Firestore. Used to notify shop owners when new online orders arrive.
 */

import { useEffect, useRef } from "react";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { FirebaseApp } from "firebase/app";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

/** Save Android FCM token to Firestore (shops/{shopId}/notificationTokens/{userId}_android). */
async function saveAndroidFcmToken(shopId: string, userId: string, token: string): Promise<void> {
  const tokenRef = doc(db, "shops", shopId, "notificationTokens", `${userId}_android`);
  await setDoc(
    tokenRef,
    {
      token,
      updatedAt: serverTimestamp(),
      platform: "android",
    },
    { merge: true }
  );
  console.log("[FCM] Android token saved for shop", shopId);
}

export function useFcmTokenRegistration(
  app: FirebaseApp | null,
  shopId: string | null,
  userId: string | null
) {
  const hasRequested = useRef(false);

  // Web FCM: VAPID + service worker token
  useEffect(() => {
    if (!app || !shopId || !userId || !VAPID_KEY) return;
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
          const tokenRef = doc(db, "shops", shopId, "notificationTokens", userId);
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
        console.warn("FCM registration failed:", err);
      }
    };

    register();

    return () => {
      mounted = false;
    };
  }, [app, shopId, userId]);

  // Android WebView: listen for FCM token from native app (window.androidFcmToken / android-fcm-token event)
  useEffect(() => {
    if (!shopId || !userId || typeof window === "undefined") return;

    const handleToken = (token: string) => {
      if (!token || typeof token !== "string") return;
      saveAndroidFcmToken(shopId, userId, token).catch((err) =>
        console.warn("[FCM] Failed to save Android token:", err)
      );
    };

    const onFcmToken = (e: Event) => {
      const d = (e as CustomEvent).detail;
      // Android may dispatch detail as a plain string or as { token: string }
      const token = typeof d === "string" ? d : d?.token;
      if (token) handleToken(token);
    };

    window.addEventListener("android-fcm-token", onFcmToken);

    // Token may have been set before React mounted (e.g. by MainActivity.kt)
    const w = window as Window & { androidFcmToken?: string };
    if (w.androidFcmToken) {
      handleToken(w.androidFcmToken);
    }

    return () => window.removeEventListener("android-fcm-token", onFcmToken);
  }, [shopId, userId]);
}

/** Play a short notification sound (no external file needed) */
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.frequency.value = 800;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch {
    // Audio not supported
  }
}

/**
 * Hook to handle foreground messages (when app is open).
 * Plays sound for new online order; optionally calls onMessageReceived.
 */
export function useFcmForegroundHandler(app: FirebaseApp | null, onMessageReceived?: (payload: unknown) => void) {
  useEffect(() => {
    if (!app || typeof window === "undefined") return;

    const setup = async () => {
      try {
        const supported = await isSupported();
        if (!supported) return;

        const messaging = getMessaging(app);
        onMessage(messaging, (payload: unknown) => {
          const data = (payload as { data?: { type?: string } })?.data;
          const type = data?.type;
          if (
            type === "new_online_order" ||
            type === "new_pos_order" ||
            type === "order_ready" ||
            type === "order_out_for_delivery"
          ) {
            playNotificationSound();
          }
          onMessageReceived?.(payload);
        });
      } catch {
        // Messaging not available
      }
    };

    setup();
  }, [app, onMessageReceived]);
}
