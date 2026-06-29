/**
 * Customers List — 1000% to the design system (Customers.dc.html):
 * header (title + count + search + Add Customer) · KPI tiles · full-width table
 * (Customer · Area · Orders · Lifetime · Last order). Wired to useCustomers +
 * useCustomerStats + CustomerFormSheet (+ plan limit guard).
 */

import { useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LEmptyState, LSpinner, useLToast } from "@/components/laundry";
import { useCustomers, useCustomerStats } from "@/hooks/use-customers";
import { useCurrency } from "@/hooks/use-currency";
import { useShopLimits } from "@/hooks/use-shop-limits";
import { useIsMobile } from "@/hooks/use-mobile";
import { CustomerFormSheet } from "./CustomerFormSheet";
import { Users, Search, Plus, ChevronRight, UserCheck, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";

const MONO = "'IBM Plex Mono'";
const AV = ["c-primary", "c-info", "c-violet", "c-cyan", "c-success", "c-warning"];

const TH: CSSProperties = { padding: "9px 14px", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--c-text-3)", borderBottom: "1px solid var(--c-border)", whiteSpace: "nowrap", background: "var(--c-surface-2)" };
const TD: CSSProperties = { padding: "10px 14px", borderBottom: "1px solid var(--c-border)" };

function timeAgo(d?: Date): string {
    if (!d) return "—";
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

interface CustomersListProps {
    selectedId?: string | null;
    onSelect?: (customerId: string) => void;
}

function Kpi({ icon, value, label, tint }: { icon: ReactNode; value: ReactNode; label: string; tint: string }) {
    return (
        <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "15px 16px", boxShadow: "var(--sh-sm)", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 38, height: 38, flex: "none", borderRadius: 10, background: `var(--${tint}-soft)`, color: `var(--${tint})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
            <div><div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 21, letterSpacing: "-.02em" }}>{value}</div><div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{label}</div></div>
        </div>
    );
}

export function CustomersList({ selectedId, onSelect }: CustomersListProps) {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const location = useLocation();
    const { formatAmount } = useCurrency();
    const basePath = location.pathname.startsWith("/staff") ? "/staff/customers" : "/customers";

    const [searchQuery, setSearchQuery] = useState("");
    const [formSheetOpen, setFormSheetOpen] = useState(false);

    const { customers, loading, hasMore, loadMore, createCustomer } = useCustomers(searchQuery);
    const stats = useCustomerStats();
    const { checkLimit } = useShopLimits();
    const { addToast } = useLToast();

    const customerLimit = checkLimit("maxCustomers", stats.totalCustomers);
    const handleAddCustomer = () => {
        if (!customerLimit.allowed) {
            addToast({ type: "error", title: t("customers.limitReached", "Customer limit reached"), description: t("customers.limitReachedDesc", `Your plan allows up to ${customerLimit.limit} customers. Upgrade to add more.`) });
            return;
        }
        setFormSheetOpen(true);
    };

    const handleCreateCustomer = async (data: Parameters<typeof createCustomer>[0]) => {
        try {
            const customer = await createCustomer(data);
            if (customer) {
                setFormSheetOpen(false);
                if (onSelect) onSelect(customer.id); else navigate(`${basePath}/${customer.id}`);
            }
        } catch (err) {
            if (err instanceof Error && err.message === "DUPLICATE_PHONE") {
                addToast({ type: "error", title: t("validation.duplicatePhone"), description: t("validation.duplicatePhoneCustomerDesc", "This mobile number is already used by another customer.") });
            }
        }
    };

    const handleOpen = (id: string) => { if (onSelect) onSelect(id); else navigate(`${basePath}/${id}`); };

    return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--c-bg)", minHeight: 0 }}>
            {/* header */}
            <header style={{ flex: "none", minHeight: 58, background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, padding: isMobile ? "10px 16px" : "10px 22px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                    <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.01em" }}>{t("customers.title", "Customers")}</span>
                    <span style={{ fontSize: 12, color: "var(--c-text-3)", fontFamily: MONO }}>{stats.totalCustomers} {t("customers.total", "total")}</span>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ position: "relative" }}>
                    <Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--c-text-3)" }} />
                    <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} type="search" placeholder={t("customers.searchPlaceholder", "Search name or phone…")}
                        style={{ width: 240, maxWidth: "60vw", font: "inherit", fontSize: 13, color: "var(--c-text)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: "8px 11px 8px 33px", outline: "none" }} />
                </div>
                <button onClick={handleAddCustomer} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 8, padding: "8px 14px", boxShadow: "var(--sh-sm)" }}>
                    <Plus size={15} />{t("customers.add", "Add Customer")}
                </button>
            </header>

            {/* body */}
            <div className="lb-scroll" style={{ flex: 1, overflow: "auto", padding: isMobile ? "16px 16px calc(88px + env(safe-area-inset-bottom, 0px))" : "20px 22px 40px", minHeight: 0 }}>
                {/* KPIs */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 14, marginBottom: 18 }}>
                    <Kpi icon={<Users size={18} />} value={stats.totalCustomers} label={t("customers.total", "Total customers")} tint="c-primary" />
                    <Kpi icon={<UserCheck size={18} />} value={stats.activeCustomers} label={t("customers.active", "Active customers")} tint="c-success" />
                    <Kpi icon={<UserPlus size={18} />} value={stats.newThisMonth} label={t("customers.newMonth", "New this month")} tint="c-violet" />
                </div>

                {/* table */}
                <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, boxShadow: "var(--sh-sm)", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--c-border)" }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{t("customers.all", "All customers")}</div>
                    </div>
                    {loading ? (
                        <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><LSpinner /></div>
                    ) : customers.length === 0 ? (
                        <LEmptyState icon={<Users className="h-8 w-8" />} title={searchQuery ? t("customers.noResults", "No matches") : t("customers.empty", "No customers yet")} description={searchQuery ? t("customers.tryDifferentSearch", "Try another name or number.") : t("customers.addFirst", "Add your first customer to get started.")} />
                    ) : (
                        <div className="lb-scroll" style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 760 }}>
                                <thead>
                                    <tr>
                                        <th style={{ ...TH, textAlign: "left", paddingLeft: 18 }}>{t("customer.title", "Customer")}</th>
                                        <th style={{ ...TH, textAlign: "left" }}>{t("customers.area", "Area")}</th>
                                        <th style={{ ...TH, textAlign: "right" }}>{t("customers.orders", "Orders")}</th>
                                        <th style={{ ...TH, textAlign: "right" }}>{t("customers.lifetime", "Lifetime")}</th>
                                        <th style={{ ...TH, textAlign: "left" }}>{t("customers.lastOrder", "Last order")}</th>
                                        <th style={{ ...TH, width: 40, paddingRight: 18 }} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {customers.map((c, i) => {
                                        const av = AV[i % AV.length];
                                        return (
                                            <tr key={c.id} onClick={() => handleOpen(c.id)} tabIndex={0} role="button"
                                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleOpen(c.id); } }}
                                                style={{ cursor: "pointer", background: selectedId === c.id ? "var(--c-primary-soft)" : "transparent" }}
                                                onMouseEnter={(e) => { if (selectedId !== c.id) e.currentTarget.style.background = "var(--c-surface-2)"; }}
                                                onMouseLeave={(e) => { if (selectedId !== c.id) e.currentTarget.style.background = "transparent"; }}>
                                                <td style={{ ...TD, paddingLeft: 18 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                                                        <span style={{ width: 34, height: 34, flex: "none", borderRadius: "50%", background: `var(--${av}-soft)`, color: `var(--${av})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 600 }}>{(c.name || "?").trim()[0]?.toUpperCase()}</span>
                                                        <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600 }}>{c.name}</div><div style={{ fontSize: 11, color: "var(--c-text-3)", fontFamily: MONO }}>{c.phone}</div></div>
                                                    </div>
                                                </td>
                                                <td style={{ ...TD, color: "var(--c-text-2)" }}>{c.area || "—"}</td>
                                                <td style={{ ...TD, textAlign: "right", fontFamily: MONO }}>{c.totalOrders}</td>
                                                <td style={{ ...TD, textAlign: "right", fontFamily: MONO, fontWeight: 600 }}>{formatAmount(c.totalSpent || 0)}</td>
                                                <td style={{ ...TD, color: "var(--c-text-3)", fontSize: 12.5 }}>{timeAgo(c.lastOrderAt?.toDate?.())}</td>
                                                <td style={{ ...TD, textAlign: "right", paddingRight: 18, color: "var(--c-text-3)" }}><ChevronRight size={16} /></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {hasMore && (
                                <div style={{ display: "flex", justifyContent: "center", padding: "12px 18px", borderTop: "1px solid var(--c-border)" }}>
                                    <button onClick={loadMore} style={{ cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-primary-soft)", border: 0, borderRadius: 8, padding: "8px 16px" }}>{t("common.loadMore", "Load more")}</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <CustomerFormSheet open={formSheetOpen} onClose={() => setFormSheetOpen(false)} onSubmit={handleCreateCustomer} />
        </div>
    );
}
