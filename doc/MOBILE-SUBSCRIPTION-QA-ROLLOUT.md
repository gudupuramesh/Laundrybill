# Mobile Subscription QA + Rollout

## Scope
- Android billing provider: Razorpay.
- iOS billing provider: Apple IAP.
- Canonical entitlement source: `subscriptions/{shopId}` in Firestore.

## QA Matrix

### Android (Razorpay)
- New purchase succeeds and subscription becomes `active`.
- Payment success shows pending verify UI, then resolves to `active`.
- Payment failure updates purchase state to `failed` and shows retry-safe error.
- Duplicate webhook delivery does not duplicate activation/payment history.
- Cancellation event transitions to `cancelled` and respects `activeUntil`.

### iOS (Apple IAP Sandbox)
- Product purchase succeeds for monthly and yearly plans.
- Receipt verification activates canonical subscription (`provider=apple_iap`).
- Restore Purchases re-links entitlement after reinstall/login.
- Invalid receipt path marks subscription as `past_due` + `purchaseState=failed`.

### Super Admin / Web
- Subscription list shows provider badge (`Razorpay`/`Apple IAP`).
- Provider reference renders for auditability.
- Existing subscriptions without provider metadata still render safely.

## Rollout Steps
1. Deploy cloud functions with Apple verification endpoint and webhook idempotency.
2. Configure secrets:
   - `APPLE_SHARED_SECRET`
   - existing Razorpay secrets
3. Configure iOS product IDs (env-based):
   - `EXPO_PUBLIC_IOS_IAP_PRO_MONTHLY`
   - `EXPO_PUBLIC_IOS_IAP_PRO_YEARLY`
   - `EXPO_PUBLIC_IOS_IAP_PRO_PLUS_MONTHLY`
   - `EXPO_PUBLIC_IOS_IAP_PRO_PLUS_YEARLY`
   - `EXPO_PUBLIC_IOS_IAP_BUSINESS_MONTHLY`
   - `EXPO_PUBLIC_IOS_IAP_BUSINESS_YEARLY`
4. Release to internal testers:
   - Android internal track
   - iOS TestFlight sandbox users
5. Monitor:
   - `subscriptions` docs for status/provider transitions
   - webhook processing logs
   - failed purchase alerts

