"use strict";
/**
 * Currency helper for Cloud Functions.
 * Reads the shop's currency symbol from Firestore.
 * Defaults to ₹ (INR) for existing shops.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getShopCurrencySymbol = void 0;
const admin = require("firebase-admin");
/** Get currency symbol for a shop. Defaults to ₹. */
async function getShopCurrencySymbol(shopId) {
    var _a;
    try {
        const shopDoc = await admin.firestore().doc(`shops/${shopId}`).get();
        const settings = (_a = shopDoc.data()) === null || _a === void 0 ? void 0 : _a.settings;
        return (settings === null || settings === void 0 ? void 0 : settings.currencySymbol) || "₹";
    }
    catch (err) {
        console.warn(`Could not fetch currency for shop ${shopId}, defaulting to ₹`, err);
        return "₹";
    }
}
exports.getShopCurrencySymbol = getShopCurrencySymbol;
//# sourceMappingURL=currency-helper.js.map