/**
 * Branch creation (multi-shop / Franchise) for the owner app.
 *
 * A new branch gets a GENERATED doc id (never the uid — that's the primary
 * shop) with ownerId = uid. The Cloud Function stamps its plan from the
 * owner's Franchise subscription (no trial). Its catalog is COPIED from the
 * main shop so every branch starts with the same services and prices; if the
 * main shop has no catalog yet, the platform default catalog is used.
 */
import { firestore } from './firebase';

export interface NewBranchOptions {
  phone?: string | null;
  email?: string | null;
  location?: string | null;
  /** Inherited from the main shop so the franchise bills/formats consistently. */
  settingsSource?: Record<string, any> | null;
}

export function buildNewShopData(name: string, ownerId: string, opts: NewBranchOptions = {}): Record<string, any> {
  const s = opts.settingsSource || {};
  const data: Record<string, any> = {
    name,
    ownerId,
    phone: opts.phone || null,
    email: opts.email || null,
    createdAt: new Date(),
    updatedAt: new Date(),
    settings: {
      countryCode: s.countryCode || 'IN',
      currency: s.currency || 'INR',
      currencySymbol: s.currencySymbol || '₹',
      phoneCountryCode: s.phoneCountryCode || '+91',
      locale: s.locale || 'en-IN',
      timezone: s.timezone || 'Asia/Kolkata',
      orderPrefix: 'A',
      nextOrderNumber: 1,
      adsEnabled: true,
      showSelfPromo: true,
      whatsappNotifications: true,
      smsNotifications: false,
      tax: {
        enabled: s.tax?.enabled ?? true,
        name: s.tax?.name || 'GST',
        rate: typeof s.tax?.rate === 'number' ? s.tax.rate : 18,
      },
      delivery: {
        // Branch areas start EMPTY — each branch defines the areas it serves
        // (that's what routes public bookings to the right branch).
        enableServiceAreas: false,
        serviceAreas: [],
        enablePickupSlots: true,
        enableDeliverySlots: true,
        deliveryFeeEnabled: true,
        deliveryFeeMinOrder: s.delivery?.deliveryFeeMinOrder ?? 300,
        deliveryFeeAmount: s.delivery?.deliveryFeeAmount ?? 50,
        defaultCharge: s.delivery?.defaultCharge ?? 50,
        pickupTimeSlots: s.delivery?.pickupTimeSlots || [
          { id: 'slot1', value: '9:00 AM - 11:00 AM', isActive: true },
          { id: 'slot2', value: '11:00 AM - 1:00 PM', isActive: true },
          { id: 'slot3', value: '2:00 PM - 4:00 PM', isActive: true },
          { id: 'slot4', value: '4:00 PM - 6:00 PM', isActive: true },
        ],
        deliveryTimeSlots: s.delivery?.deliveryTimeSlots || [
          { id: 'slot1', value: '9:00 AM - 11:00 AM', isActive: true },
          { id: 'slot2', value: '11:00 AM - 1:00 PM', isActive: true },
          { id: 'slot3', value: '2:00 PM - 4:00 PM', isActive: true },
          { id: 'slot4', value: '4:00 PM - 6:00 PM', isActive: true },
        ],
      },
    },
  };
  if (opts.location) data.location = opts.location;
  return data;
}

/**
 * Seed a branch's catalog by copying the main shop's categories + items.
 * Falls back to the platform default catalog when the source has none.
 */
export async function seedBranchCatalog(newShopId: string, sourceShopId: string): Promise<void> {
  const fs = firestore();

  let cats: any[] = [];
  let items: any[] = [];

  // 1. Prefer the owner's OWN catalog (same services + prices across branches).
  try {
    const [catSnap, itemSnap] = await Promise.all([
      fs.collection(`shops/${sourceShopId}/categories`).get(),
      fs.collection(`shops/${sourceShopId}/inventory`).get(),
    ]);
    if (catSnap.docs.length && itemSnap.docs.length) {
      cats = catSnap.docs.map((d: any) => ({ id: d.id, ...(d.data() || {}) }));
      items = itemSnap.docs.map((d: any) => d.data() || {});
    }
  } catch (e) {
    console.warn('Could not copy the main shop catalog:', e);
  }

  // 2. Fall back to the platform default catalog.
  if (!cats.length || !items.length) {
    try {
      const doc = await fs.collection('platformSettings').doc('defaultCatalog').get();
      const data = doc.exists ? doc.data() : null;
      if (data?.categories?.length && data?.items?.length) {
        cats = data.categories;
        items = data.items;
      }
    } catch (e) {
      console.warn('Could not fetch the platform catalog:', e);
    }
  }

  if (!cats.length || !items.length) return; // nothing to seed — owner adds services manually

  for (const cat of cats) {
    const { id, createdAt, updatedAt, ...rest } = cat as Record<string, any>;
    await fs.collection(`shops/${newShopId}/categories`).doc(String(id)).set({
      ...rest,
      isActive: rest.isActive !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  for (const item of items) {
    const { createdAt, updatedAt, ...rest } = item as Record<string, any>;
    await fs.collection(`shops/${newShopId}/inventory`).add({
      ...rest,
      expressMultiplier: rest.expressMultiplier ?? 1.5,
      isActive: rest.isActive !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}
