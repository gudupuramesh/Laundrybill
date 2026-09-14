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
import type { InventoryItem, InventoryCategory, PricingType, LocalizedName } from "@/types/inventory";
import { ChevronDown, ChevronUp, X } from "lucide-react";
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
    /** Desktop Services page: render as the docked right-hand panel instead of a dialog. */
    asPanel?: boolean;
    /** Category preselected when adding (the one open in the sidebar). */
    defaultCategoryId?: string;
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


const LANGS: { code: keyof LocalizedName; label: string; placeholder: string }[] = [
    { code: "hi", label: "Hindi", placeholder: "नाम (उदा., शर्ट)" },
    { code: "te", label: "Telugu", placeholder: "పేరు (ఉదా., షర్ట్)" },
    { code: "ta", label: "Tamil", placeholder: "பெயர் (எ.கா., சட்டை)" },
    { code: "kn", label: "Kannada", placeholder: "ಹೆಸರು (ಉದಾ., ಶರ್ಟ್)" },
    { code: "mr", label: "Marathi", placeholder: "नाव (उदा., शर्ट)" },
    { code: "bn", label: "Bengali", placeholder: "নাম (যেমন, শার্ট)" },
    { code: "ml", label: "Malayalam", placeholder: "പേര് (ഉദാ., ഷർട്ട്)" },
];

export function ServiceFormSheet({ open, onClose, item, categories, onAddCategory, asPanel, defaultCategoryId }: ServiceFormSheetProps) {
    const { t } = useTranslation();
    const { shopId } = useAuth();
    const { currencySymbol } = useCurrency();
    const { createItem, updateItem } = useInventoryMutations();
    const [loading, setLoading] = useState(false);
    const [uploadedImage, setUploadedImage] = useState<ImageMetadata[]>([]);
    const imageUploaderRef = useRef<LSmartImageUploaderRef>(null);
    const [langOpen, setLangOpen] = useState(true);
    const [urlOpen, setUrlOpen] = useState(false);

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
    const [priceStr, setPriceStr] = useState("");
    const [surchargeStr, setSurchargeStr] = useState("");
    const [localized, setLocalized] = useState<LocalizedName>({});

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
            setPriceStr(item.basePrice ? String(item.basePrice) : "");
            const sur = Math.round(item.basePrice * ((item.expressMultiplier || 1) - 1) * 100) / 100;
            setSurchargeStr(sur > 0 ? String(sur) : "");
            setLocalized(item.localizedNames || {});
            setUploadedImage(item.imageUrl ? [{
                id: "existing", key: item.imageKey || "", url: item.imageUrl, originalName: "Image",
                originalSize: 0, compressedSize: item.imageBytes || 0, compressionRatio: 0,
                width: 0, height: 0, mimeType: "image/jpeg", uploadedAt: new Date(),
            }] : []);
        } else {
            setForm({
                name: "", categoryId: defaultCategoryId || "", pricingType: "piece", basePrice: 0,
                expressMultiplier: 1.5, description: "", imageUrl: "", imageKey: "", imageBytes: 0, isActive: true,
            });
            setPriceStr("");
            setSurchargeStr("");
            setLocalized({});
            setUploadedImage([]);
        }
        setUrlOpen(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item, open]);

    // Express is stored as a multiplier (POS + apps price from it); the form edits
    // it as a flat surcharge like the reference, and converts on save.
    const price = parseFloat(priceStr) || 0;
    const surcharge = Math.max(0, parseFloat(surchargeStr) || 0);
    const multiplier = price > 0 ? Math.round((1 + surcharge / price) * 10000) / 10000 : form.expressMultiplier;

    const handleSubmit = async () => {
        if (!form.name.trim() || !form.categoryId || price <= 0) return;
        setLoading(true);
        try {
            const finalMeta = await imageUploaderRef.current?.uploadPendingImages?.();
            const hasMeta = (finalMeta?.length ?? 0) > 0;
            const imageUrl = hasMeta ? finalMeta?.[0]?.url ?? "" : uploadedImage[0]?.url ?? form.imageUrl ?? "";
            const imageKey = hasMeta ? finalMeta?.[0]?.key ?? "" : uploadedImage[0]?.key ?? "";
            const imageBytes = hasMeta ? finalMeta?.[0]?.compressedSize ?? 0 : uploadedImage[0]?.compressedSize ?? 0;
            const category = categories.find((c) => c.id === form.categoryId);
            const cleanLocalized = Object.fromEntries(Object.entries(localized).filter(([, v]) => v && String(v).trim())) as LocalizedName;
            const data = {
                ...form, basePrice: price, expressMultiplier: multiplier,
                subCategory: "Others", imageUrl, imageKey, imageBytes, categoryName: category?.name || "",
                localizedNames: cleanLocalized,
            };
            if (isEdit) await updateItem(item.id, data); else await createItem(data);
            onClose();
        } catch (error) {
            console.error("Error saving service:", error);
        } finally {
            setLoading(false);
        }
    };

    const isValid = !!form.name.trim() && !!form.categoryId && price > 0;
    const commonUnits: { value: PricingType; label: string }[] = [
        { value: "piece", label: t("inventory.perPiece", "Per piece") },
        { value: "kg", label: t("inventory.perKg", "Per kg") },
        { value: "pair", label: t("inventory.perPair", "Per pair") },
    ];
    const otherUnit = !commonUnits.some((u) => u.value === form.pricingType);

    const lblS: CSSProperties = { display: "block", fontSize: 13.5, fontWeight: 500, color: "var(--ds-text)", marginBottom: 8 };
    const fldS: CSSProperties = { width: "100%", font: "inherit", fontSize: 14.5, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 11, padding: "12px 14px", outline: "none" };
    const moneyField = (value: string, set: (v: string) => void, placeholder: string, label: string) => (
        <div style={{ display: "flex", alignItems: "stretch", border: "1px solid var(--ds-border)", borderRadius: 11, overflow: "hidden", background: "var(--ds-card)" }}>
            <span style={{ width: 42, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text-2)", borderRight: "1px solid var(--ds-border)" }}>{currencySymbol}</span>
            <input aria-label={label} type="text" inputMode="decimal" value={value} placeholder={placeholder}
                onChange={(e) => set(e.target.value.replace(/[^0-9.]/g, ""))}
                style={{ flex: 1, minWidth: 0, font: "inherit", fontSize: 14.5, color: "var(--ds-text)", background: "transparent", border: 0, padding: "12px 14px", outline: "none" }} />
        </div>
    );

    const body = (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Name */}
            <div>
                <label style={lblS}>{t("inventory.nameLabel", "Name")}</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("inventory.namePlaceholder", "e.g., Shirt")} style={fldS} />
            </div>

            {/* Category */}
            <div>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                    <label style={{ ...lblS, marginBottom: 0 }}>{t("inventory.categoryLabel", "Category")}</label>
                    {onAddCategory && <button type="button" onClick={(e) => { e.preventDefault(); onAddCategory(); }} style={{ marginLeft: "auto", cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--ds-blue)", background: "transparent", border: 0 }}>+ {t("inventory.addCategory", "Add category")}</button>}
                </div>
                <div style={{ position: "relative" }}>
                    <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} style={{ ...fldS, appearance: "none", WebkitAppearance: "none", paddingRight: 40, color: form.categoryId ? "var(--ds-text)" : "var(--ds-text-2)", cursor: "pointer" }}>
                        <option value="">{t("inventory.selectCategoryPh", "Select category")}</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <ChevronDown size={18} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--ds-text)" }} />
                </div>
            </div>

            {/* Unit */}
            <div>
                <label style={lblS}>{t("inventory.unitLabel", "Unit")}</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", border: "1px solid var(--ds-border)", borderRadius: 11, overflow: "hidden" }}>
                    {commonUnits.map((u, i) => {
                        const on = form.pricingType === u.value;
                        return (
                            <button key={u.value} type="button" onClick={() => setForm({ ...form, pricingType: u.value })}
                                style={{ cursor: "pointer", font: "inherit", fontSize: 15, fontWeight: on ? 600 : 500, padding: "12px 6px", border: 0, borderLeft: i ? "1px solid var(--ds-border)" : 0, background: "var(--ds-card)", color: on ? "var(--ds-blue)" : "var(--ds-text)", boxShadow: on ? "inset 0 0 0 2px var(--ds-blue)" : undefined, borderRadius: on ? 11 : 0 }}>{u.label}</button>
                        );
                    })}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13, color: "var(--ds-text-2)" }}>
                    <span>{t("inventory.otherUnit", "Other unit")}</span>
                    <select value={otherUnit ? form.pricingType : ""} onChange={(e) => e.target.value && setForm({ ...form, pricingType: e.target.value as PricingType })}
                        style={{ font: "inherit", fontSize: 13, color: otherUnit ? "var(--ds-blue)" : "var(--ds-text-2)", background: "var(--ds-card)", border: `1px solid ${otherUnit ? "var(--ds-blue)" : "var(--ds-border)"}`, borderRadius: 8, padding: "5px 8px", cursor: "pointer" }}>
                        <option value="">—</option>
                        {pricingTypeOptions.filter((o) => !["piece", "kg", "pair"].includes(o.value)).map((opt) => <option key={opt.value} value={opt.value}>{t(`inventory.pricingTypes.${opt.value}`, opt.label)}</option>)}
                    </select>
                </div>
            </div>

            {/* Price */}
            <div>
                <label style={lblS}>{t("inventory.priceLabel", "Price")}</label>
                {moneyField(priceStr, setPriceStr, t("inventory.pricePh", "e.g., 15"), t("inventory.priceLabel", "Price"))}
            </div>

            {/* Express surcharge */}
            <div>
                <label style={lblS}>{t("inventory.expressSurcharge", "Express surcharge")}</label>
                {moneyField(surchargeStr, setSurchargeStr, t("inventory.surchargePh", "e.g., 10"), t("inventory.expressSurcharge", "Express surcharge"))}
                {price > 0 && surcharge > 0 && (
                    <div style={{ fontSize: 12.5, color: "var(--ds-text-2)", marginTop: 6 }}>{t("inventory.expressPreview", "Express price {{p}}", { p: `${currencySymbol}${Math.round((price + surcharge) * 100) / 100}` })}</div>
                )}
            </div>

            {/* Photo */}
            <div>
                <label style={lblS}>{t("inventory.photoOptional", "Photo (optional)")}</label>
                {shopId && (
                    <div className="svc-drop" style={{ border: "1px dashed var(--ds-border)", borderRadius: 12, padding: 14 }}>
                        <LSmartImageUploader
                            ref={imageUploaderRef}
                            folder="service-images"
                            shopId={shopId}
                            value={uploadedImage}
                            onChange={(meta) => { setUploadedImage(meta); setForm((prev) => ({ ...prev, imageUrl: meta[0]?.url ?? "", imageKey: meta[0]?.key ?? "", imageBytes: meta[0]?.compressedSize ?? 0 })); }}
                            maxFiles={1}
                            showStats={false}
                            deferUpload
                            label={t("inventory.dropImage", "Drag & drop an image here or click to upload")}
                            hint={t("inventory.imageHint", "JPG, PNG up to 2MB")}
                        />
                    </div>
                )}
                <button type="button" onClick={() => setUrlOpen((v) => !v)} style={{ marginTop: 8, cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 500, color: "var(--ds-blue)", background: "transparent", border: 0, padding: 0 }}>
                    {urlOpen ? t("inventory.hideImageUrl", "Hide image URL") : t("inventory.useImageUrl", "Use an image URL instead")}
                </button>
                {urlOpen && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                        <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://example.com/image.jpg" style={fldS} />
                        {form.imageUrl && <img src={form.imageUrl} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} style={{ width: 46, height: 46, flex: "none", borderRadius: 9, objectFit: "cover", border: "1px solid var(--ds-border)" }} />}
                    </div>
                )}
            </div>

            {/* Names in other languages */}
            <div style={{ border: "1px solid var(--ds-border)", borderRadius: 12, overflow: "hidden" }}>
                <button type="button" onClick={() => setLangOpen((v) => !v)} style={{ width: "100%", cursor: "pointer", font: "inherit", display: "flex", alignItems: "center", padding: "14px 16px", fontSize: 14, fontWeight: 500, color: "var(--ds-text)", background: "var(--ds-card)", border: 0 }}>
                    {t("inventory.otherLanguages", "Names in other languages")}
                    {langOpen ? <ChevronUp size={18} style={{ marginLeft: "auto" }} /> : <ChevronDown size={18} style={{ marginLeft: "auto" }} />}
                </button>
                {langOpen && (
                    <div style={{ padding: "0 12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                        {LANGS.map((l) => (
                            <div key={l.code}>
                                <div style={{ fontSize: 12, color: "var(--ds-text)", marginBottom: 5 }}>{l.label}</div>
                                <input value={localized[l.code] || ""} onChange={(e) => setLocalized({ ...localized, [l.code]: e.target.value })} placeholder={l.placeholder}
                                    style={{ ...fldS, fontSize: 14, padding: "10px 12px", borderRadius: 9 }} />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Active */}
            <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 500 }}>{t("inventory.active", "Active")}</span>
                    <span style={{ display: "block", fontSize: 12.5, color: "var(--ds-text-2)" }}>{t("inventory.showInPOS", "Show in POS")}</span>
                </span>
                <button type="button" role="switch" aria-checked={form.isActive} onClick={() => setForm({ ...form, isActive: !form.isActive })} aria-label="Active"
                    style={{ position: "relative", cursor: "pointer", width: 44, height: 24, border: 0, borderRadius: 20, flex: "none", background: form.isActive ? "var(--ds-blue)" : "#D1D5DB" }}>
                    <span style={{ position: "absolute", top: 3, left: 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.25)", transition: "transform .15s", transform: form.isActive ? "translateX(20px)" : "translateX(0)" }} />
                </button>
            </label>
        </div>
    );

    const saveBtn = (
        <button type="button" onClick={handleSubmit} disabled={!isValid || loading}
            style={{ width: "100%", cursor: (!isValid || loading) ? "not-allowed" : "pointer", font: "inherit", fontSize: 16, fontWeight: 600, color: "#fff", background: "var(--ds-blue)", border: 0, borderRadius: 12, padding: "16px 14px", opacity: (!isValid || loading) ? 0.55 : 1 }}>
            {loading ? t("common.loading", "Saving…") : t("inventory.saveService", "Save service")}
        </button>
    );

    if (asPanel) {
        if (!open) return null;
        return (
            <aside className="lb-ds" style={{ width: 392, flex: "none", display: "flex", flexDirection: "column", minHeight: 0, background: "var(--ds-card)", borderLeft: "1px solid var(--ds-border)" }}>
                <div style={{ display: "flex", alignItems: "center", padding: "22px 22px 14px" }}>
                    <span style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-.01em" }}>{isEdit ? t("inventory.editServiceTitle", "Edit service") : t("inventory.addServiceTitle", "Add service")}</span>
                    <button onClick={onClose} aria-label={t("common.close", "Close")} style={{ marginLeft: "auto", cursor: "pointer", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text-2)", background: "transparent", border: 0 }}><X size={22} /></button>
                </div>
                <div className="lb-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "4px 22px 16px" }}>{body}</div>
                <div style={{ padding: "12px 22px 20px" }}>{saveBtn}</div>
            </aside>
        );
    }

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title={isEdit ? t("inventory.editServiceTitle", "Edit service") : t("inventory.addServiceTitle", "Add service")}
            size="md"
            snapPoints={[0.9]}
        >
            <div className="lb-ds" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {body}
                {saveBtn}
            </div>
        </LResponsiveDialog>
    );
}
