/**
 * MOBILE customer detail — a 1:1 clone of the owner app's CustomerDetailScreen
 * (mobile/src/screens/CustomerDetailScreen.tsx): back/edit header · centred
 * profile card (big avatar, name, phone, member-since, Call / WhatsApp / New
 * Order buttons) · 2×2 stats grid (Total orders | Total spent | Avg order |
 * Unpaid, red when owing) · order-history card with status accent rows.
 *
 * Desktop keeps CustomerDetailPage's two-column layout.
 */

import { type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrency } from "@/hooks/use-currency";
import { STATUS_LABELS } from "@/types/order";
import type { Order } from "@/types/order";
import type { Customer } from "@/types/customer";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Edit, Phone, MessageCircle, FilePlus, CalendarDays, ReceiptText, ChevronRight } from "lucide-react";
import { buildWaPhone } from "@/lib/whatsappShare";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    pending: { bg: "var(--c-warning-soft)", text: "var(--c-warning)" },
    processing: { bg: "var(--c-info-soft)", text: "var(--c-info)" },
    ready: { bg: "#F1FBE7", text: "#84CC16" },
    out_for_delivery: { bg: "var(--c-primary-soft)", text: "var(--c-primary)" },
    partially_delivered: { bg: "var(--c-warning-soft)", text: "var(--c-warning)" },
    delivered: { bg: "var(--c-success-soft)", text: "var(--c-success)" },
    picked_up: { bg: "var(--c-success-soft)", text: "var(--c-success)" },
    cancelled: { bg: "var(--c-error-soft)", text: "var(--c-error)" },
};

export function MobileCustomerDetail({
    customer, orders, basePath, onBack, onEdit,
}: {
    customer: Customer;
    orders: Order[];
    basePath: string;
    onBack: () => void;
    onEdit: () => void;
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { formatAmount } = useCurrency();

    const initials = (customer.name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const createdAt = customer.createdAt?.toDate?.();
    const phone = customer.phone || "";

    // Same four stats the app shows.
    const totalOrders = customer.totalOrders || orders.length;
    const totalSpent = Math.round(customer.totalSpent || 0);
    const avgValue = totalOrders > 0 ? Math.round(totalSpent / totalOrders) : 0;
    const unpaid = Math.round(orders.reduce((sum, o) => {
        if (o.status === "cancelled") return sum;
        const bal = o.financials?.balance ?? ((o.financials?.total || 0) - (o.financials?.amountPaid || 0));
        return sum + Math.max(0, bal);
    }, 0));

    const card: CSSProperties = { background: "var(--c-surface)", borderRadius: 18, border: "1px solid var(--c-border)", boxShadow: "var(--sh-sm)" };
    const iconBtn: CSSProperties = { cursor: "pointer", flex: "none", width: 40, height: 40, borderRadius: 20, border: 0, background: "var(--c-surface-2)", color: "var(--c-text-2)", display: "flex", alignItems: "center", justifyContent: "center" };
    const actSecondary: CSSProperties = { cursor: "pointer", flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, font: "inherit", fontSize: 13, fontWeight: 700, padding: "10px 8px", borderRadius: 12, border: "1px solid var(--c-border)", background: "var(--c-surface-2)", color: "var(--c-text-2)" };
    const actPrimary: CSSProperties = { ...actSecondary, border: 0, background: "var(--c-primary)", color: "#fff" };

    const statTiles = [
        { label: t("mobile.statTotalOrders", "Total Orders"), value: String(totalOrders), color: "var(--c-primary)" },
        { label: t("mobile.statTotalSpent", "Total Spent"), value: formatAmount(totalSpent) },
        { label: t("mobile.statAvgOrder", "Avg Order"), value: formatAmount(avgValue) },
        { label: t("mobile.statUnpaidLabel", "Unpaid"), value: formatAmount(unpaid), color: unpaid > 0 ? "var(--c-error)" : "var(--c-success)", danger: unpaid > 0 },
    ];

    return (
        <div style={{ minHeight: "100%", background: "var(--c-bg)", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ position: "sticky", top: 0, zIndex: 5, flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)" }}>
                <button onClick={onBack} aria-label="Back" style={iconBtn}><ChevronLeft size={24} /></button>
                <div style={{ flex: 1, fontSize: 18, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t("mobile.customerProfileTitle", "Customer Profile")}</div>
                <button onClick={onEdit} aria-label={t("common.edit", "Edit")} style={iconBtn}><Edit size={20} /></button>
            </div>

            <div style={{ flex: 1, padding: 16, paddingBottom: "calc(110px + env(safe-area-inset-bottom, 0px))", display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Profile card */}
                <div style={{ ...card, padding: 18, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span style={{ width: 76, height: 76, borderRadius: "50%", background: "var(--c-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700 }}>{initials}</span>
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                        <span style={{ fontSize: 19, fontWeight: 700 }}>{customer.name}</span>
                        {phone && <span style={{ fontSize: 13, color: "var(--c-text-2)" }}>{phone}</span>}
                        {createdAt && (
                            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--c-text-3)" }}>
                                <CalendarDays size={12} />
                                {t("mobile.memberSince", "Member since")} {createdAt.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                            </span>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 14, width: "100%" }}>
                        {phone && (
                            <>
                                <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} style={{ ...actSecondary, textDecoration: "none" }}><Phone size={16} />{t("mobile.callBtn", "Call")}</a>
                                <a href={`https://wa.me/${buildWaPhone(phone)}`} target="_blank" rel="noopener noreferrer" style={{ ...actSecondary, textDecoration: "none" }}>
                                    <MessageCircle size={16} style={{ color: "#25D366" }} />{t("mobile.whatsappBtn", "WhatsApp")}
                                </a>
                            </>
                        )}
                        <button onClick={() => navigate(`${basePath}/new-order?customerId=${customer.id}`)} style={actPrimary}><FilePlus size={16} />{t("dashboard.newOrder", "New Order")}</button>
                    </div>
                </div>

                {/* Stats grid (app styles.statsGrid — 2×2) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {statTiles.map((st) => (
                        <div key={st.label} style={{ ...card, padding: "14px 14px", background: st.danger ? "var(--c-error-soft)" : "var(--c-surface)" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", color: st.danger ? "var(--c-error)" : "var(--c-text-2)" }}>{st.label}</div>
                            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: st.color || "var(--c-text)" }}>{st.value}</div>
                        </div>
                    ))}
                </div>

                {/* Order history */}
                <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>{t("mobile.orderHistoryTitle", "Order History")}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-3)" }}>{orders.length} {t("mobile.ordersLower", "orders")}</span>
                    </div>
                    {orders.length === 0 ? (
                        <div style={{ ...card, padding: "40px 16px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                            <ReceiptText size={40} style={{ color: "var(--c-text-3)" }} />
                            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text-2)" }}>{t("mobile.noOrdersYet", "No orders yet")}</span>
                        </div>
                    ) : (
                        <div style={{ ...card, overflow: "hidden" }}>
                            {orders.map((o, i) => {
                                const cfg = STATUS_COLORS[o.status] || STATUS_COLORS.pending;
                                const total = Math.round(o.financials?.total || 0);
                                const balance = Math.round(o.financials?.balance ?? ((o.financials?.total || 0) - (o.financials?.amountPaid || 0)));
                                const isPaid = balance <= 0;
                                const created = o.createdAt?.toDate?.();
                                const itemCount = (o.items || []).reduce((s, it) => s + (it.quantity || 1), 0);
                                return (
                                    <div key={o.id} role="button" tabIndex={0}
                                        onClick={() => navigate(`${basePath}/orders/${o.id}`)}
                                        onKeyDown={(e) => { if (e.key === "Enter") navigate(`${basePath}/orders/${o.id}`); }}
                                        style={{ position: "relative", cursor: "pointer", display: "flex", alignItems: "center", padding: "12px 12px 12px 0", borderBottom: i < orders.length - 1 ? "1px solid var(--c-border)" : "none" }}>
                                        <span style={{ position: "absolute", left: 0, top: 10, bottom: 10, width: 4, borderRadius: "0 4px 4px 0", background: cfg.text }} />
                                        <div style={{ flex: 1, minWidth: 0, paddingLeft: 12 }}>
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                                                <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                                    <span style={{ fontSize: 14, fontWeight: 700 }}>{o.publicId || `#${o.id.slice(-4)}`}</span>
                                                    <span style={{ background: cfg.bg, color: cfg.text, padding: "2px 6px", borderRadius: 6, fontSize: 9, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap" }}>{STATUS_LABELS[o.status] || o.status}</span>
                                                </span>
                                                <span style={{ fontSize: 14, fontWeight: 700 }}>{formatAmount(total)}</span>
                                            </div>
                                            <div style={{ fontSize: 12, color: "var(--c-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {created ? created.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""} · {itemCount} {t("mobile.items", "items")}
                                                {!isPaid ? ` · ${t("mobile.dueLabel", "Due")} ${formatAmount(balance)}` : ""}
                                            </div>
                                        </div>
                                        <div style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, marginLeft: 8 }}>
                                            <span style={{ padding: "2px 6px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: isPaid ? "var(--c-success-soft)" : "var(--c-error-soft)", color: isPaid ? "var(--c-success)" : "var(--c-error)" }}>
                                                {isPaid ? t("mobile.paid", "PAID") : t("mobile.unpaid", "UNPAID")}
                                            </span>
                                            <ChevronRight size={16} style={{ color: "var(--c-text-3)" }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
