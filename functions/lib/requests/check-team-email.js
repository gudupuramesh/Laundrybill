"use strict";
/**
 * Owner-side pre-check before creating a team login: does this email already
 * have a Firebase Auth account (an owner signup or an existing team login)?
 * The Team app's sign-up CREATES a new auth account, so an already-registered
 * email can never complete team sign-up — surfacing that at creation time
 * saves the owner a confused round-trip with their staff member.
 * Auth-required so this can't be used for open email enumeration.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkTeamEmail = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
exports.checkTeamEmail = (0, https_1.onCall)(async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Sign in required.");
    const email = String((request.data || {}).email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
        throw new https_1.HttpsError("invalid-argument", "A valid email is required.");
    }
    try {
        await admin.auth().getUserByEmail(email);
        return { inUse: true };
    }
    catch (e) {
        if ((e === null || e === void 0 ? void 0 : e.code) === "auth/user-not-found")
            return { inUse: false };
        throw new https_1.HttpsError("internal", "Could not check the email.");
    }
});
//# sourceMappingURL=check-team-email.js.map