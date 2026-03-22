import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { createOrder } from "../services/razorpay";
import { getDurationDiscounts } from "../services/trial-config";

const VALID_PLANS = ["pro", "pro_plus", "business"];
const VALID_BILLING_CYCLES = ["monthly", "yearly", "3_months", "6_months", "9_months", "12_months"];
const FALLBACK_PRICES: Record<string, { monthly: number; yearly: number }> = {
    pro: { monthly: 499, yearly: 4999 },
    pro_plus: { monthly: 799, yearly: 7999 },
    business: { monthly: 1599, yearly: 15999 },
};

export const createRazorpayOrder = onCall(async (request) => {
    // 1. Auth Check
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const { planId, billingCycle, shopId } = request.data;

    if (!shopId) {
        throw new HttpsError("invalid-argument", "Missing shopId");
    }

    if (!VALID_PLANS.includes(planId)) {
        throw new HttpsError("invalid-argument", "Invalid plan selected");
    }
    if (!VALID_BILLING_CYCLES.includes(billingCycle)) {
        throw new HttpsError("invalid-argument", "Invalid billing cycle");
    }

    try {
        let monthly = FALLBACK_PRICES[planId]?.monthly ?? 499;
        try {
            const planDoc = await admin.firestore().collection("plans").doc(planId).get();
            if (planDoc.exists && (planDoc.data() as any)?.prices?.monthly != null) {
                monthly = Number((planDoc.data() as any).prices.monthly) || monthly;
            }
        } catch (_) { /* use fallback */ }

        const planPrice = FALLBACK_PRICES[planId] ?? { monthly: 499, yearly: 4999 };
        let amount: number;
        let periodDays: number;

        if (billingCycle === "yearly") {
            amount = planPrice.yearly;
            periodDays = 365;
        } else if (billingCycle === "monthly") {
            amount = monthly;
            periodDays = 30;
        } else {
            const months = parseInt(billingCycle.replace("_months", ""), 10);
            const discounts = await getDurationDiscounts();
            const discountPct = discounts[months] ?? 0;
            amount = Math.round(months * monthly * (1 - discountPct / 100));
            periodDays = months * 30;
        }

        const receiptId = `rcpt_${Date.now().toString(36)}_${shopId.slice(-4)}`;

        try {
            const order = await createOrder({
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
        } catch (rpError: any) {
            console.error("Razorpay API Error:", JSON.stringify(rpError, null, 2));
            // Log specific fields to ensure visibility in truncated logs
            if (rpError.error) {
                console.error("RP Error Code:", rpError.error.code);
                console.error("RP Error Description:", rpError.error.description);
                console.error("RP Error Field:", rpError.error.field);
            }
            throw rpError;
        }

    } catch (error) {
        console.error("Failed to create Razorpay order:", error);
        throw new HttpsError("internal", "Failed to process order creation");
    }
});
