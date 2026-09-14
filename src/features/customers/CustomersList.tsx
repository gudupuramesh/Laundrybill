/**
 * Customers List — 1000% to the design system (Customers.dc.html):
 * header (title + count + search + Add Customer) · KPI tiles · full-width table
 * (Customer · Area · Orders · Lifetime · Last order). Wired to useCustomers +
 * useCustomerStats + CustomerFormSheet (+ plan limit guard).
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LEmptyState, LSpinner, useLToast } from "@/components/laundry";
import { MobileCustomers } from "./MobileCustomers";
import { useCustomers, useCustomerStats, useCustomerDues } from "@/hooks/use-customers";
import { useCurrency } from "@/hooks/use-currency";
import { useShop } from "@/hooks/use-shop";
import { buildWaPhone } from "@/lib/whatsappShare";
import { useShopLimits } from "@/hooks/use-shop-limits";
import { useIsMobile } from "@/hooks/use-mobile";
import { CustomerFormSheet } from "./CustomerFormSheet";
import { Users, Search, Plus, UserPlus, Wallet, RefreshCw, SlidersHorizontal, MessageCircle, Eye, PlusCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ExportDataButton } from "@/components/ExportDataButton";
import { exportCustomers } from "@/lib/data-export";

const AV = ["c-primary", "c-info", "c-violet", "c-cyan", "c-success", "c-warning"];

const TH: CSSProperties = { padding: "13px 14px", fontSize: 13.5, fontWeight: 600, color: "var(--ds-text-2)", borderBottom: "1px solid var(--ds-border)", whiteSpace: "nowrap", background: "var(--ds-table-head)" };
const TD: CSSProperties = { padding: "13px 14px", borderBottom: "1px solid var(--ds-divider)" };
const ACT: CSSProperties = { width: 34, height: 34, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ds-blue)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 9 };
const PG: CSSProperties = { minWidth: 34, height: 34, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", font: "inherit", fontSize: 13.5, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 9 };

function timeAgo(d?: Date): string {
    if (!d) return "—";
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const days = Math.round((startOfToday.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 864e5);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days} days ago`;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

interface CustomersListProps {
    selectedId?: string | null;
    onSelect?: (customerId: string) => void;
}

function Kpi({ icon, value, label, sub, tint, danger }: { icon: ReactNode; value: ReactNode; label: string; sub?: string; tint: string; danger?: boolean }) {
    return (
        <div style={{ background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 2px rgba(16,24,40,.04)", display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 44, height: 44, flex: "none", borderRadius: "50%", background: `var(--${tint}-soft)`, color: `var(--${tint})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: "var(--ds-text-2)" }}>{label}</div>
                <div style={{ fontWeight: 700, fontSize: 26, letterSpacing: "-.02em", marginTop: 2, color: danger ? "var(--ds-negative)" : "var(--ds-text)" }}>{value}</div>
                {sub && <div style={{ fontSize: 12.5, color: "var(--ds-text-3)", marginTop: 2 }}>{sub}</div>}
            </div>
        </div>
    );
}

const CHIP_ON: CSSProperties = { cursor: "pointer", font: "inherit", fontSize: 13.5, fontWeight: 600, color: "#fff", background: "var(--ds-blue)", border: "1px solid var(--ds-blue)", borderRadius: 9, padding: "9px 16px" };
const CHIP_OFF: CSSProperties = { ...CHIP_ON, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)" };

export function CustomersList({ selectedId, onSelect }: CustomersListProps) {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const location = useLocation();
    const { formatAmount } = useCurrency();
    const basePath = location.pathname.startsWith("/staff") ? "/staff/customers" : "/customers";

    const [searchQuery, setSearchQuery] = useState("");
    const [formSheetOpen, setFormSheetOpen] = useState(false);
    const [tab, setTab] = useState<"all" | "dues" | "new" | "inactive">("all");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const searchRef = useRef<HTMLInputElement | null>(null);

    const { customers, loading, hasMore, loadingMore, loadMore, createCustomer } = useCustomers(searchQuery);

    // Infinite scroll: fetch the next 50 as the sentinel nears the viewport.
    const loadMoreRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const el = loadMoreRef.current;
        if (!el || !hasMore) return;
        const obs = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) void loadMore(); }, { rootMargin: "300px" });
        obs.observe(el);
        return () => obs.disconnect();
    }, [hasMore, loadMore]);
    const stats = useCustomerStats();
    const dues = useCustomerDues();
    const { shop } = useShop();

    // ⌘K / Ctrl-K focuses the search field, as the reference's hint promises.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current?.focus(); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

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

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const inactiveCutoff = Date.now() - 30 * 864e5;
    const filtered = customers.filter((c) => {
        if (tab === "dues") return (dues.byCustomer[c.id] || 0) > 0;
        if (tab === "new") return (c.createdAt?.toDate?.() || new Date(0)) >= startOfMonth;
        if (tab === "inactive") return (c.lastOrderAt?.toDate?.()?.getTime() || 0) < inactiveCutoff;
        return true;
    });
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const pageNo = Math.min(page, pageCount);
    const rows = filtered.slice((pageNo - 1) * pageSize, pageNo * pageSize);

    // Paging past what's loaded pulls the next batch from Firestore.
    useEffect(() => {
        if (hasMore && !loadingMore && pageNo * pageSize >= filtered.length) void loadMore();
    }, [hasMore, loadingMore, pageNo, pageSize, filtered.length, loadMore]);

    const openWhatsApp = (c: { name: string; phone: string }) => {
        if (!c.phone) { addToast({ type: "error", title: t("customers.noPhone", "No phone number") }); return; }
        window.open(`https://wa.me/${buildWaPhone(c.phone, shop || undefined)}`, "_blank");
    };

    const handleOpen = (id: string) => { if (onSelect) onSelect(id); else navigate(`${basePath}/${id}`); };

    // MOBILE: render the owner app's CustomerListScreen clone instead of the web list.
    if (isMobile) return (
        <>
            <MobileCustomers basePath={basePath.replace(/\/customers$/, "")} onAdd={handleAddCustomer} />
            <CustomerFormSheet open={formSheetOpen} onClose={() => setFormSheetOpen(false)} onSubmit={handleCreateCustomer} />
        </>
    );

    return (
        <div className="lb-ds" style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--ds-bg)", minHeight: 0 }}>
            <header style={{ flex: "none", background: "var(--ds-card)", borderBottom: "1px solid var(--ds-border)", display: "flex", alignItems: "center", gap: 14, padding: "14px 22px" }}>
                <div style={{ position: "relative", flex: 1, maxWidth: 800 }}>
                    <Search size={17} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ds-text-3)" }} />
                    <input ref={searchRef} value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} type="search" placeholder={t("customers.searchPlaceholder2", "Name, phone or email")}
                        style={{ width: "100%", font: "inherit", fontSize: 14.5, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 12, padding: "13px 60px 13px 42px", outline: "none" }} />
                    <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 12.5, color: "var(--ds-text-3)" }}>⌘ K</span>
                </div>
                <div style={{ flex: 1 }} />
                <ExportDataButton onExport={exportCustomers} kind={t("customers.title", "Customers").toLowerCase()} label={t("export.button", "Export")} />
                <button onClick={handleAddCustomer} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 9, font: "inherit", fontSize: 15, fontWeight: 600, color: "#fff", background: "var(--ds-blue)", border: 0, borderRadius: 12, padding: "13px 24px" }}>
                    <Plus size={18} />{t("customers.addCustomer", "Add customer")}
                </button>
            </header>

            <div className="lb-scroll" style={{ flex: 1, overflow: "auto", padding: "20px 22px 40px", minHeight: 0 }}>
                {/* KPI tiles */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 18 }}>
                    <Kpi icon={<Users size={20} />} value={stats.totalCustomers.toLocaleString()} label={t("customers.kpiTotal", "Total customers")} tint="ds-blue" />
                    <Kpi icon={<UserPlus size={20} />} value={stats.newThisMonth} label={t("customers.kpiNewMonth", "New this month")} tint="ds-st-ready" />
                    <Kpi icon={<Wallet size={20} />} value={formatAmount(dues.total)} sub={`${dues.count} ${t("customers.customersLower", "customers")}`} label={t("customers.kpiWithDues", "With dues")} tint="ds-st-overdue" danger />
                    <Kpi icon={<RefreshCw size={20} />} value={`${stats.totalCustomers ? Math.round((stats.repeatCustomers / stats.totalCustomers) * 100) : 0}%`} label={t("customers.kpiRepeat", "Repeat customers")} tint="ds-st-out" />
                </div>

                {/* filter row */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                    {([
                        ["all", t("common.all", "All")],
                        ["dues", t("customers.kpiWithDues", "With dues")],
                        ["new", t("customers.chipNew", "New")],
                        ["inactive", t("customers.inactive30", "Inactive 30+ days")],
                    ] as const).map(([id, label]) => (
                        <button key={id} onClick={() => { setTab(id); setPage(1); }} style={tab === id ? CHIP_ON : CHIP_OFF}>{label}</button>
                    ))}
                    <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 9, ...CHIP_OFF, cursor: "default" }}>
                        <SlidersHorizontal size={16} style={{ color: "var(--ds-text-2)" }} />{t("common.filters", "Filters")}
                        {tab !== "all" && <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "var(--ds-blue)", borderRadius: 6, padding: "1px 7px" }}>1</span>}
                    </span>
                </div>

                {/* table */}
                <div style={{ background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 14, boxShadow: "0 1px 2px rgba(16,24,40,.04)", overflow: "hidden" }}>
                    {loading ? (
                        <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><LSpinner /></div>
                    ) : rows.length === 0 ? (
                        <LEmptyState icon={<Users className="h-8 w-8" />} title={searchQuery ? t("customers.noResults", "No matches") : t("customers.empty", "No customers yet")} description={searchQuery ? t("customers.tryDifferentSearch", "Try another name or number.") : t("customers.addFirst", "Add your first customer to get started.")} />
                    ) : (
                        <>
                        <div className="lb-scroll" style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 980 }}>
                                <thead>
                                    <tr>
                                        <th style={{ ...TH, textAlign: "left", paddingLeft: 20 }}>{t("customer.title", "Customer")}</th>
                                        <th style={{ ...TH, textAlign: "left" }}>{t("customers.phone", "Phone")}</th>
                                        <th style={{ ...TH, textAlign: "left" }}>{t("customers.colOrders", "Orders")}</th>
                                        <th style={{ ...TH, textAlign: "left" }}>{t("customers.totalSpent", "Total spent")}</th>
                                        <th style={{ ...TH, textAlign: "left" }}>{t("customers.outstanding", "Outstanding")}</th>
                                        <th style={{ ...TH, textAlign: "left" }}>{t("customers.colLastOrder", "Last order")}</th>
                                        <th style={{ ...TH, textAlign: "left", paddingRight: 20 }}>{t("common.actions", "Actions")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((c, i) => {
                                        const av = AV[i % AV.length];
                                        const due = dues.byCustomer[c.id] || 0;
                                        const isNew = (c.totalOrders || 0) <= 1;
                                        return (
                                            <tr key={c.id} onClick={() => handleOpen(c.id)} tabIndex={0} role="button"
                                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleOpen(c.id); } }}
                                                style={{ cursor: "pointer", background: selectedId === c.id ? "var(--ds-blue-soft)" : "transparent" }}
                                                onMouseEnter={(e) => { if (selectedId !== c.id) e.currentTarget.style.background = "var(--ds-table-head)"; }}
                                                onMouseLeave={(e) => { if (selectedId !== c.id) e.currentTarget.style.background = "transparent"; }}>
                                                <td style={{ ...TD, paddingLeft: 20 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                        <span style={{ width: 36, height: 36, flex: "none", borderRadius: "50%", background: `var(--${av}-soft)`, color: `var(--${av})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600 }}>{(c.name || "?").trim()[0]?.toUpperCase()}</span>
                                                        <span style={{ fontWeight: 600 }}>{c.name}</span>
                                                        {isNew && <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ds-blue)", background: "var(--ds-blue-soft)", borderRadius: 7, padding: "3px 8px" }}>{t("customers.chipNew", "New")}</span>}
                                                    </div>
                                                </td>
                                                <td style={{ ...TD, color: "var(--ds-text-2)", whiteSpace: "nowrap" }}>{c.phone || "—"}</td>
                                                <td style={TD}>{c.totalOrders || 0}</td>
                                                <td style={TD}>{formatAmount(c.totalSpent || 0)}</td>
                                                <td style={{ ...TD, fontWeight: due > 0 ? 600 : 400, color: due > 0 ? "var(--ds-negative)" : "var(--ds-text-2)" }}>{formatAmount(due)}</td>
                                                <td style={{ ...TD, color: "var(--ds-text-2)", whiteSpace: "nowrap" }}>{timeAgo(c.lastOrderAt?.toDate?.())}</td>
                                                <td style={{ ...TD, paddingRight: 20 }} onClick={(e) => e.stopPropagation()}>
                                                    <div style={{ display: "flex", gap: 8 }}>
                                                        <button title={t("common.whatsapp", "WhatsApp")} onClick={() => openWhatsApp(c)} style={{ ...ACT, color: "var(--ds-whatsapp)" }}><MessageCircle size={16} /></button>
                                                        <button title={t("orders.newOrder", "New order")} onClick={() => navigate(`/new-order?customerId=${c.id}`)} style={ACT}><PlusCircle size={16} /></button>
                                                        <button title={t("common.view", "View")} onClick={() => handleOpen(c.id)} style={ACT}><Eye size={16} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {/* pagination */}
                        <div ref={loadMoreRef} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "14px 20px", borderTop: "1px solid var(--ds-border)", fontSize: 13.5, color: "var(--ds-text-2)" }}>
                            <span>{(pageNo - 1) * pageSize + 1}–{(pageNo - 1) * pageSize + rows.length} {t("common.of", "of")} {(hasMore ? stats.totalCustomers : filtered.length).toLocaleString()}</span>
                            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                                <button style={PG} disabled={pageNo === 1} onClick={() => setPage(1)}><ChevronsLeft size={15} /></button>
                                <button style={PG} disabled={pageNo === 1} onClick={() => setPage(pageNo - 1)}><ChevronLeft size={15} /></button>
                                {Array.from({ length: Math.min(5, pageCount) }, (_, k) => k + Math.max(1, Math.min(pageNo - 2, pageCount - 4))).map((n) => (
                                    <button key={n} onClick={() => setPage(n)} style={{ ...PG, width: 34, color: n === pageNo ? "var(--ds-blue)" : "var(--ds-text)", borderColor: n === pageNo ? "var(--ds-blue)" : "var(--ds-border)", fontWeight: 600 }}>{n}</button>
                                ))}
                                <button style={PG} disabled={pageNo >= pageCount && !hasMore} onClick={() => setPage(pageNo + 1)}><ChevronRight size={15} /></button>
                                <button style={PG} disabled={pageNo >= pageCount} onClick={() => setPage(pageCount)}><ChevronsRight size={15} /></button>
                                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                                    style={{ font: "inherit", fontSize: 13.5, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 10, padding: "8px 10px", cursor: "pointer" }}>
                                    {[25, 50, 100].map((n) => <option key={n} value={n}>{n} / {t("common.page", "page")}</option>)}
                                </select>
                            </div>
                        </div>
                        </>
                    )}
                </div>
            </div>

            <CustomerFormSheet open={formSheetOpen} onClose={() => setFormSheetOpen(false)} onSubmit={handleCreateCustomer} />
        </div>
    );
}
