/**
 * Delivery Detail Page - Driver App
 *
 * Shows full details of a delivery task with:
 * - Customer info with call button
 * - Address with navigate button
 * - Order info (item count, amount to collect)
 * - Payment status
 * - Complete delivery button
 */

import { useState, useMemo, type CSSProperties, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDriverTasks } from "../hooks/use-driver-tasks";
import { CompleteDeliverySheet } from "../components/CompleteDeliverySheet";
import { useCurrency } from "@/hooks/use-currency";
import { useShop } from "@/hooks/use-shop";
import { groupOrderItemsByCategory } from "@/lib/order-item-groups";
import { getCountryByCurrency } from "@/config/countries";
import {
    Phone,
    Navigation,
    Clock,
    Package,
    User,
    MessageCircle,
    CheckCircle2,
    AlertTriangle,
    Truck,
    Edit2,
    Banknote,
    MapPin,
    Loader2,
    Shirt,
} from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";

export function DeliveryDetailPage() {
    const { t } = useTranslation();
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const { formatAmount } = useCurrency();
    const { shop } = useShop();
    const [showCompleteSheet, setShowCompleteSheet] = useState(false);

    const { deliveryTasks, loading } = useDriverTasks({ type: "delivery" });

    // Find the task for this order
    const task = useMemo(() =>
        deliveryTasks.find(t => t.orderId === orderId),
        [deliveryTasks, orderId]
    );

    const formatScheduledDate = (date: Date) => {
        if (isToday(date)) return t("common.today", "Today");
        if (isTomorrow(date)) return t("common.tomorrow", "Tomorrow");
        return format(date, "EEEE, MMM d");
    };

    const handleCall = () => {
        if (task?.customer.phone) {
            window.open(`tel:${task.customer.phone}`);
        }
    };

    const handleWhatsApp = () => {
        if (task?.customer.phone) {
            window.open(`https://wa.me/91${task.customer.phone}`);
        }
    };

    const handleNavigate = () => {
        if (task?.customer.address) {
            window.open(`https://maps.google.com/?q=${encodeURIComponent(task.customer.address)}`);
        }
    };

    const handleComplete = () => {
        setShowCompleteSheet(false);
        navigate("/agent/deliveries");
    };

    if (loading) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
                <Loader2 className="animate-spin" size={26} style={{ color: "var(--c-primary)" }} />
            </div>
        );
    }

    if (!task) {
        return (
            <div style={{ color: "var(--c-text)", textAlign: "center", padding: "60px 22px", maxWidth: 460, margin: "0 auto" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--c-warning-soft)", color: "var(--c-warning)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <AlertTriangle size={26} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{t("agent.taskNotFound", "Task not found")}</div>
                <p style={{ color: "var(--c-text-3)", marginBottom: 18, fontSize: 13 }}>{t("agent.taskNotFoundDesc", "This delivery task may have been completed or removed")}</p>
                <button onClick={() => navigate("/agent/deliveries")} style={btnOutline}>
                    {t("agent.backToDeliveries", "Back to Deliveries")}
                </button>
            </div>
        );
    }

    const isCompleted = task.status === "completed";
    const hasAmount = (task.amountToCollect || 0) > 0;

    const items = task.items || [];
    const f = task.financials;
    // Tax label is a HISTORICAL record: show the tax name the order was actually
    // charged under (frozen at creation). Only fall back to the shop's current
    // config (then the country default) when the order has no stored tax name.
    const taxLabel = f?.taxName || shop?.settings?.tax?.name || getCountryByCurrency(shop?.settings?.currency || "INR").taxName;

    const payRef = task.paymentStatus === "paid" ? "c-success" : task.paymentStatus === "partial" ? "c-warning" : "c-error";
    const payLabel = task.paymentStatus === "paid" ? t("agent.paid", "Paid") :
        task.paymentStatus === "partial" ? t("agent.partial", "Partial") :
            t("agent.unpaid", "Unpaid");

    return (
        <div style={{ color: "var(--c-text)", fontSize: 14, lineHeight: 1.45, padding: "20px 22px 40px", maxWidth: 720, margin: "0 auto" }}>
            {/* Header / title row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
                <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.01em", fontFamily: MONO }}>#{task.orderPublicId}</span>
                {isCompleted ? (
                    <StatusPill refColor="c-success" label={t("agent.delivered", "Delivered")} icon={<CheckCircle2 size={11} />} />
                ) : (
                    <StatusPill refColor="c-cyan" label={t("agent.delivery", "DELIVERY")} icon={<Truck size={11} />} />
                )}
                {task.orderSource === "online" && (
                    <span style={{ display: "inline-flex", alignItems: "center", fontSize: 10.5, fontWeight: 600, padding: "3px 9px", borderRadius: 20, border: "1px solid var(--c-border-strong)", color: "var(--c-text-2)" }}>
                        {t("orders.onlineOrder", "Online order")}
                    </span>
                )}
                {!isCompleted && (
                    <button onClick={() => navigate(`/agent/orders/new?edit=${orderId}`)} style={{ marginLeft: "auto", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 8, padding: "7px 12px" }}>
                        <Edit2 size={14} />{t("common.edit", "Edit")}
                    </button>
                )}
            </div>

            {/* Amount to Collect Card */}
            {hasAmount && !isCompleted && (
                <div style={{ ...card, marginBottom: 16, borderColor: "var(--c-success)", background: "var(--c-success-soft)", padding: "15px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <ChipIcon soft="c-success-soft" refColor="c-success"><Banknote size={16} /></ChipIcon>
                        <div>
                            <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginBottom: 2 }}>{t("agent.collectFromCustomer", "Collect from customer")}</div>
                            <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: "var(--c-success)" }}>{formatAmount(task.amountToCollect || 0)}</div>
                        </div>
                    </div>
                    <StatusPill refColor={payRef} label={payLabel} />
                </div>
            )}

            {/* Schedule Card */}
            <div style={{ ...card, marginBottom: 16, padding: "15px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <ChipIcon soft="c-primary-soft" refColor="c-primary"><Clock size={16} /></ChipIcon>
                <div>
                    <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginBottom: 2 }}>{t("agent.expectedDelivery", "Expected Delivery")}</div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{formatScheduledDate(task.scheduledDate)}</div>
                </div>
            </div>

            {/* Customer Card */}
            <div style={{ ...card, marginBottom: 16 }}>
                <SectionHeader icon={<User size={15} />} soft="c-primary-soft" refColor="c-primary" title={t("agent.customer", "Customer")} />
                <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 9 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{task.customer.name}</div>
                    {task.customer.phone && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--c-text-2)", fontSize: 13 }}>
                            <Phone size={14} style={{ color: "var(--c-text-3)", flex: "none" }} />
                            <span style={{ fontFamily: MONO }}>{task.customer.phone}</span>
                        </div>
                    )}
                    <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                        <button onClick={handleCall} style={{ ...btnOutline, flex: 1 }}>
                            <Phone size={15} />
                            {t("common.call", "Call")}
                        </button>
                        <button onClick={handleWhatsApp} style={{ ...btnOutline, flex: 1 }}>
                            <MessageCircle size={15} />
                            WhatsApp
                        </button>
                    </div>
                </div>
            </div>

            {/* Address Card */}
            <div style={{ ...card, marginBottom: 16 }}>
                <SectionHeader icon={<MapPin size={15} />} soft="c-cyan-soft" refColor="c-cyan" title={t("agent.deliveryAddress", "Delivery Address")} />
                <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ color: "var(--c-text-2)", fontSize: 13.5 }}>{task.customer.address}</div>
                    <button onClick={handleNavigate} style={{ ...btnOutline, width: "100%" }}>
                        <Navigation size={15} />
                        {t("agent.openInMaps", "Open in Maps")}
                    </button>
                </div>
            </div>

            {/* Order Info / Items */}
            <div style={{ ...card, marginBottom: 16, overflow: "hidden" }}>
                <SectionHeader
                    icon={<Package size={15} />}
                    soft="c-info-soft"
                    refColor="c-info"
                    title={t("agent.orderInfo", "Order Info")}
                    subtitle={`${task.itemCount} ${t("agent.itemsToDeliver", "items to deliver")}`}
                    badge={String(task.itemCount)}
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
                            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 19 }}>{formatAmount(f.total || items.reduce((sum, item) => sum + item.total, 0))}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Instructions Card (if any) */}
            {task.instructions && (
                <div style={{ ...card, marginBottom: 16, borderColor: "var(--c-warning)", background: "var(--c-warning-soft)" }}>
                    <div style={{ padding: "14px 18px" }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--c-warning)", marginBottom: 6 }}>
                            {t("agent.specialInstructions", "Special Instructions")}
                        </div>
                        <div style={{ color: "var(--c-text)", fontSize: 13.5 }}>{task.instructions}</div>
                    </div>
                </div>
            )}

            {/* Complete Button */}
            {!isCompleted && (
                <button onClick={() => setShowCompleteSheet(true)} style={{ ...btnPrimary, width: "100%", fontSize: 15, padding: "13px 16px", marginTop: 4 }}>
                    <CheckCircle2 size={18} />
                    {t("agent.completeDelivery", "Complete Delivery")}
                </button>
            )}

            {/* Complete Delivery Sheet */}
            <CompleteDeliverySheet
                open={showCompleteSheet}
                onClose={() => setShowCompleteSheet(false)}
                task={task}
                onComplete={handleComplete}
            />
        </div>
    );
}

/* ── design-system helpers ───────────────────────────────────────── */
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

const TINTS = ["c-primary", "c-violet", "c-info", "c-cyan", "c-success", "c-warning"];
const tintFor = (s: string) => { let h = 0; for (const c of s || "x") h = (h * 31 + c.charCodeAt(0)) >>> 0; return TINTS[h % TINTS.length]; };

const card: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, boxShadow: "var(--sh-sm)" };
const btnPrimary: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 9, padding: "10px 16px", boxShadow: "var(--sh-sm)" };
const btnOutline: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-surface)", border: "1px solid var(--c-primary)", borderRadius: 9, padding: "10px 16px" };

function ChipIcon({ children, soft, refColor }: { children: ReactNode; soft: string; refColor: string }) {
    return <span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: `var(--${soft})`, color: `var(--${refColor})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</span>;
}

function StatusPill({ refColor, label, icon }: { refColor: string; label: string; icon?: ReactNode }) {
    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: `var(--${refColor}-soft)`, color: `var(--${refColor})`, textTransform: "uppercase", letterSpacing: ".03em" }}>
            {icon || <span style={{ width: 5, height: 5, borderRadius: "50%", background: `var(--${refColor})` }} />}
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
