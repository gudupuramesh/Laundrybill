/**
 * Welcome Email Trigger
 * Sends a welcome email when a new shop is created
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { sendEmail } from "../services/zeptomail";
import { getWelcomeEmailTemplate } from "../services/email-templates";
import { getPlatformSettings } from "../services/platform-settings";

const db = admin.firestore();

export const sendWelcomeEmail = onDocumentCreated(
    "shops/{shopId}",
    async (event) => {
        const shopData = event.data?.data();
        if (!shopData) {
            console.log("No shop data found");
            return;
        }

        const shopName = shopData.name || "New Shop";
        const ownerEmail = shopData.email;

        if (!ownerEmail) {
            console.log("No owner email found for shop:", event.params.shopId);
            return;
        }

        console.log(`Sending welcome email to ${ownerEmail} for shop: ${shopName}`);

        // Fetch platform settings for dynamic branding
        const settings = await getPlatformSettings();
        const htmlBody = getWelcomeEmailTemplate(shopName, settings);

        const result = await sendEmail({
            to: [{ address: ownerEmail, name: shopName }],
            subject: `🎉 Welcome to ${settings.brandName} - Let's Get Started!`,
            htmlBody: htmlBody,
        });

        if (result.success) {
            console.log(`Welcome email sent successfully to ${ownerEmail}`);
            // Log the email send event
            await db.collection("email_logs").add({
                type: "welcome",
                shopId: event.params.shopId,
                email: ownerEmail,
                status: "sent",
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        } else {
            console.error(`Failed to send welcome email to ${ownerEmail}:`, result.error);
            await db.collection("email_logs").add({
                type: "welcome",
                shopId: event.params.shopId,
                email: ownerEmail,
                status: "failed",
                error: result.error,
                attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    }
);
