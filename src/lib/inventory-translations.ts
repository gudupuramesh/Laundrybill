/**
 * Inventory Translation Utilities
 * 
 * Maps inventory item names to translation keys for multi-language support.
 * This allows showing item names in the user's selected language.
 */

import i18n from './i18n';

/**
 * Mapping of English item names (lowercase) to translation keys
 * This handles variations in naming across shops
 */
const ITEM_NAME_TO_KEY: Record<string, string> = {
    // Wash category
    'regular wash': 'services.items.regularWash',
    'premium wash': 'services.items.premiumWash',
    'wash & fold': 'services.items.regularWash',
    'wash and fold': 'services.items.regularWash',

    // Common clothing items
    'shirt': 'services.items.shirt',
    'shirts': 'services.items.shirt',
    'pant': 'services.items.pant',
    'pants': 'services.items.pant',
    'trouser': 'services.items.pant',
    'trousers': 'services.items.pant',
    'saree': 'services.items.saree',
    'sarees': 'services.items.saree',
    'sari': 'services.items.saree',
    'saris': 'services.items.saree',
    'kurta': 'services.items.kurta',
    'kurtas': 'services.items.kurta',
    'kurti': 'services.items.kurta',
    'kurtis': 'services.items.kurta',
    'suit (2 piece)': 'services.items.suit2piece',
    'suit (3 piece)': 'services.items.suit3piece',
    '2 piece suit': 'services.items.suit2piece',
    '3 piece suit': 'services.items.suit3piece',
    'blazer': 'services.items.blazer',
    'blazers': 'services.items.blazer',
    'coat': 'services.items.coat',
    'coats': 'services.items.coat',
    'silk saree': 'services.items.silkSaree',
    'silk sarees': 'services.items.silkSaree',
    'silk sari': 'services.items.silkSaree',

    // Blankets and bedding
    'blanket (single)': 'services.items.blanketSingle',
    'blanket (double)': 'services.items.blanketDouble',
    'single blanket': 'services.items.blanketSingle',
    'double blanket': 'services.items.blanketDouble',
    'blanket': 'services.items.blanketSingle',
    'blankets': 'services.items.blanketSingle',
    'comforter': 'services.items.comforter',
    'comforters': 'services.items.comforter',
    'quilt': 'services.items.quilt',
    'quilts': 'services.items.quilt',
    'curtains': 'services.items.curtains',
    'curtain': 'services.items.curtains',
    'carpet': 'services.items.carpet',
    'carpets': 'services.items.carpet',
    'rug': 'services.items.carpet',
    'rugs': 'services.items.carpet',
    'bedsheet': 'services.items.bedsheet',
    'bedsheets': 'services.items.bedsheet',
    'bed sheet': 'services.items.bedsheet',
    'bed sheets': 'services.items.bedsheet',
    'pillow cover': 'services.items.pillowCover',
    'pillow covers': 'services.items.pillowCover',
    'pillowcover': 'services.items.pillowCover',
    'towel': 'services.items.towel',
    'towels': 'services.items.towel',
    'bath towel': 'services.items.towel',

    // Casual wear
    'jeans': 'services.items.jeans',
    'jean': 'services.items.jeans',
    't-shirt': 'services.items.tshirt',
    't-shirts': 'services.items.tshirt',
    'tshirt': 'services.items.tshirt',
    'tshirts': 'services.items.tshirt',
    't shirt': 'services.items.tshirt',
    'shorts': 'services.items.shorts',
    'short': 'services.items.shorts',
    'jacket': 'services.items.jacket',
    'jackets': 'services.items.jacket',
    'sweater': 'services.items.sweater',
    'sweaters': 'services.items.sweater',
    'hoodie': 'services.items.hoodie',
    'hoodies': 'services.items.hoodie',
    'sweatshirt': 'services.items.sweatshirt',
    'sweatshirts': 'services.items.sweatshirt',

    // Traditional Indian wear
    'lehenga': 'services.items.lehenga',
    'lehengas': 'services.items.lehenga',
    'sherwani': 'services.items.sherwani',
    'sherwanis': 'services.items.sherwani',
    'dupatta': 'services.items.dupatta',
    'dupattas': 'services.items.dupatta',
    'dhoti': 'services.items.dhoti',
    'dhotis': 'services.items.dhoti',
    'lungi': 'services.items.lungi',
    'lungis': 'services.items.lungi',
    'salwar': 'services.items.salwar',
    'salwars': 'services.items.salwar',
    'churidar': 'services.items.churidar',
    'churidars': 'services.items.churidar',
    'pattu pavadai': 'services.items.pattuPavadai',
    'pattu langa': 'services.items.pattuPavadai',
    'half saree': 'services.items.halfSaree',
    'half sarees': 'services.items.halfSaree',

    // Shoes
    'shoes': 'services.items.shoes',
    'shoe': 'services.items.shoes',
    'sports shoes': 'services.items.sportsShoes',
    'sneakers': 'services.items.sneakers',
    'leather shoes': 'services.items.leatherShoes',
    'sandals': 'services.items.sandals',
    'boots': 'services.items.boots',

    // Bags
    'bag': 'services.items.bag',
    'bags': 'services.items.bag',
    'handbag': 'services.items.handbag',
    'handbags': 'services.items.handbag',
    'backpack': 'services.items.backpack',
    'backpacks': 'services.items.backpack',
    'suitcase': 'services.items.suitcase',
    'suitcases': 'services.items.suitcase',
    'luggage': 'services.items.luggage',

    // Formal wear
    'formal shirt': 'services.items.formalShirt',
    'formal shirts': 'services.items.formalShirt',
    'formal pant': 'services.items.formalPant',
    'formal pants': 'services.items.formalPant',
    'tie': 'services.items.tie',
    'ties': 'services.items.tie',

    // Kids wear
    // Clothing variations
    'undergarments': 'services.items.undergarments',
    'socks (pair)': 'services.items.socksPair',
    'shirt (cotton)': 'services.items.shirtCotton',
    'shirt (silk/linen)': 'services.items.shirtSilkLinen',
    't-shirt/polo': 'services.items.tshirtPolo',
    'trouser/jeans': 'services.items.trouserJeans',
    'blazer/jacket': 'services.items.blazerJacket',
    'overcoat (wool)': 'services.items.overcoatWool',
    'leather jacket': 'services.items.leatherJacket',
    'shirt (silk/premium)': 'services.items.shirtSilkPremium',
    'trouser (wool)': 'services.items.trouserWool',
    'top / kurti': 'services.items.topKurti',
    'blouse': 'services.items.blouse',
    'dress': 'services.items.dress',
    'leggings': 'services.items.leggings',
    'skirt': 'services.items.skirt',
    'saree (cotton)': 'services.items.sareeCotton',
    'saree (silk)': 'services.items.sareeSilk',
    'kurti/top': 'services.items.kurtiTop',
    'leggings/salwar': 'services.items.leggingsSalwar',
    'top/kurti': 'services.items.topKurti',
    'salwar/leggings': 'services.items.salwarLeggings',
    'salwar kameez set': 'services.items.salwarKameezSet',
    'saree (heavy work)': 'services.items.sareeHeavyWork',
    'lehenga (bridal)': 'services.items.lehengaBridal',
    'kurta (silk)': 'services.items.kurtaSilk',
    'dress / gown': 'services.items.dressGown',
    'shirt/t-shirt': 'services.items.shirtTshirt',
    'trouser/shorts': 'services.items.trouserShorts',
    'frock': 'services.items.frock',
    'frock/dress': 'services.items.frockDress',
    'party dress': 'services.items.partyDress',
    'lehenga/sherwani': 'services.items.lehengaSherwani',
    'winter jacket': 'services.items.winterJacket',
    'blanket (wash)': 'services.items.blanketWash',
    'comforter (wash)': 'services.items.comforterWash',

    // Existing Items (preserved)
    'soft toy': 'services.items.softToy',
    'soft toys': 'services.items.softToy',
    'stuffed toy': 'services.items.softToy',
    'sofa cover': 'services.items.sofaCover',
    'sofa covers': 'services.items.sofaCover',
    'car seat cover': 'services.items.carSeatCover',
    'car seat covers': 'services.items.carSeatCover',

};

/**
 * Mapping of category IDs/names to translation keys
 */
const CATEGORY_NAME_TO_KEY: Record<string, string> = {
    // Wash categories
    'wash': 'services.categories.wash',
    'wash & fold': 'services.categories.wash',
    'wash&fold': 'services.categories.wash',
    'wash and fold': 'services.categories.wash',
    'laundry': 'services.categories.wash',

    // Iron categories  
    'iron': 'services.categories.iron',
    'ironing': 'services.categories.iron',
    'pressing': 'services.categories.iron',
    'press': 'services.categories.iron',

    // Dry clean categories
    'dryclean': 'services.categories.dryclean',
    'dry cleaning': 'services.categories.dryclean',
    'dry clean': 'services.categories.dryclean',
    'dry cleaing': 'services.categories.dryclean', // Handle typo
    'drycleaning': 'services.categories.dryclean',

    // Wash & Iron combo
    'wash&iron': 'services.categories.washIron',
    'wash & iron': 'services.categories.washIron',
    'wash and iron': 'services.categories.washIron',
    'washandiron': 'services.categories.washIron',

    // Sarees category
    'sarees': 'services.categories.sarees',
    'saree': 'services.categories.sarees',
    'saris': 'services.categories.sarees',
    'sari': 'services.categories.sarees',
    'saree pressing': 'services.categories.sarees',

    // Shoe cleaning
    'shoes': 'services.categories.shoes',
    'shoe cleaning': 'services.categories.shoes',
    'shoe care': 'services.categories.shoes',
    'footwear': 'services.categories.shoes',

    // Specialty categories
    'specialty': 'services.categories.specialty',
    'special': 'services.categories.specialty',
    'household': 'services.categories.household',
    'home': 'services.categories.household',

    // Premium
    'premium': 'services.categories.premium',
    'delicate': 'services.categories.premium',
};

/**
 * Get translated item name
 * Falls back to original name if no translation found
 */
export function getTranslatedItemName(itemName: string): string {
    const normalizedName = itemName.toLowerCase().trim();
    const translationKey = ITEM_NAME_TO_KEY[normalizedName];

    if (translationKey) {
        const translated = i18n.t(translationKey);
        // If translation exists and is different from the key, use it
        if (translated && translated !== translationKey) {
            return translated;
        }
    }

    // Return original name if no translation found
    return itemName;
}

/**
 * Get translated category name
 * Falls back to original name if no translation found
 */
export function getTranslatedCategoryName(categoryName: string, categoryId?: string): string {
    // Try by ID first
    if (categoryId) {
        const keyById = CATEGORY_NAME_TO_KEY[categoryId.toLowerCase()];
        if (keyById) {
            const translated = i18n.t(keyById);
            if (translated && translated !== keyById) {
                return translated;
            }
        }
    }

    // Try by name
    const normalizedName = categoryName.toLowerCase().trim();
    const translationKey = CATEGORY_NAME_TO_KEY[normalizedName];

    if (translationKey) {
        const translated = i18n.t(translationKey);
        if (translated && translated !== translationKey) {
            return translated;
        }
    }

    // Return original name if no translation found
    return categoryName;
}

/**
 * Get translated unit
 */
export function getTranslatedUnit(unit: string): string {
    const unitKey = `services.units.${unit}`;
    const translated = i18n.t(unitKey);

    if (translated && translated !== unitKey) {
        return translated;
    }

    // Fallback units — supports all country-specific units
    const fallbackUnits: Record<string, string> = {
        'piece': 'pc',
        'kg': 'kg',
        'lb': 'lb',
        'sqft': 'sq.ft',
        'sqm': 'm²',
        'set': 'set',
        'pair': 'pair',
        'load': 'load',
        'bag': 'bag',
    };

    return fallbackUnits[unit] || unit;
}
