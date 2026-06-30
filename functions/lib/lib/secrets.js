"use strict";
/**
 * Razorpay secrets (Firebase Functions params).
 *
 * Set these once with:
 *   firebase functions:secrets:set RAZORPAY_KEY_ID
 *   firebase functions:secrets:set RAZORPAY_KEY_SECRET
 *   firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
 *
 * Use TEST keys (rzp_test_…) first, then re-set with LIVE keys (rzp_live_…) to go live.
 * Each function that touches Razorpay declares the secrets it needs via its `secrets: [...]` option.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RAZORPAY_WEBHOOK_SECRET = exports.RAZORPAY_KEY_SECRET = exports.RAZORPAY_KEY_ID = void 0;
const params_1 = require("firebase-functions/params");
exports.RAZORPAY_KEY_ID = (0, params_1.defineSecret)("RAZORPAY_KEY_ID");
exports.RAZORPAY_KEY_SECRET = (0, params_1.defineSecret)("RAZORPAY_KEY_SECRET");
exports.RAZORPAY_WEBHOOK_SECRET = (0, params_1.defineSecret)("RAZORPAY_WEBHOOK_SECRET");
//# sourceMappingURL=secrets.js.map