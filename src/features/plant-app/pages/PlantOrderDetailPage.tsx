import { useState, type CSSProperties, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useDriverAuth } from "@/features/driver-app/DriverAuthContext";
import { useCurrency } from "@/hooks/use-currency";
import { useShop } from "@/hooks/use-shop";
import { groupOrderItemsByCategory } from "@/lib/order-item-groups";
import { getCountryByCurrency } from "@/config/countries";
import type { Order, OrderStatus } from "@/types/order";
import { format } from "date-fns";
import {
    ChevronLeft,
    Package,
    User,
    Calendar,
    Phone,
    MapPin,
    Clock,
    CheckCircle,
    Loader2,
    Shirt,
} from "lucide-react";
import { useEffect } from "react";

export function PlantOrderDetailPage() {
    const { t } = useTranslation();
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const { shopId } = useDriverAuth();
    const { formatAmount } = useCurrency();
    const { shop } = useShop();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!shopId || !orderId) {
            setLoading(false);
            return;
        }

        const orderRef = doc(db, "shops", shopId, "orders", orderId);
        const unsubscribe = onSnapshot(orderRef, (doc) => {
            if (doc.exists()) {
                setOrder({ id: doc.id, ...doc.data() } as Order);
            } else {
                setOrder(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [shopId, orderId]);

    if (loading) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
                <Loader2 className="animate-spin" size={26} style={{ color: "var(--c-primary)" }} />
            </div>
        );
    }

    if (!order) {
        return (
            <div style={{ color: "var(--c-text)", textAlign: "center", padding: "60px 22px" }}>
                <p style={{ color: "var(--c-text-3)", marginBottom: 16 }}>{t('plant.orderNotFound', 'Order not found')}</p>
                <button onClick={() => navigate(-1)} style={btnOutline}>
                    <ChevronLeft size={16} />
                    {t('common.back', 'Go Back')}
                </button>
            </div>
        );
    }

    const stRef = STATUS_TINT[order.status] || "c-text-3";
    const items = order.items || [];
    const itemCount = items.reduce((a, it) => a + (it.quantity || 0), 0);
    const f = order.financials;
    // Tax label is a HISTORICAL record: show the tax name the order was actually
    // charged under (frozen at creation), so an old GST order keeps showing GST even
    // after the shop later switches country/tax. Only fall back to the shop's current
    // config (then the country default) when the order has no stored tax name.
    const taxLabel = (f as any)?.taxName || shop?.settings?.tax?.name || getCountryByCurrency(shop?.settings?.currency || "INR").taxName;

    return (
        <div style={{ color: "var(--c-text)", fontSize: 14, lineHeight: 1.45, padding: "20px 22px 40px", maxWidth: 720, margin: "0 auto" }}>
            {/* Header / title row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
                <button onClick={() => navigate(-1)} aria-label="Back" style={{ cursor: "pointer", width: 32, height: 32, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 8 }}>
                    <ChevronLeft size={18} />
                </button>
                <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.01em", fontFamily: MONO }}>{order.orderNumber}</span>
                <StatusPill refColor={stRef} label={order.status.replace(/_/g, ' ')} />
            </div>

            {/* Customer */}
            <div style={{ ...card, marginBottom: 16 }}>
                <SectionHeader icon={<User size={15} />} soft="c-primary-soft" refColor="c-primary" title={t('plant.customer', 'Customer')} />
                <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 9 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{order.customerName}</div>
                    {order.customerPhone && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--c-text-2)", fontSize: 13 }}>
                            <Phone size={14} style={{ color: "var(--c-text-3)", flex: "none" }} />
                            <span style={{ fontFamily: MONO }}>{order.customerPhone}</span>
                        </div>
                    )}
                    {order.deliveryAddress && (
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, color: "var(--c-text-2)", fontSize: 13 }}>
                            <MapPin size={14} style={{ color: "var(--c-text-3)", flex: "none", marginTop: 1 }} />
                            <span>{order.deliveryAddress}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Items */}
            <div style={{ ...card, marginBottom: 16, overflow: "hidden" }}>
                <SectionHeader
                    icon={<Package size={15} />}
                    soft="c-info-soft"
                    refColor="c-info"
                    title={t('plant.items', 'Items')}
                    badge={String(itemCount)}
                />
                {groupOrderItemsByCategory(items, (it) => it.categoryName || 'Other').map((group) => (
                    <div key={group.categoryName}>
                        <div style={{ padding: "8px 18px", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--c-text-3)", background: "var(--c-surface-2)", borderBottom: "1px solid var(--c-border)" }}>{group.categoryName}</div>
                        {group.items.map((it) => {
                            const ir = tintFor(it.categoryId || it.serviceName);
                            return (
                                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 18px", borderBottom: "1px solid var(--c-border)" }}>
                                    <span style={{ width: 42, height: 42, flex: "none", borderRadius: 9, background: `var(--${ir}-soft)`, color: `var(--${ir})`, display: "flex", alignItems: "center", justifyContent: "center" }}><Shirt size={20} strokeWidth={1.6} /></span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>{it.serviceName}{it.express && <span style={{ fontSize: 8.5, fontWeight: 700, color: "var(--c-warning)", background: "var(--c-warning-soft)", padding: "2px 5px", borderRadius: 4 }}>⚡ EXP</span>}</div>
                                        <div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{it.categoryName || ''}</div>
                                    </div>
                                    <span style={{ fontFamily: MONO, fontSize: 12.5, color: "var(--c-text-2)", whiteSpace: "nowrap" }}>{it.quantity} × {formatAmount(it.unitPrice)}</span>
                                    <span style={{ width: 72, textAlign: "right", fontFamily: MONO, fontWeight: 600 }}>{formatAmount(it.total)}</span>
                                </div>
                            );
                        })}
                    </div>
                ))}
                {f && (
                    <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "var(--c-text-2)" }}>{t('pos.subtotal', 'Subtotal')}</span>
                            <span style={{ fontFamily: MONO }}>{formatAmount(f.subtotal || 0)}</span>
                        </div>
                        {(f.discountAmount || 0) > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--c-success)" }}>
                                <span>{t('checkout.discount', 'Discount')}</span>
                                <span style={{ fontFamily: MONO }}>−{formatAmount(f.discountAmount)}</span>
                            </div>
                        )}
                        {(f.taxAmount || 0) > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--c-text-2)" }}>{taxLabel}{f.taxRate != null ? ` (${f.taxRate}%)` : ''}</span>
                                <span style={{ fontFamily: MONO }}>{formatAmount(f.taxAmount || 0)}</span>
                            </div>
                        )}
                        {(f.deliveryCharge || 0) > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--c-text-2)" }}>{t('pos.deliveryCharge', 'Delivery')}</span>
                                <span style={{ fontFamily: MONO }}>{formatAmount(f.deliveryCharge)}</span>
                            </div>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, marginTop: 2, borderTop: "1px solid var(--c-border)" }}>
                            <span style={{ fontWeight: 700, fontSize: 15 }}>{t('pos.total', 'Total')}</span>
                            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 19 }}>{formatAmount(f.total || 0)}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Timeline */}
            {(order.timeline?.length ?? 0) > 0 && (
                <div style={{ ...card, marginBottom: 16 }}>
                    <SectionHeader icon={<Clock size={15} />} soft="c-cyan-soft" refColor="c-cyan" title={t('plant.timeline', 'Timeline')} />
                    <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
                        {order.timeline?.map((event, idx) => (
                            <div key={event.id || idx} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                                <ChipIcon soft="c-primary-soft" refColor="c-primary"><CheckCircle size={15} /></ChipIcon>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13.5, textTransform: "capitalize" }}>{event.status.replace(/_/g, ' ')}</div>
                                    <div style={{ fontSize: 12, color: "var(--c-text-3)" }}>
                                        {event.staffName} • {format(event.timestamp?.toDate?.() || new Date(), "dd MMM, hh:mm a")}
                                    </div>
                                    {event.notes && <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginTop: 2 }}>{event.notes}</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Dates */}
            <div style={card}>
                <SectionHeader icon={<Calendar size={15} />} soft="c-warning-soft" refColor="c-warning" title={t('plant.dates', 'Dates')} />
                <div className="lb-kpi" style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
                    <div>
                        <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginBottom: 4 }}>{t('plant.created', 'Created')}</div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {order.createdAt?.toDate
                                ? format(order.createdAt.toDate(), "dd MMM yyyy, hh:mm a")
                                : "N/A"}
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginBottom: 4 }}>{t('plant.expectedReady', 'Expected Ready')}</div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {order.expectedDelivery?.toDate
                                ? format(order.expectedDelivery.toDate(), "dd MMM yyyy")
                                : "N/A"}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── design-system helpers ───────────────────────────────────────── */
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

const TINTS = ["c-primary", "c-violet", "c-info", "c-cyan", "c-success", "c-warning"];
const tintFor = (s: string) => { let h = 0; for (const c of s || "x") h = (h * 31 + c.charCodeAt(0)) >>> 0; return TINTS[h % TINTS.length]; };

const card: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, boxShadow: "var(--sh-sm)" };
const btnOutline: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-surface)", border: "1px solid var(--c-primary)", borderRadius: 9, padding: "10px 16px" };

const STATUS_TINT: Record<OrderStatus, string> = {
    pending: "c-text-3", processing: "c-info", ready: "c-success", ready_for_pickup: "c-success",
    out_for_delivery: "c-cyan", picked_up: "c-success", delivered: "c-success",
    pickup_scheduled: "c-warning", pickup_completed: "c-violet", cancelled: "c-error",
};

function ChipIcon({ children, soft, refColor }: { children: ReactNode; soft: string; refColor: string }) {
    return <span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: `var(--${soft})`, color: `var(--${refColor})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</span>;
}

function StatusPill({ refColor, label }: { refColor: string; label: string }) {
    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: `var(--${refColor}-soft)`, color: `var(--${refColor})`, textTransform: "uppercase", letterSpacing: ".03em" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: `var(--${refColor})` }} />
            {label}
        </span>
    );
}

function SectionHeader({ icon, soft, refColor, title, subtitle, badge }: { icon: ReactNode; soft: string; refColor: string; title: string; subtitle?: string; badge?: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 18px 12px", borderBottom: "1px solid var(--c-border)" }}>
            <ChipIcon soft={soft} refColor={refColor}>{icon}</ChipIcon>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
                {subtitle && <div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{subtitle}</div>}
            </div>
            {badge != null && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-primary-soft)", padding: "2px 8px", borderRadius: 20, fontFamily: MONO }}>{badge}</span>}
        </div>
    );
}
