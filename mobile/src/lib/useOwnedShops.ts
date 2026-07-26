/**
 * The shops this owner owns (multi-shop / Franchise). Queries
 * shops where ownerId == uid — exactly what the Firestore rules'
 * isShopOwner authorizes, so every branch is readable.
 */
import { useState, useEffect, useCallback } from 'react';
import { firestore } from './firebase';
import { auth } from './auth';
import { getPrimaryShopId, getOwnedShops, setOwnedShops, subscribeActiveShop, type OwnedShop } from './activeShop';

export function useOwnedShops(): { shops: OwnedShop[]; loading: boolean; refresh: () => Promise<void> } {
  // Seed from the store so a remount shows the known shops instantly instead
  // of flashing an empty list while the query runs.
  const [shops, setShops] = useState<OwnedShop[]>(() => getOwnedShops());
  const [loading, setLoading] = useState(() => getOwnedShops().length === 0);

  const load = useCallback(async () => {
    const uid = auth().currentUser?.uid;
    if (!uid) {
      setShops([]);
      setLoading(false);
      return;
    }
    try {
      const snap = await firestore().collection('shops').where('ownerId', '==', uid).get();
      const primary = getPrimaryShopId();
      const list: OwnedShop[] = snap.docs
        .map((d: any) => ({ id: d.id, name: (d.data()?.name as string) || 'My shop' }))
        // Primary shop first, then alphabetical — a stable, predictable order.
        .sort((a: OwnedShop, b: OwnedShop) =>
          a.id === primary ? -1 : b.id === primary ? 1 : a.name.localeCompare(b.name),
        );
      setShops(list);
      setOwnedShops(list);
    } catch (e) {
      console.warn('Owned shops lookup failed:', e);
      setShops([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Mirror list changes made elsewhere (add/delete a branch) straight from
    // the store — never re-query here, that would notify and loop.
    return subscribeActiveShop((kind) => {
      if (kind === 'shops') setShops(getOwnedShops());
    });
  }, [load]);

  return { shops, loading, refresh: load };
}
