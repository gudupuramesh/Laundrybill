import { useEffect, useMemo, useState } from "react";
import { firestore } from "./db";
import { getShopId } from "./auth";
import { resolveShopCountrySettings, type ShopCountrySettings } from "./currency-format";

export function useShopCountrySettings(shopIdFromArgs?: string | null) {
  const [shopSettings, setShopSettings] = useState<ShopCountrySettings | null>(null);
  const shopId = shopIdFromArgs || getShopId();

  useEffect(() => {
    if (!shopId) return;
    const unsub = firestore()
      .collection("shops")
      .doc(shopId)
      .onSnapshot(
        (doc: any) => {
          const data = doc?.data?.() || {};
          setShopSettings(data?.settings || {});
        },
        () => {
          setShopSettings({});
        }
      );
    return unsub;
  }, [shopId]);

  return useMemo(() => resolveShopCountrySettings(shopSettings || {}), [shopSettings]);
}

