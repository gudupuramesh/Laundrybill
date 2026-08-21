/**
 * MOBILE customers list — a 1:1 clone of the owner app's CustomerListScreen
 * (mobile/src/screens/CustomerListScreen.tsx): header with add + search toggle ·
 * stats card (Total Cust | Active | Inactive | Avg Order) · All/Active/Inactive
 * chips · one list card of avatar rows with a green "spent" pill · FAB.
 *
 * Desktop keeps CustomersList's table; this renders only when isMobile.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomers, useCustomerStats } from "@/hooks/use-customers";
import { useCurrency } from "@/hooks/use-currency";
import { useTranslation } from "react-i18next";
import { Search, X, Plus, UserPlus, ChevronRight } from "lucide-react";
import { MAvatar } from "@/components/laundry/LMobileRows";

const AV = ["c-primary", "c-info", "c-violet", "c-cyan", "c-success", "c-warning"];

export function MobileCustomers({ basePath = "", onAdd }: { basePath?: string; onAdd?: () => void }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { formatAmount } = useCurrency();

    const [showSearch, setShowSearch] = useState(false);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

    const { customers, loading, hasMore, loadingMore, loadMore } = useCustomers(search);

    // Infinite scroll — same behaviour as the app: more customers stream in
    // as you approach the bottom, no "Load more" button.
    const loadMoreRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const el = loadMoreRef.current;
        if (!el || !hasMore) return;
        const obs = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) void loadMore(); }, { rootMargin: "300px" });
        obs.observe(el);
        return () => obs.disconnect();
    }, [hasMore, loadMore]);
    const baseStats = useCustomerStats();

    // Same four numbers the app's stats card shows.
    const stats = useMemo(() => {
        let totalOrders = 0, totalSpent = 0;
        customers.forEach((c) => { totalOrders += c.totalOrders || 0; totalSpent += c.totalSpent || 0; });
        return {
            total: baseStats.totalCustomers,
            active: baseStats.activeCustomers,
            inactive: Math.max(0, baseStats.totalCustomers - baseStats.activeCustomers),
            avgValue: totalOrders > 0 ? Math.round(totalSpent / totalOrders) : 0,
        };
    }, [customers, baseStats]);

    const filtered = useMemo(() => {
        if (filter === "all") return customers;
        const wantActive = filter === "active";
        return customers.filter((c) => ((c.totalOrders || 0) > 0) === wantActive);
    }, [customers, filter]);

    const card: CSSProperties = { background: "var(--c-surface)", borderRadius: 18, border: "1px solid var(--c-border)", boxShadow: "var(--sh-sm)" };
    const chip = (on: boolean): CSSProperties => ({
        cursor: "pointer", flex: "none", font: "inherit", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
        padding: "8px 14px", borderRadius: 999,
        border: `1px solid ${on ? "var(--c-primary)" : "var(--c-border)"}`,
        background: on ? "var(--c-primary)" : "var(--c-surface)",
        color: on ? "#fff" : "var(--c-text-2)",
    });
    const iconBtn = (on?: boolean): CSSProperties => ({
        cursor: "pointer", flex: "none", width: 40, height: 40, borderRadius: 20, border: 0,
        background: on ? "var(--c-primary-soft)" : "var(--c-surface-2)", color: on ? "var(--c-primary)" : "var(--c-text-2)",
        display: "flex", alignItems: "center", justifyContent: "center",
    });
    const addCustomer = () => (onAdd ? onAdd() : navigate(`${basePath}/customers?new=true`));

    const FILTERS = [
        { key: "all", label: t("mobile.customersFilterAll", "All") },
        { key: "active", label: t("mobile.customersFilterActive", "Active") },
        { key: "inactive", label: t("mobile.customersFilterInactive", "Inactive") },
    ] as const;

    return (
        <div style={{ minHeight: "100%", background: "var(--c-bg)", display: "flex", flexDirection: "column", position: "relative" }}>
            {/* Header (app s.header) */}
            <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)" }}>
                <div style={{ flex: 1, fontSize: 18, fontWeight: 700 }}>{t("mobile.customersScreenTitle", "Customers")}</div>
                <button onClick={addCustomer} aria-label={t("customers.add", "Add Customer")} style={iconBtn()}><UserPlus size={20} /></button>
                <button onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearch(""); }} aria-label={t("common.search", "Search")} style={iconBtn(showSearch)}><Search size={20} /></button>
            </div>

            <div style={{ flex: 1, padding: 16, paddingBottom: "calc(120px + env(safe-area-inset-bottom, 0px))", display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Search (toggle) */}
                {showSearch && (
                    <div style={{ position: "relative" }}>
                        <Search size={20} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--c-text-3)" }} />
                        {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                        <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("mobile.customersSearchPlaceholder", "Search name or phone…")}
                            style={{ width: "100%", height: 46, font: "inherit", fontSize: 14, fontWeight: 600, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "0 40px 0 46px", outline: "none" }} />
                        {search && <button onClick={() => setSearch("")} aria-label="Clear" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", cursor: "pointer", border: 0, background: "transparent", color: "var(--c-text-3)", display: "flex" }}><X size={18} /></button>}
                    </div>
                )}

                {/* Stats card (app s.statsCard) */}
                {!loading && (
                    <div style={{ ...card, padding: "10px 8px", display: "flex", alignItems: "stretch" }}>
                        {[
                            { label: t("mobile.customersStatTotal", "Total Cust"), value: String(stats.total) },
                            { label: t("mobile.customersStatActive", "Active"), value: String(stats.active) },
                            { label: t("mobile.customersStatInactive", "Inactive"), value: String(stats.inactive) },
                            { label: t("mobile.customersStatAvgValue", "Avg Order"), value: formatAmount(stats.avgValue) },
                        ].map((st, i) => (
                            <div key={st.label} style={{ flex: 1, display: "flex", minWidth: 0 }}>
                                {i > 0 && <span style={{ width: 1, background: "var(--c-border)", margin: "0 4px", flex: "none" }} />}
                                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: ".3px", whiteSpace: "nowrap" }}>{st.label}</span>
                                    <span style={{ fontSize: 15, fontWeight: 700 }}>{st.value}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Filter chips */}
                <div className="lb-thin" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -16px", padding: "0 16px 2px" }}>
                    {FILTERS.map((f) => <button key={f.key} onClick={() => setFilter(f.key)} style={chip(filter === f.key)}>{f.label}</button>)}
                </div>

                {/* List card (app s.listCard) */}
                {loading ? (
                    <div style={{ padding: "48px 0", textAlign: "center", color: "var(--c-text-3)", fontSize: 13 }}>{t("common.loading", "Loading…")}</div>
                ) : filtered.length === 0 ? (
                    <div style={{ ...card, padding: "48px 16px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                        <Search size={40} style={{ color: "var(--c-text-3)" }} />
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-2)" }}>{t("mobile.customersEmpty", "No customers found")}</div>
                        <div style={{ fontSize: 12, color: "var(--c-text-3)" }}>{t("mobile.customersEmptyHint", "Try a different search or filter.")}</div>
                    </div>
                ) : (
                    <div style={{ ...card, overflow: "hidden" }}>
                        {filtered.map((c, i) => {
                            const totalSpent = Math.round(c.totalSpent || 0);
                            const totalOrders = c.totalOrders || 0;
                            return (
                                <div key={c.id} role="button" tabIndex={0}
                                    onClick={() => navigate(`${basePath}/customers/${c.id}`)}
                                    onKeyDown={(e) => { if (e.key === "Enter") navigate(`${basePath}/customers/${c.id}`); }}
                                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer", borderBottom: i < filtered.length - 1 ? "1px solid var(--c-border)" : "none" }}>
                                    <MAvatar name={c.name || "?"} tint={AV[i % AV.length]} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || t("mobile.unknownName", "Unknown")}</div>
                                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text-2)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {c.phone || t("mobile.noPhoneLabel", "No phone")} · {totalOrders} {t("mobile.ordersLower", "orders")}
                                        </div>
                                    </div>
                                    <span style={{ flex: "none", padding: "4px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", background: totalSpent > 0 ? "var(--c-success-soft)" : "var(--c-error-soft)", color: totalSpent > 0 ? "var(--c-success)" : "var(--c-error)" }}>
                                        {formatAmount(totalSpent)}{totalSpent > 0 ? ` ${t("mobile.spentLabel", "Spent")}` : ""}
                                    </span>
                                    <ChevronRight size={16} style={{ flex: "none", color: "var(--c-text-3)" }} />
                                </div>
                            );
                        })}
                        {hasMore && (
                            <div ref={loadMoreRef} style={{ display: "flex", justifyContent: "center", padding: 12, borderTop: "1px solid var(--c-border)", fontSize: 12, color: "var(--c-text-3)" }}>
                                {loadingMore ? t("common.loading", "Loading…") : ""}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* FAB */}
            <button onClick={addCustomer} aria-label={t("customers.add", "Add Customer")}
                style={{ position: "fixed", right: 18, bottom: "calc(86px + env(safe-area-inset-bottom, 0px))", zIndex: 41, cursor: "pointer", width: 56, height: 56, borderRadius: 28, border: 0, background: "var(--c-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px rgba(27,97,229,.35)" }}>
                <Plus size={28} />
            </button>
        </div>
    );
}
