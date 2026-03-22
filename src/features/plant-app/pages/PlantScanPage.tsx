import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useDriverAuth } from "@/features/driver-app/DriverAuthContext";
import { LCard, LButton, LSpinner, LBadge, LStatusBadge } from "@/components/laundry";
import { ScanLine, AlertCircle, Package, User, RefreshCw, Camera, Keyboard } from "lucide-react";
import type { Order } from "@/types/order";
import { format } from "date-fns";
import { Scanner } from "@yudiel/react-qr-scanner";

type ScanMode = "camera" | "manual";

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

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold font-display text-gray-900 dark:text-gray-100">
                    {t('plant.scan.title', 'Scan & Identify')}
                </h1>
                <p className="text-gray-500">
                    {t('plant.scan.subtitle', 'Scan a tag QR code to identify the order or item')}
                </p>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2">
                <LButton
                    variant={scanMode === "camera" ? "primary" : "outline"}
                    onClick={() => setScanMode("camera")}
                    className="flex-1 gap-2"
                >
                    <Camera className="h-4 w-4" />
                    Camera
                </LButton>
                <LButton
                    variant={scanMode === "manual" ? "primary" : "outline"}
                    onClick={() => setScanMode("manual")}
                    className="flex-1 gap-2"
                >
                    <Keyboard className="h-4 w-4" />
                    Manual / USB
                </LButton>
            </div>

            {/* Scanner Section */}
            {!order && (
                <LCard className="p-4">
                    {scanMode === "camera" ? (
                        /* Camera Scanner */
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-full max-w-md aspect-square bg-black rounded-lg overflow-hidden relative">
                                {cameraError ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 text-center">
                                        <AlertCircle className="h-12 w-12 mb-4 text-red-400" />
                                        <p className="font-medium">{cameraError}</p>
                                        <LButton
                                            variant="outline"
                                            className="mt-4"
                                            onClick={() => setCameraError(null)}
                                        >
                                            Retry
                                        </LButton>
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
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-4 text-center z-10">
                                        <AlertCircle className="h-12 w-12 mb-4 text-red-400" />
                                        <p className="font-medium mb-2">{cameraError}</p>
                                        <p className="text-sm text-white/70 mb-4">Please use Manual Mode to enter the ID.</p>
                                        <div className="flex gap-2">
                                            <LButton
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setCameraError(null)}
                                            >
                                                Retry
                                            </LButton>
                                            <LButton
                                                variant="primary"
                                                size="sm"
                                                onClick={() => setScanMode("manual")}
                                            >
                                                Switch to Manual
                                            </LButton>
                                        </div>
                                    </div>
                                )}
                                {loading && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                        <LSpinner size="lg" />
                                    </div>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground text-center">
                                Point your camera at a QR code on the tag
                            </p>
                        </div>
                    ) : (
                        /* Manual Input */
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <ScanLine className="h-8 w-8 text-primary" />
                            </div>

                            <div className="w-full max-w-md">
                                <label className="block text-sm font-medium text-muted-foreground mb-2 text-center">
                                    {t('plant.scan.inputLabel', 'Scan QR or enter Order ID')}
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={scanInput}
                                        onChange={(e) => setScanInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Paste or scan Order ID..."
                                        className="flex-1 px-4 py-3 border border-border rounded-lg bg-background text-lg text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                                        autoFocus
                                    />
                                    <LButton onClick={handleManualLookup} disabled={loading || !scanInput.trim()}>
                                        {loading ? <LSpinner size="sm" /> : t('plant.scan.lookup', 'Lookup')}
                                    </LButton>
                                </div>
                            </div>

                            <p className="text-xs text-muted-foreground text-center">
                                {t('plant.scan.hint', 'USB barcode scanners work automatically. Just scan!')}
                            </p>
                        </div>
                    )}
                </LCard>
            )}

            {/* Error State */}
            {error && (
                <LCard className="p-4 border-destructive bg-destructive/5">
                    <div className="flex items-center gap-3 text-destructive">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <span className="font-medium">{error}</span>
                    </div>
                </LCard>
            )}

            {/* Order Result */}
            {order && (
                <LCard className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold">{t('plant.scan.result', 'Found Order')}</h3>
                        <LButton variant="ghost" size="sm" onClick={resetScan}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            {t('plant.scan.scanAnother', 'Scan Another')}
                        </LButton>
                    </div>

                    {/* Order Header */}
                    <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-lg">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Package className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-lg">{order.orderNumber}</span>
                                <LStatusBadge status={order.status} />
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <User className="h-4 w-4" />
                                <span>{order.customerName}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                Created: {order.createdAt?.toDate ? format(order.createdAt.toDate(), "dd MMM, hh:mm a") : "N/A"}
                            </p>
                        </div>
                    </div>

                    {/* Item Info (if scanned an item tag) */}
                    {itemInfo && (
                        <div className="p-4 border border-primary/30 bg-primary/5 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">{t('plant.scan.specificItem', 'Specific Item')}</p>
                                    <p className="font-bold text-lg">{itemInfo.item.serviceName}</p>
                                    {itemInfo.item.categoryName && (
                                        <p className="text-sm text-muted-foreground">{itemInfo.item.categoryName}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-black text-primary">
                                        {itemInfo.position}/{itemInfo.total}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* All Items */}
                    <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">
                            {t('plant.scan.allItems', 'All Items')} ({order.items.length})
                        </p>
                        <div className="divide-y">
                            {order.items.map((item, idx) => (
                                <div key={item.id || idx} className="py-2 flex justify-between items-center">
                                    <div>
                                        <p className="font-medium">{item.serviceName}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {item.categoryName} • {item.quantity} {item.unit}
                                        </p>
                                    </div>
                                    {item.express && <LBadge variant="warning">Express</LBadge>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* View Full Details */}
                    <LButton
                        variant="primary"
                        fullWidth
                        onClick={() => navigate(`/plant/orders/${order.id}`)}
                    >
                        {t('plant.scan.viewDetails', 'View Full Order Details')}
                    </LButton>
                </LCard>
            )}
        </div>
    );
}
