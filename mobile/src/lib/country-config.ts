export type PricingType = "piece" | "kg" | "lb" | "sqft" | "sqm" | "set" | "pair" | "load" | "bag";

export interface CountryConfig {
  code: string;
  name: string;
  currencyCode: string;
  currencySymbol: string;
  phoneCode: string;
  locale: string;
  timezone: string;
  phoneDigits: number;
  taxName: string;
  supportedUnits: PricingType[];
  defaultUnit: PricingType;
  weightUnit: 'kg' | 'lb';
  areaUnit: 'sqft' | 'sqm';
}

// Unit display labels
export const UNIT_LABELS: Record<PricingType, { full: string; short: string }> = {
  piece: { full: 'Per Piece', short: 'pc' },
  kg: { full: 'Per Kilogram', short: 'kg' },
  lb: { full: 'Per Pound', short: 'lb' },
  sqft: { full: 'Per Sq. Foot', short: 'sqft' },
  sqm: { full: 'Per Sq. Meter', short: 'm²' },
  set: { full: 'Per Set', short: 'set' },
  pair: { full: 'Per Pair', short: 'pair' },
  load: { full: 'Per Load', short: 'load' },
  bag: { full: 'Per Bag', short: 'bag' },
};

// Country → unit mapping
const UNIT_OVERRIDES: Record<string, { supportedUnits: PricingType[]; defaultUnit: PricingType; weightUnit: 'kg' | 'lb'; areaUnit: 'sqft' | 'sqm' }> = {
  IN: { supportedUnits: ['piece', 'kg', 'sqft', 'set', 'pair'], defaultUnit: 'piece', weightUnit: 'kg', areaUnit: 'sqft' },
  US: { supportedUnits: ['piece', 'lb', 'sqft', 'set', 'pair', 'load', 'bag'], defaultUnit: 'piece', weightUnit: 'lb', areaUnit: 'sqft' },
  CA: { supportedUnits: ['piece', 'lb', 'sqft', 'set', 'pair', 'load', 'bag'], defaultUnit: 'piece', weightUnit: 'lb', areaUnit: 'sqft' },
  GB: { supportedUnits: ['piece', 'lb', 'kg', 'sqm', 'set', 'pair', 'load'], defaultUnit: 'piece', weightUnit: 'lb', areaUnit: 'sqm' },
  AU: { supportedUnits: ['piece', 'kg', 'sqm', 'set', 'pair', 'load'], defaultUnit: 'piece', weightUnit: 'kg', areaUnit: 'sqm' },
  AE: { supportedUnits: ['piece', 'kg', 'set', 'pair', 'bag'], defaultUnit: 'piece', weightUnit: 'kg', areaUnit: 'sqft' },
  SA: { supportedUnits: ['piece', 'kg', 'set', 'pair', 'bag'], defaultUnit: 'piece', weightUnit: 'kg', areaUnit: 'sqft' },
  SG: { supportedUnits: ['piece', 'kg', 'set', 'pair'], defaultUnit: 'piece', weightUnit: 'kg', areaUnit: 'sqm' },
  MY: { supportedUnits: ['piece', 'kg', 'set', 'pair'], defaultUnit: 'piece', weightUnit: 'kg', areaUnit: 'sqm' },
};

// Default for countries not in the override list
const DEFAULT_UNITS: { supportedUnits: PricingType[]; defaultUnit: PricingType; weightUnit: 'kg' | 'lb'; areaUnit: 'sqft' | 'sqm' } = {
  supportedUnits: ['piece', 'kg', 'sqm', 'set', 'pair', 'load', 'bag'],
  defaultUnit: 'piece',
  weightUnit: 'kg',
  areaUnit: 'sqm',
};

type TelCountry = { name: string; iso2: string; dialCode: string; format?: string };
const telData = require('country-telephone-data') as { allCountries: TelCountry[] };
const countryToCurrency = require('country-to-currency') as Record<string, string | undefined>;
const currencySymbolMap = require('currency-symbol-map');

const OVERRIDES: Record<string, Partial<CountryConfig>> = {
  IN: { currencyCode: "INR", currencySymbol: "₹", locale: "en-IN", timezone: "Asia/Kolkata", phoneDigits: 10, taxName: "GST" },
  US: { currencyCode: "USD", currencySymbol: "$", locale: "en-US", timezone: "America/New_York", phoneDigits: 10, taxName: "Tax" },
  AE: { currencyCode: "AED", currencySymbol: "د.إ", locale: "en-AE", timezone: "Asia/Dubai", phoneDigits: 9, taxName: "VAT" },
  SA: { currencyCode: "SAR", currencySymbol: "﷼", locale: "en-SA", timezone: "Asia/Riyadh", phoneDigits: 9, taxName: "VAT" },
  SG: { currencyCode: "SGD", currencySymbol: "S$", locale: "en-SG", timezone: "Asia/Singapore", phoneDigits: 8, taxName: "GST" },
  MY: { currencyCode: "MYR", currencySymbol: "RM", locale: "en-MY", timezone: "Asia/Kuala_Lumpur", phoneDigits: 10, taxName: "SST" },
  GB: { currencyCode: "GBP", currencySymbol: "£", locale: "en-GB", timezone: "Europe/London", phoneDigits: 10, taxName: "VAT" },
  AU: { currencyCode: "AUD", currencySymbol: "A$", locale: "en-AU", timezone: "Australia/Sydney", phoneDigits: 9, taxName: "GST" },
  CA: { currencyCode: "CAD", currencySymbol: "C$", locale: "en-CA", timezone: "America/Toronto", phoneDigits: 10, taxName: "GST/HST" },
};

function inferPhoneDigits(c: TelCountry): number {
  const dots = (c.format?.match(/\./g) || []).length;
  const dialLen = String(c.dialCode || "").length;
  const inferred = dots > dialLen ? dots - dialLen : 10;
  return Math.min(12, Math.max(6, inferred));
}

function resolveCurrencyCode(countryCode: string): string {
  return String(countryToCurrency[countryCode] || 'USD').toUpperCase();
}

function resolveCurrencySymbol(currencyCode: string): string {
  const sym = currencySymbolMap(currencyCode);
  return sym || currencyCode;
}

export const COUNTRIES: CountryConfig[] = Array.from(
  new Map(
    (telData.allCountries || []).map((c) => [String(c.iso2 || "").toUpperCase(), c])
  ).values()
)
  .map((c) => {
    const code = String(c.iso2 || "").toUpperCase();
    const mappedCurrency = resolveCurrencyCode(code);
    const unitConfig = UNIT_OVERRIDES[code] || DEFAULT_UNITS;
    const base: CountryConfig = {
      code,
      name: c.name,
      currencyCode: mappedCurrency,
      currencySymbol: resolveCurrencySymbol(mappedCurrency),
      phoneCode: `+${c.dialCode}`,
      locale: `en-${code}`,
      timezone: "UTC",
      phoneDigits: inferPhoneDigits(c),
      taxName: "Tax",
      supportedUnits: unitConfig.supportedUnits,
      defaultUnit: unitConfig.defaultUnit,
      weightUnit: unitConfig.weightUnit,
      areaUnit: unitConfig.areaUnit,
    };
    return { ...base, ...(OVERRIDES[code] || {}) };
  })
  .filter((c) => !!c.code && !!c.name && !!c.phoneCode)
  .sort((a, b) => a.name.localeCompare(b.name));

export const DEFAULT_COUNTRY_CODE = "IN";

export function getCountry(code?: string): CountryConfig {
  return COUNTRIES.find((c) => c.code === code) || COUNTRIES.find((c) => c.code === DEFAULT_COUNTRY_CODE)!;
}

export function getCountryByCurrency(currencyCode?: string): CountryConfig {
  return COUNTRIES.find((c) => c.currencyCode === currencyCode) || getCountry(DEFAULT_COUNTRY_CODE);
}

/** Get supported units for a country code */
export function getUnitsForCountry(countryCode?: string): { units: PricingType[]; defaultUnit: PricingType; labels: typeof UNIT_LABELS } {
  const country = getCountry(countryCode);
  return {
    units: country.supportedUnits,
    defaultUnit: country.defaultUnit,
    labels: UNIT_LABELS,
  };
}

/** Get unit label (short form) for display */
export function getUnitLabel(pricingType: string): string {
  return UNIT_LABELS[pricingType as PricingType]?.short || pricingType;
}

/** Get unit full label for pickers */
export function getUnitFullLabel(pricingType: string): string {
  return UNIT_LABELS[pricingType as PricingType]?.full || pricingType;
}

export function getCountryCodeFromPhone(input?: string): string | null {
  const digits = String(input || '').replace(/\D/g, '');
  if (!digits) return null;
  const sortedByDialLen = [...COUNTRIES].sort(
    (a, b) => b.phoneCode.replace(/\D/g, '').length - a.phoneCode.replace(/\D/g, '').length
  );
  for (const c of sortedByDialLen) {
    const dial = c.phoneCode.replace(/\D/g, '');
    if (dial && digits.startsWith(dial)) return c.code;
  }
  return null;
}

