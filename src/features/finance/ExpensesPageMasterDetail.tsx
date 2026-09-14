/**
 * Expenses — 1000% to the design system (Expenses.dc.html):
 * header (Overview / All tabs + month stepper + Add) · KPI row · Overview
 * (category breakdown) · expense table with category filter. Wired to
 * useExpenses + useExpenseMutations. (Model has no method/approval columns.)
 */

import { useState, useMemo, useEffect, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { LConfirmDialog } from "@/components/laundry";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { useExpenses, useExpenseMutations, useExpenseInsights } from "@/hooks/use-finance";
import { MobileFinances } from "./MobileFinances";
import { useCurrency } from "@/hooks/use-currency";
import { useIsMobile } from "@/hooks/use-mobile";
import { ExpenseFormSheet } from "./ExpenseFormSheet";
import type { Expense } from "@/types/finance";
import { useTranslation } from "react-i18next";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, CalendarDays, TrendingDown, TrendingUp, Wallet, Users, Star, ArrowDown, ArrowUp, MoreVertical, Pencil, Trash2, Paperclip, Banknote, Smartphone, Landmark, FileDown } from "lucide-react";



export function ExpensesPageMasterDetail() {
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();
    const isMobile = useIsMobile();
    const now = useMemo(() => new Date(), []);
    const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
    const [formOpen, setFormOpen] = useState(false);
    const [editExpense, setEditExpense] = useState<Expense | undefined>(undefined);

    const { expenses, totals } = useExpenses(viewMonth);
    const { deleteExpense } = useExpenseMutations();
    const [refreshKey, setRefreshKey] = useState(0);
    // Re-pull salaries + trend whenever this month's expense list changes.
    const expSig = `${expenses.length}:${totals.total}`;
    useEffect(() => { setRefreshKey((k) => k + 1); }, [expSig]);
    const insights = useExpenseInsights(viewMonth, refreshKey);
    const navigate = useNavigate();
    const { currencySymbol } = useCurrency();
    const [group, setGroup] = useState<GroupId | "all">("all");
    const [page, setPage] = useState(1);
    const [rowMenu, setRowMenu] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
    const [exporting, setExporting] = useState(false);
    const handleExportPdf = async () => {
        setExporting(true);
        try {
            const { generateExpensesPDF } = await import("@/lib/expenses-pdf-generator");
            await generateExpensesPDF(expenses, viewMonth, "all", currencySymbol);
        } catch (err) { console.error("expenses pdf", err); }
        finally { setExporting(false); }
    };

    const catLabel = (c: string, custom?: string) => custom || t(`expense.categories.${c}`, c.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()));


    const sorted = useMemo(() => [...expenses].sort((a, b) => b.date.toMillis() - a.date.toMillis()), [expenses]);

    const openAdd = () => { setEditExpense(undefined); setFormOpen(true); };
    const openEdit = (e: Expense) => { setEditExpense(e); setFormOpen(true); };




    // MOBILE: render the owner app's ExpensesScreen (Finance) clone.
    if (isMobile) return (
        <>
            <MobileFinances onAddExpense={openAdd} onEditExpense={openEdit} />
            <ExpenseFormSheet open={formOpen} onClose={() => setFormOpen(false)} expense={editExpense} />
        </>
    );

    // ---- desktop (reference layout) ------------------------------------------
    const salaries = insights.salaries;
    const monthKey = format(viewMonth, "yyyy-MM");
    const prevKey = format(addMonths(viewMonth, -1), "yyyy-MM");
    const trendPrev = insights.trend.find((m) => m.month === prevKey);
    const grandTotal = totals.total + salaries.total;
    const prevTotal = trendPrev ? trendPrev.expenses + trendPrev.salaries : 0;
    const diff = grandTotal - prevTotal;
    const diffPct = prevTotal > 0 ? Math.round((Math.abs(diff) / prevTotal) * 100) : null;

    const groupTotals: Record<GroupId, number> = { rent: 0, electricity: 0, supplies: 0, salaries: 0, transport: 0, maintenance: 0, other: 0 };
    expenses.forEach((e) => { groupTotals[groupOf(e.category)] += e.amount; });
    groupTotals.salaries += salaries.total;
    const groupRows = GROUPS.map((g) => ({ ...g, label: t(g.key, g.label), amount: groupTotals[g.id], pct: grandTotal > 0 ? (groupTotals[g.id] / grandTotal) * 100 : 0 }))
        .filter((g) => g.amount > 0).sort((x, y) => y.amount - x.amount);
    const largest = groupRows[0];

    type Row = { kind: "expense"; e: Expense } | { kind: "payroll" };
    const allRows: Row[] = [
        ...(salaries.total > 0 ? [{ kind: "payroll" as const }] : []),
        ...sorted.map((e) => ({ kind: "expense" as const, e })),
    ];
    const rowDate = (r: Row) => r.kind === "payroll" ? (salaries.lastPaidAt || endOfMonth(viewMonth)) : r.e.date.toDate();
    allRows.sort((x, y) => rowDate(y).getTime() - rowDate(x).getTime());
    const shownRows = allRows.filter((r) => group === "all" || (r.kind === "payroll" ? group === "salaries" : groupOf(r.e.category) === group));
    const PER = 10;
    const pageCount = Math.max(1, Math.ceil(shownRows.length / PER));
    const pageNo = Math.min(page, pageCount);
    const pageRows = shownRows.slice((pageNo - 1) * PER, pageNo * PER);

    const modeTotals = { cash: 0, upi: 0, bank: 0 } as Record<"cash" | "upi" | "bank", number>;
    let unrecorded = 0;
    expenses.forEach((e) => { if (e.paymentMode) modeTotals[e.paymentMode] += e.amount; else unrecorded += e.amount; });
    (["cash", "upi", "bank"] as const).forEach((m) => { modeTotals[m] += salaries.byMode[m] || 0; });
    const modeSum = modeTotals.cash + modeTotals.upi + modeTotals.bank;

    const money = (v: number) => formatAmount(v).replace(/\.00$/, "");
    const shortAmt = (v: number) => { const sym = formatAmount(0).replace(/[\d.,\s]/g, ""); return v >= 1e5 ? `${sym}${(v / 1e5).toFixed(1).replace(/\.0$/, "")}L` : v >= 1e3 ? `${sym}${Math.round(v / 1e3)}K` : `${sym}${Math.round(v)}`; };
    const monthOptions = Array.from({ length: 12 }, (_, i) => startOfMonth(addMonths(now, -i)));
    const trendData = insights.trend.map((m) => ({ label: format(new Date(Number(m.month.slice(0, 4)), Number(m.month.slice(5, 7)) - 1, 1), "MMM ''yy"), total: m.expenses + m.salaries, current: m.month === monthKey }));

    const dsCard: CSSProperties = { background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 14, boxShadow: "0 1px 2px rgba(16,24,40,.04)" };
    const TH2: CSSProperties = { padding: "16px 10px", fontSize: 13, fontWeight: 500, textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid var(--ds-border)" };
    const TD2: CSSProperties = { padding: "12px 10px", fontSize: 14, borderBottom: "1px solid var(--ds-divider)", whiteSpace: "nowrap" };
    const chipFor = (g: GroupId, label?: string) => { const c = GROUP_COLORS[g]; return <span style={{ fontSize: 12, fontWeight: 500, padding: "3px 8px", borderRadius: 5, background: c.bg, color: c.fg, border: `1px solid ${c.bd}` }}>{label || t(GROUPS.find((x) => x.id === g)!.key, GROUPS.find((x) => x.id === g)!.label)}</span>; };
    const PG: CSSProperties = { minWidth: 30, height: 30, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", font: "inherit", fontSize: 13, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 7 };

    return (
        <div className="lb-ds" style={{ height: "100%", minHeight: 0, display: "flex", background: "var(--ds-bg)" }}>
            <div className="lb-scroll" style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "22px 22px 28px" }}>
                {/* header */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
                    <span style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-.02em", marginRight: "auto" }}>{t("expenses.title", "Expenses")}</span>
                    <label style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 12, height: 44, padding: "0 16px", border: "1px solid var(--ds-border)", borderRadius: 11, background: "var(--ds-card)", minWidth: 196, cursor: "pointer" }}>
                        <CalendarDays size={18} style={{ color: "var(--ds-text-2)" }} />
                        <span style={{ fontSize: 15, fontWeight: 500, flex: 1 }}>{format(viewMonth, "MMMM yyyy")}</span>
                        <ChevronDown size={17} />
                        <select value={monthKey} onChange={(e) => { const [y, m] = e.target.value.split("-").map(Number); setViewMonth(new Date(y, m - 1, 1)); setPage(1); }} aria-label={t("expenses.month", "Month")} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}>
                            {monthOptions.map((d) => <option key={format(d, "yyyy-MM")} value={format(d, "yyyy-MM")}>{format(d, "MMMM yyyy")}</option>)}
                        </select>
                    </label>
                    <button onClick={() => { void handleExportPdf(); }} disabled={exporting || allRows.length === 0} title={t("expenses.exportPdf", "Export PDF")} aria-label={t("expenses.exportPdf", "Export PDF")}
                        style={{ cursor: allRows.length ? "pointer" : "default", width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 11, opacity: exporting || !allRows.length ? 0.5 : 1 }}><FileDown size={18} /></button>
                    <button onClick={openAdd} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 10, font: "inherit", fontSize: 15, fontWeight: 600, color: "#fff", background: "var(--ds-blue)", border: 0, borderRadius: 11, height: 44, padding: "0 22px" }}><Plus size={18} />{t("expenses.addExpense", "Add expense")}</button>
                </div>

                {/* KPIs */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 22 }}>
                    {[
                        { label: t("expenses.totalExpenses", "Total expenses"), value: money(grandTotal), sub: null, icon: <Wallet size={22} />, bg: "var(--ds-blue-soft)", fg: "var(--ds-blue)" },
                        { label: t("expenses.vsLastMonth", "vs last month"), value: diffPct == null ? "—" : <span style={{ color: diff <= 0 ? "#16A34A" : "#DC2626", display: "inline-flex", alignItems: "center", gap: 4 }}>{diff <= 0 ? <ArrowDown size={20} /> : <ArrowUp size={20} />}{diffPct}%</span>, sub: prevTotal > 0 ? `${diff <= 0 ? "-" : "+"}${money(Math.abs(diff))}` : t("expenses.noLastMonth", "No data last month"), icon: diff <= 0 ? <TrendingDown size={22} /> : <TrendingUp size={22} />, bg: "#DCFCE7", fg: "#16A34A" },
                        { label: t("expenses.salaries", "Salaries"), value: money(salaries.total), sub: t("expenses.fromPayroll", "from payroll"), icon: <Users size={22} />, bg: "#EDE9FE", fg: "#7C3AED" },
                        { label: largest ? t("expenses.largestLabel", "Largest: {{c}}", { c: largest.label }) : t("expenses.largest", "Largest category"), value: largest ? money(largest.amount) : "—", sub: largest ? t("expenses.pctOfTotal", "{{p}}% of total", { p: largest.pct.toFixed(1) }) : null, icon: <Star size={22} />, bg: "#FEF3C7", fg: "#D97706" },
                    ].map((k) => (
                        <div key={k.label} style={{ ...dsCard, padding: "20px 18px", display: "flex", alignItems: "center", gap: 16 }}>
                            <span style={{ width: 50, height: 50, flex: "none", borderRadius: "50%", background: k.bg, color: k.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>{k.icon}</span>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.label}</div>
                                <div style={{ fontSize: 22, fontWeight: 500, marginTop: 4 }}>{k.value}</div>
                                {k.sub && <div style={{ fontSize: 13, color: "var(--ds-text-2)", marginTop: 6 }}>{k.sub}</div>}
                            </div>
                        </div>
                    ))}
                </div>

                {/* filter chips */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
                    {[{ id: "all" as const, label: t("common.all", "All") }, ...GROUPS.map((g) => ({ id: g.id, label: t(g.key, g.label) }))].map((c) => {
                        const on = group === c.id;
                        return <button key={c.id} onClick={() => { setGroup(c.id); setPage(1); }} style={{ cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 500, padding: "9px 14px", borderRadius: 9, border: `1px solid ${on ? "var(--ds-blue)" : "var(--ds-border)"}`, background: on ? "var(--ds-blue)" : "var(--ds-card)", color: on ? "#fff" : "var(--ds-text)" }}>{c.label}</button>;
                    })}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.75fr) minmax(300px, 1fr)", gap: 14, alignItems: "start" }} className="exp-main">
                    <style>{`@media (max-width: 1240px) { .exp-main { grid-template-columns: minmax(0,1fr) !important; } }`}</style>
                    {/* table */}
                    <div style={{ ...dsCard, overflow: "visible" }}>
                        <div className="lb-scroll" style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 660 }}>
                                <thead>
                                    <tr>
                                        <th style={{ ...TH2, paddingLeft: 16 }}>{t("expenses.colDate", "Date")}</th>
                                        <th style={TH2}>{t("expenses.colCategory", "Category")}</th>
                                        <th style={TH2}>{t("expenses.colDescription", "Description")}</th>
                                        <th style={TH2}>{t("expenses.colPaidBy", "Paid by")}</th>
                                        <th style={{ ...TH2, textAlign: "center" }}>{t("expenses.colReceipt", "Receipt")}</th>
                                        <th style={{ ...TH2, textAlign: "right" }}>{t("expenses.colAmount", "Amount")}</th>
                                        <th style={{ ...TH2, width: 40 }} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageRows.length === 0 && (
                                        <tr><td colSpan={7} style={{ padding: "44px 12px", textAlign: "center", fontSize: 14, color: "var(--ds-text-2)" }}>{group === "all" ? t("expenses.noneThisMonth", "No expenses recorded this month.") : t("expenses.noneInCategory", "Nothing in this category this month.")}</td></tr>
                                    )}
                                    {pageRows.map((r) => r.kind === "payroll" ? (
                                        <tr key="payroll" style={{ color: "var(--ds-text-2)" }}>
                                            <td style={{ ...TD2, paddingLeft: 16 }}>{format(rowDate(r), "d MMM yyyy")}</td>
                                            <td style={TD2}>{chipFor("salaries")}</td>
                                            <td style={TD2}>{t("expenses.payrollRow", "{{m}} payroll", { m: format(viewMonth, "MMMM") })} <span style={{ marginLeft: 8, fontSize: 11.5, padding: "3px 7px", border: "1px solid var(--ds-border)", borderRadius: 5, color: "var(--ds-text)" }}>{t("expenses.autoEntry", "Auto-entry")}</span></td>
                                            <td style={TD2}>—</td>
                                            <td style={{ ...TD2, textAlign: "center" }}>—</td>
                                            <td style={{ ...TD2, textAlign: "right" }}>{money(salaries.total)}</td>
                                            <td style={{ ...TD2, textAlign: "center" }}><button onClick={() => navigate("/payroll")} title={t("expenses.openPayroll", "Open payroll")} aria-label={t("expenses.openPayroll", "Open payroll")} style={{ cursor: "pointer", border: 0, background: "transparent", color: "var(--ds-text-2)", display: "inline-flex" }}><MoreVertical size={17} /></button></td>
                                        </tr>
                                    ) : (
                                        <tr key={r.e.id} onClick={() => openEdit(r.e)} style={{ cursor: "pointer", background: formOpen && editExpense?.id === r.e.id ? "var(--ds-blue-soft)" : undefined }}>
                                            <td style={{ ...TD2, paddingLeft: 16 }}>{format(r.e.date.toDate(), "d MMM yyyy")}</td>
                                            <td style={TD2} title={catLabel(r.e.category, r.e.customCategoryName)}>{chipFor(groupOf(r.e.category), groupOf(r.e.category) === "other" ? catLabel(r.e.category, r.e.customCategoryName) : undefined)}</td>
                                            <td style={{ ...TD2, whiteSpace: "normal", maxWidth: 240 }}>
                                                {r.e.description}{r.e.isRecurring && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--ds-blue)" }}>{t("expenses.recurringShort", "Recurring")}</span>}
                                                {r.e.vendor && <div style={{ fontSize: 12, color: "var(--ds-text-2)", marginTop: 2 }}>{r.e.vendor}</div>}
                                            </td>
                                            <td style={TD2}>{r.e.paymentMode ? ({ cash: t("expense.cash", "Cash"), upi: "UPI", bank: t("expense.bank", "Bank") } as Record<string, string>)[r.e.paymentMode] : <span style={{ color: "var(--ds-text-3)" }}>—</span>}</td>
                                            <td style={{ ...TD2, textAlign: "center" }} onClick={(ev) => ev.stopPropagation()}>
                                                {r.e.receiptUrl
                                                    ? <a href={r.e.receiptUrl} target="_blank" rel="noopener noreferrer" title={t("expenses.viewReceipt", "View receipt")} style={{ color: "var(--ds-text)", display: "inline-flex" }}><Paperclip size={16} /></a>
                                                    : <span style={{ color: "var(--ds-text-3)" }}>—</span>}
                                            </td>
                                            <td style={{ ...TD2, textAlign: "right" }}>{money(r.e.amount)}</td>
                                            <td style={{ ...TD2, textAlign: "center", position: "relative" }} onClick={(ev) => ev.stopPropagation()}>
                                                <button onClick={() => setRowMenu(rowMenu === r.e.id ? null : r.e.id)} aria-label={t("common.more", "More")} style={{ cursor: "pointer", border: 0, background: "transparent", color: "var(--ds-text)", display: "inline-flex" }}><MoreVertical size={17} /></button>
                                                {rowMenu === r.e.id && (
                                                    <div onMouseLeave={() => setRowMenu(null)} style={{ position: "absolute", right: 10, top: "calc(100% - 6px)", zIndex: 30, minWidth: 160, textAlign: "left", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 11, boxShadow: "0 12px 32px rgba(16,24,40,.14)", padding: 6 }}>
                                                        <button onClick={() => { setRowMenu(null); openEdit(r.e); }} style={menuRow}><Pencil size={15} />{t("common.edit", "Edit")}</button>
                                                        <button onClick={() => { setRowMenu(null); setDeleteTarget(r.e); }} style={{ ...menuRow, color: "var(--ds-negative)" }}><Trash2 size={15} />{t("common.delete", "Delete")}</button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "16px 16px" }}>
                            <span style={{ fontSize: 13.5, color: "var(--ds-text-2)" }}>{shownRows.length ? `${(pageNo - 1) * PER + 1}–${(pageNo - 1) * PER + pageRows.length}` : "0"} {t("common.of", "of")} {shownRows.length} {t("expenses.expensesLower", "expenses")}</span>
                            {pageCount > 1 && (
                                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                                    <button style={PG} disabled={pageNo === 1} onClick={() => setPage(1)}><ChevronsLeft size={14} /></button>
                                    <button style={PG} disabled={pageNo === 1} onClick={() => setPage(pageNo - 1)}><ChevronLeft size={14} /></button>
                                    {Array.from({ length: Math.min(5, pageCount) }, (_, k) => k + Math.max(1, Math.min(pageNo - 2, pageCount - 4))).map((n) => (
                                        <button key={n} onClick={() => setPage(n)} style={{ ...PG, color: n === pageNo ? "var(--ds-blue)" : "var(--ds-text)", borderColor: n === pageNo ? "var(--ds-blue)" : "var(--ds-border)" }}>{n}</button>
                                    ))}
                                    <button style={PG} disabled={pageNo >= pageCount} onClick={() => setPage(pageNo + 1)}><ChevronRight size={14} /></button>
                                    <button style={PG} disabled={pageNo >= pageCount} onClick={() => setPage(pageCount)}><ChevronsRight size={14} /></button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* charts */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
                        <div style={{ ...dsCard, padding: "16px 14px" }}>
                            <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 8 }}>{t("expenses.byCategory", "By category")}</div>
                            {groupRows.length === 0 ? <div style={{ fontSize: 13, color: "var(--ds-text-2)", padding: "24px 0", textAlign: "center" }}>{t("expenses.noneThisMonth", "No expenses recorded this month.")}</div> : (
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ position: "relative", width: 146, height: 146, flex: "none" }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={groupRows} dataKey="amount" nameKey="label" innerRadius={42} outerRadius={70} startAngle={90} endAngle={-270} stroke="#fff" strokeWidth={1.5}>
                                                    {groupRows.map((g) => <Cell key={g.id} fill={g.color} />)}
                                                </Pie>
                                                <Tooltip formatter={(v) => formatAmount(Number(v))} contentStyle={{ borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 12 }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                                            <span style={{ fontSize: 15.5, fontWeight: 600 }}>{money(grandTotal)}</span>
                                            <span style={{ fontSize: 11, color: "var(--ds-text-2)" }}>{t("expenses.total", "Total")}</span>
                                        </div>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 11 }}>
                                        {groupRows.map((g) => (
                                            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: 2, background: g.color, flex: "none" }} />
                                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.label}</span>
                                                <span style={{ marginLeft: "auto", whiteSpace: "nowrap", color: "var(--ds-text-2)" }}>{money(g.amount)} ({g.pct.toFixed(1)}%)</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ ...dsCard, padding: "16px 14px" }}>
                            <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 8 }}>{t("expenses.monthlyTrend", "Monthly trend")}</div>
                            <div style={{ height: 160 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={trendData} margin={{ top: 6, right: 4, left: -8, bottom: 0 }}>
                                        <CartesianGrid vertical={false} stroke="#EEF0F3" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#374151" }} tickLine={false} axisLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: "#374151" }} tickLine={false} axisLine={false} width={42} tickFormatter={(v: number) => shortAmt(v)} />
                                        <Tooltip cursor={{ fill: "rgba(37,99,235,.06)" }} formatter={(v) => formatAmount(Number(v))} contentStyle={{ borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 12 }} />
                                        <Bar dataKey="total" name={t("expenses.total", "Total")} radius={[2, 2, 0, 0]} maxBarSize={28}>
                                            {trendData.map((d) => <Cell key={d.label} fill={d.current ? "#1D4ED8" : "#93C5FD"} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div style={{ ...dsCard, padding: "16px 14px" }}>
                            <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 12 }}>{t("expenses.paymentBreakdown", "Payment breakdown")}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", border: "1px solid var(--ds-border)", borderRadius: 10 }}>
                                {([
                                    ["cash", t("expense.cash", "Cash"), <Banknote key="c" size={15} />, "#DCFCE7", "#16A34A"],
                                    ["upi", "UPI", <Smartphone key="u" size={15} />, "#EDE9FE", "#7C3AED"],
                                    ["bank", t("expense.bank", "Bank"), <Landmark key="b" size={15} />, "#DBEAFE", "#2563EB"],
                                ] as const).map(([m, label, icon, bg, fg], i) => (
                                    <div key={m} style={{ padding: "10px 10px", borderLeft: i ? "1px solid var(--ds-divider)" : 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}><span style={{ width: 24, height: 24, borderRadius: "50%", background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>{label}</div>
                                        <div style={{ fontSize: 14.5, fontWeight: 500, marginTop: 8 }}>{money(modeTotals[m])}</div>
                                        <div style={{ fontSize: 11.5, color: "var(--ds-text-2)", marginTop: 3 }}>{modeSum > 0 ? `${((modeTotals[m] / modeSum) * 100).toFixed(1)}%` : "0%"}</div>
                                    </div>
                                ))}
                            </div>
                            {unrecorded > 0 && <div style={{ fontSize: 12, color: "var(--ds-text-2)", marginTop: 8 }}>{t("expenses.unrecordedMode", "{{amt}} has no payment method recorded (older entries).", { amt: money(unrecorded) })}</div>}
                        </div>
                    </div>
                </div>
            </div>

            <ExpenseFormSheet asPanel open={formOpen} onClose={() => { setFormOpen(false); setEditExpense(undefined); }} expense={editExpense} />
            <LConfirmDialog
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={async () => { if (deleteTarget) await deleteExpense(deleteTarget.id); setDeleteTarget(null); setRefreshKey((k) => k + 1); }}
                title={t("expenses.deleteTitle", "Delete this expense?")}
                description={deleteTarget ? `${deleteTarget.description} · ${money(deleteTarget.amount)}` : ""}
                confirmText={t("common.delete", "Delete")}
                variant="destructive"
            />
        </div>
    );
}

type GroupId = "rent" | "electricity" | "supplies" | "salaries" | "transport" | "maintenance" | "other";
const GROUPS: { id: GroupId; key: string; label: string; color: string }[] = [
    { id: "rent", key: "expenses.grpRent", label: "Rent", color: "#2563EB" },
    { id: "electricity", key: "expenses.grpElectricity", label: "Electricity", color: "#F59E0B" },
    { id: "supplies", key: "expenses.grpSupplies", label: "Detergent & supplies", color: "#8B5CF6" },
    { id: "salaries", key: "expenses.grpSalaries", label: "Salaries", color: "#22A06B" },
    { id: "transport", key: "expenses.grpTransport", label: "Transport", color: "#EF4444" },
    { id: "maintenance", key: "expenses.grpMaintenance", label: "Maintenance", color: "#14B8A6" },
    { id: "other", key: "expenses.grpOther", label: "Other", color: "#9CA3AF" },
];
const GROUP_COLORS: Record<GroupId, { bg: string; fg: string; bd: string }> = {
    rent: { bg: "#EFF6FF", fg: "#1D4ED8", bd: "#BFDBFE" },
    electricity: { bg: "#FFFBEB", fg: "#B45309", bd: "#FDE68A" },
    supplies: { bg: "#F5F3FF", fg: "#6D28D9", bd: "#DDD6FE" },
    salaries: { bg: "#F0FDF4", fg: "#15803D", bd: "#BBF7D0" },
    transport: { bg: "#FEF2F2", fg: "#B91C1C", bd: "#FECACA" },
    maintenance: { bg: "#F0FDFA", fg: "#0F766E", bd: "#99F6E4" },
    other: { bg: "#F9FAFB", fg: "#4B5563", bd: "#E5E7EB" },
};
function groupOf(cat: string): GroupId {
    if (cat === "rent") return "rent";
    if (cat === "electricity" || cat === "water") return "electricity";
    if (["detergents", "fabric_softener", "stain_remover", "bleach", "hangers", "plastic_covers", "tags_ribbons", "iron_spray", "packaging"].includes(cat)) return "supplies";
    if (cat === "salary") return "salaries";
    if (cat === "transport" || cat === "delivery") return "transport";
    if (["maintenance", "equipment", "washing_machine", "dryer", "pressing_equipment"].includes(cat)) return "maintenance";
    return "other";
}

const menuRow: CSSProperties = { width: "100%", cursor: "pointer", font: "inherit", display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, fontWeight: 500, color: "var(--ds-text)", background: "transparent", border: 0, borderRadius: 8, padding: "9px 10px", textAlign: "left" };
