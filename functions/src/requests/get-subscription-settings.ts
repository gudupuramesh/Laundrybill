import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDurationDiscounts, getSubscriptionButtonsEnabled } from "../services/trial-config";

/**
 * Returns duration discounts for 3/6/9/12 months (0–100%) and subscription buttons enabled flag.
 * Used by shop subscription page to show prices and control button states.
 * Any authenticated user can call.
 */
export const getSubscriptionSettings = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }
    const [durationDiscounts, buttonsEnabled] = await Promise.all([
        getDurationDiscounts(),
        getSubscriptionButtonsEnabled(),
    ]);
    return { durationDiscounts, buttonsEnabled };
});
