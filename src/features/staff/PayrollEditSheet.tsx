/**
 * Payroll Edit Sheet
 * 
 * Bottom sheet for editing payroll amounts (bonus, deductions, manual override)
 */

import { useState, useEffect } from "react";
import {
    LButton,
    LNumberInput,
    LDivider,
} from "@/components/laundry";
import { LBottomSheet } from "@/components/laundry";
import { usePayrollMutations } from "@/hooks/use-staff";
import { useCurrency } from "@/hooks/use-currency";
import type { PayrollEntry } from "@/types/staff";
import { AlertCircle, Gift, TrendingDown, Edit3 } from "lucide-react";

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

    // Reset form when opened
    useEffect(() => {
        if (open && payroll) {
            setBonus(payroll.bonus || 0);
            setDeductions(payroll.deductions || 0);
            setAdvances(payroll.advances || 0);
            setManualNetSalary(null);
            setUseManualOverride(false);
        }
    }, [open, payroll]);

    // Calculate preview
    const totalEarnings = payroll.baseSalary + payroll.overtimeAmount + bonus;
    const totalDeductions = deductions + advances;
    const calculatedNetSalary = totalEarnings - totalDeductions;

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            if (useManualOverride && manualNetSalary !== null) {
                // Manual override - set custom values
                await updatePayroll(payroll.id, {
                    bonus,
                    deductions,
                    advances,
                    totalEarnings,
                    totalDeductions,
                    netSalary: manualNetSalary,
                });
            } else {
                // Normal update
                await updatePayroll(payroll.id, {
                    bonus,
                    deductions,
                    advances,
                });
            }
            onClose();
        } catch (error) {
            console.error("Failed to update payroll:", error);
            alert("Failed to update payroll. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <LBottomSheet
            open={open}
            onClose={onClose}
            title="Edit Payroll"
            snapPoints={[0.85]}
        >
            <div className="p-4 space-y-4">
                {/* Current Calculation Summary */}
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Base Salary:</span>
                        <span>{formatAmount(payroll.baseSalary)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Overtime ({payroll.overtimeHours}h):</span>
                        <span>{formatAmount(payroll.overtimeAmount)}</span>
                    </div>
                </div>

                <LDivider label="Adjustments" />

                {/* Bonus Input */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-foreground">
                        <Gift className="h-4 w-4 text-success" />
                        <span className="text-sm font-medium">Bonus / Incentive</span>
                    </div>
                    <LNumberInput
                        value={bonus}
                        onChange={setBonus}
                        prefix={currencySymbol}
                        min={0}
                        placeholder="0"
                    />
                </div>

                {/* Deductions Input */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-foreground">
                        <TrendingDown className="h-4 w-4 text-destructive" />
                        <span className="text-sm font-medium">Deductions</span>
                    </div>
                    <LNumberInput
                        value={deductions}
                        onChange={setDeductions}
                        prefix={currencySymbol}
                        min={0}
                        placeholder="0"
                    />
                </div>

                {/* Advances Input */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-foreground">
                        <TrendingDown className="h-4 w-4 text-warning" />
                        <span className="text-sm font-medium">Advances Taken</span>
                    </div>
                    <LNumberInput
                        value={advances}
                        onChange={setAdvances}
                        prefix={currencySymbol}
                        min={0}
                        placeholder="0"
                    />
                </div>

                <LDivider />

                {/* Calculated Total */}
                <div className="bg-primary-muted rounded-lg p-3">
                    <div className="flex justify-between items-center">
                        <span className="font-medium">Calculated Net Salary:</span>
                        <span className="text-xl font-bold">{formatAmount(calculatedNetSalary)}</span>
                    </div>
                </div>

                {/* Manual Override Toggle */}
                <div className="border border-border rounded-lg p-3 space-y-3">
                    <button
                        type="button"
                        onClick={() => {
                            setUseManualOverride(!useManualOverride);
                            if (!useManualOverride) {
                                setManualNetSalary(calculatedNetSalary);
                            }
                        }}
                        className="flex items-center gap-2 text-sm w-full"
                    >
                        <input
                            type="checkbox"
                            checked={useManualOverride}
                            onChange={() => { }}
                            className="rounded"
                        />
                        <Edit3 className="h-4 w-4 text-primary" />
                        <span className="font-medium">Override Final Amount</span>
                    </button>

                    {useManualOverride && (
                        <>
                            <p className="text-xs text-muted-foreground flex items-start gap-1">
                                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                                Use this to give full salary even if staff took leave, or make other manual adjustments.
                            </p>
                            <LNumberInput
                                value={manualNetSalary ?? calculatedNetSalary}
                                onChange={setManualNetSalary}
                                prefix={currencySymbol}
                                min={0}
                            />
                        </>
                    )}
                </div>

                {/* Final Amount */}
                {useManualOverride && manualNetSalary !== null && manualNetSalary !== calculatedNetSalary && (
                    <div className="bg-warning/10 border border-warning rounded-lg p-3">
                        <div className="flex justify-between items-center">
                            <span className="font-medium text-warning">Final Amount (Override):</span>
                            <span className="text-xl font-bold text-warning">{formatAmount(manualNetSalary)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Difference: {manualNetSalary > calculatedNetSalary ? "+" : ""}{formatAmount(manualNetSalary - calculatedNetSalary)}
                        </p>
                    </div>
                )}

                {/* Submit Button */}
                <LButton
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleSubmit}
                    loading={submitting}
                >
                    Save Changes
                </LButton>
            </div>
        </LBottomSheet>
    );
}
