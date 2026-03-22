"use strict";
/**
 * Validate that an email belongs to a Staff / Agent / Plant app login before allowing password reset.
 * Called from Staff and Agent login "Forgot password" flows. Prevents sending reset links to shop owners
 * or other non-app-login emails.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAppLoginEmailForPasswordReset = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
exports.validateAppLoginEmailForPasswordReset = (0, https_1.onCall)({ enforceAppCheck: false }, async (request) => {
    const data = request.data;
    if (!data || typeof data.email !== "string" || !data.email.trim()) {
        throw new https_1.HttpsError("invalid-argument", "Email is required.");
    }
    const appType = data.appType;
    if (appType !== "staff" && appType !== "agent") {
        throw new https_1.HttpsError("invalid-argument", "appType must be 'staff' or 'agent'.");
    }
    const normalizedEmail = data.email.trim().toLowerCase();
    if (!normalizedEmail) {
        return { allowed: false };
    }
    const teamMembersRef = db.collectionGroup("teamMembers");
    const snapshot = await teamMembersRef
        .where("email", "==", normalizedEmail)
        .where("inviteStatus", "==", "accepted")
        .limit(1)
        .get();
    if (snapshot.empty) {
        return { allowed: false };
    }
    const doc = snapshot.docs[0];
    const memberType = doc.get("memberType");
    if (appType === "staff") {
        return { allowed: memberType === "staff" || memberType === "plant" };
    }
    return { allowed: memberType === "agent" };
});
//# sourceMappingURL=validate-app-login-email.js.map