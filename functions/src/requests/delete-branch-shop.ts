/**
 * Delete a franchise BRANCH shop permanently (owner-initiated).
 *
 * Server-side guards:
 *  - caller must be the shop's owner (shops/{id}.ownerId == auth.uid)
 *  - only CHILD shops can be deleted (doc id != owner uid) — the primary shop
 *    carries the account + billing and can never be deleted
 *
 * What it does:
 *  1. Deletes the mirror subscription doc (billing lives on the primary shop).
 *  2. Recursively deletes the shop doc + EVERY subcollection (orders, customers,
 *     inventory, teamMembers, staff, expenses, …). Each teamMembers doc delete
 *     fires the existing onTeamMemberDeleted trigger, which revokes that
 *     login's Firebase Auth account (with its cross-shop safety guard).
 *  The public page + its areas disappear with the doc, so the franchise
 *  booking page drops the branch automatically.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();

export const deleteBranchShop = onCall({ timeoutSeconds: 540 }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be signed in.");
    }
    const uid = request.auth.uid;
    const { shopId } = request.data || {};

    if (!shopId || typeof shopId !== "string") {
        throw new HttpsError("invalid-argument", "Missing or invalid shopId.");
    }

    const shopRef = db.collection("shops").doc(shopId);
    const shopSnap = await shopRef.get();
    if (!shopSnap.exists) {
        throw new HttpsError("not-found", "Shop not found.");
    }
    const shop = shopSnap.data() || {};
    const ownerId = String(shop.ownerId || "");

    if (ownerId !== uid) {
        throw new HttpsError("permission-denied", "Only the owner can delete this shop.");
    }
    if (shopId === uid || shopId === ownerId) {
        throw new HttpsError(
            "failed-precondition",
            "Your main shop cannot be deleted — it carries your account and billing.",
        );
    }

    const shopName = String(shop.name || shopId);
    console.log(`Deleting branch ${shopId} ("${shopName}") for owner ${uid}…`);

    // 1. Mirror subscription first (its sync trigger no-ops on deletes).
    try {
        await db.collection("subscriptions").doc(shopId).delete();
    } catch (e) {
        console.warn(`Could not delete mirror subscription for ${shopId}:`, e);
    }

    // 2. Recursive wipe: shop doc + all subcollections. Sub-doc deletes fire
    //    their normal triggers (e.g. onTeamMemberDeleted → auth revocation).
    try {
        await db.recursiveDelete(shopRef);
    } catch (e) {
        console.error(`Recursive delete failed for ${shopId}:`, e);
        throw new HttpsError("internal", "Could not delete the branch completely. Please try again.");
    }

    console.log(`Branch ${shopId} ("${shopName}") deleted.`);
    return { success: true, shopId, shopName };
});
