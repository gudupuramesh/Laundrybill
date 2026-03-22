import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
    LButton,
    LEmptyState,
    LList,
    LListItem,
    LServiceCard,
    LToggle,
    LBadge,
    LSpinner,
    LCard,
    LHelpButton,
} from "@/components/laundry";
import { PageWrapper } from "@/components/PageWrapper";
import { useInventory, useInventoryMutations } from "@/hooks/use-inventory";
import { ServiceFormSheet } from "./ServiceFormSheet";
import { CategoryFormSheet } from "./CategoryFormSheet";
import { LActionSheet } from "@/components/laundry/LActionSheet";
import { ServiceAreasList, PickupSlotsList, DeliverySlotsList } from "@/features/settings/ServiceAreasSettings";
import type { InventoryItem, InventoryCategory } from "@/types/inventory";
import {
    Package,
    Plus,
    MoreVertical,
    FolderPlus,
    MapPin,
    Clock,
    Truck
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getTranslatedItemName, getTranslatedCategoryName } from "@/lib/inventory-translations";
import { useMinLoading } from "@/hooks/use-min-loading";

type ViewMode = "services" | "categories" | "service-areas" | "pickup-slots" | "delivery-slots";

export function InventoryPage() {
    const { t } = useTranslation();
    const {
        items,
        allItems,
        categories,
        allCategories,
        loading,
    } = useInventory();

    // Import mutations separately
    const {
        deleteItem,
        updateItem,
        deleteCategory,
        updateCategory
    } = useInventoryMutations();

    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get("tab");

    const [viewMode, setViewMode] = useState<ViewMode>((tabParam as ViewMode) || "services");
    const [showInactive, setShowInactive] = useState(false);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");

    // Sheets & Action state
    const [serviceSheet, setServiceSheet] = useState<{ open: boolean; item?: InventoryItem }>({ open: false });
    const [categorySheet, setCategorySheet] = useState<{ open: boolean; category?: InventoryCategory }>({ open: false });
    const [actionSheet, setActionSheet] = useState<{ open: boolean; item?: InventoryItem; category?: InventoryCategory }>({ open: false });

    // Sync viewMode with URL
    useEffect(() => {
        if (tabParam && ["services", "categories", "service-areas", "pickup-slots", "delivery-slots"].includes(tabParam)) {
            setViewMode(tabParam as ViewMode);
        }
    }, [tabParam]);

    const handleTabChange = (mode: ViewMode) => {
        setViewMode(mode);
        setSearchParams({ tab: mode });
    };

    // Minimum loading time
    const showLoading = useMinLoading(loading);

    // Filter items
    const sourceItems = showInactive ? allItems : items;
    const sourceCategories = showInactive ? allCategories : categories;

    // Filter by category
    const displayItems = sourceItems.filter((item) => {
        if (selectedCategoryId !== "all" && item.categoryId !== selectedCategoryId) return false;
        return true;
    });

    const displayCategories = sourceCategories;

    const handleDelete = async () => {
        if (actionSheet.item) {
            await deleteItem(actionSheet.item.id);
        } else if (actionSheet.category) {
            await deleteCategory(actionSheet.category.id);
        }
        setActionSheet({ open: false });
    };

    const handleToggleActive = async () => {
        if (actionSheet.item) {
            await updateItem(actionSheet.item.id, { isActive: !actionSheet.item.isActive });
        } else if (actionSheet.category) {
            await updateCategory(actionSheet.category.id, { isActive: !actionSheet.category.isActive });
        }
        setActionSheet({ open: false });
    };

    const tabs = [
        { id: "services", label: t('inventory.services') },
        { id: "categories", label: t('inventory.category') },
        { id: "service-areas", label: t('settings.serviceAreas', 'Service Areas') },
        { id: "pickup-slots", label: t('settings.pickupTab', 'Pickup') },
        { id: "delivery-slots", label: t('settings.deliveryTab', 'Delivery') },
    ];

    if (showLoading) {
        return (
            <PageWrapper>
                <div className="flex items-center justify-center p-12">
                    <LSpinner size="lg" />
                </div>
            </PageWrapper>
        );
    }

    return (
        <PageWrapper>
            {/* Header */}
            <div className="flex items-center justify-between mb-4 gap-2">
                <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-foreground">
                        {tabs.find(t => t.id === viewMode)?.label}
                    </h1>
                    <LHelpButton size="icon" />
                </div>
                <div className="flex items-center gap-3">
                    {(viewMode === "services" || viewMode === "categories") && (
                        <div className="flex items-center gap-2 mr-2">
                            <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">{t('inventory.showInactive')}</span>
                            <LToggle
                                checked={showInactive}
                                onChange={setShowInactive}
                                size="sm"
                            />
                        </div>
                    )}
                    {viewMode === "categories" && (
                        <LButton
                            variant="outline"
                            size="sm"
                            leftIcon={<FolderPlus className="h-4 w-4" />}
                            onClick={() => setCategorySheet({ open: true })}
                        >
                            {t('inventory.addCategory')}
                        </LButton>
                    )}
                    {viewMode === "services" && (
                        <LButton
                            variant="primary"
                            size="sm"
                            leftIcon={<Plus className="h-4 w-4" />}
                            onClick={() => setServiceSheet({ open: true })}
                        >
                            {t('inventory.service')}
                        </LButton>
                    )}
                </div>
            </div>

            {/* Scrollable Tabs */}
            <div className="flex items-center justify-between mb-6 border-b border-border">
                <div className="flex w-full overflow-x-auto scrollbar-hide -mb-px">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id as ViewMode)}
                            className={`
                                whitespace-nowrap py-3 px-4 text-sm font-medium border-b-2 transition-colors flex-shrink-0
                                ${viewMode === tab.id
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"}
                            `}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Category Filter for Services */}
            {viewMode === "services" && (
                <div className="flex overflow-x-auto scrollbar-hide gap-2 mb-4 pb-1">
                    <button
                        onClick={() => setSelectedCategoryId("all")}
                        className={`
                            whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors border
                            ${selectedCategoryId === "all"
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-border hover:border-muted-foreground"}
                        `}
                    >
                        {t('inventory.all')}
                    </button>
                    {sourceCategories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategoryId(cat.id)}
                            className={`
                                whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors border
                                ${selectedCategoryId === cat.id
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-muted-foreground border-border hover:border-muted-foreground"}
                            `}
                        >
                            {getTranslatedCategoryName(cat.name, cat.id)}
                        </button>
                    ))}
                </div>
            )}

            {/* Services View */}
            {viewMode === "services" && (
                <>
                    {displayItems.length === 0 ? (
                        <LEmptyState
                            icon={<Package className="h-8 w-8" />}
                            title={t('inventory.noServices')}
                            description={t('inventory.noServicesDesc')}
                            action={{
                                label: t('inventory.addService'),
                                onClick: () => setServiceSheet({ open: true }),
                            }}
                        />
                    ) : (
                        <div className="space-y-8 pb-12">
                            {Object.entries(
                                displayItems.reduce((acc, item) => {
                                    const sub = item.subCategory || "Others";
                                    if (!acc[sub]) acc[sub] = [];
                                    acc[sub].push(item);
                                    return acc;
                                }, {} as Record<string, typeof displayItems>)
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
                            }).map(([subCategory, items]) => (
                                <div key={subCategory}>
                                    <div className="flex items-center gap-4 mb-4">
                                        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider bg-primary/5 px-3 py-1 rounded-md">
                                            {t(`inventory.categories.${subCategory.replace(/['\s]/g, '').toLowerCase()}`) || subCategory}
                                        </h3>
                                        <div className="h-px bg-border flex-1" />
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                        {items.map((item) => (
                                            <div key={item.id} className="relative group">
                                                {!item.isActive && (
                                                    <div className="absolute top-2 right-2 z-10">
                                                        <LBadge variant="muted" size="sm">{t('inventory.inactive')}</LBadge>
                                                    </div>
                                                )}
                                                <LServiceCard
                                                    name={getTranslatedItemName(item.name)}
                                                    categoryName={subCategory}
                                                    price={item.basePrice}
                                                    imageUrl={item.imageUrl}
                                                    onClick={() => setServiceSheet({ open: true, item })}
                                                    onLongPress={() => setActionSheet({ open: true, item })}
                                                    className={!item.isActive ? "opacity-60" : ""}
                                                />
                                                <button
                                                    className="absolute top-2 right-2 p-1.5 bg-background/80 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity md:flex hidden"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActionSheet({ open: true, item });
                                                    }}
                                                >
                                                    <MoreVertical className="h-4 w-4 text-foreground" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Categories View */}
            {viewMode === "categories" && (
                <>
                    {displayCategories.length === 0 ? (
                        <LEmptyState
                            icon={<Package className="h-8 w-8" />}
                            title={t('inventory.noCategories')}
                            description={t('inventory.noCategoriesDesc')}
                            action={{
                                label: t('inventory.addCategory'),
                                onClick: () => setCategorySheet({ open: true }),
                            }}
                        />
                    ) : (
                        <LList>
                            {displayCategories.map((category) => {
                                const itemCount = allItems.filter((i) => i.categoryId === category.id).length;
                                return (
                                    <LListItem
                                        key={category.id}
                                        title={getTranslatedCategoryName(category.name, category.id)}
                                        subtitle={`${itemCount} ${t('inventory.servicesCount')}`}
                                        leftContent={
                                            <div className="w-10 h-10 rounded-lg bg-secondary-muted flex items-center justify-center">
                                                <Package className="h-5 w-5 text-secondary" />
                                            </div>
                                        }
                                        rightContent={
                                            <div className="flex items-center gap-3">
                                                {!category.isActive && (
                                                    <LBadge variant="muted" size="sm">
                                                        {t('inventory.inactive')}
                                                    </LBadge>
                                                )}
                                                <LButton
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActionSheet({ open: true, category });
                                                    }}
                                                >
                                                    <MoreVertical className="h-4 w-4" />
                                                </LButton>
                                            </div>
                                        }
                                        onClick={() => setCategorySheet({ open: true, category })}
                                    />
                                );
                            })}
                        </LList>
                    )}
                </>
            )}

            {/* Service Areas Tab */}
            {viewMode === "service-areas" && (
                <div className="max-w-3xl mx-auto">
                    <LCard variant="outlined" padding="lg">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <MapPin className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground">{t('settings.serviceAreas', 'Service Areas')}</h3>
                                <p className="text-sm text-muted-foreground">{t('settings.serviceAreasDesc', 'Areas where you offer pickup/delivery')}</p>
                            </div>
                        </div>
                        <ServiceAreasList />
                    </LCard>
                </div>
            )}

            {/* Pickup Slots Tab */}
            {viewMode === "pickup-slots" && (
                <div className="max-w-3xl mx-auto">
                    <LCard variant="outlined" padding="lg">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                                <Clock className="h-5 w-5 text-success" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground">{t('checkout.pickupSchedule')}</h3>
                                <p className="text-sm text-muted-foreground">{t('checkout.pickupSchedule')}</p>
                            </div>
                        </div>
                        <PickupSlotsList />
                    </LCard>
                </div>
            )}

            {/* Delivery Slots Tab */}
            {viewMode === "delivery-slots" && (
                <div className="max-w-3xl mx-auto">
                    <LCard variant="outlined" padding="lg">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                                <Truck className="h-5 w-5 text-warning" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground">{t('checkout.deliverySchedule', 'Delivery Schedule')}</h3>
                                <p className="text-sm text-muted-foreground">{t('checkout.deliveryScheduleDesc', 'Time slots for home delivery')}</p>
                            </div>
                        </div>
                        <DeliverySlotsList />
                    </LCard>
                </div>
            )}

            {/* Service Form Sheet */}
            <ServiceFormSheet
                open={serviceSheet.open}
                onClose={() => setServiceSheet({ open: false })}
                item={serviceSheet.item}
                categories={categories}
                existingSubcategories={[...new Set(allItems.map((i) => i.subCategory).filter(Boolean))] as string[]}
                onAddCategory={() => setCategorySheet({ open: true })}
            />

            {/* Category Form Sheet */}
            <CategoryFormSheet
                open={categorySheet.open}
                onClose={() => setCategorySheet({ open: false })}
                category={categorySheet.category}
            />

            {/* Action Sheet */}
            <LActionSheet
                open={actionSheet.open}
                onClose={() => setActionSheet({ open: false })}
                title={actionSheet.item ? actionSheet.item.name : actionSheet.category?.name || ""}
                actions={[
                    {
                        id: 'toggle-active',
                        label: actionSheet.item?.isActive || actionSheet.category?.isActive
                            ? t('common.deactivate')
                            : t('common.activate'),
                        onClick: handleToggleActive,
                    },
                    {
                        id: 'delete',
                        label: t('common.delete'),
                        onClick: handleDelete,
                        destructive: true,
                    },
                ]}
            />
        </PageWrapper>
    );
}
