/**
 * Payroll Edit Sheet — design-system tokens.
 * Adjust bonus / deductions / advances, or override the final net salary.
 */

import { useState, useEffect, type CSSProperties } from "react";
import { LBottomSheet } from "@/components/laundry";
import { usePayrollMutations } from "@/hooks/use-staff";
import { useCurrency } from "@/hooks/use-currency";
import type { PayrollEntry } from "@/types/staff";
import { AlertCircle, Gift, TrendingDown } from "lucide-react";

const MONO = "'IBM Plex Mono'";

interface PayrollEditSheetProps {
    open: boolean;
    onClose: () => void;
    payroll: PayrollEntry;
}

export function PayrollEditSheet({ open, onClose, payroll }: PayrollEditSheetProps) {
    const { formatAmount, currencySymbol } = useCurrency();
    const [bonus, setBonus] = useState(0);
    const [deductions, setDeductions] = useState(0);
    const [advances, setAdvances] = useState(0);
    const [manualNetSalary, setManualNetSalary] = useState<number | null>(null);
    const [useManualOverride, setUseManualOverride] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const { updatePayroll } = usePayrollMutations();

    useEffect(() => {
        if (open && payroll) { setBonus(payroll.bonus || 0); setDeductions(payroll.deductions || 0); setAdvances(payroll.advances || 0); setManualNetSalary(null); setUseManualOverride(false); }
    }, [open, payroll]);

    const totalEarnings = payroll.baseSalary + payroll.overtimeAmount + bonus;
    const totalDeductions = deductions + advances;
    const calculatedNetSalary = totalEarnings - totalDeductions;

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            if (useManualOverride && manualNetSalary !== null) {
                await updatePayroll(payroll.id, { bonus, deductions, advances, totalEarnings, totalDeductions, netSalary: manualNetSalary });
            } else {
                await updatePayroll(payroll.id, { bonus, deductions, advances });
            }
            onClose();
        } catch (e) { console.error("Failed to update payroll:", e); }
        finally { setSubmitting(false); }
    };

    const lbl: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, marginBottom: 7 };
    const Money = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
        <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--c-border-strong)", borderRadius: 9, background: "var(--c-surface)" }}>
            <span style={{ fontFamily: MONO, fontSize: 13, color: "var(--c-text-3)", paddingLeft: 11 }}>{currencySymbol}</span>
            <input type="text" inputMode="decimal" value={value || ""} placeholder="0" onChange={(e) => { const n = parseFloat(e.target.value); onChange(isNaN(n) || n < 0 ? 0 : n); }} style={{ width: "100%", font: "inherit", fontFamily: MONO, fontWeight: 700, fontSize: 13.5, color: "var(--c-text)", border: 0, background: "transparent", padding: "10px 12px 10px 8px", outline: "none" }} />
        </div>
    );
    const row: CSSProperties = { display: "flex", justifyContent: "space-between", fontSize: 13 };

    return (
        <LBottomSheet open={open} onClose={onClose} title="Edit Payroll" snapPoints={[0.85]}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* current calc */}
                <div style={{ background: "var(--c-surface-2)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={row}><span style={{ color: "var(--c-text-2)" }}>Base salary</span><span style={{ fontFamily: MONO }}>{formatAmount(payroll.baseSalary)}</span></div>
                    <div style={row}><span style={{ color: "var(--c-text-2)" }}>Overtime ({payroll.overtimeHours}h)</span><span style={{ fontFamily: MONO }}>{formatAmount(payroll.overtimeAmount)}</span></div>
                </div>

                <div>
                    <label style={{ ...lbl, color: "var(--c-success)" }}><Gift size={15} />Bonus / incentive</label>
                    <Money value={bonus} onChange={setBonus} />
                </div>
                <div>
                    <label style={{ ...lbl, color: "var(--c-error)" }}><TrendingDown size={15} />Deductions</label>
                    <Money value={deductions} onChange={setDeductions} />
                </div>
                <div>
                    <label style={{ ...lbl, color: "var(--c-warning)" }}><TrendingDown size={15} />Advances taken</label>
                    <Money value={advances} onChange={setAdvances} />
                </div>

                {/* calculated */}
                <div style={{ background: "var(--c-primary-soft)", borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600 }}>Calculated net salary</span>
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 19, color: "var(--c-primary)" }}>{formatAmount(calculatedNetSalary)}</span>
                </div>

                {/* override */}
                <div style={{ border: "1px solid var(--c-border)", borderRadius: 11, padding: 13, display: "flex", flexDirection: "column", gap: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", fontSize: 13.5, fontWeight: 600 }}>
                        <input type="checkbox" checked={useManualOverride} onChange={() => { const v = !useManualOverride; setUseManualOverride(v); if (v) setManualNetSalary(calculatedNetSalary); }} style={{ accentColor: "var(--c-primary)", width: 16, height: 16 }} />
                        Override final amount
                    </label>
                    {useManualOverride && (
                        <>
                            <div style={{ fontSize: 11.5, color: "var(--c-text-3)", display: "flex", gap: 6 }}><AlertCircle size={13} style={{ flex: "none", marginTop: 1 }} />Give full salary even if staff took leave, or make other manual adjustments.</div>
                            <Money value={manualNetSalary ?? calculatedNetSalary} onChange={setManualNetSalary} />
                        </>
                    )}
                </div>

                {useManualOverride && manualNetSalary !== null && manualNetSalary !== calculatedNetSalary && (
                    <div style={{ background: "var(--c-warning-soft)", border: "1px solid var(--c-warning)", borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontWeight: 600, color: "var(--c-warning)" }}>Final amount (override)</span><span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 18, color: "var(--c-warning)" }}>{formatAmount(manualNetSalary)}</span></div>
                        <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginTop: 4 }}>Difference: {manualNetSalary > calculatedNetSalary ? "+" : ""}{formatAmount(manualNetSalary - calculatedNetSalary)}</div>
                    </div>
                )}

                <button type="button" onClick={handleSubmit} disabled={submitting} style={{ width: "100%", cursor: submitting ? "wait" : "pointer", font: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 11, padding: 14, boxShadow: "var(--sh-sm)", opacity: submitting ? 0.6 : 1 }}>{submitting ? "Saving…" : "Save Changes"}</button>
            </div>
        </LBottomSheet>
    );
}
