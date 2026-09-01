/**
 * Owner app store listings (Laundry Bill POS Manager) — single source for every
 * "download our app" surface (Subscription page, dashboard promo banner, …).
 * Region-neutral URLs so each store localizes automatically; env vars override.
 */
export const GOOGLE_PLAY_URL =
    import.meta.env.VITE_GOOGLE_PLAY_URL || "https://play.google.com/store/apps/details?id=in.laundrybill";
export const APP_STORE_URL =
    import.meta.env.VITE_APP_STORE_URL || "https://apps.apple.com/app/laundry-bill-pos-manager/id6778047645";

export type MobileOS = "android" | "ios" | "other";

/** Best-effort device OS — used to put the right store first. */
export function detectMobileOS(): MobileOS {
    const ua = navigator.userAgent || "";
    if (/android/i.test(ua)) return "android";
    if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
    return "other";
}

/** True when running inside the owner Android app's WebView — don't advertise
 *  the app to someone already inside it. NOTE: index.html's Android bridge
 *  defines window.androidGoogleToken (null) in EVERY browser, so only a truthy
 *  value — an actually-injected token — counts, never mere presence. */
export function isInAppWebView(): boolean {
    return /; wv\)/.test(navigator.userAgent || "") || !!(window as { androidGoogleToken?: unknown }).androidGoogleToken;
}

/** Team app (staff / delivery agent / plant) Google Play listing. */
export const TEAM_GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=in.laundrybill.driver";

/**
 * Team-app onboarding message shared by every place that hands a login to a
 * member. Always carries the Play Store link — an invite code alone leaves the
 * member guessing which app to install.
 */
export function buildTeamInviteMessage(opts: {
    name?: string;
    email: string;
    inviteCode: string;
    /** Optional browser alternative (the /staff|/driver|/plant signup page). */
    webSignupUrl?: string;
}): string {
    const who = opts.name?.trim() || "there";
    const lines = [
        `Hi ${who}! You've been added on Laundrybill Team.`,
        "",
        `1. Install the Laundrybill Team app: ${TEAM_GOOGLE_PLAY_URL}`,
        '2. Open it and tap "Sign Up"',
        `3. Email: ${opts.email.trim().toLowerCase()} (use exactly this email)`,
        "4. Create your own password",
        `5. Invite code: ${opts.inviteCode}`,
    ];
    if (opts.webSignupUrl) lines.push("", `Prefer a browser? ${opts.webSignupUrl}`);
    lines.push("", "Note: sign UP (not sign in) the first time. If it says the email is already registered, tell your shop owner — that email may already have a Laundrybill account.");
    return lines.join("\n");
}
