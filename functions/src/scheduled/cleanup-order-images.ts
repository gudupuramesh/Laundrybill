/**
 * Daily scheduled function: delete order images from R2 for orders that completed
 * more than 30 days ago. Only images are removed; order data is kept.
 *
 * Completed = Shop Pickup: picked_up | Home Delivery / Pickup & Delivery: delivered.
 * Completion date = deliveredAt for delivered, updatedAt for picked_up.
 */

import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { deleteFromR2ByUrl } from "../services/r2-cleanup";

const db = admin.firestore();

const RETENTION_DAYS = 30;

function getCutoffTimestamp(): admin.firestore.Timestamp {
    const d = new Date();
    d.setDate(d.getDate() - RETENTION_DAYS);
    d.setHours(0, 0, 0, 0);
    return admin.firestore.Timestamp.fromDate(d);
}

/** Collect all image URLs from an order (damage photos, pickup/delivery proof, item damages). */
function collectOrderImageUrls(data: admin.firestore.DocumentData): string[] {
    const urls: string[] = [];
    const add = (u: unknown) => {
        if (typeof u === "string" && u.startsWith("http")) urls.push(u);
    };
    const arr = (a: unknown) => Array.isArray(a) ? a : [];
    (arr(data.damagePhotoUrls)).forEach(add);
    add(data.pickupPhoto);
    add(data.deliveryPhoto);
    const items = arr(data.items);
    items.forEach((item: { damages?: { photoUrl?: string }[] }) => {
        arr(item.damages).forEach((d: { photoUrl?: string }) => add(d?.photoUrl));
    });
    return urls;
}

/** Build order update to clear image fields (keep order data). */
function buildClearImagesUpdate(data: admin.firestore.DocumentData): Record<string, unknown> {
    const update: Record<string, unknown> = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (data.damagePhotoUrls != null) {
        update.damagePhotoUrls = [];
    }
    if (data.pickupPhoto != null) {
        update.pickupPhoto = admin.firestore.FieldValue.delete();
    }
    if (data.deliveryPhoto != null) {
        update.deliveryPhoto = admin.firestore.FieldValue.delete();
    }
    const items = Array.isArray(data.items) ? data.items : [];
    const hasItemDamages = items.some((i: { damages?: unknown[] }) => (i.damages || []).length > 0);
    if (hasItemDamages) {
        const newItems = items.map((item: { damages?: { description?: string; photoUrl?: string }[] }) => ({
            ...item,
            damages: (item.damages || []).map((d) => ({
                description: d.description ?? "",
                photoUrl: "",
            })),
        }));
        update.items = newItems;
    }
    return update;
}

export const cleanupOrderImagesDaily = onSchedule("every day 03:00", async () => {
        const cutoff = getCutoffTimestamp();
        console.log(`Cleanup order images: completed orders before ${cutoff.toDate().toISOString()} (${RETENTION_DAYS} days ago).`);

        let totalOrders = 0;
        let totalUrls = 0;
        let totalDeleted = 0;
        let totalFailed = 0;

        try {
            // 1) Delivered orders: completed = deliveredAt
            const deliveredSnap = await db.collectionGroup("orders")
                .where("status", "==", "delivered")
                .where("deliveredAt", "<", cutoff)
                .get();

            // 2) Picked up (shop pickup): completed = updatedAt
            const pickedUpSnap = await db.collectionGroup("orders")
                .where("status", "==", "picked_up")
                .where("updatedAt", "<", cutoff)
                .get();

            const uniqueByPath = new Map<string, admin.firestore.QueryDocumentSnapshot>();
            deliveredSnap.docs.forEach((d) => uniqueByPath.set(d.ref.path, d));
            pickedUpSnap.docs.forEach((d) => {
                if (!uniqueByPath.has(d.ref.path)) uniqueByPath.set(d.ref.path, d);
            });
            const ordersToProcess = Array.from(uniqueByPath.values());

            for (const docSnap of ordersToProcess) {
                const data = docSnap.data();
                const urls = collectOrderImageUrls(data);
                if (urls.length === 0) continue;

                totalOrders += 1;
                totalUrls += urls.length;

                for (const url of urls) {
                    const ok = await deleteFromR2ByUrl(url);
                    if (ok) totalDeleted += 1;
                    else totalFailed += 1;
                }

                const update = buildClearImagesUpdate(data);
                if (Object.keys(update).length > 1) {
                    await docSnap.ref.update(update);
                }
            }

            console.log(
                `Cleanup done. Orders: ${totalOrders}, URLs: ${totalUrls}, R2 deleted: ${totalDeleted}, failed: ${totalFailed}.`
            );
        } catch (err) {
            console.error("Cleanup order images failed:", err);
            throw err;
        }
    }
);
