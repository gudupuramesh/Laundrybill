import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

// Only for development/admin use
export const manualTrigger = onRequest(async (req, res) => {
    // Basic security: Check for a secret query param if needed, or rely on IAM
    // For now, open but safe since it only processes genuinely expired docs

    console.log("Trace: Manually triggering subscription expiration check (Diagnostic Mode)...");

    try {
        if (admin.apps.length === 0) {
            admin.initializeApp();
        }
        const db = admin.firestore();
        const now = admin.firestore.Timestamp.now();

        // DIAGNOSTIC MODE:
        // Fetch ALL active/trial subscriptions first to see what's going on.
        // This helps debug if the issue is with the Query (Index) or the Data (Types/Values).
        // DIAGNOSTIC MODE:
        // Fetch ALL subscriptions (limit 50) to see what's going on with statuses.
        const allSnapshot = await db.collection("subscriptions")
            .limit(50)
            .get();

        console.log(`Diagnostic: Found ${allSnapshot.size} active/trial subscriptions.`);

        const results = [];
        const ignored = [];

        for (const doc of allSnapshot.docs) {
            const subData = doc.data();
            const shopId = subData.shopId;
            const status = subData.status;
            const endDate = subData.endDate; // Should be Timestamp

            // Check if endDate exists and is a Timestamp
            if (!endDate || typeof endDate.toDate !== 'function') {
                console.warn(`Skipping ${shopId}: Invalid endDate format`, endDate);
                ignored.push({ shopId, reason: "Invalid endDate format", value: endDate });
                continue;
            }

            const endDateObj = endDate.toDate();
            const nowObj = now.toDate();

            if (endDateObj < nowObj) {
                // THIS SHOULD HAVE EXPIRED
                console.log(`Processing expiry for ${shopId} (EndDate: ${endDateObj} < Now: ${nowObj})`);

                let newStatus = "expired";
                let trialExpiredAt = null;

                // Legacy trial users are treated as free
                if (status === "trial") {
                    newStatus = "free";
                    trialExpiredAt = now;
                }

                // Update Sub
                await doc.ref.update({
                    status: newStatus,
                    updatedAt: now,
                    expiredAt: now,
                    ...(trialExpiredAt ? { trialExpiredAt } : {})
                });

                // Update Shop
                if (shopId) {
                    await db.collection("shops").doc(shopId).update({
                        plan: "free",
                        subscriptionStatus: newStatus,
                        "subscription.planId": "free",
                        "subscription.status": newStatus,
                        "subscription.endDate": null,
                        updatedAt: now
                    });
                }



                results.push({ shopId, oldStatus: status, newStatus, endDate: endDateObj });
            } else {
                ignored.push({ shopId, reason: "Not yet expired", endDate: endDateObj, now: nowObj });
            }
        }

        res.json({
            success: true,
            message: "Manual expiration check completed",
            processedCount: results.length,
            totalActiveFound: allSnapshot.size,
            processed: results,
            ignoredSample: ignored // Show ALL ignored for debug
        });

    } catch (error: any) {
        console.error("Error in manual trigger:", error);
        res.status(500).json({ error: error.message });
    }
});
