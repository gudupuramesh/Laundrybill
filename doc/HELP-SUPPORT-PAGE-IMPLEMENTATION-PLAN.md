# Help & Support Page – Implementation Plan

## 1. Goal

- **Help page** (for shop owners in the main app): Single place to see support contact (dial, WhatsApp, email), working hours, and curated **support docs** and **videos** (titles + links). Videos show a small preview/thumbnail and title; tap opens the link (YouTube, Instagram, etc.).
- **Super Admin**: Configure all of the above in one place (support phone, WhatsApp, email, working hours, multiple docs, multiple videos with title + URL). Whatever the super admin enters is shown on the Help page.

---

## 2. What’s Already There

- **Platform Settings (Super Admin)** already has: Support Email, Support Phone, WhatsApp Number, and single “Video Tutorial URL” / “Help Docs URL” in `platformSettings/emailBranding`.
- **Functions** use `getPlatformSettings()` reading from `platformSettings/emailBranding` for emails; no Help-specific doc yet.

---

## 3. Data Model

Use a **separate Firestore document** for Help content so that:
- Only support/help fields are readable by shop owners (not full email branding).
- Super Admin has a dedicated “Support & Help” section (or extend Platform Settings) to edit this.

**Document:** `platformSettings/support`

**Shape:**

```ts
{
  supportPhone: string;        // e.g. "+91 98765 43210"
  whatsappNumber: string;      // e.g. "919876543210" (no + or spaces)
  supportEmail: string;
  workingHours: string;       // e.g. "Mon–Fri 9 AM–6 PM IST"
  supportVideos: {
    id: string;               // stable id (e.g. nanoid or "v1", "v2")
    title: string;             // e.g. "How to create an order"
    url: string;               // YouTube, Instagram, or any URL
  }[];
  supportDocs: {
    id: string;
    title: string;
    url: string;
  }[];
  updatedAt: Timestamp;
  updatedBy?: string;
}
```

- **Super Admin** writes to `platformSettings/support` (create/update).
- **Help page** reads `platformSettings/support` (authenticated shop users only).

---

## 4. Firestore Rules

- **Current:** `platformSettings/{docId}` allow read, write: if isSuperAdmin().
- **Change:** Add an exception for the `support` doc:
  - `platformSettings/support`: **read** if `request.auth != null` (any logged-in user, so shop owners can load Help).
  - **write** if isSuperAdmin() only.

So in `firestore.rules`, keep the existing `match /platformSettings/{docId}` but add a more specific rule **before** it for `support`:

```text
match /platformSettings/support {
  allow read: if request.auth != null;
  allow write: if isSuperAdmin();
}
match /platformSettings/{docId} {
  allow read, write: if isSuperAdmin();
}
```

(Order matters: more specific path first.)

---

## 5. Super Admin – Support & Help configuration

**Where:** Extend **Platform Settings** page with a **“Support & Help”** card (or a dedicated “Support” section at the top/bottom).

**Fields:**

| Field | Control | Notes |
|--------|--------|--------|
| Support Phone | Text input | Already in “Support Contacts”; keep and ensure saved to `support` doc as well, or use as single source (see below). |
| WhatsApp Number | Text input | Same. |
| Support Email | Text input | Same. |
| Working Hours | Single text line | e.g. “Mon–Fri 9 AM–6 PM IST”. |
| Support Videos | List of { title, url } | Add/remove rows; each row: Title + URL. Optional: detect YouTube and show “Preview” thumbnail. |
| Support Docs | List of { title, url } | Add/remove rows; each row: Title + URL. |

**Single source of truth:**  
- **Option A:** Super Admin edits support contact + working hours + videos + docs only in this new “Support & Help” card and we **write only to `platformSettings/support`**. Help page reads from `platformSettings/support`. Emails can keep using `emailBranding` for support email/phone (or we copy from `support` in functions).  
- **Option B:** Keep support phone/email/WhatsApp in `emailBranding` for emails; **additionally** write them into `platformSettings/support` when saving Platform Settings so the Help page reads from one doc.  
- **Recommended:** **Option B** – Super Admin continues to set Support Contacts and Working Hours in Platform Settings; we **also** write these (and videos/docs) into `platformSettings/support` when saving. So one form, two writes: emailBranding (for emails) + support (for Help page). No duplicate UI.

**UI for multiple videos/docs:**

- “Support Videos”: “Add video” button; each item: [Title input] [URL input] [Remove]. Order preserved (array order).
- “Support Docs”: same pattern.

Save: merge into `platformSettings/support` (and keep existing merge into `emailBranding` for support email/phone/whatsapp).

---

## 6. Help Page (Shop Owner App)

**Route:** `/help` (under main app layout, protected).

**Sidebar / More menu:** Add a **“Help”** item (e.g. HelpCircle icon) that links to `/help`. Shown to all shop users (no feature flag).

**Layout:**

1. **Contact support**
   - **Call:** link `tel:${supportPhone}` (display supportPhone).
   - **WhatsApp:** link `https://wa.me/${whatsappNumber}` (e.g. “Chat on WhatsApp”).
   - **Email:** `mailto:${supportEmail}`.
   - **Working hours:** plain text (e.g. “Mon–Fri 9 AM–6 PM IST”).

2. **Tabs or two sections:** “Videos” and “Docs”.

3. **Videos tab**
   - For each `supportVideos[]` item:
     - **Thumbnail:** If URL is YouTube (`youtube.com/watch?v=ID` or `youtu.be/ID`), use `https://img.youtube.com/vi/VIDEO_ID/mqdefault.jpg`. Otherwise show a generic “video” placeholder (or optional: try oEmbed for Instagram later).
     - **Title** above or below the thumbnail.
     - Tap/click: open `url` in new tab (`window.open(url, '_blank')`).
   - Layout: grid of cards (e.g. 2 columns on mobile, 3 on desktop).

4. **Docs tab**
   - List of links: each item = title (and optional “Open” or icon). Click opens URL in new tab.
   - Simple list or card list.

**Data loading:** Help page reads `platformSettings/support` once (e.g. `getDoc` or a small hook `useSupportSettings()`). If doc is missing, show a friendly “Support info not configured” and still show any hardcoded fallback (e.g. support email from env or nothing).

---

## 7. Video thumbnail

- **YouTube:** Extract `v=` or `youtu.be/` ID; use `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`.
- **Others (Instagram, Vimeo, etc.):** Use a generic placeholder image or icon (e.g. “Video” icon with play button). Optional later: add oEmbed or backend thumbnail fetch.

---

## 8. What You Might Be Missing (and we’ll include)

- **Working hours** – explicit field and display on Help.
- **Multiple videos** with title + URL and preview (not just one “Video Tutorial URL”).
- **Multiple docs** with title + URL (not just one “Help Docs URL”).
- **Clear “Dial” and “WhatsApp”** actions on the Help page.
- **Help entry in the left menu** so users can find it without going into Settings.

Optional (can be phase 2):

- FAQ accordion (Super Admin could add FAQ items later).
- “Contact us” form that sends an email to support (needs backend/email).

---

## 9. File / Code Touch Points

| Area | File(s) | Change |
|------|--------|--------|
| Firestore rules | `firestore.rules` | Add `platformSettings/support` read for auth users, write for super admin. |
| Types | `src/types/support.ts` (new) or in existing types | `SupportSettings` interface. |
| Hook | `src/hooks/use-support-settings.ts` (new) | `getDoc(platformSettings/support)` for Help page. |
| Super Admin | `PlatformSettingsPage.tsx` | Add “Support & Help” card: working hours, supportVideos[], supportDocs[]; save to `platformSettings/support` and keep saving support email/phone/whatsapp to emailBranding. |
| Help page | `src/features/help/HelpPage.tsx` (new) | Contact block + Videos grid + Docs list; use `useSupportSettings()`. |
| App routes | `App.tsx` | Add route `/help` → HelpPage. |
| Sidebar / More | `AppLayout.tsx` | Add “Help” item (HelpCircle icon) → `/help`. |
| YouTube thumbnail | Small util `src/lib/youtube-thumbnail.ts` | `getYoutubeThumbnailUrl(url)` → thumbnail URL or null. |

---

## 10. Summary

- **Single doc** `platformSettings/support` holds: support phone, WhatsApp, email, working hours, `supportVideos[]`, `supportDocs[]`.
- **Super Admin** configures these in Platform Settings (one “Support & Help” card) and we write to both `emailBranding` (support contact for emails) and `support` (for Help page).
- **Help page** at `/help` shows contact (dial, WhatsApp, email), working hours, and two sections/tabs: Videos (with thumbnails + titles, open in new tab) and Docs (title + link).
- **Navigation:** “Help” in the left sidebar and in the More menu.

After your approval, implementation will follow this plan (rules, types, hook, Super Admin UI, Help page, route, nav).
