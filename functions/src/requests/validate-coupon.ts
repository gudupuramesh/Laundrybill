/**
 * Validate coupon code (callable).
 * Returns { valid, discountAmount, message }.
 * Does not apply or increment usage; use at checkout before creating order.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { getShopCurrencySymbol } from "../services/currency-helper";

if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();

export const validateCoupon = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be signed in to validate a coupon.");
    }

    const { code, planId, amount, shopId } = request.data;

    if (!code || typeof code !== "string") {
        throw new HttpsError("invalid-argument", "Missing or invalid code.");
    }
    const rawAmount = typeof amount === "number" ? amount : 0;
    if (rawAmount < 0) {
        throw new HttpsError("invalid-argument", "Invalid amount.");
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
        const discountType = c?.discountType as "percentage" | "fixed" | undefined;
        const discountValue = Number(c?.discountValue) || 0;
        const validFrom = c?.validFrom?.toDate?.();
        const validTo = c?.validTo?.toDate?.();
        const maxUses = Number(c?.maxUses) ?? 0;
        const usedCount = Number(c?.usedCount) ?? 0;
        const planIds = (c?.planIds as string[] | undefined) || [];

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
        } else if (discountType === "fixed") {
            discountAmount = Math.min(rawAmount, discountValue);
        }

        if (discountAmount <= 0) {
            return { valid: false, discountAmount: 0, message: "Coupon does not apply to this amount." };
        }

        const symbol = shopId && typeof shopId === "string"
            ? await getShopCurrencySymbol(shopId)
            : "₹";

        return {
            valid: true,
            discountAmount,
            message: `${symbol}${discountAmount} off applied.`,
        };
    } catch (e) {
        console.error("validateCoupon error:", e);
        throw new HttpsError("internal", "Failed to validate coupon.");
    }
});
