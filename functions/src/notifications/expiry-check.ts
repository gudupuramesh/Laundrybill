import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { sendEmail } from "../services/zeptomail";
import { getExpiryReminderTemplate } from "../services/email-expiry";
import { getPlatformSettings } from "../services/platform-settings";
import { getShopCurrencySymbol } from "../services/currency-helper";

// Ensure Firestore is initialized (shared instance from index.ts usually, but safe to call)
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();

/**
 * Send Expiry Notifications at 9:00 AM daily.
 * Triggers for: 15, 7, 3, 2, 1 days remaining.
 */
export const sendExpiryNotifications = onSchedule("every day 09:00", async (event) => {
    console.log("Starting daily expiry notification check...");

    const now = new Date();
    // Normalize "now" to midnight for consistent day calculation if needed, 
    // or just use current time and compare difference.
    // Better: Use start of day.

    try {
        // Query ALL active subscriptions. 
        // Note: For large scale, we should use a cursor or distributed counter, 
        // but for < 10k subs, a single query is usually fine in Cloud Functions (540s timeout).
        const snapshot = await db.collection("subscriptions")
            .where("status", "==", "active")
            .get();

        if (snapshot.empty) {
            console.log("No active subscriptions found.");
            return;
        }

        console.log(`Checking ${snapshot.size} active subscriptions.`);

        // Fetch platform settings once for all emails
        const settings = await getPlatformSettings();

        let emailsSent = 0;
        const notifications: Promise<any>[] = [];

        for (const doc of snapshot.docs) {
            const sub = doc.data();
            const endDate = sub.endDate?.toDate();

            if (!endDate) continue;

            // Calculate Days Remaining
            // Time diff in milliseconds
            const diffMs = endDate.getTime() - now.getTime();
            // Convert to days (ceil to cover partial days as 1 day remaining)
            const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

            // Target Days: 15, 7, 3, 2, 1
            // Also handle 0? (Expires today). Maybe critical alert?
            // User asked for: 15, 7, 3, 2, 1.
            const targetDays = [15, 7, 3, 2, 1];

            if (targetDays.includes(daysRemaining)) {
                // Fetch Shop details to get Name and Email
                const shopId = sub.shopId || doc.id;

                notifications.push((async () => {
                    try {
                        const shopDoc = await db.collection("shops").doc(shopId).get();
                        const shopData = shopDoc.data();

                        const email = shopData?.email || sub.userEmail; // specific email field fallback
                        const shopName = shopData?.name || "Shop Owner";
                        const planName = sub.planName || "Premium";
                        const expiryDateStr = endDate.toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "long",
                            year: "numeric"
                        });
                        // Renewal link - updated to LaundryBill
                        const renewalUrl = "https://app.laundrybill.com/settings/subscription";

                        if (email) {
                            console.log(`Sending ${daysRemaining}-day notice to ${email} (Shop: ${shopId})`);

                            const currencySymbol = await getShopCurrencySymbol(shopId);
                            const htmlBody = getExpiryReminderTemplate({
                                shopName,
                                planName,
                                daysRemaining,
                                expiryDate: expiryDateStr,
                                renewalUrl,
                                currencySymbol,
                                settings
                            });

                            await sendEmail({
                                to: [{ address: email, name: shopName }],
                                subject: `⏰ Action Required: Your ${planName} Plan Expires in ${daysRemaining} Days`,
                                htmlBody: htmlBody
                            });
                            return 1;
                        } else {
                            console.warn(`No email found for shop ${shopId}`);
                            return 0;
                        }
                    } catch (err) {
                        console.error(`Failed to send email for shop ${shopId}:`, err);
                        return 0;
                    }
                })());
            }
        }

        // Wait for all notifications (batching implicitly)
        // Promise.all might hit concurrency limits if too many.
        // For now, it's fine.
        const results = await Promise.all(notifications);
        emailsSent = results.reduce((a, b) => a + b, 0);

        console.log(`Sent ${emailsSent} expiry notifications.`);

    } catch (error) {
        console.error("Error in sendExpiryNotifications:", error);
    }
});
