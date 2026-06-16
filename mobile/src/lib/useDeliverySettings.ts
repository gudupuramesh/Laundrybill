/**
 * Delivery settings (service areas) — reads/writes the SAME Firestore doc as the
 * web (`shops/{shopId}.settings.delivery`), so areas created here appear on web
 * and vice-versa. Mirrors the web `useDeliverySettings` add/remove/toggle helpers.
 */
import { useCallback, useEffect, useState } from 'react';
import { firestore } from './db';

export interface ServiceArea {
  id: string;
  value: string;
  isActive: boolean;
}

export interface DeliverySettings {
  enableServiceAreas?: boolean;
  serviceAreas?: ServiceArea[];
  [key: string]: any;
}

function genId(): string {
  return `area-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export function useDeliverySettings(shopId: string | null | undefined) {
  const [settings, setSettings] = useState<DeliverySettings>({ serviceAreas: [], enableServiceAreas: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId) {
      setLoading(false);
      return;
    }
    const unsub = firestore()
      .collection('shops')
      .doc(shopId)
      .onSnapshot(
        (snap: any) => {
          const data = snap?.data?.() || {};
          const delivery: DeliverySettings = data?.settings?.delivery || {};
          let areas = delivery.serviceAreas || [];
          // Normalize legacy string[] areas to {id,value,isActive}.
          if (Array.isArray(areas) && areas.length > 0 && typeof areas[0] === 'string') {
            areas = (areas as unknown as string[]).map((v) => ({ id: genId(), value: v, isActive: true }));
          }
          setSettings({ ...delivery, serviceAreas: areas, enableServiceAreas: !!delivery.enableServiceAreas });
          setLoading(false);
        },
        () => setLoading(false),
      );
    return unsub;
  }, [shopId]);

  // Read-merge-write the whole settings.delivery object (same as web updateSettings).
  const write = useCallback(
    async (partial: Partial<DeliverySettings>) => {
      if (!shopId) return;
      const merged = { ...settings, ...partial };
      await firestore().collection('shops').doc(shopId).update({ 'settings.delivery': merged });
    },
    [shopId, settings],
  );

  const addServiceArea = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      const areas = settings.serviceAreas || [];
      if (!trimmed || areas.some((a) => a.value.toLowerCase() === trimmed.toLowerCase())) return;
      await write({ serviceAreas: [...areas, { id: genId(), value: trimmed, isActive: true }] });
    },
    [settings.serviceAreas, write],
  );

  const removeServiceArea = useCallback(
    async (id: string) => {
      await write({ serviceAreas: (settings.serviceAreas || []).filter((a) => a.id !== id) });
    },
    [settings.serviceAreas, write],
  );

  const toggleServiceArea = useCallback(
    async (id: string, isActive: boolean) => {
      await write({
        serviceAreas: (settings.serviceAreas || []).map((a) => (a.id === id ? { ...a, isActive } : a)),
      });
    },
    [settings.serviceAreas, write],
  );

  const setEnableServiceAreas = useCallback(
    async (enabled: boolean) => {
      await write({ enableServiceAreas: enabled });
    },
    [write],
  );

  return {
    settings,
    loading,
    addServiceArea,
    removeServiceArea,
    toggleServiceArea,
    setEnableServiceAreas,
  };
}
