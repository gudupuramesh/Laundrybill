/**
 * Inventory hook for a specific shop (used by public ordering page)
 */

import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { InventoryCategory, InventoryItem } from "@/types/inventory";

export function useInventoryForShop(shopId: string | undefined) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const categoriesRef = collection(db, `shops/${shopId}/categories`);
    const itemsRef = collection(db, `shops/${shopId}/inventory`);

    const unsubCategories = onSnapshot(
      query(categoriesRef, orderBy("order")),
      (snapshot) => {
        setCategories(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryCategory[]
        );
      },
      () => {}
    );

    const unsubItems = onSnapshot(
      query(itemsRef, orderBy("order")),
      (snapshot) => {
        setItems(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryItem[]
        );
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => {
      unsubCategories();
      unsubItems();
    };
  }, [shopId]);

  return { items, categories, loading };
}
