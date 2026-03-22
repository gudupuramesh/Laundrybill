/**
 * Reports Page
 * 
 * Financial dashboard showing revenue, expenses, profit, and trends
 * A4 Layout - Clean Document Style
 */

import { useState, useMemo } from "react";
import {
    LAmount,
    LButton,
    LEmptyState,
    LPageLoader,
    LDivider,
} from "@/components/laundry";
import { useFinancialReports } from "@/hooks/use-finance";
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from "date-fns";
import {
    FileDown,
    ArrowRight,
    Printer,
    Download
} from "lucide-react";
import { cn } from "@/lib/utils";

import { generateReportsPDF } from "@/lib/reports-pdf-generator";
import { useTranslation } from "react-i18next";
import { useMinLoading } from "@/hooks/use-min-loading";

// Custom Date Range Types
type DateRangeOption = "thisMonth" | "lastMonth" | "custom";

// Category translation keys
const categoryTranslationKeys: Record<string, string> = {
    rent: "expense.categories.rent",
    electricity: "expense.categories.electricity",
    water: "expense.categories.water",
    detergents: "expense.categories.detergents",
    fabric_softener: "expense.categories.fabricSoftener",
    stain_remover: "expense.categories.stainRemover",
    bleach: "expense.categories.bleach",
    hangers: "expense.categories.hangers",
    plastic_covers: "expense.categories.plasticCovers",
    tags_ribbons: "expense.categories.tagsRibbons",
    iron_spray: "expense.categories.ironSpray",
    equipment: "expense.categories.equipment",
    maintenance: "expense.categories.maintenance",
    washing_machine: "expense.categories.washingMachine",
    dryer: "expense.categories.dryer",
    pressing_equipment: "expense.categories.pressingEquipment",
    transport: "expense.categories.transport",
    delivery: "expense.categories.delivery",
    packaging: "expense.categories.packaging",
    marketing: "expense.categories.marketing",
    advertising: "expense.categories.advertising",
    salary: "expense.categories.salary",
    insurance: "expense.categories.insurance",
    licenses: "expense.categories.licenses",
    miscellaneous: "expense.categories.other",
};

export function ReportsPage() {
    const { t } = useTranslation();

    // Date State
    const [rangeOption, setRangeOption] = useState<DateRangeOption>("thisMonth");
    const [customStart, setCustomStart] = useState<string>(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    const [customEnd, setCustomEnd] = useState<string>(format(endOfMonth(new Date()), "yyyy-MM-dd"));

    // Function to get translated category label
    const getCategoryLabel = (category: string): string => {
        const key = categoryTranslationKeys[category];
        if (key) {
            return t(key);
        }
        return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    // Calculate actual date range passed to hook
    const { startDate, endDate, periodLabel } = useMemo(() => {
        const now = new Date();

        if (rangeOption === "thisMonth") {
            return {
                startDate: startOfMonth(now),
                endDate: endOfMonth(now),
                periodLabel: format(now, "MMMM yyyy")
            };
        }

        if (rangeOption === "lastMonth") {
            const lastMonth = subMonths(now, 1);
            return {
                startDate: startOfMonth(lastMonth),
                endDate: endOfMonth(lastMonth),
                periodLabel: format(lastMonth, "MMMM yyyy")
            };
        }

        // Custom Range
        const start = startOfDay(new Date(customStart));
        const end = endOfDay(new Date(customEnd));
        return {
            startDate: start,
            endDate: end,
            periodLabel: `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`
        };
    }, [rangeOption, customStart, customEnd]);

    const {
        revenue,
        orderCount,
        avgOrderValue,
        collections,
        outstanding,
        collectionRate,
        totalExpenses,
        expensesByCategory,
        salariesPaid,
        profit,
        profitMargin,
        orderStats,
        staffMetrics,
        customerStats,
        loading,
        error,
    } = useFinancialReports(startDate, endDate);

    const showLoading = useMinLoading(loading, { minDuration: 1000 });
    const [generatingPDF, setGeneratingPDF] = useState(false);

    const handleDownloadPDF = async () => {
        setGeneratingPDF(true);
        try {
            await generateReportsPDF({
                periodLabel,
                revenue,
                orderCount,
                avgOrderValue,
                collections,
                outstanding,
                collectionRate,
                totalExpenses,
                expensesByCategory,
                salariesPaid,
                profit,
                profitMargin,
                orderStats,
                staffMetrics,
                customerStats: customerStats ? {
                    totalCustomers: customerStats.totalCustomers,
                    newCustomers: customerStats.newCustomers
                } : undefined
            });
        } catch (err) {
            console.error("Failed to generate PDF:", err);
            alert("Failed to generate PDF. Please try again.");
        } finally {
            setGeneratingPDF(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (showLoading) {
        return (
            <div className="h-full">
                <LPageLoader variant="cash" message={t('reports.generating')} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full flex items-center justify-center p-4">
                <LEmptyState
                    icon={<FileDown className="h-8 w-8" />}
                    title={t('reports.errorLoading')}
                    description={error}
                />
            </div>
        );
    }

    const sortedExpenses = Object.entries(expensesByCategory)
        .filter(([_, amount]) => amount > 0)
        .sort((a, b) => b[1] - a[1]);

    const ongoingOrders = orderStats.total - orderStats.delivered - orderStats.cancelled;

    return (
        <div className="h-full overflow-y-auto bg-muted/20">
            {/* Toolbar – compact on mobile, no overflow */}
            <div className="bg-background border-b border-border sticky top-0 z-10 px-3 sm:px-4 py-3">
                <div className="max-w-[210mm] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 min-w-0">
                    <h1 className="text-lg font-bold flex items-center gap-2">
                        <FileDown className="h-5 w-5 text-primary" />
                        {t('reports.title')}
                    </h1>

                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                        {/* Quick Selectors */}
                        <div className="flex bg-muted rounded p-1">
                            <button
                                onClick={() => setRangeOption("thisMonth")}
                                className={cn(
                                    "px-3 py-1 text-xs font-medium rounded transition-colors",
                                    rangeOption === "thisMonth" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {t('reports.thisMonth')}
                            </button>
                            <button
                                onClick={() => setRangeOption("lastMonth")}
                                className={cn(
                                    "px-3 py-1 text-xs font-medium rounded transition-colors",
                                    rangeOption === "lastMonth" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {t('reports.lastMonth')}
                            </button>
                            <button
                                onClick={() => setRangeOption("custom")}
                                className={cn(
                                    "px-3 py-1 text-xs font-medium rounded transition-colors",
                                    rangeOption === "custom" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Custom
                            </button>
                        </div>

                        {/* Custom Date Inputs */}
                        {rangeOption === "custom" && (
                            <div className="flex items-center gap-1 sm:gap-2 bg-background border border-border rounded px-2 py-1 text-xs sm:text-sm min-w-0">
                                <input
                                    type="date"
                                    value={customStart}
                                    onChange={(e) => setCustomStart(e.target.value)}
                                    className="outline-none bg-transparent w-28 sm:w-32 min-w-0"
                                />
                                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                <input
                                    type="date"
                                    value={customEnd}
                                    onChange={(e) => setCustomEnd(e.target.value)}
                                    min={customStart}
                                    className="outline-none bg-transparent w-28 sm:w-32 min-w-0"
                                />
                            </div>
                        )}

                        <div className="w-px h-6 bg-border mx-1" />

                        <LButton
                            variant="ghost"
                            size="sm"
                            onClick={handlePrint}
                            title="Print"
                        >
                            <Printer className="h-4 w-4" />
                        </LButton>

                        <LButton
                            variant="outline"
                            size="sm"
                            leftIcon={<Download className="h-3 w-3" />}
                            onClick={handleDownloadPDF}
                            loading={generatingPDF}
                        >
                            PDF
                        </LButton>
                    </div>
                </div>
            </div>

            {/* A4 Report Page – compact on mobile, full on desktop */}
            <div className="p-3 sm:p-4 md:p-8 flex justify-center print:p-0">
                <div id="printable-content" className="bg-background shadow-lg print:shadow-none w-full max-w-[210mm] min-w-0 min-h-[297mm] p-4 sm:p-6 md:p-12 text-sm text-foreground space-y-6 md:space-y-8">

                    {/* Report Header – stacks on mobile */}
                    <div className="border-b-2 border-primary/20 pb-4 md:pb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
                        <div className="space-y-1 min-w-0">
                            <h2 className="text-xl sm:text-2xl font-bold text-primary truncate">{t('reports.financialReport')}</h2>
                            <p className="text-xs sm:text-sm text-muted-foreground">{t('reports.generatedOn')} {format(new Date(), "MMM d, yyyy")}</p>
                        </div>
                        <div className="text-left sm:text-right shrink-0">
                            <p className="font-semibold text-base sm:text-lg truncate">{periodLabel}</p>
                            <p className="text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider">{t('reports.statementPeriod')}</p>
                        </div>
                    </div>

                    {/* KPI Grid – 2x2 on mobile, 4 cols on desktop */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                        <div className="space-y-0.5 min-w-0">
                            <p className="text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider truncate">{t('reports.totalRevenue')}</p>
                            <p className="text-lg sm:text-2xl font-bold truncate"><LAmount value={revenue} /></p>
                        </div>
                        <div className="space-y-0.5 min-w-0">
                            <p className="text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider truncate">{t('reports.totalExpenses')}</p>
                            <p className="text-lg sm:text-2xl font-bold text-destructive truncate"><LAmount value={totalExpenses} /></p>
                        </div>
                        <div className="space-y-0.5 min-w-0">
                            <p className="text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider truncate">{profit >= 0 ? t('reports.netProfit') : t('reports.netLoss')}</p>
                            <p className={cn("text-lg sm:text-2xl font-bold truncate", profit >= 0 ? "text-success" : "text-destructive")}>
                                <LAmount value={profit} />
                            </p>
                        </div>
                        <div className="space-y-0.5 text-right min-w-0">
                            <p className="text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider truncate">{t('reports.profitMargin')}</p>
                            <p className={cn("text-lg sm:text-2xl font-bold", profit >= 0 ? "text-success" : "text-destructive")}>
                                {profitMargin.toFixed(1)}%
                            </p>
                        </div>
                    </div>

                    <LDivider />

                    {/* Operational Metrics – stack on mobile */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
                        {/* Order Statistics */}
                        <div className="space-y-4 min-w-0">
                            <h3 className="font-semibold text-base sm:text-lg border-b border-border pb-2 truncate">{t('reports.operationalMetrics')}</h3>

                            <div className="space-y-3 min-w-0">
                                <div className="flex justify-between items-center gap-2 min-w-0">
                                    <span className="text-muted-foreground truncate text-xs sm:text-sm">{t('reports.totalOrders')}</span>
                                    <span className="font-medium shrink-0">{orderCount}</span>
                                </div>
                                <div className="flex justify-between items-center gap-2 min-w-0">
                                    <span className="text-muted-foreground truncate text-xs sm:text-sm">{t('reports.averageOrderValue')}</span>
                                    <span className="font-medium shrink-0 tabular-nums"><LAmount value={avgOrderValue} size="sm" /></span>
                                </div>
                                <div className="flex justify-between items-center gap-2 min-w-0">
                                    <span className="text-muted-foreground truncate text-xs sm:text-sm">{t('reports.ongoing')}</span>
                                    <span className="font-medium shrink-0">{ongoingOrders}</span>
                                </div>
                                <div className="flex justify-between items-center gap-2 min-w-0">
                                    <span className="text-muted-foreground truncate text-xs sm:text-sm">{t('reports.delivered')}</span>
                                    <span className="font-medium shrink-0">{orderStats.delivered}</span>
                                </div>
                                <div className="flex justify-between items-center gap-2 min-w-0">
                                    <span className="text-muted-foreground truncate text-xs sm:text-sm">{t('reports.cancelled')}</span>
                                    <span className="font-medium shrink-0">{orderStats.cancelled}</span>
                                </div>
                            </div>
                        </div>

                        {/* Order Sources */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg border-b border-border pb-2">{t('reports.orderSources')}</h3>

                            <div className="space-y-3 min-w-0">
                                <div className="flex justify-between items-center gap-2 min-w-0">
                                    <span className="text-muted-foreground truncate text-xs sm:text-sm">{t('reports.storeWalkIn')}</span>
                                    <div className="flex items-center gap-2 w-20 sm:w-32 shrink-0">
                                        <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden min-w-0">
                                            <div className="h-full bg-primary" style={{ width: `${orderStats.total ? (orderStats.pickupStore / orderStats.total) * 100 : 0}%` }} />
                                        </div>
                                        <span className="font-medium w-6 sm:w-8 text-right text-xs sm:text-sm">{orderStats.pickupStore}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center gap-2 min-w-0">
                                    <span className="text-muted-foreground truncate text-xs sm:text-sm">{t('reports.standardDelivery')}</span>
                                    <div className="flex items-center gap-2 w-20 sm:w-32 shrink-0">
                                        <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden min-w-0">
                                            <div className="h-full bg-primary" style={{ width: `${orderStats.total ? (orderStats.deliveryHome / orderStats.total) * 100 : 0}%` }} />
                                        </div>
                                        <span className="font-medium w-6 sm:w-8 text-right text-xs sm:text-sm">{orderStats.deliveryHome}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center gap-2 min-w-0">
                                    <span className="text-muted-foreground truncate text-xs sm:text-sm">{t('reports.pickupDelivery')}</span>
                                    <div className="flex items-center gap-2 w-20 sm:w-32 shrink-0">
                                        <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden min-w-0">
                                            <div className="h-full bg-primary" style={{ width: `${orderStats.total ? (orderStats.pickupHome / orderStats.total) * 100 : 0}%` }} />
                                        </div>
                                        <span className="font-medium w-6 sm:w-8 text-right text-xs sm:text-sm">{orderStats.pickupHome}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="h-4" />

                    {/* Staff & Customer Metrics – stack on mobile */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
                        {/* Staff Performance */}
                        <div className="space-y-4 min-w-0 overflow-hidden">
                            <h3 className="font-semibold text-base sm:text-lg border-b border-border pb-2 truncate">{t('reports.staffPerformance')}</h3>
                            {staffMetrics && staffMetrics.length > 0 ? (
                                <div className="overflow-x-auto -mx-1 px-1">
                                <table className="w-full text-xs sm:text-sm min-w-[200px]">
                                    <thead>
                                        <tr className="text-left text-muted-foreground border-b border-border/50">
                                            <th className="pb-2 font-medium">{t('reports.staffName')}</th>
                                            <th className="pb-2 font-medium text-right">{t('reports.daysPresent')}</th>
                                            <th className="pb-2 font-medium text-right">{t('reports.salaryPaid')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {staffMetrics.map(m => (
                                            <tr key={m.staffId} className="border-b border-border/50 last:border-0">
                                                <td className="py-2 font-medium">{m.staffName}</td>
                                                <td className="py-2 text-right">{m.presentDays} {t('staff.day', 'days')}</td>
                                                <td className="py-2 text-right"><LAmount value={m.salaryPaid} size="sm" /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                            ) : (
                                <p className="text-muted-foreground italic py-2 text-xs sm:text-sm">{t('reports.noPayrollData')}</p>
                            )}
                        </div>

                        {/* Customer Growth */}
                        <div className="space-y-4 min-w-0">
                            <h3 className="font-semibold text-base sm:text-lg border-b border-border pb-2 truncate">{t('reports.customerGrowth')}</h3>

                            {customerStats && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-primary/5 rounded border border-primary/10 text-center">
                                            <p className="text-3xl font-bold text-primary">{customerStats.newCustomers}</p>
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{t('reports.newCustomers')}</p>
                                        </div>
                                        <div className="p-4 bg-muted/30 rounded border border-border text-center">
                                            <p className="text-3xl font-bold text-foreground">{customerStats.totalCustomers}</p>
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{t('reports.totalDatabase')}</p>
                                        </div>
                                    </div>

                                    <div className="mt-4 space-y-2">
                                        <p className="text-sm text-muted-foreground">
                                            <span className="font-medium text-foreground">{customerStats.newCustomers}</span> {t('reports.newCustomersAdded')}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Detailed Financials – stack on mobile */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
                        {/* Summary Table */}
                        <div className="space-y-4 min-w-0">
                            <h3 className="font-semibold text-base sm:text-lg border-b border-border pb-2 truncate">{t('reports.financialSummary')}</h3>
                            <div className="space-y-0 text-sm min-w-0">
                                <div className="flex justify-between items-center gap-2 py-2 border-b border-border/50 min-w-0">
                                    <span className="truncate">{t('reports.totalBilled')}</span>
                                    <span className="font-medium shrink-0 tabular-nums"><LAmount value={revenue} size="sm" /></span>
                                </div>
                                <div className="flex justify-between items-center gap-2 py-2 border-b border-border/50 bg-green-50/50 -mx-2 px-2 min-w-0">
                                    <span className="text-success truncate">{t('reports.collections')} ({t('reports.collected')})</span>
                                    <span className="font-medium text-success shrink-0 tabular-nums"><LAmount value={collections} size="sm" /></span>
                                </div>
                                <div className="flex justify-between items-center gap-2 py-2 border-b border-border/50 min-w-0">
                                    <span className="text-destructive truncate">{t('reports.outstanding')} ({t('reports.unpaid')})</span>
                                    <span className="font-medium text-destructive shrink-0 tabular-nums"><LAmount value={outstanding} size="sm" /></span>
                                </div>
                                <div className="flex justify-between items-center gap-2 py-2 pt-4 min-w-0">
                                    <span className="font-bold truncate">{t('reports.netProfit')}</span>
                                    <span className="font-bold underline decoration-2 decoration-primary shrink-0 tabular-nums"><LAmount value={profit} size="sm" /></span>
                                </div>
                            </div>
                        </div>

                        {/* Expense Breakdown */}
                        <div className="space-y-4 min-w-0">
                            <h3 className="font-semibold text-base sm:text-lg border-b border-border pb-2 truncate">{t('reports.expenseBreakdown')}</h3>

                            {sortedExpenses.length > 0 ? (
                                <div className="space-y-2">
                                    {sortedExpenses.slice(0, 8).map(([category, amount]) => {
                                        const percentage = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
                                        const label = getCategoryLabel(category);
                                        return (
                                            <div key={category} className="flex justify-between items-center gap-2 text-sm py-1 min-w-0">
                                                <span className="text-muted-foreground truncate min-w-0 flex-1" title={label}>
                                                    {label}
                                                </span>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-xs text-muted-foreground w-8 text-right">{percentage.toFixed(0)}%</span>
                                                    <span className="font-medium tabular-nums"><LAmount value={amount} size="sm" /></span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {sortedExpenses.length > 8 && (
                                        <p className="text-xs text-muted-foreground italic text-right pt-2">
                                            + {sortedExpenses.length - 8} more categories
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-muted-foreground italic py-4">{t('reports.noExpenses')}</p>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-auto border-t-2 border-primary/20 pt-4 text-center text-xs text-muted-foreground">
                        <p>Generated by LaundryBill • {format(new Date(), "yyyy-MM-dd HH:mm")}</p>
                    </div>

                </div>
            </div>
        </div>
    );
}

