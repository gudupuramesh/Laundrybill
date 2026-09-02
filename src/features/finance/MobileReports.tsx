/**
 * MOBILE Reports — a clone of the owner app's ReportsScreen
 * (mobile/src/screens/ReportsScreen.tsx): back header with a share/export
 * action · period chip · 2-column KPI grid (Revenue · Collections ·
 * Outstanding · Expenses · Net Profit · Orders · Avg Order · New Customers) ·
 * ORDERS BREAKDOWN with proportional bars (by status, by delivery type, by
 * source) · TOP SERVICES ranked rows · EXPENSES BY CATEGORY.
 *
 * Desktop keeps ReportsPage's wide layout.
 */

import type { CSSProperties, ReactNode } from "react";
import { MPageShell } from "@/components/laundry/LMobileRows";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronDown, Share2, ReceiptText, WashingMachine, Wallet } from "lucide-react";

const card: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 18, boxShadow: "var(--sh-sm)", padding: 16 };
const sectionTitle: CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: ".5px", margin: "16px 4px 8px" };

export interface MobileReportsData {
    revenue: number; collections: number; outstanding: number; totalExpenses: number;
    netProfit: number; orderCount: number; avgOrderValue: number; newCustomers: number;
    byStatus: { label: string; n: number; tint: string }[];
    byDeliveryType: { label: string; n: number }[];
    bySource: { label: string; n: number; color: string }[];
    topServices: { name: string; orders: number; revenue: number }[];
    expensesByCategory: [string, number][];
    paymentsByMethod: [string, number][];
}

export function MobileReports({ data, periodLabel, onPickPeriod, onExport, exporting, loading, onBack, formatAmount }: {
    data: MobileReportsData;
    periodLabel: string;
    onPickPeriod: () => void;
    onExport?: () => void;
    exporting?: boolean;
    loading?: boolean;
    onBack: () => void;
    formatAmount: (n: number) => string;
}) {
    const { t } = useTranslation();
    const totalOrders = Math.max(1, data.orderCount);

    const bar = (label: string, n: number, total: number, color: string, key: string) => {
        const pct = total > 0 ? Math.round((n / total) * 100) : 0;
        return (
            <div key={key} style={{ marginBottom: 11 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{n} <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>{pct}%</span></span>
                </div>
                <div style={{ height: 7, borderRadius: 4, background: "var(--c-surface-2)", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: color }} />
                </div>
            </div>
        );
    };

    const kpis: { label: string; value: string; color?: string }[] = [
        { label: t("mobile.repKpiRevenue", "Revenue"), value: formatAmount(data.revenue), color: "var(--c-primary)" },
        { label: t("mobile.repKpiCollections", "Collections"), value: formatAmount(data.collections), color: "var(--c-success)" },
        { label: t("mobile.repKpiOutstanding", "Outstanding"), value: formatAmount(data.outstanding), color: "var(--c-warning)" },
        { label: t("mobile.repKpiExpenses", "Expenses"), value: formatAmount(data.totalExpenses), color: "var(--c-error)" },
        { label: t("mobile.repKpiNetProfit", "Net Profit"), value: `${data.netProfit < 0 ? "−" : ""}${formatAmount(Math.abs(data.netProfit))}`, color: data.netProfit >= 0 ? "var(--c-success)" : "var(--c-error)" },
        { label: t("mobile.repKpiOrders", "Orders"), value: String(data.orderCount) },
        { label: t("mobile.repKpiAvgOrder", "Avg Order Value"), value: formatAmount(data.avgOrderValue) },
        { label: t("mobile.repKpiNewCustomers", "New Customers"), value: String(data.newCustomers) },
    ];

    const emptyBox = (icon: ReactNode, text: string) => (
        <div style={{ padding: "24px 0", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            {icon}<span style={{ fontSize: 13, color: "var(--c-text-3)" }}>{text}</span>
        </div>
    );

    return (
        <MPageShell title={t("mobile.reportsTitle", "Reports")} onBack={onBack}
            right={onExport ? (
                <button onClick={onExport} disabled={exporting || loading} aria-label={t("reports.export", "Export")}
                    style={{ cursor: exporting ? "wait" : "pointer", flex: "none", width: 40, height: 40, borderRadius: 20, border: 0, background: "var(--c-surface-2)", color: "var(--c-primary)", display: "flex", alignItems: "center", justifyContent: "center", opacity: exporting || loading ? 0.6 : 1 }}>
                    <Share2 size={19} />
                </button>
            ) : undefined}>
            {/* Period chip */}
            <button onClick={onPickPeriod}
                style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, font: "inherit", fontSize: 13, fontWeight: 700, padding: "9px 13px", borderRadius: 999, border: "1px solid var(--c-primary)", background: "var(--c-primary-soft)", color: "var(--c-primary)", marginBottom: 14 }}>
                <CalendarDays size={15} />{periodLabel}<ChevronDown size={16} style={{ opacity: .7 }} />
            </button>

            {loading ? (
                <div style={{ padding: "64px 0", textAlign: "center", color: "var(--c-text-3)", fontSize: 13 }}>{t("common.loading", "Loading…")}</div>
            ) : (
                <>
                    {/* KPI grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {kpis.map((k) => (
                            <div key={k.label} style={{ ...card, padding: "13px 14px" }}>
                                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", color: "var(--c-text-2)" }}>{k.label}</div>
                                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: k.color || "var(--c-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Orders breakdown */}
                    <div style={sectionTitle}>{t("mobile.repOrdersBreakdown", "Orders breakdown")}</div>
                    <div style={card}>
                        {data.orderCount === 0 ? emptyBox(<ReceiptText size={32} style={{ color: "var(--c-text-3)" }} />, t("mobile.repNoOrders", "No orders in this period")) : (
                            <>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--c-text-3)", marginBottom: 10 }}>{t("mobile.repByStatus", "By Status")}</div>
                                {data.byStatus.filter((s) => s.n > 0).map((s) => bar(s.label, s.n, totalOrders, `var(--${s.tint})`, `st-${s.label}`))}
                                <div style={{ height: 1, background: "var(--c-border)", margin: "6px 0 14px" }} />
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--c-text-3)", marginBottom: 10 }}>{t("mobile.repByDeliveryType", "By Delivery Type")}</div>
                                {data.byDeliveryType.filter((d) => d.n > 0).map((d) => bar(d.label, d.n, totalOrders, "var(--c-info)", `dt-${d.label}`))}
                                <div style={{ height: 1, background: "var(--c-border)", margin: "6px 0 14px" }} />
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--c-text-3)", marginBottom: 10 }}>{t("mobile.repBySource", "By Source")}</div>
                                {data.bySource.map((s) => bar(s.label, s.n, totalOrders, s.color, `src-${s.label}`))}
                            </>
                        )}
                    </div>

                    {/* Top services */}
                    <div style={sectionTitle}>{t("mobile.repTopServices", "Top services")}</div>
                    <div style={{ ...card, padding: 0 }}>
                        {data.topServices.length === 0 ? <div style={{ padding: 16 }}>{emptyBox(<WashingMachine size={32} style={{ color: "var(--c-text-3)" }} />, t("mobile.repNoServices", "No service data in this period"))}</div> : (
                            data.topServices.map((sv, i) => (
                                <div key={sv.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderTop: i > 0 ? "1px solid var(--c-border)" : "none" }}>
                                    <span style={{ width: 26, height: 26, flex: "none", borderRadius: 8, background: "var(--c-primary-soft)", color: "var(--c-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sv.name}</div>
                                        <div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{sv.orders} {t("mobile.repOrdersLower", "orders")}</div>
                                    </div>
                                    <span style={{ fontSize: 14, fontWeight: 700 }}>{formatAmount(sv.revenue)}</span>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Collections by payment method */}
                    <div style={sectionTitle}>{t("mobile.repPaymentsMix", "Collected by payment method")}</div>
                    <div style={{ ...card, padding: 0 }}>
                        {data.paymentsByMethod.length === 0 ? <div style={{ padding: 16 }}>{emptyBox(<Wallet size={32} style={{ color: "var(--c-text-3)" }} />, t("mobile.repNoPayments", "No payments recorded in this period"))}</div> : (
                            data.paymentsByMethod.map(([m, amt], i) => (
                                <div key={m} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderTop: i > 0 ? "1px solid var(--c-border)" : "none" }}>
                                    <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, textTransform: "capitalize" }}>{m.replace(/_/g, " ")}</span>
                                    <span style={{ fontSize: 14, fontWeight: 700 }}>{formatAmount(Math.round(amt))}</span>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Expenses by category */}
                    <div style={sectionTitle}>{t("mobile.repExpensesByCategory", "Expenses by category")}</div>
                    <div style={{ ...card, padding: 0, marginBottom: 8 }}>
                        {data.expensesByCategory.length === 0 ? <div style={{ padding: 16 }}>{emptyBox(<Wallet size={32} style={{ color: "var(--c-text-3)" }} />, t("mobile.repNoExpenses", "No expenses in this period"))}</div> : (
                            data.expensesByCategory.map(([cat, amt], i) => (
                                <div key={cat} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderTop: i > 0 ? "1px solid var(--c-border)" : "none" }}>
                                    <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.replace(/_/g, " ")}</span>
                                    <span style={{ fontSize: 14, fontWeight: 700 }}>{formatAmount(Math.round(amt))}</span>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </MPageShell>
    );
}
