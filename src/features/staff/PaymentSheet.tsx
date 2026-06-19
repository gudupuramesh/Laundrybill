/**
 * Payment Sheet — design-system tokens.
 * Record a payment against a payroll entry: amount (+ pay full) · mode · note.
 */

import { useState, useEffect, type CSSProperties } from "react";
import { LResponsiveDialog } from "@/components/laundry";
import type { PaymentMode } from "@/types/staff";
import { useCurrency } from "@/hooks/use-currency";
import { Banknote, CreditCard, Smartphone } from "lucide-react";

const MONO = "'IBM Plex Mono'";
const lbl: CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6 };
const fld: CSSProperties = { width: "100%", font: "inherit", fontSize: 13.5, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 9, padding: "10px 12px", outline: "none" };

const MODES: { value: PaymentMode; label: string; desc: string; icon: React.ReactNode }[] = [
    { value: "cash", label: "Cash", desc: "Pay by cash", icon: <Banknote size={16} /> },
    { value: "bank", label: "Bank Transfer", desc: "NEFT / IMPS / RTGS", icon: <CreditCard size={16} /> },
    { value: "upi", label: "UPI", desc: "GPay / PhonePe / Paytm", icon: <Smartphone size={16} /> },
];

interface PaymentSheetProps {
    open: boolean;
    onClose: () => void;
    maxAmount: number;
    onSubmit: (amount: number, mode: PaymentMode, note?: string) => Promise<void>;
}

export function PaymentSheet({ open, onClose, maxAmount, onSubmit }: PaymentSheetProps) {
    const { formatAmount, currencySymbol } = useCurrency();
    const effectiveMax = maxAmount > 0 ? maxAmount : 999999;
    const [amount, setAmount] = useState(() => Math.max(1, Math.min(maxAmount || 1, 999999)));
    const [mode, setMode] = useState<PaymentMode>("cash");
    const [note, setNote] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { if (open) { setAmount(Math.max(1, maxAmount > 0 ? maxAmount : 1000)); setMode("cash"); setNote(""); } }, [open, maxAmount]);

    const tooHigh = amount > effectiveMax;
    const handleSubmit = async () => {
        if (amount <= 0 || tooHigh) return;
        setSubmitting(true);
        try { await onSubmit(amount, mode, note || undefined); onClose(); }
        catch (e) { console.error("Payment failed:", e); }
        finally { setSubmitting(false); }
    };

    return (
        <LResponsiveDialog open={open} onClose={onClose} title="Add Payment" size="sm" snapPoints={[0.6]}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* amount */}
                <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <label style={{ ...lbl, marginBottom: 0 }}>Payment amount</label>
                        {effectiveMax < 999999 && <button type="button" onClick={() => setAmount(effectiveMax)} style={{ cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 600, color: "var(--c-primary)", background: "transparent", border: 0 }}>Pay full ({formatAmount(effectiveMax)})</button>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", border: `1px solid ${tooHigh ? "var(--c-error)" : "var(--c-border-strong)"}`, borderRadius: 9, background: "var(--c-surface)" }}>
                        <span style={{ fontFamily: MONO, fontSize: 13, color: "var(--c-text-3)", paddingLeft: 11 }}>{currencySymbol}</span>
                        <input type="text" inputMode="decimal" value={amount || ""} onChange={(e) => { const n = parseFloat(e.target.value); setAmount(isNaN(n) || n < 0 ? 0 : n); }} style={{ ...fld, border: 0, fontFamily: MONO, fontWeight: 700, fontSize: 16, paddingLeft: 8, background: "transparent" }} />
                    </div>
                    {tooHigh && <div style={{ fontSize: 11.5, color: "var(--c-error)", marginTop: 5 }}>Amount cannot exceed the remaining balance.</div>}
                </div>

                {/* mode */}
                <div>
                    <label style={lbl}>Payment mode</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {MODES.map((m) => {
                            const on = mode === m.value;
                            return (
                                <button key={m.value} type="button" onClick={() => setMode(m.value)} style={{ cursor: "pointer", font: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", borderRadius: 10, border: `1.5px solid ${on ? "var(--c-primary)" : "var(--c-border)"}`, background: on ? "var(--c-primary-soft)" : "var(--c-surface)" }}>
                                    <span style={{ width: 34, height: 34, flex: "none", borderRadius: 9, background: on ? "var(--c-primary)" : "var(--c-surface-2)", color: on ? "#fff" : "var(--c-text-3)", display: "flex", alignItems: "center", justifyContent: "center" }}>{m.icon}</span>
                                    <span><span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: on ? "var(--c-primary)" : "var(--c-text)" }}>{m.label}</span><span style={{ display: "block", fontSize: 11.5, color: "var(--c-text-3)", marginTop: 1 }}>{m.desc}</span></span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* note */}
                <div>
                    <label style={lbl}>Note <span style={{ color: "var(--c-text-3)", fontWeight: 400 }}>· optional</span></label>
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Advance payment, final settlement" style={fld} />
                </div>

                <button type="button" onClick={handleSubmit} disabled={amount <= 0 || tooHigh || submitting} style={{ width: "100%", cursor: (amount <= 0 || tooHigh || submitting) ? "not-allowed" : "pointer", font: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 11, padding: 14, boxShadow: "var(--sh-sm)", opacity: (amount <= 0 || tooHigh || submitting) ? 0.55 : 1 }}>
                    {submitting ? "Recording…" : `Record payment of ${formatAmount(amount || 0)}`}
                </button>
            </div>
        </LResponsiveDialog>
    );
}
