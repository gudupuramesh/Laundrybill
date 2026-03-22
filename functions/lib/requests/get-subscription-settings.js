"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSubscriptionSettings = void 0;
const https_1 = require("firebase-functions/v2/https");
const trial_config_1 = require("../services/trial-config");
/**
 * Returns duration discounts for 3/6/9/12 months (0–100%) and subscription buttons enabled flag.
 * Used by shop subscription page to show prices and control button states.
 * Any authenticated user can call.
 */
exports.getSubscriptionSettings = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "User must be logged in.");
    }
    const [durationDiscounts, buttonsEnabled] = await Promise.all([
        (0, trial_config_1.getDurationDiscounts)(),
        (0, trial_config_1.getSubscriptionButtonsEnabled)(),
    ]);
    return { durationDiscounts, buttonsEnabled };
});
//# sourceMappingURL=get-subscription-settings.js.map