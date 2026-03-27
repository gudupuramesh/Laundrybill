"use strict";
/**
 * Schedule a plan downgrade at period end (user-initiated).
 * Sets pendingDowngrade; applied by applyScheduledDowngrades job.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleDowngrade = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const zeptomail_1 = require("../services/zeptomail");
const platform_settings_1 = require("../services/platform-settings");
const email_downgrade_scheduled_1 = require("../services/email-downgrade-scheduled");
const plan_normalize_1 = require("../lib/plan-normalize");
const PLAN_ORDER = {
    free: 0,
    pro: 1,
};
const VALID_TO_PLAN_RAW = ["free", "pro", "pro_plus", "business"];
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
exports.scheduleDowngrade = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "You must be signed in to schedule a downgrade.");
    }
    const { shopId, toPlan } = request.data;
    if (!shopId || typeof shopId !== "string") {
        throw new https_1.HttpsError("invalid-argument", "Missing or invalid shopId.");
    }
    if (!toPlan || typeof toPlan !== "string" || !VALID_TO_PLAN_RAW.includes(String(toPlan).toLowerCase().trim())) {
        throw new https_1.HttpsError("invalid-argument", "Missing or invalid toPlan.");
    }
    const toPlanNorm = (0, plan_normalize_1.normalizePlanId)(toPlan);
    const uid = request.auth.uid;
    try {
        const shopRef = db.collection("shops").doc(shopId);
        const shopDoc = await shopRef.get();
        if (!shopDoc.exists) {
            throw new https_1.HttpsError("not-found", "Shop not found.");
        }
        const shopData = shopDoc.data();
        const ownerId = (_a = shopData === null || shopData === void 0 ? void 0 : shopData.ownerId) !== null && _a !== void 0 ? _a : shopData === null || shopData === void 0 ? void 0 : shopData.userId;
        if (ownerId && ownerId !== uid) {
            throw new https_1.HttpsError("permission-denied", "You can only change your own shop's subscription.");
        }
        const subRef = db.collection("subscriptions").doc(shopId);
        const subDoc = await subRef.get();
        if (!subDoc.exists) {
            throw new https_1.HttpsError("failed-precondition", "No subscription found for this shop.");
        }
        const subData = subDoc.data();
        const status = subData === null || subData === void 0 ? void 0 : subData.status;
        const currentPlan = (subData === null || subData === void 0 ? void 0 : subData.planId) || "free";
        const currentPlanNorm = (0, plan_normalize_1.normalizePlanId)(currentPlan);
        if (status !== "active" && status !== "trial") {
            throw new https_1.HttpsError("failed-precondition", "Only active or trial subscriptions can be downgraded.");
        }
        const fromOrder = (_b = PLAN_ORDER[currentPlanNorm]) !== null && _b !== void 0 ? _b : 0;
        const toOrder = (_c = PLAN_ORDER[toPlanNorm]) !== null && _c !== void 0 ? _c : 0;
        if (toOrder >= fromOrder) {
            throw new https_1.HttpsError("invalid-argument", "Can only downgrade to a lower plan. Use Upgrade for a higher plan.");
        }
        if ((_d = subData === null || subData === void 0 ? void 0 : subData.pendingDowngrade) === null || _d === void 0 ? void 0 : _d.toPlan) {
            throw new https_1.HttpsError("failed-precondition", "A downgrade is already scheduled.");
        }
        const now = admin.firestore.Timestamp.now();
        const effectiveDate = (_f = (_e = subData === null || subData === void 0 ? void 0 : subData.currentPeriodEnd) !== null && _e !== void 0 ? _e : subData === null || subData === void 0 ? void 0 : subData.endDate) !== null && _f !== void 0 ? _f : now;
        await subRef.update({
            pendingDowngrade: {
                toPlan: toPlanNorm,
                effectiveDate,
                requestedAt: now,
            },
            updatedAt: now,
        });
        const effectiveDateObj = (_g = effectiveDate === null || effectiveDate === void 0 ? void 0 : effectiveDate.toDate) === null || _g === void 0 ? void 0 : _g.call(effectiveDate);
        try {
            const shopData = shopDoc.data();
            const ownerEmail = (_h = shopData === null || shopData === void 0 ? void 0 : shopData.email) !== null && _h !== void 0 ? _h : shopData === null || shopData === void 0 ? void 0 : shopData.ownerEmail;
            if (ownerEmail) {
                const settings = await (0, platform_settings_1.getPlatformSettings)();
                const effectiveStr = effectiveDateObj
                    ? effectiveDateObj.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
                    : "";
                const htmlBody = (0, email_downgrade_scheduled_1.getDowngradeScheduledTemplate)({
                    shopName: (shopData === null || shopData === void 0 ? void 0 : shopData.name) || "Shop Owner",
                    currentPlanName: (0, plan_normalize_1.planDisplayName)(currentPlan),
                    newPlanName: (0, plan_normalize_1.planDisplayName)(toPlanNorm),
                    effectiveDate: effectiveStr,
                    settings,
                });
                await (0, zeptomail_1.sendEmail)({
                    to: [{ address: ownerEmail, name: (shopData === null || shopData === void 0 ? void 0 : shopData.name) || "Shop Owner" }],
                    subject: "Plan change scheduled – LaundryBill",
                    htmlBody,
                });
                console.log(`Downgrade scheduled email sent to ${ownerEmail}`);
            }
        }
        catch (err) {
            console.error("Failed to send downgrade scheduled email:", err);
        }
        return {
            success: true,
            toPlan: toPlanNorm,
            effectiveDate: effectiveDateObj ? effectiveDateObj.toISOString() : null,
            message: `Your plan will change to ${(0, plan_normalize_1.planDisplayName)(toPlanNorm)} at the end of your current period.`,
        };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        console.error("Schedule downgrade error:", error);
        throw new https_1.HttpsError("internal", "Failed to schedule downgrade.");
    }
});
//# sourceMappingURL=schedule-downgrade.js.map