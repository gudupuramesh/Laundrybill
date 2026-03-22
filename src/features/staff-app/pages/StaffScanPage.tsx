import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useStaffAuth } from "../StaffAuthContext";
import { LCard, LButton, LSpinner } from "@/components/laundry";
import { Camera, Keyboard } from "lucide-react";
import { Scanner } from "@yudiel/react-qr-scanner";

export function StaffScanPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { shopId } = useStaffAuth();

    const [scanMode, setScanMode] = useState<"camera" | "manual">("camera");
    const [scanInput, setScanInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (scanMode === "manual") inputRef.current?.focus();
    }, [scanMode]);

    const lookupOrder = async (val: string) => {
        if (!shopId) return;
        setLoading(true);
        setError(null);

        try {
            const orderId = val.split(":")[0].trim();
            const ref = doc(db, "shops", shopId, "orders", orderId);
            const snap = await getDoc(ref);

            if (snap.exists()) {
                // Navigate directly to details for Staff
                navigate(`/staff/orders/${snap.id}`);
            } else {
                setError("Order not found");
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-md mx-auto">
            <div>
                <h1 className="text-2xl font-bold">{t('staff.scanOrder', 'Scan Order')}</h1>
                <p className="text-muted-foreground">{t('staff.scanSubtitle', 'Lookup order for payment or edits')}</p>
            </div>

            <div className="flex gap-2">
                <LButton variant={scanMode === "camera" ? "primary" : "outline"} onClick={() => setScanMode("camera")} className="flex-1"><Camera className="mr-2 h-4 w-4" /> {t('staff.camera', 'Camera')}</LButton>
                <LButton variant={scanMode === "manual" ? "primary" : "outline"} onClick={() => setScanMode("manual")} className="flex-1"><Keyboard className="mr-2 h-4 w-4" /> {t('staff.manual', 'Manual')}</LButton>
            </div>

            <LCard className="p-4 min-h-[300px] flex flex-col items-center justify-center">
                {scanMode === "camera" ? (
                    <div className="w-full aspect-square bg-black rounded-lg overflow-hidden relative">
                        <Scanner
                            onScan={r => r?.[0]?.rawValue && lookupOrder(r[0].rawValue)}
                            styles={{ container: { width: "100%", height: "100%" } }}
                        />
                        {loading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><LSpinner /></div>}
                    </div>
                ) : (
                    <div className="w-full gap-2 flex">
                        <input
                            ref={inputRef}
                            className="flex-1 border rounded px-3"
                            placeholder={t('orders.orderId', 'Order ID')}
                            value={scanInput}
                            onChange={e => setScanInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && lookupOrder(scanInput)}
                        />
                        <LButton onClick={() => lookupOrder(scanInput)} disabled={loading}>{t('common.go', 'Go')}</LButton>
                    </div>
                )}
                {error && <p className="text-destructive mt-4 font-bold">{error}</p>}
            </LCard>
        </div>
    );
}
