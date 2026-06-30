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

import { defineSecret } from "firebase-functions/params";

export const RAZORPAY_KEY_ID = defineSecret("RAZORPAY_KEY_ID");
export const RAZORPAY_KEY_SECRET = defineSecret("RAZORPAY_KEY_SECRET");
export const RAZORPAY_WEBHOOK_SECRET = defineSecret("RAZORPAY_WEBHOOK_SECRET");
