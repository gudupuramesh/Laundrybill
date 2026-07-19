/**
 * checkLoginEmail — is this email already a Firebase Auth account?
 *
 * Team-app invite acceptance always CREATES a new Auth account (signup + invite
 * code), so an email that already has an account could never accept its invite.
 * The owner UI calls this before creating a login to fail fast with a clear
 * message instead of leaving a dead invite.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

export const checkLoginEmail = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Sign in required");
    }
    const email = String(request.data?.email || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new HttpsError("invalid-argument", "A valid email is required");
    }
    try {
        await admin.auth().getUserByEmail(email);
        return { existsInAuth: true };
    } catch (e) {
        const code = (e as { code?: string })?.code || "";
        if (code === "auth/user-not-found") {
            return { existsInAuth: false };
        }
        throw new HttpsError("internal", "Email lookup failed");
    }
});
