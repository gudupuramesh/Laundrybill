/**
 * App Update Checker
 * Reads platformSettings/app from Firestore, compares with local app version.
 * Returns update info so the caller can show an update prompt.
 */

import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { firestore } from './db';

// Must match app.json → expo.version
const APP_VERSION = '1.5.4';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=in.laundrybill';
const APP_STORE_URL = 'https://apps.apple.com/app/laundrybill/id6743129498';

function compareVersions(local: string, remote: string): number {
  const a = local.split('.').map(Number);
  const b = remote.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

export interface AppUpdateInfo {
  updateAvailable: boolean;
  forceUpdate: boolean;
  latestVersion: string;
  whatsNew: string;
  openStore: () => void;
}

export function useAppUpdateChecker(): AppUpdateInfo | null {
  const [info, setInfo] = useState<AppUpdateInfo | null>(null);

  useEffect(() => {
    firestore()
      .collection('platformSettings')
      .doc('app')
      .get()
      .then((snap) => {
        if (!snap.exists) return;
        const data = snap.data();
        const latestVersion = data?.latestVersion || APP_VERSION;
        const minVersion = data?.minVersion || '0.0.0';
        const whatsNew = data?.whatsNew || '';

        const hasUpdate = compareVersions(APP_VERSION, latestVersion) < 0;
        const mustUpdate = compareVersions(APP_VERSION, minVersion) < 0;

        if (hasUpdate) {
          setInfo({
            updateAvailable: true,
            forceUpdate: mustUpdate,
            latestVersion,
            whatsNew,
            openStore: () => {
              const url = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
              Linking.openURL(url).catch(() => {});
            },
          });
        }
      })
      .catch((e) => console.warn('App update check failed:', e));
  }, []);

  return info;
}
