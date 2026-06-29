/**
 * Customer Detail Page — 1000% to the design system (Customers.dc.html):
 * full-bleed header + profile card · stat tiles · order history + activity ·
 * contact & addresses · notes. Wired to useCustomer + useOrders + edit sheet.
 */

import { useState, type CSSProperties } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { LSpinner, LEmptyState } from "@/components/laundry";
import { useCustomer, useCustomers } from "@/hooks/use-customers";
import { useOrders } from "@/hooks/use-orders";
import { useCurrency } from "@/hooks/use-currency";
import { useIsMobile } from "@/hooks/use-mobile";
import { CustomerFormSheet } from "./CustomerFormSheet";
import { ChevronLeft, Phone, MessageCircle, Edit, Plus, Mail, MapPin, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { STATUS_LABELS, type OrderStatus } from "@/types/order";

const MONO = "'IBM Plex Mono'";
const TINTS = ["c-primary", "c-violet", "c-info", "c-cyan", "c-success", "c-warning"];
const tintFor = (s: string) => { let h = 0; for (const c of s || "x") h = (h * 31 + c.charCodeAt(0)) >>> 0; return TINTS[h % TINTS.length]; };
const card: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14, boxShadow: "var(--sh-sm)" };
const secLbl: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: ".05em", color: "var(--c-text-3)", marginBottom: 14 };
const TH: CSSProperties = { padding: "8px 14px", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--c-text-3)", borderBottom: "1px solid var(--c-border)", whiteSpace: "nowrap", background: "var(--c-surface-2)" };
const TD: CSSProperties = { padding: "9px 14px", borderBottom: "1px solid var(--c-border)" };

const STATUS_TINT: Record<OrderStatus, string> = {
    pending: "c-slate", processing: "c-info", ready: "c-primary", ready_for_pickup: "c-primary",
    out_for_delivery: "c-cyan", picked_up: "c-success", delivered: "c-success",
    pickup_scheduled: "c-warning", pickup_completed: "c-violet", cancelled: "c-error",
};

function timeAgo(d?: Date): string {
    if (!d) return "—";
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function CustomerDetailPage() {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const { customerId } = useParams<{ customerId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { formatAmount } = useCurrency();
    const { customer, loading } = useCustomer(customerId!);
    const { orders, loading: ordersLoading } = useOrders({ customerId });
    const { updateCustomer } = useCustomers();
    const [editOpen, setEditOpen] = useState(false);

    const basePath = location.pathname.startsWith("/staff") ? "/staff" : "";

    if (loading) {
        return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}><LSpinner size="lg" /></div>;
    }
    if (!customer) {
        return (
            <div style={{ textAlign: "center", padding: 48 }}>
                <p style={{ color: "var(--c-text-3)" }}>{t("customers.notFound", "Customer not found")}</p>
                <button onClick={() => navigate(`${basePath}/customers`)} style={{ marginTop: 16, cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-primary-soft)", border: 0, borderRadius: 8, padding: "8px 14px" }}>{t("customers.backToCustomers", "Back to customers")}</button>
            </div>
        );
    }

    const ref = tintFor(customer.name);
    const addresses = customer.addresses?.length ? customer.addresses : (customer.address ? [{ id: "legacy", address: customer.address, isDefault: true, label: "Home" }] : []);
    const avgOrder = customer.totalOrders > 0 ? (customer.totalSpent || 0) / customer.totalOrders : 0;
    const since = customer.createdAt?.toDate?.();

    const stats: { label: string; value: string }[] = [
        { label: t("customers.lifetimeValue", "Lifetime value"), value: formatAmount(customer.totalSpent || 0) },
        { label: t("customers.totalOrders", "Total orders"), value: String(customer.totalOrders) },
        { label: t("customers.avgOrder", "Avg order value"), value: formatAmount(avgOrder) },
        { label: t("customers.lastOrder", "Last order"), value: timeAgo(customer.lastOrderAt?.toDate?.()) },
    ];

    const handleUpdate = async (data: Parameters<typeof updateCustomer>[1]) => { await updateCustomer(customer.id, data); setEditOpen(false); };
    const iconBtn = (color: string, soft: string): CSSProperties => ({ cursor: "pointer", width: 38, height: 38, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: `var(--${color})`, background: `var(--${soft})`, border: 0, borderRadius: 9 });

    return (
        <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", background: "var(--c-bg)" }}>
            {/* header */}
            <header style={{ position: "sticky", top: 0, zIndex: 5, flex: "none", minHeight: 58, background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 12, padding: isMobile ? "0 16px" : "0 22px" }}>
                <button onClick={() => navigate(`${basePath}/customers`)} aria-label="Back" style={{ cursor: "pointer", width: 30, height: 30, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-text-2)", background: "transparent", border: 0, borderRadius: 7 }}><ChevronLeft size={18} /></button>
                <nav style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--c-text-3)", minWidth: 0 }}>
                    <button onClick={() => navigate(`${basePath}/customers`)} style={{ cursor: "pointer", font: "inherit", fontSize: 13, color: "var(--c-text-2)", background: "transparent", border: 0 }}>{t("customers.title", "Customers")}</button><span>/</span>
                    <span style={{ color: "var(--c-text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customer.name}</span>
                </nav>
                <div style={{ flex: 1 }} />
                <button onClick={() => navigate(`${basePath}/new-order?customerId=${customer.id}`)} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 8, padding: "8px 14px", boxShadow: "var(--sh-sm)" }}><Plus size={15} />{t("customers.newOrder", "New Order")}</button>
            </header>

            <div style={{ padding: isMobile ? "16px 16px 40px" : "20px 22px 40px" }}>
                {/* profile header */}
                <div style={{ ...card, padding: "20px 22px", display: "flex", alignItems: "center", gap: 18, marginBottom: 16, flexWrap: "wrap" }}>
                    <span style={{ width: 60, height: 60, flex: "none", borderRadius: 16, background: `var(--${ref}-soft)`, color: `var(--${ref})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 600 }}>{(customer.name || "?").trim()[0]?.toUpperCase()}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.01em" }}>{customer.name}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7, fontSize: 12.5, color: "var(--c-text-3)", flexWrap: "wrap" }}>
                            <span style={{ fontFamily: MONO }}>{customer.phone}</span>
                            {customer.email && <><span>·</span><span>{customer.email}</span></>}
                            {customer.area && <><span>·</span><span>{customer.area}</span></>}
                            {since && <><span>·</span><span>{t("customers.memberSince", "Member since")} {format(since, "MMM yyyy")}</span></>}
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => window.open(`tel:${customer.phone}`)} aria-label="Call" style={iconBtn("c-primary", "c-primary-soft")}><Phone size={17} /></button>
                        <button onClick={() => window.open(`https://wa.me/${(customer.phone || "").replace(/\D/g, "")}`)} aria-label="WhatsApp" style={iconBtn("c-success", "c-success-soft")}><MessageCircle size={17} /></button>
                        <button onClick={() => setEditOpen(true)} aria-label="Edit" style={{ cursor: "pointer", width: 38, height: 38, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 9 }}><Edit size={16} /></button>
                    </div>
                </div>

                {/* stat tiles */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 14, marginBottom: 16 }}>
                    {stats.map((s) => (
                        <div key={s.label} style={{ ...card, padding: "15px 16px" }}>
                            <div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{s.label}</div>
                            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, letterSpacing: "-.02em", marginTop: 8 }}>{s.value}</div>
                        </div>
                    ))}
                </div>

                <div className="lb-row" style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16, alignItems: "flex-start" }}>
                    {/* LEFT — order history + activity */}
                    <div style={{ flex: isMobile ? "none" : 1.7, width: isMobile ? "100%" : undefined, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ ...card, overflow: "hidden" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--c-border)" }}>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{t("customers.orderHistory", "Order history")}</div>
                                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-primary-soft)", padding: "2px 8px", borderRadius: 20 }}>{customer.totalOrders}</span>
                            </div>
                            {ordersLoading ? (
                                <div style={{ padding: 30, display: "flex", justifyContent: "center" }}><LSpinner /></div>
                            ) : orders.length === 0 ? (
                                <div style={{ padding: 24 }}><LEmptyState icon={<ClipboardList className="h-8 w-8" />} title={t("customers.noOrders", "No orders yet")} description={t("customers.noOrdersDesc", "This customer hasn't placed an order.")} /></div>
                            ) : (
                                <div className="lb-scroll" style={{ overflowX: "auto" }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
                                        <thead>
                                            <tr>
                                                <th style={{ ...TH, textAlign: "left", paddingLeft: 18 }}>{t("orders.order", "Order")}</th>
                                                <th style={{ ...TH, textAlign: "left" }}>{t("orders.date", "Date")}</th>
                                                <th style={{ ...TH, textAlign: "left" }}>{t("orders.items", "Items")}</th>
                                                <th style={{ ...TH, textAlign: "left" }}>{t("orders.status", "Status")}</th>
                                                <th style={{ ...TH, textAlign: "right", paddingRight: 18 }}>{t("pos.total", "Total")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {orders.slice(0, 8).map((o) => {
                                                const stRef = STATUS_TINT[o.status] || "c-slate";
                                                return (
                                                    <tr key={o.id} onClick={() => navigate(`${basePath}/orders/${o.id}`)} style={{ cursor: "pointer" }}
                                                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--c-surface-2)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                                                        <td style={{ ...TD, paddingLeft: 18, fontFamily: MONO, fontWeight: 600 }}>#{o.publicId}</td>
                                                        <td style={{ ...TD, color: "var(--c-text-2)" }}>{format(o.createdAt.toDate(), "MMM d, yyyy")}</td>
                                                        <td style={{ ...TD, color: "var(--c-text-2)", fontFamily: MONO }}>{o.items.length} {t("pos.items", "pcs")}</td>
                                                        <td style={TD}><span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: `var(--${stRef}-soft)`, color: `var(--${stRef})` }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: `var(--${stRef})` }} />{STATUS_LABELS[o.status]}</span></td>
                                                        <td style={{ ...TD, textAlign: "right", paddingRight: 18, fontFamily: MONO, fontWeight: 600 }}>{formatAmount(o.financials.total)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT — contact & notes */}
                    <div style={{ flex: isMobile ? "none" : 1, width: isMobile ? "100%" : undefined, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ ...card, padding: "18px 20px" }}>
                            <div style={secLbl}>{t("customers.contactAddresses", "CONTACT & ADDRESSES")}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 11 }}><span style={{ color: "var(--c-text-3)", flex: "none" }}><Phone size={16} /></span><span style={{ fontFamily: MONO, fontSize: 13 }}>{customer.phone}</span></div>
                                {customer.email && <div style={{ display: "flex", alignItems: "center", gap: 11 }}><span style={{ color: "var(--c-text-3)", flex: "none" }}><Mail size={16} /></span><span style={{ fontSize: 13, color: "var(--c-text-2)" }}>{customer.email}</span></div>}
                                {addresses.map((ad, i) => {
                                    const aref = ad.isDefault ? "c-primary" : "c-violet";
                                    return (
                                        <div key={ad.id || i} style={{ display: "flex", alignItems: "flex-start", gap: 11, paddingTop: 12, borderTop: "1px solid var(--c-border)" }}>
                                            <span style={{ color: `var(--${aref})`, flex: "none", marginTop: 1 }}><MapPin size={16} /></span>
                                            <div><div style={{ fontSize: 11, fontWeight: 600, color: `var(--${aref})` }}>{(ad.label || (ad.isDefault ? "HOME" : "ADDRESS")).toUpperCase()}</div><div style={{ fontSize: 12.5, color: "var(--c-text-2)", marginTop: 2 }}>{ad.address}</div></div>
                                        </div>
                                    );
                                })}
                                {customer.area && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 12, borderTop: "1px solid var(--c-border)" }}><span style={{ color: "var(--c-text-2)" }}>{t("customers.area", "Service area")}</span><span style={{ fontWeight: 600 }}>{customer.area}</span></div>}
                            </div>
                        </div>

                        {customer.notes && (
                            <div style={{ ...card, padding: "18px 20px" }}>
                                <div style={secLbl}>{t("customers.notes", "NOTES")}</div>
                                <div style={{ fontSize: 13, color: "var(--c-text-2)", lineHeight: 1.5 }}>{customer.notes}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <CustomerFormSheet open={editOpen} onClose={() => setEditOpen(false)} customer={customer} onSubmit={handleUpdate} />
        </div>
    );
}
