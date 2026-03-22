import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Format number as Indian currency (₹)
 */
export function formatIndianCurrency(value: number): string {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(value);
}

/** Locale-aware currency formatter. Falls back to INR / en-IN when params omitted. */
export function formatCurrency(
    value: number,
    currencyCode: string = "INR",
    locale: string = "en-IN",
): string {
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(value);
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
        return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
    }
    return phone;
}

/**
 * Generate a random alphanumeric ID
 */
export function generateId(length = 8): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<T>) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

/**
 * Convert string to Title Case
 * Example: "rEguLar WASH" -> "Regular Wash"
 * Handles special cases like "2 piece" -> "2 Piece"
 */
export function toTitleCase(str: string): string {
    if (!str) return str;
    return str
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ") // normalize multiple spaces
        .split(" ")
        .map((word) => {
            if (!word) return word;
            // Keep numbers as-is, capitalize first letter of words
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(" ");
}

// ==================== VALIDATION UTILITIES ====================

/**
 * Validate Indian phone number (exactly 10 digits, starting with 6-9)
 */
export function isValidIndianPhone(phone: string): boolean {
    const cleaned = phone.replace(/\D/g, "");
    return cleaned.length === 10 && /^[6-9]/.test(cleaned);
}

/**
 * Normalize phone to 10 digits only (remove country code, spaces, etc.)
 */
export function normalizePhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, "");
    // If starts with 91 and is 12 digits, remove country code
    if (cleaned.length === 12 && cleaned.startsWith("91")) {
        return cleaned.slice(2);
    }
    return cleaned.slice(-10); // Take last 10 digits
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
    if (!email) return true; // Optional field
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}

/**
 * Normalize email (lowercase, trim)
 */
export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

/**
 * Validate PAN (10 chars: AAAAA0000A)
 */
export function isValidPAN(pan: string): boolean {
    if (!pan) return true; // Optional field
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
    return panRegex.test(pan.toUpperCase().trim());
}

/**
 * Normalize PAN (uppercase, trim)
 */
export function normalizePAN(pan: string): string {
    return pan.toUpperCase().trim();
}

/**
 * Validate GST (15 chars: 22AAAAA0000A1Z5)
 */
export function isValidGST(gst: string): boolean {
    if (!gst) return true; // Optional field
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z][Z][0-9A-Z]$/;
    return gstRegex.test(gst.toUpperCase().trim());
}

/**
 * Normalize GST (uppercase, trim)
 */
export function normalizeGST(gst: string): string {
    return gst.toUpperCase().trim();
}

/**
 * Validate IFSC (11 chars: AAAA0AAAAAA)
 */
export function isValidIFSC(ifsc: string): boolean {
    if (!ifsc) return true; // Optional field
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    return ifscRegex.test(ifsc.toUpperCase().trim());
}

/**
 * Normalize IFSC (uppercase, trim)
 */
export function normalizeIFSC(ifsc: string): string {
    return ifsc.toUpperCase().trim();
}

/**
 * Validate UPI ID (lowercase, contains @)
 */
export function isValidUPI(upi: string): boolean {
    if (!upi) return true; // Optional field
    const upiRegex = /^[\w.-]+@[\w]+$/;
    return upiRegex.test(upi.trim());
}

/**
 * Normalize UPI (lowercase, trim)
 */
export function normalizeUPI(upi: string): string {
    return upi.toLowerCase().trim();
}

/**
 * Validate bank account number (digits only, 8-18 chars)
 */
export function isValidAccountNumber(acc: string): boolean {
    if (!acc) return true; // Optional field
    const cleaned = acc.replace(/\D/g, "");
    return cleaned.length >= 8 && cleaned.length <= 18;
}

/**
 * Normalize account number (digits only)
 */
export function normalizeAccountNumber(acc: string): string {
    return acc.replace(/\D/g, "");
}

