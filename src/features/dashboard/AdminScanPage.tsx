import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, query, where, limit, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext"; // Main Auth for Shop Admin
import { LCard, LButton, LSpinner } from "@/components/laundry";
import { Camera, Keyboard, ScanLine } from "lucide-react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useTranslation } from "react-i18next";
import { isAndroidScannerEnv } from "@/lib/android-scanner";

export function AdminScanPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { shopId } = useAuth(); // Logged in as Shop Admin

    const [scanMode, setScanMode] = useState<"camera" | "manual">("camera");
    const [scannerActive, setScannerActive] = useState(false);
    const [scanInput, setScanInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const lookupOrderRef = useRef<(val: string) => Promise<void>>(null as unknown as (val: string) => Promise<void>);

    const lookupOrder = async (val: string) => {
        if (loading) return;
        setLoading(true);
        setError(null);

        try {
            // QR Format is usually "orderId" (Basket) or "orderId:itemIndex" (Item)
            // We always want the first part as the Order ID
            const parts = val.split(":");
            let scanId = parts[0].trim();

            // 1. Try resolving as Document ID first (Direct Match)
            if (shopId) {
                const docRef = doc(db, "shops", shopId, "orders", scanId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    navigate(`/orders/${docSnap.id}`);
                    setLoading(false);
                    return;
                }

                // 2. Try resolving as Public ID (Order Number) e.g. "SHOP-001"
                // This is likely what is on the printed receipt/tag if not using internal IDs
                const q = query(
                    collection(db, "shops", shopId, "orders"),
                    where("publicId", "==", scanId),
                    limit(1)
                );
                const querySnap = await getDocs(q);

                if (!querySnap.empty) {
                    navigate(`/orders/${querySnap.docs[0].id}`);
                    setLoading(false);
                    return;
                }

                // 3. Try resolving as 'orderNumber' field (legacy/alternate name)
                const q2 = query(
                    collection(db, "shops", shopId, "orders"),
                    where("orderNumber", "==", scanId),
                    limit(1)
                );
                const querySnap2 = await getDocs(q2);
                if (!querySnap2.empty) {
                    navigate(`/orders/${querySnap2.docs[0].id}`);
                    setLoading(false);
                    return;
                }
            } else {
                // If we don't know shopId (Super Admin maybe?), we can't easily search subcollections without Collection Group Query
                // But this page is for Admin (Shop Owner), so user.shopId should be there.
                // Fallback to navigation if we can't check
                navigate(`/orders/${scanId}`);
            }

            setError(t('common.error') + ": Order not found");

        } catch (e: any) {
            console.error(e);
            setError(e.message || "Scan failed");
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

    return (
        <div className="space-y-6 max-w-md mx-auto p-4">
            <div>
                <h1 className="text-2xl font-bold">{t('scanner.title', 'Scan Order')}</h1>
                <p className="text-muted-foreground">{t('scanner.subtitle', 'Admin Order Lookup')}</p>
                {error && <p className="text-destructive text-sm mt-2">{error}</p>}
            </div>

            <div className="flex gap-2">
                <LButton variant={scanMode === "camera" ? "primary" : "outline"} onClick={() => { setScanMode("camera"); setScannerActive(false); }} className="flex-1"><Camera className="mr-2 h-4 w-4" /> {t('scanner.camera', 'Camera')}</LButton>
                <LButton variant={scanMode === "manual" ? "primary" : "outline"} onClick={() => setScanMode("manual")} className="flex-1"><Keyboard className="mr-2 h-4 w-4" /> {t('scanner.manual', 'Manual')}</LButton>
            </div>

            <LCard className="p-4 min-h-[300px] flex flex-col items-center justify-center">
                {scanMode === "camera" ? (
                    !scannerActive ? (
                        <div className="flex flex-col items-center gap-4 w-full">
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
                        <div className="w-full aspect-square bg-muted rounded-lg flex flex-col items-center justify-center gap-3 p-6">
                            <ScanLine className="h-12 w-12 text-primary" />
                            <p className="text-center text-muted-foreground text-sm">{t('scanner.useDeviceCamera', 'Use your device camera to scan the QR code')}</p>
                            <LButton variant="outline" size="sm" onClick={() => setScannerActive(false)}>{t('scanner.openScanner', 'Open scanner')}</LButton>
                            {loading && <LSpinner />}
                        </div>
                    ) : (
                        <div className="w-full aspect-square bg-black rounded-lg overflow-hidden relative">
                            <Scanner
                                onScan={r => {
                                    if (r?.[0]?.rawValue && !loading) {
                                        lookupOrder(r[0].rawValue);
                                    }
                                }}
                                scanDelay={2000}
                            />
                            {loading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><LSpinner /></div>}
                            <p className="absolute bottom-4 left-0 right-0 text-center text-white text-sm bg-black/50 py-1">
                                {t('scanner.scanHint', 'Point at QR code')}
                            </p>
                        </div>
                    )
                ) : (
                    <div className="w-full flex gap-2">
                        <input
                            className="flex-1 border rounded px-3 py-2"
                            placeholder={t('scanner.enterIdPlaceholder', 'Order ID')}
                            value={scanInput}
                            onChange={e => setScanInput(e.target.value)}
                        />
                        <LButton onClick={() => lookupOrder(scanInput)}>
                            {t('scanner.search', 'Go')}
                        </LButton>
                    </div>
                )}
            </LCard>
        </div>
    );
}
