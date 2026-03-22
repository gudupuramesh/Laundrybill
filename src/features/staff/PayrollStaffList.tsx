/**
 * Payroll Staff List
 * 
 * Staff list panel for payroll master-detail layout
 */

import { useState } from "react";
import {
    LSearchInput,
    LList,
    LListItem,
    LAvatar,
    LBadge,
    LAmount,
    LEmptyState,
    LSkeletonList,
    LButton,
    LAdSlot,
    LHelpButton,
} from "@/components/laundry";
import { useStaff, usePayroll } from "@/hooks/use-staff";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, addMonths, subMonths } from "date-fns";
import { Users, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const AD_FREQUENCY = 6;

interface PayrollStaffListProps {
    selectedId?: string | null;
    onSelect?: (staffId: string) => void;
}

export function PayrollStaffList({ selectedId, onSelect }: PayrollStaffListProps) {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const [searchQuery, setSearchQuery] = useState("");
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const monthString = format(currentMonth, "yyyy-MM");

    const { activeStaff, loading: staffLoading } = useStaff();
    const { payroll, loading: payrollLoading } = usePayroll(monthString);

    const filteredStaff = activeStaff.filter((staff) =>
        staff.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    const getPayrollForStaff = (staffId: string) =>
        payroll.find((p) => p.staffId === staffId);

    // Calculate totals
    const totalPayroll = payroll.reduce((sum, p) => sum + p.netSalary, 0);
    const totalPaid = payroll.filter(p => p.status === "paid").reduce((sum, p) => sum + p.netSalary, 0);
    const totalPending = totalPayroll - totalPaid;

    const loading = staffLoading || payrollLoading;

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-card p-4 space-y-3 border-b border-border">
                <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold text-foreground">{t('staff.payroll')}</h1>
                    <LHelpButton size="icon" />
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

                {/* Summary */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-muted rounded-lg p-2">
                        <LAmount value={totalPayroll} size="sm" className="font-bold" />
                        <p className="text-muted-foreground">{t('staff.totalPayroll')}</p>
                    </div>
                    <div className="bg-success-muted rounded-lg p-2">
                        <LAmount value={totalPaid} size="sm" className="font-bold text-success" />
                        <p className="text-muted-foreground">{t('staff.paid')}</p>
                    </div>
                    <div className="bg-warning-muted rounded-lg p-2">
                        <LAmount value={totalPending} size="sm" className="font-bold text-warning" />
                        <p className="text-muted-foreground">{t('staff.pending')}</p>
                    </div>
                </div>

                {/* Search */}
                <LSearchInput
                    placeholder={t('common.search')}
                    onChange={setSearchQuery}
                />
            </div>

            {/* Staff List */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <LSkeletonList count={6} />
                ) : filteredStaff.length === 0 ? (
                    <LEmptyState
                        icon={<Users className="h-8 w-8" />}
                        title={t('staff.noStaff')}
                        description={t('staff.addStaffFirst')}
                    />
                ) : (
                    <LList>
                        {filteredStaff.map((staff, index) => {
                            const entry = getPayrollForStaff(staff.id);
                            return (
                                <div key={staff.id}>
                                    <LListItem
                                        title={staff.name}
                                        subtitle={entry ? `${entry.daysWorked} ${t('staff.daysWorked')}` : "-"}
                                        leftContent={<LAvatar name={staff.name} size="md" />}
                                        rightContent={
                                            <div className="text-right">
                                                {entry ? (
                                                    <>
                                                        <LAmount value={entry.netSalary} size="sm" />
                                                        <LBadge
                                                            variant={entry.status === "paid" ? "success" : "warning"}
                                                            size="sm"
                                                            className="mt-1"
                                                        >
                                                            {entry.status === "paid" ? t('staff.paid') : t('staff.pending')}
                                                        </LBadge>
                                                    </>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">-</span>
                                                )}
                                            </div>
                                        }
                                        onClick={() => onSelect?.(staff.id)}
                                        className={cn(
                                            "cursor-pointer transition-colors",
                                            selectedId === staff.id &&
                                            "bg-primary-muted border-l-4 border-l-primary"
                                        )}
                                    />
                                    {isMobile && (index + 1) % AD_FREQUENCY === 0 && (
                                        <LAdSlot variant="card" position={`payroll-list-${index + 1}`} />
                                    )}
                                </div>
                            );
                        })}
                    </LList>
                )}
            </div>
        </div>
    );
}
