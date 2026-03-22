/**
 * Payroll Detail Panel
 * 
 * Payroll breakdown with payment history and PDF generation
 */

import { useState, useMemo } from "react";
import {
    LCard,
    LButton,
    LAvatar,
    LAmount,
    LBadge,
    LSpinner,
} from "@/components/laundry";
import { useStaff, usePayroll, usePayrollMutations, useAttendance } from "@/hooks/use-staff";
import { PaymentSheet } from "./PaymentSheet";
import { PayrollEditSheet } from "./PayrollEditSheet";
import { FullSettlementSheet } from "./FullSettlementSheet";
import type { PaymentMode } from "@/types/staff";
import { format, addMonths, subMonths } from "date-fns";
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Wallet,
    Calendar,
    CheckCircle2,
    TrendingUp,
    TrendingDown,
    RefreshCw,
    Plus,
    FileText,
    Clock,
    Banknote,
    CreditCard,
    Smartphone,
    Pencil,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { generatePayslipPDF } from "@/lib/pdf-generator";
import { useCurrency } from "@/hooks/use-currency";

interface PayrollDetailPanelProps {
    staffId: string;
    onClose?: () => void;
}

const statusConfig = {
    draft: { label: "payroll.draft", variant: "secondary" as const, color: "text-muted-foreground" },
    partial: { label: "payroll.partial", variant: "warning" as const, color: "text-warning" },
    paid: { label: "payroll.paid", variant: "success" as const, color: "text-success" },
    settlement: { label: "payroll.settlement", variant: "default" as const, color: "text-primary" },
};

const paymentModeIcons = {
    cash: <Banknote className="h-4 w-4" />,
    bank: <CreditCard className="h-4 w-4" />,
    upi: <Smartphone className="h-4 w-4" />,
};

export function PayrollDetailPanel({ staffId, onClose }: PayrollDetailPanelProps) {
    const { t } = useTranslation();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const monthString = format(currentMonth, "yyyy-MM");
    const [generating, setGenerating] = useState(false);
    const [recalculating, setRecalculating] = useState(false);
    const [downloadingPDF, setDownloadingPDF] = useState(false);
    const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
    const [editSheetOpen, setEditSheetOpen] = useState(false);
    const { currencySymbol } = useCurrency();
    const [settlementSheetOpen, setSettlementSheetOpen] = useState(false);

    const { staff: staffList, loading: staffLoading } = useStaff();
    const { payroll, loading: payrollLoading } = usePayroll(monthString);
    const { generatePayroll, recalculatePayroll, addPayment } = usePayrollMutations();
    const { attendance, getStaffSummary } = useAttendance(currentMonth);

    const staff = useMemo(() =>
        staffList.find((s) => s.id === staffId),
        [staffList, staffId]
    );

    const staffPayroll = useMemo(() =>
        payroll.find((p) => p.staffId === staffId),
        [payroll, staffId]
    );

    const attendanceSummary = useMemo(() =>
        getStaffSummary(staffId),
        [getStaffSummary, staffId]
    );

    const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    // Calculate payroll data from attendance
    const calculatePayrollData = () => {
        if (!staff) return null;

        const staffAttendance = attendance.filter((a) => a.staffId === staffId);
        const presentDays = staffAttendance.filter((a) => a.status === "present").length;
        const absentDays = staffAttendance.filter((a) => a.status === "absent").length;
        const halfDays = staffAttendance.filter((a) => a.status === "half").length;
        const leaveDays = staffAttendance.filter((a) => a.status === "leave").length;
        const effectiveDays = presentDays + halfDays * 0.5;

        const WORKING_DAYS_PER_MONTH = 26;
        let baseSalary = 0;
        if (staff.payType === "monthly") {
            baseSalary = (staff.baseSalary / WORKING_DAYS_PER_MONTH) * effectiveDays;
        } else {
            baseSalary = staff.baseSalary * effectiveDays;
        }

        const overtimeHours = staffAttendance.reduce((sum, a) => sum + (a.overtime || 0), 0);

        // Calculate overtime amount
        let overtimeAmount = 0;
        if (overtimeHours > 0) {
            if (staff.overtimeRate && staff.overtimeRate > 0) {
                // Use custom overtime rate per hour
                overtimeAmount = overtimeHours * staff.overtimeRate;
            } else {
                // Auto-calculate: 1.5× hourly rate
                const hourlyRate = staff.payType === "monthly"
                    ? staff.baseSalary / WORKING_DAYS_PER_MONTH / 8
                    : staff.baseSalary / 8;
                overtimeAmount = overtimeHours * hourlyRate * 1.5;
            }
        }

        const totalEarnings = baseSalary + overtimeAmount;
        const totalDeductions = 0;
        const netSalary = totalEarnings - totalDeductions;

        return {
            daysPresent: presentDays,
            daysAbsent: absentDays,
            daysHalf: halfDays,
            daysLeave: leaveDays,
            daysWorked: Math.round(effectiveDays * 10) / 10,
            baseSalary: Math.round(baseSalary),
            overtimeHours,
            overtimeAmount: Math.round(overtimeAmount),
            bonus: 0,
            deductions: 0,
            advances: 0,
            totalEarnings: Math.round(totalEarnings),
            totalDeductions,
            netSalary: Math.round(netSalary),
        };
    };

    const handleGeneratePayroll = async () => {
        if (!staff) return;

        setGenerating(true);
        try {
            const data = calculatePayrollData();
            if (data) {
                await generatePayroll(staff.id, staff.name, monthString, data);
            }
        } catch (error) {
            console.error("Failed to generate payroll:", error);
            alert("Failed to generate payroll. Please try again.");
        } finally {
            setGenerating(false);
        }
    };

    const handleRecalculate = async () => {
        if (!staffPayroll || !staff) return;

        setRecalculating(true);
        try {
            const data = calculatePayrollData();
            if (data) {
                await recalculatePayroll(staffPayroll.id, data);
            }
        } catch (error: any) {
            console.error("Failed to recalculate:", error);
            alert(error.message || "Failed to recalculate. Please try again.");
        } finally {
            setRecalculating(false);
        }
    };

    const handleAddPayment = async (amount: number, mode: PaymentMode, note?: string) => {
        if (!staffPayroll) return;
        await addPayment(staffPayroll.id, amount, mode, note);
    };

    const handleOpenSettlement = () => {
        setSettlementSheetOpen(true);
    };

    const handleDownloadPDF = async () => {
        if (!staff || !staffPayroll) return;

        setDownloadingPDF(true);
        try {
            await generatePayslipPDF(staff, staffPayroll, monthString, currencySymbol);
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            alert("Failed to generate PDF. Please try again.");
        } finally {
            setDownloadingPDF(false);
        }
    };

    const loading = staffLoading || payrollLoading;
    const remainingAmount = staffPayroll?.remainingAmount ?? staffPayroll?.netSalary ?? 0;
    const canRecalculate = staffPayroll?.status === "draft" || staffPayroll?.status === "partial";
    const canAddPayment = staffPayroll && staffPayroll.status !== "paid";

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <LSpinner size="lg" />
            </div>
        );
    }

    if (!staff) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <p className="text-lg font-medium">{t('staff.notFound')}</p>
                <LButton variant="ghost" className="mt-4" onClick={onClose}>
                    {t('common.goBack')}
                </LButton>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
                <div className="flex items-center gap-4">
                    {onClose && (
                        <LButton variant="ghost" size="icon-sm" onClick={onClose}>
                            <ArrowLeft className="h-5 w-5" />
                        </LButton>
                    )}
                    <LAvatar name={staff.name} size="lg" />
                    <div>
                        <h1 className="text-xl font-bold text-foreground">{staff.name}</h1>
                        <p className="text-sm text-muted-foreground capitalize">
                            {staff.payType} • <LAmount value={staff.baseSalary} size="sm" />
                            /{staff.payType === "monthly" ? t('staff.month') : t('staff.day')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
                {/* Month Selector */}
                <div className="flex items-center justify-center gap-4">
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

                {staffPayroll ? (
                    <>
                        {/* Net Salary Card */}
                        <LCard variant="filled" padding="lg" className="text-center bg-primary-muted">
                            <p className="text-sm text-muted-foreground mb-1">{t('staff.payroll')}</p>
                            <LAmount value={staffPayroll.netSalary} size="xl" className="text-primary" />
                            <LBadge
                                variant={statusConfig[staffPayroll.status]?.variant || "secondary"}
                                size="md"
                                className="mt-2"
                            >
                                {statusConfig[staffPayroll.status]?.label || staffPayroll.status}
                            </LBadge>

                            {/* Overtime Summary */}
                            {staffPayroll.overtimeHours > 0 && (
                                <div className="mt-3 pt-3 border-t border-primary/20">
                                    <div className="flex items-center justify-center gap-2 text-sm">
                                        <Clock className="h-4 w-4 text-warning" />
                                        <span className="text-muted-foreground">Extra Work:</span>
                                        <span className="font-semibold text-warning">{staffPayroll.overtimeHours}h</span>
                                        <span className="text-muted-foreground">=</span>
                                        <LAmount value={staffPayroll.overtimeAmount} size="sm" className="text-success font-semibold" />
                                    </div>
                                </div>
                            )}

                            {/* Payment Progress */}
                            {staffPayroll.status !== "paid" && staffPayroll.totalPaid > 0 && (
                                <div className="mt-3 text-sm">
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Paid: <LAmount value={staffPayroll.totalPaid} size="sm" className="text-success" /></span>
                                        <span>
                                            {remainingAmount >= 0 ? (
                                                <>Remaining: <LAmount value={remainingAmount} size="sm" className="text-warning" /></>
                                            ) : (
                                                <>Advance: <LAmount value={Math.abs(remainingAmount)} size="sm" className="text-success" /></>
                                            )}
                                        </span>
                                    </div>
                                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-success transition-all"
                                            style={{ width: `${Math.min(100, (staffPayroll.totalPaid / staffPayroll.netSalary) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </LCard>

                        {/* Action Buttons Row (Recalculate + Edit) */}
                        {(canRecalculate || staffPayroll.status !== "paid") && (
                            <div className="flex gap-2">
                                {canRecalculate && (
                                    <LButton
                                        variant="outline"
                                        size="md"
                                        className="flex-1"
                                        leftIcon={<RefreshCw className={`h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} />}
                                        onClick={handleRecalculate}
                                        loading={recalculating}
                                    >
                                        {t('payroll.recalculate')}
                                    </LButton>
                                )}
                                {staffPayroll.status !== "paid" && (
                                    <LButton
                                        variant="outline"
                                        size="md"
                                        className="flex-1"
                                        leftIcon={<Pencil className="h-4 w-4" />}
                                        onClick={() => setEditSheetOpen(true)}
                                    >
                                        {t('payroll.editAmounts')}
                                    </LButton>
                                )}
                            </div>
                        )}

                        {/* Attendance Summary */}
                        <LCard variant="outlined" padding="md">
                            <div className="flex items-center gap-2 mb-3">
                                <Calendar className="h-5 w-5 text-muted-foreground" />
                                <h3 className="font-semibold text-foreground">{t('staff.attendance')}</h3>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center text-sm">
                                <div>
                                    <p className="font-bold text-success">{staffPayroll.daysPresent ?? attendanceSummary.present}</p>
                                    <p className="text-xs text-muted-foreground">{t('staff.present')}</p>
                                </div>
                                <div>
                                    <p className="font-bold text-destructive">{staffPayroll.daysAbsent ?? attendanceSummary.absent}</p>
                                    <p className="text-xs text-muted-foreground">{t('staff.absent')}</p>
                                </div>
                                <div>
                                    <p className="font-bold text-warning">{staffPayroll.daysHalf ?? attendanceSummary.half}</p>
                                    <p className="text-xs text-muted-foreground">{t('staff.halfDay')}</p>
                                </div>
                                <div>
                                    <p className="font-bold text-primary">{staffPayroll.daysLeave ?? attendanceSummary.leave}</p>
                                    <p className="text-xs text-muted-foreground">{t('staff.leave')}</p>
                                </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-border">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">{t('payroll.effectiveDays')}:</span>
                                    <span className="font-semibold">{staffPayroll.daysWorked ?? 0}</span>
                                </div>
                                {staffPayroll.overtimeHours > 0 && (
                                    <div className="flex justify-between items-center text-sm mt-1">
                                        <span className="text-muted-foreground">{t('payroll.overtimeHours')}:</span>
                                        <span className="font-semibold text-warning">{staffPayroll.overtimeHours}h</span>
                                    </div>
                                )}
                            </div>
                        </LCard>

                        {/* Earnings Breakdown */}
                        <LCard variant="outlined" padding="md">
                            <div className="flex items-center gap-2 mb-3">
                                <TrendingUp className="h-5 w-5 text-success" />
                                <h3 className="font-semibold text-foreground">{t('staff.earnings')}</h3>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">{t('staff.baseSalary')}</span>
                                    <LAmount value={staffPayroll.baseSalary} size="sm" />
                                </div>
                                {staffPayroll.overtimeAmount > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            {t('staff.overtimeAmount')} ({staffPayroll.overtimeHours}h)
                                        </span>
                                        <LAmount value={staffPayroll.overtimeAmount} size="sm" className="text-success" />
                                    </div>
                                )}
                                {staffPayroll.bonus > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('staff.bonus')}</span>
                                        <LAmount value={staffPayroll.bonus} size="sm" className="text-success" />
                                    </div>
                                )}
                                <div className="flex justify-between pt-2 border-t border-border font-semibold">
                                    <span>{t('staff.totalEarnings')}</span>
                                    <LAmount value={staffPayroll.totalEarnings} size="sm" />
                                </div>
                            </div>
                        </LCard>

                        {/* Deductions Breakdown */}
                        {staffPayroll.totalDeductions > 0 && (
                            <LCard variant="outlined" padding="md">
                                <div className="flex items-center gap-2 mb-3">
                                    <TrendingDown className="h-5 w-5 text-destructive" />
                                    <h3 className="font-semibold text-foreground">{t('staff.deductions')}</h3>
                                </div>
                                <div className="space-y-2 text-sm">
                                    {staffPayroll.advances > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">{t('staff.advances')}</span>
                                            <LAmount value={staffPayroll.advances} size="sm" className="text-destructive" />
                                        </div>
                                    )}
                                    {staffPayroll.deductions > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">{t('staff.otherDeductions')}</span>
                                            <LAmount value={staffPayroll.deductions} size="sm" className="text-destructive" />
                                        </div>
                                    )}
                                    <div className="flex justify-between pt-2 border-t border-border font-semibold">
                                        <span>{t('staff.totalDeductions')}</span>
                                        <LAmount value={staffPayroll.totalDeductions} size="sm" className="text-destructive" />
                                    </div>
                                </div>
                            </LCard>
                        )}

                        {/* Payment History */}
                        {staffPayroll.payments && staffPayroll.payments.length > 0 && (
                            <LCard variant="outlined" padding="md">
                                <div className="flex items-center gap-2 mb-3">
                                    <Clock className="h-5 w-5 text-muted-foreground" />
                                    <h3 className="font-semibold text-foreground">{t('payroll.paymentHistory')}</h3>
                                </div>
                                <div className="space-y-2">
                                    {staffPayroll.payments.map((payment, index) => (
                                        <div key={payment.id || index} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                                            <div className="flex items-center gap-2">
                                                {paymentModeIcons[payment.mode]}
                                                <div>
                                                    <p className="font-medium">
                                                        <LAmount value={payment.amount} size="sm" />
                                                        {payment.type === "advance" && (
                                                            <span className="ml-1.5 text-xs font-normal text-success">(Advance)</span>
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {payment.date?.toDate ? format(payment.date.toDate(), "dd MMM yyyy") : "—"}
                                                        {payment.note && ` • ${payment.note}`}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-xs text-muted-foreground capitalize">{payment.mode}</span>
                                        </div>
                                    ))}
                                </div>
                            </LCard>
                        )}

                        {/* Action Buttons */}
                        <div className="space-y-2">
                            {/* Add Payment Button */}
                            {canAddPayment && (
                                <LButton
                                    variant="primary"
                                    size="lg"
                                    fullWidth
                                    leftIcon={<Plus className="h-5 w-5" />}
                                    onClick={() => setPaymentSheetOpen(true)}
                                >
                                    Add Payment
                                </LButton>
                            )}

                            {/* Full Settlement - explicitly close payroll & enable payslip */}
                            {canAddPayment && (
                                <LButton
                                    variant="outline"
                                    size="lg"
                                    fullWidth
                                    leftIcon={<CheckCircle2 className="h-5 w-5" />}
                                    onClick={handleOpenSettlement}
                                >
                                    {t('payroll.fullSettlement')}
                                </LButton>
                            )}

                            {/* Download PDF */}
                            {staffPayroll.status === "paid" && (
                                <LButton
                                    variant="outline"
                                    size="lg"
                                    fullWidth
                                    leftIcon={<FileText className="h-5 w-5" />}
                                    onClick={handleDownloadPDF}
                                    loading={downloadingPDF}
                                >
                                    {t('payroll.downloadPayslip')}
                                </LButton>
                            )}
                        </div>
                    </>
                ) : (
                    <LCard variant="outlined" padding="lg" className="text-center">
                        <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                        <p className="text-muted-foreground mb-2">{t('staff.noPayrollForMonth')}</p>
                        <p className="text-sm text-muted-foreground mb-4">
                            Attendance: {attendanceSummary.present}P, {attendanceSummary.absent}A, {attendanceSummary.half}H, {attendanceSummary.leave}L
                        </p>
                        <LButton
                            variant="primary"
                            size="lg"
                            fullWidth
                            leftIcon={<Wallet className="h-5 w-5" />}
                            onClick={handleGeneratePayroll}
                            loading={generating}
                        >
                            {t('payroll.generatePayroll')}
                        </LButton>
                    </LCard>
                )}
            </div>

            {/* Payment Sheet */}
            <PaymentSheet
                open={paymentSheetOpen}
                onClose={() => setPaymentSheetOpen(false)}
                maxAmount={remainingAmount > 0 ? remainingAmount : 0}
                onSubmit={handleAddPayment}
            />

            {/* Full Settlement Sheet */}
            {staffPayroll && (
                <FullSettlementSheet
                    open={settlementSheetOpen}
                    onClose={() => setSettlementSheetOpen(false)}
                    payroll={staffPayroll}
                />
            )}

            {/* Payroll Edit Sheet */}
            {staffPayroll && (
                <PayrollEditSheet
                    open={editSheetOpen}
                    onClose={() => setEditSheetOpen(false)}
                    payroll={staffPayroll}
                />
            )}
        </div>
    );
}
