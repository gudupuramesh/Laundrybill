/**
 * MOBILE order detail — a 1:1 clone of the owner app's OrderDetailsScreen
 * (mobile/src/screens/OrderDetailsScreen.tsx): back header with #ID + status
 * badge + edit · status hero (placed date, delivery-type pill, progress dots,
 * "Step n of m", expected-delivery strip that turns red when overdue, "Mark
 * as X" CTA + View all statuses) · quick-action tiles · customer card ·
 * delivery details · items · payment summary.
 *
 * Status changes and payment reuse the web's existing sheets.
 */

import { useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrency } from "@/hooks/use-currency";
import { useShop } from "@/hooks/use-shop";
import { getReceiptBlob, getThermalReceiptBlob } from "@/lib/generateReceipt";
import { STATUS_LABELS, mapLegacyDeliveryType } from "@/types/order";
import type { Order, OrderStatus } from "@/types/order";
import { StatusUpdateSheet } from "./StatusUpdateSheet";
import { PaymentCollectionSheet } from "./PaymentCollectionSheet";
import { useTranslation } from "react-i18next";
import {
    ArrowLeft, Edit, Printer, FileText, QrCode, Share2, Phone, MessageCircle,
    CalendarDays, AlertTriangle, CheckCircle2, ArrowRight, MapPin, User,
} from "lucide-react";
import { buildWaPhone } from "@/lib/whatsappShare";

const SC: Record<string, { bg: string; text: string }> = {
    pending: { bg: "var(--c-warning-soft)", text: "var(--c-warning)" },
    processing: { bg: "var(--c-info-soft)", text: "var(--c-info)" },
    ready: { bg: "#F1FBE7", text: "#84CC16" },
    ready_for_pickup: { bg: "#F1FBE7", text: "#84CC16" },
    out_for_delivery: { bg: "var(--c-primary-soft)", text: "var(--c-primary)" },
    partially_delivered: { bg: "var(--c-warning-soft)", text: "var(--c-warning)" },
    delivered: { bg: "var(--c-success-soft)", text: "var(--c-success)" },
    picked_up: { bg: "var(--c-success-soft)", text: "var(--c-success)" },
    pickup_scheduled: { bg: "var(--c-warning-soft)", text: "var(--c-warning)" },
    pickup_completed: { bg: "var(--c-violet-soft)", text: "var(--c-violet)" },
    cancelled: { bg: "var(--c-error-soft)", text: "var(--c-error)" },
};

/** Status flow per delivery type — same shape the app draws its dots from. */
function flowFor(deliveryType: string): OrderStatus[] {
    if (deliveryType === "pickup_store") return ["pending", "processing", "ready", "picked_up"];
    if (deliveryType === "pickup_home") return ["pickup_scheduled", "pickup_completed", "processing", "ready", "delivered"];
    return ["pending", "processing", "ready", "out_for_delivery", "delivered"];
}

const TERMINAL: OrderStatus[] = ["delivered", "picked_up", "cancelled"];

export function MobileOrderDetail({ order, basePath, onBack, onEdit }: {
    order: Order;
    basePath: string;
    onBack: () => void;
    onEdit?: () => void;
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { formatAmount, currencySymbol } = useCurrency();
    const { shop } = useShop();
    const [statusOpen, setStatusOpen] = useState(false);
    const [payOpen, setPayOpen] = useState(false);
    const [printOpen, setPrintOpen] = useState(false);

    // Same receipt pipeline the desktop uses — A4 bill or 80mm POS-roll PDF.
    const openReceipt = async (format: "a4" | "thermal") => {
        setPrintOpen(false);
        const location = shop?.location;
        const shopInfo = {
            name: shop?.name || "LaundryBill",
            phone: shop?.phone,
            address: location?.address ? `${location.address}, ${location.city || ""} ${location.pincode || ""}` : undefined,
            gstNumber: shop?.gstNumber,
            countryCode: shop?.settings?.countryCode,
            currencySymbol,
            currencyCode: shop?.settings?.currency,
            receiptTerms: shop?.settings?.receiptTerms,
            showTracking: shop?.settings?.trackingEnabled !== false,
            logoUrl: shop?.settings?.receiptShowLogo === false ? undefined : shop?.logo,
            upiId: shop?.bankDetails?.upiId,
            paymentLink: shop?.bankDetails?.paymentLink,
            showPaymentQr: shop?.settings?.receiptPaymentQr !== false,
        };
        // Open the tab synchronously (before any await) so popup blockers allow it.
        const win = window.open("", "_blank");
        try {
            const blob = format === "thermal" ? await getThermalReceiptBlob(order, shopInfo) : await getReceiptBlob(order, shopInfo);
            const url = URL.createObjectURL(blob);
            if (win) win.location.href = url; else window.open(url, "_blank");
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (e) { win?.close(); console.error("receipt", e); }
    };

    const status = order.status;
    const sc = SC[status] || SC.pending;
    const dtype = mapLegacyDeliveryType(order.deliveryType);
    const flow = flowFor(dtype);
    const flowIndex = flow.indexOf(status);
    const isTerminal = TERMINAL.includes(status);
    const nextStatus = flowIndex >= 0 && flowIndex < flow.length - 1 ? flow[flowIndex + 1] : null;

    const createdAt = order.createdAt?.toDate?.();
    const expected = order.expectedDelivery?.toDate?.();
    const isOverdue = !!expected && !isTerminal && expected.getTime() < Date.now();

    const total = Math.round(order.financials?.total || 0);
    const paid = Math.round(order.financials?.amountPaid || 0);
    const balance = Math.round(order.financials?.balance ?? (total - paid));
    const phone = order.customerPhone || "";

    const card: CSSProperties = { background: "var(--c-surface)", borderRadius: 18, border: "1px solid var(--c-border)", boxShadow: "var(--sh-sm)" };
    const iconBtn: CSSProperties = { cursor: "pointer", flex: "none", width: 40, height: 40, borderRadius: 20, border: 0, background: "var(--c-surface-2)", color: "var(--c-primary)", display: "flex", alignItems: "center", justifyContent: "center" };
    const secLabel: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--c-text-3)", marginBottom: 10 };
    const row = (label: string, value: ReactNode) => (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "7px 0" }}>
            <span style={{ fontSize: 13, color: "var(--c-text-2)" }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, textAlign: "right" }}>{value}</span>
        </div>
    );
    const qaTile = (icon: ReactNode, bg: string, label: string, onClick: () => void) => (
        <button onClick={onClick} style={{ ...card, cursor: "pointer", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 4px", font: "inherit" }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--c-text-2)" }}>{label}</span>
        </button>
    );

    return (
        <div style={{ minHeight: "100%", background: "var(--c-bg)", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ position: "sticky", top: 0, zIndex: 5, flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)" }}>
                <button onClick={onBack} aria-label="Back" style={iconBtn}><ArrowLeft size={22} /></button>
                <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 17, fontWeight: 700, whiteSpace: "nowrap" }}>#{order.publicId || order.orderNumber}</span>
                    <span style={{ background: sc.bg, color: sc.text, padding: "3px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{STATUS_LABELS[status] || status}</span>
                    {order.orderSource === "online" && <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "3px 7px", borderRadius: 8, fontSize: 10, fontWeight: 700 }}>Online</span>}
                </div>
                {!isTerminal && onEdit && <button onClick={onEdit} aria-label={t("common.edit", "Edit")} style={iconBtn}><Edit size={20} /></button>}
            </div>

            <div style={{ flex: 1, padding: 16, paddingBottom: "calc(110px + env(safe-area-inset-bottom, 0px))", display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Status hero */}
                <div style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", color: "var(--c-text-3)" }}>{t("mobile.orderPlacedLabel", "Order placed")}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{createdAt ? createdAt.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}</div>
                        </div>
                        <span style={{ flex: "none", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", color: "var(--c-text-2)", padding: "5px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>
                            {t(`orders.deliveryTypes.${dtype}`, dtype.replace(/_/g, " "))}
                        </span>
                    </div>

                    {status === "cancelled" ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: "var(--c-error-soft)", color: "var(--c-error)" }}>
                            <AlertTriangle size={17} /><span style={{ fontSize: 13.5, fontWeight: 700 }}>{STATUS_LABELS.cancelled}</span>
                        </div>
                    ) : (
                        <>
                            {/* Progress dots + "Step n of m" */}
                            {flowIndex >= 0 && (
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                                        {flow.map((s, i) => (
                                            <div key={s} style={{ display: "contents" }}>
                                                {i > 0 && <span style={{ flex: 1, height: 3, borderRadius: 2, background: i <= flowIndex ? sc.text : "var(--c-border)" }} />}
                                                <span style={{ flex: "none", width: 16, height: 16, borderRadius: 8, border: `2px solid ${i <= flowIndex ? sc.text : "var(--c-border)"}`, background: i < flowIndex ? sc.text : "var(--c-surface)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                    {i === flowIndex && <span style={{ width: 6, height: 6, borderRadius: 3, background: sc.text }} />}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: sc.text }}>{STATUS_LABELS[status] || status}</span>
                                        <span style={{ fontSize: 12.5, color: "var(--c-text-3)" }}>&nbsp;·&nbsp;{t("mobile.stepOf", `Step ${flowIndex + 1} of ${flow.length}`)}</span>
                                    </div>
                                </div>
                            )}

                            {/* Expected / delivered strip */}
                            {isTerminal ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: "var(--c-success-soft)", color: "var(--c-success)" }}>
                                    <CheckCircle2 size={17} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>{STATUS_LABELS[status] || status}</div>
                                        <div style={{ fontSize: 13, fontWeight: 700 }}>{(order.deliveredAt?.toDate?.() || expected)?.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) || "—"}</div>
                                    </div>
                                </div>
                            ) : expected ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: isOverdue ? "var(--c-error-soft)" : "var(--c-surface-2)" }}>
                                    {isOverdue ? <AlertTriangle size={17} style={{ color: "var(--c-error)" }} /> : <CalendarDays size={17} style={{ color: "var(--c-primary)" }} />}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: isOverdue ? "var(--c-error)" : "var(--c-text-3)" }}>
                                            {dtype === "pickup_store" ? t("mobile.expectedReadyUpper", "Expected ready") : t("mobile.expectedDeliveryUpper", "Expected delivery")}
                                        </div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: isOverdue ? "var(--c-error)" : "var(--c-text)" }}>{expected.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                                    </div>
                                    {isOverdue && <span style={{ background: "var(--c-error)", color: "#fff", padding: "3px 8px", borderRadius: 8, fontSize: 10, fontWeight: 700 }}>{t("orders.overdue", "Overdue")}</span>}
                                </div>
                            ) : null}

                            {nextStatus && (
                                <button onClick={() => setStatusOpen(true)} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "12px 14px", borderRadius: 12, border: 0, background: "var(--c-primary)", color: "#fff", font: "inherit", fontSize: 14, fontWeight: 700 }}>
                                    {t("mobile.markAsBtn", `Mark as ${STATUS_LABELS[nextStatus] || nextStatus}`)}<ArrowRight size={18} />
                                </button>
                            )}
                            {!isTerminal && (
                                <button onClick={() => setStatusOpen(true)} style={{ cursor: "pointer", width: "100%", padding: "4px", border: 0, background: "transparent", font: "inherit", fontSize: 13, fontWeight: 700, color: "var(--c-primary)" }}>
                                    {t("mobile.allStatusesLink", "View all statuses")}
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* Quick actions */}
                <div style={{ display: "flex", gap: 8 }}>
                    {qaTile(<Printer size={18} style={{ color: "#5e3c00" }} />, "#fff4d6", t("mobile.printChip", "Print"), () => setPrintOpen(true))}
                    {qaTile(<FileText size={18} style={{ color: "#c62828" }} />, "#fde8e8", t("mobile.pdfChip", "PDF"), () => openReceipt("a4"))}
                    {qaTile(<QrCode size={18} style={{ color: "var(--c-primary)" }} />, "var(--c-primary-soft)", t("mobile.qrCodeChip", "QR Code"), () => navigate(`${basePath}/orders/${order.id}?qr=1`))}
                    {qaTile(<Share2 size={18} style={{ color: "#006b5f" }} />, "#e6f7f2", t("mobile.shareChip", "Share"), () => {
                        if (phone) window.open(`https://wa.me/${buildWaPhone(phone)}`, "_blank");
                    })}
                </div>

                {/* Customer */}
                <div style={{ ...card, padding: 16 }}>
                    <div style={secLabel}>{t("customer.title", "Customer")}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ width: 44, height: 44, flex: "none", borderRadius: "50%", background: "var(--c-primary-soft)", color: "var(--c-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}><User size={20} /></span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.customerName || t("mobile.guestCustomer", "Guest")}</div>
                            <div style={{ fontSize: 13, color: "var(--c-text-2)" }}>{phone || order.customerEmail || "—"}</div>
                        </div>
                        {phone && (
                            <div style={{ display: "flex", gap: 8 }}>
                                <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} aria-label="Call" style={{ ...iconBtn, textDecoration: "none" }}><Phone size={18} /></a>
                                <a href={`https://wa.me/${buildWaPhone(phone)}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" style={{ ...iconBtn, color: "#25D366", textDecoration: "none" }}><MessageCircle size={18} /></a>
                            </div>
                        )}
                    </div>
                    {order.deliveryAddress && (
                        <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--c-border)" }}>
                            <MapPin size={16} style={{ flex: "none", color: "var(--c-text-3)", marginTop: 1 }} />
                            <span style={{ fontSize: 13, color: "var(--c-text-2)", lineHeight: 1.5 }}>{order.deliveryAddress}</span>
                        </div>
                    )}
                </div>

                {/* Items */}
                <div style={{ ...card, padding: 16 }}>
                    <div style={secLabel}>{t("orders.items", "Items")} · {(order.items || []).reduce((s, i) => s + (i.quantity || 1), 0)}</div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        {(order.items || []).map((it, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i > 0 ? "1px solid var(--c-border)" : "none" }}>
                                <span style={{ width: 28, height: 28, flex: "none", borderRadius: 8, background: "var(--c-surface-2)", color: "var(--c-text-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{it.quantity || 1}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.serviceName}</div>
                                    <div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{it.categoryName || it.unit}{it.pieceCount ? ` · ${it.pieceCount} pcs` : ""}{it.express ? " · Express" : ""}</div>
                                    {it.notes && <div style={{ fontSize: 11.5, color: "var(--c-warning)", fontStyle: "italic", marginTop: 2 }}>✎ {it.notes}</div>}
                                </div>
                                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{formatAmount(it.total || 0)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Payment */}
                {order.deliveryNotes && (
                    <div style={{ ...card, padding: 16 }}>
                        <div style={secLabel}>{t("orders.orderNotes", "Order Notes")}</div>
                        <div style={{ fontSize: 13, color: "var(--c-text-2)", whiteSpace: "pre-line", lineHeight: 1.5 }}>{order.deliveryNotes}</div>
                    </div>
                )}

                <div style={{ ...card, padding: 16 }}>
                    <div style={secLabel}>{t("checkout.payment", "Payment")}</div>
                    {row(t("pos.subtotal", "Subtotal"), formatAmount(order.financials?.subtotal || 0))}
                    {!!order.financials?.discountAmount && row(t("pos.discount", "Discount"), `− ${formatAmount(order.financials.discountAmount)}`)}
                    {!!order.financials?.expressCharge && row(t("pos.expressCharge", "Express charge"), formatAmount(order.financials.expressCharge))}
                    {!!order.financials?.deliveryCharge && row(t("pos.deliveryFee", "Delivery fee"), formatAmount(order.financials.deliveryCharge))}
                    {!!order.financials?.taxAmount && row(order.financials.taxName || t("pos.tax", "Tax"), formatAmount(order.financials.taxAmount))}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", marginTop: 4, borderTop: "1px solid var(--c-border)" }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{t("pos.total", "Total")}</span>
                        <span style={{ fontSize: 18, fontWeight: 700 }}>{formatAmount(total)}</span>
                    </div>
                    {row(t("mobile.paidLabel", "Paid"), <span style={{ color: "var(--c-success)" }}>{formatAmount(paid)}</span>)}
                    {balance > 0 && (
                        <>
                            {row(t("mobile.balanceLabel", "Balance"), <span style={{ color: "var(--c-error)" }}>{formatAmount(balance)}</span>)}
                            <button onClick={() => setPayOpen(true)} style={{ cursor: "pointer", width: "100%", marginTop: 10, padding: "12px 14px", borderRadius: 12, border: 0, background: "var(--c-success)", color: "#fff", font: "inherit", fontSize: 14, fontWeight: 700 }}>
                                {t("mobile.collect", "Collect")} {formatAmount(balance)}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Print format chooser — A4 vs POS thermal roll */}
            {printOpen && (
                <>
                    <div onClick={() => setPrintOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,23,42,.45)" }} />
                    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 61, background: "var(--c-surface)", borderRadius: "20px 20px 0 0", padding: "10px 16px calc(16px + env(safe-area-inset-bottom, 0px))", boxShadow: "0 -8px 30px rgba(15,23,42,.18)" }}>
                        <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--c-border)", margin: "0 auto 12px" }} />
                        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{t("orders.printFormat", "Print format")}</div>
                        <button onClick={() => openReceipt("a4")} style={{ width: "100%", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "13px 12px", borderRadius: 12, border: "1px solid var(--c-border)", background: "var(--c-surface)", font: "inherit", textAlign: "left", marginBottom: 8 }}>
                            <span style={{ width: 38, height: 38, flex: "none", borderRadius: 10, background: "var(--c-primary-soft)", color: "var(--c-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}><FileText size={18} /></span>
                            <span style={{ flex: 1 }}>
                                <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{t("orders.printA4Full", "A4 bill")}</span>
                                <span style={{ display: "block", fontSize: 11.5, color: "var(--c-text-3)" }}>{t("orders.printA4Hint", "Full-page PDF for normal printers")}</span>
                            </span>
                        </button>
                        <button onClick={() => openReceipt("thermal")} style={{ width: "100%", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "13px 12px", borderRadius: 12, border: "1px solid var(--c-border)", background: "var(--c-surface)", font: "inherit", textAlign: "left" }}>
                            <span style={{ width: 38, height: 38, flex: "none", borderRadius: 10, background: "var(--c-warning-soft)", color: "var(--c-warning)", display: "flex", alignItems: "center", justifyContent: "center" }}><Printer size={18} /></span>
                            <span style={{ flex: 1 }}>
                                <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{t("orders.printThermalFull", "Thermal receipt (80mm)")}</span>
                                <span style={{ display: "block", fontSize: 11.5, color: "var(--c-text-3)" }}>{t("orders.printThermalHint2", "Till-roll layout for POS thermal printers")}</span>
                            </span>
                        </button>
                    </div>
                </>
            )}

            <StatusUpdateSheet open={statusOpen} onClose={() => setStatusOpen(false)} order={order} />
            <PaymentCollectionSheet open={payOpen} onClose={() => setPayOpen(false)} order={order} />
        </div>
    );
}
