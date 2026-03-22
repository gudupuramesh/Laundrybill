# LaundryBoss Security Audit Report

**Date:** January 29, 2025  
**Auditor:** Cursor AI  
**Scope:** LaundryBoss Web Application - Authentication, Authorization, Access Control, Firestore Rules

---

## Executive Summary

| Severity | Count |
|----------|-------|
| **Critical** | 2 |
| **High** | 3 |
| **Medium** | 4 |
| **Low** | 3 |
| **Total** | 12 |

**Key Findings:**
- **CRITICAL:** Firestore rules allow unauthenticated updates to ALL orders (DEBUG mode left enabled)
- **CRITICAL:** Orders, staff, and teamMembers have public read access—enabling data enumeration
- **HIGH:** Super Admin access relies on client-side whitelist; Firestore allows any user to create super_admins doc
- **HIGH:** Shops collection has public read—exposes all shop data to unauthenticated users
- Route protection and role hierarchy are implemented correctly at the UI layer
- Data fetching uses shopId from auth context, providing client-side scoping (but Firestore rules are the real enforcement)

---

## Critical Findings (Fix Immediately)

### [CRITICAL-001] Orders Allow Unauthenticated Update (Firestore)

- **Location:** `firestore.rules` lines 65-69
- **Description:** Order documents have `allow update: if true`, explicitly marked as "FIXME: DEBUG MODE". This allows ANY user (including unauthenticated) to update ANY order in the system.
- **Attack Scenario:** An attacker can use the Firebase SDK in browser console or a script to call `updateDoc()` on any order path (`shops/{shopId}/orders/{orderId}`). They can change order status to "delivered", modify amounts, or corrupt data. No authentication required.
- **Recommended Fix:**
  ```
  allow update: if isShopMember(shopId) || isShopOwner(shopId);
  allow delete: if isShopAdmin(shopId) || isShopOwner(shopId);
  ```

### [CRITICAL-002] Collection Group Rules Allow Unrestricted Read

- **Location:** `firestore.rules` lines 146-173
- **Description:** Three collection group rules have `allow read: if true`:
  - `{path=**}/orders/{orderId}` – All orders across all shops
  - `{path=**}/teamMembers/{memberId}` – All team members (emails, invite codes)
  - `{path=**}/staff/{staffId}` – All staff (names, phones, invite codes)
- **Attack Scenario:** An attacker can run `getDocs(collectionGroup(db, "orders"))` to enumerate all orders across all shops. Same for staff and teamMembers. This exposes PII, financial data, and invite codes.
- **Recommended Fix:**
  - **Orders:** Restrict collection group read to require tracking identifier (e.g., validate `publicId` or `trackingId` in request). Use a Cloud Function for public tracking lookups that validates the tracking ID server-side.
  - **Staff/TeamMembers:** Restrict collection group read to authenticated users performing invite-code lookup only (e.g., `where("inviteCode","==",requestedCode)`—Firestore cannot validate query params in rules). Consider moving invite validation to a Callable Function.

---

## High Priority Findings

### [HIGH-001] Super Admin Creation Controlled by Client-Only Whitelist

- **Location:** `src/features/super-admin/SuperAdminAuthContext.tsx` lines 21-26, 88-110
- **Description:** Super Admin access is gated by a client-side email whitelist (`SUPER_ADMIN_EMAILS`). When a whitelisted email user logs in and no `super_admins` doc exists, the client **creates** one. Firestore rules allow `create, update: if request.auth.uid == adminId`—so any authenticated user can create a `super_admins/{their_uid}` doc.
- **Attack Scenario:** If an attacker compromises a whitelisted email (e.g., phishing) or if the whitelist is expanded without care, they gain full platform access. The Firestore rule does not validate that the user is authorized to be a super admin.
- **Recommended Fix:** Move super admin creation to a Cloud Function. Only pre-seeded super admin UIDs in Firestore should have access. Remove client-side doc creation; use Admin SDK to create super_admins docs during onboarding.

### [HIGH-002] Shops Collection Public Read

- **Location:** `firestore.rules` line 44
- **Description:** `match /shops/{shopId}` has `allow read: if true`. All shop documents (name, address, phone, ownerId, settings) are readable by anyone.
- **Attack Scenario:** Unauthenticated enumeration of all shops. Competitive intelligence, phishing targeting, or privacy violations.
- **Recommended Fix:** Restrict read to `isAuthenticated()` and shop members/owner, except for specific fields needed for public tracking. Consider splitting public vs. private shop fields into subcollections.

### [HIGH-003] Super Admin Email Whitelist Exposed in Client Bundle

- **Location:** `src/features/super-admin/SuperAdminAuthContext.tsx` lines 21-26
- **Description:** `SUPER_ADMIN_EMAILS` is hardcoded in the client. Emails (e.g., `ramesh@laundrybill.com`, `gudupuramesh@gmail.com`) are visible in the bundled JavaScript.
- **Attack Scenario:** Attackers know which accounts to target for credential stuffing or phishing. Information disclosure.
- **Recommended Fix:** Remove whitelist from client. Use a Callable Function or secure backend to check if the authenticated user's email is authorized. Or rely solely on `super_admins` collection existence (no client-side creation).

---

## Medium Priority Findings

### [MEDIUM-001] Public Receipt Page Uses Order ID as Tracking ID

- **Location:** `src/features/tracking/PublicReceiptPage.tsx` line 31, route `/receipt/:orderId`
- **Description:** The route param is `orderId` but it is passed to `useOrderTracking()`, which treats it as a tracking identifier (publicId, orderNumber, trackingId). If order document IDs are predictable or guessable, users could access other receipts.
- **Attack Scenario:** User with order `ABC-001` tries `/receipt/ABC-002`. If the tracking hook matches by orderNumber/publicId, they might see another order's receipt. Depends on ID format and uniqueness.
- **Recommended Fix:** Ensure the receipt page only resolves by non-guessable identifiers (publicId/trackingId format). Document that `orderId` in the URL is semantically a tracking ID, not Firestore document ID. Add rate limiting if needed.

### [MEDIUM-002] No Default Deny in Firestore Rules

- **Location:** `firestore.rules` – overall structure
- **Description:** Firestore uses allow-based rules. Paths without an explicit `allow` default to deny. However, broad `allow read: if true` rules create large open surfaces. There is no explicit "deny all else" for unknown collections.
- **Attack Scenario:** If a new collection is added without rules, behavior depends on Firestore defaults (deny). Current structure is acceptable but should be reviewed when adding collections.
- **Recommended Fix:** Add a catch-all at the end: `match /{document=**} { allow read, write: if false; }` only if you want to be explicit. Otherwise, ensure every new collection has explicit rules.

### [MEDIUM-003] Activity Logs Allow Create by Any Authenticated User

- **Location:** `firestore.rules` line 231
- **Description:** `match /activity_logs/{logId}` has `allow create: if isAuthenticated()`. Any logged-in user (including Staff, Agent) can create activity log entries.
- **Attack Scenario:** Malicious staff could inject fake audit entries. Log spoofing.
- **Recommended Fix:** Restrict create to `isSuperAdmin()` or use a Cloud Function to write activity logs server-side with validated metadata.

### [MEDIUM-004] Storage Stats Read-Only for Super Admin; Shop Writes

- **Location:** `firestore.rules` lines 137-142
- **Description:** `storageStats` allows `create, update` by `isShopMember(shopId)` but `read` only by `isSuperAdmin()`. This is correct. `storageEvents` allows create by shop members—could be abused to pollute analytics.
- **Attack Scenario:** A malicious shop member could create many `storageEvents` to skew usage or analytics.
- **Recommended Fix:** Add rate limiting or validation in the client/Cloud Function. Consider server-side writes for storage events.

---

## Low Priority Findings

### [LOW-001] Console Logging in Production

- **Location:** Multiple files (e.g., `use-tracking.ts`, `AuthContext.tsx`, `use-orders.ts`, etc.)
- **Description:** 176+ instances of `console.log`, `console.warn`, `console.error` across the codebase. Some may log sensitive data or stack traces.
- **Attack Scenario:** Information leakage through browser console. Debug details could aid attackers.
- **Recommended Fix:** Use a logging library with environment-based levels. Strip or redact logs in production builds.

### [LOW-002] API Keys in Environment Variables

- **Location:** `src/lib/firebase.ts`, `src/lib/geocoding.ts`, `src/services/razorpay-checkout.ts`
- **Description:** Firebase config, Google Maps API key, and Razorpay key ID are loaded via `import.meta.env.VITE_*`. These are bundled into the client and are inherently public.
- **Attack Scenario:** Firebase API key and similar client keys are designed to be public but should be restricted via Firebase Console (domain restrictions, etc.). Google Maps and Razorpay keys should have HTTP referrer / domain restrictions.
- **Recommended Fix:** Ensure all client-side API keys have proper restrictions in their respective developer consoles. Never use server secrets in VITE_ env vars.

### [LOW-003] Functions .env File May Contain Secrets

- **Location:** `functions/.env` (referenced in conversation; contains `ZEPTOMAIL_API_KEY`)
- **Description:** Server-side secrets in `.env` must not be committed. If `.env` is not in `.gitignore`, secrets could be exposed.
- **Recommended Fix:** Verify `functions/.env` is in `.gitignore`. Use Firebase Functions config or Secret Manager for production secrets. Rotate any exposed keys.

---

## Routes & Protection Matrix

| Route Pattern | Required Access | Protection | Status |
|---------------|-----------------|------------|--------|
| `/login` | Public | None | OK |
| `/track`, `/track/:trackingId`, `/track/:shopId/:publicId` | Public | None (by design) | OK |
| `/receipt/:orderId` | Public (tracking ID) | None (by design) | OK (see MEDIUM-001) |
| `/staff/*` | Staff (memberType staff) | StaffProtectedRoute, StaffAuthProvider | OK |
| `/agent/*` | Agent | DriverProtectedRoute, DriverAuthProvider | OK |
| `/plant/*` | Plant Operator | PlantProtectedRoute, DriverAuthProvider | OK |
| `/super-admin/*` | Super Admin | SuperAdminProtectedRoute, SuperAdminAuthProvider | OK (see HIGH-001) |
| `/`, `/dashboard`, `/orders`, etc. | Admin (shop owner) | ProtectedRoute, AuthProvider | OK |
| `/manage-staff`, `/attendance`, etc. | Admin + Plan Feature | ProtectedRoute + FeatureGuard | OK |

**Route Protection Summary:** UI-layer protection is correctly implemented. Staff/Agent/Plant/Admin roles are isolated. Staff cannot access Admin dashboard; Admin cannot access Staff app without Staff credentials. Super Admin is isolated. **However, Firestore rules are the real enforcer**—client-side route guards do not prevent direct Firestore access.

---

## Scenario Trace Results

### Scenario A: Shop User Accessing Staff Dashboard
- **Result:** Redirected to `/staff` (or `/login` if not authenticated). `ProtectedRoute` redirects role `staff` to `/staff`. Shop owners (role `admin`) do not have staff doc, so they use Admin routes.
- **Status:** OK at UI layer. Firestore access depends on `users` doc having correct `shopId` and `role`.

### Scenario B: Staff Accessing Other Shops' Data
- **Result:** Hooks use `shopId` from AuthContext. Staff get `shopId` from `users` doc (created at signup). All queries use `shops/${shopId}/...`. Staff cannot change `shopId` from the normal UI.
- **Status:** OK at client layer. **However**, Firestore rules for orders allow `update: if true`, so a malicious staff could bypass the app and write directly to other shops' orders if they know paths.

### Scenario C: Agent Accessing Super Admin
- **Result:** Super Admin routes use `SuperAdminProtectedRoute` and `SuperAdminAuthProvider`. Agent uses DriverAuthProvider; `isSuperAdmin` is false. Redirect to `/super-admin/login`.
- **Status:** OK at UI layer.

### Scenario D: Direct API Manipulation
- **Result:** Firestore is the backend. A user can open DevTools and call `updateDoc()`, `setDoc()`, etc. with arbitrary paths. With `allow update: if true` on orders, **any order can be updated by anyone**. Other collections have proper checks.
- **Status:** FAIL for orders. CRITICAL-001.

### Scenario E: URL/ID Enumeration
- **Result:** Order detail uses `useOrder(orderId)` which fetches `shops/${shopId}/orders/${orderId}`. `shopId` comes from auth. So enumeration would be within the user's shop only. For public tracking, `publicId`/`trackingId` are used—format is `XXXX-NNNNN` (e.g., FRSH-00001). Enumeration is possible but requires guessing.
- **Status:** Public tracking is intentionally open for customers. Order IDs in admin context are scoped to shop. Low risk if order IDs are not sequential/predictable.

---

## Files Reviewed

- `src/App.tsx` – Route definitions
- `src/features/auth/AuthContext.tsx` – Main auth
- `src/features/auth/ProtectedRoute.tsx` – Route guard
- `src/features/auth/LoginPage.tsx` – Login flow
- `src/features/staff-app/StaffAuthContext.tsx` – Staff auth
- `src/features/staff-app/StaffProtectedRoute.tsx`
- `src/features/driver-app/DriverAuthContext.tsx` – Agent auth
- `src/features/driver-app/DriverProtectedRoute.tsx`
- `src/features/plant-app/PlantProtectedRoute.tsx`
- `src/features/super-admin/SuperAdminAuthContext.tsx` – Super Admin auth
- `src/features/super-admin/SuperAdminProtectedRoute.tsx`
- `src/components/FeatureGuard.tsx` – Plan feature guard
- `src/hooks/use-orders.ts` – Order data access
- `src/hooks/use-tracking.ts` – Public tracking
- `src/features/orders/OrderDetailView.tsx`
- `src/features/tracking/PublicTrackingPage.tsx`
- `src/features/tracking/PublicReceiptPage.tsx`
- `firestore.rules` – Security rules
- `src/lib/firebase.ts` – Firebase config

---

## Recommendations Summary

1. **Immediate:** Change orders `allow update` from `true` to `isShopMember(shopId) || isShopOwner(shopId)` in Firestore rules.
2. **Immediate:** Restrict collection group reads for orders, staff, and teamMembers. Prefer server-side (Callable) validation for public tracking and invite-code lookups.
3. **High:** Remove client-side super admin doc creation. Enforce super admin access via `super_admins` collection populated only by backend/Admin SDK.
4. **High:** Restrict shops read to authenticated users (or split public vs. private fields).
5. **Medium:** Move activity_logs create to server-only or restrict to super admin.
6. **Low:** Audit and reduce console logging; ensure API keys have proper domain restrictions.
7. **Low:** Verify `functions/.env` is gitignored; use Secret Manager for production.

---

*This audit was performed in read-only mode. No code was modified. Address critical and high findings before considering this report resolved.*
