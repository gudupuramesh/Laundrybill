import { useEffect, useMemo, useState } from "react";
import { firestore } from "./db";
import { getShopId } from "./auth";
import { resolveShopCountrySettings, displayCurrencySymbol, type ShopCountrySettings } from "./currency-format";

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

  // Expose a DISPLAY-SAFE currencySymbol: RTL symbols (AED د.إ, ﷼) become the ISO
  // code so on-screen prices don't render shuffled. Every consumer (formatCurrency,
  // withCurrencySymbol replaces, price inputs) inherits this.
  return useMemo(() => {
    const resolved = resolveShopCountrySettings(shopSettings || {});
    return { ...resolved, currencySymbol: displayCurrencySymbol(resolved.currencySymbol, resolved.currency) };
  }, [shopSettings]);
}

