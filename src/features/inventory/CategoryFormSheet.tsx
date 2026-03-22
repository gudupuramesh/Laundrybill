/**
 * Category Form Sheet
 * 
 * Add/edit category
 */

import { useState, useEffect } from "react";
import {
    LResponsiveDialog,
    LTextInput,
    LToggle,
    LButton,
    LSpacer,
} from "@/components/laundry";
import { useInventoryMutations } from "@/hooks/use-inventory";
import type { InventoryCategory } from "@/types/inventory";
import { useTranslation } from "react-i18next";

interface CategoryFormSheetProps {
    open: boolean;
    onClose: () => void;
    category?: InventoryCategory;
}

export function CategoryFormSheet({
    open,
    onClose,
    category,
}: CategoryFormSheetProps) {
    const { t } = useTranslation();
    const { createCategory, updateCategory } = useInventoryMutations();
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        name: "",
        isActive: true,
        turnaroundDays: 2,
    });

    const isEdit = !!category;

    useEffect(() => {
        if (category) {
            setForm({
                name: category.name,
                isActive: category.isActive,
                turnaroundDays: category.turnaroundDays || 2,
            });
        } else {
            setForm({
                name: "",
                isActive: true,
                turnaroundDays: 2,
            });
        }
    }, [category, open]);

    const handleSubmit = async () => {
        if (!form.name) return;

        setLoading(true);
        try {
            if (isEdit) {
                await updateCategory(category.id, form);
            } else {
                await createCategory(form);
            }
            onClose();
        } catch (error) {
            console.error("Error saving category:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title={isEdit ? t('inventory.editCategory') : t('inventory.addCategory')}
            size="sm"
            snapPoints={[0.4]}
        >
            <div className="space-y-4">
                <LTextInput
                    label={t('inventory.categoryName')}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t('inventory.categoryNamePlaceholder')}
                    className="capitalize"
                />

                <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                    <div>
                        <p className="font-medium text-foreground">{t('inventory.active')}</p>
                        <p className="text-xs text-muted-foreground">{t('inventory.showInServiceList')}</p>
                    </div>
                    <LToggle
                        checked={form.isActive}
                        onChange={(v) => setForm({ ...form, isActive: v })}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <LTextInput
                        type="number"
                        label={t('inventory.turnaroundDays', 'Turnaround (Days)')}
                        value={String(form.turnaroundDays || 2)}
                        onChange={(e) => setForm({ ...form, turnaroundDays: parseInt(e.target.value) || 2 })}
                        min="0"
                    />
                </div>

                <LSpacer size="md" />

                <LButton
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleSubmit}
                    loading={loading}
                    disabled={!form.name.trim()}
                >
                    {isEdit ? t('common.saveChanges') : t('inventory.addCategory')}
                </LButton>
            </div>
        </LResponsiveDialog>
    );
}
