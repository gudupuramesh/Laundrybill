/**
 * FCM Token Registration for Super Admin
 *
 * Registers the current device for push notifications and saves the token
 * to Firestore at `superAdminNotificationTokens/{adminId}`.
 * Used so Cloud Functions can notify super admins on new shop registrations, etc.
 */

import { useEffect, useRef } from "react";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { FirebaseApp } from "firebase/app";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export function useSuperAdminFcmToken(
  app: FirebaseApp | null,
  adminId: string | null
) {
  const hasRequested = useRef(false);

  useEffect(() => {
    if (!app || !adminId || !VAPID_KEY) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (hasRequested.current) return;

    let mounted = true;

    const register = async () => {
      try {
        const supported = await isSupported();
        if (!supported || !mounted) return;

        const permission = await Notification.requestPermission();
        if (permission !== "granted" || !mounted) return;

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
          const tokenRef = doc(db, "superAdminNotificationTokens", adminId);
          await setDoc(
            tokenRef,
            {
              token,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          // Only mark as done AFTER successful save — allows retry if setDoc fails
          hasRequested.current = true;
          console.log("[Super Admin FCM] Token saved to Firestore successfully. You will receive push notifications for new shop registrations.");
        }
      } catch (err) {
        console.warn("Super Admin FCM registration failed:", err);
      }
    };

    register();

    return () => {
      mounted = false;
    };
  }, [app, adminId]);
}

/**
 * Handle foreground messages for Super Admin (play sound for new_shop_registered, etc.)
 */
export function useSuperAdminFcmForeground(app: FirebaseApp | null) {
  useEffect(() => {
    if (!app || typeof window === "undefined") return;

    const setup = async () => {
      try {
        const supported = await isSupported();
        if (!supported) return;

        const messaging = getMessaging(app);
        onMessage(messaging, (payload: unknown) => {
          const data = (payload as { data?: { type?: string } })?.data;
          const notif = (payload as { notification?: { title?: string; body?: string } })?.notification;
          if (data?.type === "new_shop_registered" && notif) {
            // Show browser notification when app is in foreground
            try {
              new Notification(notif.title || "New Shop", { body: notif.body });
            } catch {
              // Notification not supported
            }
          }
        });
      } catch {
        // Messaging not available
      }
    };

    setup();
  }, [app]);
}
