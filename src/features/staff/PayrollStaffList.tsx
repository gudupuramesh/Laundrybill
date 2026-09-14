/**
 * Payroll List — design-system tokens.
 * Header (month stepper) · KPI row · roster table (net / paid / remaining /
 * status). Wired to useStaff + usePayroll. Row → payroll detail (generate/pay).
 */

import { useState, type CSSProperties, type ReactNode } from "react";
import { LEmptyState, LSpinner, LResponsiveDialog, useLToast } from "@/components/laundry";
import { useShop } from "@/hooks/use-shop";
import { buildWaPhone } from "@/lib/whatsappShare";
import { generatePayslipPDF } from "@/lib/pdf-generator";
import { calculatePayroll, advancePaid, ADVANCE_NOTE } from "./payroll-calc";
import { MobilePayroll } from "./MobileStaff";
import { useNavigate } from "react-router-dom";
import { useStaff, usePayroll, useAttendance, usePayrollMutations } from "@/hooks/use-staff";
import { useCurrency } from "@/hooks/use-currency";
import { useIsMobile } from "@/hooks/use-mobile";
import type { PayrollStatus, PaymentMode } from "@/types/staff";
import { format, addMonths, subMonths, isSameMonth, startOfMonth, endOfMonth } from "date-fns";
import { Users, Wallet, Clock, ChevronDown, CalendarDays, Plus, CircleCheck, FileText, MessageCircle, Info, X, Printer } from "lucide-react";
import { useTranslation } from "react-i18next";

const AV = ["c-primary", "c-info", "c-violet", "c-cyan", "c-success", "c-warning"];
const STATUS_META: Record<PayrollStatus, { label: string; tint: string }> = {
    draft: { label: "Draft", tint: "c-text-3" },
    partial: { label: "Partial", tint: "c-warning" },
    paid: { label: "Paid", tint: "c-success" },
    settlement: { label: "Settled", tint: "c-primary" },
};


interface PayrollStaffListProps {
    selectedId?: string | null;
    onSelect?: (staffId: string) => void;
    currentMonth: Date;
    onMonthChange: (d: Date) => void;
}

export function PayrollStaffList({ onSelect, currentMonth, onMonthChange }: PayrollStaffListProps) {
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const [searchQuery] = useState("");
    const monthString = format(currentMonth, "yyyy-MM");
    const atCurrentMonth = isSameMonth(currentMonth, new Date());

    const { activeStaff, loading: staffLoading } = useStaff();
    const { payroll, loading: payrollLoading } = usePayroll(monthString);
    const { attendance } = useAttendance(currentMonth);
    const { generatePayroll, performFullSettlement, addPayment } = usePayrollMutations();
    const { shop } = useShop();
    const { addToast } = useLToast();
    const { currencySymbol } = useCurrency();
    const [slipId, setSlipId] = useState<string | null>(null);
    const [payTarget, setPayTarget] = useState<string | null>(null); // staff id or "all"
    const [payMode, setPayMode] = useState<PaymentMode>("cash");
    const [paying, setPaying] = useState(false);
    const [advOpen, setAdvOpen] = useState(false);
    const [advStaffId, setAdvStaffId] = useState("");
    const [advAmount, setAdvAmount] = useState("");
    const [advMode, setAdvMode] = useState<PaymentMode>("cash");
    const loading = staffLoading || payrollLoading;

    const entryFor = (staffId: string) => payroll.find((p) => p.staffId === staffId);
    const filtered = activeStaff.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));



    // MOBILE: the owner app's payroll list.
    if (isMobile) return (
        <MobilePayroll
            monthLabel={format(currentMonth, "MMMM yyyy")}
            canNext={!atCurrentMonth}
            onPrevMonth={() => onMonthChange(subMonths(currentMonth, 1))}
            onNextMonth={() => { if (!atCurrentMonth) onMonthChange(addMonths(currentMonth, 1)); }}
            rows={filtered.map((s) => {
                const e = entryFor(s.id);
                const meta = e ? STATUS_META[e.status] : null;
                return {
                    id: s.id, name: s.name,
                    daysWorked: e?.daysWorked,
                    netSalary: e?.netSalary,
                    paid: e?.totalPaid,
                    remaining: e?.remainingAmount,
                    statusLabel: meta?.label,
                    statusTint: meta?.tint,
                };
            })}
            onOpen={(id) => onSelect?.(id)}
            onBack={() => navigate("/settings")}
            formatAmount={formatAmount}
        />
    );

    // ---- desktop (reference layout) ------------------------------------------
    const rows = activeStaff.map((st) => {
        const e = entryFor(st.id);
        const calc = e ? null : calculatePayroll(st, attendance);
        const adv = advancePaid(e) + (e?.advances || 0);
        const gross = e ? (e.totalEarnings ?? e.baseSalary) : (calc?.totalEarnings || 0);
        const otherDed = e?.deductions || 0;
        const net = Math.max(0, gross - otherDed - adv);
        const paid = e?.status === "paid" || e?.status === "settlement";
        const remaining = e ? Math.max(0, e.remainingAmount ?? (e.netSalary - (e.totalPaid || 0))) : (calc?.netSalary || 0);
        return {
            st, e, calc, adv, gross, otherDed, net, paid, remaining,
            present: e?.daysPresent ?? calc?.daysPresent ?? 0,
            half: e?.daysHalf ?? calc?.daysHalf ?? 0,
            leave: e?.daysLeave ?? calc?.daysLeave ?? 0,
        };
    });
    type Row = (typeof rows)[number];
    const pendingRows = rows.filter((r) => !r.paid && r.remaining > 0);
    const grand = rows.reduce((acc, r) => ({ gross: acc.gross + r.gross, net: acc.net + r.net, present: acc.present + r.present, half: acc.half + r.half, leave: acc.leave + r.leave, adv: acc.adv + r.adv, ded: acc.ded + r.otherDed }), { gross: 0, net: 0, present: 0, half: 0, leave: 0, adv: 0, ded: 0 });
    const kTotal = rows.reduce((sum, r) => sum + (r.e ? r.e.netSalary : r.net), 0);
    const kPaid = rows.reduce((sum, r) => sum + (r.e?.totalPaid || 0), 0);
    const kPending = Math.max(0, kTotal - kPaid);
    const pctOf = (v: number) => (kTotal > 0 ? `${((v / kTotal) * 100).toFixed(1)}%` : "0%");

    const slipRow = rows.find((r) => r.st.id === slipId) || null;
    const monthOptions = Array.from({ length: 12 }, (_, i) => subMonths(new Date(), i));

    /** Make sure a payroll doc exists for this staff + month; returns its id. */
    const ensureEntry = async (r: Row): Promise<string | null> => {
        if (r.e) return r.e.id;
        const data = calculatePayroll(r.st, attendance);
        return (await generatePayroll(r.st.id, r.st.name, monthString, data)) || null;
    };
    const payRow = async (r: Row, mode: PaymentMode) => {
        const id = await ensureEntry(r);
        if (id) await performFullSettlement(id, { mode });
    };
    const runPay = async () => {
        if (!payTarget) return;
        setPaying(true);
        try {
            const targets = payTarget === "all" ? pendingRows : rows.filter((r) => r.st.id === payTarget);
            for (const r of targets) await payRow(r, payMode);
            addToast({ type: "success", title: payTarget === "all" ? t("payroll.allPaid", "Salaries paid") : t("payroll.salaryPaid", "Salary paid") });
            setPayTarget(null);
        } catch (err) {
            console.error("pay salary", err);
            addToast({ type: "error", title: t("payroll.payFailed", "Could not record the payment"), description: err instanceof Error ? err.message : undefined });
        } finally {
            setPaying(false);
        }
    };
    const runAdvance = async () => {
        const r = rows.find((x) => x.st.id === advStaffId);
        const amt = parseFloat(advAmount);
        if (!r || !(amt > 0)) return;
        setPaying(true);
        try {
            const id = await ensureEntry(r);
            if (id) await addPayment(id, amt, advMode, ADVANCE_NOTE);
            addToast({ type: "success", title: t("payroll.advanceAdded", "Advance recorded"), description: `${r.st.name} · ${formatAmount(amt)}` });
            setAdvOpen(false); setAdvAmount(""); setAdvStaffId("");
        } catch (err) {
            console.error("advance", err);
            addToast({ type: "error", title: t("payroll.advanceFailed", "Could not record the advance"), description: err instanceof Error ? err.message : undefined });
        } finally {
            setPaying(false);
        }
    };

    const roleText = (r: string) => ({ admin: t("staff.roleAdmin", "Admin"), manager: t("staff.roleManager", "Manager"), staff: t("staff.roleStaff", "Staff"), plant_operator: t("staff.rolePlant", "Plant operator") } as Record<string, string>)[r] || r;
    const periodText = `${format(startOfMonth(currentMonth), "d MMM")} – ${format(endOfMonth(currentMonth), "d MMM yyyy")}`;
    const slipText = (r: Row) => [
        `*${t("payroll.salarySlip", "Salary slip")}* · ${shop?.name || ""}`,
        `${r.st.name} · ${format(currentMonth, "MMMM yyyy")}`,
        `${t("payroll.present", "Present")} ${r.present} · ${t("payroll.half", "Half")} ${r.half} · ${t("payroll.leave", "Leave")} ${r.leave}`,
        `${t("payroll.grossSalary", "Gross salary")}: ${formatAmount(r.gross)}`,
        r.adv > 0 ? `${t("payroll.advances", "Advances")}: -${formatAmount(r.adv)}` : "",
        r.otherDed > 0 ? `${t("payroll.otherDeductions", "Other deductions")}: -${formatAmount(r.otherDed)}` : "",
        `*${t("payroll.netPay", "Net pay")}: ${formatAmount(r.net)}*`,
        `${t("payroll.status", "Status")}: ${r.paid ? t("payroll.paid", "Paid") : t("payroll.pending", "Pending")}`,
    ].filter(Boolean).join("\n");
    const sendWhatsApp = (r: Row) => {
        const phone = r.st.phone ? buildWaPhone(r.st.phone, shop || undefined) : "";
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(slipText(r))}`, "_blank");
    };
    const downloadSlip = async (r: Row) => {
        if (!r.e) return;
        try { await generatePayslipPDF(r.st, r.e, monthString, currencySymbol); } catch (err) { console.error("payslip", err); }
    };

    const money = (v: number) => formatAmount(v).replace(/\.00$/, "");
    const dsCard: CSSProperties = { background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 14, boxShadow: "0 1px 2px rgba(16,24,40,.04)" };
    const TH2: CSSProperties = { padding: "16px 10px", fontSize: 13.5, fontWeight: 500, color: "var(--ds-text)", textAlign: "center", whiteSpace: "nowrap", borderBottom: "1px solid var(--ds-border)" };
    const TD2: CSSProperties = { padding: "12px 10px", fontSize: 14.5, textAlign: "center", borderBottom: "1px solid var(--ds-divider)", whiteSpace: "nowrap" };
    const iconAct: CSSProperties = { cursor: "pointer", width: 38, height: 36, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 9 };
    const modePicker = (value: PaymentMode, set: (m: PaymentMode) => void) => (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {([["cash", t("payroll.cash", "Cash")], ["upi", "UPI"], ["bank", t("payroll.bank", "Bank")]] as const).map(([m, label]) => (
                <button key={m} type="button" onClick={() => set(m)} style={{ cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 600, padding: "10px 6px", borderRadius: 10, border: `1px solid ${value === m ? "var(--ds-blue)" : "var(--ds-border)"}`, background: value === m ? "var(--ds-blue-soft)" : "var(--ds-card)", color: value === m ? "var(--ds-blue)" : "var(--ds-text)" }}>{label}</button>
            ))}
        </div>
    );
    const slipLine = (label: string, value: ReactNode, color?: string, strong?: boolean) => (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, color: color || "var(--ds-text)", fontWeight: strong ? 600 : 400 }}>
            <span style={{ color: color || "var(--ds-text-2)" }}>{label}</span><span>{value}</span>
        </div>
    );

    return (
        <div className="lb-ds" style={{ height: "100%", minHeight: 0, display: "flex", background: "var(--ds-bg)" }}>
            <div className="lb-scroll" style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "22px 22px 30px" }}>
                {/* header */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
                    <span style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-.02em", marginRight: "auto" }}>{t("staff.payroll", "Payroll")}</span>
                    <label style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 12, height: 44, padding: "0 16px", border: "1px solid var(--ds-border)", borderRadius: 11, background: "var(--ds-card)", minWidth: 178, cursor: "pointer" }}>
                        <CalendarDays size={18} style={{ color: "var(--ds-text-2)" }} />
                        <span style={{ fontSize: 15, fontWeight: 500, flex: 1 }}>{format(currentMonth, "MMMM yyyy")}</span>
                        <ChevronDown size={17} />
                        <select value={monthString} onChange={(e) => { const [y, m] = e.target.value.split("-").map(Number); onMonthChange(new Date(y, m - 1, 1)); }} aria-label={t("payroll.month", "Month")}
                            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}>
                            {monthOptions.map((d) => <option key={format(d, "yyyy-MM")} value={format(d, "yyyy-MM")}>{format(d, "MMMM yyyy")}</option>)}
                        </select>
                    </label>
                    <button onClick={() => { setAdvStaffId(slipRow?.st.id || ""); setAdvOpen(true); }} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 10, font: "inherit", fontSize: 15, fontWeight: 600, color: "var(--ds-blue)", background: "var(--ds-card)", border: "1px solid var(--ds-blue)", borderRadius: 11, height: 44, padding: "0 20px" }}>
                        <Plus size={18} />{t("payroll.addAdvance", "Add advance")}
                    </button>
                    <button onClick={() => setPayTarget("all")} disabled={pendingRows.length === 0} style={{ cursor: pendingRows.length ? "pointer" : "default", font: "inherit", fontSize: 15, fontWeight: 600, color: "#fff", background: "var(--ds-blue)", border: "1px solid var(--ds-blue)", borderRadius: 11, height: 44, padding: "0 20px", opacity: pendingRows.length ? 1 : 0.5 }}>
                        {t("payroll.payAllPending", "Pay all pending")}
                    </button>
                </div>

                {/* KPIs */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16, marginBottom: 22 }}>
                    {[
                        { label: t("payroll.totalPayroll", "Total payroll"), value: money(kTotal), sub: null, icon: <Wallet size={22} />, bg: "var(--ds-blue-soft)", fg: "var(--ds-blue)" },
                        { label: t("payroll.paid", "Paid"), value: money(kPaid), sub: <span style={{ color: "var(--ds-positive)" }}>{pctOf(kPaid)}</span>, icon: <CircleCheck size={24} />, bg: "#DCFCE7", fg: "#16A34A" },
                        { label: t("payroll.pending", "Pending"), value: money(kPending), sub: <span style={{ color: "#D97706" }}>{pctOf(kPending)}</span>, icon: <Clock size={24} />, bg: "#FEF3C7", fg: "#D97706" },
                        { label: t("payroll.staff", "Staff"), value: String(activeStaff.length), sub: <span style={{ color: "var(--ds-text-2)" }}>{t("payroll.activeStaff", "active staff")}</span>, icon: <Users size={23} />, bg: "#EDE9FE", fg: "#7C3AED" },
                    ].map((k) => (
                        <div key={k.label} style={{ ...dsCard, padding: "20px 22px", display: "flex", alignItems: "center", gap: 18 }}>
                            <span style={{ width: 54, height: 54, flex: "none", borderRadius: "50%", background: k.bg, color: k.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>{k.icon}</span>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13.5, color: "var(--ds-text)" }}>{k.label}</div>
                                <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-.01em", marginTop: 4 }}>{k.value}</div>
                                {k.sub && <div style={{ fontSize: 13, marginTop: 6 }}>{k.sub}</div>}
                            </div>
                        </div>
                    ))}
                </div>

                {/* table */}
                <div style={{ ...dsCard, overflow: "hidden" }}>
                    {loading ? (
                        <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><LSpinner /></div>
                    ) : activeStaff.length === 0 ? (
                        <LEmptyState icon={<Users className="h-8 w-8" />} title={t("staff.noStaff", "No staff")} description={t("staff.addStaffFirst", "Add staff to run payroll.")} />
                    ) : (
                        <div className="lb-scroll" style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
                                <thead>
                                    <tr>
                                        <th style={{ ...TH2, textAlign: "left", paddingLeft: 22 }}>{t("payroll.colStaff", "Staff")}</th>
                                        <th style={TH2}>{t("payroll.colSalary", "Salary")}</th>
                                        <th style={TH2}>{t("payroll.present", "Present")}</th>
                                        <th style={TH2}>{t("payroll.half", "Half")}</th>
                                        <th style={TH2}>{t("payroll.leave", "Leave")}</th>
                                        <th style={TH2}>{t("payroll.advances", "Advances")}</th>
                                        <th style={TH2}>{t("payroll.deductions", "Deductions")}</th>
                                        <th style={TH2}>{t("payroll.netPay", "Net pay")}</th>
                                        <th style={TH2}>{t("payroll.status", "Status")}</th>
                                        <th style={{ ...TH2, paddingRight: 18 }}>{t("payroll.actions", "Actions")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r, i) => {
                                        const sel = slipId === r.st.id;
                                        const partial = !r.paid && (r.e?.totalPaid || 0) > advancePaid(r.e) && r.e?.status === "partial";
                                        return (
                                            <tr key={r.st.id} onClick={() => setSlipId(r.st.id)} style={{ cursor: "pointer", background: sel ? "var(--ds-blue-soft)" : undefined }}>
                                                <td style={{ ...TD2, textAlign: "left", paddingLeft: 22 }}>
                                                    <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                                        <span style={{ width: 32, height: 32, flex: "none", borderRadius: "50%", background: `var(--${AV[i % AV.length]}-soft)`, color: `var(--${AV[i % AV.length]})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600 }}>{(r.st.name || "?").trim()[0]?.toUpperCase()}</span>
                                                        <span style={{ textAlign: "left" }}>
                                                            <span style={{ display: "block", fontSize: 14.5, fontWeight: 600 }}>{r.st.name}</span>
                                                            <span style={{ display: "block", fontSize: 13, color: "var(--ds-text-2)", marginTop: 2 }}>{roleText(r.st.role)}</span>
                                                        </span>
                                                    </span>
                                                </td>
                                                <td style={TD2}>{money(r.st.baseSalary)}{r.st.payType !== "monthly" && <span style={{ fontSize: 12, color: "var(--ds-text-2)" }}>/{t("payroll.day", "day")}</span>}</td>
                                                <td style={TD2}>{r.present}</td>
                                                <td style={TD2}>{r.half}</td>
                                                <td style={TD2}>{r.leave}</td>
                                                <td style={TD2}>{money(r.adv)}</td>
                                                <td style={TD2}>{money(r.otherDed)}</td>
                                                <td style={TD2}>{money(r.net)}</td>
                                                <td style={TD2}>
                                                    <span style={{ fontSize: 12.5, fontWeight: 500, padding: "5px 11px", borderRadius: 6, border: `1px solid ${r.paid ? "#BBF7D0" : "#FDE68A"}`, background: r.paid ? "#F0FDF4" : "#FFFBEB", color: r.paid ? "#15803D" : "#B45309" }}>
                                                        {r.paid ? t("payroll.paid", "Paid") : partial ? t("payroll.partial", "Partial") : t("payroll.pending", "Pending")}
                                                    </span>
                                                </td>
                                                <td style={{ ...TD2, paddingRight: 18 }} onClick={(ev) => ev.stopPropagation()}>
                                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                                                        {r.paid ? (
                                                            <button onClick={() => void downloadSlip(r)} title={t("payroll.downloadPayslip", "Download payslip")} aria-label={t("payroll.downloadPayslip", "Download payslip")} style={iconAct}><FileText size={17} /></button>
                                                        ) : r.remaining > 0 ? (
                                                            <button onClick={() => setPayTarget(r.st.id)} style={{ cursor: "pointer", font: "inherit", fontSize: 13.5, fontWeight: 600, color: "#fff", background: "var(--ds-blue)", border: 0, borderRadius: 8, height: 36, padding: "0 14px", whiteSpace: "nowrap" }}>{t("payroll.payAmount", "Pay {{amt}}", { amt: money(r.remaining) })}</button>
                                                        ) : (
                                                            <button onClick={() => onSelect?.(r.st.id)} title={t("payroll.manage", "Manage payments")} style={iconAct}><FileText size={17} /></button>
                                                        )}
                                                        <button onClick={() => sendWhatsApp(r)} title={t("payroll.sendWhatsApp", "Send on WhatsApp")} aria-label={t("payroll.sendWhatsApp", "Send on WhatsApp")} style={{ ...iconAct, color: "var(--ds-whatsapp)" }}><MessageCircle size={17} /></button>
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    <tr>
                                        <td style={{ ...TD2, textAlign: "left", paddingLeft: 22, fontWeight: 600 }}>{t("payroll.total", "Total")}</td>
                                        <td style={{ ...TD2, fontWeight: 600 }}>{money(grand.gross)}</td>
                                        <td style={{ ...TD2, fontWeight: 600 }}>{grand.present}</td>
                                        <td style={{ ...TD2, fontWeight: 600 }}>{grand.half}</td>
                                        <td style={{ ...TD2, fontWeight: 600 }}>{grand.leave}</td>
                                        <td style={{ ...TD2, fontWeight: 600 }}>{money(grand.adv)}</td>
                                        <td style={{ ...TD2, fontWeight: 600 }}>{money(grand.ded)}</td>
                                        <td style={{ ...TD2, fontWeight: 600 }}>{money(grand.net)}</td>
                                        <td style={TD2} /><td style={TD2} />
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                    <div style={{ padding: "16px 22px", fontSize: 13.5, color: "var(--ds-text-2)" }}>{t("payroll.showing", "Showing 1–{{n}} of {{n}} staff", { n: activeStaff.length })}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0", padding: "13px 22px", background: "var(--ds-blue-soft)", borderTop: "1px solid var(--ds-border)", fontSize: 13.5 }}>
                        <Info size={18} style={{ color: "var(--ds-blue)" }} />
                        <span>{t("payroll.flowNoteA", "Paid salaries appear in")} <button onClick={() => navigate("/expenses")} style={{ cursor: "pointer", font: "inherit", color: "var(--ds-blue)", background: "transparent", border: 0, padding: 0 }}>{t("nav.expenses", "Expenses")}</button> {t("payroll.flowNoteB", "automatically.")}</span>
                    </div>
                </div>
            </div>

            {/* salary slip */}
            {slipRow && (
                <aside style={{ width: 300, flex: "none", display: "flex", flexDirection: "column", minHeight: 0, background: "var(--ds-card)", borderLeft: "1px solid var(--ds-border)" }}>
                    <div style={{ padding: "22px 18px 10px", display: "flex", alignItems: "flex-start" }}>
                        <div>
                            <div style={{ fontSize: 19, fontWeight: 600 }}>{t("payroll.salarySlip", "Salary slip")}</div>
                            <div style={{ fontSize: 13.5, marginTop: 6 }}>{slipRow.st.name} · {format(currentMonth, "MMMM yyyy")}</div>
                        </div>
                        <button onClick={() => setSlipId(null)} aria-label={t("common.close", "Close")} style={{ marginLeft: "auto", cursor: "pointer", border: 0, background: "transparent", color: "var(--ds-text-2)", display: "inline-flex" }}><X size={21} /></button>
                    </div>
                    <div className="lb-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "8px 14px 12px" }}>
                        <div style={{ border: "1px solid var(--ds-border)", borderRadius: 12, padding: "14px 14px 16px", display: "flex", flexDirection: "column", gap: 11 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 12, borderBottom: "1px solid var(--ds-divider)" }}>
                                {shop?.logo ? <img src={shop.logo} alt="" style={{ width: 26, height: 26, borderRadius: 6, objectFit: "cover" }} /> : <span style={{ width: 26, height: 26, borderRadius: 6, background: "var(--ds-blue)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{(shop?.name || "S")[0]}</span>}
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shop?.name}</div>
                                    <div style={{ fontSize: 11, color: "var(--ds-text-2)" }}>{shop?.publicOrdering?.tagline || t("payroll.tagline", "Laundry & Dry Clean")}</div>
                                </div>
                                <div style={{ marginLeft: "auto", textAlign: "right", fontSize: 11, color: "var(--ds-text-2)" }}>{t("payroll.date", "Date")}<div style={{ color: "var(--ds-text)", marginTop: 2 }}>{format(new Date(), "d MMM yyyy")}</div></div>
                            </div>
                            {slipLine(t("payroll.employee", "Employee"), slipRow.st.name)}
                            {slipLine(t("payroll.role", "Role"), roleText(slipRow.st.role))}
                            {slipRow.st.phone && slipLine(t("payroll.phone", "Phone"), slipRow.st.phone)}
                            {slipLine(t("payroll.payPeriod", "Pay period"), periodText)}

                            <div style={{ borderTop: "1px solid var(--ds-divider)", paddingTop: 12, fontSize: 12.5, fontWeight: 600 }}>{t("payroll.attendanceSummary", "Attendance summary")}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                                {[[t("payroll.present", "Present"), slipRow.present], [t("payroll.halfDay", "Half day"), slipRow.half], [t("payroll.leave", "Leave"), slipRow.leave], [t("payroll.totalDays", "Total days"), slipRow.present + slipRow.half + slipRow.leave]].map(([l, v]) => (
                                    <div key={String(l)} style={{ border: "1px solid var(--ds-divider)", borderRadius: 7, padding: "6px 4px", textAlign: "center" }}>
                                        <div style={{ fontSize: 9.5, color: "var(--ds-text-2)" }}>{l}</div>
                                        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 3 }}>{v}</div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ borderTop: "1px solid var(--ds-divider)", paddingTop: 12, fontSize: 12.5, fontWeight: 600 }}>{t("payroll.earnings", "Earnings")}</div>
                            {slipLine(t("payroll.baseSalary", "Base salary"), money(slipRow.e?.baseSalary ?? slipRow.calc?.baseSalary ?? 0))}
                            {slipLine(t("payroll.otherEarnings", "Other earnings"), money((slipRow.e?.overtimeAmount ?? slipRow.calc?.overtimeAmount ?? 0) + (slipRow.e?.bonus || 0)))}
                            {slipLine(t("payroll.grossSalary", "Gross salary"), money(slipRow.gross), "var(--ds-blue)", true)}

                            <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 4 }}>{t("payroll.deductions", "Deductions")}</div>
                            {slipLine(t("payroll.advances", "Advances"), `-${money(slipRow.adv)}`)}
                            {slipLine(t("payroll.otherDeductions", "Other deductions"), money(slipRow.otherDed))}
                            {slipLine(t("payroll.totalDeductions", "Total deductions"), `-${money(slipRow.adv + slipRow.otherDed)}`, "var(--ds-negative)", true)}

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--ds-divider)", paddingTop: 14, marginTop: 4 }}>
                                <span style={{ fontSize: 14, fontWeight: 600 }}>{t("payroll.netPay", "Net pay")}</span>
                                <span style={{ fontSize: 21, fontWeight: 600, color: "#16A34A" }}>{money(slipRow.net)}</span>
                            </div>

                            <div style={{ borderTop: "1px solid var(--ds-divider)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                                {slipLine(t("payroll.paymentStatus", "Payment status"), <span style={{ fontSize: 11.5, fontWeight: 500, padding: "3px 9px", borderRadius: 5, background: slipRow.paid ? "#DCFCE7" : "#FEF3C7", color: slipRow.paid ? "#15803D" : "#B45309" }}>{slipRow.paid ? t("payroll.paid", "Paid") : t("payroll.pending", "Pending")}</span>)}
                                {slipRow.e?.payments?.length ? slipLine(slipRow.paid ? t("payroll.paidOn", "Paid on") : t("payroll.lastPayment", "Last payment"), (() => { const d = slipRow.e!.payments![slipRow.e!.payments!.length - 1].date?.toDate?.(); return d ? format(d, "d MMM yyyy") : "—"; })()) : null}
                                {!slipRow.paid && slipLine(t("payroll.toPay", "To pay"), money(slipRow.remaining), "var(--ds-text)", true)}
                            </div>
                        </div>
                        <button onClick={() => onSelect?.(slipRow.st.id)} style={{ marginTop: 12, width: "100%", cursor: "pointer", font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--ds-blue)", background: "transparent", border: 0, padding: 6 }}>{t("payroll.manage", "Manage payments & adjustments")} →</button>
                    </div>
                    <div style={{ display: "flex", gap: 10, padding: "12px 14px 18px" }}>
                        <button onClick={() => void downloadSlip(slipRow)} disabled={!slipRow.e} title={!slipRow.e ? t("payroll.generateFirst", "Pay or add an advance first to create the payslip") : undefined}
                            style={{ flex: "none", cursor: slipRow.e ? "pointer" : "default", display: "inline-flex", alignItems: "center", gap: 8, font: "inherit", fontSize: 14, fontWeight: 600, color: "var(--ds-blue)", background: "var(--ds-card)", border: "1px solid var(--ds-blue)", borderRadius: 10, padding: "10px 14px", opacity: slipRow.e ? 1 : 0.5 }}>
                            <Printer size={17} />{t("payroll.print", "Print")}
                        </button>
                        <button onClick={() => sendWhatsApp(slipRow)} style={{ flex: 1, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--ds-whatsapp)", background: "var(--ds-card)", border: "1px solid var(--ds-whatsapp)", borderRadius: 10, padding: "10px 10px", whiteSpace: "nowrap" }}>
                            <MessageCircle size={17} />{t("payroll.sendWhatsApp", "Send on WhatsApp")}
                        </button>
                    </div>
                </aside>
            )}

            {/* pay dialog (single + all) */}
            <LResponsiveDialog open={!!payTarget} onClose={() => !paying && setPayTarget(null)} title={payTarget === "all" ? t("payroll.payAllPending", "Pay all pending") : t("payroll.paySalary", "Pay salary")} size="sm">
                {payTarget && (() => {
                    const targets = payTarget === "all" ? pendingRows : rows.filter((r) => r.st.id === payTarget);
                    const total = targets.reduce((sum, r) => sum + r.remaining, 0);
                    return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            <div style={{ fontSize: 14, color: "var(--c-text-2)" }}>
                                {payTarget === "all"
                                    ? t("payroll.payAllDesc", "Settle {{n}} salaries for {{month}}. Each is marked paid.", { n: targets.length, month: format(currentMonth, "MMMM yyyy") })
                                    : t("payroll.payOneDesc", "Settle {{name}}'s salary for {{month}}. It is marked paid.", { name: targets[0]?.st.name, month: format(currentMonth, "MMMM yyyy") })}
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", border: "1px solid var(--c-border)", borderRadius: 12 }}>
                                <span style={{ fontSize: 14 }}>{t("payroll.amountToPay", "Amount to pay")}</span>
                                <span style={{ fontSize: 20, fontWeight: 700 }}>{money(total)}</span>
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t("payroll.paidVia", "Paid via")}</div>
                                {modePicker(payMode, setPayMode)}
                            </div>
                            <button onClick={() => void runPay()} disabled={paying || total <= 0} style={{ cursor: paying ? "wait" : "pointer", font: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 11, padding: 13, opacity: paying ? 0.6 : 1 }}>
                                {paying ? t("common.loading", "Saving…") : t("payroll.confirmPay", "Pay {{amt}}", { amt: money(total) })}
                            </button>
                        </div>
                    );
                })()}
            </LResponsiveDialog>

            {/* add advance */}
            <LResponsiveDialog open={advOpen} onClose={() => !paying && setAdvOpen(false)} title={t("payroll.addAdvance", "Add advance")} size="sm">
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t("payroll.colStaff", "Staff")}</div>
                        <select value={advStaffId} onChange={(e) => setAdvStaffId(e.target.value)} style={{ width: "100%", font: "inherit", fontSize: 14, padding: "11px 12px", border: "1px solid var(--c-border)", borderRadius: 10, background: "var(--c-surface)" }}>
                            <option value="">{t("payroll.selectStaff", "Select staff")}</option>
                            {rows.filter((r) => !r.paid).map((r) => <option key={r.st.id} value={r.st.id}>{r.st.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t("payroll.amount", "Amount")}</div>
                        <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--c-border)", borderRadius: 10, overflow: "hidden" }}>
                            <span style={{ padding: "0 12px", color: "var(--c-text-3)" }}>{currencySymbol}</span>
                            <input value={advAmount} inputMode="decimal" onChange={(e) => setAdvAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" style={{ flex: 1, font: "inherit", fontSize: 15, border: 0, padding: "11px 12px 11px 0", outline: "none" }} />
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t("payroll.paidVia", "Paid via")}</div>
                        {modePicker(advMode, setAdvMode)}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--c-text-3)" }}>{t("payroll.advanceHint", "The advance is deducted from this month's net pay.")}</div>
                    <button onClick={() => void runAdvance()} disabled={paying || !advStaffId || !(parseFloat(advAmount) > 0)} style={{ cursor: "pointer", font: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 11, padding: 13, opacity: paying || !advStaffId || !(parseFloat(advAmount) > 0) ? 0.55 : 1 }}>
                        {paying ? t("common.loading", "Saving…") : t("payroll.saveAdvance", "Save advance")}
                    </button>
                </div>
            </LResponsiveDialog>
        </div>
    );
}
