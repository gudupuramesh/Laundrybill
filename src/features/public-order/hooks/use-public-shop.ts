/**
 * Fetch shop by public ordering slug (for public ordering page)
 *
 * Returns shop if:
 * - publicOrdering.enabled === true
 * - publicOrdering.slug matches
 * - Shop is on Business plan
 */

import { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Shop } from "@/types/shop";
import { getPlan } from "@/config/plans";
import type { PlanType } from "@/types/plans";

export interface PublicShopResult {
  shop: Shop | null;
  loading: boolean;
  error: string | null;
  /** Not available: slug not found, disabled, or not Business plan */
  notAvailable: boolean;
}

export function usePublicShop(slug: string | undefined): PublicShopResult {
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notAvailable, setNotAvailable] = useState(false);

  useEffect(() => {
    if (!slug || slug.trim() === "") {
      setShop(null);
      setLoading(false);
      setNotAvailable(true);
      setError("Invalid shop link");
      return;
    }

    const normalizedSlug = slug.trim().toLowerCase();

    const fetchShop = async () => {
      setLoading(true);
      setError(null);
      setNotAvailable(false);

      try {
        const shopsRef = collection(db, "shops");
        const q = query(
          shopsRef,
          where("publicOrdering.enabled", "==", true),
          where("publicOrdering.slug", "==", normalizedSlug)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setShop(null);
          setNotAvailable(true);
          setLoading(false);
          return;
        }

        const docSnap = snapshot.docs[0];
        const shopData = { id: docSnap.id, ...docSnap.data() } as Shop;

        // Plan check: must be Business plan
        const planId = (shopData.subscription?.planId || shopData.plan || "free") as PlanType;
        const plan = getPlan(planId);
        if (!plan.features.publicOrderingPage) {
          setShop(null);
          setNotAvailable(true);
          setLoading(false);
          return;
        }

        setShop(shopData);
      } catch (err) {
        console.error("Failed to fetch public shop:", err);
        setError(err instanceof Error ? err.message : "Failed to load shop");
        setShop(null);
        setNotAvailable(true);
      } finally {
        setLoading(false);
      }
    };

    fetchShop();
  }, [slug]);

  return { shop, loading, error, notAvailable };
}
