/**
 * MOBILE dashboard — a 1:1 clone of the owner app's HomeScreen
 * (mobile/src/screens/HomeScreen.tsx): shop-icon header with plan badge and
 * gear · search + Scan/New-Order card · blue-gradient "This Month" hero
 * (Collected | Outstanding) · Quick Actions tiles · Recent orders with status
 * accent bars. Desktop keeps DashboardPage; this renders only when isMobile.
 *
 * Same data semantics as the app: one last-50-orders listener drives both the
 * hero stats and the 2 recent rows.
 */

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import { useShop } from "@/hooks/use-shop";
import { useShopLimits } from "@/hooks/use-shop-limits";
import { useShopSubscription } from "@/hooks/use-shop-subscription";
import { useCurrency } from "@/hooks/use-currency";
import { STATUS_LABELS } from "@/types/order";
import { useTranslation } from "react-i18next";
import {
    Search, ScanLine, FilePlus, Settings, Crown, CalendarDays, ArrowDown, Lock,
    TrendingUp, Users, ChevronRight, ReceiptText,
} from "lucide-react";

/* Status palette — same mapping as the app's STATUS_COLORS. */
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    pending: { bg: "var(--c-warning-soft)", text: "var(--c-warning)" },
    confirmed: { bg: "var(--c-primary-soft)", text: "var(--c-primary)" },
    processing: { bg: "var(--c-info-soft)", text: "var(--c-info)" },
    ready: { bg: "#F1FBE7", text: "#84CC16" },
    out_for_delivery: { bg: "var(--c-primary-soft)", text: "var(--c-primary)" },
    partially_delivered: { bg: "var(--c-warning-soft)", text: "var(--c-warning)" },
    delivered: { bg: "var(--c-success-soft)", text: "var(--c-success)" },
    picked_up: { bg: "var(--c-success-soft)", text: "var(--c-success)" },
    cancelled: { bg: "var(--c-error-soft)", text: "var(--c-error)" },
};

function timeAgo(d: Date | null): string {
    if (!d) return "";
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

interface HomeOrder {
    id: string;
    publicId?: string;
    status?: string;
    customerName?: string;
    items?: { quantity?: number }[];
    createdAt?: { toDate?: () => Date };
    financials?: { total?: number; amountPaid?: number; balance?: number };
}

export interface MobileHomeData {
    shopName: string;
    shopCity?: string;
    logoUrl?: string;
    planPaid: boolean;
    planLabel: string;
    planExpired: boolean;
    loading: boolean;
    pendingCount: number;
    collected: number;
    dueAmount: number;
    recent: HomeOrder[];
}

/** Pure view — exported separately so it can be rendered with sample data. */
export function MobileHomeView({ data, formatAmount, onNav }: {
    data: MobileHomeData;
    formatAmount: (n: number) => string;
    onNav: (to: string) => void;
}) {
    const { t } = useTranslation();
    const [homeQ, setHomeQ] = useState("");
    const card: CSSProperties = { background: "var(--c-surface)", borderRadius: 18, border: "1px solid var(--c-border)", boxShadow: "var(--sh-sm)" };
    const overline: CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 12 };
    const qaTile = (icon: ReactNode, iconBg: string, label: string, to: string) => (
        <button onClick={() => onNav(to)} style={{ ...card, cursor: "pointer", flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", font: "inherit", textAlign: "left" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text)" }}>{label}</span>
            </span>
            <span style={{ borderLeft: "1px solid var(--c-border)", paddingLeft: 8, fontSize: 16, fontWeight: 700, color: "var(--c-primary)" }}>+</span>
        </button>
    );

    return (
        <div style={{ minHeight: "100%", background: "var(--c-bg)", display: "flex", flexDirection: "column" }}>
            {/* Header — shop icon + name + plan badge + gear (app s.header) */}
            <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 16px", background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                    <span style={{ width: 36, height: 36, flex: "none", borderRadius: 10, background: "var(--c-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, overflow: "hidden", boxShadow: "var(--sh-sm)" }}>
                        {data.logoUrl ? <img src={data.logoUrl} alt="" style={{ width: 36, height: 36, objectFit: "cover" }} /> : data.shopName.charAt(0).toUpperCase()}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.shopName}</div>
                        {data.shopCity && <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text-2)" }}>Store: {data.shopCity}</div>}
                    </div>
                </div>
                <button onClick={() => onNav("/settings/subscription")} style={{ cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 4, maxWidth: 120, padding: "4px 8px", borderRadius: 8, background: "var(--c-primary-soft)", border: "1px solid var(--c-primary)", color: "var(--c-primary)" }}>
                    {data.planPaid && <Crown size={12} />}
                    <span style={{ fontSize: 10, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.planLabel}</span>
                </button>
                <button onClick={() => onNav("/settings")} aria-label={t("common.settings", "Settings")} style={{ cursor: "pointer", flex: "none", width: 36, height: 36, borderRadius: 18, border: 0, background: "var(--c-surface-2)", color: "var(--c-text-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Settings size={20} />
                </button>
            </div>

            <div style={{ flex: 1, padding: 16, paddingBottom: "calc(100px + env(safe-area-inset-bottom, 0px))", display: "flex", flexDirection: "column", gap: 24 }}>
                {/* Expired-plan notice — matches the desktop banner */}
                {data.planExpired && (
                    <button onClick={() => onNav("/settings/subscription")} style={{ cursor: "pointer", font: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", borderRadius: 14, background: "var(--c-error-soft)", border: "1px solid var(--c-error)" }}>
                        <span style={{ fontSize: 20 }}>⚠️</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--c-error)" }}>{t("dashboard.planExpiredTitle", "Your subscription has expired")}</span>
                            <span style={{ display: "block", fontSize: 12, color: "var(--c-text-2)", marginTop: 2 }}>{t("dashboard.planExpiredMobile", "Now on the Free plan (10 orders/mo). Tap to renew.")}</span>
                        </span>
                    </button>
                )}
                {/* Card 1: search + actions (app s.card) */}
                <div style={{ ...card, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* Typing here lands on Orders with the query already applied */}
                    <form onSubmit={(e) => { e.preventDefault(); onNav(homeQ.trim() ? `/orders?search=${encodeURIComponent(homeQ.trim())}` : "/orders"); }} style={{ position: "relative" }}>
                        <Search size={20} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--c-primary)" }} />
                        <input value={homeQ} onChange={(e) => setHomeQ(e.target.value)} enterKeyHint="search"
                            placeholder={t("mobile.searchPlaceholder", "Search order or phone...")}
                            style={{ width: "100%", font: "inherit", fontSize: 14, fontWeight: 600, color: "var(--c-text)", background: "transparent", padding: "10px 14px 10px 44px", borderRadius: 12, border: "1px solid var(--c-border)", outline: "none" }} />
                    </form>
                    <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => onNav("/scan")} style={{ cursor: "pointer", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 0", borderRadius: 12, border: 0, background: "var(--c-primary-soft)", color: "var(--c-primary)", font: "inherit", fontSize: 14, fontWeight: 700 }}>
                            <ScanLine size={18} />{t("mobile.scanQr", "Scan QR")}
                        </button>
                        <button onClick={() => onNav("/new-order")} style={{ cursor: "pointer", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 0", borderRadius: 12, border: 0, background: "var(--c-primary)", color: "#fff", font: "inherit", fontSize: 14, fontWeight: 700 }}>
                            <FilePlus size={18} />{t("dashboard.newOrder", "New Order")}
                        </button>
                    </div>
                </div>

                {/* Card 2: blue gradient hero (app s.statsCard) */}
                {data.loading ? (
                    <div style={{ padding: "24px 0", textAlign: "center", color: "var(--c-text-3)", fontSize: 13 }}>{t("common.loading", "Loading…")}</div>
                ) : (
                    <div role="button" tabIndex={0} onClick={() => onNav("/orders")} onKeyDown={(e) => { if (e.key === "Enter") onNav("/orders"); }}
                        style={{ cursor: "pointer", borderRadius: 18, padding: "12px 14px", background: "linear-gradient(135deg, #1B61E5, #124BB8)", color: "#fff", boxShadow: "var(--sh-md, var(--sh-sm))", display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <CalendarDays size={15} style={{ color: "rgba(255,255,255,.85)" }} />
                                <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.85)", letterSpacing: ".6px", textTransform: "uppercase" }}>{t("mobile.thisMonth", "This Month")}</span>
                            </span>
                            <span style={{ background: "rgba(255,255,255,.18)", padding: "3px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700 }}>
                                {data.pendingCount} {t("mobile.ordersPending", "orders pending")}
                            </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", borderTop: "1px solid rgba(255,255,255,.15)", paddingTop: 10 }}>
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,.7)" }}><ArrowDown size={13} style={{ color: "#86EFAC" }} />{t("mobile.statsCollected", "Collected")}</span>
                                <span style={{ fontSize: 22, fontWeight: 700 }}>{formatAmount(data.collected)}</span>
                            </div>
                            <span style={{ width: 1, height: 34, background: "rgba(255,255,255,.2)", margin: "0 12px" }} />
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,.7)" }}><Lock size={13} style={{ color: "#FCA5A5" }} />{t("mobile.outstanding", "Outstanding")}</span>
                                <span style={{ fontSize: 22, fontWeight: 700 }}>{formatAmount(data.dueAmount)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Quick actions (app s.qaGrid) */}
                {!data.loading && (
                    <div>
                        <div style={overline}>{t("mobile.quickActions", "Quick Actions")}</div>
                        <div style={{ display: "flex", gap: 8 }}>
                            {qaTile(<TrendingUp size={16} style={{ color: "var(--c-error)" }} />, "var(--c-error-soft)", t("common.expenses", "Expenses"), "/expenses")}
                            {qaTile(<Users size={16} style={{ color: "var(--c-primary)" }} />, "var(--c-primary-soft)", t("mobile.attendance", "Attendance"), "/attendance")}
                        </div>
                    </div>
                )}

                {/* Recent orders (app s.orderListCard) */}
                {!data.loading && (
                    <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ ...overline, marginBottom: 0 }}>{t("dashboard.recentOrders", "Recent Orders")}</span>
                                {data.recent.length > 0 && <span style={{ background: "var(--c-primary-soft)", color: "var(--c-primary)", padding: "2px 6px", borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{data.recent.length}</span>}
                            </span>
                            <button onClick={() => onNav("/orders")} style={{ cursor: "pointer", font: "inherit", border: 0, background: "transparent", fontSize: 12, fontWeight: 700, color: "var(--c-primary)", textTransform: "uppercase" }}>{t("dashboard.viewAll", "View all")} &gt;</button>
                        </div>
                        {data.recent.length === 0 ? (
                            <div style={{ ...card, textAlign: "center", padding: "40px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                                <ReceiptText size={44} style={{ color: "var(--c-text-3)" }} />
                                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-2)" }}>{t("mobile.recentOrdersEmpty", "No orders yet")}</div>
                                <div style={{ fontSize: 12, color: "var(--c-text-3)" }}>{t("mobile.recentOrdersEmptyHint", "Create your first order to see it here")}</div>
                            </div>
                        ) : (
                            <div style={{ ...card, overflow: "hidden" }}>
                                {data.recent.map((order, index) => {
                                    const cfg = STATUS_COLORS[order.status || "pending"] || STATUS_COLORS.pending;
                                    const orderId = order.publicId || `ORD-${order.id.slice(-4)}`;
                                    const itemCount = (order.items || []).reduce((s, i) => s + (i.quantity || 1), 0);
                                    const total = Math.round(order.financials?.total || 0);
                                    const balance = Math.round(order.financials?.balance ?? ((order.financials?.total || 0) - (order.financials?.amountPaid || 0)));
                                    const isPaid = balance <= 0;
                                    const dateStr = timeAgo(order.createdAt?.toDate?.() || null);
                                    return (
                                        <div key={order.id} role="button" tabIndex={0} onClick={() => onNav(`/orders/${order.id}`)} onKeyDown={(e) => { if (e.key === "Enter") onNav(`/orders/${order.id}`); }}
                                            style={{ position: "relative", cursor: "pointer", display: "flex", alignItems: "center", padding: "12px 12px 12px 0", borderBottom: index < data.recent.length - 1 ? "1px solid var(--c-border)" : "none" }}>
                                            <span style={{ position: "absolute", left: 0, top: 10, bottom: 10, width: 4, borderRadius: "0 4px 4px 0", background: cfg.text }} />
                                            <div style={{ flex: 1, minWidth: 0, paddingLeft: 12 }}>
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                                                    <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                                        <span style={{ fontSize: 14, fontWeight: 700 }}>{orderId}</span>
                                                        {order.status && <span style={{ background: cfg.bg, color: cfg.text, padding: "2px 6px", borderRadius: 6, fontSize: 9, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap" }}>{STATUS_LABELS[order.status as keyof typeof STATUS_LABELS] || order.status}</span>}
                                                    </span>
                                                    <span style={{ fontSize: 14, fontWeight: 700 }}>{formatAmount(total)}</span>
                                                </div>
                                                <div style={{ fontSize: 12, color: "var(--c-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {(order.customerName || t("mobile.guestCustomer", "Guest"))} · {itemCount} {t("mobile.items", "items")} · {dateStr}{!isPaid ? ` · ${t("mobile.dueLabel", "Due")} ${formatAmount(balance)}` : ""}
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
                )}
            </div>
        </div>
    );
}

/** Container: wires web data into the cloned view (same math as the app). */
export function MobileDashboard() {
    const navigate = useNavigate();
    const { shopId, shopName: authShopName } = useAuth();
    const { shop } = useShop();
    const { plan, isPro } = useShopLimits();
    const { subscription } = useShopSubscription();
    const { formatAmount } = useCurrency();

    const [recent, setRecent] = useState<HomeOrder[]>([]);
    const [stats, setStats] = useState({ pending: 0, inProgress: 0, collected: 0, dueAmount: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!shopId) { setLoading(false); return; }
        // Same source as the app's HomeScreen: last 50 orders drive everything.
        const q = query(collection(db, "shops", shopId, "orders"), orderBy("createdAt", "desc"), limit(50));
        const unsub = onSnapshot(q, (snap) => {
            const orders = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HomeOrder, "id">) }));
            let pending = 0, inProgress = 0, collected = 0, dueAmount = 0;
            orders.forEach((o) => {
                const s = o.status || "pending";
                if (s === "pending") pending++;
                if (["processing", "ready", "out_for_delivery", "confirmed", "picked_up_from_customer"].includes(s)) inProgress++;
                if (s !== "cancelled") {
                    collected += o.financials?.amountPaid || 0;
                    const balance = o.financials?.balance ?? ((o.financials?.total || 0) - (o.financials?.amountPaid || 0));
                    if (balance > 0) dueAmount += Math.round(balance);
                }
            });
            setRecent(orders.slice(0, 2));
            setStats({ pending, inProgress, collected: Math.round(collected), dueAmount });
            setLoading(false);
        }, () => setLoading(false));
        return unsub;
    }, [shopId]);

    const subStatus = String(subscription?.status || "").toLowerCase();
    const data: MobileHomeData = {
        shopName: shop?.name || authShopName || "My Shop",
        shopCity: (shop?.location as { city?: string } | undefined)?.city,
        logoUrl: shop?.logo,
        planPaid: isPro,
        planLabel: subStatus === "expired" ? "EXPIRED" : isPro ? plan.name : subStatus === "trial" ? "FREE TRIAL" : "FREE PLAN",
        planExpired: subStatus === "expired",
        loading,
        pendingCount: stats.pending + stats.inProgress,
        collected: stats.collected,
        dueAmount: stats.dueAmount,
        recent,
    };

    return <MobileHomeView data={data} formatAmount={formatAmount} onNav={navigate} />;
}
