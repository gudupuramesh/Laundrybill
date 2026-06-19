/**
 * Expense Detail Panel
 * 
 * Detail view for selected expense
 */

import { useMemo } from "react";
import {
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
        <div className="h-full overflow-y-auto bg-[#F4F6FA]">
            {/* Header Profile Card */}
            <div className="bg-card border-b border-border/50 px-6 py-8 flex flex-col items-center text-center shadow-sm relative">
                {onClose && (
                    <div className="absolute top-4 left-4">
                        <LButton variant="ghost" size="icon-sm" onClick={onClose} className="hover:bg-muted/50 rounded-full h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </LButton>
                    </div>
                )}
                <div className="absolute top-4 right-4 flex gap-2">
                    <LButton variant="outline" size="icon-sm" className="rounded-full h-8 w-8 bg-card shadow-sm border-border/60">
                        <Edit className="h-4 w-4" />
                    </LButton>
                    <LButton variant="outline" size="icon-sm" onClick={handleDelete} className="rounded-full h-8 w-8 bg-card shadow-sm border-border/60">
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </LButton>
                </div>
                
                {/* Icon avatar */}
                <div className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-sm",
                    `bg-${config?.color}-muted text-${config?.color}`
                )}>
                    <Icon className="h-10 w-10" />
                </div>
                
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{expense.description}</h1>
                <LBadge variant="muted" size="sm" className="mt-2 text-xs px-3 py-1 bg-muted/50">{config?.label}</LBadge>
            </div>

            {/* Content */}
            <div className="p-6 max-w-2xl mx-auto space-y-6">
                {/* Amount Card */}
                <div className="bg-card rounded-2xl shadow-sm border border-border/60 p-6 text-center">
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('finance.amount')}</p>
                    <LAmount value={expense.amount} className="text-4xl font-extrabold text-foreground tabular-nums tracking-tight" />
                </div>

                {/* Details */}
                <div className="bg-card rounded-2xl shadow-sm border border-border/60 overflow-hidden">
                    <div className="px-5 py-4 border-b border-border/40 bg-muted/20">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{t('finance.details', 'Details')}</h3>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
                                <Calendar className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('finance.date')}</p>
                                <div className="text-sm font-bold text-foreground">
                                    <LDateDisplay date={expense.date.toDate()} format="date" />
                                </div>
                            </div>
                        </div>

                        {expense.vendor && (
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
                                    <User className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('finance.vendor')}</p>
                                    <p className="text-sm font-bold text-foreground">{expense.vendor}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
                                <Receipt className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('finance.recurring')}</p>
                                <p className="text-sm font-bold text-foreground">
                                    {expense.isRecurring ? t('common.yes') : t('common.no')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Receipt placeholder */}
                {expense.receiptUrl && (
                    <div className="bg-card rounded-2xl shadow-sm border border-border/60 overflow-hidden">
                        <div className="px-5 py-4 border-b border-border/40 bg-muted/20">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{t('finance.receipt')}</h3>
                        </div>
                        <div className="p-5">
                            <div className="aspect-video bg-muted/30 rounded-xl flex items-center justify-center border border-border/50 border-dashed">
                                <Receipt className="h-12 w-12 text-muted-foreground/50" />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
