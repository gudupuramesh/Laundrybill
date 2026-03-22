/**
 * Expenses Page (Master-Detail Layout)
 * 
 * Desktop: Expense list + selected expense detail
 */

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LMasterDetailLayout } from "@/components/layout/LMasterDetailLayout";
import { LPageLoader } from "@/components/laundry";
import { useIsMobile } from "@/hooks/use-mobile";
import { useExpenses } from "@/hooks/use-finance";
import { useMinLoading } from "@/hooks/use-min-loading";
import { useTranslation } from "react-i18next";
import { ExpensesList } from "./ExpensesList";
import { ExpenseDetailPanel } from "./ExpenseDetailPanel";

export function ExpensesPageMasterDetail() {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const location = useLocation();
    const navigate = useNavigate();

    // Determine base path for navigation
    const isStaff = location.pathname.startsWith('/staff');
    const basePath = isStaff ? '/staff/expenses' : '/expenses';

    const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const { loading } = useExpenses(currentMonth);

    // Use minimum loading duration to show animation properly
    const showLoading = useMinLoading(loading, { minDuration: 700 });

    const handleExpenseSelect = (id: string) => {
        if (isMobile) {
            navigate(`${basePath}/${id}`);
        } else {
            setSelectedExpenseId(id);
        }
    };

    // Show page loader while initial data loads
    if (showLoading) {
        return (
            <div className="h-full">
                <LPageLoader variant="cash" message={t('expenses.loading')} />
            </div>
        );
    }

    return (
        <LMasterDetailLayout
            listPanel={
                <ExpensesList
                    selectedId={selectedExpenseId}
                    onSelect={handleExpenseSelect}
                    currentMonth={currentMonth}
                    onMonthChange={setCurrentMonth}
                />
            }
            detailPanel={
                selectedExpenseId && (
                    <ExpenseDetailPanel
                        expenseId={selectedExpenseId}
                        currentMonth={currentMonth}
                        onClose={() => setSelectedExpenseId(null)}
                    />
                )
            }
            selectedId={selectedExpenseId}
            adPosition="expenses-sidebar"
        />
    );
}
