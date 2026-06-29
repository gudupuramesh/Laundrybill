/**
 * One active mobile session per account (Team app).
 *
 * On login this device claims `users/{uid}/sessions/mobile` with a per-install
 * sessionId (persisted, so a restart reclaims its own slot) and watches it. If the
 * same team account logs in on another phone, that phone overwrites the slot → this
 * one detects the change and signs out. Web uses a separate `web` slot.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { firestore } from './db';

const PLATFORM = 'mobile';
const SID_KEY = 'session_device_id';

let mySessionId: string | null = null;
let guardedUid: string | null = null;
let unsub: (() => void) | null = null;

async function getSessionId(): Promise<string> {
  if (mySessionId) return mySessionId;
  try {
    const stored = await AsyncStorage.getItem(SID_KEY);
    if (stored) { mySessionId = stored; return stored; }
  } catch { /* ignore */ }
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  mySessionId = id;
  try { await AsyncStorage.setItem(SID_KEY, id); } catch { /* ignore */ }
  return id;
}

/** Stop watching (on sign-out). Does not delete the slot (harmless — reclaimed on next login). */
export function teardownMobileSession(): void {
  if (unsub) { try { unsub(); } catch { /* ignore */ } unsub = null; }
  guardedUid = null;
}

/** Claim + watch this account's mobile session slot. Idempotent per uid. */
export async function claimMobileSession(uid: string, onEvicted: () => void): Promise<void> {
  if (!uid || guardedUid === uid) return;
  teardownMobileSession();
  guardedUid = uid;

  const sid = await getSessionId();
  if (guardedUid !== uid) return; // signed out / switched account during the await

  const ref = firestore().doc(`users/${uid}/sessions/${PLATFORM}`);
  try {
    await ref.set({ sessionId: sid, claimedAt: firestore.FieldValue.serverTimestamp(), platform: PLATFORM });
  } catch { /* best-effort */ }
  if (guardedUid !== uid) return;

  unsub = ref.onSnapshot(
    (snap: any) => {
      const data = snap && typeof snap.data === 'function' ? snap.data() : null;
      if (!data || !data.sessionId) return;
      if (data.sessionId !== sid) {
        teardownMobileSession();
        onEvicted();
      }
    },
    () => { /* permission/transient errors: ignore */ }
  );
}
