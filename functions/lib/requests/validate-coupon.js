"use strict";
/**
 * Validate coupon code (callable).
 * Returns { valid, discountAmount, message }.
 * Does not apply or increment usage; use at checkout before creating order.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCoupon = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const currency_helper_1 = require("../services/currency-helper");
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
exports.validateCoupon = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d, _e, _f;
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "You must be signed in to validate a coupon.");
    }
    const { code, planId, amount, shopId } = request.data;
    if (!code || typeof code !== "string") {
        throw new https_1.HttpsError("invalid-argument", "Missing or invalid code.");
    }
    const rawAmount = typeof amount === "number" ? amount : 0;
    if (rawAmount < 0) {
        throw new https_1.HttpsError("invalid-argument", "Invalid amount.");
    }
    const normalizedCode = String(code).trim().toUpperCase();
    if (!normalizedCode) {
        return { valid: false, discountAmount: 0, message: "Invalid coupon code." };
    }
    try {
        const couponRef = db.collection("coupons").doc(normalizedCode);
        const couponDoc = await couponRef.get();
        if (!couponDoc.exists) {
            return { valid: false, discountAmount: 0, message: "Coupon not found." };
        }
        const c = couponDoc.data();
        const discountType = c === null || c === void 0 ? void 0 : c.discountType;
        const discountValue = Number(c === null || c === void 0 ? void 0 : c.discountValue) || 0;
        const validFrom = (_b = (_a = c === null || c === void 0 ? void 0 : c.validFrom) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a);
        const validTo = (_d = (_c = c === null || c === void 0 ? void 0 : c.validTo) === null || _c === void 0 ? void 0 : _c.toDate) === null || _d === void 0 ? void 0 : _d.call(_c);
        const maxUses = (_e = Number(c === null || c === void 0 ? void 0 : c.maxUses)) !== null && _e !== void 0 ? _e : 0;
        const usedCount = (_f = Number(c === null || c === void 0 ? void 0 : c.usedCount)) !== null && _f !== void 0 ? _f : 0;
        const planIds = (c === null || c === void 0 ? void 0 : c.planIds) || [];
        const now = new Date();
        if (validFrom && now < validFrom) {
            return { valid: false, discountAmount: 0, message: "Coupon is not yet valid." };
        }
        if (validTo && now > validTo) {
            return { valid: false, discountAmount: 0, message: "Coupon has expired." };
        }
        if (maxUses > 0 && usedCount >= maxUses) {
            return { valid: false, discountAmount: 0, message: "Coupon usage limit reached." };
        }
        if (planIds.length > 0 && planId && !planIds.includes(planId)) {
            return { valid: false, discountAmount: 0, message: "Coupon does not apply to this plan." };
        }
        let discountAmount = 0;
        if (discountType === "percentage") {
            discountAmount = Math.round((rawAmount * Math.min(100, discountValue)) / 100);
        }
        else if (discountType === "fixed") {
            discountAmount = Math.min(rawAmount, discountValue);
        }
        if (discountAmount <= 0) {
            return { valid: false, discountAmount: 0, message: "Coupon does not apply to this amount." };
        }
        const symbol = shopId && typeof shopId === "string"
            ? await (0, currency_helper_1.getShopCurrencySymbol)(shopId)
            : "₹";
        return {
            valid: true,
            discountAmount,
            message: `${symbol}${discountAmount} off applied.`,
        };
    }
    catch (e) {
        console.error("validateCoupon error:", e);
        throw new https_1.HttpsError("internal", "Failed to validate coupon.");
    }
});
//# sourceMappingURL=validate-coupon.js.map