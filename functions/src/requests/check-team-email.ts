/**
 * Owner-side pre-check before creating a team login: does this email already
 * have a Firebase Auth account (an owner signup or an existing team login)?
 * The Team app's sign-up CREATES a new auth account, so an already-registered
 * email can never complete team sign-up — surfacing that at creation time
 * saves the owner a confused round-trip with their staff member.
 * Auth-required so this can't be used for open email enumeration.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

export const checkTeamEmail = onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
    const email = String((request.data || {}).email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
        throw new HttpsError("invalid-argument", "A valid email is required.");
    }
    try {
        await admin.auth().getUserByEmail(email);
        return { inUse: true };
    } catch (e) {
        if ((e as { code?: string })?.code === "auth/user-not-found") return { inUse: false };
        throw new HttpsError("internal", "Could not check the email.");
    }
});
