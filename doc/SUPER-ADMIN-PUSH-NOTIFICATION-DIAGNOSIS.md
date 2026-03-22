# Super Admin Push Notification – Root Cause Analysis and Implementation Plan

## Problem

When a new user registers (e.g. Google sign-in), the super admin does not receive any push notification. The flow has been fixed in several places (Firestore rule, FCM hook retry, loading overlay) but notifications still do not appear.

## End-to-End Flow

```
[New user] → completeSignup() → setDoc(shops/{userId}) 
    → Firestore triggers createTrialSubscriptionOnShopCreate
        → Create trial subscription
        → getDocs(superAdminNotificationTokens) → tokens[]
        → if (tokens.length > 0) admin.messaging().send() to each
[Super Admin] → useSuperAdminFcmToken(app, adminId)
    → requestPermission() → getToken(vapidKey) → setDoc(superAdminNotificationTokens/{adminId}, { token })
```

If the super admin never gets a notification, the break is in one of:

1. **Trigger not firing** – shop document not created, or trigger not deployed.
2. **Subscription already exists** – function returns early and never reaches notification code.
3. **No tokens in Firestore** – `tokens.length === 0`, so no send happens (and there is no log today).
4. **FCM send failing** – tokens exist but `admin.messaging().send()` fails (e.g. invalid/expired token); errors are only in Promise.allSettled and not clearly logged.
5. **Client never saves a token** – permission denied, VAPID missing at build time, getToken/setDoc failing silently.

## Most Likely Root Cause: No Tokens in Firestore

The Cloud Function only sends when `tokens.length > 0`. It does **not** log when there are zero tokens, so we cannot confirm from logs alone. The super admin must have:

1. Opened the **deployed** app (e.g. https://laundryos.web.app/super-admin).
2. **Logged in** so `superAdmin` is set and `useSuperAdminFcmToken(app, adminId)` runs.
3. **Granted** browser notification permission when prompted.
4. **VAPID key** present at **build time** so `VITE_FIREBASE_VAPID_KEY` is in the built JS (if it’s only in `.env.local` and build runs elsewhere, it can be missing in production).
5. **Successful** `getToken()` and `setDoc()` – any failure is only logged as `"Super Admin FCM registration failed"` in the console.

So the most likely situation is: **no document is written to `superAdminNotificationTokens`**, so the function finds zero tokens and never sends or logs. Contributing factors can be:

- Permission not granted or prompt blocked.
- `VITE_FIREBASE_VAPID_KEY` missing in the build used for deployment.
- `getToken()` or `setDoc()` failing (e.g. service worker, network, or rule) with the user not checking the console.

## Implementation Plan

### 1. Add Diagnostic Logging in the Cloud Function

**File:** `functions/src/index.ts` (inside `createTrialSubscriptionOnShopCreate`)

- **When there are no tokens:** Log explicitly so we can see it in Firebase Functions logs, e.g.  
  `"No super admin FCM tokens in Firestore, skipping new-shop notification."`
- **When there are tokens:** Keep the existing log with sent count; in addition, for each element of `Promise.allSettled` that is `status === "rejected"`, log the reason (e.g. `rejected.reason`) so we can see invalid/expired token or other FCM errors.

This will show in Firebase Console → Functions → Logs whether the problem is “0 tokens” or “send failed”.

### 2. Add Client-Side Diagnostic Logging (Super Admin FCM Hook)

**File:** `src/hooks/use-super-admin-fcm.ts`

- Log when registration is **skipped** and why: e.g. no `VAPID_KEY`, no `adminId`, or `!isSupported()`.
- After `requestPermission()`, log the result (e.g. `"granted"` / `"denied"` / `"default"`).
- Log when **token is obtained** and when **setDoc** is about to run; log **success** after `setDoc` and on **catch** log the error (so the user can open DevTools on the super admin tab and see exactly where it failed).

This will make it possible to verify on the live site whether the hook runs, permission is granted, and the token is saved.

### 3. Ensure VAPID Key Is Available in Production Build

- **Document:** Add `VITE_FIREBASE_VAPID_KEY` to [laundryboss/.env.example](laundryboss/.env.example) with a short comment that it is required for super admin (and other) push notifications and must be set before `npm run build` for deployment.
- **Check:** When building for production, ensure the env that runs `npm run build` has `VITE_FIREBASE_VAPID_KEY` set (e.g. in `.env` or in CI env). If the key is only in `.env.local`, the deployed app may have `VAPID_KEY` undefined and the hook will exit early without logging (until we add the logs from step 2).

### 4. Optional: Super Admin “Push Status” in UI

- On a super admin page (e.g. Settings or Dashboard), show a short line: “Push notifications: Enabled” or “Push notifications: Not registered” based on whether we have successfully saved a token (e.g. by reading `superAdminNotificationTokens/{uid}` once or by storing a “last registered” flag in context after successful `setDoc`). This gives a quick way to confirm registration without opening DevTools or Firestore.

## Verification Steps (After Implementation)

1. **Deploy** the Cloud Function and the web app (so the new logs and any UI are live).
2. **Super admin:** Open the **deployed** URL, log in, allow notifications, and open DevTools → Console. Confirm logs: permission granted, token received, “token saved” (or see the error).
3. **Firestore:** In Firebase Console → Firestore → `superAdminNotificationTokens`, confirm a document with the super admin UID and a `token` field.
4. **Trigger:** Register a new shop (e.g. Google sign-in) in another browser.
5. **Functions logs:** In Firebase Console → Functions → Logs, confirm either “No super admin FCM tokens…” or “Super Admin notification sent to X/Y device(s)” and, if any send fails, the per-token error.

## Summary

| Suspected cause              | Fix / check |
|-----------------------------|-------------|
| No tokens in Firestore      | Add “no tokens” log in function; add client logs so we see why token wasn’t saved. |
| VAPID missing in production | Document in .env.example; ensure build env has VAPID. |
| FCM send failing            | Log each rejected send in the function. |
| Permission / getToken fail  | Client-side logs in use-super-admin-fcm. |

Implementing the logging (steps 1 and 2) and the .env.example note (step 3) will pinpoint the root cause; the optional UI (step 4) makes it easier to confirm that push is registered.
