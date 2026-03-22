/**
 * Service Form Sheet
 * 
 * Add/edit service with pricing options
 */

import { useState, useEffect, useRef } from "react";
import {
    LResponsiveDialog,
    LTextInput,
    LNumberInput,
    LToggle,
    LButton,
    LSpacer,
    LSmartImageUploader,
    type LSmartImageUploaderRef,
} from "@/components/laundry";
import { useAuth } from "@/features/auth";
import { useCurrency } from "@/hooks/use-currency";
import { useInventoryMutations } from "@/hooks/use-inventory";
import type { InventoryItem, InventoryCategory, PricingType } from "@/types/inventory";
import type { ImageMetadata } from "@/types/image-upload";
import { useTranslation } from "react-i18next";

interface ServiceFormSheetProps {
    open: boolean;
    onClose: () => void;
    item?: InventoryItem;
    categories: InventoryCategory[];
    /** Existing subcategory strings from items (so custom ones appear in dropdown). */
    existingSubcategories?: string[];
    onAddCategory?: () => void;
}

const pricingTypeOptions = [
    { value: "piece", label: "piece" },
    { value: "kg", label: "kg" },
    { value: "sqft", label: "sqft" },
];

/** Subcategory options (must match grouping on Items page). */
const SUB_CATEGORY_OPTIONS = [
    "Men's Wear", "Women's Wear", "Kids Wear",
    "Bedding", "Curtains", "Carpets", "Upholstery",
    "Men's Footwear", "Women's Footwear", "Unisex",
    "Bags", "Travel", "Packages",
    "Household", "Others",
];

const CUSTOM_SUBCAT_VALUE = "__custom__";

export function ServiceFormSheet({
    open,
    onClose,
    item,
    categories,
    existingSubcategories = [],
    onAddCategory,
}: ServiceFormSheetProps) {
    const { t } = useTranslation();
    const { shopId } = useAuth();
    const { currencySymbol } = useCurrency();
    const { createItem, updateItem } = useInventoryMutations();
    const [loading, setLoading] = useState(false);
    const [uploadedImage, setUploadedImage] = useState<ImageMetadata[]>([]);
    const imageUploaderRef = useRef<LSmartImageUploaderRef>(null);

    /** Popup to add a custom subcategory name (instead of inline field). */
    const [addSubcategoryOpen, setAddSubcategoryOpen] = useState(false);
    const [addSubcategoryName, setAddSubcategoryName] = useState("");

    const [form, setForm] = useState({
        name: "",
        categoryId: "",
        subCategory: "",
        pricingType: "piece" as PricingType,
        basePrice: 0,
        expressMultiplier: 1.5,
        description: "",
        imageUrl: "",
        imageKey: "",
        imageBytes: 0,
        isActive: true,
    });

    const isEdit = !!item;

    // Reset form and uploader when item / open changes
    useEffect(() => {
        if (item) {
            setForm({
                name: item.name,
                categoryId: item.categoryId,
                subCategory: item.subCategory || "",
                pricingType: item.pricingType,
                basePrice: item.basePrice,
                expressMultiplier: item.expressMultiplier,
                description: item.description || "",
                imageUrl: item.imageUrl || "",
                imageKey: item.imageKey || "",
                imageBytes: item.imageBytes || 0,
                isActive: item.isActive,
            });
            // Initialize uploader with existing image so preview shows in edit
            if (item.imageUrl) {
                setUploadedImage([
                    {
                        id: "existing",
                        key: item.imageKey || "",
                        url: item.imageUrl,
                        originalName: "Image",
                        originalSize: 0,
                        compressedSize: item.imageBytes || 0,
                        compressionRatio: 0,
                        width: 0,
                        height: 0,
                        mimeType: "image/jpeg",
                        uploadedAt: new Date(),
                    },
                ]);
            } else {
                setUploadedImage([]);
            }
        } else {
            setForm({
                name: "",
                categoryId: categories[0]?.id || "",
                subCategory: "",
                pricingType: "piece",
                basePrice: 0,
                expressMultiplier: 1.5,
                description: "",
                imageUrl: "",
                imageKey: "",
                imageBytes: 0,
                isActive: true,
            });
            setUploadedImage([]);
        }
    }, [item, open, categories]);

    const handleSubmit = async () => {
        if (!form.name || !form.categoryId || form.basePrice <= 0) return;

        setLoading(true);
        try {
            const finalMeta = await imageUploaderRef.current?.uploadPendingImages?.();
            const hasMeta = (finalMeta?.length ?? 0) > 0;
            const imageUrl = hasMeta
                ? finalMeta?.[0]?.url ?? ""
                : uploadedImage.length > 0
                    ? uploadedImage[0].url
                    : "";
            const imageKey = hasMeta
                ? finalMeta?.[0]?.key ?? ""
                : uploadedImage.length > 0
                    ? uploadedImage[0].key ?? ""
                    : "";
            const imageBytes = hasMeta
                ? finalMeta?.[0]?.compressedSize ?? 0
                : uploadedImage.length > 0
                    ? uploadedImage[0].compressedSize ?? 0
                    : 0;
            const category = categories.find((c) => c.id === form.categoryId);
            const data = {
                ...form,
                subCategory: form.subCategory === CUSTOM_SUBCAT_VALUE || String(form.subCategory) === "[object Object]" ? "Others" : (form.subCategory || "Others"),
                imageUrl,
                imageKey,
                imageBytes,
                categoryName: category?.name || "",
            };

            if (isEdit) {
                await updateItem(item.id, data);
            } else {
                await createItem(data);
            }
            onClose();
        } catch (error) {
            console.error("Error saving service:", error);
        } finally {
            setLoading(false);
        }
    };

    const isValid = form.name.trim() && form.categoryId && form.basePrice > 0;

    const handleAddSubcategorySubmit = () => {
        const name = addSubcategoryName.trim() || "Others";
        setForm((f) => ({ ...f, subCategory: name }));
        setAddSubcategoryOpen(false);
        setAddSubcategoryName("");
    };

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title={isEdit ? t('inventory.editService') : t('inventory.addService')}
            size="md"
            snapPoints={[0.9]}
        >
            <div className="space-y-4">
                <LTextInput
                    label={t('inventory.serviceName')}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t('inventory.serviceNamePlaceholder')}
                    className="capitalize"
                />

                {/* Category Select */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="text-sm font-medium text-foreground">
                            {t('inventory.category')}
                        </label>
                        {onAddCategory && (
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    onAddCategory();
                                }}
                                className="text-xs font-medium text-primary hover:text-primary-dark transition-colors"
                            >
                                + {t('common.add', 'Add New')}
                            </button>
                        )}
                    </div>
                    <select
                        value={form.categoryId}
                        onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                        className="w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                        <option value="">{t('inventory.selectCategory')}</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                {/* Subcategory — pick from list or "+ Add" opens a small popup to enter custom name */}
                {(() => {
                    const combinedOptions = [
                        ...SUB_CATEGORY_OPTIONS,
                        ...existingSubcategories.filter((s) => s && !SUB_CATEGORY_OPTIONS.includes(s)),
                    ];
                    const customValue = form.subCategory && form.subCategory !== CUSTOM_SUBCAT_VALUE && !combinedOptions.includes(form.subCategory) && String(form.subCategory) !== "[object Object]"
                        ? form.subCategory
                        : null;
                    const displayOptions = customValue ? [...combinedOptions, customValue] : combinedOptions;
                    const actualSelectValue = form.subCategory === CUSTOM_SUBCAT_VALUE ? CUSTOM_SUBCAT_VALUE : (displayOptions.includes(form.subCategory) ? form.subCategory : "Others");
                    return (
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-sm font-medium text-foreground">
                                    {t('inventory.subCategory', 'Subcategory')}
                                </label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAddSubcategoryName("");
                                        setAddSubcategoryOpen(true);
                                    }}
                                    className="text-xs font-medium text-primary hover:text-primary-dark transition-colors"
                                >
                                    + {t('common.add', 'Add')}
                                </button>
                            </div>
                            <select
                                value={actualSelectValue}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === CUSTOM_SUBCAT_VALUE) {
                                        setAddSubcategoryName("");
                                        setAddSubcategoryOpen(true);
                                        setForm((f) => ({ ...f, subCategory: CUSTOM_SUBCAT_VALUE }));
                                    } else {
                                        setForm((f) => ({ ...f, subCategory: v }));
                                    }
                                }}
                                className="w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            >
                                {displayOptions.map((sub) => (
                                    <option key={sub} value={sub}>
                                        {t(`inventory.categories.${sub.replace(/['\s]/g, '').toLowerCase()}`, sub)}
                                    </option>
                                ))}
                                <option value={CUSTOM_SUBCAT_VALUE}>
                                    {t('inventory.otherCustomSubcategory', "Other (custom)")}
                                </option>
                            </select>
                        </div>
                    );
                })()}

                {/* Add subcategory name popup */}
                <LResponsiveDialog
                    open={addSubcategoryOpen}
                    onClose={() => setAddSubcategoryOpen(false)}
                    title={t('inventory.addSubcategoryTitle', 'Add subcategory')}
                    size="sm"
                >
                    <div className="space-y-4 pt-2">
                        <LTextInput
                            label={t('inventory.customSubcategoryName', 'Subcategory name')}
                            value={addSubcategoryName}
                            onChange={(e) => setAddSubcategoryName(e.target.value)}
                            placeholder={t('inventory.customSubcategoryPlaceholder', 'e.g. Sports Wear')}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddSubcategorySubmit();
                                }
                            }}
                        />
                        <div className="flex gap-2 justify-end">
                            <LButton variant="outline" size="sm" onClick={() => setAddSubcategoryOpen(false)}>
                                {t('common.cancel', 'Cancel')}
                            </LButton>
                            <LButton size="sm" onClick={handleAddSubcategorySubmit}>
                                {t('common.submit', 'Submit')}
                            </LButton>
                        </div>
                    </div>
                </LResponsiveDialog>

                <div className="grid grid-cols-2 gap-4">
                    {/* Pricing Type Select */}
                    <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">
                            {t('inventory.pricingType')}
                        </label>
                        <select
                            value={form.pricingType}
                            onChange={(e) => setForm({ ...form, pricingType: e.target.value as PricingType })}
                            className="w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        >
                            {pricingTypeOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>{t(`inventory.pricingTypes.${opt.value}`)}</option>
                            ))}
                        </select>
                    </div>

                    <LNumberInput
                        label={t('inventory.basePrice')}
                        value={form.basePrice}
                        onChange={(v) => setForm({ ...form, basePrice: v })}
                        prefix={currencySymbol}
                        min={0}
                    />
                </div>

                {/* Section header */}
                <div className="text-sm font-medium text-muted-foreground pt-2">
                    {t('inventory.expressSettings')}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <LNumberInput
                        label={t('inventory.expressMultiplier')}
                        value={form.expressMultiplier}
                        onChange={(v) => setForm({ ...form, expressMultiplier: v })}
                        min={1}
                        max={10}
                        step={0.1}
                        helperText={t('inventory.multiplierHelper')}
                    />
                </div>

                {/* Service image: upload (R2) or paste link */}
                <div className="space-y-3">
                    {shopId && (
                        <LSmartImageUploader
                            ref={imageUploaderRef}
                            folder="service-images"
                            shopId={shopId}
                            value={uploadedImage}
                            onChange={(meta) => {
                                setUploadedImage(meta);
                                setForm((prev) => ({
                                    ...prev,
                                    imageUrl: meta[0]?.url ?? "",
                                    imageKey: meta[0]?.key ?? "",
                                    imageBytes: meta[0]?.compressedSize ?? 0,
                                }));
                            }}
                            maxFiles={1}
                            showStats={false}
                            deferUpload
                            label={t('inventory.uploadImage', 'Upload image')}
                            hint={t('common.optional', 'Optional')}
                        />
                    )}
                    <LTextInput
                        label={t('inventory.imageUrlOptional', 'Or paste image link')}
                        value={form.imageUrl}
                        onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                        placeholder="https://example.com/image.jpg"
                    />
                    {form.imageUrl && (
                        <div className="mt-2 flex items-center gap-3">
                            <img
                                src={form.imageUrl}
                                alt="Preview"
                                className="w-16 h-16 rounded-xl object-cover border border-border"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                            <span className="text-xs text-muted-foreground">
                                {t('inventory.imagePreview')}
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                    <div>
                        <p className="font-medium text-foreground">{t('inventory.active')}</p>
                        <p className="text-xs text-muted-foreground">{t('inventory.showInPOS')}</p>
                    </div>
                    <LToggle
                        checked={form.isActive}
                        onChange={(v) => setForm({ ...form, isActive: v })}
                    />
                </div>

                <LSpacer size="md" />

                <LButton
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleSubmit}
                    loading={loading}
                    disabled={!isValid}
                >
                    {isEdit ? t('common.saveChanges') : t('inventory.addService')}
                </LButton>
            </div>
        </LResponsiveDialog>
    );
}
