/**
 * Shop Code Generator
 * 
 * Generates unique 4-character alphanumeric codes for shops.
 * Used for globally unique order IDs: {shopCode}-{orderNumber}
 */

import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Characters to use for shop codes (uppercase letters + digits, excluding confusing chars)
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excludes: I, O, 0, 1

/**
 * Generate a random 4-character code
 */
function generateRandomCode(): string {
    let code = "";
    for (let i = 0; i < 4; i++) {
        code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }
    return code;
}

/**
 * Generate code from shop name (first 2 chars) + random (last 2 chars)
 */
function generateCodeFromName(name: string): string {
    // Extract first 2 uppercase letters from name
    const cleanName = name.toUpperCase().replace(/[^A-Z]/g, "");
    const prefix = cleanName.length >= 2
        ? cleanName.slice(0, 2)
        : cleanName.padEnd(2, CHARS.charAt(Math.floor(Math.random() * 26)));

    // Generate random suffix
    let suffix = "";
    for (let i = 0; i < 2; i++) {
        suffix += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }

    return prefix + suffix;
}

/**
 * Check if a shop code already exists in the database
 */
async function isCodeTaken(code: string): Promise<boolean> {
    const shopsRef = collection(db, "shops");
    const q = query(shopsRef, where("shopCode", "==", code));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
}

/**
 * Generate a unique shop code for a new shop
 * 
 * @param shopName - The name of the shop (used to generate prefix)
 * @param maxAttempts - Maximum attempts to find unique code (default: 50)
 * @returns Unique 4-character shop code
 */
export async function generateShopCode(
    shopName: string,
    maxAttempts: number = 50
): Promise<string> {
    // Try name-based code first
    let code = generateCodeFromName(shopName);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const taken = await isCodeTaken(code);

        if (!taken) {
            return code;
        }

        // If taken, generate a completely random code
        code = generateRandomCode();
    }

    // Fallback: add timestamp to ensure uniqueness
    const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
    return timestamp;
}

/**
 * Format order ID with shop code
 * 
 * @param shopCode - The shop's unique code (e.g., "FL7K")
 * @param orderNumber - The sequential order number
 * @returns Formatted order ID (e.g., "FL7K-00142")
 */
export function formatOrderId(shopCode: string, orderNumber: number): string {
    // Pad order number to 5 digits
    const paddedNumber = orderNumber.toString().padStart(5, "0");
    return `${shopCode}-${paddedNumber}`;
}

/**
 * Parse order ID into shop code and order number
 * 
 * @param orderId - The full order ID (e.g., "FL7K-00142")
 * @returns Object with shopCode and orderNumber, or null if invalid format
 */
export function parseOrderId(orderId: string): { shopCode: string; orderNumber: number } | null {
    const match = orderId.match(/^([A-Z0-9]{4})-(\d{5})$/);
    if (!match) return null;

    return {
        shopCode: match[1],
        orderNumber: parseInt(match[2], 10),
    };
}
