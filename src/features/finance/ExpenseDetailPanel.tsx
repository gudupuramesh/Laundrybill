/**
 * Expense Detail Panel
 * 
 * Detail view for selected expense
 */

import { useMemo } from "react";
import {
    LCard,
    LButton,
    LAmount,
    LBadge,
    LSpinner,
    LDateDisplay,
} from "@/components/laundry";
import { useExpenses, useExpenseMutations } from "@/hooks/use-finance";
import type { Expense } from "@/types/finance";
import {
    ArrowLeft,
    Edit,
    Trash2,
    Home,
    Zap,
    Droplets,
    Wrench,
    Package,
    Settings,
    Megaphone,
    Truck,
    HelpCircle,
    Wallet,
    Calendar,
    Receipt,
    User,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

// Helper to get category config, with fallback for custom categories
function getCategoryConfig(expense: Expense, t: any) {
    const iconMap: Record<string, any> = {
        rent: Home,
        electricity: Zap,
        water: Droplets,
        detergents: Package,
        fabric_softener: Package,
        stain_remover: Package,
        bleach: Package,
        hangers: Package,
        plastic_covers: Package,
        tags_ribbons: Package,
        iron_spray: Package,
        equipment: Settings,
        maintenance: Wrench,
        washing_machine: Settings,
        dryer: Settings,
        pressing_equipment: Settings,
        transport: Truck,
        delivery: Truck,
        packaging: Package,
        marketing: Megaphone,
        advertising: Megaphone,
        salary: Wallet,
        insurance: HelpCircle,
        licenses: HelpCircle,
        other: HelpCircle,
    };

    const colorMap: Record<string, string> = {
        rent: "primary",
        electricity: "warning",
        water: "primary",
        detergents: "success",
        fabric_softener: "success",
        stain_remover: "success",
        bleach: "success",
        hangers: "success",
        plastic_covers: "success",
        tags_ribbons: "success",
        iron_spray: "success",
        equipment: "secondary",
        maintenance: "muted",
        washing_machine: "secondary",
        dryer: "warning",
        pressing_equipment: "secondary",
        transport: "warning",
        delivery: "warning",
        packaging: "muted",
        marketing: "destructive",
        advertising: "destructive",
        salary: "primary",
        insurance: "primary",
        licenses: "primary",
        other: "muted",
    };

    const icon = iconMap[expense.category] || HelpCircle;
    const color = colorMap[expense.category] || "muted";

    // Try to get translated label
    let label = t(`expense.categories.${expense.category}`);

    // Fallback for custom categories or clean up the ID if translation missing (safeguard)
    if (label === `expense.categories.${expense.category}`) {
        label = (expense as any).customCategoryName ||
            expense.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    return { label, icon, color };
}

interface ExpenseDetailPanelProps {
    expenseId: string;
    currentMonth: Date;
    onClose?: () => void;
}

export function ExpenseDetailPanel({ expenseId, currentMonth, onClose }: ExpenseDetailPanelProps) {
    const { t } = useTranslation();
    const { getExpense, loading } = useExpenses(currentMonth);
    const { deleteExpense } = useExpenseMutations();

    const expense = useMemo(() => getExpense(expenseId), [getExpense, expenseId]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <LSpinner size="lg" />
            </div>
        );
    }

    if (!expense) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <p className="text-lg font-medium">{t('finance.expenseNotFound')}</p>
                <LButton variant="ghost" className="mt-4" onClick={onClose}>
                    {t('common.goBack')}
                </LButton>
            </div>
        );
    }

    const config = getCategoryConfig(expense, t);
    const Icon = config.icon;

    const handleDelete = async () => {
        await deleteExpense(expense.id);
        onClose?.();
    };

    return (
        <div className="h-full overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {onClose && (
                            <LButton variant="ghost" size="icon-sm" onClick={onClose}>
                                <ArrowLeft className="h-5 w-5" />
                            </LButton>
                        )}
                        <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center",
                            `bg-${config?.color}-muted`
                        )}>
                            <Icon className={cn("h-6 w-6", `text-${config?.color}`)} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-foreground">{expense.description}</h1>
                            <LBadge variant="muted" size="sm">{config?.label}</LBadge>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <LButton variant="outline" size="icon-sm">
                            <Edit className="h-4 w-4" />
                        </LButton>
                        <LButton variant="outline" size="icon-sm" onClick={handleDelete}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </LButton>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
                {/* Amount Card */}
                <LCard variant="filled" padding="lg" className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">{t('finance.amount')}</p>
                    <LAmount value={expense.amount} size="xl" />
                </LCard>

                {/* Details */}
                <LCard variant="outlined" padding="md">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <Calendar className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">{t('finance.date')}</p>
                                <LDateDisplay date={expense.date.toDate()} format="date" />
                            </div>
                        </div>

                        {expense.vendor && (
                            <div className="flex items-center gap-3">
                                <User className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="text-xs text-muted-foreground">{t('finance.vendor')}</p>
                                    <p className="font-medium text-foreground">{expense.vendor}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            <Receipt className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">{t('finance.recurring')}</p>
                                <p className="font-medium text-foreground">
                                    {expense.isRecurring ? t('common.yes') : t('common.no')}
                                </p>
                            </div>
                        </div>
                    </div>
                </LCard>

                {/* Receipt placeholder */}
                {expense.receiptUrl && (
                    <LCard variant="outlined" padding="md">
                        <h3 className="font-semibold text-foreground mb-2">{t('finance.receipt')}</h3>
                        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                            <Receipt className="h-12 w-12 text-muted-foreground" />
                        </div>
                    </LCard>
                )}
            </div>
        </div>
    );
}
