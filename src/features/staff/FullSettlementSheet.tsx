/**
 * Full Settlement Sheet — design-system tokens.
 * Close a payroll entry (enables payslip) with optional final-amount override.
 */

import { useState, useEffect, type CSSProperties } from "react";
import { LResponsiveDialog } from "@/components/laundry";
import { usePayrollMutations } from "@/hooks/use-staff";
import { useCurrency } from "@/hooks/use-currency";
import type { PayrollEntry, PaymentMode } from "@/types/staff";
import { Banknote, CreditCard, Smartphone, AlertCircle } from "lucide-react";

const MONO = "'IBM Plex Mono'";

const MODES: { value: PaymentMode; label: string; icon: React.ReactNode }[] = [
    { value: "cash", label: "Cash", icon: <Banknote size={16} /> },
    { value: "bank", label: "Bank Transfer", icon: <CreditCard size={16} /> },
    { value: "upi", label: "UPI", icon: <Smartphone size={16} /> },
];

interface FullSettlementSheetProps {
    open: boolean;
    onClose: () => void;
    payroll: PayrollEntry;
    onSuccess?: () => void;
}

export function FullSettlementSheet({ open, onClose, payroll, onSuccess }: FullSettlementSheetProps) {
    const { formatAmount, currencySymbol } = useCurrency();
    const [mode, setMode] = useState<PaymentMode>("cash");
    const [useOverride, setUseOverride] = useState(false);
    const [overrideAmount, setOverrideAmount] = useState<number>(payroll.netSalary);
    const [submitting, setSubmitting] = useState(false);
    const { performFullSettlement } = usePayrollMutations();

    useEffect(() => { if (open && payroll) { setOverrideAmount(payroll.netSalary); setUseOverride(false); setMode("cash"); } }, [open, payroll]);

    const totalPaid = payroll.totalPaid || 0;
    const netSalary = useOverride ? overrideAmount : payroll.netSalary;
    const remainingToPay = netSalary - totalPaid;

    const handleSettle = async () => {
        setSubmitting(true);
        try {
            await performFullSettlement(payroll.id, { mode, note: "Full settlement", finalAmountOverride: useOverride ? overrideAmount : undefined });
            onSuccess?.(); onClose();
        } catch (e) { console.error("Full settlement failed:", e); }
        finally { setSubmitting(false); }
    };

    const row: CSSProperties = { display: "flex", justifyContent: "space-between", fontSize: 13 };

    return (
        <LResponsiveDialog open={open} onClose={onClose} title="Full Settlement" size="sm" snapPoints={[0.6]}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* summary */}
                <div style={{ background: "var(--c-surface-2)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={row}><span style={{ color: "var(--c-text-2)" }}>Amount to pay</span><span style={{ fontFamily: MONO, fontWeight: 600 }}>{formatAmount(netSalary)}</span></div>
                    <div style={row}><span style={{ color: "var(--c-text-2)" }}>Already paid</span><span style={{ fontFamily: MONO, fontWeight: 600, color: "var(--c-success)" }}>{formatAmount(totalPaid)}</span></div>
                    <div style={{ ...row, paddingTop: 8, borderTop: "1px solid var(--c-border)" }}><span style={{ color: "var(--c-text-2)" }}>{remainingToPay >= 0 ? "Remaining to pay" : "Advance given"}</span><span style={{ fontFamily: MONO, fontWeight: 700, color: remainingToPay >= 0 ? "var(--c-warning)" : "var(--c-success)" }}>{formatAmount(Math.abs(remainingToPay))}</span></div>
                </div>

                {/* override */}
                <div style={{ border: "1px solid var(--c-border)", borderRadius: 11, padding: 13, display: "flex", flexDirection: "column", gap: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", fontSize: 13.5, fontWeight: 600 }}>
                        <input type="checkbox" checked={useOverride} onChange={() => setUseOverride(!useOverride)} style={{ accentColor: "var(--c-primary)", width: 16, height: 16 }} />
                        Override final amount
                    </label>
                    {useOverride && (
                        <>
                            <div style={{ fontSize: 11.5, color: "var(--c-text-3)", display: "flex", gap: 6 }}><AlertCircle size={13} style={{ flex: "none", marginTop: 1 }} />Pay full salary despite absences or make other adjustments.</div>
                            <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--c-border-strong)", borderRadius: 9, background: "var(--c-surface)" }}>
                                <span style={{ fontFamily: MONO, fontSize: 13, color: "var(--c-text-3)", paddingLeft: 11 }}>{currencySymbol}</span>
                                <input type="text" inputMode="decimal" value={overrideAmount || ""} onChange={(e) => { const n = parseFloat(e.target.value); setOverrideAmount(isNaN(n) || n < 0 ? 0 : n); }} style={{ width: "100%", font: "inherit", fontFamily: MONO, fontWeight: 700, fontSize: 13.5, border: 0, background: "transparent", padding: "10px 12px 10px 8px", outline: "none", color: "var(--c-text)" }} />
                            </div>
                        </>
                    )}
                </div>

                {/* mode */}
                {remainingToPay > 0 && (
                    <div>
                        <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Payment mode</label>
                        <div style={{ display: "flex", gap: 8 }}>
                            {MODES.map((m) => {
                                const on = mode === m.value;
                                return (
                                    <button key={m.value} type="button" onClick={() => setMode(m.value)} style={{ flex: 1, cursor: "pointer", font: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "11px 8px", borderRadius: 10, border: `1.5px solid ${on ? "var(--c-primary)" : "var(--c-border)"}`, background: on ? "var(--c-primary-soft)" : "var(--c-surface)", color: on ? "var(--c-primary)" : "var(--c-text-2)" }}>
                                        {m.icon}<span style={{ fontSize: 12, fontWeight: 600 }}>{m.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <button type="button" onClick={handleSettle} disabled={submitting || (useOverride && overrideAmount < 0)} style={{ width: "100%", cursor: submitting ? "wait" : "pointer", font: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 11, padding: 14, boxShadow: "var(--sh-sm)", opacity: submitting ? 0.6 : 1 }}>
                    {remainingToPay > 0 ? `Settle & record ${formatAmount(remainingToPay)}` : "Confirm settlement"}
                </button>
            </div>
        </LResponsiveDialog>
    );
}
