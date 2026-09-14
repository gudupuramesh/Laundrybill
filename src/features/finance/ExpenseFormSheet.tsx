/**
 * Expense Form Sheet
 * 
 * Add/edit expense form with laundry-specific categories
 */

import { useState, useEffect, useRef, type CSSProperties } from "react";
import { LResponsiveDialog, LSmartImageUploader, type LSmartImageUploaderRef } from "@/components/laundry";
import { useAuth } from "@/features/auth";
import type { ImageMetadata } from "@/types/image-upload";
import { format } from "date-fns";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { useExpenseMutations } from "@/hooks/use-finance";
import type { Expense, ExpenseCategory } from "@/types/finance";
import { Timestamp } from "firebase/firestore";
import { useTranslation } from "react-i18next";


interface ExpenseFormSheetProps {
    open: boolean;
    onClose: () => void;
    expense?: Expense;
    onSubmit?: (data: any) => Promise<void>;
    /** Desktop Expenses page: docked right-hand panel instead of a dialog. */
    asPanel?: boolean;
}

export function ExpenseFormSheet({ open, onClose, expense, onSubmit, asPanel }: ExpenseFormSheetProps) {
    const { t } = useTranslation();
    const { currencySymbol } = useCurrency();

    // Flat list of categories for dropdown - using translations
    const categoryOptions = [
        // Utilities
        { value: "rent", label: t('expense.categories.rent'), group: t('expense.groups.utilities') },
        { value: "electricity", label: t('expense.categories.electricity'), group: t('expense.groups.utilities') },
        { value: "water", label: t('expense.categories.water'), group: t('expense.groups.utilities') },
        // Laundry Supplies
        { value: "detergents", label: t('expense.categories.detergents'), group: t('expense.groups.laundrySupplies') },
        { value: "fabric_softener", label: t('expense.categories.fabric_softener'), group: t('expense.groups.laundrySupplies') },
        { value: "stain_remover", label: t('expense.categories.stain_remover'), group: t('expense.groups.laundrySupplies') },
        { value: "bleach", label: t('expense.categories.bleach'), group: t('expense.groups.laundrySupplies') },
        { value: "hangers", label: t('expense.categories.hangers'), group: t('expense.groups.laundrySupplies') },
        { value: "plastic_covers", label: t('expense.categories.plastic_covers'), group: t('expense.groups.laundrySupplies') },
        { value: "tags_ribbons", label: t('expense.categories.tags_ribbons'), group: t('expense.groups.laundrySupplies') },
        { value: "iron_spray", label: t('expense.categories.iron_spray'), group: t('expense.groups.laundrySupplies') },
        // Equipment & Maintenance
        { value: "equipment", label: t('expense.categories.equipment'), group: t('expense.groups.equipmentMaintenance') },
        { value: "maintenance", label: t('expense.categories.maintenance'), group: t('expense.groups.equipmentMaintenance') },
        { value: "washing_machine", label: t('expense.categories.washing_machine'), group: t('expense.groups.equipmentMaintenance') },
        { value: "dryer", label: t('expense.categories.dryer'), group: t('expense.groups.equipmentMaintenance') },
        { value: "pressing_equipment", label: t('expense.categories.pressing_equipment'), group: t('expense.groups.equipmentMaintenance') },
        // Operations
        { value: "transport", label: t('expense.categories.transport'), group: t('expense.groups.operations') },
        { value: "delivery", label: t('expense.categories.delivery'), group: t('expense.groups.operations') },
        { value: "packaging", label: t('expense.categories.packaging'), group: t('expense.groups.operations') },
        // Business
        { value: "marketing", label: t('expense.categories.marketing'), group: t('expense.groups.business') },
        { value: "advertising", label: t('expense.categories.advertising'), group: t('expense.groups.business') },
        { value: "salary", label: t('expense.categories.salary'), group: t('expense.groups.business') },
        { value: "insurance", label: t('expense.categories.insurance'), group: t('expense.groups.business') },
        { value: "licenses", label: t('expense.categories.licenses'), group: t('expense.groups.business') },
        // Other - special option
        { value: "other", label: t('expense.categories.other'), group: t('expense.groups.other') },
    ];
    const { createExpense, updateExpense } = useExpenseMutations();
    const { shopId } = useAuth();
    const [loading, setLoading] = useState(false);
    const [receipt, setReceipt] = useState<ImageMetadata[]>([]);
    const receiptRef = useRef<LSmartImageUploaderRef>(null);
    const today = format(new Date(), "yyyy-MM-dd");

    const [form, setForm] = useState({
        category: "" as ExpenseCategory | "other" | "",
        customCategory: "",
        description: "",
        amountStr: "",
        date: today,
        vendor: "",
        paymentMode: "cash" as "cash" | "upi" | "bank",
    });

    const isEdit = !!expense;
    const isOtherCategory = form.category === "other" || form.category === "miscellaneous";

    useEffect(() => {
        if (expense) {
            const isKnownCategory = categoryOptions.some(opt => opt.value === expense.category);
            setForm({
                category: isKnownCategory ? expense.category : "other",
                customCategory: isKnownCategory ? "" : (expense.customCategoryName || expense.category),
                description: expense.description,
                amountStr: expense.amount ? String(expense.amount) : "",
                date: format(expense.date.toDate(), "yyyy-MM-dd"),
                vendor: expense.vendor || "",
                paymentMode: expense.paymentMode || "cash",
            });
            setReceipt(expense.receiptUrl ? [{
                id: "existing", key: expense.receiptKey || "", url: expense.receiptUrl, originalName: "Receipt",
                originalSize: 0, compressedSize: 0, compressionRatio: 0, width: 0, height: 0, mimeType: "image/jpeg", uploadedAt: new Date(),
            }] : []);
        } else {
            setForm({ category: "", customCategory: "", description: "", amountStr: "", date: today, vendor: "", paymentMode: "cash" });
            setReceipt([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expense, open]);

    const amount = parseFloat(form.amountStr) || 0;

    const handleSubmit = async () => {
        if (!isValid) return;
        setLoading(true);
        try {
            const finalCategory = isOtherCategory
                ? form.customCategory.trim().toLowerCase().replace(/\s+/g, '_') as ExpenseCategory
                : form.category as ExpenseCategory;
            // Parse as a LOCAL date (new Date("YYYY-MM-DD") is UTC midnight, which
            // east of UTC is still the previous day at local midnight boundaries).
            const [y, m, d] = form.date.split("-").map(Number);
            const localDate = new Date(y, m - 1, d, 12, 0, 0);

            const data: Record<string, any> = {
                category: finalCategory,
                description: form.description.trim(),
                amount,
                date: Timestamp.fromDate(localDate),
                paymentMode: form.paymentMode,
                isRecurring: expense?.isRecurring ?? false,
            };
            if (isOtherCategory && form.customCategory.trim()) data.customCategoryName = form.customCategory.trim();
            if (form.vendor.trim()) data.vendor = form.vendor.trim();

            const uploaded = await receiptRef.current?.uploadPendingImages?.();
            const meta = uploaded?.length ? uploaded[0] : receipt[0];
            if (meta?.url) { data.receiptUrl = meta.url; if (meta.key) data.receiptKey = meta.key; }
            else if (isEdit && expense?.receiptUrl) { data.receiptUrl = ""; data.receiptKey = ""; }

            if (onSubmit) {
                await onSubmit(data);
            } else if (isEdit) {
                await updateExpense(expense.id, data);
                onClose();
            } else {
                await createExpense(data);
                onClose();
            }
        } catch (error) {
            console.error("Error saving expense:", error);
        } finally {
            setLoading(false);
        }
    };

    const isValid = !!form.category && !!form.description.trim() && amount > 0 && (!isOtherCategory || !!form.customCategory.trim());

    const lblS: CSSProperties = { display: "block", fontSize: 13.5, fontWeight: 500, marginBottom: 8 };
    const fldS: CSSProperties = { width: "100%", font: "inherit", fontSize: 14.5, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 11, padding: "12px 14px", outline: "none" };

    const body = (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div>
                <label style={lblS}>{t("expense.amountLabel", "Amount")}</label>
                <div style={{ display: "flex", alignItems: "stretch", border: "1px solid var(--ds-border)", borderRadius: 11, overflow: "hidden" }}>
                    <span style={{ width: 42, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1px solid var(--ds-border)", color: "var(--ds-text-2)" }}>{currencySymbol}</span>
                    <input autoFocus={!isEdit} type="text" inputMode="decimal" value={form.amountStr} placeholder={t("expense.amountPh", "e.g., 1250")}
                        onChange={(e) => setForm({ ...form, amountStr: e.target.value.replace(/[^0-9.]/g, "") })}
                        style={{ flex: 1, minWidth: 0, font: "inherit", fontSize: 14.5, color: "var(--ds-text)", background: "transparent", border: 0, padding: "12px 14px", outline: "none" }} />
                </div>
            </div>

            <div>
                <label style={lblS}>{t("expense.categoryLabel", "Category")}</label>
                <div style={{ position: "relative" }}>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory | "other" })}
                        style={{ ...fldS, appearance: "none", WebkitAppearance: "none", paddingRight: 40, cursor: "pointer", color: form.category ? "var(--ds-text)" : "var(--ds-text-2)" }}>
                        <option value="">{t("expense.selectCategory", "Select category")}</option>
                        {Array.from(new Set(categoryOptions.map((o) => o.group))).map((group) => (
                            <optgroup key={group} label={group}>
                                {categoryOptions.filter((o) => o.group === group).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </optgroup>
                        ))}
                    </select>
                    <ChevronDown size={18} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                </div>
                {isOtherCategory && (
                    <input value={form.customCategory} onChange={(e) => setForm({ ...form, customCategory: e.target.value })} placeholder={t("expense.customCategoryPlaceholder", "e.g. Cleaning supplies")} style={{ ...fldS, marginTop: 8 }} />
                )}
            </div>

            <div>
                <label style={lblS}>{t("expense.dateLabel", "Date")}</label>
                <label style={{ position: "relative", display: "flex", alignItems: "stretch", border: "1px solid var(--ds-border)", borderRadius: 11, overflow: "hidden", cursor: "pointer" }}>
                    <span style={{ width: 42, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1px solid var(--ds-border)", color: "var(--ds-text-2)" }}><CalendarDays size={18} /></span>
                    <span style={{ flex: 1, padding: "12px 14px", fontSize: 14.5 }}>{form.date ? format(new Date(Number(form.date.slice(0, 4)), Number(form.date.slice(5, 7)) - 1, Number(form.date.slice(8, 10))), "d MMM yyyy") : "—"}</span>
                    <input type="date" value={form.date} max={today} onChange={(e) => e.target.value && setForm({ ...form, date: e.target.value })} aria-label={t("expense.dateLabel", "Date")}
                        onClick={(e) => { try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* unsupported */ } }}
                        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%" }} />
                </label>
            </div>

            <div>
                <label style={lblS}>{t("expense.descriptionLabel", "Description")}</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder={t("expense.descriptionPh", "e.g., Detergent purchase")}
                    style={{ ...fldS, resize: "vertical" }} />
                <input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder={t("expense.vendorPh", "Vendor (optional)")} style={{ ...fldS, marginTop: 8, fontSize: 14 }} />
            </div>

            <div>
                <label style={lblS}>{t("expense.paidByLabel", "Paid by")}</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", border: "1px solid var(--ds-border)", borderRadius: 11, overflow: "hidden" }}>
                    {([["cash", t("expense.cash", "Cash")], ["upi", "UPI"], ["bank", t("expense.bank", "Bank")]] as const).map(([m, label], i) => {
                        const on = form.paymentMode === m;
                        return (
                            <button key={m} type="button" onClick={() => setForm({ ...form, paymentMode: m })}
                                style={{ cursor: "pointer", font: "inherit", fontSize: 15, fontWeight: 500, padding: "11px 6px", border: 0, borderLeft: i ? "1px solid var(--ds-border)" : 0, background: "var(--ds-card)", color: on ? "var(--ds-blue)" : "var(--ds-text)", boxShadow: on ? "inset 0 0 0 2px var(--ds-blue)" : undefined, borderRadius: on ? 11 : 0 }}>{label}</button>
                        );
                    })}
                </div>
            </div>

            <div>
                <label style={lblS}>{t("expense.receiptLabel", "Receipt (optional)")}</label>
                {shopId && (
                    <div style={{ border: "1px dashed var(--ds-border)", borderRadius: 12, padding: 14 }}>
                        <LSmartImageUploader ref={receiptRef} folder="receipts" shopId={shopId} value={receipt} onChange={setReceipt} maxFiles={1} showStats={false} deferUpload
                            label={t("expense.dropReceipt", "Drag & drop an image here or click to upload")} hint={t("expense.receiptHint", "JPG, PNG up to 2MB")} />
                    </div>
                )}
            </div>
        </div>
    );

    const saveBtn = (
        <button type="button" onClick={handleSubmit} disabled={!isValid || loading}
            style={{ width: "100%", cursor: (!isValid || loading) ? "not-allowed" : "pointer", font: "inherit", fontSize: 16, fontWeight: 600, color: "#fff", background: "var(--ds-blue)", border: 0, borderRadius: 12, padding: "16px 14px", opacity: (!isValid || loading) ? 0.55 : 1 }}>
            {loading ? t("common.loading", "Saving…") : t("expense.saveExpense", "Save expense")}
        </button>
    );

    if (asPanel) {
        if (!open) return null;
        return (
            <aside className="lb-ds" style={{ width: 300, flex: "none", display: "flex", flexDirection: "column", minHeight: 0, background: "var(--ds-card)", borderLeft: "1px solid var(--ds-border)" }}>
                <div style={{ display: "flex", alignItems: "center", padding: "24px 20px 16px" }}>
                    <span style={{ fontSize: 20, fontWeight: 600 }}>{isEdit ? t("expense.editTitle", "Edit expense") : t("expense.addTitle", "Add expense")}</span>
                    <button onClick={onClose} aria-label={t("common.close", "Close")} style={{ marginLeft: "auto", cursor: "pointer", border: 0, background: "transparent", color: "var(--ds-text-2)", display: "inline-flex" }}><X size={22} /></button>
                </div>
                <div className="lb-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "4px 20px 16px" }}>{body}</div>
                <div style={{ padding: "12px 20px 20px" }}>{saveBtn}</div>
            </aside>
        );
    }

    return (
        <LResponsiveDialog open={open} onClose={onClose} title={isEdit ? t("expense.editTitle", "Edit expense") : t("expense.addTitle", "Add expense")} size="md">
            <div className="lb-ds" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                {body}
                {saveBtn}
            </div>
        </LResponsiveDialog>
    );
}
