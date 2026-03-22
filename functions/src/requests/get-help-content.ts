import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

/**
 * Returns help page content (contact, working hours, videos, docs).
 * Reads platformSettings/support first; if empty or missing, falls back to
 * platformSettings/emailBranding so the Help page shows data from the
 * legacy Super Admin fields (Support Contacts + Video Tutorial URL + Help Docs URL).
 * Callable by any authenticated user.
 */
export const getHelpContent = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const db = admin.firestore();

    const supportSnap = await db.doc("platformSettings/support").get();
    const supportData = supportSnap.exists ? supportSnap.data() : null;

    const hasSupportContent =
        supportData &&
        (supportData.supportPhone ||
            supportData.whatsappNumber ||
            supportData.supportEmail ||
            supportData.workingHours ||
            (Array.isArray(supportData.supportVideos) && supportData.supportVideos.length > 0) ||
            (Array.isArray(supportData.supportDocs) && supportData.supportDocs.length > 0));

    if (hasSupportContent) {
        return {
            supportPhone: supportData.supportPhone ?? "",
            whatsappNumber: supportData.whatsappNumber ?? "",
            supportEmail: supportData.supportEmail ?? "",
            workingHours: supportData.workingHours ?? "",
            supportVideos: Array.isArray(supportData.supportVideos) ? supportData.supportVideos : [],
            supportDocs: Array.isArray(supportData.supportDocs) ? supportData.supportDocs : [],
        };
    }

    // Fallback: read from emailBranding (Super Admin legacy fields)
    const brandingSnap = await db.doc("platformSettings/emailBranding").get();
    const branding = brandingSnap.exists ? brandingSnap.data() : null;

    const supportPhone = branding?.supportPhone ?? "";
    const whatsappNumber = branding?.whatsappNumber ?? "";
    const supportEmail = branding?.supportEmail ?? "";
    const videoTutorialUrl = branding?.videoTutorialUrl ?? "";
    const helpDocsUrl = branding?.helpDocsUrl ?? "";

    const supportVideos =
        videoTutorialUrl && videoTutorialUrl.trim()
            ? [{ id: "legacy-video", title: "Video Tutorial", url: videoTutorialUrl.trim() }]
            : [];
    const supportDocs =
        helpDocsUrl && helpDocsUrl.trim()
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
