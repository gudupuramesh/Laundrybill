/**
 * Shared shop-creation utilities — used by the signup flow (AuthContext
 * completeSignup) and the multi-shop "Add shop" page, so a shop created either
 * way gets identical defaults (settings, tax, delivery slots, seeded catalog).
 */
import { doc, collection, getDocs, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface NewShopOptions {
    phone?: string | null;
    email?: string | null;
    location?: string | null;
    currency?: string;
    currencySymbol?: string;
    countryCode?: string;
    phoneCountryCode?: string;
    locale?: string;
    timezone?: string;
    taxName?: string;
    /** Initial delivery service areas (e.g. auto-detected at signup). */
    initialServiceAreas?: Array<{ id: string; value: string; isActive: boolean }>;
    enableServiceAreas?: boolean;
}

/**
 * Build the shop document for a brand-new shop. `ownerId` is the owner's auth
 * uid — for the FIRST shop the doc id equals the uid; additional (franchise)
 * shops use a generated doc id but keep the same `ownerId`.
 */
export function buildNewShopData(shopName: string, ownerId: string, opts: NewShopOptions = {}): Record<string, unknown> {
    const shopData: Record<string, unknown> = {
        name: shopName,
        ownerId,
        phone: opts.phone || null,
        email: opts.email || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        settings: {
            countryCode: opts.countryCode || "IN",
            currency: opts.currency || "INR",
            currencySymbol: opts.currencySymbol || "₹",
            phoneCountryCode: opts.phoneCountryCode || "+91",
            locale: opts.locale || "en-IN",
            timezone: opts.timezone || "Asia/Kolkata",
            orderPrefix: "A",
            nextOrderNumber: 1,
            adsEnabled: true,
            showSelfPromo: true,
            whatsappNotifications: true,
            smsNotifications: false,
            tax: { enabled: true, name: opts.taxName || "GST", rate: 18 },
            delivery: {
                enableServiceAreas: opts.enableServiceAreas ?? false,
                serviceAreas: opts.initialServiceAreas || [],
                enablePickupSlots: true,
                enableDeliverySlots: true,
                deliveryFeeEnabled: true,
                deliveryFeeMinOrder: 300,
                deliveryFeeAmount: 50,
                defaultCharge: 50,
                pickupTimeSlots: [
                    { id: "slot1", value: "9:00 AM - 11:00 AM", isActive: true },
                    { id: "slot2", value: "11:00 AM - 1:00 PM", isActive: true },
                    { id: "slot3", value: "2:00 PM - 4:00 PM", isActive: true },
                    { id: "slot4", value: "4:00 PM - 6:00 PM", isActive: true },
                ],
                deliveryTimeSlots: [
                    { id: "slot1", value: "9:00 AM - 11:00 AM", isActive: true },
                    { id: "slot2", value: "11:00 AM - 1:00 PM", isActive: true },
                    { id: "slot3", value: "2:00 PM - 4:00 PM", isActive: true },
                    { id: "slot4", value: "4:00 PM - 6:00 PM", isActive: true },
                ],
            },
        },
    };
    if (opts.location) shopData.location = opts.location;
    return shopData;
}

/**
 * Seed default categories and inventory for a new shop.
 * Uses the platform default catalog (Super Admin Items List) when present, so
 * new shops get categories, items, and images; falls back to the built-in list.
 */
export async function seedDefaultInventory(shopId: string): Promise<void> {
    const batch = writeBatch(db);
    const { getDefaultCatalog } = await import("@/features/super-admin/hooks/use-default-catalog");
    const platformCatalog = await getDefaultCatalog();

    if (platformCatalog?.categories?.length && platformCatalog?.items?.length) {
        // Seed from platform catalog (includes imageUrl when set)
        platformCatalog.categories.forEach((cat) => {
            const ref = doc(collection(db, `shops/${shopId}/categories`), cat.id);
            batch.set(ref, {
                name: cat.name,
                icon: cat.icon,
                order: cat.order,
                turnaroundDays: cat.turnaroundDays,
                isActive: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        });
        platformCatalog.items.forEach((item) => {
            const ref = doc(collection(db, `shops/${shopId}/inventory`));
            const itemData: Record<string, unknown> = {
                categoryId: item.categoryId,
                categoryName: item.categoryName,
                subCategory: item.subCategory ?? "",
                name: item.name,
                basePrice: item.basePrice,
                pricingType: item.pricingType,
                turnaroundDays: item.turnaroundDays,
                order: item.order,
                expressMultiplier: 1.5,
                isActive: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };
            if (item.imageUrl) itemData.imageUrl = item.imageUrl;
            batch.set(ref, itemData);
        });
    } else {
        const { DEFAULT_CATEGORIES, DEFAULT_ITEMS } = await import("@/lib/default-inventory");
        DEFAULT_CATEGORIES.forEach((cat) => {
            const ref = doc(collection(db, `shops/${shopId}/categories`), cat.id);
            batch.set(ref, {
                name: cat.name,
                icon: cat.icon,
                order: cat.order,
                turnaroundDays: cat.turnaroundDays,
                isActive: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        });
        DEFAULT_ITEMS.forEach((item) => {
            const ref = doc(collection(db, `shops/${shopId}/inventory`));
            batch.set(ref, {
                ...item,
                expressMultiplier: 1.5,
                isActive: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        });
    }

    await batch.commit();
}

/**
 * Seed a franchise BRANCH's catalog by copying the main shop's categories +
 * items, so every branch starts with the same services and prices. Falls back
 * to the default catalog when the source shop has none.
 */
export async function seedBranchCatalog(newShopId: string, sourceShopId: string): Promise<void> {
    try {
        const [catSnap, itemSnap] = await Promise.all([
            getDocs(collection(db, `shops/${sourceShopId}/categories`)),
            getDocs(collection(db, `shops/${sourceShopId}/inventory`)),
        ]);
        if (!catSnap.docs.length || !itemSnap.docs.length) {
            await seedDefaultInventory(newShopId);
            return;
        }

        const batch = writeBatch(db);
        catSnap.docs.forEach((d) => {
            const { createdAt: _c, updatedAt: _u, ...rest } = d.data() as Record<string, unknown>;
            batch.set(doc(collection(db, `shops/${newShopId}/categories`), d.id), {
                ...rest,
                isActive: rest.isActive !== false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        });
        itemSnap.docs.forEach((d) => {
            const { createdAt: _c, updatedAt: _u, ...rest } = d.data() as Record<string, unknown>;
            batch.set(doc(collection(db, `shops/${newShopId}/inventory`)), {
                ...rest,
                expressMultiplier: rest.expressMultiplier ?? 1.5,
                isActive: rest.isActive !== false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        });
        await batch.commit();
    } catch (e) {
        console.warn("Branch catalog copy failed — falling back to the default catalog:", e);
        await seedDefaultInventory(newShopId);
    }
}

/**
 * "Import default catalogue" for an EXISTING shop — merges the platform default
 * catalogue in without touching what the owner already has: categories whose id
 * already exists are left as-is, and an item is skipped when the same category
 * already has an item with that name. (seedDefaultInventory is only safe on an
 * empty shop: it would reset categories and duplicate every item.)
 */
export async function importDefaultCatalogue(
    shopId: string,
    existingCategoryIds: string[],
    existingItems: { categoryId: string; name: string }[],
): Promise<{ categories: number; items: number }> {
    const { getDefaultCatalog } = await import("@/features/super-admin/hooks/use-default-catalog");
    const platform = await getDefaultCatalog();
    let cats: { id: string; name: string; icon?: string; order: number; turnaroundDays?: number }[];
    let items: { categoryId: string; categoryName?: string; subCategory?: string; name: string; basePrice: number; pricingType: string; turnaroundDays?: number; order?: number; imageUrl?: string }[];
    if (platform?.categories?.length && platform?.items?.length) {
        cats = platform.categories as typeof cats;
        items = platform.items as typeof items;
    } else {
        const def = await import("@/lib/default-inventory");
        cats = def.DEFAULT_CATEGORIES as unknown as typeof cats;
        items = def.DEFAULT_ITEMS as unknown as typeof items;
    }

    const haveCat = new Set(existingCategoryIds);
    const key = (c: string, n: string) => `${c}::${n.trim().toLowerCase()}`;
    const haveItem = new Set(existingItems.map((i) => key(i.categoryId, i.name)));

    const newCats = cats.filter((c) => !haveCat.has(c.id));
    const newItems = items.filter((i) => !haveItem.has(key(i.categoryId, i.name)));
    if (!newCats.length && !newItems.length) return { categories: 0, items: 0 };

    // Firestore batches cap at 500 writes.
    const writes: ((b: ReturnType<typeof writeBatch>) => void)[] = [];
    newCats.forEach((cat) => writes.push((b) => b.set(doc(collection(db, `shops/${shopId}/categories`), cat.id), {
        name: cat.name, icon: cat.icon ?? null, order: cat.order, turnaroundDays: cat.turnaroundDays ?? 2,
        isActive: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })));
    newItems.forEach((item) => writes.push((b) => {
        const data: Record<string, unknown> = {
            categoryId: item.categoryId, categoryName: item.categoryName ?? "", subCategory: item.subCategory ?? "",
            name: item.name, basePrice: item.basePrice, pricingType: item.pricingType, turnaroundDays: item.turnaroundDays ?? 2,
            order: item.order ?? 0, expressMultiplier: 1.5, isActive: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        };
        if (item.imageUrl) data.imageUrl = item.imageUrl;
        b.set(doc(collection(db, `shops/${shopId}/inventory`)), data);
    }));
    for (let i = 0; i < writes.length; i += 450) {
        const b = writeBatch(db);
        writes.slice(i, i + 450).forEach((w) => w(b));
        await b.commit();
    }
    return { categories: newCats.length, items: newItems.length };
}
