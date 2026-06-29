import { useState, useEffect, useRef, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useStaffAuth } from "../StaffAuthContext";
import { Camera, Keyboard, Loader2 } from "lucide-react";
import { Scanner } from "@yudiel/react-qr-scanner";

const card: CSSProperties = {
    background: "var(--c-surface)", border: "1px solid var(--c-border)",
    borderRadius: 12, boxShadow: "var(--sh-sm)",
};

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
            const snap = await getDoc(doc(db, "shops", shopId, "orders", orderId));
            if (snap.exists()) {
                navigate(`/staff/orders/${snap.id}`);
            } else {
                setError(t("orders.notFound", "Order not found"));
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

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
                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.01em" }}>{t("staff.scanOrder", "Scan Order")}</div>
                <div style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 3 }}>{t("staff.scanSubtitle", "Look up an order for payment or edits")}</div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button style={seg(scanMode === "camera")} onClick={() => setScanMode("camera")}><Camera size={16} /> {t("staff.camera", "Camera")}</button>
                <button style={seg(scanMode === "manual")} onClick={() => setScanMode("manual")}><Keyboard size={16} /> {t("staff.manual", "Manual")}</button>
            </div>

            <div style={{ ...card, padding: 16 }}>
                {scanMode === "camera" ? (
                    <div style={{ width: "100%", aspectRatio: "1 / 1", background: "#000", borderRadius: 10, overflow: "hidden", position: "relative" }}>
                        <Scanner
                            onScan={(r) => r?.[0]?.rawValue && lookupOrder(r[0].rawValue)}
                            styles={{ container: { width: "100%", height: "100%" } }}
                        />
                        {loading && (
                            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Loader2 size={28} color="#fff" className="animate-spin" />
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                        <input
                            ref={inputRef}
                            value={scanInput}
                            onChange={(e) => setScanInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && lookupOrder(scanInput)}
                            placeholder={t("orders.orderId", "Order ID")}
                            style={{ flex: 1, font: "inherit", fontSize: 14, color: "var(--c-text)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 9, padding: "11px 13px", outline: "none" }}
                        />
                        <button
                            onClick={() => lookupOrder(scanInput)}
                            disabled={loading}
                            style={{ cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 9, padding: "0 20px", opacity: loading ? 0.6 : 1 }}
                        >
                            {t("common.go", "Go")}
                        </button>
                    </div>
                )}
                {error && <div style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: "var(--c-error)", textAlign: "center" }}>{error}</div>}
            </div>
        </div>
    );
}
