/**
 * Push Notification Registration & Handling for Mobile App
 * - Requests permission
 * - Gets FCM token and saves to Firestore
 * - Handles foreground & background messages
 */
import { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { firestore } from './db';
import { auth, getShopId } from './auth';

/**
 * Registers FCM token and listens for push notifications.
 * Call this once in your root App component.
 */
export function usePushNotifications(onNotificationTap?: (data: any) => void) {
  const tokenSaved = useRef(false);

  useEffect(() => {
    let unsubOnMessage: (() => void) | undefined;

    const setup = async () => {
      try {
        // 1. Request permission (iOS needs explicit, Android auto-grants)
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (!enabled) {
          console.log('Push notification permission denied');
          return;
        }

        // 2. Get FCM token
        const token = await messaging().getToken();
        if (token) {
          await saveTokenToFirestore(token);
        }

        // 3. Listen for token refresh
        messaging().onTokenRefresh(async (newToken) => {
          await saveTokenToFirestore(newToken);
        });

        // 4. Handle foreground messages (app open)
        unsubOnMessage = messaging().onMessage(async (remoteMessage) => {
          // Show a local alert for foreground notifications
          const title = remoteMessage.notification?.title || 'LaundryBill';
          const body = remoteMessage.notification?.body || '';
          Alert.alert(title, body);
        });

        // 5. Handle notification tap when app was in background
        messaging().onNotificationOpenedApp((remoteMessage) => {
          if (onNotificationTap && remoteMessage.data) {
            onNotificationTap(remoteMessage.data);
          }
        });

        // 6. Check if app was opened from a killed state notification
        const initialNotification = await messaging().getInitialNotification();
        if (initialNotification && onNotificationTap && initialNotification.data) {
          onNotificationTap(initialNotification.data);
        }
      } catch (e) {
        console.error('Push notification setup error:', e);
      }
    };

    setup();

    return () => {
      unsubOnMessage?.();
    };
  }, []);

  return null;
}

/**
 * Save FCM token to Firestore under the shop's notification tokens
 */
async function saveTokenToFirestore(token: string) {
  try {
    const shopId = getShopId();
    const uid = auth().currentUser?.uid;
    if (!shopId || !uid) return;

    await firestore()
      .collection(`shops/${shopId}/notificationTokens`)
      .doc(`${uid}_mobile`)
      .set(
        {
          token,
          platform: Platform.OS, // 'android' or 'ios'
          device: 'mobile_app',
          updatedAt: new Date(),
          userId: uid,
        },
        { merge: true }
      );
  } catch (e) {
    console.error('Failed to save FCM token:', e);
  }
}

/**
 * Background message handler — must be called at top level (outside components)
 * Call this in index.js or App.tsx outside of any component.
 */
export function registerBackgroundHandler() {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    // Background messages are handled by the system notification tray automatically
    // This handler is for any additional processing (e.g., data-only messages)
    console.log('Background message:', remoteMessage.messageId);
  });
}
