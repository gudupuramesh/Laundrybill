/**
 * Push notifications via expo-notifications (Expo push tokens).
 *
 * Replaces the previous FCM (@react-native-firebase/messaging) implementation,
 * which required native Firebase. The Expo push token is saved to
 * `shops/{shopId}/notificationTokens/{uid}_mobile` with tokenType:'expo'.
 *
 * MULTI-SHOP: a franchise owner must be alerted about EVERY shop they own, not
 * just the one that happened to be active at launch — so the token is written
 * to all owned shops and re-written whenever that list changes (branch added or
 * deleted). Each alert carries its branch name (see functions
 * order-notifications) so the owner knows which shop it came from.
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
import { getOwnedShops, subscribeActiveShop } from './activeShop';

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

    // Multi-shop: when the owned-shops list resolves or changes (hydration
    // finished, branch added/deleted), push the token into the new set so every
    // branch can alert this device.
    const unsubShops = subscribeActiveShop((kind) => {
      if (kind === 'shops' && !cancelled) refreshPushTokenForOwnedShops();
    });

    return () => {
      cancelled = true;
      subTap?.remove();
      unsubShops();
    };
  }, []);

  return null;
}

/** The token from this launch — kept so we can re-register when shops change. */
let currentToken: string | null = null;

/**
 * Save the Expo push token under EVERY shop this owner runs, so alerts arrive
 * from all branches. Falls back to the active shop before the owned-shops list
 * has hydrated (and for single-shop owners, which is the same thing).
 */
async function saveTokenToFirestore(token: string) {
  currentToken = token;
  try {
    const uid = auth().currentUser?.uid;
    if (!uid) return;

    const active = getShopId();
    const owned = getOwnedShops().map((s) => s.id);
    const shopIds = Array.from(new Set([...(active ? [active] : []), ...owned]));
    if (!shopIds.length) return;

    await Promise.all(
      shopIds.map((shopId) =>
        firestore()
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
          )
          .catch((e: unknown) => console.warn(`[push] token write failed for ${shopId}:`, e)),
      ),
    );
  } catch (e) {
    console.error('Failed to save Expo push token:', e);
  }
}

/**
 * Re-register the current token across the owner's shops. Called when the
 * owned-shops list changes (hydration finished, branch added/deleted) so a new
 * branch starts alerting immediately instead of after the next app launch.
 */
export function refreshPushTokenForOwnedShops() {
  if (currentToken) void saveTokenToFirestore(currentToken);
}

/**
 * No-op: expo-notifications handles background notifications via the OS.
 * Kept for API compatibility with the previous FCM background handler.
 */
export function registerBackgroundHandler() {
  // expo-notifications delivers background/killed notifications through the
  // system tray automatically; no top-level handler registration needed.
}
