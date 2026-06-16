/**
 * Push notifications via expo-notifications (Expo push tokens).
 *
 * The agent's Expo push token is saved to
 * `shops/{shopId}/agentNotificationTokens/{agentId}` with tokenType:'expo'.
 * The backend `getAgentPushTargets()` reads exactly that doc and routes Expo
 * tokens through the Expo push service (via `sendPush`) — so no backend change
 * is needed for this app.
 *
 * expo-notifications is dynamically imported — Expo Go (SDK 53+) removed Android
 * remote push, so we skip there. Use a development/release build for real push.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { firestore } from './db';
import { getShopId, getAgentId } from './auth';

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
 * Call once in the root App component, after the agent is authenticated.
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

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('order_updates', {
            name: 'Order updates',
            importance: Notifications.AndroidImportance.HIGH,
          });
        }

        const projectId = getProjectId();
        const tokenData = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        const token = tokenData.data;
        if (token && !cancelled) await saveAgentToken(token);

        subTap = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data;
          if (onNotificationTap && data) onNotificationTap(data);
        });

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

/** Save the agent's Expo push token where the backend expects it. */
async function saveAgentToken(token: string) {
  try {
    const shopId = getShopId();
    const agentId = getAgentId();
    if (!shopId || !agentId) return;

    await firestore()
      .collection(`shops/${shopId}/agentNotificationTokens`)
      .doc(agentId)
      .set(
        {
          token,
          tokenType: 'expo',
          platform: Platform.OS,
          device: 'driver_app',
          agentId,
          updatedAt: new Date(),
        },
        { merge: true },
      );
  } catch (e) {
    console.error('Failed to save agent Expo push token:', e);
  }
}
