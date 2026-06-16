import { getCountry, getCountryByCurrency } from "./country-config";

export type ShopCountrySettings = {
  countryCode?: string;
  currency?: string;
  currencySymbol?: string;
  locale?: string;
  phoneCountryCode?: string;
  phoneDigits?: number;
  timezone?: string;
};

export function resolveShopCountrySettings(raw?: ShopCountrySettings): Required<ShopCountrySettings> {
  const country = raw?.countryCode ? getCountry(raw.countryCode) : getCountryByCurrency(raw?.currency);
  return {
    countryCode: raw?.countryCode || country.code,
    currency: raw?.currency || country.currencyCode,
    currencySymbol: raw?.currencySymbol || country.currencySymbol,
    locale: raw?.locale || country.locale,
    phoneCountryCode: raw?.phoneCountryCode || country.phoneCode,
    phoneDigits: raw?.phoneDigits || country.phoneDigits,
    timezone: raw?.timezone || country.timezone,
  };
}

export function formatCurrency(value: number, settings?: ShopCountrySettings): string {
  const s = resolveShopCountrySettings(settings);
  const abs = Math.abs(Number(value || 0));
  const sign = Number(value || 0) < 0 ? "-" : "";
  const formatted = new Intl.NumberFormat(s.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(abs);
  return `${sign}${s.currencySymbol}${formatted}`;
}

export function formatAmountNumber(value: number, settings?: ShopCountrySettings): string {
  const s = resolveShopCountrySettings(settings);
  return new Intl.NumberFormat(s.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function normalizePhoneForCountry(input: string, settings?: ShopCountrySettings): string {
  const s = resolveShopCountrySettings(settings);
  const digits = String(input || "").replace(/\D/g, "");
  return digits.slice(-s.phoneDigits);
}

export function toE164(phoneDigits: string, settings?: ShopCountrySettings): string {
  const s = resolveShopCountrySettings(settings);
  const prefix = s.phoneCountryCode.replace(/\D/g, "");
  const local = normalizePhoneForCountry(phoneDigits, s);
  return `+${prefix}${local}`;
}

