/**
 * HelpButton — small help icon for each screen header.
 *
 * Fetches per-page video URLs from platformSettings/support (pageHelp array).
 * When tapped, opens the video URL in the device browser.
 * If no URL is configured for the page, the button is hidden.
 */

import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { firestore } from '../lib/db';

// Cache to avoid re-fetching on every screen mount
let cachedPageHelp: { pageId: string; videoUrl: string }[] | null = null;
let fetchPromise: Promise<void> | null = null;

function loadPageHelp(): Promise<void> {
  if (cachedPageHelp) return Promise.resolve();
  if (fetchPromise) return fetchPromise;

  fetchPromise = firestore()
    .collection('platformSettings')
    .doc('support')
    .get()
    .then((snap: any) => {
      if (snap.exists) {
        const data = snap.data();
        cachedPageHelp = Array.isArray(data?.pageHelp) ? data.pageHelp : [];
      } else {
        cachedPageHelp = [];
      }
    })
    .catch(() => {
      cachedPageHelp = [];
    })
    .finally(() => {
      fetchPromise = null;
    }) as Promise<void>;

  return fetchPromise!;
}

const DEFAULT_HELP_URL = 'https://laundrybill.com/help';

export function HelpButton({ pageId }: { pageId: string }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadPageHelp().then(() => {
      const entry = cachedPageHelp?.find((p) => p.pageId === pageId);
      setVideoUrl(entry?.videoUrl || null);
      setLoaded(true);
    });
  }, [pageId]);

  if (!loaded) return null;

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={() => Linking.openURL(videoUrl || DEFAULT_HELP_URL)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <MaterialIcons name="help-outline" size={22} color="#64748b" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: 6,
    borderRadius: 20,
  },
});
