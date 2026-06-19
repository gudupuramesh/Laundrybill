/**
 * Payroll List — design-system tokens.
 * Header (month stepper) · KPI row · roster table (net / paid / remaining /
 * status). Wired to useStaff + usePayroll. Row → payroll detail (generate/pay).
 */

import { useState, type CSSProperties } from "react";
import { LEmptyState, LSpinner } from "@/components/laundry";
import { useStaff, usePayroll } from "@/hooks/use-staff";
import { useCurrency } from "@/hooks/use-currency";
import type { PayrollStatus } from "@/types/staff";
import { format, addMonths, subMonths, isSameMonth } from "date-fns";
import { Users, Wallet, Check, Clock, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

const MONO = "'IBM Plex Mono'";
const AV = ["c-primary", "c-info", "c-violet", "c-cyan", "c-success", "c-warning"];
const STATUS_META: Record<PayrollStatus, { label: string; tint: string }> = {
    draft: { label: "Draft", tint: "c-text-3" },
    partial: { label: "Partial", tint: "c-warning" },
    paid: { label: "Paid", tint: "c-success" },
    settlement: { label: "Settled", tint: "c-primary" },
};

const TH: CSSProperties = { padding: "9px 14px", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--c-text-3)", borderBottom: "1px solid var(--c-border)", whiteSpace: "nowrap", background: "var(--c-surface-2)" };
const TD: CSSProperties = { padding: "10px 14px", borderBottom: "1px solid var(--c-border)" };
const navBtn: CSSProperties = { cursor: "pointer", width: 30, height: 30, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-text-2)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 7 };

interface PayrollStaffListProps {
    selectedId?: string | null;
    onSelect?: (staffId: string) => void;
    currentMonth: Date;
    onMonthChange: (d: Date) => void;
}

export function PayrollStaffList({ selectedId, onSelect, currentMonth, onMonthChange }: PayrollStaffListProps) {
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();
    const [searchQuery, setSearchQuery] = useState("");
    const monthString = format(currentMonth, "yyyy-MM");
    const atCurrentMonth = isSameMonth(currentMonth, new Date());

    const { activeStaff, loading: staffLoading } = useStaff();
    const { payroll, loading: payrollLoading } = usePayroll(monthString);
    const loading = staffLoading || payrollLoading;

    const entryFor = (staffId: string) => payroll.find((p) => p.staffId === staffId);
    const filtered = activeStaff.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const totalPayroll = payroll.reduce((s, p) => s + (p.netSalary || 0), 0);
    const totalPaid = payroll.reduce((s, p) => s + (p.totalPaid || 0), 0);
    const totalPending = Math.max(0, totalPayroll - totalPaid);

    const kpis = [
        { label: t("staff.totalPayroll", "Total payroll"), value: formatAmount(totalPayroll), tint: "c-primary", icon: <Wallet size={16} /> },
        { label: t("staff.paid", "Paid"), value: formatAmount(totalPaid), tint: "c-success", icon: <Check size={16} /> },
        { label: t("staff.pending", "Pending"), value: formatAmount(totalPending), tint: "c-warning", icon: <Clock size={16} /> },
        { label: t("staff.staff", "Staff"), value: String(activeStaff.length), tint: "c-info", icon: <Users size={16} /> },
    ];

    return (
        <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", background: "var(--c-bg)" }}>
            <header style={{ flex: "none", minHeight: 58, background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "10px 22px" }}>
                <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.01em" }}>{t("staff.payroll", "Payroll")}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button onClick={() => onMonthChange(subMonths(currentMonth, 1))} aria-label="Previous month" style={navBtn}><ChevronLeft size={16} /></button>
                    <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 116, textAlign: "center" }}>{format(currentMonth, "MMMM yyyy")}</span>
                    <button onClick={() => { if (!atCurrentMonth) onMonthChange(addMonths(currentMonth, 1)); }} disabled={atCurrentMonth} aria-label="Next month" style={{ ...navBtn, opacity: atCurrentMonth ? 0.4 : 1, cursor: atCurrentMonth ? "not-allowed" : "pointer" }}><ChevronRight size={16} /></button>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ position: "relative" }}>
                    <Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--c-text-3)" }} />
                    <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} type="search" placeholder={t("common.search", "Search staff…")}
                        style={{ width: 200, font: "inherit", fontSize: 13, color: "var(--c-text)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: "8px 11px 8px 33px", outline: "none" }} />
                </div>
            </header>

            <div className="lb-scroll" style={{ flex: 1, overflow: "auto", padding: "20px 22px 40px", minHeight: 0 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 18 }}>
                    {kpis.map((k) => (
                        <div key={k.label} style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "15px 16px", boxShadow: "var(--sh-sm)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                                <span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: `var(--${k.tint}-soft)`, color: `var(--${k.tint})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{k.icon}</span>
                                <span style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{k.label}</span>
                            </div>
                            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 21, letterSpacing: "-.02em", marginTop: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.value}</div>
                        </div>
                    ))}
                </div>

                <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, boxShadow: "var(--sh-sm)", overflow: "hidden" }}>
                    <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--c-border)", fontSize: 14, fontWeight: 600 }}>{format(currentMonth, "MMMM yyyy")} {t("staff.payroll", "payroll")}</div>
                    {loading ? (
                        <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><LSpinner /></div>
                    ) : filtered.length === 0 ? (
                        <LEmptyState icon={<Users className="h-8 w-8" />} title={t("staff.noStaff", "No staff")} description={t("staff.addStaffFirst", "Add staff to run payroll.")} />
                    ) : (
                        <div className="lb-scroll" style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 760 }}>
                                <thead>
                                    <tr>
                                        <th style={{ ...TH, textAlign: "left", paddingLeft: 18 }}>{t("staff.name", "Staff")}</th>
                                        <th style={{ ...TH, textAlign: "right" }}>{t("staff.netSalary", "Net salary")}</th>
                                        <th style={{ ...TH, textAlign: "right" }}>{t("staff.paid", "Paid")}</th>
                                        <th style={{ ...TH, textAlign: "right" }}>{t("staff.remaining", "Remaining")}</th>
                                        <th style={{ ...TH, textAlign: "left" }}>{t("orders.status", "Status")}</th>
                                        <th style={{ ...TH, width: 40, paddingRight: 18 }} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((s, i) => {
                                        const e = entryFor(s.id);
                                        const meta = e ? STATUS_META[e.status] : null;
                                        const tint = AV[i % AV.length];
                                        const initials = s.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                                        return (
                                            <tr key={s.id} onClick={() => onSelect?.(s.id)} tabIndex={0} role="button"
                                                onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onSelect?.(s.id); } }}
                                                style={{ cursor: "pointer", background: selectedId === s.id ? "var(--c-primary-soft)" : "transparent" }}
                                                onMouseEnter={(ev) => { if (selectedId !== s.id) ev.currentTarget.style.background = "var(--c-surface-2)"; }}
                                                onMouseLeave={(ev) => { if (selectedId !== s.id) ev.currentTarget.style.background = "transparent"; }}>
                                                <td style={{ ...TD, paddingLeft: 18 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                                                        <span style={{ width: 34, height: 34, flex: "none", borderRadius: "50%", background: `var(--${tint}-soft)`, color: `var(--${tint})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 600 }}>{initials}</span>
                                                        <div><div style={{ fontWeight: 600 }}>{s.name}</div><div style={{ fontSize: 11, color: "var(--c-text-3)" }}>{e ? `${e.daysWorked ?? 0} ${t("staff.daysWorked", "days")}` : t("staff.notGenerated", "Not generated")}</div></div>
                                                    </div>
                                                </td>
                                                <td style={{ ...TD, textAlign: "right", fontFamily: MONO, fontWeight: 600 }}>{e ? formatAmount(e.netSalary) : "—"}</td>
                                                <td style={{ ...TD, textAlign: "right", fontFamily: MONO, color: "var(--c-success)" }}>{e ? formatAmount(e.totalPaid || 0) : "—"}</td>
                                                <td style={{ ...TD, textAlign: "right", fontFamily: MONO, fontWeight: 600, color: e && e.remainingAmount > 0 ? "var(--c-warning)" : "var(--c-text-3)" }}>{e ? formatAmount(e.remainingAmount || 0) : "—"}</td>
                                                <td style={TD}>{meta ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: meta.tint === "c-text-3" ? "var(--c-surface-2)" : `var(--${meta.tint}-soft)`, color: `var(--${meta.tint})` }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: `var(--${meta.tint})` }} />{meta.label}</span> : <span style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>—</span>}</td>
                                                <td style={{ ...TD, textAlign: "right", paddingRight: 18, color: "var(--c-text-3)" }}><ChevronRight size={16} /></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
