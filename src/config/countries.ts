/**
 * Country configuration for multi-country support.
 * Each entry defines currency, phone code, locale, timezone, and format hints.
 */

export interface CountryConfig {
    code: string;           // ISO 3166-1 alpha-2 (e.g. "IN", "US")
    name: string;           // Display name
    currencyCode: string;   // ISO 4217 (e.g. "INR", "USD")
    currencySymbol: string; // Symbol (e.g. "₹", "$")
    phoneCode: string;      // Dial code with + (e.g. "+91")
    locale: string;         // BCP 47 (e.g. "en-IN", "en-US")
    timezone: string;       // IANA timezone (e.g. "Asia/Kolkata")
    phoneDigits: number;    // Expected digits after country code
    pinLabel: string;       // Label for postal code field
    taxName: string;        // Default tax name for this country
}

export const COUNTRIES: CountryConfig[] = [
    // South Asia
    { code: "IN", name: "India", currencyCode: "INR", currencySymbol: "₹", phoneCode: "+91", locale: "en-IN", timezone: "Asia/Kolkata", phoneDigits: 10, pinLabel: "PIN Code", taxName: "GST" },
    { code: "NP", name: "Nepal", currencyCode: "NPR", currencySymbol: "रू", phoneCode: "+977", locale: "en-NP", timezone: "Asia/Kathmandu", phoneDigits: 10, pinLabel: "Postal Code", taxName: "VAT" },
    { code: "LK", name: "Sri Lanka", currencyCode: "LKR", currencySymbol: "Rs", phoneCode: "+94", locale: "en-LK", timezone: "Asia/Colombo", phoneDigits: 9, pinLabel: "Postal Code", taxName: "VAT" },
    { code: "BD", name: "Bangladesh", currencyCode: "BDT", currencySymbol: "৳", phoneCode: "+880", locale: "en-BD", timezone: "Asia/Dhaka", phoneDigits: 10, pinLabel: "Postal Code", taxName: "VAT" },

    // Middle East
    { code: "AE", name: "United Arab Emirates", currencyCode: "AED", currencySymbol: "د.إ", phoneCode: "+971", locale: "en-AE", timezone: "Asia/Dubai", phoneDigits: 9, pinLabel: "PO Box", taxName: "VAT" },
    { code: "SA", name: "Saudi Arabia", currencyCode: "SAR", currencySymbol: "﷼", phoneCode: "+966", locale: "en-SA", timezone: "Asia/Riyadh", phoneDigits: 9, pinLabel: "Postal Code", taxName: "VAT" },
    { code: "QA", name: "Qatar", currencyCode: "QAR", currencySymbol: "﷼", phoneCode: "+974", locale: "en-QA", timezone: "Asia/Qatar", phoneDigits: 8, pinLabel: "Postal Code", taxName: "Tax" },
    { code: "KW", name: "Kuwait", currencyCode: "KWD", currencySymbol: "د.ك", phoneCode: "+965", locale: "en-KW", timezone: "Asia/Kuwait", phoneDigits: 8, pinLabel: "Postal Code", taxName: "Tax" },
    { code: "BH", name: "Bahrain", currencyCode: "BHD", currencySymbol: "BD", phoneCode: "+973", locale: "en-BH", timezone: "Asia/Bahrain", phoneDigits: 8, pinLabel: "Postal Code", taxName: "VAT" },
    { code: "OM", name: "Oman", currencyCode: "OMR", currencySymbol: "﷼", phoneCode: "+968", locale: "en-OM", timezone: "Asia/Muscat", phoneDigits: 8, pinLabel: "Postal Code", taxName: "VAT" },

    // Southeast Asia
    { code: "SG", name: "Singapore", currencyCode: "SGD", currencySymbol: "S$", phoneCode: "+65", locale: "en-SG", timezone: "Asia/Singapore", phoneDigits: 8, pinLabel: "Postal Code", taxName: "GST" },
    { code: "MY", name: "Malaysia", currencyCode: "MYR", currencySymbol: "RM", phoneCode: "+60", locale: "en-MY", timezone: "Asia/Kuala_Lumpur", phoneDigits: 10, pinLabel: "Postcode", taxName: "SST" },
    { code: "ID", name: "Indonesia", currencyCode: "IDR", currencySymbol: "Rp", phoneCode: "+62", locale: "id-ID", timezone: "Asia/Jakarta", phoneDigits: 12, pinLabel: "Postal Code", taxName: "PPN" },
    { code: "TH", name: "Thailand", currencyCode: "THB", currencySymbol: "฿", phoneCode: "+66", locale: "th-TH", timezone: "Asia/Bangkok", phoneDigits: 9, pinLabel: "Postal Code", taxName: "VAT" },
    { code: "PH", name: "Philippines", currencyCode: "PHP", currencySymbol: "₱", phoneCode: "+63", locale: "en-PH", timezone: "Asia/Manila", phoneDigits: 10, pinLabel: "ZIP Code", taxName: "VAT" },

    // Americas
    { code: "US", name: "United States", currencyCode: "USD", currencySymbol: "$", phoneCode: "+1", locale: "en-US", timezone: "America/New_York", phoneDigits: 10, pinLabel: "ZIP Code", taxName: "Tax" },
    { code: "CA", name: "Canada", currencyCode: "CAD", currencySymbol: "C$", phoneCode: "+1", locale: "en-CA", timezone: "America/Toronto", phoneDigits: 10, pinLabel: "Postal Code", taxName: "GST/HST" },

    // Europe
    { code: "GB", name: "United Kingdom", currencyCode: "GBP", currencySymbol: "£", phoneCode: "+44", locale: "en-GB", timezone: "Europe/London", phoneDigits: 10, pinLabel: "Postcode", taxName: "VAT" },
    { code: "DE", name: "Germany", currencyCode: "EUR", currencySymbol: "€", phoneCode: "+49", locale: "de-DE", timezone: "Europe/Berlin", phoneDigits: 11, pinLabel: "Postcode", taxName: "VAT" },
    { code: "FR", name: "France", currencyCode: "EUR", currencySymbol: "€", phoneCode: "+33", locale: "fr-FR", timezone: "Europe/Paris", phoneDigits: 9, pinLabel: "Code Postal", taxName: "VAT" },
    { code: "NL", name: "Netherlands", currencyCode: "EUR", currencySymbol: "€", phoneCode: "+31", locale: "nl-NL", timezone: "Europe/Amsterdam", phoneDigits: 9, pinLabel: "Postcode", taxName: "VAT" },

    // Oceania
    { code: "AU", name: "Australia", currencyCode: "AUD", currencySymbol: "A$", phoneCode: "+61", locale: "en-AU", timezone: "Australia/Sydney", phoneDigits: 9, pinLabel: "Postcode", taxName: "GST" },

    // Africa
    { code: "ZA", name: "South Africa", currencyCode: "ZAR", currencySymbol: "R", phoneCode: "+27", locale: "en-ZA", timezone: "Africa/Johannesburg", phoneDigits: 9, pinLabel: "Postal Code", taxName: "VAT" },
    { code: "KE", name: "Kenya", currencyCode: "KES", currencySymbol: "KSh", phoneCode: "+254", locale: "en-KE", timezone: "Africa/Nairobi", phoneDigits: 9, pinLabel: "Postal Code", taxName: "VAT" },
    { code: "NG", name: "Nigeria", currencyCode: "NGN", currencySymbol: "₦", phoneCode: "+234", locale: "en-NG", timezone: "Africa/Lagos", phoneDigits: 10, pinLabel: "Postal Code", taxName: "VAT" },
];

/** Get country config by ISO code. Falls back to India. */
export function getCountry(code: string): CountryConfig {
    return COUNTRIES.find((c) => c.code === code) || COUNTRIES[0]; // India fallback
}

/** Get country config by currency code. Falls back to India. */
export function getCountryByCurrency(currencyCode: string): CountryConfig {
    return COUNTRIES.find((c) => c.currencyCode === currencyCode) || COUNTRIES[0];
}

/**
 * Map IANA timezone → country code.
 * Covers all timezones in COUNTRIES plus common aliases (e.g. multiple US/CA/AU zones).
 * Used for auto-detecting the user's country on the login page (no permission needed).
 */
const TIMEZONE_TO_COUNTRY: Record<string, string> = (() => {
    // Start with the primary timezone for each country in our list
    const map: Record<string, string> = {};
    COUNTRIES.forEach((c) => { map[c.timezone] = c.code; });

    // Add extra timezone aliases for countries with multiple zones
    // United States
    ["America/Chicago", "America/Denver", "America/Los_Angeles", "America/Anchorage",
     "America/Phoenix", "America/Boise", "America/Indiana/Indianapolis", "America/Detroit",
     "Pacific/Honolulu", "America/Adak"].forEach((tz) => { map[tz] = "US"; });
    // Canada
    ["America/Vancouver", "America/Edmonton", "America/Winnipeg", "America/Halifax",
     "America/St_Johns", "America/Regina"].forEach((tz) => { map[tz] = "CA"; });
    // Australia
    ["Australia/Melbourne", "Australia/Brisbane", "Australia/Perth", "Australia/Adelaide",
     "Australia/Hobart", "Australia/Darwin"].forEach((tz) => { map[tz] = "AU"; });
    // India (only one zone, already covered)
    // Indonesia
    ["Asia/Makassar", "Asia/Jayapura"].forEach((tz) => { map[tz] = "ID"; });
    // Malaysia
    map["Asia/Kuching"] = "MY";

    return map;
})();

/**
 * Detect the user's country from browser timezone.
 * Returns the country code (e.g. "IN", "US") or null if not matched.
 * No permission or API call needed.
 */
export function detectCountryByTimezone(): string | null {
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return TIMEZONE_TO_COUNTRY[tz] || null;
    } catch {
        return null;
    }
}

/** Default country code */
export const DEFAULT_COUNTRY = "IN";
