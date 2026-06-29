import { useState, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useDriverAuth } from "@/features/driver-app/DriverAuthContext";
import { ScanLine, AlertCircle, Package, User, RefreshCw, Camera, Keyboard, Loader2 } from "lucide-react";
import type { Order } from "@/types/order";
import { format } from "date-fns";
import { Scanner } from "@yudiel/react-qr-scanner";

type ScanMode = "camera" | "manual";

const STATUS_COLOR: Record<string, string> = {
    pending: "c-text-3",
    processing: "c-info",
    ready: "c-success",
    ready_for_pickup: "c-success",
    out_for_delivery: "c-cyan",
    picked_up: "c-success",
    delivered: "c-success",
    pickup_completed: "c-violet",
    cancelled: "c-error",
};

export function PlantScanPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { shopId } = useDriverAuth();
    const [scanMode, setScanMode] = useState<ScanMode>("camera");
    const [scanInput, setScanInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [order, setOrder] = useState<Order | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [itemIndex, setItemIndex] = useState<number | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus input in manual mode
    useEffect(() => {
        if (scanMode === "manual") {
            inputRef.current?.focus();
        }
    }, [scanMode]);

    const lookupOrder = async (scanValue: string) => {
        if (!scanValue.trim() || !shopId) {
            setError("Shop ID not available. Please log in again.");
            return;
        }

        setLoading(true);
        setError(null);
        setOrder(null);
        setItemIndex(null);

        try {
            // Parse QR content - can be "orderId" or "orderId:itemIndex"
            const parts = scanValue.trim().split(":");
            const orderId = parts[0];
            const itemIdx = parts[1] ? parseInt(parts[1], 10) : null;

            console.log("Looking up order:", orderId, "in shop:", shopId);

            // Fetch order from Firestore
            const orderRef = doc(db, "shops", shopId, "orders", orderId);
            const orderSnap = await getDoc(orderRef);

            if (!orderSnap.exists()) {
                setError(t('plant.scan.notFound', 'Order not found. Make sure you are scanning a valid tag.'));
                return;
            }

            const orderData = { id: orderSnap.id, ...orderSnap.data() } as Order;
            setOrder(orderData);
            setItemIndex(itemIdx);
            setScanInput(""); // Clear input after successful scan
        } catch (err: any) {
            console.error("Scan error:", err);
            setError(t('plant.scan.error', 'Failed to look up order: ') + (err.message || "Unknown error"));
        } finally {
            setLoading(false);
        }
    };

    // Handle camera scan result
    const handleCameraScan = (result: any[]) => {
        if (result && result.length > 0 && result[0].rawValue) {
            const scannedValue = result[0].rawValue;
            console.log("Camera scanned:", scannedValue);
            lookupOrder(scannedValue);
        }
    };

    // Handle manual lookup
    const handleManualLookup = () => {
        lookupOrder(scanInput);
    };

    // Handle Enter key for USB barcode scanners
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleManualLookup();
        }
    };

    const resetScan = () => {
        setScanInput("");
        setOrder(null);
        setError(null);
        setItemIndex(null);
        setCameraError(null);
        if (scanMode === "manual") {
            inputRef.current?.focus();
        }
    };

    // Find the specific item if itemIndex is provided
    const getItemFromOrder = () => {
        if (!order || itemIndex === null) return null;

        let currentIndex = 0;
        for (const item of order.items) {
            for (let i = 0; i < item.quantity; i++) {
                currentIndex++;
                if (currentIndex === itemIndex) {
                    return { item, position: currentIndex, total: order.items.reduce((acc, i) => acc + i.quantity, 0) };
                }
            }
        }
        return null;
    };

    const itemInfo = getItemFromOrder();

    const seg = (active: boolean): CSSProperties => ({
        flex: 1, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        font: "inherit", fontSize: 13.5, fontWeight: 600, borderRadius: 9, padding: "10px 0",
        color: active ? "#fff" : "var(--c-text-2)",
        background: active ? "var(--c-primary)" : "var(--c-surface)",
        border: `1px solid ${active ? "var(--c-primary)" : "var(--c-border-strong)"}`,
    });

    const statusToken = order ? (STATUS_COLOR[order.status] ?? "c-text-3") : "c-text-3";

    return (
        <div style={{ color: "var(--c-text)", fontSize: 14, lineHeight: 1.45, padding: "20px 22px 40px", maxWidth: 520, margin: "0 auto" }}>
            <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.01em" }}>
                    {t('plant.scan.title', 'Scan & Identify')}
                </div>
                <div style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 3 }}>
                    {t('plant.scan.subtitle', 'Scan a tag QR code to identify the order or item')}
                </div>
            </div>

            {/* Mode Toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button style={seg(scanMode === "camera")} onClick={() => setScanMode("camera")}>
                    <Camera size={16} /> Camera
                </button>
                <button style={seg(scanMode === "manual")} onClick={() => setScanMode("manual")}>
                    <Keyboard size={16} /> Manual / USB
                </button>
            </div>

            {/* Scanner Section */}
            {!order && (
                <div style={{ ...card, padding: 16 }}>
                    {scanMode === "camera" ? (
                        /* Camera Scanner */
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                            <div style={{ width: "100%", aspectRatio: "1 / 1", background: "#000", borderRadius: 10, overflow: "hidden", position: "relative" }}>
                                {cameraError ? (
                                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", padding: 16, textAlign: "center" }}>
                                        <AlertCircle size={48} color="var(--c-error)" style={{ marginBottom: 16 }} />
                                        <p style={{ fontWeight: 600, margin: 0 }}>{cameraError}</p>
                                        <button style={{ ...btnOutline, marginTop: 16, background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.5)" }} onClick={() => setCameraError(null)}>
                                            Retry
                                        </button>
                                    </div>
                                ) : (
                                    <Scanner
                                        onScan={handleCameraScan}
                                        onError={(error) => {
                                            console.error("Camera error:", error);
                                            // Check for specific error types
                                            const msg = error instanceof Error ? error.message : String(error);
                                            if (msg.includes("NotFoundError") || msg.includes("device not found")) {
                                                setCameraError("No camera found on this device.");
                                            } else if (msg.includes("NotAllowedError") || msg.includes("permission")) {
                                                setCameraError("Camera permission denied.");
                                            } else {
                                                setCameraError("Camera error: " + msg);
                                            }
                                        }}
                                        constraints={{
                                            facingMode: "environment" // Use back camera on mobile
                                        }}
                                        styles={{
                                            container: { width: "100%", height: "100%" },
                                            video: { width: "100%", height: "100%", objectFit: "cover" }
                                        }}
                                    />
                                )}
                                {cameraError && (
                                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.8)", color: "#fff", padding: 16, textAlign: "center", zIndex: 10 }}>
                                        <AlertCircle size={48} color="var(--c-error)" style={{ marginBottom: 16 }} />
                                        <p style={{ fontWeight: 600, marginBottom: 8 }}>{cameraError}</p>
                                        <p style={{ fontSize: 13, color: "rgba(255,255,255,.7)", marginBottom: 16 }}>Please use Manual Mode to enter the ID.</p>
                                        <div style={{ display: "flex", gap: 8 }}>
                                            <button style={{ ...btnOutline, background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.5)", padding: "8px 14px", fontSize: 13 }} onClick={() => setCameraError(null)}>
                                                Retry
                                            </button>
                                            <button style={{ ...btnPrimary, padding: "8px 14px", fontSize: 13 }} onClick={() => setScanMode("manual")}>
                                                Switch to Manual
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {loading && (
                                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.5)" }}>
                                        <Loader2 size={32} color="#fff" className="animate-spin" />
                                    </div>
                                )}
                            </div>
                            <p style={{ fontSize: 13, color: "var(--c-text-3)", textAlign: "center", margin: 0 }}>
                                Point your camera at a QR code on the tag
                            </p>
                        </div>
                    ) : (
                        /* Manual Input */
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                            <ChipIcon soft="c-primary-soft" refColor="c-primary">
                                <ScanLine size={16} />
                            </ChipIcon>

                            <div style={{ width: "100%" }}>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--c-text-3)", marginBottom: 8, textAlign: "center" }}>
                                    {t('plant.scan.inputLabel', 'Scan QR or enter Order ID')}
                                </label>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={scanInput}
                                        onChange={(e) => setScanInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Paste or scan Order ID..."
                                        style={{ flex: 1, fontFamily: MONO, fontSize: 15, textAlign: "center", color: "var(--c-text)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 9, padding: "11px 13px", outline: "none" }}
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleManualLookup}
                                        disabled={loading || !scanInput.trim()}
                                        style={{ ...btnPrimary, padding: "0 20px", opacity: (loading || !scanInput.trim()) ? 0.6 : 1 }}
                                    >
                                        {loading ? <Loader2 size={16} className="animate-spin" /> : t('plant.scan.lookup', 'Lookup')}
                                    </button>
                                </div>
                            </div>

                            <p style={{ fontSize: 11.5, color: "var(--c-text-3)", textAlign: "center", margin: 0 }}>
                                {t('plant.scan.hint', 'USB barcode scanners work automatically. Just scan!')}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Error State */}
            {error && (
                <div style={{ ...card, marginTop: 14, padding: "12px 16px", borderColor: "var(--c-error)", background: "var(--c-error-soft)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--c-error)" }}>
                        <AlertCircle size={18} style={{ flex: "none" }} />
                        <span style={{ fontWeight: 600 }}>{error}</span>
                    </div>
                </div>
            )}

            {/* Order Result */}
            {order && (
                <div style={{ ...card, marginTop: 14, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{t('plant.scan.result', 'Found Order')}</h3>
                        <button style={btnGhost} onClick={resetScan}>
                            <RefreshCw size={16} />
                            {t('plant.scan.scanAnother', 'Scan Another')}
                        </button>
                    </div>

                    {/* Order Header */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 14, background: "var(--c-surface-2)", borderRadius: 10 }}>
                        <ChipIcon soft="c-primary-soft" refColor="c-primary">
                            <Package size={16} />
                        </ChipIcon>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 16 }}>{order.orderNumber}</span>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: `var(--${statusToken}-soft)`, color: `var(--${statusToken})` }}>
                                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: `var(--${statusToken})` }} />
                                    {String(order.status).replace(/_/g, " ").toUpperCase()}
                                </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--c-text-2)", marginTop: 5 }}>
                                <User size={14} />
                                <span>{order.customerName}</span>
                            </div>
                            <p style={{ fontSize: 12.5, color: "var(--c-text-3)", marginTop: 4, marginBottom: 0 }}>
                                Created: {order.createdAt?.toDate ? format(order.createdAt.toDate(), "dd MMM, hh:mm a") : "N/A"}
                            </p>
                        </div>
                    </div>

                    {/* Item Info (if scanned an item tag) */}
                    {itemInfo && (
                        <div style={{ padding: 14, border: "1px solid var(--c-primary)", background: "var(--c-primary-soft)", borderRadius: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div>
                                    <p style={{ fontSize: 12, color: "var(--c-text-3)", margin: 0 }}>{t('plant.scan.specificItem', 'Specific Item')}</p>
                                    <p style={{ fontWeight: 700, fontSize: 16, margin: "2px 0 0" }}>{itemInfo.item.serviceName}</p>
                                    {itemInfo.item.categoryName && (
                                        <p style={{ fontSize: 12.5, color: "var(--c-text-3)", margin: "2px 0 0" }}>{itemInfo.item.categoryName}</p>
                                    )}
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <p style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, color: "var(--c-primary)", margin: 0 }}>
                                        {itemInfo.position}/{itemInfo.total}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* All Items */}
                    <div>
                        <p style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--c-text-3)", marginBottom: 8 }}>
                            {t('plant.scan.allItems', 'All Items')} ({order.items.length})
                        </p>
                        <div>
                            {order.items.map((item, idx) => (
                                <div key={item.id || idx} style={{ padding: "9px 0", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: idx === 0 ? "none" : "1px solid var(--c-border)" }}>
                                    <div>
                                        <p style={{ fontWeight: 600, margin: 0 }}>{item.serviceName}</p>
                                        <p style={{ fontSize: 12.5, color: "var(--c-text-3)", margin: "2px 0 0" }}>
                                            {item.categoryName} • {item.quantity} {item.unit}
                                        </p>
                                    </div>
                                    {item.express && (
                                        <span style={{ display: "inline-flex", alignItems: "center", fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: "var(--c-warning-soft)", color: "var(--c-warning)" }}>
                                            Express
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* View Full Details */}
                    <button
                        style={{ ...btnPrimary, width: "100%" }}
                        onClick={() => navigate(`/plant/orders/${order.id}`)}
                    >
                        {t('plant.scan.viewDetails', 'View Full Order Details')}
                    </button>
                </div>
            )}
        </div>
    );
}

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const card: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, boxShadow: "var(--sh-sm)" };
const btnPrimary: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 9, padding: "10px 16px", boxShadow: "var(--sh-sm)" };
const btnOutline: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-surface)", border: "1px solid var(--c-primary)", borderRadius: 9, padding: "10px 16px" };
const btnGhost: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", background: "transparent", border: 0, padding: "8px 10px" };
function ChipIcon({ children, soft, refColor }: { children: ReactNode; soft: string; refColor: string }) { return <span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: `var(--${soft})`, color: `var(--${refColor})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</span>; }
