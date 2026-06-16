# Laundrybill Driver

Native iOS/Android app for delivery agents. Shares the Laundrybill design system
and Firebase backend with the owner app (`../mobile`). Built with Expo + the JS
Firebase SDK (same chained-facade pattern as `../mobile`).

## What it does

- **Login / signup** — agents sign up with an invite code (created by the shop
  owner) + email/password, then sign in. (`src/lib/DriverAuthContext.tsx`)
- **Today** — greeting, online/offline toggle, today's pickup/delivery/collection
  stats, and the next pending tasks.
- **Pickups / Deliveries** — filterable lists (today / overdue / upcoming / done),
  with Call and Navigate quick actions.
- **Pickup detail** — complete a pickup (items collected, proof photo, notes) and
  edit the order during pickup (adjust quantities, add inventory items).
- **Delivery detail** — collect payment (cash / UPI / already paid), proof photo,
  notes, and mark delivered.
- **Scan** — scan an order QR to jump straight to its pickup/delivery.
- **Profile** — vehicle, service areas, lifetime stats, online toggle, sign out.
- **Push** — registers an Expo push token at
  `shops/{shopId}/agentNotificationTokens/{agentId}` (`tokenType:'expo'`), which
  the existing `sendOrderNotification` Cloud Function already delivers to.

Tasks are derived live from `shops/{shopId}/orders` where
`assignedAgentId == agent.id` — there is no separate `delivery_tasks` collection.

## Setup

1. **Environment** — copy `.env.example` to `.env` and fill in the same
   `EXPO_PUBLIC_FIREBASE_*` values as the owner app (same Firebase project), plus
   `EXPO_PUBLIC_R2_WORKER_URL` for proof-photo uploads.

2. **EAS project** — run `eas init` to create a project id (needed for push
   tokens), then add the printed `extra.eas.projectId` to `app.json`.

3. **Firebase native apps (for push / native builds)** — in the Firebase console,
   register an iOS app (`in.laundrybill.driver`) and an Android app
   (`in.laundrybill.driver`) in the **same** project, download
   `GoogleService-Info.plist` and `google-services.json` into this folder, and add
   the `ios.googleServicesFile` / `android.googleServicesFile` keys to `app.json`.
   (Not required to boot in Expo Go / dev, only for FCM-backed push and store builds.)

## Run

```bash
npm install
npm run start:dev      # dev client
# or a full build:
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

## Design

Tokens come from `src/theme.ts` (kept in sync with the owner app and the canonical
`design.md`): Quicksand, primary `#1B61E5`, soft semantic tints, 18/14/12 radii,
and the shirt + mint-check brand mark (`src/components/BrandLogo.tsx`).
Run `npm run sync-locales` to refresh translations from `../src/locales`.
