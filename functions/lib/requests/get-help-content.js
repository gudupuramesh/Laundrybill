"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHelpContent = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
/**
 * Returns help page content (contact, working hours, videos, docs).
 * Reads platformSettings/support first; if empty or missing, falls back to
 * platformSettings/emailBranding so the Help page shows data from the
 * legacy Super Admin fields (Support Contacts + Video Tutorial URL + Help Docs URL).
 * Callable by any authenticated user.
 */
exports.getHelpContent = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "User must be logged in.");
    }
    const db = admin.firestore();
    const supportSnap = await db.doc("platformSettings/support").get();
    const supportData = supportSnap.exists ? supportSnap.data() : null;
    const hasSupportContent = supportData &&
        (supportData.supportPhone ||
            supportData.whatsappNumber ||
            supportData.supportEmail ||
            supportData.workingHours ||
            (Array.isArray(supportData.supportVideos) && supportData.supportVideos.length > 0) ||
            (Array.isArray(supportData.supportDocs) && supportData.supportDocs.length > 0));
    if (hasSupportContent) {
        return {
            supportPhone: (_a = supportData.supportPhone) !== null && _a !== void 0 ? _a : "",
            whatsappNumber: (_b = supportData.whatsappNumber) !== null && _b !== void 0 ? _b : "",
            supportEmail: (_c = supportData.supportEmail) !== null && _c !== void 0 ? _c : "",
            workingHours: (_d = supportData.workingHours) !== null && _d !== void 0 ? _d : "",
            supportVideos: Array.isArray(supportData.supportVideos) ? supportData.supportVideos : [],
            supportDocs: Array.isArray(supportData.supportDocs) ? supportData.supportDocs : [],
        };
    }
    // Fallback: read from emailBranding (Super Admin legacy fields)
    const brandingSnap = await db.doc("platformSettings/emailBranding").get();
    const branding = brandingSnap.exists ? brandingSnap.data() : null;
    const supportPhone = (_e = branding === null || branding === void 0 ? void 0 : branding.supportPhone) !== null && _e !== void 0 ? _e : "";
    const whatsappNumber = (_f = branding === null || branding === void 0 ? void 0 : branding.whatsappNumber) !== null && _f !== void 0 ? _f : "";
    const supportEmail = (_g = branding === null || branding === void 0 ? void 0 : branding.supportEmail) !== null && _g !== void 0 ? _g : "";
    const videoTutorialUrl = (_h = branding === null || branding === void 0 ? void 0 : branding.videoTutorialUrl) !== null && _h !== void 0 ? _h : "";
    const helpDocsUrl = (_j = branding === null || branding === void 0 ? void 0 : branding.helpDocsUrl) !== null && _j !== void 0 ? _j : "";
    const supportVideos = videoTutorialUrl && videoTutorialUrl.trim()
        ? [{ id: "legacy-video", title: "Video Tutorial", url: videoTutorialUrl.trim() }]
        : [];
    const supportDocs = helpDocsUrl && helpDocsUrl.trim()
        ? [{ id: "legacy-doc", title: "Help Docs", url: helpDocsUrl.trim() }]
        : [];
    return {
        supportPhone,
        whatsappNumber,
        supportEmail,
        workingHours: "",
        supportVideos,
        supportDocs,
    };
});
//# sourceMappingURL=get-help-content.js.map