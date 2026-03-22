# Razorpay Live Mode Setup

This guide lists the steps and credentials needed to switch from Razorpay **test mode** to **live mode** for real payments.

---

## 1. Razorpay Dashboard – Get Live Credentials

### 1.1 Activate Live Mode

1. Log in to [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. Use the **mode toggle** (top of the dashboard) to switch from **Test Mode** to **Live Mode**.
3. Complete **business KYC** if you haven’t already (required for live mode).

### 1.2 Get API Keys (Live)

1. In **Live Mode**, go to **Settings → API Keys** (or **Developers → API Keys**).
2. Generate or copy:
   - **Key ID** (e.g. `rzp_live_xxxxxxxxxxxx`)
   - **Key Secret** (shown once; store it securely).

You will need:

| Credential        | Used in        | Example / note                          |
|------------------|----------------|----------------------------------------|
| **Key ID**       | Frontend + API | `rzp_live_xxxxxxxxxxxx` (public)        |
| **Key Secret**   | Backend only   | Never expose; backend / Cloud Functions |

---

## 2. Webhook (Required for Subscriptions & Payment Confirmation)

Razorpay sends payment and subscription events to your backend. Your app uses this for:
- `payment.captured` – mark payment success, activate subscription
- `payment.failed` – record failure, send emails
- `subscription.charged` – renewals
- `subscription.cancelled` – end access at cycle end

### 2.1 Webhook URL

After deploying Firebase Functions, your webhook URL will be:

```text
https://<region>-<project-id>.cloudfunctions.net/razorpayWebhook
```

Replace:

- `<region>` – e.g. `asia-south1` (see Firebase Console → Functions)
- `<project-id>` – your Firebase project ID

Example:  
`https://asia-south1-myproject-12345.cloudfunctions.net/razorpayWebhook`

### 2.2 Create Webhook in Razorpay (Live)

1. In **Live Mode**, go to **Account & Settings → Business website details** and open the **Webhooks** tab (or **Settings → Webhooks**).
2. Click **+ Add New Webhook** (or **Create Webhook**).
3. Fill in the form as below.
4. Click **Create Webhook**. Razorpay will show a **Webhook Secret** — copy it and add it to `functions/.env` as `RAZORPAY_WEBHOOK_SECRET`.

---

### 2.3 Webhook form – what to enter

| Field | What to enter |
|--------|----------------|
| **Webhook URL*** | Your HTTPS endpoint. **First deploy your functions**, then use the URL shown in Firebase Console (Functions → `razorpayWebhook` → copy URL). Format: `https://<region>-<project-id>.cloudfunctions.net/razorpayWebhook` — e.g. if your project ID is `laundrybill-prod` and region is `asia-south1`, use: `https://asia-south1-laundrybill-prod.cloudfunctions.net/razorpayWebhook`. |
| **Secret** | Leave **empty** when creating. After you click **Create Webhook**, Razorpay will **generate and show** a secret. Copy that value and put it in `laundryboss/functions/.env` as `RAZORPAY_WEBHOOK_SECRET=...`. (If you prefer to set your own secret, enter any strong random string and use the **same** value in `RAZORPAY_WEBHOOK_SECRET`.) |
| **Alert Email** | Your email for webhook failure alerts, e.g. `gudupuramesh@gmail.com`. |
| **Active Events*** | In **Payment Events**, select: **`payment.captured`**, **`payment.failed`**. In **Subscription Events** (scroll or search), select: **`subscription.activated`**, **`subscription.charged`**, **`subscription.cancelled`**. If **Refund Events** is listed, select **`refund.created`**. (Search box can filter events.) |

Minimum required for LaundryBoss: `payment.captured`, `payment.failed`, `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `refund.created`.

You will need:

| Credential           | Used in              | Note                                      |
|----------------------|----------------------|-------------------------------------------|
| **Webhook Secret**   | Cloud Functions only | Used to verify `x-razorpay-signature`     |

---

## 3. Subscription Plans (If You Use Recurring Billing)

The app maps internal plan IDs to Razorpay Plan IDs in code. For **live** recurring payments you must create **live** plans in Razorpay and put their IDs in the codebase.

### 3.1 Create Plans in Razorpay (Live)

1. In **Live Mode**, go to **Subscriptions → Plans** (or **Products → Plans**).
2. Create one plan per product × billing cycle (e.g. Pro Monthly, Pro Yearly, Pro+ Monthly, etc.).
3. Note each plan’s **Plan ID** (e.g. `plan_xxxxxxxxxxxx`).

### 3.2 Map Plan IDs in Code

In **laundryboss/functions/src/services/razorpay.ts**, the `RAZORPAY_PLAN_MAP` must use these **live** plan IDs:

```ts
export const RAZORPAY_PLAN_MAP: Record<string, { monthly?: string; yearly?: string }> = {
  pro:      { monthly: "plan_XXXX", yearly: "plan_YYYY" },
  pro_plus: { monthly: "plan_XXXX", yearly: "plan_YYYY" },
  business: { monthly: "plan_XXXX", yearly: "plan_YYYY" },
};
```

Replace placeholders with the actual live Plan IDs from the dashboard.

---

## 4. Where to Put the Credentials

### 4.1 Frontend (Vite / LaundryBoss app)

Used to open the Razorpay checkout (key is public; restrict by domain in Razorpay).

**File:** `laundryboss/.env` (create from `laundryboss/.env.example`)

```env
# Razorpay (LIVE – use live key ID here for production)
VITE_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
```

- Only **Key ID** goes here (no secret).
- Rebuild after changing: `npm run build`.

### 4.2 Backend (Firebase Cloud Functions)

Used to create orders, verify webhooks, cancel subscriptions, etc. **Never** expose Key Secret or Webhook Secret to the frontend.

**Option A – Local / `.env` (development and optional for deploy)**

**File:** `laundryboss/functions/.env`

```env
# Razorpay LIVE
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_live_key_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
```

**Option B – Firebase config (production)**

Set secrets so they are not in repo or logs:

```bash
cd laundryboss
firebase functions:config:set razorpay.key_id="rzp_live_xxx" razorpay.key_secret="YOUR_SECRET" razorpay.webhook_secret="WEBHOOK_SECRET"
```

Then in code you would read `functions.config().razorpay` instead of `process.env`. The current code uses `process.env`, so either:

- Keep using **Option A** and set these env vars in your CI/deploy (e.g. GitHub Secrets, Google Cloud Secret Manager, or Firebase’s env config if you use it), or  
- Switch the functions to read from `functions.config().razorpay` and use the command above.

For a minimal “go live” path, use **Option A** and set the same variables in the **Firebase Console** for the Cloud Functions environment (e.g. **Google Cloud Console → Cloud Functions → your function → Edit → Environment variables**).

---

## 5. Checklist Before Going Live

- [ ] Razorpay account in **Live Mode** and KYC completed.
- [ ] **Live** Key ID and Key Secret copied; Key Secret stored securely.
- [ ] **Frontend:** `VITE_RAZORPAY_KEY_ID` set to **live** Key ID in `laundryboss/.env`, app rebuilt.
- [ ] **Backend:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` set for Cloud Functions (e.g. `functions/.env` or Cloud Console env vars).
- [ ] **Webhook** created in Razorpay (Live) with correct URL and events; Webhook Secret copied and set as `RAZORPAY_WEBHOOK_SECRET`.
- [ ] **Plans:** If using subscriptions, live plans created in Razorpay and their IDs updated in `functions/src/services/razorpay.ts` in `RAZORPAY_PLAN_MAP`.
- [ ] Deploy functions so the webhook URL is live:  
  `firebase deploy --only functions`
- [ ] (Recommended) In Razorpay Dashboard, restrict **Key ID** to your production domain (e.g. `https://yourdomain.com/*`).

---

## 6. Credentials Summary (What You Need to Get)

| # | Credential           | Where to get it (Live Mode)           | Where to set it |
|---|----------------------|----------------------------------------|------------------|
| 1 | **Key ID**           | Settings → API Keys → Key ID           | `laundryboss/.env` → `VITE_RAZORPAY_KEY_ID`; `functions/.env` → `RAZORPAY_KEY_ID` |
| 2 | **Key Secret**       | Settings → API Keys → Generate / reveal| `functions/.env` → `RAZORPAY_KEY_SECRET` (backend only) |
| 3 | **Webhook Secret**   | Settings → Webhooks → Add URL → Secret | `functions/.env` → `RAZORPAY_WEBHOOK_SECRET` |
| 4 | **Plan IDs** (optional) | Subscriptions → Plans → each plan’s ID | `functions/src/services/razorpay.ts` → `RAZORPAY_PLAN_MAP` |

Once you have (1)–(3) and, if needed, (4), you can plug them in as above and go live with real Razorpay payments.
