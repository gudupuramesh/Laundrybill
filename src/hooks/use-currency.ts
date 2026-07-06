/**
 * Currency Hook
 *
 * Reads the shop's currency settings and provides formatting helpers.
 * Falls back to INR (₹) for existing users or when shop data isn't loaded.
 */

import { useMemo } from "react";
import { useShop, useShopByShopId } from "@/hooks/use-shop";
import { getCountryByCurrency } from "@/config/countries";
import type { Shop } from "@/types/shop";

/**
 * Some currency symbols are RTL Arabic script (AED د.إ, KWD د.ك, SAR/QAR/OMR ﷼).
 * Dropped raw into LTR UI text they render with shuffled punctuation ("د.إ15" mangled).
 * For those, fall back to the ISO code + a space ("AED ") so prices read left-to-right —
 * the same policy the PDF receipt already uses (currencyLabel in generateReceipt.ts).
 * LTR symbols (₹, $, £, …) are returned unchanged.
 */
const RTL_SYMBOL = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
export function displayCurrencySymbol(symbol: string | undefined, code: string | undefined): string {
    const s = (symbol || "").trim();
    if (s && !RTL_SYMBOL.test(s)) return s;
    const c = (code || "").trim().toUpperCase();
    return c ? `${c} ` : (s || "₹");
}

export interface CurrencyInfo {
    /** ISO 4217 code, e.g. "INR", "USD" */
    currencyCode: string;
    /** Display symbol, e.g. "₹", "$" */
    currencySymbol: string;
    /** BCP 47 locale for number formatting, e.g. "en-IN", "en-US" */
    locale: string;
    /** Format a number as currency string (symbol + formatted number). */
    formatAmount: (value: number) => string;
}

/** Build CurrencyInfo from a shop object (or null). */
function buildCurrencyInfo(shop: Shop | null): CurrencyInfo {
    const code = shop?.settings?.currency || "INR";
    const rawSymbol = shop?.settings?.currencySymbol || getCountryByCurrency(code).currencySymbol;
    const locale = shop?.settings?.locale || getCountryByCurrency(code).locale;
    // Display-safe: RTL symbols become the ISO code so they don't mangle LTR layout.
    const symbol = displayCurrencySymbol(rawSymbol, code);

    return {
        currencyCode: code,
        currencySymbol: symbol,
        locale,
        formatAmount: (value: number) => formatCurrencyValue(value, symbol, locale),
    };
}

/**
 * React hook – reads currency from the current shop's settings (main AuthContext).
 * Use in admin pages.
 */
export function useCurrency(): CurrencyInfo {
    const { shop } = useShop();
    return useMemo(() => buildCurrencyInfo(shop), [shop?.settings?.currency, shop?.settings?.currencySymbol, shop?.settings?.locale]);
}

/**
 * React hook – reads currency for a given shopId (e.g. driver/staff apps).
 * Falls back to INR when shop data not yet loaded.
 */
export function useCurrencyByShopId(shopId: string | null): CurrencyInfo {
    const { shop } = useShopByShopId(shopId);
    return useMemo(() => buildCurrencyInfo(shop), [shop?.settings?.currency, shop?.settings?.currencySymbol, shop?.settings?.locale]);
}

/**
 * Pure function – format a number with the given currency symbol and locale.
 * Use this in non-component code (utilities, PDF generators, etc.)
 * where you pass currency info explicitly.
 */
export function formatCurrencyValue(
    value: number,
    currencySymbol: string = "₹",
    locale: string = "en-IN",
): string {
    const absValue = Math.abs(value);
    const formatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(absValue);
    const sign = value < 0 ? "-" : "";
    return `${sign}${currencySymbol}${formatted}`;
}
