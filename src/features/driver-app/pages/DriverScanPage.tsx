import { useState, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp, arrayUnion, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useDriverAuth } from "../DriverAuthContext"; // Using Driver Auth
import { LConfirmDialog, useLToast } from "@/components/laundry";
import { AlertCircle, Package, RefreshCw, Camera, Keyboard, Truck, CheckCircle2, ScanLine, Loader2 } from "lucide-react";
import type { Order, OrderStatus } from "@/types/order";
import { Scanner } from "@yudiel/react-qr-scanner";
import { isAndroidScannerEnv } from "@/lib/android-scanner";

type ScanMode = "camera" | "manual";

// Status -> token map for status pills
const STATUS_TOKEN: Record<string, { soft: string; ref: string }> = {
    pending: { soft: "c-surface-2", ref: "c-text-3" },
    pickup_scheduled: { soft: "c-info-soft", ref: "c-info" },
    processing: { soft: "c-info-soft", ref: "c-info" },
    ready: { soft: "c-success-soft", ref: "c-success" },
    ready_for_pickup: { soft: "c-success-soft", ref: "c-success" },
    out_for_delivery: { soft: "c-cyan-soft", ref: "c-cyan" },
    picked_up: { soft: "c-success-soft", ref: "c-success" },
    delivered: { soft: "c-success-soft", ref: "c-success" },
    pickup_completed: { soft: "c-violet-soft", ref: "c-violet" },
    cancelled: { soft: "c-error-soft", ref: "c-error" },
};

function StatusPill({ status }: { status: string }) {
    const tok = STATUS_TOKEN[status] || { soft: "c-surface-2", ref: "c-text-3" };
    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: `var(--${tok.soft})`, color: `var(--${tok.ref})` }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: `var(--${tok.ref})` }} />
            {status.replace(/_/g, " ").toUpperCase()}
        </span>
    );
}

export function DriverScanPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { agent, shopId } = useDriverAuth(); // Driver context
    const { addToast } = useLToast();

    const [scanMode, setScanMode] = useState<ScanMode>("camera");
    const [scannerActive, setScannerActive] = useState(false);
    const [scanInput, setScanInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [order, setOrder] = useState<Order | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);

    const lookupOrderRef = useRef<(scanValue: string) => Promise<void>>(null as unknown as (scanValue: string) => Promise<void>);

    // Action Dialog
    const [confirmAction, setConfirmAction] = useState<{
        open: boolean;
        type: "pickup" | "deliver" | null;
    }>({ open: false, type: null });

    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (scanMode === "manual") inputRef.current?.focus();
    }, [scanMode]);

    const lookupOrder = async (scanValue: string) => {
        if (!scanValue.trim() || !shopId) {
            setError("Shop ID not available or invalid scan.");
            return;
        }

        setLoading(true);
        setError(null);
        setOrder(null);

        try {
            // Parse QR: "orderId:itemIndex" or just "orderId"
            const parts = scanValue.trim().split(":");
            const orderId = parts[0];

            // Access correct collection for driver (usually scoped to a shop or global if driver is cross-shop)
            // Assuming driver is attached to a shop context for now as per Plant/Driver structure
            const orderRef = doc(db, "shops", shopId, "orders", orderId);
            const orderSnap = await getDoc(orderRef);

            if (!orderSnap.exists()) {
                setError(t('driver.scan.notFound', 'Order not found.'));
                return;
            }

            const orderData = { id: orderSnap.id, ...orderSnap.data() } as Order;
            setOrder(orderData);
            setScanInput("");
        } catch (err: any) {
            console.error("Scan error:", err);
            setError(err.message || "Failed to lookup order");
        } finally {
            setLoading(false);
        }
    };

    lookupOrderRef.current = lookupOrder;

    useEffect(() => {
        if (!isAndroidScannerEnv()) return;
        const handler = (result: string) => {
            if (result && typeof result === "string" && lookupOrderRef.current) {
                lookupOrderRef.current(result.trim());
            }
        };
        window.onScanResult = handler;
        return () => {
            if (window.onScanResult === handler) window.onScanResult = undefined;
        };
    }, []);

    const handleOpenScanner = () => {
        if (isAndroidScannerEnv() && window.Android?.startScanner) {
            window.Android.startScanner();
            setScannerActive(true);
        } else {
            setScannerActive(true);
        }
    };

    const handleAction = async () => {
        if (!order || !confirmAction.type || !shopId || !agent) return;

        setLoading(true);
        try {
            const orderRef = doc(db, "shops", shopId, "orders", order.id);
            let newStatus: OrderStatus = order.status;
            let note = "";

            if (confirmAction.type === "pickup") {
                // If checking out from plant/store -> picked_up (heading to plant) or delivery logic?
                // Driver Pickup usually means:
                // 1. Picking up from Customer -> Inbound
                // 2. Picking up from Plant -> Out for Delivery?
                // Let's assume standard logic:
                // - If status is 'pending' (at customer) -> 'pickup_completed' (Driver collected)
                // - If status is 'ready' (at plant) -> 'out_for_delivery' (Driver delivering)

                if (order.status === 'pending' || order.status === 'pickup_scheduled') {
                    newStatus = 'pickup_completed'; // Driver has it
                    note = "Picked up from customer";
                } else if (order.status === 'ready') {
                    newStatus = 'out_for_delivery';
                    note = "Picked up from plant";
                }
            } else if (confirmAction.type === "deliver") {
                newStatus = 'delivered';
                note = "Delivered to customer";
            }

            await updateDoc(orderRef, {
                status: newStatus,
                updatedAt: serverTimestamp(),
                timeline: arrayUnion({
                    status: newStatus,
                    timestamp: Timestamp.now(),
                    staffId: agent.id,
                    staffName: agent.name,
                    notes: note
                })
            });

            addToast({
                type: "success",
                title: t('driver.success', 'Order Updated'),
                description: `Order marked as ${newStatus}`
            });

            setConfirmAction({ open: false, type: null });
            setOrder({ ...order, status: newStatus }); // Optimistic update

        } catch (err: any) {
            console.error("Update error:", err);
            addToast({
                type: "error",
                title: "Update Failed",
                description: err.message
            });
        } finally {
            setLoading(false);
        }
    };

    const getAvailableAction = (order: Order) => {
        // Define Driver Actions based on current status
        if (order.deliveryType === 'pickup_store') return null; // Shop pickup, driver shouldn't touch usually?

        if (['pending', 'pickup_scheduled'].includes(order.status)) {
            return {
                label: "Confirm Pickup from Customer",
                type: "pickup" as const,
                variant: "primary" as const,
                icon: Truck
            };
        }
        if (order.status === 'ready') {
            return {
                label: "Start Delivery (Pickup from Plant)",
                type: "pickup" as const, // Reusing pickup logic but contextual handling above
                variant: "primary" as const,
                icon: Truck
            };
        }
        if (order.status === 'out_for_delivery') {
            return {
                label: "Confirm Delivery to Customer",
                type: "deliver" as const,
                variant: "success" as const,
                icon: CheckCircle2
            };
        }
        return null;
    };

    const action = order ? getAvailableAction(order) : null;

    const seg = (active: boolean): CSSProperties => ({
        flex: 1, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        font: "inherit", fontSize: 13.5, fontWeight: 600, borderRadius: 9, padding: "10px 0",
        color: active ? "#fff" : "var(--c-text-2)",
        background: active ? "var(--c-primary)" : "var(--c-surface)",
        border: `1px solid ${active ? "var(--c-primary)" : "var(--c-border-strong)"}`,
    });

    return (
        <div style={{ color: "var(--c-text)", fontSize: 14, lineHeight: 1.45, padding: "20px 22px 40px", maxWidth: 460, margin: "0 auto" }}>
            <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.01em" }}>{t('driver.scan.title', 'Scan Order')}</div>
                <div style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 3 }}>{t('driver.scan.desc', 'Scan QR to pickup or deliver orders')}</div>
            </div>

            {/* Mode Toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button style={seg(scanMode === "camera")} onClick={() => { setScanMode("camera"); setScannerActive(false); }}>
                    <Camera size={16} /> Camera
                </button>
                <button style={seg(scanMode === "manual")} onClick={() => setScanMode("manual")}>
                    <Keyboard size={16} /> Manual
                </button>
            </div>

            {/* Scanner Area */}
            {!order && (
                <div style={{ ...card, padding: 16 }}>
                    {scanMode === "camera" ? (
                        !scannerActive ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "24px 0" }}>
                                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--c-primary-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <ScanLine size={32} color="var(--c-primary)" />
                                </div>
                                <p style={{ margin: 0, fontSize: 13, color: "var(--c-text-3)", textAlign: "center" }}>{t('scanner.openScannerHint', 'Tap to open the camera and scan a QR code')}</p>
                                <button style={btnPrimary} onClick={handleOpenScanner}>
                                    <Camera size={18} />
                                    {t('scanner.openScanner', 'Open scanner')}
                                </button>
                            </div>
                        ) : isAndroidScannerEnv() ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "32px 0" }}>
                                <ScanLine size={48} color="var(--c-primary)" />
                                <p style={{ margin: 0, fontSize: 13, color: "var(--c-text-3)", textAlign: "center" }}>{t('scanner.useDeviceCamera', 'Use your device camera to scan the QR code')}</p>
                                <button style={btnOutline} onClick={() => setScannerActive(false)}>{t('scanner.openScanner', 'Open scanner')}</button>
                                {loading && <Loader2 size={22} color="var(--c-primary)" className="animate-spin" />}
                            </div>
                        ) : (
                            <div style={{ width: "100%", aspectRatio: "1 / 1", background: "#000", borderRadius: 10, overflow: "hidden", position: "relative" }}>
                                {cameraError ? (
                                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", padding: 16, textAlign: "center", gap: 12 }}>
                                        <AlertCircle size={48} color="var(--c-error)" />
                                        <p style={{ margin: 0 }}>{cameraError}</p>
                                        <button style={{ ...btnOutline, color: "#fff", border: "1px solid #fff", background: "transparent" }} onClick={() => setCameraError(null)}>Retry</button>
                                    </div>
                                ) : (
                                    <Scanner
                                        onScan={res => res?.[0]?.rawValue && lookupOrder(res[0].rawValue)}
                                        onError={() => setCameraError("Camera issue. Try manual mode.")}
                                        constraints={{ facingMode: "environment" }}
                                        styles={{ container: { width: "100%", height: "100%" } }}
                                    />
                                )}
                                {loading && (
                                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <Loader2 size={28} color="#fff" className="animate-spin" />
                                    </div>
                                )}
                            </div>
                        )
                    ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                            <input
                                ref={inputRef}
                                value={scanInput}
                                onChange={e => setScanInput(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && lookupOrder(scanInput)}
                                placeholder="Scan/Type Order ID"
                                autoFocus
                                style={{ flex: 1, font: "inherit", fontSize: 14, color: "var(--c-text)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 9, padding: "11px 13px", outline: "none" }}
                            />
                            <button
                                onClick={() => lookupOrder(scanInput)}
                                disabled={loading || !scanInput}
                                style={{ cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 9, padding: "0 20px", opacity: (loading || !scanInput) ? 0.6 : 1 }}
                            >
                                Lookup
                            </button>
                        </div>
                    )}
                    {error && <div style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: "var(--c-error)", textAlign: "center" }}>{error}</div>}
                </div>
            )}

            {/* Order Result */}
            {order && (
                <div style={{ ...card, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>Order Found</div>
                        <button style={btnGhost} onClick={() => setOrder(null)}>
                            <RefreshCw size={14} /> Scan Again
                        </button>
                    </div>

                    <div style={{ display: "flex", gap: 14, alignItems: "center", padding: 14, background: "var(--c-surface-2)", borderRadius: 10, marginBottom: 14 }}>
                        <ChipIcon soft="c-primary-soft" refColor="c-primary"><Package size={18} /></ChipIcon>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ font: MONO, fontFamily: MONO, fontSize: 17, fontWeight: 600, color: "var(--c-text)" }}>{order.orderNumber}</div>
                            <div style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 1 }}>{order.customerName}</div>
                            <div style={{ marginTop: 6 }}><StatusPill status={order.status} /></div>
                        </div>
                    </div>

                    {/* Action Button */}
                    {action ? (
                        <button
                            onClick={() => setConfirmAction({ open: true, type: action.type })}
                            style={{
                                ...btnPrimary,
                                width: "100%",
                                fontSize: 15,
                                padding: "14px 16px",
                                background: action.variant === "success" ? "var(--c-success)" : "var(--c-primary)",
                            }}
                        >
                            <action.icon size={18} />
                            {action.label}
                        </button>
                    ) : (
                        <div style={{ padding: 14, background: "var(--c-warning-soft)", color: "var(--c-warning)", borderRadius: 10, textAlign: "center", fontSize: 13, fontWeight: 600 }}>
                            No actions available for this order status ({order.status}).
                        </div>
                    )}

                    <button style={{ ...btnOutline, width: "100%", marginTop: 10 }} onClick={() => navigate(`/driver/orders/${order.id}`)}>
                        View Full Details
                    </button>
                </div>
            )}

            {/* Error (when no order context to attach it to) */}
            {error && !order && scanMode === "camera" && scannerActive && (
                <div style={{ ...card, padding: "12px 14px", marginTop: 14, display: "flex", alignItems: "center", gap: 8, borderColor: "var(--c-error)", background: "var(--c-error-soft)", color: "var(--c-error)", fontSize: 13, fontWeight: 600 }}>
                    <AlertCircle size={18} /> {error}
                </div>
            )}

            <LConfirmDialog
                open={confirmAction.open}
                onClose={() => setConfirmAction({ open: false, type: null })}
                onConfirm={handleAction}
                title="Confirm Action"
                description={`Are you sure you want to proceed with this action for Order ${order?.orderNumber}?`}
                confirmText="Confirm"
            />
        </div>
    );
}

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const card: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, boxShadow: "var(--sh-sm)" };
const btnPrimary: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 9, padding: "10px 16px", boxShadow: "var(--sh-sm)" };
const btnOutline: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-surface)", border: "1px solid var(--c-primary)", borderRadius: 9, padding: "10px 16px" };
const btnGhost: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", background: "transparent", border: 0, padding: "8px 10px" };
function ChipIcon({ children, soft, refColor }: { children: ReactNode; soft: string; refColor: string }) { return <span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: `var(--${soft})`, color: `var(--${refColor})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</span>; }
