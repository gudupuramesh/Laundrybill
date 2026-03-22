/**
 * Inventory Seeder
 * 
 * Seeds default categories and services for a new shop
 */

import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const defaultCategories = [
    { name: "Wash & Fold", icon: "droplets", order: 1 },
    { name: "Ironing", icon: "wind", order: 2 },
    { name: "Dry Cleaning", icon: "sparkles", order: 3 },
    { name: "Specialty", icon: "shirt", order: 4 },
];

const defaultServices = [
    // Wash & Fold
    { name: "Regular Wash", categoryName: "Wash & Fold", basePrice: 60, pricingType: "kg", turnaroundDays: 2 },
    { name: "Premium Wash", categoryName: "Wash & Fold", basePrice: 80, pricingType: "kg", turnaroundDays: 2 },

    // Ironing
    { name: "Shirt", categoryName: "Ironing", basePrice: 15, pricingType: "piece", turnaroundDays: 1 },
    { name: "Pant", categoryName: "Ironing", basePrice: 15, pricingType: "piece", turnaroundDays: 1 },
    { name: "Saree", categoryName: "Ironing", basePrice: 40, pricingType: "piece", turnaroundDays: 1 },
    { name: "Kurta", categoryName: "Ironing", basePrice: 20, pricingType: "piece", turnaroundDays: 1 },

    // Dry Cleaning
    { name: "Suit (2 piece)", categoryName: "Dry Cleaning", basePrice: 350, pricingType: "piece", turnaroundDays: 3 },
    { name: "Suit (3 piece)", categoryName: "Dry Cleaning", basePrice: 450, pricingType: "piece", turnaroundDays: 3 },
    { name: "Blazer", categoryName: "Dry Cleaning", basePrice: 200, pricingType: "piece", turnaroundDays: 3 },
    { name: "Coat", categoryName: "Dry Cleaning", basePrice: 300, pricingType: "piece", turnaroundDays: 3 },
    { name: "Silk Saree", categoryName: "Dry Cleaning", basePrice: 250, pricingType: "piece", turnaroundDays: 3 },

    // Specialty
    { name: "Blanket (Single)", categoryName: "Specialty", basePrice: 200, pricingType: "piece", turnaroundDays: 3 },
    { name: "Blanket (Double)", categoryName: "Specialty", basePrice: 300, pricingType: "piece", turnaroundDays: 3 },
    { name: "Curtains", categoryName: "Specialty", basePrice: 50, pricingType: "sqft", turnaroundDays: 4 },
    { name: "Carpet", categoryName: "Specialty", basePrice: 30, pricingType: "sqft", turnaroundDays: 5 },
];

export async function seedInventory(shopId: string) {
    const categoriesRef = collection(db, `shops/${shopId}/categories`);
    const itemsRef = collection(db, `shops/${shopId}/inventory`);

    // Check if already seeded
    const existingCategories = await getDocs(categoriesRef);
    if (!existingCategories.empty) {
        console.log("Inventory already seeded");
        return;
    }

    // Create categories
    const categoryMap: Record<string, string> = {};

    for (const cat of defaultCategories) {
        const docRef = await addDoc(categoriesRef, {
            ...cat,
            isActive: true,
            createdAt: serverTimestamp(),
        });
        categoryMap[cat.name] = docRef.id;
    }

    // Create services
    let order = 1;
    for (const service of defaultServices) {
        const categoryId = categoryMap[service.categoryName];
        if (!categoryId) continue;

        await addDoc(itemsRef, {
            name: service.name,
            categoryId,
            categoryName: service.categoryName,
            basePrice: service.basePrice,
            pricingType: service.pricingType,
            turnaroundDays: service.turnaroundDays,
            expressMultiplier: 1.5,
            isActive: true,
            order: order++,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    }

    console.log("Inventory seeded successfully");
}
