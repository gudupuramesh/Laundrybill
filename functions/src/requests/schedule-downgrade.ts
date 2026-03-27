/**
 * Schedule a plan downgrade at period end (user-initiated).
 * Sets pendingDowngrade; applied by applyScheduledDowngrades job.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { sendEmail } from "../services/zeptomail";
import { getPlatformSettings } from "../services/platform-settings";
import { getDowngradeScheduledTemplate } from "../services/email-downgrade-scheduled";
import { normalizePlanId, planDisplayName } from "../lib/plan-normalize";

const PLAN_ORDER: Record<string, number> = {
    free: 0,
    pro: 1,
};

const VALID_TO_PLAN_RAW = ["free", "pro", "pro_plus", "business"];

if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();

export const scheduleDowngrade = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be signed in to schedule a downgrade.");
    }

    const { shopId, toPlan } = request.data;

    if (!shopId || typeof shopId !== "string") {
        throw new HttpsError("invalid-argument", "Missing or invalid shopId.");
    }
    if (!toPlan || typeof toPlan !== "string" || !VALID_TO_PLAN_RAW.includes(String(toPlan).toLowerCase().trim())) {
        throw new HttpsError("invalid-argument", "Missing or invalid toPlan.");
    }
    const toPlanNorm = normalizePlanId(toPlan);

    const uid = request.auth.uid;

    try {
        const shopRef = db.collection("shops").doc(shopId);
        const shopDoc = await shopRef.get();
        if (!shopDoc.exists) {
            throw new HttpsError("not-found", "Shop not found.");
        }

        const shopData = shopDoc.data();
        const ownerId = shopData?.ownerId ?? shopData?.userId;
        if (ownerId && ownerId !== uid) {
            throw new HttpsError("permission-denied", "You can only change your own shop's subscription.");
        }

        const subRef = db.collection("subscriptions").doc(shopId);
        const subDoc = await subRef.get();
        if (!subDoc.exists) {
            throw new HttpsError("failed-precondition", "No subscription found for this shop.");
        }

        const subData = subDoc.data();
        const status = subData?.status;
        const currentPlan = subData?.planId || "free";
        const currentPlanNorm = normalizePlanId(currentPlan);

        if (status !== "active" && status !== "trial") {
            throw new HttpsError("failed-precondition", "Only active or trial subscriptions can be downgraded.");
        }

        const fromOrder = PLAN_ORDER[currentPlanNorm] ?? 0;
        const toOrder = PLAN_ORDER[toPlanNorm] ?? 0;
        if (toOrder >= fromOrder) {
            throw new HttpsError(
                "invalid-argument",
                "Can only downgrade to a lower plan. Use Upgrade for a higher plan."
            );
        }

        if (subData?.pendingDowngrade?.toPlan) {
            throw new HttpsError("failed-precondition", "A downgrade is already scheduled.");
        }

        const now = admin.firestore.Timestamp.now();
        const effectiveDate = subData?.currentPeriodEnd ?? subData?.endDate ?? now;

        await subRef.update({
            pendingDowngrade: {
                toPlan: toPlanNorm,
                effectiveDate,
                requestedAt: now,
            },
            updatedAt: now,
        });

        const effectiveDateObj = effectiveDate?.toDate?.();

        try {
            const shopData = shopDoc.data();
            const ownerEmail = shopData?.email ?? shopData?.ownerEmail;
            if (ownerEmail) {
                const settings = await getPlatformSettings();
                const effectiveStr = effectiveDateObj
                    ? effectiveDateObj.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
                    : "";
                const htmlBody = getDowngradeScheduledTemplate({
                    shopName: shopData?.name || "Shop Owner",
                    currentPlanName: planDisplayName(currentPlan),
                    newPlanName: planDisplayName(toPlanNorm),
                    effectiveDate: effectiveStr,
                    settings,
                });
                await sendEmail({
                    to: [{ address: ownerEmail, name: shopData?.name || "Shop Owner" }],
                    subject: "Plan change scheduled – LaundryBill",
                    htmlBody,
                });
                console.log(`Downgrade scheduled email sent to ${ownerEmail}`);
            }
        } catch (err) {
            console.error("Failed to send downgrade scheduled email:", err);
        }

        return {
            success: true,
            toPlan: toPlanNorm,
            effectiveDate: effectiveDateObj ? effectiveDateObj.toISOString() : null,
            message: `Your plan will change to ${planDisplayName(toPlanNorm)} at the end of your current period.`,
        };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        console.error("Schedule downgrade error:", error);
        throw new HttpsError("internal", "Failed to schedule downgrade.");
    }
});
