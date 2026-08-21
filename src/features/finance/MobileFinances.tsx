/**
 * MOBILE Finances — a 1:1 clone of the owner app's ExpensesScreen
 * (mobile/src/screens/ExpensesScreen.tsx): "Finance" header · toolbar row
 * (Report · period chip · month arrows) · blue-gradient ESTIMATED NET PROFIT
 * card with Monthly Income | Monthly Expenses · 2×2 KPI cards (Revenue ·
 * Collected · Expenses · Net Profit) · Staff Attendance / Quick Expense
 * buttons · Revenue-by-order-type bars · expenses-by-category · expense list.
 *
 * Desktop keeps ExpensesPageMasterDetail.
 */

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useExpenses } from "@/hooks/use-finance";
import { useFinancialReports } from "@/hooks/use-finance";
import { useCurrency } from "@/hooks/use-currency";
import { useTranslation } from "react-i18next";
import { startOfMonth, endOfMonth, addMonths, subMonths, format, isSameMonth } from "date-fns";
import {
    ChevronLeft, ChevronRight, TrendingUp, Wallet, ReceiptText, PiggyBank,
    Users, Plus, ArrowUp, ArrowDown, FileText,
} from "lucide-react";
import type { Expense } from "@/types/finance";

export function MobileFinances({ onAddExpense, onEditExpense }: {
    onAddExpense?: () => void;
    onEditExpense?: (e: Expense) => void;
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { formatAmount } = useCurrency();
    const [refDate, setRefDate] = useState(new Date());

    const monthStart = startOfMonth(refDate);
    const monthEnd = endOfMonth(refDate);
    const atCurrentMonth = isSameMonth(refDate, new Date());

    const { expenses, loading: expLoading, totals } = useExpenses(refDate);
    const report = useFinancialReports(monthStart, monthEnd);
    // Previous month, for the KPI delta pills the app shows.
    const prevStart = startOfMonth(subMonths(refDate, 1));
    const prev = useFinancialReports(prevStart, endOfMonth(prevStart));

    const revenue = Math.round(report.revenue || 0);
    const collected = Math.round(report.collections || 0);
    const expensesTotal = Math.round(report.totalExpenses || totals.total || 0);
    const netProfit = Math.round(report.profit ?? (revenue - expensesTotal));

    const pct = (now: number, before: number) => (before > 0 ? ((now - before) / before) * 100 : null);
    const revDelta = pct(revenue, Math.round(prev.revenue || 0));
    const expDelta = pct(expensesTotal, Math.round(prev.totalExpenses || 0));
    const profitDelta = pct(netProfit, Math.round(prev.profit || 0));

    const byCategory = useMemo(() => {
        const entries = Object.entries(report.expensesByCategory || {}).filter(([, v]) => v > 0);
        return entries.sort(([, a], [, b]) => b - a);
    }, [report.expensesByCategory]);

    const card: CSSProperties = { background: "var(--c-surface)", borderRadius: 18, border: "1px solid var(--c-border)", boxShadow: "var(--sh-sm)" };
    const cardTitle: CSSProperties = { fontSize: 14, fontWeight: 700, marginBottom: 12 };
    const navBtn: CSSProperties = { cursor: "pointer", width: 30, height: 30, borderRadius: 8, border: 0, background: "transparent", color: "var(--c-primary)", display: "flex", alignItems: "center", justifyContent: "center" };

    const Kpi = ({ label, value, delta, icon, color, goodUp = true }: {
        label: string; value: string; delta: number | null; icon: ReactNode; color: string; goodUp?: boolean;
    }) => {
        const up = (delta ?? 0) >= 0;
        const good = goodUp ? up : !up;
        const dColor = good ? "var(--c-success)" : "var(--c-error)";
        return (
            <div style={{ ...card, padding: "12px 13px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: `color-mix(in srgb, ${color} 14%, transparent)`, color, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
                    {delta != null && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 2, padding: "2px 6px", borderRadius: 8, fontSize: 10, fontWeight: 700, color: dColor, background: `color-mix(in srgb, ${dColor} 12%, transparent)` }}>
                            {up ? <ArrowUp size={10} /> : <ArrowDown size={10} />}{Math.abs(Math.round(delta))}%
                        </span>
                    )}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
                <div style={{ fontSize: 11.5, color: "var(--c-text-2)", marginTop: 2 }}>{label}</div>
            </div>
        );
    };

    return (
        <div style={{ minHeight: "100%", background: "var(--c-bg)", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)" }}>
                <span style={{ fontSize: 18, fontWeight: 700 }}>{t("mobile.tabFinance", "Finance")}</span>
            </div>

            <div style={{ flex: 1, padding: 16, paddingBottom: "calc(110px + env(safe-area-inset-bottom, 0px))", display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Toolbar: report · period · month arrows */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => navigate("/reports")} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, font: "inherit", fontSize: 12, fontWeight: 700, color: "var(--c-primary)", background: "var(--c-primary-soft)", border: 0, borderRadius: 999, padding: "7px 11px", whiteSpace: "nowrap" }}>
                        <FileText size={14} />{t("mobile.financeToolbarReport", "Report")}
                    </button>
                    <div style={{ flex: 1 }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 2, background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 999, padding: "2px 4px" }}>
                        <button onClick={() => setRefDate(subMonths(refDate, 1))} aria-label="Previous month" style={navBtn}><ChevronLeft size={20} /></button>
                        <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 82, textAlign: "center" }}>{format(refDate, "MMMM yyyy")}</span>
                        <button onClick={() => { if (!atCurrentMonth) setRefDate(addMonths(refDate, 1)); }} aria-label="Next month" style={{ ...navBtn, opacity: atCurrentMonth ? 0.35 : 1, cursor: atCurrentMonth ? "not-allowed" : "pointer" }}><ChevronRight size={20} /></button>
                    </div>
                </div>

                {/* Blue gradient net-profit hero */}
                <div style={{ borderRadius: 18, padding: "14px 16px", background: "linear-gradient(135deg, #1B61E5, #124BB8)", color: "#fff", boxShadow: "var(--sh-md, var(--sh-sm))" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".6px", color: "rgba(255,255,255,.85)" }}>{t("mobile.estimatedNetProfit", "ESTIMATED NET PROFIT")}</div>
                    <div style={{ fontSize: 30, fontWeight: 700, marginTop: 2 }}>{netProfit < 0 ? "−" : ""}{formatAmount(Math.abs(netProfit))}</div>
                    <div style={{ display: "flex", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.15)" }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.7)" }}>{t("mobile.monthlyIncome", "Monthly Income")}</div>
                            <div style={{ fontSize: 17, fontWeight: 700 }}>{formatAmount(revenue)}</div>
                        </div>
                        <span style={{ width: 1, height: 32, background: "rgba(255,255,255,.2)", margin: "0 12px" }} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.7)" }}>{t("mobile.monthlyExpenses", "Monthly Expenses")}</div>
                            <div style={{ fontSize: 17, fontWeight: 700 }}>{formatAmount(expensesTotal)}</div>
                        </div>
                    </div>
                </div>

                {/* KPI grid (2×2) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Kpi label={t("mobile.finKpiRevenue", "Revenue")} value={formatAmount(revenue)} delta={revDelta} icon={<TrendingUp size={15} />} color="var(--c-primary)" />
                    <Kpi label={t("mobile.finKpiCollected", "Collected")} value={formatAmount(collected)} delta={null} icon={<Wallet size={15} />} color="var(--c-success)" />
                    <Kpi label={t("mobile.finKpiExpenses", "Expenses")} value={formatAmount(expensesTotal)} delta={expDelta} icon={<ReceiptText size={15} />} color="var(--c-warning)" goodUp={false} />
                    <Kpi label={t("mobile.finKpiNetProfit", "Net Profit")} value={`${netProfit < 0 ? "−" : ""}${formatAmount(Math.abs(netProfit))}`} delta={profitDelta} icon={<PiggyBank size={15} />} color={netProfit >= 0 ? "var(--c-success)" : "var(--c-error)"} />
                </div>

                {/* Quick actions */}
                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => navigate("/attendance")} style={{ cursor: "pointer", flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, font: "inherit", fontSize: 13.5, fontWeight: 700, padding: "12px 8px", borderRadius: 12, border: 0, background: "var(--c-primary-soft)", color: "var(--c-primary)" }}>
                        <Users size={18} />{t("mobile.staffAttendance", "Staff Attendance")}
                    </button>
                    <button onClick={onAddExpense} style={{ cursor: "pointer", flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, font: "inherit", fontSize: 13.5, fontWeight: 700, padding: "12px 8px", borderRadius: 12, border: 0, background: "var(--c-primary)", color: "#fff" }}>
                        <Plus size={18} />{t("mobile.quickExpense", "Quick Expense")}
                    </button>
                </div>

                {/* Expenses by category — proportional bars, like the app's cards */}
                {byCategory.length > 0 && (
                    <div style={{ ...card, padding: 16 }}>
                        <div style={cardTitle}>{t("mobile.finCardExpensesByCategory", "Expenses by Category")}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {byCategory.map(([cat, amount]) => {
                                const p = expensesTotal > 0 ? Math.round((amount / expensesTotal) * 100) : 0;
                                return (
                                    <div key={cat}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                                            <span style={{ fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>{cat.replace(/_/g, " ")}</span>
                                            <span style={{ fontSize: 13, fontWeight: 700 }}>{formatAmount(Math.round(amount))} <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>{p}%</span></span>
                                        </div>
                                        <div style={{ height: 7, borderRadius: 4, background: "var(--c-surface-2)", overflow: "hidden" }}>
                                            <div style={{ width: `${p}%`, height: "100%", borderRadius: 4, background: "var(--c-warning)" }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Expense list */}
                <div style={{ ...card, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{t("expenses.all", "All expenses")}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-3)" }}>{expenses.length}</span>
                    </div>
                    {expLoading ? (
                        <div style={{ padding: "24px 0", textAlign: "center", color: "var(--c-text-3)", fontSize: 13 }}>{t("common.loading", "Loading…")}</div>
                    ) : expenses.length === 0 ? (
                        <div style={{ padding: "24px 0", textAlign: "center", color: "var(--c-text-3)", fontSize: 13 }}>{t("expenses.noneThisMonth", "No expenses recorded this month.")}</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            {expenses.map((e, i) => (
                                <div key={e.id} role="button" tabIndex={0}
                                    onClick={() => onEditExpense?.(e)}
                                    onKeyDown={(ev) => { if (ev.key === "Enter") onEditExpense?.(e); }}
                                    style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 0", borderTop: i > 0 ? "1px solid var(--c-border)" : "none", cursor: onEditExpense ? "pointer" : "default" }}>
                                    <span style={{ width: 34, height: 34, flex: "none", borderRadius: 10, background: "var(--c-warning-soft)", color: "var(--c-warning)", display: "flex", alignItems: "center", justifyContent: "center" }}><ReceiptText size={16} /></span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.vendor || e.description || String(e.category).replace(/_/g, " ")}</div>
                                        <div style={{ fontSize: 11.5, color: "var(--c-text-3)", textTransform: "capitalize" }}>{String(e.category).replace(/_/g, " ")} · {format(e.date.toDate(), "MMM d")}</div>
                                    </div>
                                    <span style={{ fontSize: 14, fontWeight: 700 }}>{formatAmount(e.amount)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
