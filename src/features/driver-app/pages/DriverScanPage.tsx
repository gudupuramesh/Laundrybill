import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp, arrayUnion, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useDriverAuth } from "../DriverAuthContext"; // Using Driver Auth
import { LCard, LButton, LSpinner, LStatusBadge, LConfirmDialog, useLToast } from "@/components/laundry";
import { AlertCircle, Package, RefreshCw, Camera, Keyboard, Truck, CheckCircle2, ScanLine } from "lucide-react";
import type { Order, OrderStatus } from "@/types/order";
import { Scanner } from "@yudiel/react-qr-scanner";
import { isAndroidScannerEnv } from "@/lib/android-scanner";

type ScanMode = "camera" | "manual";

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

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold font-display text-gray-900 dark:text-gray-100">
                    {t('driver.scan.title', 'Scan Order')}
                </h1>
                <p className="text-gray-500">
                    {t('driver.scan.desc', 'Scan QR to pickup or deliver orders')}
                </p>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2">
                <LButton
                    variant={scanMode === "camera" ? "primary" : "outline"}
                    onClick={() => { setScanMode("camera"); setScannerActive(false); }}
                    className="flex-1 gap-2"
                >
                    <Camera className="h-4 w-4" /> Camera
                </LButton>
                <LButton
                    variant={scanMode === "manual" ? "primary" : "outline"}
                    onClick={() => setScanMode("manual")}
                    className="flex-1 gap-2"
                >
                    <Keyboard className="h-4 w-4" /> Manual
                </LButton>
            </div>

            {/* Scanner Area */}
            {!order && (
                <LCard className="p-4">
                    {scanMode === "camera" ? (
                        !scannerActive ? (
                            <div className="flex flex-col items-center gap-4 py-6">
                                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                    <ScanLine className="h-8 w-8 text-primary" />
                                </div>
                                <p className="text-muted-foreground text-center text-sm">{t('scanner.openScannerHint', 'Tap to open the camera and scan a QR code')}</p>
                                <LButton variant="primary" size="lg" onClick={handleOpenScanner} className="gap-2">
                                    <Camera className="h-5 w-5" />
                                    {t('scanner.openScanner', 'Open scanner')}
                                </LButton>
                            </div>
                        ) : isAndroidScannerEnv() ? (
                            <div className="flex flex-col items-center gap-4 py-8">
                                <ScanLine className="h-12 w-12 text-primary" />
                                <p className="text-center text-muted-foreground text-sm">{t('scanner.useDeviceCamera', 'Use your device camera to scan the QR code')}</p>
                                <LButton variant="outline" size="sm" onClick={() => setScannerActive(false)}>{t('scanner.openScanner', 'Open scanner')}</LButton>
                                {loading && <LSpinner />}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-full max-w-md aspect-square bg-black rounded-lg overflow-hidden relative">
                                    {cameraError ? (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 text-center">
                                            <AlertCircle className="h-12 w-12 mb-4 text-red-400" />
                                            <p>{cameraError}</p>
                                            <LButton variant="outline" className="mt-4" onClick={() => setCameraError(null)}>Retry</LButton>
                                        </div>
                                    ) : (
                                        <Scanner
                                            onScan={res => res?.[0]?.rawValue && lookupOrder(res[0].rawValue)}
                                            onError={() => setCameraError("Camera issue. Try manual mode.")}
                                            constraints={{ facingMode: "environment" }}
                                            styles={{ container: { width: "100%", height: "100%" } }}
                                        />
                                    )}
                                    {loading && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><LSpinner size="lg" /></div>}
                                </div>
                            </div>
                        )
                    ) : (
                        <div className="flex gap-2">
                            <input
                                ref={inputRef}
                                value={scanInput}
                                onChange={e => setScanInput(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && lookupOrder(scanInput)}
                                placeholder="Scan/Type Order ID"
                                className="flex-1 px-4 py-3 border rounded-lg"
                                autoFocus
                            />
                            <LButton onClick={() => lookupOrder(scanInput)} disabled={loading || !scanInput}>Lookup</LButton>
                        </div>
                    )}
                </LCard>
            )}

            {/* Order Result */}
            {order && (
                <LCard className="p-4 space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold">Order Found</h3>
                        <LButton variant="ghost" size="sm" onClick={() => setOrder(null)}><RefreshCw className="h-4 w-4 mr-2" /> Scan Again</LButton>
                    </div>

                    <div className="p-4 bg-muted/30 rounded-lg flex gap-4">
                        <Package className="h-10 w-10 text-primary" />
                        <div>
                            <div className="font-bold text-lg">{order.orderNumber}</div>
                            <div className="text-sm text-muted-foreground">{order.customerName}</div>
                            <LStatusBadge status={order.status} className="mt-2" />
                        </div>
                    </div>

                    {/* Action Button */}
                    {action ? (
                        <LButton
                            variant={action.variant}
                            fullWidth
                            size="lg"
                            onClick={() => setConfirmAction({ open: true, type: action.type })}
                            className="h-14 text-lg"
                        >
                            <action.icon className="h-5 w-5 mr-2" />
                            {action.label}
                        </LButton>
                    ) : (
                        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg text-center text-sm">
                            No actions available for this order status ({order.status}).
                        </div>
                    )}

                    <LButton variant="outline" fullWidth onClick={() => navigate(`/driver/orders/${order.id}`)}>
                        View Full Details
                    </LButton>
                </LCard>
            )}

            {/* Error */}
            {error && (
                <LCard className="p-4 border-destructive bg-destructive/5 text-destructive flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" /> {error}
                </LCard>
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
