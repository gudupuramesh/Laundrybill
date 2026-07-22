"use strict";
/**
 * Trigger: when a team login (teamMembers doc) is deleted, also delete its Firebase
 * Auth account so the email can be re-invited cleanly.
 *
 * The client SDK can only delete the currently signed-in user — removing someone
 * else's auth account requires the Admin SDK, so this runs server-side and fires
 * regardless of which client (web or owner app) deleted the doc.
 *
 * Safety guards:
 *  - Multi-shop: if the same authUid is still a login at ANOTHER shop, keep the account.
 *  - Never delete a shop OWNER's account.
 *  - Idempotent: deleteStaffCompletely can delete several teamMembers docs, so the
 *    trigger may fire more than once — auth/user-not-found is ignored.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.onTeamMemberDeleted = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const db = admin.firestore();
exports.onTeamMemberDeleted = (0, firestore_1.onDocumentDeleted)("shops/{shopId}/teamMembers/{tmId}", async (event) => {
    var _a, _b;
    const shopId = event.params.shopId;
    const deleted = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!deleted)
        return;
    // 1. Resolve the Firebase Auth uid (prefer stored authUid, else look up by email).
    let uid = (deleted.authUid || "").trim();
    if (!uid && deleted.email) {
        try {
            const rec = await admin.auth().getUserByEmail(deleted.email.trim().toLowerCase());
            uid = rec.uid;
        }
        catch (_c) {
            // No auth account for this email (e.g. invite never accepted) — nothing to do.
            return;
        }
    }
    if (!uid)
        return;
    // 2. Multi-shop guard: still referenced by another teamMembers doc → keep the account.
    try {
        const others = await db
            .collectionGroup("teamMembers")
            .where("authUid", "==", uid)
            .limit(1)
            .get();
        if (!others.empty) {
            console.log(`[onTeamMemberDeleted] authUid ${uid} still used by another shop — keeping auth account.`);
            return;
        }
    }
    catch (e) {
        // If the guard query fails, do NOT delete — fail safe (never orphan a live login).
        console.error("[onTeamMemberDeleted] cross-shop check failed, skipping delete:", e);
        return;
    }
    // 3. Never delete a shop owner's account.
    let userDocExists = false;
    try {
        const userSnap = await db.doc(`users/${uid}`).get();
        if (userSnap.exists) {
            userDocExists = true;
            const role = String(((_b = userSnap.data()) === null || _b === void 0 ? void 0 : _b.role) || "").toLowerCase();
            if (role === "admin" || role === "owner") {
                console.log(`[onTeamMemberDeleted] uid ${uid} is a shop owner — not deleting.`);
                return;
            }
        }
        const owned = await db.collection("shops").where("ownerId", "==", uid).limit(1).get();
        if (!owned.empty) {
            console.log(`[onTeamMemberDeleted] uid ${uid} owns a shop — not deleting.`);
            return;
        }
    }
    catch (e) {
        console.error("[onTeamMemberDeleted] owner check failed, skipping delete:", e);
        return;
    }
    // 4. Delete the Firebase Auth account (idempotent).
    try {
        await admin.auth().deleteUser(uid);
        console.log(`[onTeamMemberDeleted] deleted auth account ${uid} (shop ${shopId}).`);
    }
    catch (e) {
        const code = e === null || e === void 0 ? void 0 : e.code;
        if (code !== "auth/user-not-found") {
            console.error("[onTeamMemberDeleted] deleteUser failed:", e);
            return;
        }
    }
    // 5. Clean up the orphaned users/{uid} doc.
    if (userDocExists) {
        try {
            await db.doc(`users/${uid}`).delete();
        }
        catch (e) {
            console.error("[onTeamMemberDeleted] users doc cleanup failed:", e);
        }
    }
});
//# sourceMappingURL=on-team-member-deleted.js.map