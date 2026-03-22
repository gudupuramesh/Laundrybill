import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LCard, LButton, LSpinner } from "@/components/laundry";
import { Scanner } from "@yudiel/react-qr-scanner";

// Super Admin might scan an order from ANY shop. 
// "orders" is a subcollection of "shops". We can use collectionGroup("orders") to find ID.

export function SuperAdminScanPage() {
    const navigate = useNavigate();
    const [scanMode, setScanMode] = useState<"camera" | "manual">("camera");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scanInput, setScanInput] = useState("");

    const lookupOrder = async (val: string) => {
        setLoading(true);
        setError(null);

        try {
            const orderId = val.split(":")[0].trim();

            // Search in ALL shops
            // Note: querying by document ID in collectionGroup is tricky if not indexed specifically, 
            // but we can query where("orderNumber", "==", id) OR just iterate shops if we have limited shops.
            // Better: If QR contains shopId:orderId, it's easy. If just orderId, we need to search.
            // Assuming orderId is unique globally (if UUID) or we try to find it.
            // For now, let's assume we search `collectionGroup(db, 'orders')` filtering by `id` is not direct.
            // We'll try to find by `__name__` if possible or FieldPath.documentId().

            // Actually, best practice for admin scan is asking for Shop ID or assuming scanned tag has context. 
            // If we only have Order ID, we might need a global lookup function.
            // Let's try a collectionGroup query on 'orderNumber' (if that's what we scan) or just Doc ID.

            // WORKAROUND: For now, if we don't know Shop ID, we can't easily find a doc by ID in subcollection without exact path.
            // We will just try to navigate to a generic `/super-admin/orders/${orderId}` and let that page handle resolution/search.
            // Or implemented a Cloud Function for lookup.

            navigate(`/super-admin/orders/${orderId}`);

        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 p-6">
            <h1 className="text-2xl font-bold">Global Order Lookup</h1>

            <div className="flex gap-2 max-w-md">
                <LButton variant={scanMode === "camera" ? "primary" : "outline"} onClick={() => setScanMode("camera")} className="flex-1">Camera</LButton>
                <LButton variant={scanMode === "manual" ? "primary" : "outline"} onClick={() => setScanMode("manual")} className="flex-1">Manual</LButton>
            </div>

            <LCard className="p-4 max-w-md min-h-[300px] flex items-center justify-center">
                {scanMode === "camera" ? (
                    <div className="w-full aspect-square bg-black rounded overflow-hidden relative">
                        <Scanner onScan={r => r?.[0]?.rawValue && lookupOrder(r[0].rawValue)} />
                        {loading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><LSpinner /></div>}
                    </div>
                ) : (
                    <div className="w-full flex gap-2">
                        <input className="border p-2 flex-1 rounded" placeholder="Order ID" value={scanInput} onChange={e => setScanInput(e.target.value)} />
                        <LButton onClick={() => lookupOrder(scanInput)}>Go</LButton>
                    </div>
                )}
            </LCard>
            {error && <p className="text-red-500">{error}</p>}
        </div>
    );
}
