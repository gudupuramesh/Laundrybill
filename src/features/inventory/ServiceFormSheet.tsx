/**
 * Service / Item Form Sheet — design-system tokens.
 * Add/edit an item: name · service (category) · pricing type · base price ·
 * express multiplier · image · active. Subcategory removed (defaults to "Others").
 */

import { useState, useEffect, useRef, type CSSProperties } from "react";
import { LResponsiveDialog, LSmartImageUploader, type LSmartImageUploaderRef } from "@/components/laundry";
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
    /** Kept for API compatibility; no longer used (subcategory removed). */
    existingSubcategories?: string[];
    onAddCategory?: () => void;
}

const pricingTypeOptions = [
    { value: "piece", label: "piece" },
    { value: "kg", label: "kg" },
    { value: "lb", label: "lb" },
    { value: "sqft", label: "sqft" },
    { value: "sqm", label: "m²" },
    { value: "set", label: "set" },
    { value: "pair", label: "pair" },
    { value: "load", label: "load" },
    { value: "bag", label: "bag" },
];

const lbl: CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6 };
const fld: CSSProperties = { width: "100%", font: "inherit", fontSize: 13.5, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 9, padding: "10px 12px", outline: "none" };

export function ServiceFormSheet({ open, onClose, item, categories, onAddCategory }: ServiceFormSheetProps) {
    const { t } = useTranslation();
    const { shopId } = useAuth();
    const { currencySymbol } = useCurrency();
    const { createItem, updateItem } = useInventoryMutations();
    const [loading, setLoading] = useState(false);
    const [uploadedImage, setUploadedImage] = useState<ImageMetadata[]>([]);
    const imageUploaderRef = useRef<LSmartImageUploaderRef>(null);

    const [form, setForm] = useState({
        name: "",
        categoryId: "",
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

    useEffect(() => {
        if (item) {
            setForm({
                name: item.name,
                categoryId: item.categoryId,
                pricingType: item.pricingType,
                basePrice: item.basePrice,
                expressMultiplier: item.expressMultiplier,
                description: item.description || "",
                imageUrl: item.imageUrl || "",
                imageKey: item.imageKey || "",
                imageBytes: item.imageBytes || 0,
                isActive: item.isActive,
            });
            setUploadedImage(item.imageUrl ? [{
                id: "existing", key: item.imageKey || "", url: item.imageUrl, originalName: "Image",
                originalSize: 0, compressedSize: item.imageBytes || 0, compressionRatio: 0,
                width: 0, height: 0, mimeType: "image/jpeg", uploadedAt: new Date(),
            }] : []);
        } else {
            setForm({
                name: "", categoryId: categories[0]?.id || "", pricingType: "piece", basePrice: 0,
                expressMultiplier: 1.5, description: "", imageUrl: "", imageKey: "", imageBytes: 0, isActive: true,
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
            const imageUrl = hasMeta ? finalMeta?.[0]?.url ?? "" : uploadedImage[0]?.url ?? form.imageUrl ?? "";
            const imageKey = hasMeta ? finalMeta?.[0]?.key ?? "" : uploadedImage[0]?.key ?? "";
            const imageBytes = hasMeta ? finalMeta?.[0]?.compressedSize ?? 0 : uploadedImage[0]?.compressedSize ?? 0;
            const category = categories.find((c) => c.id === form.categoryId);
            const data = { ...form, subCategory: "Others", imageUrl, imageKey, imageBytes, categoryName: category?.name || "" };
            if (isEdit) await updateItem(item.id, data); else await createItem(data);
            onClose();
        } catch (error) {
            console.error("Error saving service:", error);
        } finally {
            setLoading(false);
        }
    };

    const isValid = form.name.trim() && form.categoryId && form.basePrice > 0;

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title={isEdit ? t('inventory.editService', 'Edit Item') : t('inventory.addService', 'Add Item')}
            size="md"
            snapPoints={[0.9]}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Name */}
                <div>
                    <label style={lbl}>{t('inventory.serviceName', 'Item Name')}</label>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('inventory.serviceNamePlaceholder', 'e.g. Shirt')} style={fld} />
                </div>

                {/* Service (category) */}
                <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <label style={{ ...lbl, marginBottom: 0 }}>{t('inventory.services', 'Service')}</label>
                        {onAddCategory && <button type="button" onClick={(e) => { e.preventDefault(); onAddCategory(); }} style={{ cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 600, color: "var(--c-primary)", background: "transparent", border: 0 }}>+ {t('common.add', 'Add')}</button>}
                    </div>
                    <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} style={fld}>
                        <option value="">{t('inventory.selectCategory', 'Select service')}</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                {/* Pricing type + base price */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                        <label style={lbl}>{t('inventory.pricingType', 'Pricing Type')}</label>
                        <select value={form.pricingType} onChange={(e) => setForm({ ...form, pricingType: e.target.value as PricingType })} style={fld}>
                            {pricingTypeOptions.map((opt) => <option key={opt.value} value={opt.value}>{t(`inventory.pricingTypes.${opt.value}`, opt.label)}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={lbl}>{t('inventory.basePrice', 'Base Price')}</label>
                        <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--c-border-strong)", borderRadius: 9, background: "var(--c-surface)" }}>
                            <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 13, color: "var(--c-text-3)", paddingLeft: 11 }}>{currencySymbol}</span>
                            <input type="text" inputMode="decimal" value={form.basePrice || ""} placeholder="0"
                                onChange={(e) => { const n = parseFloat(e.target.value); setForm({ ...form, basePrice: isNaN(n) || n < 0 ? 0 : n }); }}
                                style={{ ...fld, border: 0, fontFamily: "'IBM Plex Mono'", fontWeight: 700, paddingLeft: 8, background: "transparent" }} />
                        </div>
                    </div>
                </div>

                {/* Express */}
                <div>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", color: "var(--c-text-3)", marginBottom: 12 }}>{t('inventory.expressSettings', 'EXPRESS SETTINGS')}</div>
                    <label style={lbl}>{t('inventory.expressMultiplier', 'Express Multiplier')}</label>
                    <input type="number" min={1} max={10} step={0.1} value={form.expressMultiplier}
                        onChange={(e) => { const n = parseFloat(e.target.value); setForm({ ...form, expressMultiplier: isNaN(n) ? 1 : n }); }}
                        style={{ ...fld, fontFamily: "'IBM Plex Mono'", fontWeight: 700, maxWidth: 200 }} />
                    <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginTop: 5 }}>{t('inventory.multiplierHelper', 'e.g., 1.5 = 50% extra')}</div>
                </div>

                {/* Image */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {shopId && (
                        <LSmartImageUploader
                            ref={imageUploaderRef}
                            folder="service-images"
                            shopId={shopId}
                            value={uploadedImage}
                            onChange={(meta) => { setUploadedImage(meta); setForm((prev) => ({ ...prev, imageUrl: meta[0]?.url ?? "", imageKey: meta[0]?.key ?? "", imageBytes: meta[0]?.compressedSize ?? 0 })); }}
                            maxFiles={1}
                            showStats={false}
                            deferUpload
                            label={t('inventory.uploadImage', 'Upload image')}
                            hint={t('common.optional', 'optional')}
                        />
                    )}
                    <div>
                        <label style={lbl}>{t('inventory.imageUrlOptional', 'Image URL (optional)')}</label>
                        <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://example.com/image.jpg" style={fld} />
                    </div>
                    {form.imageUrl && (
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <img src={form.imageUrl} alt="Preview" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", border: "1px solid var(--c-border)" }} />
                            <span style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{t('inventory.imagePreview', 'Image preview')}</span>
                        </div>
                    )}
                </div>

                {/* Active toggle */}
                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 11, padding: "12px 15px" }}>
                    <div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{t('inventory.active', 'Active')}</div><div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginTop: 1 }}>{t('inventory.showInPOS', 'Show in POS')}</div></div>
                    <button type="button" role="switch" aria-checked={form.isActive} onClick={() => setForm({ ...form, isActive: !form.isActive })} aria-label="Active" style={{ position: "relative", cursor: "pointer", width: 44, height: 25, border: 0, borderRadius: 20, flex: "none", background: form.isActive ? "var(--c-primary)" : "var(--c-border-strong)" }}>
                        <span style={{ position: "absolute", top: 3, left: 3, width: 19, height: 19, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.3)", transition: "transform .15s", transform: form.isActive ? "translateX(19px)" : "translateX(0)" }} />
                    </button>
                </label>

                {/* Submit */}
                <button type="button" onClick={handleSubmit} disabled={!isValid || loading}
                    style={{ width: "100%", marginTop: 4, cursor: (!isValid || loading) ? "not-allowed" : "pointer", font: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 11, padding: 14, boxShadow: "var(--sh-sm)", opacity: (!isValid || loading) ? 0.55 : 1 }}>
                    {loading ? t('common.loading', 'Saving…') : isEdit ? t('common.saveChanges', 'Save Changes') : t('inventory.addItem', 'Add Item')}
                </button>
            </div>
        </LResponsiveDialog>
    );
}
