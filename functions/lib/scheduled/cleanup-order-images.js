"use strict";
/**
 * Daily scheduled function: delete order images from R2 for orders that completed
 * more than 30 days ago. Only images are removed; order data is kept.
 *
 * Completed = Shop Pickup: picked_up | Home Delivery / Pickup & Delivery: delivered.
 * Completion date = deliveredAt for delivered, updatedAt for picked_up.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupOrderImagesDaily = void 0;
const admin = require("firebase-admin");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const r2_cleanup_1 = require("../services/r2-cleanup");
const db = admin.firestore();
const RETENTION_DAYS = 30;
function getCutoffTimestamp() {
    const d = new Date();
    d.setDate(d.getDate() - RETENTION_DAYS);
    d.setHours(0, 0, 0, 0);
    return admin.firestore.Timestamp.fromDate(d);
}
/** Collect all image URLs from an order (damage photos, pickup/delivery proof, item damages). */
function collectOrderImageUrls(data) {
    const urls = [];
    const add = (u) => {
        if (typeof u === "string" && u.startsWith("http"))
            urls.push(u);
    };
    const arr = (a) => Array.isArray(a) ? a : [];
    (arr(data.damagePhotoUrls)).forEach(add);
    add(data.pickupPhoto);
    add(data.deliveryPhoto);
    const items = arr(data.items);
    items.forEach((item) => {
        arr(item.damages).forEach((d) => add(d === null || d === void 0 ? void 0 : d.photoUrl));
    });
    return urls;
}
/** Build order update to clear image fields (keep order data). */
function buildClearImagesUpdate(data) {
    const update = {
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
    const hasItemDamages = items.some((i) => (i.damages || []).length > 0);
    if (hasItemDamages) {
        const newItems = items.map((item) => (Object.assign(Object.assign({}, item), { damages: (item.damages || []).map((d) => {
                var _a;
                return ({
                    description: (_a = d.description) !== null && _a !== void 0 ? _a : "",
                    photoUrl: "",
                });
            }) })));
        update.items = newItems;
    }
    return update;
}
exports.cleanupOrderImagesDaily = (0, scheduler_1.onSchedule)("every day 03:00", async () => {
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
        const uniqueByPath = new Map();
        deliveredSnap.docs.forEach((d) => uniqueByPath.set(d.ref.path, d));
        pickedUpSnap.docs.forEach((d) => {
            if (!uniqueByPath.has(d.ref.path))
                uniqueByPath.set(d.ref.path, d);
        });
        const ordersToProcess = Array.from(uniqueByPath.values());
        for (const docSnap of ordersToProcess) {
            const data = docSnap.data();
            const urls = collectOrderImageUrls(data);
            if (urls.length === 0)
                continue;
            totalOrders += 1;
            totalUrls += urls.length;
            for (const url of urls) {
                const ok = await (0, r2_cleanup_1.deleteFromR2ByUrl)(url);
                if (ok)
                    totalDeleted += 1;
                else
                    totalFailed += 1;
            }
            const update = buildClearImagesUpdate(data);
            if (Object.keys(update).length > 1) {
                await docSnap.ref.update(update);
            }
        }
        console.log(`Cleanup done. Orders: ${totalOrders}, URLs: ${totalUrls}, R2 deleted: ${totalDeleted}, failed: ${totalFailed}.`);
    }
    catch (err) {
        console.error("Cleanup order images failed:", err);
        throw err;
    }
});
//# sourceMappingURL=cleanup-order-images.js.map