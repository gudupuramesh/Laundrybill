export type PricingType = "piece" | "kg" | "lb" | "sqft" | "sqm" | "set" | "pair" | "load" | "bag";

export interface CountryConfig {
  code: string;
  name: string;
  currencyCode: string;
  currencySymbol: string;
  phoneCode: string;
  locale: string;
  timezone: string;
  /** Max local digits (input cap). Valid length is phoneMinDigits..phoneDigits. */
  phoneDigits: number;
  phoneMinDigits: number;
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

/**
 * National MOBILE number length per country — digits after the dial code, no
 * trunk "0". [min, max]; exact-length countries have min === max. Unlisted
 * countries fall back to a permissive 7–12 so no legitimate number is ever
 * blocked. (Replaces the old format-string heuristic, which guessed badly —
 * e.g. the Philippines got capped at 7 digits.)
 */
const PHONE_LEN: Record<string, readonly [number, number]> = {
  // South Asia
  IN: [10, 10], NP: [10, 10], LK: [9, 9], BD: [10, 10], PK: [10, 10], AF: [9, 9], MV: [7, 7], BT: [8, 8],
  // Middle East
  AE: [9, 9], SA: [9, 9], QA: [8, 8], KW: [8, 8], BH: [8, 8], OM: [8, 8], JO: [9, 9], LB: [7, 8],
  IQ: [10, 10], IL: [9, 9], TR: [10, 10], IR: [10, 10], YE: [9, 9], SY: [9, 9],
  // Southeast + East Asia
  SG: [8, 8], MY: [9, 10], ID: [9, 12], TH: [9, 9], PH: [10, 10], VN: [9, 9], MM: [8, 10], KH: [8, 9],
  LA: [8, 10], BN: [7, 7], HK: [8, 8], MO: [8, 8], TW: [9, 9], CN: [11, 11], JP: [10, 10], KR: [9, 10],
  // Americas
  US: [10, 10], CA: [10, 10], MX: [10, 10], BR: [10, 11], AR: [10, 10], CL: [9, 9], CO: [10, 10], PE: [9, 9],
  // Europe
  GB: [10, 10], IE: [9, 9], DE: [10, 11], FR: [9, 9], NL: [9, 9], BE: [9, 9], ES: [9, 9], PT: [9, 9],
  IT: [9, 10], CH: [9, 9], AT: [10, 13], PL: [9, 9], RO: [9, 9], GR: [10, 10], SE: [9, 9], NO: [8, 8],
  DK: [8, 8], FI: [9, 10], RU: [10, 10], UA: [9, 9], CZ: [9, 9], HU: [9, 9],
  // Oceania
  AU: [9, 9], NZ: [8, 10], FJ: [7, 7], PG: [7, 8],
  // Africa
  ZA: [9, 9], KE: [9, 9], NG: [10, 10], GH: [9, 9], TZ: [9, 9], UG: [9, 9], RW: [9, 9], ET: [9, 9],
  ZM: [9, 9], ZW: [9, 9], MW: [9, 9], MZ: [9, 9], BW: [8, 8], NA: [9, 9], EG: [10, 10], MA: [9, 9],
  DZ: [9, 9], TN: [8, 8], LY: [9, 9], SD: [9, 9], SN: [9, 9], CI: [10, 10], CM: [9, 9],
};
const PHONE_LEN_DEFAULT: readonly [number, number] = [7, 12];


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
    const [phoneMin, phoneMax] = PHONE_LEN[code] || PHONE_LEN_DEFAULT;
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
      phoneDigits: phoneMax,
      phoneMinDigits: phoneMin,
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

// Country-specific address labels (UAE = Emirate / P.O. Box; most others = State / Postal Code).
const STATE_LABELS: Record<string, string> = {
  AE: "Emirate", SA: "Region", QA: "Municipality", KW: "Governorate", OM: "Governorate", BH: "Governorate",
  GB: "County", SG: "District", NL: "Province", KE: "County", IN: "State",
};
const PIN_LABELS: Record<string, string> = {
  IN: "PIN Code", AE: "P.O. Box", US: "ZIP Code", GB: "Postcode", SG: "Postal Code",
};
export function getStateLabel(code?: string): string {
  return STATE_LABELS[(code || DEFAULT_COUNTRY_CODE).toUpperCase()] || "State";
}
export function getPinLabel(code?: string): string {
  return PIN_LABELS[(code || DEFAULT_COUNTRY_CODE).toUpperCase()] || "Postal Code";
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

/**
 * Units measured by weight/area/bulk → entered as a decimal (e.g. 2.5 kg) via a
 * text input, not an integer +/- stepper. Shared definition for the weight-vs-
 * stepper decision across all apps.
 */
export const DECIMAL_UNITS: PricingType[] = ['kg', 'lb', 'sqft', 'sqm', 'load', 'bag'];

export function isWeightUnit(pricingType?: string): boolean {
  return !!pricingType && (DECIMAL_UNITS as string[]).includes(pricingType);
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

