# Google Play Billing Cutover Runbook

## Goal
- Android new subscriptions use Google Play Billing only.
- iOS continues using Apple IAP.
- Razorpay remains read-only for historical records/webhook safety.

## Required Config
- Functions env vars:
  - `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (full JSON string for Play Developer API service account)
  - `GOOGLE_PLAY_PACKAGE_NAME` (default: `in.laundrybill`)
  - `RAZORPAY_NEW_SUBSCRIPTIONS_DISABLED=true`
- Mobile env vars (Android product IDs):
  - `EXPO_PUBLIC_ANDROID_IAP_PRO_MONTHLY`
  - `EXPO_PUBLIC_ANDROID_IAP_PRO_YEARLY`
  - `EXPO_PUBLIC_ANDROID_IAP_PRO_PLUS_MONTHLY`
  - `EXPO_PUBLIC_ANDROID_IAP_PRO_PLUS_YEARLY`
  - `EXPO_PUBLIC_ANDROID_IAP_BUSINESS_MONTHLY`
  - `EXPO_PUBLIC_ANDROID_IAP_BUSINESS_YEARLY`
- Mobile env vars (iOS unchanged):
  - `EXPO_PUBLIC_IOS_IAP_PRO_MONTHLY`
  - `EXPO_PUBLIC_IOS_IAP_PRO_YEARLY`
  - `EXPO_PUBLIC_IOS_IAP_PRO_PLUS_MONTHLY`
  - `EXPO_PUBLIC_IOS_IAP_PRO_PLUS_YEARLY`
  - `EXPO_PUBLIC_IOS_IAP_BUSINESS_MONTHLY`
  - `EXPO_PUBLIC_IOS_IAP_BUSINESS_YEARLY`

## Manual Migration Support (Operator)
- If no paid Razorpay subscribers exist:
  - No data migration required.
  - Keep old `subscriptions` and `payments` records untouched.
- If a legacy paid record appears later:
  - Set `subscriptions/{shopId}.provider` to `manual`.
  - Preserve `providerRef` and `providerOrderId` from Razorpay fields.
  - Set `status` and `currentPeriodEnd` based on operator evidence.
  - Add an audit payment row in `subscriptions/{shopId}/payments` with `type=manual_adjustment`.

## QA Checklist
- Android:
  - Buy monthly/yearly from Play test account.
  - Confirm `subscriptions/{shopId}` becomes `provider=google_play`, `status=active`, `purchaseState=active`.
  - Restore purchase works after reinstall/sign-in.
  - Verify Razorpay flow cannot start (`createRazorpayOrder` returns failed-precondition).
- iOS:
  - Buy monthly/yearly with sandbox account.
  - Verify receipt still activates canonical subscription (`provider=apple_iap`).
  - Restore purchase re-links entitlement.
- Super Admin:
  - Provider badge shows `Google Play` and `Apple IAP`.
  - Provider references render correctly.

## Rollout Sequence
1. Deploy Functions first.
2. Publish Android build to internal test (then production).
3. Publish iOS build to TestFlight (then production).
4. Monitor:
   - Cloud Functions logs for `verifyGooglePurchase` and `verifyApplePurchase`
   - Firestore `subscriptions` transition health
   - Firestore `payments` records for gateway consistency

