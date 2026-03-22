"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRazorpayOrder = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const razorpay_1 = require("../services/razorpay");
const trial_config_1 = require("../services/trial-config");
const VALID_PLANS = ["pro", "pro_plus", "business"];
const VALID_BILLING_CYCLES = ["monthly", "yearly", "3_months", "6_months", "9_months", "12_months"];
const FALLBACK_PRICES = {
    pro: { monthly: 499, yearly: 4999 },
    pro_plus: { monthly: 799, yearly: 7999 },
    business: { monthly: 1599, yearly: 15999 },
};
exports.createRazorpayOrder = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d, _e, _f;
    // 1. Auth Check
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "User must be logged in.");
    }
    const { planId, billingCycle, shopId } = request.data;
    if (!shopId) {
        throw new https_1.HttpsError("invalid-argument", "Missing shopId");
    }
    if (!VALID_PLANS.includes(planId)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid plan selected");
    }
    if (!VALID_BILLING_CYCLES.includes(billingCycle)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid billing cycle");
    }
    try {
        let monthly = (_b = (_a = FALLBACK_PRICES[planId]) === null || _a === void 0 ? void 0 : _a.monthly) !== null && _b !== void 0 ? _b : 499;
        try {
            const planDoc = await admin.firestore().collection("plans").doc(planId).get();
            if (planDoc.exists && ((_d = (_c = planDoc.data()) === null || _c === void 0 ? void 0 : _c.prices) === null || _d === void 0 ? void 0 : _d.monthly) != null) {
                monthly = Number(planDoc.data().prices.monthly) || monthly;
            }
        }
        catch (_) { /* use fallback */ }
        const planPrice = (_e = FALLBACK_PRICES[planId]) !== null && _e !== void 0 ? _e : { monthly: 499, yearly: 4999 };
        let amount;
        let periodDays;
        if (billingCycle === "yearly") {
            amount = planPrice.yearly;
            periodDays = 365;
        }
        else if (billingCycle === "monthly") {
            amount = monthly;
            periodDays = 30;
        }
        else {
            const months = parseInt(billingCycle.replace("_months", ""), 10);
            const discounts = await (0, trial_config_1.getDurationDiscounts)();
            const discountPct = (_f = discounts[months]) !== null && _f !== void 0 ? _f : 0;
            amount = Math.round(months * monthly * (1 - discountPct / 100));
            periodDays = months * 30;
        }
        const receiptId = `rcpt_${Date.now().toString(36)}_${shopId.slice(-4)}`;
        try {
            const order = await (0, razorpay_1.createOrder)({
                amount: amount * 100,
                currency: "INR",
                receipt: receiptId,
                notes: {
                    shopId,
                    planId,
                    billingCycle,
                    periodDays: String(periodDays),
                    userId: request.auth.uid
                }
            });
            console.log(`Created Razorpay order ${order.id} for shop ${shopId}`);
            return {
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                key: process.env.RAZORPAY_KEY_ID
            };
        }
        catch (rpError) {
            console.error("Razorpay API Error:", JSON.stringify(rpError, null, 2));
            // Log specific fields to ensure visibility in truncated logs
            if (rpError.error) {
                console.error("RP Error Code:", rpError.error.code);
                console.error("RP Error Description:", rpError.error.description);
                console.error("RP Error Field:", rpError.error.field);
            }
            throw rpError;
        }
    }
    catch (error) {
        console.error("Failed to create Razorpay order:", error);
        throw new https_1.HttpsError("internal", "Failed to process order creation");
    }
});
//# sourceMappingURL=create-order.js.map