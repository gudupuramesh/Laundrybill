/**
 * Expense Form Sheet
 * 
 * Add/edit expense form with laundry-specific categories
 */

import { useState, useEffect, type CSSProperties } from "react";
import { LResponsiveDialog } from "@/components/laundry";
import { useCurrency } from "@/hooks/use-currency";
import { useExpenseMutations } from "@/hooks/use-finance";
import type { Expense, ExpenseCategory } from "@/types/finance";
import { Timestamp } from "firebase/firestore";
import { useTranslation } from "react-i18next";

const MONO = "'IBM Plex Mono'";
const lbl: CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6 };
const fld: CSSProperties = { width: "100%", font: "inherit", fontSize: 13.5, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 9, padding: "10px 12px", outline: "none" };

interface ExpenseFormSheetProps {
    open: boolean;
    onClose: () => void;
    expense?: Expense;
    onSubmit?: (data: any) => Promise<void>;
}

export function ExpenseFormSheet({ open, onClose, expense, onSubmit }: ExpenseFormSheetProps) {
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
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        category: "detergents" as ExpenseCategory | "other",
        customCategory: "",
        description: "",
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        vendor: "",
    });

    const isEdit = !!expense;
    const isOtherCategory = form.category === "other" || form.category === "miscellaneous";

    useEffect(() => {
        if (expense) {
            // Check if existing category is a known one or custom
            const isKnownCategory = categoryOptions.some(opt => opt.value === expense.category);
            setForm({
                category: isKnownCategory ? expense.category : "other",
                customCategory: isKnownCategory ? "" : expense.category,
                description: expense.description,
                amount: expense.amount,
                date: expense.date.toDate().toISOString().split('T')[0],
                vendor: expense.vendor || "",
            });
        } else {
            setForm({
                category: "detergents",
                customCategory: "",
                description: "",
                amount: 0,
                date: new Date().toISOString().split('T')[0],
                vendor: "",
            });
        }
    }, [expense, open]);

    const handleSubmit = async () => {
        if (!form.description || form.amount <= 0) return;

        // If "other" is selected, custom category must be filled
        if (isOtherCategory && !form.customCategory.trim()) return;

        setLoading(true);
        try {
            // Determine final category
            const finalCategory = isOtherCategory
                ? form.customCategory.trim().toLowerCase().replace(/\s+/g, '_') as ExpenseCategory
                : form.category as ExpenseCategory;

            // Build data object - exclude undefined values (Firestore doesn't accept undefined)
            const data: Record<string, any> = {
                category: finalCategory,
                description: form.description,
                amount: form.amount,
                date: Timestamp.fromDate(new Date(form.date)),
                isRecurring: false,
            };

            // Store custom category name for display if it's custom
            if (isOtherCategory && form.customCategory.trim()) {
                data.customCategoryName = form.customCategory.trim();
            }

            // Only include vendor if it has a value
            if (form.vendor && form.vendor.trim()) {
                data.vendor = form.vendor.trim();
            }

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

    const isValid = form.description.trim() && form.amount > 0 &&
        (!isOtherCategory || form.customCategory.trim());

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title={isEdit ? t('finance.editExpense') : t('finance.addExpense')}
            size="md"
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Category */}
                <div>
                    <label style={lbl}>{t('finance.category', 'Category')}</label>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory | "other" })} style={fld}>
                        {Array.from(new Set(categoryOptions.map((o) => o.group))).map((group) => (
                            <optgroup key={group} label={group}>
                                {categoryOptions.filter((o) => o.group === group).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </optgroup>
                        ))}
                    </select>
                </div>

                {isOtherCategory && (
                    <div>
                        <label style={lbl}>{t('expense.customCategoryName', 'Custom category name')}</label>
                        <input value={form.customCategory} onChange={(e) => setForm({ ...form, customCategory: e.target.value })} placeholder={t('expense.customCategoryPlaceholder', 'e.g. Cleaning supplies')} style={fld} />
                    </div>
                )}

                <div>
                    <label style={lbl}>{t('finance.description', 'Description')}</label>
                    <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t('finance.descriptionPlaceholder', 'What was this expense for?')} style={fld} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                        <label style={lbl}>{t('finance.amount', 'Amount')}</label>
                        <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--c-border-strong)", borderRadius: 9, background: "var(--c-surface)" }}>
                            <span style={{ fontFamily: MONO, fontSize: 13, color: "var(--c-text-3)", paddingLeft: 11 }}>{currencySymbol}</span>
                            <input type="text" inputMode="decimal" value={form.amount || ""} placeholder="0" onChange={(e) => { const n = parseFloat(e.target.value); setForm({ ...form, amount: isNaN(n) || n < 0 ? 0 : n }); }} style={{ ...fld, border: 0, fontFamily: MONO, fontWeight: 700, paddingLeft: 8, background: "transparent" }} />
                        </div>
                    </div>
                    <div>
                        <label style={lbl}>{t('finance.date', 'Date')}</label>
                        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={fld} />
                    </div>
                </div>

                <div>
                    <label style={lbl}>{t('finance.vendor', 'Vendor')} <span style={{ color: "var(--c-text-3)", fontWeight: 400 }}>· {t('common.optional', 'optional')}</span></label>
                    <input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder={t('finance.vendorPlaceholder', 'Who was paid?')} style={fld} />
                </div>

                <button type="button" onClick={handleSubmit} disabled={!isValid || loading} style={{ width: "100%", marginTop: 4, cursor: (!isValid || loading) ? "not-allowed" : "pointer", font: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 11, padding: 14, boxShadow: "var(--sh-sm)", opacity: (!isValid || loading) ? 0.55 : 1 }}>
                    {loading ? t('common.loading', 'Saving…') : isEdit ? t('common.saveChanges', 'Save Changes') : t('finance.addExpense', 'Add Expense')}
                </button>
            </div>
        </LResponsiveDialog>
    );
}
