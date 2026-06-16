/**
 * Currency context — formats amounts in the shop's currency (from
 * shops/{shopId}.settings), not a hardcoded ₹. Mirrors the owner app's
 * useShopCountrySettings + formatCurrency.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { useShopCountrySettings } from './use-shop-country-settings';
import { formatCurrency, type ShopCountrySettings } from './currency-format';
import { useDriverAuth } from './DriverAuthContext';

interface CurrencyValue {
  settings: Required<ShopCountrySettings>;
  symbol: string;
  /** Full amount with the shop's symbol + locale grouping, e.g. ₹1,250 / $1,250 / RM1,250. */
  format: (n?: number | null) => string;
  /** Compact form for stat tiles, e.g. ₹4.2k / $4.2k. */
  formatCompact: (n?: number | null) => string;
}

const CurrencyContext = createContext<CurrencyValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { shopId } = useDriverAuth();
  const settings = useShopCountrySettings(shopId);

  const value = useMemo<CurrencyValue>(() => {
    const symbol = settings.currencySymbol;
    return {
      settings,
      symbol,
      format: (n) => formatCurrency(Number(n || 0), settings),
      formatCompact: (n) => {
        const v = Math.round(Number(n || 0));
        if (Math.abs(v) >= 1000) return `${symbol}${(v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1)}k`;
        return `${symbol}${v}`;
      },
    };
  }, [settings]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider');
  return ctx;
}
