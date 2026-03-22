
interface DefaultCategory {
    id: string;
    name: string;
    icon: string;
    order: number;
    turnaroundDays: number;
}

interface DefaultItem {
    categoryId: string;
    categoryName: string;
    subCategory: string;
    name: string;
    basePrice: number;
    pricingType: "piece" | "kg" | "sqft" | "set";
    turnaroundDays: number;
    order: number;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
    { id: "iron", name: "Iron Only", icon: "wind", order: 1, turnaroundDays: 1 },
    { id: "wash", name: "Wash & Fold", icon: "droplets", order: 2, turnaroundDays: 2 },
    { id: "washiron", name: "Wash & Iron", icon: "sparkles", order: 3, turnaroundDays: 3 },
    { id: "dryclean", name: "Dry Cleaning", icon: "shirt", order: 4, turnaroundDays: 4 },
    { id: "household", name: "Household", icon: "home", order: 5, turnaroundDays: 3 },
    { id: "shoes", name: "Shoe Cleaning", icon: "footprints", order: 6, turnaroundDays: 3 },
    { id: "premium", name: "Premium Care", icon: "star", order: 7, turnaroundDays: 5 },
];

export const DEFAULT_ITEMS: DefaultItem[] = [
    // ============================================
    // 1. IRON ONLY (Pressing)
    // ============================================
    // Men's Topwear
    { categoryId: "iron", categoryName: "Iron Only", subCategory: "Men's Wear", name: "Shirt", basePrice: 15, pricingType: "piece", turnaroundDays: 1, order: 101 },
    { categoryId: "iron", categoryName: "Iron Only", subCategory: "Men's Wear", name: "T-Shirt", basePrice: 12, pricingType: "piece", turnaroundDays: 1, order: 102 },
    { categoryId: "iron", categoryName: "Iron Only", subCategory: "Men's Wear", name: "Kurta", basePrice: 20, pricingType: "piece", turnaroundDays: 1, order: 103 },
    { categoryId: "iron", categoryName: "Iron Only", subCategory: "Men's Wear", name: "Suit (2 Piece)", basePrice: 100, pricingType: "piece", turnaroundDays: 1, order: 103 },
    // Men's Bottomwear
    { categoryId: "iron", categoryName: "Iron Only", subCategory: "Men's Wear", name: "Trouser", basePrice: 18, pricingType: "piece", turnaroundDays: 1, order: 104 },
    { categoryId: "iron", categoryName: "Iron Only", subCategory: "Men's Wear", name: "Jeans", basePrice: 20, pricingType: "piece", turnaroundDays: 1, order: 105 },
    { categoryId: "iron", categoryName: "Iron Only", subCategory: "Men's Wear", name: "Shorts", basePrice: 12, pricingType: "piece", turnaroundDays: 1, order: 106 },
    // Women's Topwear
    { categoryId: "iron", categoryName: "Iron Only", subCategory: "Women's Wear", name: "Top / Kurti", basePrice: 15, pricingType: "piece", turnaroundDays: 1, order: 107 },
    { categoryId: "iron", categoryName: "Iron Only", subCategory: "Women's Wear", name: "Blouse", basePrice: 12, pricingType: "piece", turnaroundDays: 1, order: 108 },
    { categoryId: "iron", categoryName: "Iron Only", subCategory: "Women's Wear", name: "Dress", basePrice: 25, pricingType: "piece", turnaroundDays: 1, order: 109 },
    // Women's Bottomwear
    { categoryId: "iron", categoryName: "Iron Only", subCategory: "Women's Wear", name: "Leggings", basePrice: 12, pricingType: "piece", turnaroundDays: 1, order: 110 },
    { categoryId: "iron", categoryName: "Iron Only", subCategory: "Women's Wear", name: "Salwar", basePrice: 15, pricingType: "piece", turnaroundDays: 1, order: 111 },
    { categoryId: "iron", categoryName: "Iron Only", subCategory: "Women's Wear", name: "Skirt", basePrice: 15, pricingType: "piece", turnaroundDays: 1, order: 112 },
    // Sarees & Ethnic
    { categoryId: "iron", categoryName: "Iron Only", subCategory: "Women's Wear", name: "Saree (Cotton)", basePrice: 30, pricingType: "piece", turnaroundDays: 1, order: 113 },
    { categoryId: "iron", categoryName: "Iron Only", subCategory: "Women's Wear", name: "Saree (Silk)", basePrice: 50, pricingType: "piece", turnaroundDays: 1, order: 114 },
    { categoryId: "iron", categoryName: "Iron Only", subCategory: "Women's Wear", name: "Dupatta", basePrice: 12, pricingType: "piece", turnaroundDays: 1, order: 115 },
    // Kids
    { categoryId: "iron", categoryName: "Iron Only", subCategory: "Kids Wear", name: "Shirt/T-Shirt", basePrice: 10, pricingType: "piece", turnaroundDays: 1, order: 120 },
    { categoryId: "iron", categoryName: "Iron Only", subCategory: "Kids Wear", name: "Trouser/Shorts", basePrice: 12, pricingType: "piece", turnaroundDays: 1, order: 121 },
    { categoryId: "iron", categoryName: "Iron Only", subCategory: "Kids Wear", name: "Frock", basePrice: 15, pricingType: "piece", turnaroundDays: 1, order: 122 },
    { categoryId: "iron", categoryName: "Iron Only", subCategory: "Kids Wear", name: "School Uniform", basePrice: 10, pricingType: "piece", turnaroundDays: 1, order: 123 },
    // Household
    { categoryId: "iron", categoryName: "Iron Only", subCategory: "Household", name: "Bedsheet (Single)", basePrice: 25, pricingType: "piece", turnaroundDays: 1, order: 116 },
    { categoryId: "iron", categoryName: "Iron Only", subCategory: "Household", name: "Bedsheet (Double)", basePrice: 35, pricingType: "piece", turnaroundDays: 1, order: 117 },
    { categoryId: "iron", categoryName: "Iron Only", subCategory: "Household", name: "Pillow Cover", basePrice: 10, pricingType: "piece", turnaroundDays: 1, order: 118 },

    // ============================================
    // 2. WASH & FOLD
    // ============================================
    { categoryId: "wash", categoryName: "Wash & Fold", subCategory: "Packages", name: "Regular Load (Per Kg)", basePrice: 49, pricingType: "kg", turnaroundDays: 2, order: 200 },
    { categoryId: "wash", categoryName: "Wash & Fold", subCategory: "Packages", name: "Daily Wear (Set)", basePrice: 400, pricingType: "set", turnaroundDays: 2, order: 201 },
    // Individual Items
    { categoryId: "wash", categoryName: "Wash & Fold", subCategory: "Men's Wear", name: "Shirt", basePrice: 30, pricingType: "piece", turnaroundDays: 2, order: 202 },
    { categoryId: "wash", categoryName: "Wash & Fold", subCategory: "Men's Wear", name: "t-Shirt", basePrice: 25, pricingType: "piece", turnaroundDays: 2, order: 203 },
    { categoryId: "wash", categoryName: "Wash & Fold", subCategory: "Men's Wear", name: "Jeans", basePrice: 40, pricingType: "piece", turnaroundDays: 2, order: 204 },
    { categoryId: "wash", categoryName: "Wash & Fold", subCategory: "Men's Wear", name: "Shorts", basePrice: 25, pricingType: "piece", turnaroundDays: 2, order: 205 },
    { categoryId: "wash", categoryName: "Wash & Fold", subCategory: "Men's Wear", name: "Undergarments", basePrice: 15, pricingType: "piece", turnaroundDays: 2, order: 206 },
    { categoryId: "wash", categoryName: "Wash & Fold", subCategory: "Men's Wear", name: "Socks (Pair)", basePrice: 15, pricingType: "piece", turnaroundDays: 2, order: 207 },
    { categoryId: "wash", categoryName: "Wash & Fold", subCategory: "Women's Wear", name: "Kurti/Top", basePrice: 30, pricingType: "piece", turnaroundDays: 2, order: 208 },
    { categoryId: "wash", categoryName: "Wash & Fold", subCategory: "Women's Wear", name: "Leggings/Salwar", basePrice: 30, pricingType: "piece", turnaroundDays: 2, order: 209 },
    { categoryId: "wash", categoryName: "Wash & Fold", subCategory: "Household", name: "Towel (Bath)", basePrice: 30, pricingType: "piece", turnaroundDays: 2, order: 210 },
    { categoryId: "wash", categoryName: "Wash & Fold", subCategory: "Household", name: "Bedsheet (Single)", basePrice: 50, pricingType: "piece", turnaroundDays: 2, order: 211 },
    { categoryId: "wash", categoryName: "Wash & Fold", subCategory: "Household", name: "Bedsheet (Double)", basePrice: 70, pricingType: "piece", turnaroundDays: 2, order: 212 },

    // ============================================
    // 3. WASH & IRON
    // ============================================
    { categoryId: "washiron", categoryName: "Wash & Iron", subCategory: "Packages", name: "Regular Load (Per Kg)", basePrice: 69, pricingType: "kg", turnaroundDays: 3, order: 300 },
    // Men's
    { categoryId: "washiron", categoryName: "Wash & Iron", subCategory: "Men's Wear", name: "Shirt (Cotton)", basePrice: 40, pricingType: "piece", turnaroundDays: 3, order: 301 },
    { categoryId: "washiron", categoryName: "Wash & Iron", subCategory: "Men's Wear", name: "Shirt (Silk/Linen)", basePrice: 60, pricingType: "piece", turnaroundDays: 3, order: 302 },
    { categoryId: "washiron", categoryName: "Wash & Iron", subCategory: "Men's Wear", name: "T-Shirt/Polo", basePrice: 35, pricingType: "piece", turnaroundDays: 3, order: 303 },
    { categoryId: "washiron", categoryName: "Wash & Iron", subCategory: "Men's Wear", name: "Trouser/Jeans", basePrice: 50, pricingType: "piece", turnaroundDays: 3, order: 304 },
    { categoryId: "washiron", categoryName: "Wash & Iron", subCategory: "Men's Wear", name: "Kurta", basePrice: 55, pricingType: "piece", turnaroundDays: 3, order: 305 },
    // Women's
    { categoryId: "washiron", categoryName: "Wash & Iron", subCategory: "Women's Wear", name: "Top/Kurti", basePrice: 40, pricingType: "piece", turnaroundDays: 3, order: 306 },
    { categoryId: "washiron", categoryName: "Wash & Iron", subCategory: "Women's Wear", name: "Salwar/Leggings", basePrice: 40, pricingType: "piece", turnaroundDays: 3, order: 307 },
    { categoryId: "washiron", categoryName: "Wash & Iron", subCategory: "Women's Wear", name: "Salwar Kameez Set", basePrice: 80, pricingType: "piece", turnaroundDays: 3, order: 308 },
    { categoryId: "washiron", categoryName: "Wash & Iron", subCategory: "Women's Wear", name: "Saree (Cotton)", basePrice: 80, pricingType: "piece", turnaroundDays: 3, order: 309 },
    { categoryId: "washiron", categoryName: "Wash & Iron", subCategory: "Women's Wear", name: "Saree (Silk)", basePrice: 140, pricingType: "piece", turnaroundDays: 3, order: 310 },
    // Kids
    { categoryId: "washiron", categoryName: "Wash & Iron", subCategory: "Kids Wear", name: "Shirt/Top", basePrice: 28, pricingType: "piece", turnaroundDays: 3, order: 320 },
    { categoryId: "washiron", categoryName: "Wash & Iron", subCategory: "Kids Wear", name: "Trouser/Jeans", basePrice: 35, pricingType: "piece", turnaroundDays: 3, order: 321 },
    { categoryId: "washiron", categoryName: "Wash & Iron", subCategory: "Kids Wear", name: "Frock/Dress", basePrice: 42, pricingType: "piece", turnaroundDays: 3, order: 322 },
    { categoryId: "washiron", categoryName: "Wash & Iron", subCategory: "Kids Wear", name: "School Uniform", basePrice: 25, pricingType: "piece", turnaroundDays: 3, order: 323 },
    // Household
    { categoryId: "washiron", categoryName: "Wash & Iron", subCategory: "Household", name: "Bedsheet (Single)", basePrice: 70, pricingType: "piece", turnaroundDays: 3, order: 311 },
    { categoryId: "washiron", categoryName: "Wash & Iron", subCategory: "Household", name: "Bedsheet (Double)", basePrice: 95, pricingType: "piece", turnaroundDays: 3, order: 312 },
    { categoryId: "washiron", categoryName: "Wash & Iron", subCategory: "Household", name: "Pillow Cover", basePrice: 28, pricingType: "piece", turnaroundDays: 3, order: 313 },

    // ============================================
    // 4. DRY CLEANING
    // ============================================
    // Men's
    { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Men's Wear", name: "Suit (2 Piece)", basePrice: 250, pricingType: "piece", turnaroundDays: 4, order: 401 },
    { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Men's Wear", name: "Suit (3 Piece)", basePrice: 350, pricingType: "piece", turnaroundDays: 4, order: 402 },
    { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Men's Wear", name: "Blazer/Jacket", basePrice: 150, pricingType: "piece", turnaroundDays: 4, order: 403 },
    { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Men's Wear", name: "Overcoat (Wool)", basePrice: 240, pricingType: "piece", turnaroundDays: 4, order: 404 },
    { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Men's Wear", name: "Leather Jacket", basePrice: 400, pricingType: "piece", turnaroundDays: 5, order: 405 },
    { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Men's Wear", name: "Sherwani", basePrice: 350, pricingType: "piece", turnaroundDays: 4, order: 406 },
    { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Men's Wear", name: "Shirt (Silk/Premium)", basePrice: 100, pricingType: "piece", turnaroundDays: 3, order: 411 },
    { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Men's Wear", name: "Trouser (Wool)", basePrice: 90, pricingType: "piece", turnaroundDays: 3, order: 412 },
    // Women's
    { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Women's Wear", name: "Saree (Silk)", basePrice: 250, pricingType: "piece", turnaroundDays: 4, order: 407 },
    { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Women's Wear", name: "Saree (Heavy work)", basePrice: 400, pricingType: "piece", turnaroundDays: 4, order: 408 },
    { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Women's Wear", name: "Lehenga (Bridal)", basePrice: 700, pricingType: "piece", turnaroundDays: 5, order: 409 },
    { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Women's Wear", name: "Kurta (Silk)", basePrice: 150, pricingType: "piece", turnaroundDays: 4, order: 410 },
    { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Women's Wear", name: "Dress / Gown", basePrice: 200, pricingType: "piece", turnaroundDays: 4, order: 413 },
    // Kids
    { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Kids Wear", name: "Party Dress", basePrice: 140, pricingType: "piece", turnaroundDays: 4, order: 430 },
    { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Kids Wear", name: "Lehenga/Sherwani", basePrice: 180, pricingType: "piece", turnaroundDays: 4, order: 431 },
    { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Kids Wear", name: "Winter Jacket", basePrice: 90, pricingType: "piece", turnaroundDays: 4, order: 432 },
    // Household
    { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Household", name: "Blanket (Double)", basePrice: 300, pricingType: "piece", turnaroundDays: 4, order: 414 },
    { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Household", name: "Comforter", basePrice: 400, pricingType: "piece", turnaroundDays: 4, order: 415 },
    { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Household", name: "Curtains (Panel)", basePrice: 180, pricingType: "piece", turnaroundDays: 4, order: 416 },

    // ============================================
    // 5. HOUSEHOLD
    // ============================================
    { categoryId: "household", categoryName: "Household", subCategory: "Bedding", name: "Blanket (Wash)", basePrice: 200, pricingType: "piece", turnaroundDays: 3, order: 501 },
    { categoryId: "household", categoryName: "Household", subCategory: "Bedding", name: "Comforter (Wash)", basePrice: 280, pricingType: "piece", turnaroundDays: 3, order: 502 },
    { categoryId: "household", categoryName: "Household", subCategory: "Curtains", name: "Curtains (Wash)", basePrice: 80, pricingType: "piece", turnaroundDays: 3, order: 503 },
    { categoryId: "household", categoryName: "Household", subCategory: "Carpets", name: "Carpet (Vacuum)", basePrice: 15, pricingType: "sqft", turnaroundDays: 3, order: 504 },
    { categoryId: "household", categoryName: "Household", subCategory: "Upholstery", name: "Sofa Cleaning", basePrice: 200, pricingType: "set", turnaroundDays: 1, order: 505 },

    // ============================================
    // 6. SHOES
    // ============================================
    { categoryId: "shoes", categoryName: "Shoe Cleaning", subCategory: "Men's Footwear", name: "Sports Shoes", basePrice: 200, pricingType: "piece", turnaroundDays: 3, order: 601 },
    { categoryId: "shoes", categoryName: "Shoe Cleaning", subCategory: "Men's Footwear", name: "Sneakers", basePrice: 250, pricingType: "piece", turnaroundDays: 3, order: 602 },
    { categoryId: "shoes", categoryName: "Shoe Cleaning", subCategory: "Men's Footwear", name: "Leather Shoes", basePrice: 300, pricingType: "piece", turnaroundDays: 3, order: 603 },
    { categoryId: "shoes", categoryName: "Shoe Cleaning", subCategory: "Men's Footwear", name: "Boots", basePrice: 350, pricingType: "piece", turnaroundDays: 3, order: 604 },
    { categoryId: "shoes", categoryName: "Shoe Cleaning", subCategory: "Women's Footwear", name: "Sandals", basePrice: 100, pricingType: "piece", turnaroundDays: 3, order: 605 },
    { categoryId: "shoes", categoryName: "Shoe Cleaning", subCategory: "Women's Footwear", name: "Heels/Boots", basePrice: 250, pricingType: "piece", turnaroundDays: 3, order: 606 },
    { categoryId: "shoes", categoryName: "Shoe Cleaning", subCategory: "Unisex", name: "Suede Shoes", basePrice: 350, pricingType: "piece", turnaroundDays: 4, order: 606 },

    // ============================================
    // 7. PREMIUM
    // ============================================
    { categoryId: "premium", categoryName: "Premium Care", subCategory: "Bags", name: "Designer Handbag", basePrice: 500, pricingType: "piece", turnaroundDays: 5, order: 701 },
    { categoryId: "premium", categoryName: "Premium Care", subCategory: "Bags", name: "Leather Bag Cleaning", basePrice: 300, pricingType: "piece", turnaroundDays: 4, order: 702 },
    { categoryId: "premium", categoryName: "Premium Care", subCategory: "Travel", name: "Travel Bag/Suitcase", basePrice: 400, pricingType: "piece", turnaroundDays: 3, order: 703 },
    { categoryId: "premium", categoryName: "Premium Care", subCategory: "Kids", name: "Soft Toy Cleaning", basePrice: 100, pricingType: "piece", turnaroundDays: 3, order: 704 },
    { categoryId: "premium", categoryName: "Premium Care", subCategory: "Kids", name: "Stroller/Pram", basePrice: 600, pricingType: "piece", turnaroundDays: 3, order: 705 },
];
