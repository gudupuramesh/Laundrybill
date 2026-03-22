/**
 * Platform Settings Service
 * Fetches platform-wide settings from Firestore for use in emails and other services
 */

import * as admin from "firebase-admin";

// Ensure admin is initialized if not already
if (admin.apps.length === 0) {
    admin.initializeApp();
}

export interface PlatformSettings {
    // Brand
    logoUrl: string;
    brandName: string;
    websiteUrl: string;
    appUrl: string;
    dashboardUrl: string;

    // Legal
    companyName: string;
    gstNumber: string;
    address: string;

    // Support
    supportEmail: string;
    supportPhone: string;
    whatsappNumber: string;
    whatsappUrl: string;

    // Social (optional)
    facebookUrl?: string;
    instagramUrl?: string;
    twitterUrl?: string;
    linkedinUrl?: string;

    // Help Resources
    videoTutorialUrl?: string;
    helpDocsUrl?: string;
}

// Default settings (fallback if not configured in Firestore)
const DEFAULT_SETTINGS: PlatformSettings = {
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

/**
 * Fetch platform settings from Firestore
 * Returns default values if not configured
 */
export async function getPlatformSettings(): Promise<PlatformSettings> {
    const db = admin.firestore();
    try {
        const doc = await db.collection("platformSettings").doc("emailBranding").get();

        if (!doc.exists) {
            console.log("Platform settings not found, using defaults");
            return DEFAULT_SETTINGS;
        }

        const data = doc.data();

        // Merge with defaults to ensure all fields exist
        const settings: PlatformSettings = {
            // Brand
            logoUrl: data?.logoUrl || DEFAULT_SETTINGS.logoUrl,
            brandName: data?.brandName || DEFAULT_SETTINGS.brandName,
            websiteUrl: data?.websiteUrl || DEFAULT_SETTINGS.websiteUrl,
            appUrl: data?.appUrl || DEFAULT_SETTINGS.appUrl,
            dashboardUrl: data?.dashboardUrl || data?.appUrl + "/dashboard" || DEFAULT_SETTINGS.dashboardUrl,

            // Legal
            companyName: data?.companyName || DEFAULT_SETTINGS.companyName,
            gstNumber: data?.gstNumber || DEFAULT_SETTINGS.gstNumber,
            address: data?.address || DEFAULT_SETTINGS.address,

            // Support
            supportEmail: data?.supportEmail || DEFAULT_SETTINGS.supportEmail,
            supportPhone: data?.supportPhone || DEFAULT_SETTINGS.supportPhone,
            whatsappNumber: data?.whatsappNumber || DEFAULT_SETTINGS.whatsappNumber,
            whatsappUrl: data?.whatsappNumber
                ? `https://wa.me/${data.whatsappNumber.replace(/\D/g, "")}`
                : DEFAULT_SETTINGS.whatsappUrl,

            // Social
            facebookUrl: data?.facebookUrl || "",
            instagramUrl: data?.instagramUrl || "",
            twitterUrl: data?.twitterUrl || "",
            linkedinUrl: data?.linkedinUrl || "",

            // Help Resources
            videoTutorialUrl: data?.videoTutorialUrl || "",
            helpDocsUrl: data?.helpDocsUrl || ""
        };

        console.log("Platform settings loaded from Firestore");
        return settings;

    } catch (error) {
        console.error("Error fetching platform settings:", error);
        return DEFAULT_SETTINGS;
    }
}

export { DEFAULT_SETTINGS };
