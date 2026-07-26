/**
 * Multi-shop (Franchise) active-shop store for the owner app.
 *
 * Mirrors the web model: `users/{uid}.shopId` stays the PRIMARY shop and is
 * never rewritten; the ACTIVE shop is a local choice persisted per-uid in
 * AsyncStorage. Access to non-primary shops is authorized by the Firestore
 * rules' isShopOwner (shops/{id}.ownerId), so no rules change is needed.
 *
 * The existing `getShopId()` singleton in ./auth stays the single source every
 * screen reads — switching just re-points it and notifies subscribers, and
 * App.tsx remounts the screen tree so every screen re-reads it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, setResolvedShopId, getShopId } from './auth';

export type OwnedShop = { id: string; name: string };

const ACTIVE_SHOP_KEY = (uid: string) => `active_shop_v1_${uid}`;

/** The owner's primary shop (users/{uid}.shopId) — billing always targets it. */
let _primaryShopId: string | null = null;
let _ownedShops: OwnedShop[] = [];

/**
 * Change kinds are distinct on purpose:
 *  - 'active' → the ACTIVE shop changed; the app must remount its screens.
 *  - 'shops'  → only the owned-shops LIST changed (a refresh); remounting on
 *               this would re-trigger the refresh → infinite loop.
 */
export type ShopChangeKind = 'active' | 'shops';
type Listener = (kind: ShopChangeKind) => void;
const listeners = new Set<Listener>();

function notify(kind: ShopChangeKind) {
  listeners.forEach((fn) => {
    try {
      fn(kind);
    } catch {
      /* a bad subscriber must not break the switch */
    }
  });
}

/** Subscribe to active-shop / owned-shops changes. Returns an unsubscribe fn. */
export function subscribeActiveShop(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setPrimaryShopId(id: string | null) {
  _primaryShopId = id;
}
export function getPrimaryShopId(): string | null {
  return _primaryShopId;
}

export function setOwnedShops(shops: OwnedShop[]) {
  _ownedShops = shops;
  // List-only change — never remount the screen tree for this.
  notify('shops');
}
export function getOwnedShops(): OwnedShop[] {
  return _ownedShops;
}

/** Is the owner currently viewing a branch (not their main shop)? */
export function isViewingBranch(): boolean {
  const active = getShopId();
  return !!_primaryShopId && !!active && active !== _primaryShopId;
}

/**
 * Switch the active shop. Persists the choice for this uid and notifies
 * subscribers (App.tsx remounts the tree so all screens re-read getShopId()).
 */
export async function switchActiveShop(shopId: string): Promise<void> {
  const uid = auth().currentUser?.uid;
  if (!shopId || getShopId() === shopId) return;
  setResolvedShopId(shopId);
  if (uid) {
    try {
      if (_primaryShopId && shopId === _primaryShopId) {
        await AsyncStorage.removeItem(ACTIVE_SHOP_KEY(uid));
      } else {
        await AsyncStorage.setItem(ACTIVE_SHOP_KEY(uid), shopId);
      }
    } catch {
      /* persistence is best-effort — the in-memory switch still applies */
    }
  }
  notify('active');
}

/**
 * Restore a previously chosen active shop after login/cold start. Only applies
 * when the saved shop is still owned; otherwise falls back to the primary.
 * Call AFTER the primary shop + owned list are known.
 */
export async function restoreActiveShop(uid: string): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(ACTIVE_SHOP_KEY(uid));
    if (!saved || saved === _primaryShopId) return;
    if (_ownedShops.some((s) => s.id === saved)) {
      setResolvedShopId(saved);
      notify('active');
    } else {
      await AsyncStorage.removeItem(ACTIVE_SHOP_KEY(uid));
    }
  } catch {
    /* ignore */
  }
}

/** Clear all multi-shop state (sign-out). */
export async function clearActiveShop(uid?: string | null): Promise<void> {
  _primaryShopId = null;
  _ownedShops = [];
  if (uid) {
    try {
      await AsyncStorage.removeItem(ACTIVE_SHOP_KEY(uid));
    } catch {
      /* ignore */
    }
  }
  notify('active');
}
