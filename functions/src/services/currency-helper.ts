/**
 * Currency helper for Cloud Functions.
 * Reads the shop's currency symbol from Firestore.
 * Defaults to ₹ (INR) for existing shops.
 */

import * as admin from "firebase-admin";

/** Get currency symbol for a shop. Defaults to ₹. */
export async function getShopCurrencySymbol(shopId: string): Promise<string> {
    try {
        const shopDoc = await admin.firestore().doc(`shops/${shopId}`).get();
        const settings = shopDoc.data()?.settings;
        return settings?.currencySymbol || "₹";
    } catch (err) {
        console.warn(`Could not fetch currency for shop ${shopId}, defaulting to ₹`, err);
        return "₹";
    }
}
