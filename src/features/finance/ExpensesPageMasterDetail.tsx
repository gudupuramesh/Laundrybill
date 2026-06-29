/**
 * Expenses — 1000% to the design system (Expenses.dc.html):
 * header (Overview / All tabs + month stepper + Add) · KPI row · Overview
 * (category breakdown) · expense table with category filter. Wired to
 * useExpenses + useExpenseMutations. (Model has no method/approval columns.)
 */

import { useState, useMemo, type CSSProperties } from "react";
import { useExpenses } from "@/hooks/use-finance";
import { useCurrency } from "@/hooks/use-currency";
import { useIsMobile } from "@/hooks/use-mobile";
import { ExpenseFormSheet } from "./ExpenseFormSheet";
import type { Expense, ExpenseCategory } from "@/types/finance";
import { useTranslation } from "react-i18next";
import { format, startOfMonth, addMonths, isSameMonth } from "date-fns";
import { Plus, ChevronLeft, ChevronRight, Receipt, Layers, TrendingDown, Hash } from "lucide-react";

const MONO = "'IBM Plex Mono'";

// category → DS tint (from the app's categoryConfig colors)
const CAT_TINT: Partial<Record<ExpenseCategory, string>> = {
    rent: "c-primary", electricity: "c-warning", water: "c-primary",
    detergents: "c-success", fabric_softener: "c-success", stain_remover: "c-success", bleach: "c-success", hangers: "c-success", plastic_covers: "c-success", tags_ribbons: "c-success", iron_spray: "c-success",
    equipment: "c-violet", maintenance: "c-cyan", washing_machine: "c-violet", dryer: "c-warning", pressing_equipment: "c-violet",
    transport: "c-warning", delivery: "c-warning", packaging: "c-cyan",
    marketing: "c-error", advertising: "c-error", salary: "c-primary", insurance: "c-primary", licenses: "c-primary",
    miscellaneous: "c-cyan",
};
const tintFor = (c: string) => CAT_TINT[c as ExpenseCategory] || "c-cyan";

export function ExpensesPageMasterDetail() {
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();
    const isMobile = useIsMobile();
    const now = useMemo(() => new Date(), []);
    const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
    const [tab, setTab] = useState<"overview" | "list">("overview");
    const [catFilter, setCatFilter] = useState<string>("all");
    const [formOpen, setFormOpen] = useState(false);
    const [editExpense, setEditExpense] = useState<Expense | undefined>(undefined);

    const { expenses, totals } = useExpenses(viewMonth);
    const atCurrentMonth = isSameMonth(viewMonth, now);
    const prevMonth = () => setViewMonth((m) => addMonths(m, -1));
    const nextMonth = () => { if (!atCurrentMonth) setViewMonth((m) => addMonths(m, 1)); };

    const catLabel = (c: string, custom?: string) => custom || t(`expense.categories.${c}`, c.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()));

    // category breakdown (sorted desc)
    const breakdown = useMemo(() => {
        const entries = Object.entries(totals.byCategory).map(([cat, amount]) => ({ cat, amount, label: catLabel(cat), tint: tintFor(cat) }));
        entries.sort((a, b) => b.amount - a.amount);
        const max = entries[0]?.amount || 1;
        return { entries, max };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totals.byCategory]);

    const top = breakdown.entries[0];
    const sorted = useMemo(() => [...expenses].sort((a, b) => b.date.toMillis() - a.date.toMillis()), [expenses]);
    const filtered = catFilter === "all" ? sorted : sorted.filter((e) => e.category === catFilter);
    const rows = tab === "overview" ? sorted.slice(0, 6) : filtered;

    const openAdd = () => { setEditExpense(undefined); setFormOpen(true); };
    const openEdit = (e: Expense) => { setEditExpense(e); setFormOpen(true); };

    const kpis = [
        { label: t("expenses.thisMonth", "This month"), value: formatAmount(totals.total), tint: "c-primary", icon: <Receipt size={16} /> },
        { label: t("expenses.transactions", "Transactions"), value: String(expenses.length), tint: "c-info", icon: <Hash size={16} /> },
        { label: t("expenses.topCategory", "Top category"), value: top ? catLabel(top.cat) : "—", tint: top ? top.tint : "c-cyan", icon: <Layers size={16} /> },
        { label: t("expenses.avgExpense", "Avg / expense"), value: expenses.length ? formatAmount(Math.round(totals.total / expenses.length)) : formatAmount(0), tint: "c-warning", icon: <TrendingDown size={16} /> },
    ];

    const TH: CSSProperties = { padding: "9px 14px", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--c-text-3)", borderBottom: "1px solid var(--c-border)", whiteSpace: "nowrap", background: "var(--c-surface-2)" };
    const TD: CSSProperties = { padding: "10px 14px", borderBottom: "1px solid var(--c-border)" };
    const navBtn: CSSProperties = { cursor: "pointer", width: 30, height: 30, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-text-2)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 7 };

    const filterChips = ["all", ...breakdown.entries.slice(0, 6).map((e) => e.cat)];

    return (
        <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", background: "var(--c-bg)" }}>
            {/* header */}
            <header style={{ flex: "none", minHeight: 58, background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, padding: isMobile ? "10px 14px" : "10px 22px" }}>
                <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.01em" }}>{t("expenses.title", "Expenses")}</span>
                <div role="tablist" style={{ display: "flex", gap: 2, marginLeft: 4 }}>
                    {([{ id: "overview", label: t("expenses.overview", "Overview") }, { id: "list", label: t("expenses.all", "All expenses") }] as const).map((tb) => {
                        const on = tab === tb.id;
                        return <button key={tb.id} role="tab" aria-selected={on} onClick={() => setTab(tb.id)} style={{ cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, color: on ? "var(--c-primary)" : "var(--c-text-2)", background: "transparent", border: 0, borderBottom: `2px solid ${on ? "var(--c-primary)" : "transparent"}`, padding: "8px 12px" }}>{tb.label}</button>;
                    })}
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button onClick={prevMonth} aria-label="Previous month" style={navBtn}><ChevronLeft size={16} /></button>
                    <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 116, textAlign: "center" }}>{format(viewMonth, "MMMM yyyy")}</span>
                    <button onClick={nextMonth} disabled={atCurrentMonth} aria-label="Next month" style={{ ...navBtn, opacity: atCurrentMonth ? 0.4 : 1, cursor: atCurrentMonth ? "not-allowed" : "pointer" }}><ChevronRight size={16} /></button>
                </div>
                <button onClick={openAdd} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 8, padding: "8px 14px", boxShadow: "var(--sh-sm)" }}><Plus size={15} />{t("expenses.add", "Add Expense")}</button>
            </header>

            <div className="lb-scroll" style={{ flex: 1, overflow: "auto", padding: isMobile ? "16px 14px calc(88px + env(safe-area-inset-bottom, 0px))" : "20px 22px 40px", minHeight: 0 }}>
                {/* KPI row */}
                <div className="lb-kpi" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }}>
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

                {/* OVERVIEW: category breakdown */}
                {tab === "overview" && (
                    <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "18px 20px", boxShadow: "var(--sh-sm)", marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{t("expenses.byCategory", "By category")}</div>
                        {breakdown.entries.length === 0 ? (
                            <div style={{ fontSize: 13, color: "var(--c-text-3)", padding: "10px 0" }}>{t("expenses.noneThisMonth", "No expenses recorded this month.")}</div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                                {breakdown.entries.map((c) => (
                                    <div key={c.cat}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: `var(--${c.tint})` }} />
                                            <span style={{ fontSize: 12.5, color: "var(--c-text-2)" }}>{c.label}</span>
                                            <span style={{ marginLeft: "auto", fontFamily: MONO, fontWeight: 600, fontSize: 12.5 }}>{formatAmount(c.amount)}</span>
                                        </div>
                                        <div style={{ height: 6, background: "var(--c-surface-2)", borderRadius: 6, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.max(4, (c.amount / breakdown.max) * 100)}%`, background: `var(--${c.tint})`, borderRadius: 6 }} /></div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* table */}
                <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, boxShadow: "var(--sh-sm)", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--c-border)", flexWrap: "wrap" }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{tab === "overview" ? t("expenses.recent", "Recent expenses") : t("expenses.all", "All expenses")}</div>
                        {tab === "list" && breakdown.entries.length > 0 && (
                            <div style={{ marginLeft: "auto", display: "flex", gap: 7, flexWrap: "wrap" }}>
                                {filterChips.map((c) => {
                                    const on = catFilter === c;
                                    return <button key={c} onClick={() => setCatFilter(c)} style={{ cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 20, border: `1px solid ${on ? "var(--c-primary)" : "var(--c-border)"}`, background: on ? "var(--c-primary-soft)" : "var(--c-surface)", color: on ? "var(--c-primary)" : "var(--c-text-2)" }}>{c === "all" ? t("common.all", "All") : catLabel(c)}</button>;
                                })}
                            </div>
                        )}
                    </div>
                    {rows.length === 0 ? (
                        <div style={{ padding: 40, textAlign: "center", color: "var(--c-text-3)", fontSize: 13.5 }}>{t("expenses.noneThisMonth", "No expenses recorded this month.")}</div>
                    ) : (
                        <div className="lb-scroll" style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
                                <thead>
                                    <tr>
                                        <th style={{ ...TH, textAlign: "left", paddingLeft: 18 }}>{t("finance.date", "Date")}</th>
                                        <th style={{ ...TH, textAlign: "left" }}>{t("finance.category", "Category")}</th>
                                        <th style={{ ...TH, textAlign: "left" }}>{t("expenses.vendorDesc", "Vendor / description")}</th>
                                        <th style={{ ...TH, textAlign: "right", paddingRight: 18 }}>{t("finance.amount", "Amount")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((e) => {
                                        const tint = tintFor(e.category);
                                        return (
                                            <tr key={e.id} onClick={() => openEdit(e)} tabIndex={0} role="button" onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openEdit(e); } }}
                                                style={{ cursor: "pointer" }} onMouseEnter={(ev) => (ev.currentTarget.style.background = "var(--c-surface-2)")} onMouseLeave={(ev) => (ev.currentTarget.style.background = "transparent")}>
                                                <td style={{ ...TD, paddingLeft: 18, color: "var(--c-text-2)", fontFamily: MONO, fontSize: 12.5, whiteSpace: "nowrap" }}>{format(e.date.toDate(), "MMM d")}</td>
                                                <td style={TD}>
                                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                                        <span style={{ width: 26, height: 26, flex: "none", borderRadius: 7, background: `var(--${tint}-soft)`, color: `var(--${tint})`, display: "flex", alignItems: "center", justifyContent: "center" }}><Receipt size={14} /></span>
                                                        <span style={{ fontWeight: 500 }}>{catLabel(e.category, e.customCategoryName)}</span>
                                                    </span>
                                                </td>
                                                <td style={TD}>
                                                    <div style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: 7 }}>{e.vendor || e.description}{e.isRecurring && <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--c-info)", background: "var(--c-info-soft)", padding: "2px 6px", borderRadius: 5 }}>{t("expenses.recurring", "RECURRING")}</span>}</div>
                                                    {e.vendor && <div style={{ fontSize: 11.5, color: "var(--c-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>{e.description}</div>}
                                                </td>
                                                <td style={{ ...TD, textAlign: "right", paddingRight: 18, fontFamily: MONO, fontWeight: 700 }}>{formatAmount(e.amount)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <ExpenseFormSheet open={formOpen} onClose={() => setFormOpen(false)} expense={editExpense} />
        </div>
    );
}
