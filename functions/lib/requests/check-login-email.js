"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkLoginEmail = void 0;
/**
 * checkLoginEmail — is this email already a Firebase Auth account?
 *
 * Team-app invite acceptance always CREATES a new Auth account (signup + invite
 * code), so an email that already has an account could never accept its invite.
 * The owner UI calls this before creating a login to fail fast with a clear
 * message instead of leaving a dead invite.
 */
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
exports.checkLoginEmail = (0, https_1.onCall)(async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Sign in required");
    }
    const email = String(((_a = request.data) === null || _a === void 0 ? void 0 : _a.email) || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new https_1.HttpsError("invalid-argument", "A valid email is required");
    }
    try {
        await admin.auth().getUserByEmail(email);
        return { existsInAuth: true };
    }
    catch (e) {
        const code = (e === null || e === void 0 ? void 0 : e.code) || "";
        if (code === "auth/user-not-found") {
            return { existsInAuth: false };
        }
        throw new https_1.HttpsError("internal", "Email lookup failed");
    }
});
//# sourceMappingURL=check-login-email.js.map