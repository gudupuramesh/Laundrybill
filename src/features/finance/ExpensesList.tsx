/**
 * Expenses List Component
 * 
 * List panel for expenses master-detail layout
 * Mobile: Shows bottom sheet when item clicked
 * Desktop: Updates selection for side panel
 */

import { useState, Fragment } from "react";
import {
    LSearchInput,
    LList,
    LListItem,
    LAmount,
    LEmptyState,
    LSkeletonList,
    LButton,
    LCard,
    LAdSlot,
    LBottomSheet,
    LDateDisplay,
    LSelect,
    LHelpButton,
} from "@/components/laundry";
import { useExpenses, useExpenseMutations } from "@/hooks/use-finance";
import { useIsMobile } from "@/hooks/use-mobile";
import { ExpenseFormSheet } from "./ExpenseFormSheet";
import type { Expense, ExpenseCategory } from "@/types/finance";
import { format, addMonths, subMonths } from "date-fns";
import { generateExpensesPDF } from "@/lib/expenses-pdf-generator";
import { useCurrency } from "@/hooks/use-currency";
import {
    Plus,
    ChevronLeft,
    ChevronRight,
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
    Edit,
    Trash2,
    Sparkles,
    Shirt,
    SprayCan,
    Droplet,
    ShoppingBag,
    Tag,
    Wind,
    Waves,
    Flame,
    Thermometer,
    Car,
    Box,
    TrendingUp,
    Shield,
    FileText,
    CircleDot,
    FileDown,
    X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const AD_FREQUENCY = 8;

// Helper to get category config (color/icon only)
const categoryConfig: Record<ExpenseCategory, { icon: any; color: string }> = {
    // Utilities
    rent: { icon: Home, color: "primary" },
    electricity: { icon: Zap, color: "warning" },
    water: { icon: Droplets, color: "primary" },
    // Laundry Supplies
    detergents: { icon: Sparkles, color: "success" },
    fabric_softener: { icon: Shirt, color: "success" },
    stain_remover: { icon: SprayCan, color: "success" },
    bleach: { icon: Droplet, color: "success" },
    hangers: { icon: CircleDot, color: "success" },
    plastic_covers: { icon: ShoppingBag, color: "success" },
    tags_ribbons: { icon: Tag, color: "success" },
    iron_spray: { icon: Wind, color: "success" },
    // Equipment & Maintenance
    equipment: { icon: Settings, color: "secondary" },
    maintenance: { icon: Wrench, color: "muted" },
    washing_machine: { icon: Waves, color: "secondary" },
    dryer: { icon: Flame, color: "warning" },
    pressing_equipment: { icon: Thermometer, color: "secondary" },
    // Operations
    transport: { icon: Truck, color: "warning" },
    delivery: { icon: Car, color: "warning" },
    packaging: { icon: Box, color: "muted" },
    // Business
    marketing: { icon: Megaphone, color: "destructive" },
    advertising: { icon: TrendingUp, color: "destructive" },
    salary: { icon: Wallet, color: "primary" },
    insurance: { icon: Shield, color: "primary" },
    licenses: { icon: FileText, color: "primary" },
    // Other
    miscellaneous: { icon: HelpCircle, color: "muted" },
};

// Helper to get category style config
function getCategoryStyle(category: string) {
    return categoryConfig[category as ExpenseCategory] || { icon: HelpCircle, color: "muted" };
}

interface ExpensesListProps {
    selectedId?: string | null;
    onSelect?: (expenseId: string) => void;
    currentMonth: Date;
    onMonthChange: (month: Date) => void;
}

export function ExpensesList({ selectedId, onSelect, currentMonth, onMonthChange }: ExpensesListProps) {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [formSheetOpen, setFormSheetOpen] = useState(false);
    const { currencySymbol } = useCurrency();
    const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
    const [generatingPDF, setGeneratingPDF] = useState(false);

    // Mobile: bottom sheet for selected expense
    const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
    const [mobileSelectedExpense, setMobileSelectedExpense] = useState<Expense | null>(null);

    const { expenses, loading } = useExpenses(currentMonth);
    const { createExpense, deleteExpense } = useExpenseMutations();

    // Helper to get translated category label
    const getCategoryLabel = (category: string, customName?: string) => {
        if (category === 'other' || category === 'miscellaneous') {
            return customName || t(`expense.categories.${category}`, category);
        }
        // Check if basic translation exists, otherwise fall back to formatting
        const key = `expense.categories.${category}`;
        const translated = t(key);
        // If translation is missing (returns key), fallback to readable format
        return translated !== key ? translated : (customName || category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
    };

    // Get all unique categories from expenses (including custom ones)
    const availableCategories = Array.from(new Set(expenses.map(e => e.category))).map(cat => {
        // Find an example expense for this category to check for custom name if needed (mostly for 'other')
        const example = expenses.find(e => e.category === cat);
        return {
            value: cat,
            label: getCategoryLabel(cat, (example as any)?.customCategoryName)
        };
    }).sort((a, b) => a.label.localeCompare(b.label));

    const filterOptions = [
        { value: "all", label: t('expense.allCategories', 'All Categories') },
        ...availableCategories
    ];

    const filteredExpenses = expenses.filter((expense) => {
        // Search filter
        const matchesSearch = expense.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            expense.category.toLowerCase().includes(searchQuery.toLowerCase());

        // Category filter
        const matchesCategory = selectedCategory === "all" || expense.category === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    const handlePrevMonth = () => onMonthChange(subMonths(currentMonth, 1));
    const handleNextMonth = () => onMonthChange(addMonths(currentMonth, 1));

    const handleItemClick = (expense: Expense) => {
        if (isMobile) {
            // Mobile: open bottom sheet
            setMobileSelectedExpense(expense);
            setMobileDetailOpen(true);
        } else {
            // Desktop: update selection for side panel
            onSelect?.(expense.id);
        }
    };

    const handleEdit = (expense: Expense) => {
        setMobileDetailOpen(false);
        setEditingExpense(expense);
        setFormSheetOpen(true);
    };

    const handleDelete = async (expense: Expense) => {
        await deleteExpense(expense.id);
        setMobileDetailOpen(false);
    };

    const handleCreateExpense = async (data: any) => {
        const expense = await createExpense(data);
        if (expense) {
            setFormSheetOpen(false);
            setEditingExpense(undefined);
            if (onSelect) {
                onSelect(expense.id);
            }
        }
    };

    const handleGeneratePDF = async () => {
        setGeneratingPDF(true);
        try {
            await generateExpensesPDF(filteredExpenses, currentMonth, selectedCategory, currencySymbol);
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            alert(t('common.error', 'Failed to generate PDF'));
        } finally {
            setGeneratingPDF(false);
        }
    };

    const mobileStyle = mobileSelectedExpense ? getCategoryStyle(mobileSelectedExpense.category) : null;
    const MobileIcon = mobileStyle?.icon || HelpCircle;

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-card p-4 space-y-3 border-b border-border">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg font-bold text-foreground">{t('finance.expenses')}</h1>
                        <LHelpButton size="icon" />
                    </div>
                    <div className="flex items-center gap-2">
                        {filteredExpenses.length > 0 && (
                            <LButton
                                variant="outline"
                                size="sm"
                                leftIcon={<FileDown className="h-4 w-4" />}
                                onClick={handleGeneratePDF}
                                loading={generatingPDF}
                            >
                                PDF
                            </LButton>
                        )}
                        <LButton
                            variant="primary"
                            size="sm"
                            leftIcon={<Plus className="h-4 w-4" />}
                            onClick={() => {
                                setEditingExpense(undefined);
                                setFormSheetOpen(true);
                            }}
                        >
                            {t('common.add')}
                        </LButton>
                    </div>
                </div>

                {/* Month Selector */}
                <div className="flex items-center justify-center gap-2">
                    <LButton variant="ghost" size="icon-sm" onClick={handlePrevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </LButton>
                    <span className="text-sm font-medium text-foreground min-w-[120px] text-center">
                        {format(currentMonth, "MMMM yyyy")}
                    </span>
                    <LButton variant="ghost" size="icon-sm" onClick={handleNextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </LButton>
                </div>

                {/* Total Card */}
                <LCard variant="filled" padding="sm" className="text-center">
                    <p className="text-xs text-muted-foreground">
                        {selectedCategory !== "all" ? t('finance.filteredTotal', 'Filtered Total') : t('finance.totalExpenses')}
                    </p>
                    <LAmount value={filteredExpenses.reduce((sum, e) => sum + e.amount, 0)} size="lg" />
                    {selectedCategory !== "all" && (
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('finance.expensesCount', '{{count}} expenses', { count: filteredExpenses.length })}
                        </p>
                    )}
                </LCard>

                {/* Filter and Search */}
                <div className="space-y-2">
                    <LSelect
                        label={t('finance.filterByCategory', 'Filter by Category')}
                        value={selectedCategory}
                        onChange={setSelectedCategory}
                        options={filterOptions}
                        placeholder={t('finance.allCategories', 'All Categories')}
                    />
                    {selectedCategory !== "all" && (
                        <LButton
                            variant="ghost"
                            size="sm"
                            leftIcon={<X className="h-3 w-3" />}
                            onClick={() => setSelectedCategory("all")}
                            className="text-xs"
                        >
                            {t('common.clearFilter', 'Clear Filter')}
                        </LButton>
                    )}
                    <LSearchInput
                        placeholder={t('common.search')}
                        onChange={setSearchQuery}
                    />
                </div>
            </div>

            {/* Expenses List */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <LSkeletonList count={8} />
                ) : filteredExpenses.length === 0 ? (
                    <LEmptyState
                        icon={<Package className="h-8 w-8" />}
                        title={searchQuery ? t('common.noResults') : t('finance.noExpenses')}
                        description={
                            searchQuery
                                ? t('common.tryDifferentSearch')
                                : t('finance.noExpensesDesc')
                        }
                        action={
                            !searchQuery
                                ? {
                                    label: t('finance.addExpense'),
                                    onClick: () => setFormSheetOpen(true),
                                }
                                : undefined
                        }
                    />
                ) : (
                    <LList>
                        {filteredExpenses.map((expense, index) => {
                            const style = getCategoryStyle(expense.category);
                            const ItemIcon = style.icon;
                            // Dynamically get label
                            const label = getCategoryLabel(expense.category, (expense as any).customCategoryName);

                            return (
                                <Fragment key={expense.id}>
                                    <LListItem
                                        title={expense.description}
                                        subtitle={`${label} • ${format(expense.date.toDate(), "MMM d")}`}
                                        leftContent={
                                            <div className={cn(
                                                "w-10 h-10 rounded-lg flex items-center justify-center",
                                                `bg-${style.color}-muted`
                                            )}>
                                                <ItemIcon className={cn("h-5 w-5", `text-${style.color}`)} />
                                            </div>
                                        }
                                        rightContent={
                                            <LAmount value={expense.amount} size="md" />
                                        }
                                        onClick={() => handleItemClick(expense)}
                                        className={cn(
                                            "cursor-pointer transition-colors",
                                            selectedId === expense.id &&
                                            "bg-primary-muted border-l-4 border-l-primary"
                                        )}
                                    />
                                    {isMobile && (index + 1) % AD_FREQUENCY === 0 && (
                                        <LAdSlot variant="card" position={`expenses-list-${index + 1}`} />
                                    )}
                                </Fragment>
                            );
                        })}
                    </LList>
                )}
            </div>

            {/* Form Sheet (Add/Edit) */}
            <ExpenseFormSheet
                open={formSheetOpen}
                onClose={() => {
                    setFormSheetOpen(false);
                    setEditingExpense(undefined);
                }}
                expense={editingExpense}
                onSubmit={handleCreateExpense}
            />

            {/* Mobile Detail Bottom Sheet */}
            <LBottomSheet
                open={mobileDetailOpen}
                onClose={() => setMobileDetailOpen(false)}
                title={mobileSelectedExpense?.description || t('finance.expenses')}
            >
                {mobileSelectedExpense && (
                    <div className="p-4 space-y-4">
                        {/* Category & Amount */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "w-12 h-12 rounded-xl flex items-center justify-center",
                                    `bg-${mobileStyle?.color}-muted`
                                )}>
                                    <MobileIcon className={cn("h-6 w-6", `text-${mobileStyle?.color}`)} />
                                </div>
                                <div>
                                    <p className="font-medium text-foreground">
                                        {getCategoryLabel(mobileSelectedExpense.category, (mobileSelectedExpense as any).customCategoryName)}
                                    </p>
                                    <LDateDisplay date={mobileSelectedExpense.date.toDate()} format="date" />
                                </div>
                            </div>
                            <LAmount value={mobileSelectedExpense.amount} size="xl" />
                        </div>

                        {/* Vendor */}
                        {mobileSelectedExpense.vendor && (
                            <div className="text-sm">
                                <span className="text-muted-foreground">{t('finance.vendor')}: </span>
                                <span className="text-foreground">{mobileSelectedExpense.vendor}</span>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                            <LButton
                                variant="outline"
                                size="lg"
                                fullWidth
                                leftIcon={<Edit className="h-4 w-4" />}
                                onClick={() => handleEdit(mobileSelectedExpense)}
                            >
                                {t('common.edit')}
                            </LButton>
                            <LButton
                                variant="outline"
                                size="lg"
                                fullWidth
                                leftIcon={<Trash2 className="h-4 w-4 text-destructive" />}
                                onClick={() => handleDelete(mobileSelectedExpense)}
                            >
                                {t('common.delete')}
                            </LButton>
                        </div>
                    </div>
                )}
            </LBottomSheet>
        </div>
    );
}
