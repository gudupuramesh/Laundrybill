# Multi-Country Scope – Research Summary

> Research on global demand for laundry/POS apps and whether LaundryBoss can support other countries.  
> **Date:** Feb 2025

---

## 1. Is there real scope in other countries?

**Yes.** The global market for laundry management and on-demand laundry is large and growing.

### Laundry management software (POS / operations)

| Metric | Value |
|--------|--------|
| **2024 market size** | ~USD 1.4–2.9 billion |
| **By 2033** | ~USD 3.6–6.2 billion |
| **CAGR** | ~9–11% |

- **Drivers:** Digitalisation, cloud/SaaS, automation, compliance (hospitality, healthcare).
- **Regions:** North America, Europe, and Asia-Pacific all show strong adoption.
- **Competitors** (multi-location / international): CleanCloud, Cents, Caramel (e.g. RTL/Arabic support).

### On-demand laundry (pickup/delivery, apps)

| Metric | Value |
|--------|--------|
| **2023–24 market size** | ~USD 30–60+ billion |
| **By 2030–34** | ~USD 60–600+ billion (range by report) |
| **CAGR** | ~8–36% (varies by region) |

**By region/country (indicative):**

- **USA:** Largest established market (~USD 8–16 billion); ~35%+ of global share; strong adoption in metro areas and dual-income households.
- **Europe:** Largest regional market in some reports; Germany ~30% CAGR.
- **Asia-Pacific:** Fastest-growing region (rising income, urbanisation, convenience).
- **China:** Very high growth (e.g. ~48% CAGR in some forecasts).
- **Canada, Japan:** Strong growth (~28–32% CAGR).
- **Middle East:** Growing; platforms like Caramel support Arabic/RTL.

**Conclusion:** There is real, measurable demand for laundry management and on-demand laundry services in the USA, Europe, Middle East, and Asia-Pacific. Supporting other countries is aligned with market scope.

---

## 2. Does LaundryBoss support other countries today?

**Not fully.** The app is **India-first** in several areas.

| Area | Current behaviour |
|------|-------------------|
| **Currency** | Default and many flows assume **INR** (₹). Shop setting has `currency` but UI/formats often hardcode INR. |
| **Phone** | **+91** and 10-digit Indian numbers are assumed (e.g. `LPhoneInput`, create-public-order, duplicate checks). |
| **Payments** | **Razorpay** only (India). Subscriptions and one-time payments are INR/Razorpay. |
| **Locale / formatting** | Many `toLocaleString("en-IN")` and similar India-specific formats. |
| **SMS/OTP** | MSG91 and similar flows are India-oriented. |
| **Timezone** | Default `Asia/Kolkata`. |

So: the app can *run* elsewhere, but **currency, phone, payments, and formatting are not yet built for multiple countries**. True “support” for other countries would require the changes below.

---

## 3. What would be needed to support other countries later?

A practical checklist (no implementation yet, for product/planning):

1. **Currency**
   - Use shop (or platform) `currency` everywhere; no hardcoded INR.
   - Format amounts with `Intl.NumberFormat(locale, { currency })` and correct symbols (₹, $, €, etc.).

2. **Phone**
   - Country code selection (e.g. +91, +1, +44, +971) and validation per country.
   - Store E.164 or country+number; customer match and duplicate checks should use that.

3. **Payments**
   - Support at least one payment provider per target country (e.g. Stripe for US/EU, Razorpay for India).
   - Subscription and one-time flows configurable by region/shop.

4. **Locale and formatting**
   - Dates, numbers, and currency from locale (e.g. `en-IN`, `en-US`, `ar-AE`).
   - Replace hardcoded `"en-IN"` with user/shop locale where appropriate.

5. **Timezone**
   - Already have `shop.settings.timezone`; ensure slots, reports, and emails use it everywhere.

6. **Legal / compliance**
   - Tax (GST vs VAT vs local rules), invoices, and data residency as you expand.

7. **Optional**
   - RTL and extra languages (e.g. Arabic) if targeting Middle East.
   - Address formats and postcodes by country.

---

## 4. Summary

| Question | Answer |
|----------|--------|
| **Is there real scope in other countries?** | **Yes.** Global laundry management and on-demand laundry markets are large and growing in USA, Europe, Middle East, and Asia-Pacific. |
| **Do we support other countries today?** | **Only partly.** App is India-first (INR, +91, Razorpay, en-IN). It can run elsewhere but is not “multi-country ready”. |
| **Worth planning for the future?** | **Yes.** Demand exists; making currency, phone, payments, and locale configurable would put you in a position to support other countries when you decide to expand. |

This doc can be updated as you add multi-country features or new market research.
