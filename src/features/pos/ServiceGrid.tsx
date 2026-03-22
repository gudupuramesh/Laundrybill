/**
 * Service Grid Component
 * 
 * Display services with category filter
 * Shows cart quantity badges and category names in "All" view
 * Supports multi-language item names
 */

import {
    LServiceCard,
    LChipSelect,
    LSkeleton,
    LEmptyState,
    LResponsiveGrid,
} from "@/components/laundry";
import type { InventoryCategory, InventoryItem } from "@/types/inventory";
import { Shirt, Wind, Sparkles, Droplets, Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getTranslatedItemName, getTranslatedCategoryName, getTranslatedUnit } from "@/lib/inventory-translations";

interface ServiceGridProps {
    categories: InventoryCategory[];
    items: InventoryItem[];
    selectedCategory: string;
    /** Cart items to show quantity badges (CartItem or PublicCartItem) */
    cartItems?: Array<{ service: { id: string }; quantity: number }>;
    onCategoryChange: (categoryId: string) => void;
    onServiceClick: (service: InventoryItem) => void;
    onServiceLongPress: (service: InventoryItem) => void;
    loading?: boolean;
    /** When true, category chips stay fixed and items list scrolls inside (POS-like public page) */
    stickyCategories?: boolean;
}

// Icon mapping for categories
const categoryIcons: Record<string, React.ReactNode> = {
    wash: <Droplets className="h-4 w-4" />,
    iron: <Wind className="h-4 w-4" />,
    dryclean: <Sparkles className="h-4 w-4" />,
    premium: <Package className="h-4 w-4" />,
    default: <Shirt className="h-4 w-4" />,
};

export function ServiceGrid({
    categories,
    items,
    selectedCategory,
    cartItems = [],
    onCategoryChange,
    onServiceClick,
    onServiceLongPress,
    loading,
    stickyCategories = false,
}: ServiceGridProps) {
    const { t } = useTranslation();

    // Build category options for chips with translated names
    const categoryOptions = categories
        .filter((c) => c.isActive)
        .sort((a, b) => a.order - b.order)
        .map((c) => ({
            id: c.id,
            label: getTranslatedCategoryName(c.name, c.id),
            icon: categoryIcons[c.id] || categoryIcons.default,
        }));

    // Calculate cart quantity for each service
    const getCartQuantity = (serviceId: string): number => {
        return cartItems
            .filter((item) => item.service.id === serviceId)
            .reduce((sum, item) => sum + item.quantity, 0);
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {[1, 2, 3, 4].map((i) => (
                        <LSkeleton key={i} width={80} height={36} className="rounded-full" />
                    ))}
                </div>
                <LResponsiveGrid gap="md">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <LSkeleton key={i} height={108} className="rounded-xl" />
                    ))}
                </LResponsiveGrid>
            </div>
        );
    }

    // Group items by subcategory
    const groupedItems = Object.entries(
        items.reduce((acc, item) => {
            const sub = item.subCategory || "Others";
            if (!acc[sub]) acc[sub] = [];
            acc[sub].push(item);
            return acc;
        }, {} as Record<string, typeof items>)
    ).sort(([a], [b]) => {
        // Custom sort order for subcategories
        const order = [
            "Men's Wear", "Women's Wear", "Kids Wear",
            "Bedding", "Curtains", "Carpets", "Upholstery",
            "Men's Footwear", "Women's Footwear", "Unisex",
            "Bags", "Travel", "Packages",
            "Household", "Others"
        ];
        const indexA = order.indexOf(a);
        const indexB = order.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    const categoryBlock = (
        <div className="w-full overflow-hidden shrink-0">
            <LChipSelect
                options={categoryOptions}
                value={selectedCategory}
                onChange={(v) => onCategoryChange(v as string)}
            />
        </div>
    );

    const itemsBlock = items.length > 0 ? (
        <div className="space-y-8">
                    {groupedItems.map(([subCategory, groupItems]) => (
                        <div key={subCategory}>
                            <div className="flex items-center gap-4 mb-4">
                                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider bg-primary/5 px-3 py-1 rounded-md">
                                    {subCategory}
                                </h3>
                                <div className="h-px bg-border flex-1" />
                            </div>
                            <LResponsiveGrid gap="sm" className="w-full">
                                {groupItems.map((item) => (
                                    <LServiceCard
                                        key={item.id}
                                        name={getTranslatedItemName(item.name)}
                                        price={item.basePrice}
                                        unit={getTranslatedUnit(item.pricingType === "piece" ? "piece" : item.pricingType)}
                                        imageUrl={item.imageUrl}
                                        icon={categoryIcons[item.categoryId] || <Shirt className="h-6 w-6" />}
                                        cartQuantity={getCartQuantity(item.id)}
                                        onClick={() => onServiceClick(item)}
                                        onLongPress={() => onServiceLongPress(item)}
                                        className="w-full"
                                    />
                                ))}
                            </LResponsiveGrid>
                        </div>
                    ))}
                </div>
            ) : (
                <LEmptyState
                    icon={<Package className="h-8 w-8" />}
                    title={t('pos.noServicesFound')}
                    description={t('pos.tryChangingFilter')}
                />
            );

    if (stickyCategories) {
        return (
            <div className="flex flex-col h-full min-h-0 w-full max-w-full overflow-hidden">
                {categoryBlock}
                <div className="flex-1 min-h-0 overflow-y-auto pb-8 mt-4">
                    {itemsBlock}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 w-full max-w-full overflow-hidden pb-8">
            {categoryBlock}
            {itemsBlock}
        </div>
    );
}
