/**
 * Shared shop-creation utilities — used by the signup flow (AuthContext
 * completeSignup) and the multi-shop "Add shop" page, so a shop created either
 * way gets identical defaults (settings, tax, delivery slots, seeded catalog).
 */
import { doc, collection, writeBatch, serverTimestamp } from "firebase/firestore";
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
