/**
 * Group order items by service category for display (Wash & Iron, Ironing, etc.)
 */

export const CATEGORY_DISPLAY_ORDER = [
    "Wash & Iron",
    "Wash & Fold",
    "Ironing",
    "Iron Only",
    "Dry Cleaning",
    "Household",
    "Shoe Cleaning",
    "Premium",
    "Others",
] as const;

export function groupOrderItemsByCategory<T>(
    items: T[],
    getCategory: (item: T) => string
): { categoryName: string; items: T[] }[] {
    const map = new Map<string, T[]>();
    for (const item of items) {
        const key = (getCategory(item) || "").trim() || "Others";
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
    }
    const result: { categoryName: string; items: T[] }[] = [];
    for (const cat of CATEGORY_DISPLAY_ORDER) {
        if (map.has(cat)) {
            result.push({ categoryName: cat, items: map.get(cat)! });
            map.delete(cat);
        }
    }
    map.forEach((group, cat) => result.push({ categoryName: cat, items: group }));
    return result;
}
