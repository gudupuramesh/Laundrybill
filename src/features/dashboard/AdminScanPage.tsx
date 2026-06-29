import { useState, useRef, useEffect, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, query, where, limit, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext"; // Main Auth for Shop Admin
import { LSpinner } from "@/components/laundry";
import { useIsMobile } from "@/hooks/use-mobile";
import { Camera, Keyboard, ScanLine, AlertCircle, Search } from "lucide-react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useTranslation } from "react-i18next";
import { isAndroidScannerEnv } from "@/lib/android-scanner";

export function AdminScanPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
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

    const seg = (on: boolean): CSSProperties => ({ flex: 1, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, font: "inherit", fontSize: 13, fontWeight: 600, padding: "9px 12px", borderRadius: 8, border: 0, background: on ? "var(--c-surface)" : "transparent", color: on ? "var(--c-text)" : "var(--c-text-3)", boxShadow: on ? "var(--sh-sm)" : undefined });

    return (
        <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", background: "var(--c-bg)" }}>
            {/* header */}
            <header style={{ flex: "none", minHeight: 58, background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 14, padding: "0 22px" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                    <span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: "var(--c-primary-soft)", color: "var(--c-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}><ScanLine size={17} /></span>
                    <div><div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.01em", lineHeight: 1.1 }}>{t("scanner.title", "Scan Order")}</div><div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{t("scanner.subtitle", "Look up an order by QR or ID")}</div></div>
                </div>
            </header>

            <div className="lb-scroll" style={{ flex: 1, overflow: "auto", padding: "24px 22px 40px", paddingBottom: isMobile ? "calc(88px + env(safe-area-inset-bottom, 0px))" : 40, minHeight: 0 }}>
                <div style={{ maxWidth: 440, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* mode toggle */}
                    <div role="group" aria-label="Scan mode" style={{ display: "flex", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 10, padding: 3 }}>
                        <button onClick={() => { setScanMode("camera"); setScannerActive(false); }} aria-pressed={scanMode === "camera"} style={seg(scanMode === "camera")}><Camera size={15} />{t("scanner.camera", "Camera")}</button>
                        <button onClick={() => setScanMode("manual")} aria-pressed={scanMode === "manual"} style={seg(scanMode === "manual")}><Keyboard size={15} />{t("scanner.manual", "Manual")}</button>
                    </div>

                    {error && <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 500, color: "var(--c-error)", background: "var(--c-error-soft)", border: "1px solid var(--c-error-soft)", borderRadius: 10, padding: "10px 13px" }}><AlertCircle size={15} />{error}</div>}

                    {/* scan card */}
                    <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14, boxShadow: "var(--sh-sm)", padding: 18, minHeight: 320, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                        {scanMode === "camera" ? (
                            !scannerActive ? (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
                                    <span style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--c-primary-soft)", color: "var(--c-primary)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><ScanLine size={34} /></span>
                                    <div style={{ fontSize: 13.5, color: "var(--c-text-3)", maxWidth: 280 }}>{t("scanner.openScannerHint", "Tap to open the camera and scan a garment or basket QR code.")}</div>
                                    <button onClick={handleOpenScanner} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, font: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 11, padding: "12px 22px", boxShadow: "var(--sh-sm)" }}><Camera size={18} />{t("scanner.openScanner", "Open scanner")}</button>
                                </div>
                            ) : isAndroidScannerEnv() ? (
                                <div style={{ width: "100%", aspectRatio: "1/1", background: "var(--c-surface-2)", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
                                    <ScanLine size={48} style={{ color: "var(--c-primary)" }} />
                                    <div style={{ fontSize: 13, color: "var(--c-text-3)" }}>{t("scanner.useDeviceCamera", "Use your device camera to scan the QR code.")}</div>
                                    <button onClick={() => setScannerActive(false)} style={{ cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 9, padding: "8px 16px" }}>{t("common.cancel", "Cancel")}</button>
                                    {loading && <LSpinner />}
                                </div>
                            ) : (
                                <div style={{ width: "100%", aspectRatio: "1/1", background: "#000", borderRadius: 12, overflow: "hidden", position: "relative" }}>
                                    <Scanner onScan={(r) => { if (r?.[0]?.rawValue && !loading) lookupOrder(r[0].rawValue); }} scanDelay={2000} />
                                    {loading && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><LSpinner /></div>}
                                    <div style={{ position: "absolute", left: 0, right: 0, bottom: 14, textAlign: "center", color: "#fff", fontSize: 13, background: "rgba(0,0,0,.5)", padding: "4px 0" }}>{t("scanner.scanHint", "Point at the QR code")}</div>
                                </div>
                            )
                        ) : (
                            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
                                <div style={{ position: "relative" }}>
                                    <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--c-text-3)" }} />
                                    <input value={scanInput} onChange={(e) => setScanInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") lookupOrder(scanInput); }} placeholder={t("scanner.enterIdPlaceholder", "Order ID or number…")}
                                        style={{ width: "100%", font: "inherit", fontSize: 14, fontFamily: "'IBM Plex Mono'", color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 10, padding: "12px 13px 12px 38px", outline: "none" }} />
                                </div>
                                <button onClick={() => lookupOrder(scanInput)} disabled={!scanInput.trim() || loading} style={{ width: "100%", cursor: (!scanInput.trim() || loading) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 11, padding: 13, boxShadow: "var(--sh-sm)", opacity: (!scanInput.trim() || loading) ? 0.55 : 1 }}>{loading ? <LSpinner size="sm" /> : <Search size={17} />}{t("scanner.search", "Look up order")}</button>
                            </div>
                        )}
                    </div>

                    <div style={{ fontSize: 11.5, color: "var(--c-text-3)", textAlign: "center" }}>{t("scanner.footerHint", "Scans a garment/basket tag or accepts a typed order ID, then opens the order.")}</div>
                </div>
            </div>
        </div>
    );
}
