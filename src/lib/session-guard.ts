/**
 * One active web session per account.
 *
 * On login each browser tab "claims" `users/{uid}/sessions/web` with a per-tab
 * sessionId (latest write wins) and watches it. If another tab/browser of the same
 * account claims the slot, this tab is signed out and a flag is left for the login
 * page to show "signed out elsewhere". The phone app uses a separate `mobile` slot,
 * so a phone + a browser can be active at the same time. Super-admin is NOT guarded.
 */

import { auth, db } from "@/lib/firebase";
import { signOut as firebaseSignOut } from "firebase/auth";
import { doc, setDoc, deleteDoc, getDoc, onSnapshot, serverTimestamp } from "firebase/firestore";

const PLATFORM = "web";
const EVICTED_FLAG = "sessionEvicted";

// Stable id for THIS tab (one per page load). A reload is a new tab → new id,
// which simply re-claims the slot; it never makes the same tab evict itself.
const MY_SESSION_ID =
    typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

let guardedUid: string | null = null;
let unsub: (() => void) | null = null;

function teardown(): void {
    if (unsub) { unsub(); unsub = null; }
    guardedUid = null;
}

/** Stop watching (on any sign-out). Does not delete the slot. */
export function teardownWebSession(): void {
    teardown();
}

/** Claim + watch the web session slot for this account. Idempotent per uid. */
export function claimWebSession(uid: string): void {
    if (!uid || guardedUid === uid) return; // already guarding this account
    teardown(); // a different account signed in on this tab
    guardedUid = uid;

    const ref = doc(db, "users", uid, "sessions", PLATFORM);

    // Claim the slot (latest write wins — this is what evicts other tabs/browsers).
    void setDoc(ref, {
        sessionId: MY_SESSION_ID,
        claimedAt: serverTimestamp(),
        userAgent: (typeof navigator !== "undefined" ? navigator.userAgent : "").slice(0, 300),
    }).catch(() => { /* best-effort */ });

    // Watch for takeover.
    unsub = onSnapshot(
        ref,
        (snap) => {
            const data = snap.data();
            if (!data || !data.sessionId) return;
            if (data.sessionId !== MY_SESSION_ID) {
                // A newer login took the slot — sign this tab out.
                try { localStorage.setItem(EVICTED_FLAG, "1"); } catch { /* ignore */ }
                teardown(); // stop watching BEFORE signing out (do NOT delete — it's the new owner's slot now)
                void firebaseSignOut(auth).catch(() => {});
            }
        },
        () => { /* permission / transient errors: ignore */ }
    );
}

/** Release the slot on an intentional sign-out (delete only if still ours). */
export async function releaseWebSession(uid: string): Promise<void> {
    teardown();
    if (!uid) return;
    try {
        const ref = doc(db, "users", uid, "sessions", PLATFORM);
        const snap = await getDoc(ref);
        if (snap.exists() && snap.data()?.sessionId === MY_SESSION_ID) {
            await deleteDoc(ref);
        }
    } catch { /* ignore */ }
}

/** Login pages call this once on mount to show + clear the "signed out elsewhere" banner. */
export function consumeEvictionFlag(): boolean {
    try {
        if (localStorage.getItem(EVICTED_FLAG) === "1") {
            localStorage.removeItem(EVICTED_FLAG);
            return true;
        }
    } catch { /* ignore */ }
    return false;
}
