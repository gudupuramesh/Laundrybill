/**
 * Platform default catalog – categories and items with image URLs.
 * Stored in platformSettings/defaultCatalog. Used to seed new shops so they get
 * the same categories/items and images in POS without uploading themselves.
 */

export interface DefaultCatalogCategory {
  id: string;
  name: string;
  icon: string;
  order: number;
  turnaroundDays: number;
}

export interface DefaultCatalogItem {
  categoryId: string;
  categoryName: string;
  subCategory?: string;
  name: string;
  basePrice: number;
  pricingType: "piece" | "kg" | "sqft" | "set";
  turnaroundDays: number;
  order: number;
  /** Image URL – shown in user POS. Super Admin sets here. */
  imageUrl?: string;
}

export interface DefaultCatalogDoc {
  categories: DefaultCatalogCategory[];
  items: DefaultCatalogItem[];
  updatedAt: unknown;
  updatedBy?: string;
}
