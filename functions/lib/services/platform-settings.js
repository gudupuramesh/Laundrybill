"use strict";
/**
 * Platform Settings Service
 * Fetches platform-wide settings from Firestore for use in emails and other services
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SETTINGS = exports.getPlatformSettings = void 0;
const admin = require("firebase-admin");
// Ensure admin is initialized if not already
if (admin.apps.length === 0) {
    admin.initializeApp();
}
// Default settings (fallback if not configured in Firestore)
const DEFAULT_SETTINGS = {
    // Brand
    logoUrl: "https://laundrybill.com/logo.png",
    brandName: "LaundryBill",
    websiteUrl: "https://laundrybill.com",
    appUrl: "https://app.laundrybill.com",
    dashboardUrl: "https://app.laundrybill.com/dashboard",
    // Legal
    companyName: "LaundryBill Technologies Pvt. Ltd.",
    gstNumber: "27AABCU9603R1ZX",
    address: "123 Business Hub, Andheri East, Mumbai, Maharashtra 400069",
    // Support
    supportEmail: "support@laundrybill.com",
    supportPhone: "+91 98765 43210",
    whatsappNumber: "919876543210",
    whatsappUrl: "https://wa.me/919876543210",
    // Social
    facebookUrl: "",
    instagramUrl: "",
    twitterUrl: "",
    linkedinUrl: "",
    // Help Resources
    videoTutorialUrl: "",
    helpDocsUrl: ""
};
exports.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
/**
 * Fetch platform settings from Firestore
 * Returns default values if not configured
 */
async function getPlatformSettings() {
    const db = admin.firestore();
    try {
        const doc = await db.collection("platformSettings").doc("emailBranding").get();
        if (!doc.exists) {
            console.log("Platform settings not found, using defaults");
            return DEFAULT_SETTINGS;
        }
        const data = doc.data();
        // Merge with defaults to ensure all fields exist
        const settings = {
            // Brand
            logoUrl: (data === null || data === void 0 ? void 0 : data.logoUrl) || DEFAULT_SETTINGS.logoUrl,
            brandName: (data === null || data === void 0 ? void 0 : data.brandName) || DEFAULT_SETTINGS.brandName,
            websiteUrl: (data === null || data === void 0 ? void 0 : data.websiteUrl) || DEFAULT_SETTINGS.websiteUrl,
            appUrl: (data === null || data === void 0 ? void 0 : data.appUrl) || DEFAULT_SETTINGS.appUrl,
            dashboardUrl: (data === null || data === void 0 ? void 0 : data.dashboardUrl) || (data === null || data === void 0 ? void 0 : data.appUrl) + "/dashboard" || DEFAULT_SETTINGS.dashboardUrl,
            // Legal
            companyName: (data === null || data === void 0 ? void 0 : data.companyName) || DEFAULT_SETTINGS.companyName,
            gstNumber: (data === null || data === void 0 ? void 0 : data.gstNumber) || DEFAULT_SETTINGS.gstNumber,
            address: (data === null || data === void 0 ? void 0 : data.address) || DEFAULT_SETTINGS.address,
            // Support
            supportEmail: (data === null || data === void 0 ? void 0 : data.supportEmail) || DEFAULT_SETTINGS.supportEmail,
            supportPhone: (data === null || data === void 0 ? void 0 : data.supportPhone) || DEFAULT_SETTINGS.supportPhone,
            whatsappNumber: (data === null || data === void 0 ? void 0 : data.whatsappNumber) || DEFAULT_SETTINGS.whatsappNumber,
            whatsappUrl: (data === null || data === void 0 ? void 0 : data.whatsappNumber)
                ? `https://wa.me/${data.whatsappNumber.replace(/\D/g, "")}`
                : DEFAULT_SETTINGS.whatsappUrl,
            // Social
            facebookUrl: (data === null || data === void 0 ? void 0 : data.facebookUrl) || "",
            instagramUrl: (data === null || data === void 0 ? void 0 : data.instagramUrl) || "",
            twitterUrl: (data === null || data === void 0 ? void 0 : data.twitterUrl) || "",
            linkedinUrl: (data === null || data === void 0 ? void 0 : data.linkedinUrl) || "",
            // Help Resources
            videoTutorialUrl: (data === null || data === void 0 ? void 0 : data.videoTutorialUrl) || "",
            helpDocsUrl: (data === null || data === void 0 ? void 0 : data.helpDocsUrl) || ""
        };
        console.log("Platform settings loaded from Firestore");
        return settings;
    }
    catch (error) {
        console.error("Error fetching platform settings:", error);
        return DEFAULT_SETTINGS;
    }
}
exports.getPlatformSettings = getPlatformSettings;
//# sourceMappingURL=platform-settings.js.map