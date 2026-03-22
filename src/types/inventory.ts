/**
 * Inventory Types
 */

import { Timestamp } from "firebase/firestore";

/**
 * Multi-language name support for items
 * Keys are language codes (en, hi, te, ta, mr, kn, bn, ml)
 */
export interface LocalizedName {
    en?: string;
    hi?: string;
    te?: string;
    ta?: string;
    mr?: string;
    kn?: string;
    bn?: string;
    ml?: string;
}

export interface InventoryCategory {
    id: string;
    name: string;
    /** Optional localized names for different languages */
    localizedNames?: LocalizedName;
    icon?: string;
    order: number;
    turnaroundDays?: number; // Default turnaround days for items in this category
    isActive: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export type PricingType = "piece" | "kg" | "sqft" | "set";

export interface InventoryItem {
    id: string;
    categoryId: string;
    categoryName: string;
    name: string;
    subCategory?: string; // Men's, Women's, Kids, Household, etc.
    /** Optional localized names for different languages */
    localizedNames?: LocalizedName;
    description?: string;
    basePrice: number;
    pricingType: PricingType;
    expressMultiplier: number;
    turnaroundDays: number;
    imageUrl?: string;
    /** R2 object key for the stored image (used for cleanup on replace/delete) */
    imageKey?: string;
    /** Compressed size in bytes (used for storage tracking on delete/replace) */
    imageBytes?: number;
    order: number;
    isActive: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

/**
 * Get the localized name based on current language
 * Falls back to English name, then to the base name field
 */
export function getLocalizedItemName(item: InventoryItem | InventoryCategory, languageCode: string): string {
    if (item.localizedNames) {
        const localizedName = item.localizedNames[languageCode as keyof LocalizedName];
        if (localizedName) return localizedName;
        // Fallback to English
        if (item.localizedNames.en) return item.localizedNames.en;
    }
    return item.name;
}
