/**
 * Franchise branches for the public booking page.
 *
 * When the entered shop belongs to a multi-shop (Franchise) owner, fetch the
 * owner's OTHER shops that also have public ordering enabled, together with
 * each branch's active service areas. The area the customer picks decides
 * which branch the whole booking session (menu, prices, slots, order) runs
 * against. Shops docs are public-read, so no auth is needed.
 */

import { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Shop } from "@/types/shop";
import { normalizePlanId } from "@/types/plans";

export interface FranchiseBranch {
  shop: Shop;
  /** Active delivery service areas this branch serves. */
  areas: string[];
}

export interface FranchiseBranchesResult {
  /** Bookable branches (public page enabled + ≥1 active area), entry shop first. */
  branches: FranchiseBranch[];
  /** True while the sibling lookup runs (only for franchise shops). */
  loading: boolean;
  /** Area routing applies when 2+ branches are bookable. */
  gateNeeded: boolean;
}

function activeAreas(shop: Shop): string[] {
  const areas = shop.settings?.delivery?.serviceAreas || [];
  return areas.filter((a) => a.isActive).map((a) => a.value);
}

export function useFranchiseBranches(entryShop: Shop | null): FranchiseBranchesResult {
  const [branches, setBranches] = useState<FranchiseBranch[]>([]);
  const [loading, setLoading] = useState(false);

  const entryId = entryShop?.id;
  const ownerId = (entryShop as { ownerId?: string } | null)?.ownerId;
  const isFranchise =
    normalizePlanId((entryShop?.subscription?.planId || entryShop?.plan || "free") as string) === "franchise";

  useEffect(() => {
    if (!entryShop || !entryId || !ownerId || !isFranchise) {
      setBranches([]);
      return;
    }
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, "shops"),
            where("ownerId", "==", ownerId),
            where("publicOrdering.enabled", "==", true),
          ),
        );
        const list: FranchiseBranch[] = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Shop)
          .filter((s) => !!s.publicOrdering?.slug)
          .map((s) => ({ shop: s, areas: activeAreas(s) }))
          .filter((b) => b.areas.length > 0)
          // Entry shop first, then by name — stable, predictable list.
          .sort((a, b) =>
            a.shop.id === entryId ? -1 : b.shop.id === entryId ? 1 : (a.shop.name || "").localeCompare(b.shop.name || ""),
          );
        if (alive) setBranches(list);
      } catch (e) {
        console.warn("Franchise branch lookup failed:", e);
        if (alive) setBranches([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // entryShop object identity churns per fetch — key the effect on its stable facts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId, ownerId, isFranchise]);

  return { branches, loading, gateNeeded: branches.length >= 2 };
}
