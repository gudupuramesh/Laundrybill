/**
 * Payroll Page
 * 
 * Monthly payroll summary and payment tracking
 */

import { useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import {
    LButton,
    LCard,
    LList,
    LListItem,
    LAvatar,
    LAmount,
    LBadge,
    LEmptyState,
    LSpinner,
} from "@/components/laundry";
import { usePayroll, usePayrollMutations } from "@/hooks/use-staff";
import { format, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Wallet, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export function PayrollPage() {
    const { t } = useTranslation();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const monthString = format(currentMonth, "yyyy-MM");

    const { payroll, loading: payrollLoading } = usePayroll(monthString);
    const { markAsPaid } = usePayrollMutations();

    const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    const handleMarkPaid = async (payrollId: string) => {
        await markAsPaid(payrollId);
    };

    // Calculate totals
    const totalPayroll = payroll.reduce((sum, p) => sum + p.netSalary, 0);
    const totalPaid = payroll.filter(p => p.status === "paid").reduce((sum, p) => sum + p.netSalary, 0);
    const totalPending = totalPayroll - totalPaid;

    if (payrollLoading) {
        return (
            <PageWrapper className="flex items-center justify-center min-h-[50vh]">
                <LSpinner size="lg" />
            </PageWrapper>
        );
    }

    return (
        <PageWrapper>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold text-foreground">{t('staff.payroll')}</h1>
            </div>

            {/* Month Selector */}
            <div className="flex items-center justify-center gap-4 mb-6">
                <LButton variant="ghost" size="icon-sm" onClick={handlePrevMonth}>
                    <ChevronLeft className="h-5 w-5" />
                </LButton>
                <span className="text-lg font-semibold text-foreground min-w-[150px] text-center">
                    {format(currentMonth, "MMMM yyyy")}
                </span>
                <LButton variant="ghost" size="icon-sm" onClick={handleNextMonth}>
                    <ChevronRight className="h-5 w-5" />
                </LButton>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <LCard variant="filled" padding="md" className="text-center">
                    <LAmount value={totalPayroll} size="lg" className="font-bold" />
                    <p className="text-xs text-muted-foreground">{t('staff.totalPayroll')}</p>
                </LCard>
                <LCard variant="filled" padding="md" className="text-center bg-success-muted">
                    <LAmount value={totalPaid} size="lg" className="font-bold text-success" />
                    <p className="text-xs text-muted-foreground">{t('staff.paid')}</p>
                </LCard>
                <LCard variant="filled" padding="md" className="text-center bg-warning-muted">
                    <LAmount value={totalPending} size="lg" className="font-bold text-warning" />
                    <p className="text-xs text-muted-foreground">{t('staff.pending')}</p>
                </LCard>
            </div>

            {/* Payroll List */}
            {payroll.length === 0 ? (
                <LEmptyState
                    icon={<Wallet className="h-8 w-8" />}
                    title={t('staff.noPayroll')}
                    description={t('staff.noPayrollDesc')}
                />
            ) : (
                <LList>
                    {payroll.map((entry) => (
                        <LListItem
                            key={entry.id}
                            title={entry.staffName}
                            subtitle={`${entry.daysWorked} ${t('staff.daysWorked')}`}
                            leftContent={<LAvatar name={entry.staffName} size="md" />}
                            rightContent={
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <LAmount value={entry.netSalary} size="md" />
                                        <LBadge
                                            variant={entry.status === "paid" ? "success" : "warning"}
                                            size="sm"
                                            className="mt-1"
                                        >
                                            {entry.status === "paid" ? t('staff.paid') : t('staff.pending')}
                                        </LBadge>
                                    </div>
                                    {entry.status !== "paid" && (
                                        <LButton
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleMarkPaid(entry.id);
                                            }}
                                        >
                                            <CheckCircle2 className="h-5 w-5 text-success" />
                                        </LButton>
                                    )}
                                </div>
                            }
                        />
                    ))}
                </LList>
            )}
        </PageWrapper>
    );
}
