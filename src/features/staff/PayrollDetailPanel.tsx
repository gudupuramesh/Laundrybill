/**
 * Payroll Detail — design-system tokens.
 * Net-salary hero · attendance tiles · earnings/deductions · payment history ·
 * actions (generate / recalculate / edit / add payment / settle / payslip).
 */

import { useState, useMemo, type CSSProperties } from "react";
import { LSpinner } from "@/components/laundry";
import { useStaff, usePayroll, usePayrollMutations, useAttendance } from "@/hooks/use-staff";
import { PaymentSheet } from "./PaymentSheet";
import { PayrollEditSheet } from "./PayrollEditSheet";
import { FullSettlementSheet } from "./FullSettlementSheet";
import type { PaymentMode, PayrollStatus } from "@/types/staff";
import { format, addMonths, subMonths, isSameMonth } from "date-fns";
import { ChevronLeft, ChevronRight, Wallet, Calendar, CheckCircle2, TrendingUp, TrendingDown, RefreshCw, Plus, FileText, Clock, Banknote, CreditCard, Smartphone, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { generatePayslipPDF } from "@/lib/pdf-generator";
import { useCurrency } from "@/hooks/use-currency";

const MONO = "'IBM Plex Mono'";
const TINTS = ["c-primary", "c-violet", "c-info", "c-cyan", "c-success", "c-warning"];
const tintFor = (s: string) => { let h = 0; for (const c of s || "x") h = (h * 31 + c.charCodeAt(0)) >>> 0; return TINTS[h % TINTS.length]; };
const card: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14, boxShadow: "var(--sh-sm)" };
const cardHead: CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "14px 18px", borderBottom: "1px solid var(--c-border)", fontSize: 13, fontWeight: 600 };
const row: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 };
const navBtn: CSSProperties = { cursor: "pointer", width: 30, height: 30, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-text-2)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 7 };
const btnOutline: CSSProperties = { flex: 1, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 10, padding: "11px 14px" };
const btnPrimary: CSSProperties = { width: "100%", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 11, padding: 13, boxShadow: "var(--sh-sm)" };

const STATUS_META: Record<PayrollStatus, { label: string; tint: string }> = {
    draft: { label: "Draft", tint: "c-text-3" },
    partial: { label: "Partial", tint: "c-warning" },
    paid: { label: "Paid", tint: "c-success" },
    settlement: { label: "Settled", tint: "c-primary" },
};
const modeIcon: Record<PaymentMode, React.ReactNode> = { cash: <Banknote size={15} />, bank: <CreditCard size={15} />, upi: <Smartphone size={15} /> };

interface PayrollDetailPanelProps {
    staffId: string;
    month?: Date;
    onClose?: () => void;
}

export function PayrollDetailPanel({ staffId, month, onClose }: PayrollDetailPanelProps) {
    const { t } = useTranslation();
    const { currencySymbol, formatAmount } = useCurrency();
    const [currentMonth, setCurrentMonth] = useState(() => month || new Date());
    const monthString = format(currentMonth, "yyyy-MM");
    const [generating, setGenerating] = useState(false);
    const [recalculating, setRecalculating] = useState(false);
    const [downloadingPDF, setDownloadingPDF] = useState(false);
    const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
    const [editSheetOpen, setEditSheetOpen] = useState(false);
    const [settlementSheetOpen, setSettlementSheetOpen] = useState(false);

    const { staff: staffList, loading: staffLoading } = useStaff();
    const { payroll, loading: payrollLoading } = usePayroll(monthString);
    const { generatePayroll, recalculatePayroll, addPayment } = usePayrollMutations();
    const { attendance, getStaffSummary } = useAttendance(currentMonth);

    const staff = useMemo(() => staffList.find((s) => s.id === staffId), [staffList, staffId]);
    const staffPayroll = useMemo(() => payroll.find((p) => p.staffId === staffId), [payroll, staffId]);
    const attendanceSummary = useMemo(() => getStaffSummary(staffId), [getStaffSummary, staffId]);
    const atCurrentMonth = isSameMonth(currentMonth, new Date());

    const calculatePayrollData = () => {
        if (!staff) return null;
        const a = attendance.filter((x) => x.staffId === staffId);
        const presentDays = a.filter((x) => x.status === "present").length;
        const absentDays = a.filter((x) => x.status === "absent").length;
        const halfDays = a.filter((x) => x.status === "half").length;
        const leaveDays = a.filter((x) => x.status === "leave").length;
        const effectiveDays = presentDays + halfDays * 0.5;
        const WD = 26;
        let baseSalary = staff.payType === "monthly" ? (staff.baseSalary / WD) * effectiveDays : staff.baseSalary * effectiveDays;
        const overtimeHours = a.reduce((sum, x) => sum + (x.overtime || 0), 0);
        let overtimeAmount = 0;
        if (overtimeHours > 0) {
            overtimeAmount = staff.overtimeRate && staff.overtimeRate > 0 ? overtimeHours * staff.overtimeRate : overtimeHours * ((staff.payType === "monthly" ? staff.baseSalary / WD / 8 : staff.baseSalary / 8) * 1.5);
        }
        const totalEarnings = baseSalary + overtimeAmount;
        return { daysPresent: presentDays, daysAbsent: absentDays, daysHalf: halfDays, daysLeave: leaveDays, daysWorked: Math.round(effectiveDays * 10) / 10, baseSalary: Math.round(baseSalary), overtimeHours, overtimeAmount: Math.round(overtimeAmount), bonus: 0, deductions: 0, advances: 0, totalEarnings: Math.round(totalEarnings), totalDeductions: 0, netSalary: Math.round(totalEarnings) };
    };

    const handleGeneratePayroll = async () => { if (!staff) return; setGenerating(true); try { const data = calculatePayrollData(); if (data) await generatePayroll(staff.id, staff.name, monthString, data); } catch (e) { console.error(e); } finally { setGenerating(false); } };
    const handleRecalculate = async () => { if (!staffPayroll || !staff) return; setRecalculating(true); try { const data = calculatePayrollData(); if (data) await recalculatePayroll(staffPayroll.id, data); } catch (e) { console.error(e); } finally { setRecalculating(false); } };
    const handleAddPayment = async (amount: number, mode: PaymentMode, note?: string) => { if (!staffPayroll) return; await addPayment(staffPayroll.id, amount, mode, note); };
    const handleDownloadPDF = async () => { if (!staff || !staffPayroll) return; setDownloadingPDF(true); try { await generatePayslipPDF(staff, staffPayroll, monthString, currencySymbol); } catch (e) { console.error(e); } finally { setDownloadingPDF(false); } };

    const loading = staffLoading || payrollLoading;
    const remainingAmount = staffPayroll?.remainingAmount ?? staffPayroll?.netSalary ?? 0;
    const canRecalculate = staffPayroll?.status === "draft" || staffPayroll?.status === "partial";
    const canAddPayment = staffPayroll && staffPayroll.status !== "paid";

    if (loading) return <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}><LSpinner size="lg" /></div>;
    if (!staff) {
        return (
            <div style={{ textAlign: "center", padding: 48 }}>
                <p style={{ color: "var(--c-text-3)" }}>{t("staff.notFound", "Staff not found")}</p>
                <button onClick={onClose} style={{ marginTop: 16, cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-primary-soft)", border: 0, borderRadius: 8, padding: "8px 14px" }}>{t("common.goBack", "Back")}</button>
            </div>
        );
    }

    const ref = tintFor(staff.id);
    const initials = staff.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const p = staffPayroll;
    const att = [
        { v: p?.daysPresent ?? attendanceSummary.present, label: t("staff.present", "Present"), tint: "c-success" },
        { v: p?.daysAbsent ?? attendanceSummary.absent, label: t("staff.absent", "Absent"), tint: "c-error" },
        { v: p?.daysHalf ?? attendanceSummary.half, label: t("staff.halfDay", "Half"), tint: "c-warning" },
        { v: p?.daysLeave ?? attendanceSummary.leave, label: t("staff.leave", "Leave"), tint: "c-violet" },
    ];

    return (
        <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", background: "var(--c-bg)" }}>
            {/* header */}
            <header style={{ position: "sticky", top: 0, zIndex: 5, flex: "none", minHeight: 58, background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 12, padding: "0 22px" }}>
                <button onClick={onClose} aria-label="Back" style={{ cursor: "pointer", width: 30, height: 30, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-text-2)", background: "transparent", border: 0, borderRadius: 7 }}><ChevronLeft size={18} /></button>
                <nav style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--c-text-3)", minWidth: 0 }}>
                    <button onClick={onClose} style={{ cursor: "pointer", font: "inherit", fontSize: 13, color: "var(--c-text-2)", background: "transparent", border: 0 }}>{t("staff.payroll", "Payroll")}</button><span>/</span>
                    <span style={{ color: "var(--c-text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{staff.name}</span>
                </nav>
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} aria-label="Previous month" style={navBtn}><ChevronLeft size={16} /></button>
                    <span style={{ fontSize: 13, fontWeight: 600, minWidth: 116, textAlign: "center" }}>{format(currentMonth, "MMMM yyyy")}</span>
                    <button onClick={() => { if (!atCurrentMonth) setCurrentMonth(addMonths(currentMonth, 1)); }} disabled={atCurrentMonth} aria-label="Next month" style={{ ...navBtn, opacity: atCurrentMonth ? 0.4 : 1, cursor: atCurrentMonth ? "not-allowed" : "pointer" }}><ChevronRight size={16} /></button>
                </div>
            </header>

            <div style={{ padding: "20px 22px 40px", maxWidth: 760, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
                {/* profile */}
                <div style={{ ...card, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ width: 52, height: 52, flex: "none", borderRadius: 14, background: `var(--${ref}-soft)`, color: `var(--${ref})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 600 }}>{initials}</span>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{staff.name}</div>
                        <div style={{ fontSize: 12.5, color: "var(--c-text-3)", marginTop: 2, textTransform: "capitalize" }}>{staff.payType} · {formatAmount(staff.baseSalary)}/{staff.payType === "monthly" ? t("staff.month", "mo") : t("staff.day", "day")}</div>
                    </div>
                </div>

                {p ? (
                    <>
                        {/* net salary hero */}
                        <div style={{ ...card, padding: "22px", textAlign: "center", background: "var(--c-primary-soft)", border: "1px solid var(--c-primary)" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--c-primary)", opacity: 0.85 }}>{t("staff.netSalary", "Net salary")}</div>
                            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 36, letterSpacing: "-.02em", color: "var(--c-primary)", marginTop: 4 }}>{formatAmount(p.netSalary)}</div>
                            {(() => { const m = STATUS_META[p.status]; return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10, fontSize: 11.5, fontWeight: 600, padding: "4px 12px", borderRadius: 20, background: "var(--c-surface)", color: `var(--${m.tint})` }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: `var(--${m.tint})` }} />{m.label}</span>; })()}
                            {p.overtimeHours > 0 && <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--c-primary)", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Clock size={14} style={{ color: "var(--c-warning)" }} /><span style={{ color: "var(--c-text-2)" }}>Overtime</span><span style={{ fontFamily: MONO, fontWeight: 700, color: "var(--c-warning)" }}>{p.overtimeHours}h</span>=<span style={{ fontFamily: MONO, fontWeight: 700, color: "var(--c-success)" }}>{formatAmount(p.overtimeAmount)}</span></div>}
                            {p.status !== "paid" && p.totalPaid > 0 && (
                                <div style={{ marginTop: 14, background: "var(--c-surface)", borderRadius: 12, padding: 12 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 8 }}><span style={{ color: "var(--c-text-2)" }}>Paid <span style={{ fontFamily: MONO, fontWeight: 700, color: "var(--c-success)" }}>{formatAmount(p.totalPaid)}</span></span><span style={{ color: "var(--c-text-2)" }}>{remainingAmount >= 0 ? "Remaining" : "Advance"} <span style={{ fontFamily: MONO, fontWeight: 700, color: remainingAmount >= 0 ? "var(--c-warning)" : "var(--c-success)" }}>{formatAmount(Math.abs(remainingAmount))}</span></span></div>
                                    <div style={{ height: 8, background: "var(--c-surface-2)", borderRadius: 8, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(100, (p.totalPaid / p.netSalary) * 100)}%`, background: "var(--c-success)" }} /></div>
                                </div>
                            )}
                        </div>

                        {/* recalculate / edit */}
                        {(canRecalculate || p.status !== "paid") && (
                            <div style={{ display: "flex", gap: 10 }}>
                                {canRecalculate && <button onClick={handleRecalculate} disabled={recalculating} style={{ ...btnOutline, opacity: recalculating ? 0.6 : 1 }}><RefreshCw size={15} style={recalculating ? { animation: "spin 1s linear infinite" } : undefined} />{t("payroll.recalculate", "Recalculate")}</button>}
                                {p.status !== "paid" && <button onClick={() => setEditSheetOpen(true)} style={btnOutline}><Pencil size={15} />{t("payroll.editAmounts", "Edit amounts")}</button>}
                            </div>
                        )}

                        {/* attendance */}
                        <div style={card}>
                            <div style={cardHead}><Calendar size={15} style={{ color: "var(--c-text-3)" }} />{t("staff.attendance", "Attendance")}</div>
                            <div style={{ padding: 16 }}>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
                                    {att.map((a) => <div key={a.label} style={{ background: `var(--${a.tint}-soft)`, borderRadius: 11, padding: "12px 8px", textAlign: "center" }}><div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 19, color: `var(--${a.tint})` }}>{a.v}</div><div style={{ fontSize: 10, fontWeight: 600, color: "var(--c-text-2)", marginTop: 3 }}>{a.label}</div></div>)}
                                </div>
                                <div style={{ ...row, paddingTop: 12, borderTop: "1px solid var(--c-border)" }}><span style={{ color: "var(--c-text-2)" }}>{t("payroll.effectiveDays", "Effective days")}</span><span style={{ fontFamily: MONO, fontWeight: 700 }}>{p.daysWorked ?? 0}</span></div>
                                {p.overtimeHours > 0 && <div style={{ ...row, marginTop: 9 }}><span style={{ color: "var(--c-text-2)" }}>{t("payroll.overtimeHours", "Overtime hours")}</span><span style={{ fontFamily: MONO, fontWeight: 700, color: "var(--c-warning)" }}>{p.overtimeHours}h</span></div>}
                            </div>
                        </div>

                        {/* earnings */}
                        <div style={card}>
                            <div style={cardHead}><TrendingUp size={15} style={{ color: "var(--c-success)" }} />{t("staff.earnings", "Earnings")}</div>
                            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 11 }}>
                                <div style={row}><span style={{ color: "var(--c-text-2)" }}>{t("staff.baseSalary", "Base salary")}</span><span style={{ fontFamily: MONO, fontWeight: 600 }}>{formatAmount(p.baseSalary)}</span></div>
                                {p.overtimeAmount > 0 && <div style={row}><span style={{ color: "var(--c-text-2)" }}>{t("staff.overtimeAmount", "Overtime")} ({p.overtimeHours}h)</span><span style={{ fontFamily: MONO, fontWeight: 600, color: "var(--c-success)" }}>{formatAmount(p.overtimeAmount)}</span></div>}
                                {p.bonus > 0 && <div style={row}><span style={{ color: "var(--c-text-2)" }}>{t("staff.bonus", "Bonus")}</span><span style={{ fontFamily: MONO, fontWeight: 600, color: "var(--c-success)" }}>{formatAmount(p.bonus)}</span></div>}
                                <div style={{ ...row, paddingTop: 11, borderTop: "1px solid var(--c-border)" }}><span style={{ fontWeight: 700 }}>{t("staff.totalEarnings", "Total earnings")}</span><span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 15 }}>{formatAmount(p.totalEarnings)}</span></div>
                            </div>
                        </div>

                        {/* deductions */}
                        {p.totalDeductions > 0 && (
                            <div style={card}>
                                <div style={cardHead}><TrendingDown size={15} style={{ color: "var(--c-error)" }} />{t("staff.deductions", "Deductions")}</div>
                                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 11 }}>
                                    {p.advances > 0 && <div style={row}><span style={{ color: "var(--c-text-2)" }}>{t("staff.advances", "Advances")}</span><span style={{ fontFamily: MONO, fontWeight: 600, color: "var(--c-error)" }}>{formatAmount(p.advances)}</span></div>}
                                    {p.deductions > 0 && <div style={row}><span style={{ color: "var(--c-text-2)" }}>{t("staff.otherDeductions", "Other deductions")}</span><span style={{ fontFamily: MONO, fontWeight: 600, color: "var(--c-error)" }}>{formatAmount(p.deductions)}</span></div>}
                                    <div style={{ ...row, paddingTop: 11, borderTop: "1px solid var(--c-border)" }}><span style={{ fontWeight: 700 }}>{t("staff.totalDeductions", "Total deductions")}</span><span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 15, color: "var(--c-error)" }}>{formatAmount(p.totalDeductions)}</span></div>
                                </div>
                            </div>
                        )}

                        {/* payment history */}
                        {p.payments && p.payments.length > 0 && (
                            <div style={card}>
                                <div style={cardHead}><Clock size={15} style={{ color: "var(--c-text-3)" }} />{t("payroll.paymentHistory", "Payment history")}</div>
                                <div style={{ padding: "4px 18px 12px" }}>
                                    {p.payments.map((pay, i) => (
                                        <div key={pay.id || i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: i < p.payments!.length - 1 ? "1px solid var(--c-border)" : undefined }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                                                <span style={{ width: 36, height: 36, flex: "none", borderRadius: "50%", background: "var(--c-surface-2)", color: "var(--c-text-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>{modeIcon[pay.mode]}</span>
                                                <div><div style={{ fontFamily: MONO, fontWeight: 700 }}>{formatAmount(pay.amount)}{pay.type === "advance" && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 700, color: "var(--c-success)", background: "var(--c-success-soft)", padding: "2px 6px", borderRadius: 5, fontFamily: "inherit" }}>ADVANCE</span>}</div><div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginTop: 1 }}>{pay.date?.toDate ? format(pay.date.toDate(), "dd MMM yyyy") : "—"}{pay.note ? ` · ${pay.note}` : ""}</div></div>
                                            </div>
                                            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--c-text-3)", textTransform: "uppercase", background: "var(--c-surface-2)", padding: "3px 8px", borderRadius: 6 }}>{pay.mode}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* actions */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {canAddPayment && <button onClick={() => setPaymentSheetOpen(true)} style={btnPrimary}><Plus size={17} />{t("payroll.addPayment", "Add Payment")}</button>}
                            {canAddPayment && <button onClick={() => setSettlementSheetOpen(true)} style={{ ...btnOutline, width: "100%", flex: "none", padding: 13, fontSize: 15 }}><CheckCircle2 size={16} />{t("payroll.fullSettlement", "Full Settlement")}</button>}
                            {p.status === "paid" && <button onClick={handleDownloadPDF} disabled={downloadingPDF} style={{ ...btnOutline, width: "100%", flex: "none", padding: 13, fontSize: 15, opacity: downloadingPDF ? 0.6 : 1 }}><FileText size={16} />{downloadingPDF ? t("common.loading", "Generating…") : t("payroll.downloadPayslip", "Download payslip")}</button>}
                        </div>
                    </>
                ) : (
                    <div style={{ ...card, padding: 32, textAlign: "center" }}>
                        <span style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--c-surface-2)", color: "var(--c-text-3)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}><Wallet size={32} /></span>
                        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{t("staff.noPayrollForMonth", "No payroll for this month")}</div>
                        <div style={{ display: "inline-flex", gap: 10, fontSize: 13, fontWeight: 700, background: "var(--c-surface-2)", padding: "8px 14px", borderRadius: 10, marginBottom: 20 }}>
                            <span style={{ color: "var(--c-success)" }}>{attendanceSummary.present}P</span>
                            <span style={{ color: "var(--c-error)" }}>{attendanceSummary.absent}A</span>
                            <span style={{ color: "var(--c-warning)" }}>{attendanceSummary.half}H</span>
                            <span style={{ color: "var(--c-violet)" }}>{attendanceSummary.leave}L</span>
                        </div>
                        <button onClick={handleGeneratePayroll} disabled={generating} style={{ ...btnPrimary, opacity: generating ? 0.6 : 1 }}><Wallet size={17} />{generating ? t("common.loading", "Generating…") : t("payroll.generatePayroll", "Generate payroll")}</button>
                    </div>
                )}
            </div>

            <PaymentSheet open={paymentSheetOpen} onClose={() => setPaymentSheetOpen(false)} maxAmount={remainingAmount > 0 ? remainingAmount : 0} onSubmit={handleAddPayment} />
            {staffPayroll && <FullSettlementSheet open={settlementSheetOpen} onClose={() => setSettlementSheetOpen(false)} payroll={staffPayroll} />}
            {staffPayroll && <PayrollEditSheet open={editSheetOpen} onClose={() => setEditSheetOpen(false)} payroll={staffPayroll} />}
        </div>
    );
}
