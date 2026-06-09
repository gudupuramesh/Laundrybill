/**
 * Push notifications via expo-notifications (Expo push tokens).
 *
 * Replaces the previous FCM (@react-native-firebase/messaging) implementation,
 * which required native Firebase. The Expo push token is saved to
 * `shops/{shopId}/notificationTokens/{uid}_mobile` with tokenType:'expo'.
 *
 * NOTE: the backend Cloud Functions must send to these via the Expo push
 * service (https://exp.host/--/api/v2/push/send) for `tokenType:'expo'` tokens.
 *
 * expo-notifications is dynamically imported — Expo Go (SDK 53+) removed Android
 * remote push, so we skip there. Use a development/release build for real push.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { firestore } from './db';
import { auth, getShopId } from './auth';

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

function getProjectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    (Constants as any).easConfig?.projectId
  );
}

let handlerInstalled = false;

/**
 * Registers an Expo push token and listens for notification taps.
 * Call once in the root App component.
 */
export function usePushNotifications(onNotificationTap?: (data: any) => void) {
  useEffect(() => {
    let subTap: { remove: () => void } | undefined;
    let cancelled = false;

    const setup = async () => {
      if (Platform.OS === 'web') return;
      if (isExpoGo()) {
        console.warn('[push] Remote push unavailable in Expo Go. Use a dev/release build.');
        return;
      }

      let Notifications: typeof import('expo-notifications');
      try {
        Notifications = await import('expo-notifications');
      } catch (err) {
        console.warn('[push] expo-notifications unavailable:', err);
        return;
      }

      if (!handlerInstalled) {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
        handlerInstalled = true;
      }

      try {
        // 1. Permission
        const { status: existing } = await Notifications.getPermissionsAsync();
        let final = existing;
        if (existing !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          final = status;
        }
        if (final !== 'granted') {
          console.log('Push notification permission denied');
          return;
        }

        // 2. Android channel
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }

        // 3. Expo push token
        const projectId = getProjectId();
        const tokenData = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        const token = tokenData.data;
        if (token && !cancelled) await saveTokenToFirestore(token);

        // 4. Notification tap (background / killed)
        subTap = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data;
          if (onNotificationTap && data) onNotificationTap(data);
        });

        // 5. Opened from a killed state
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last && onNotificationTap && last.notification.request.content.data) {
          onNotificationTap(last.notification.request.content.data);
        }
      } catch (e) {
        console.error('Push notification setup error:', e);
      }
    };

    setup();

    return () => {
      cancelled = true;
      subTap?.remove();
    };
  }, []);

  return null;
}

/** Save the Expo push token to Firestore. */
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
          tokenType: 'expo',
          platform: Platform.OS,
          device: 'mobile_app',
          updatedAt: new Date(),
          userId: uid,
        },
        { merge: true },
      );
  } catch (e) {
    console.error('Failed to save Expo push token:', e);
  }
}

/**
 * No-op: expo-notifications handles background notifications via the OS.
 * Kept for API compatibility with the previous FCM background handler.
 */
export function registerBackgroundHandler() {
  // expo-notifications delivers background/killed notifications through the
  // system tray automatically; no top-level handler registration needed.
}
