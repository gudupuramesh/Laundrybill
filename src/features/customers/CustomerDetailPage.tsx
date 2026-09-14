/**
 * Customer Detail Page — 1000% to the design system (Customers.dc.html):
 * full-bleed header + profile card · stat tiles · order history + activity ·
 * contact & addresses · notes. Wired to useCustomer + useOrders + edit sheet.
 */

import { useState, type CSSProperties } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { LSpinner, LEmptyState } from "@/components/laundry";
import { MobileCustomerDetail } from "./MobileCustomerDetail";
import { useCustomer, useCustomers } from "@/hooks/use-customers";
import { useOrders } from "@/hooks/use-orders";
import { useCurrency } from "@/hooks/use-currency";
import { useShop } from "@/hooks/use-shop";
import { buildWaPhone } from "@/lib/whatsappShare";
import { useIsMobile } from "@/hooks/use-mobile";
import { CustomerFormSheet } from "./CustomerFormSheet";
import { ChevronLeft, Phone, MessageCircle, Pencil, Plus, Mail, MapPin, ClipboardList, ClipboardCheck, Wallet, IndianRupee, CalendarDays, Star, Tag as TagIcon, StickyNote, MoreVertical, ChevronRight, ChevronsLeft, ChevronsRight, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { STATUS_LABELS } from "@/types/order";

const TINTS = ["c-primary", "c-violet", "c-info", "c-cyan", "c-success", "c-warning"];
const tintFor = (s: string) => { let h = 0; for (const c of s || "x") h = (h * 31 + c.charCodeAt(0)) >>> 0; return TINTS[h % TINTS.length]; };
const card: CSSProperties = { background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 14, boxShadow: "0 1px 2px rgba(16,24,40,.04)" };
/** Outlined header button — Call / WhatsApp / Collect dues, as in the reference. */
const outBtn: CSSProperties = { cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, fontSize: 14.5, fontWeight: 600, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 12, padding: "12px 22px" };
const CHIP: Record<string, { bg: string; fg: string }> = {
    pending: { bg: "var(--ds-st-pending-bg)", fg: "var(--ds-st-pending)" },
    pickup_scheduled: { bg: "var(--ds-st-out-bg)", fg: "var(--ds-st-out)" },
    pickup_completed: { bg: "var(--ds-st-out-bg)", fg: "var(--ds-st-out)" },
    processing: { bg: "var(--ds-st-processing-bg)", fg: "var(--ds-st-processing)" },
    ready: { bg: "var(--ds-st-ready-bg)", fg: "var(--ds-st-ready)" },
    ready_for_pickup: { bg: "var(--ds-st-ready-bg)", fg: "var(--ds-st-ready)" },
    out_for_delivery: { bg: "var(--ds-st-out-bg)", fg: "var(--ds-st-out)" },
    delivered: { bg: "var(--ds-st-delivered-bg)", fg: "var(--ds-st-delivered)" },
    picked_up: { bg: "var(--ds-st-delivered-bg)", fg: "var(--ds-st-delivered)" },
    partially_delivered: { bg: "var(--ds-st-processing-bg)", fg: "var(--ds-st-processing)" },
    cancelled: { bg: "var(--ds-st-overdue-bg)", fg: "var(--ds-st-overdue)" },
};
const PAY_CHIP: Record<string, { bg: string; fg: string }> = {
    paid: { bg: "var(--ds-st-ready-bg)", fg: "var(--ds-st-ready)" },
    partial: { bg: "var(--ds-st-pending-bg)", fg: "var(--ds-st-pending)" },
    unpaid: { bg: "var(--ds-st-overdue-bg)", fg: "var(--ds-st-overdue)" },
};
/** "3 Shirts, 2 Pants" — the reference's Items column. */
function itemsLine(items: { quantity?: number; serviceName?: string }[]): string {
    const parts = (items || []).slice(0, 2).map((i) => `${i.quantity || 1} ${i.serviceName || "item"}`);
    return parts.join(", ") + ((items || []).length > 2 ? ` +${items.length - 2} more` : "");
}
const TH: CSSProperties = { padding: "12px 11px", fontSize: 13.5, fontWeight: 600, color: "var(--ds-text-2)", borderBottom: "1px solid var(--ds-border)", whiteSpace: "nowrap", background: "var(--ds-card)" };
const TD: CSSProperties = { padding: "13px 11px", borderBottom: "1px solid var(--ds-divider)" };
const PG: CSSProperties = { minWidth: 32, height: 32, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", font: "inherit", fontSize: 13, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 8 };


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
    const { shop } = useShop();
    const { customer, loading } = useCustomer(customerId!);
    const { orders, loading: ordersLoading } = useOrders({ customerId });
    const { updateCustomer } = useCustomers();
    const [editOpen, setEditOpen] = useState(false);
    const [tab, setTab] = useState<"orders" | "payments" | "addresses" | "notes">("orders");
    const [page, setPage] = useState(1);
    const PER = 8;

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


    const handleUpdate = async (data: Parameters<typeof updateCustomer>[1]) => { await updateCustomer(customer.id, data); setEditOpen(false); };

    // MOBILE: render the owner app's CustomerDetailScreen clone.
    if (isMobile) return (
        <>
            <MobileCustomerDetail
                customer={customer}
                orders={orders}
                basePath={basePath}
                onBack={() => navigate(`${basePath}/customers`)}
                onEdit={() => setEditOpen(true)}
            />
            <CustomerFormSheet open={editOpen} onClose={() => setEditOpen(false)} customer={customer} onSubmit={handleUpdate} />
        </>
    );

    // Outstanding across this customer's orders — drives the dues button, the
    // Outstanding tile and the reminder card.
    const openOrders = orders.filter((o) => o.status !== "cancelled");
    const dueTotal = openOrders.reduce((n, o) => n + Math.max(0, o.financials?.balance ?? ((o.financials?.total || 0) - (o.financials?.amountPaid || 0))), 0);
    const oldestDue = [...openOrders].reverse().find((o) => (o.financials?.balance || 0) > 0);
    const payments = openOrders.flatMap((o) => (o.payments || []).map((pm) => ({ ...pm, order: o })));
    const pageCount = Math.max(1, Math.ceil(openOrders.length / PER));
    const pageNo = Math.min(page, pageCount);
    const pageOrders = openOrders.slice((pageNo - 1) * PER, pageNo * PER);
    const waLink = (text: string) => `https://wa.me/${buildWaPhone(customer.phone || "", shop || undefined)}?text=${encodeURIComponent(text)}`;
    const dueLabel = (o: typeof orders[number]) => {
        const bal = o.financials?.balance ?? 0;
        if (bal <= 0 || !o.expectedDelivery) return "—";
        const d = o.expectedDelivery.toDate();
        const days = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5);
        const time = format(d, "h:mm a");
        if (days === 0) return `${t("common.today", "Today")} ${time}`;
        if (days === 1) return t("common.tomorrow", "Tomorrow");
        return format(d, "d MMM");
    };

    const TileIcon = ({ icon, tint }: { icon: React.ReactNode; tint: string }) => (
        <span style={{ width: 44, height: 44, flex: "none", borderRadius: "50%", background: `var(--${tint}-soft)`, color: `var(--${tint})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
    );

    return (
        <div className="lb-ds" style={{ minHeight: "100%", display: "flex", flexDirection: "column", background: "var(--ds-bg)" }}>
            {/* header — back + breadcrumb */}
            <header style={{ position: "sticky", top: 0, zIndex: 5, flex: "none", background: "var(--ds-card)", borderBottom: "1px solid var(--ds-border)", display: "flex", alignItems: "center", gap: 14, padding: "13px 22px" }}>
                <button onClick={() => navigate(`${basePath}/customers`)} aria-label="Back" style={{ cursor: "pointer", width: 36, height: 36, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 10 }}><ChevronLeft size={18} /></button>
                <nav style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14.5, minWidth: 0 }}>
                    <button onClick={() => navigate(`${basePath}/customers`)} style={{ cursor: "pointer", font: "inherit", fontSize: 14.5, color: "var(--ds-text-2)", background: "transparent", border: 0 }}>{t("customers.title", "Customers")}</button>
                    <ChevronRight size={15} style={{ color: "var(--ds-text-3)" }} />
                    <span style={{ color: "var(--ds-text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customer.name}</span>
                </nav>
            </header>

            <div style={{ padding: "20px 22px 40px" }}>
                {/* profile card */}
                <div style={{ ...card, padding: "24px 26px", display: "flex", alignItems: "flex-start", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
                    <span style={{ width: 88, height: 88, flex: "none", borderRadius: "50%", background: `var(--${ref}-soft)`, color: `var(--${ref})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 600 }}>{(customer.name || "?").trim()[0]?.toUpperCase()}</span>
                    <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-.02em" }}>{customer.name}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, fontSize: 14.5, color: "var(--ds-text-2)", flexWrap: "wrap" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Phone size={16} style={{ color: "var(--ds-text-3)" }} />{customer.phone}</span>
                            {customer.email && <><span style={{ color: "var(--ds-text-3)" }}>·</span><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Mail size={16} style={{ color: "var(--ds-text-3)" }} />{customer.email}</span></>}
                        </div>
                        {(addresses[0] || customer.area) && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 14.5, color: "var(--ds-text-2)" }}>
                                <MapPin size={16} style={{ color: "var(--ds-text-3)" }} />{addresses[0]?.address || customer.area}
                            </div>
                        )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <button onClick={() => window.open(`tel:${customer.phone}`)} style={outBtn}><Phone size={17} style={{ color: "var(--ds-blue)" }} />{t("common.call", "Call")}</button>
                            <button onClick={() => window.open(waLink(""), "_blank")} style={outBtn}><MessageCircle size={17} style={{ color: "var(--ds-whatsapp)" }} />{t("common.whatsapp", "WhatsApp")}</button>
                            <button onClick={() => navigate(`${basePath}/new-order?customerId=${customer.id}`)} style={{ ...outBtn, color: "#fff", background: "var(--ds-blue)", border: "1px solid var(--ds-blue)" }}><Plus size={18} />{t("customers.newOrder", "New order")}</button>
                        </div>
                        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                            {dueTotal > 0 && (
                                <button onClick={() => oldestDue && navigate(`${basePath}/orders/${oldestDue.id}`)} style={{ ...outBtn, color: "var(--ds-blue)", borderColor: "var(--ds-blue)" }}>{t("customers.collectDues", "Collect dues")} {formatAmount(dueTotal)}</button>
                            )}
                            <button onClick={() => setEditOpen(true)} aria-label="Edit" style={{ ...outBtn, padding: 0, width: 52 }}><Pencil size={17} style={{ color: "var(--ds-text-2)" }} /></button>
                        </div>
                    </div>
                </div>

                <div className="lb-row" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    {/* LEFT */}
                    <div style={{ flex: 2.3, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                        {/* stat strip */}
                        <div style={{ ...card, padding: "20px 24px", display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                            {[
                                { icon: <ClipboardCheck size={20} />, tint: "ds-blue", label: t("customers.colOrders", "Orders"), value: String(customer.totalOrders || 0) },
                                { icon: <Wallet size={20} />, tint: "ds-st-ready", label: t("customers.lifetimeValue", "Lifetime value"), value: formatAmount(customer.totalSpent || 0) },
                                { icon: <IndianRupee size={20} />, tint: "ds-st-overdue", label: t("customers.outstanding", "Outstanding"), value: formatAmount(dueTotal), danger: dueTotal > 0 },
                                { icon: <CalendarDays size={20} />, tint: "ds-st-out", label: t("customers.lastVisit", "Last visit"), value: timeAgo(customer.lastOrderAt?.toDate?.()) },
                            ].map((s2, i) => (
                                <div key={s2.label} style={{ flex: 1, minWidth: 136, display: "flex", alignItems: "center", gap: 12, paddingLeft: i ? 18 : 0, borderLeft: i ? "1px solid var(--ds-divider)" : undefined }}>
                                    <TileIcon icon={s2.icon} tint={s2.tint} />
                                    <div>
                                        <div style={{ fontSize: 13.5, color: "var(--ds-text-2)" }}>{s2.label}</div>
                                        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.02em", marginTop: 2, color: s2.danger ? "var(--ds-negative)" : "var(--ds-text)" }}>{s2.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* tabs card */}
                        <div style={{ ...card, overflow: "hidden" }}>
                            <div style={{ display: "flex", gap: 26, padding: "0 24px", borderBottom: "1px solid var(--ds-border)" }}>
                                {([
                                    ["orders", t("customers.tabOrders", "Orders")],
                                    ["payments", t("customers.tabPayments", "Payments")],
                                    ["addresses", t("customers.tabAddresses", "Addresses")],
                                    ["notes", t("customers.tabNotes", "Notes")],
                                ] as const).map(([id, label]) => (
                                    <button key={id} onClick={() => setTab(id)} style={{ cursor: "pointer", font: "inherit", fontSize: 14.5, fontWeight: 600, color: tab === id ? "var(--ds-blue)" : "var(--ds-text-2)", background: "transparent", border: 0, borderBottom: `2px solid ${tab === id ? "var(--ds-blue)" : "transparent"}`, padding: "16px 2px" }}>{label}</button>
                                ))}
                            </div>

                            {ordersLoading ? (
                                <div style={{ padding: 30, display: "flex", justifyContent: "center" }}><LSpinner /></div>
                            ) : tab === "orders" ? (
                                openOrders.length === 0 ? (
                                    <div style={{ padding: 24 }}><LEmptyState icon={<ClipboardList className="h-8 w-8" />} title={t("customers.noOrders", "No orders yet")} description={t("customers.noOrdersDesc", "This customer hasn't placed an order.")} /></div>
                                ) : (
                                <>
                                <div className="lb-scroll" style={{ overflowX: "auto" }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 680 }}>
                                        <thead>
                                            <tr>
                                                <th style={{ ...TH, textAlign: "left", paddingLeft: 24 }}>{t("orders.order", "Order")}</th>
                                                <th style={{ ...TH, textAlign: "left" }}>{t("orders.items", "Items")}</th>
                                                <th style={{ ...TH, textAlign: "left" }}>{t("orders.status", "Status")}</th>
                                                <th style={{ ...TH, textAlign: "left" }}>{t("checkout.payment", "Payment")}</th>
                                                <th style={{ ...TH, textAlign: "left" }}>{t("customers.due", "Due")}</th>
                                                <th style={{ ...TH, textAlign: "left" }}>{t("pos.total", "Total")}</th>
                                                <th style={{ ...TH, width: 46, paddingRight: 24 }} />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pageOrders.map((o) => {
                                                const st = CHIP[o.status] || CHIP.pending;
                                                const ps = o.paymentStatus || "unpaid";
                                                const pc = PAY_CHIP[ps] || PAY_CHIP.unpaid;
                                                return (
                                                    <tr key={o.id} onClick={() => navigate(`${basePath}/orders/${o.id}`)} style={{ cursor: "pointer" }}
                                                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ds-table-head)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                                                        <td style={{ ...TD, paddingLeft: 24, fontWeight: 600, whiteSpace: "nowrap" }}>{o.publicId}</td>
                                                        <td style={{ ...TD, color: "var(--ds-text-2)", maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{itemsLine(o.items)}</td>
                                                        <td style={TD}><span style={{ fontSize: 12.5, fontWeight: 600, padding: "5px 11px", borderRadius: 7, background: st.bg, color: st.fg, whiteSpace: "nowrap" }}>{STATUS_LABELS[o.status]}</span></td>
                                                        <td style={TD}><span style={{ fontSize: 12.5, fontWeight: 600, padding: "5px 11px", borderRadius: 7, background: pc.bg, color: pc.fg, whiteSpace: "nowrap" }}>{t(`orders.${ps}`, ps)}</span></td>
                                                        <td style={{ ...TD, color: "var(--ds-text-2)", whiteSpace: "nowrap" }}>{dueLabel(o)}</td>
                                                        <td style={{ ...TD, fontWeight: 600, whiteSpace: "nowrap" }}>{formatAmount(o.financials.total)}</td>
                                                        <td style={{ ...TD, paddingRight: 24, color: "var(--ds-text-3)" }}><MoreVertical size={17} /></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "14px 24px", fontSize: 13.5, color: "var(--ds-text-2)" }}>
                                    <span>{(pageNo - 1) * PER + 1}–{(pageNo - 1) * PER + pageOrders.length} {t("common.of", "of")} {openOrders.length} {t("customers.ordersLower", "orders")}</span>
                                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                                        <button style={PG} disabled={pageNo === 1} onClick={() => setPage(1)}><ChevronsLeft size={15} /></button>
                                        <button style={PG} disabled={pageNo === 1} onClick={() => setPage(pageNo - 1)}><ChevronLeft size={15} /></button>
                                        {Array.from({ length: Math.min(3, pageCount) }, (_, k) => k + Math.max(1, Math.min(pageNo - 1, pageCount - 2))).map((n) => (
                                            <button key={n} onClick={() => setPage(n)} style={{ ...PG, color: n === pageNo ? "var(--ds-blue)" : "var(--ds-text)", borderColor: n === pageNo ? "var(--ds-blue)" : "var(--ds-border)", fontWeight: 600 }}>{n}</button>
                                        ))}
                                        <button style={PG} disabled={pageNo >= pageCount} onClick={() => setPage(pageNo + 1)}><ChevronRight size={15} /></button>
                                        <button style={PG} disabled={pageNo >= pageCount} onClick={() => setPage(pageCount)}><ChevronsRight size={15} /></button>
                                    </div>
                                </div>
                                </>
                                )
                            ) : tab === "payments" ? (
                                payments.length === 0 ? (
                                    <div style={{ padding: 24 }}><LEmptyState icon={<Wallet className="h-8 w-8" />} title={t("customers.noPayments", "No payments yet")} description={t("customers.noPaymentsDesc", "Collected payments show up here.")} /></div>
                                ) : (
                                    <div className="lb-scroll" style={{ overflowX: "auto" }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 560 }}>
                                            <thead><tr>
                                                <th style={{ ...TH, textAlign: "left", paddingLeft: 24 }}>{t("orders.order", "Order")}</th>
                                                <th style={{ ...TH, textAlign: "left" }}>{t("finance.method", "Method")}</th>
                                                <th style={{ ...TH, textAlign: "left" }}>{t("orders.date", "Date")}</th>
                                                <th style={{ ...TH, textAlign: "left", paddingRight: 24 }}>{t("finance.amount", "Amount")}</th>
                                            </tr></thead>
                                            <tbody>
                                                {payments.map((pm, i) => (
                                                    <tr key={i} onClick={() => navigate(`${basePath}/orders/${pm.order.id}`)} style={{ cursor: "pointer" }}
                                                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ds-table-head)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                                                        <td style={{ ...TD, paddingLeft: 24, fontWeight: 600 }}>{pm.order.publicId}</td>
                                                        <td style={{ ...TD, color: "var(--ds-text-2)" }}>{String(pm.method || "cash").toUpperCase()}</td>
                                                        <td style={{ ...TD, color: "var(--ds-text-2)" }}>{pm.collectedAt?.toDate ? format(pm.collectedAt.toDate(), "d MMM yyyy, h:mm a") : "—"}</td>
                                                        <td style={{ ...TD, paddingRight: 24, fontWeight: 600 }}>{formatAmount(pm.amount || 0)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            ) : tab === "addresses" ? (
                                <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                                    {addresses.length === 0 && <div style={{ fontSize: 14, color: "var(--ds-text-2)" }}>{t("customers.noAddresses", "No addresses saved.")}</div>}
                                    {addresses.map((ad, i) => (
                                        <div key={ad.id || i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", border: "1px solid var(--ds-border)", borderRadius: 12 }}>
                                            <MapPin size={17} style={{ color: "var(--ds-text-3)", marginTop: 2 }} />
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ds-text-2)" }}>{ad.label || (ad.isDefault ? t("customers.home", "Home") : t("customers.address", "Address"))}</div>
                                                <div style={{ fontSize: 14, marginTop: 3 }}>{ad.address}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {customer.area && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, paddingTop: 6 }}><span style={{ color: "var(--ds-text-2)" }}>{t("customers.area", "Service area")}</span><span style={{ fontWeight: 600 }}>{customer.area}</span></div>}
                                </div>
                            ) : (
                                <div style={{ padding: "20px 24px", fontSize: 14, color: customer.notes ? "var(--ds-text)" : "var(--ds-text-2)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                                    {customer.notes || t("customers.noNotes", "No notes yet.")}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT */}
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                        {((customer.loyaltyPoints || 0) > 0 || (customer.loyaltyEarned || 0) > 0) && (
                            <div style={{ ...card, padding: 0, overflow: "hidden" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "15px 20px", background: "var(--ds-st-pending-bg)" }}>
                                    <Star size={18} style={{ color: "var(--ds-st-pending)" }} />
                                    <span style={{ fontSize: 14.5, fontWeight: 600 }}>{t("customers.loyaltyPoints", "Loyalty points")}</span>
                                    <span style={{ marginLeft: "auto", fontSize: 18, fontWeight: 700 }}>{Math.round(customer.loyaltyPoints || 0)}</span>
                                </div>
                                {customer.area && (
                                    <div style={{ padding: "16px 20px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14.5, fontWeight: 600, marginBottom: 12 }}><TagIcon size={17} style={{ color: "var(--ds-text-3)" }} />{t("customers.serviceArea", "Service area")}</div>
                                        <span style={{ fontSize: 13.5, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 9, padding: "7px 13px" }}>{customer.area}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* notes */}
                        <div style={{ ...card, padding: "18px 20px" }}>
                            <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
                                <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-.01em" }}>{t("customers.notesTitle", "Notes")}</span>
                                <button onClick={() => setEditOpen(true)} style={{ marginLeft: "auto", cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 600, color: "var(--ds-blue)", background: "transparent", border: 0 }}><Plus size={16} />{t("customers.addNote", "Add note")}</button>
                            </div>
                            {customer.notes ? (
                                <div style={{ display: "flex", gap: 12, padding: "14px 16px", border: "1px solid var(--ds-border)", borderRadius: 12 }}>
                                    <StickyNote size={18} style={{ color: "var(--ds-blue)", flex: "none", marginTop: 1 }} />
                                    <div style={{ minWidth: 0 }}>
                                        {customer.updatedAt?.toDate && <div style={{ fontSize: 12.5, color: "var(--ds-text-3)" }}>{format(customer.updatedAt.toDate(), "d MMM yyyy · h:mm a")}</div>}
                                        <div style={{ fontSize: 14, marginTop: 5, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{customer.notes}</div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ fontSize: 14, color: "var(--ds-text-2)" }}>{t("customers.noNotes", "No notes yet.")}</div>
                            )}
                            {customer.notes && (
                                <button onClick={() => setTab("notes")} style={{ marginTop: 14, cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, color: "var(--ds-blue)", background: "transparent", border: 0, padding: 0 }}>{t("customers.viewAllNotes", "View all notes")}<ArrowRight size={15} /></button>
                            )}
                        </div>

                        {/* reminder */}
                        {dueTotal > 0 && (
                            <div style={{ ...card, padding: "18px 20px" }}>
                                <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-.01em" }}>{t("customers.sendReminder", "Send reminder")}</div>
                                <div style={{ fontSize: 13.5, color: "var(--ds-text-2)", marginTop: 6 }}>{t("customers.sendReminderDesc", "Remind customer about outstanding dues.")}</div>
                                <button onClick={() => window.open(waLink(t("customers.reminderMsg", "Hello {{name}}, a friendly reminder about your pending balance of {{amount}}. Thank you!", { name: customer.name, amount: formatAmount(dueTotal) })), "_blank")}
                                    style={{ width: "100%", marginTop: 14, cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, fontSize: 14.5, fontWeight: 600, color: "var(--ds-whatsapp)", background: "var(--ds-card)", border: "1px solid var(--ds-whatsapp)", borderRadius: 12, padding: "13px 18px" }}>
                                    <MessageCircle size={17} />{t("customers.remindAbout", "Remind about {{amount}} due", { amount: formatAmount(dueTotal) })}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <CustomerFormSheet open={editOpen} onClose={() => setEditOpen(false)} customer={customer} onSubmit={handleUpdate} />
        </div>
    );
}
