/**
 * Load and save platform default catalog (categories + items with imageUrl).
 * Stored in platformSettings/defaultCatalog. New shops are seeded from this when present.
 */

import { useState, useCallback } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  DefaultCatalogDoc,
  DefaultCatalogCategory,
  DefaultCatalogItem,
} from "../types/default-catalog";

const DEFAULT_CATALOG_REF = doc(db, "platformSettings", "defaultCatalog");

export function useDefaultCatalog() {
  const [data, setData] = useState<DefaultCatalogDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDoc(DEFAULT_CATALOG_REF);
      if (snap.exists()) {
        const d = snap.data() as DefaultCatalogDoc;
        setData({
          categories: d.categories ?? [],
          items: d.items ?? [],
          updatedAt: d.updatedAt,
          updatedBy: d.updatedBy,
        });
      } else {
        setData(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load default catalog");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Firestore does not allow undefined; strip it from objects. */
  const stripUndefined = useCallback(
    <T extends object>(obj: T): T =>
      Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== undefined)
      ) as T,
    []
  );

  const save = useCallback(
    async (
      payload: { categories: DefaultCatalogCategory[]; items: DefaultCatalogItem[] },
      updatedBy?: string
    ) => {
      setSaving(true);
      setError(null);
      try {
        const itemsForFirestore = payload.items.map((item) =>
          stripUndefined({ ...item })
        );
        const docData = {
          categories: payload.categories,
          items: itemsForFirestore,
          updatedAt: serverTimestamp(),
          ...(updatedBy != null && { updatedBy }),
        };
        await setDoc(DEFAULT_CATALOG_REF, docData);
        setData({
          categories: payload.categories,
          items: payload.items,
          updatedAt: undefined,
          ...(updatedBy != null && { updatedBy }),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save default catalog");
        throw e;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  return { data, loading, saving, error, load, save };
}

/** Used by AuthContext to seed new shops from platform catalog when present. */
export async function getDefaultCatalog(): Promise<DefaultCatalogDoc | null> {
  const snap = await getDoc(DEFAULT_CATALOG_REF);
  if (!snap.exists()) return null;
  const d = snap.data() as DefaultCatalogDoc;
  if (!d.categories?.length || !d.items?.length) return null;
  return {
    categories: d.categories,
    items: d.items,
    updatedAt: d.updatedAt,
    updatedBy: d.updatedBy,
  };
}

/** Build catalog from default-inventory (for "Initialize from default" on Items List page). */
export async function buildDefaultCatalogFromInventory(): Promise<DefaultCatalogDoc> {
  const { DEFAULT_CATEGORIES, DEFAULT_ITEMS } = await import("@/lib/default-inventory");
  const categories: DefaultCatalogCategory[] = DEFAULT_CATEGORIES.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    order: c.order,
    turnaroundDays: c.turnaroundDays,
  }));
  const items: DefaultCatalogItem[] = DEFAULT_ITEMS.map((i) => ({
    categoryId: i.categoryId,
    categoryName: i.categoryName,
    subCategory: i.subCategory,
    name: i.name,
    basePrice: i.basePrice,
    pricingType: i.pricingType,
    turnaroundDays: i.turnaroundDays,
    order: i.order,
    imageUrl: undefined,
  }));
  return { categories, items, updatedAt: undefined };
}
