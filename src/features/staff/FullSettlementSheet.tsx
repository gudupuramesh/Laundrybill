/**
 * Full Settlement Sheet
 *
 * Explicitly close payroll and enable payslip download.
 * Allows final amount override (e.g. pay full salary despite absences).
 */

import { useState, useEffect } from "react";
import {
    LButton,
    LNumberInput,
    LRadioGroup,
    LResponsiveDialog,
} from "@/components/laundry";
import { usePayrollMutations } from "@/hooks/use-staff";
import { useCurrency } from "@/hooks/use-currency";
import type { PayrollEntry, PaymentMode } from "@/types/staff";
import { Banknote, CreditCard, Smartphone, AlertCircle, Edit3 } from "lucide-react";

const paymentModeOptions = [
    { value: "cash", label: "Cash", description: "Pay by cash", icon: <Banknote className="h-4 w-4" /> },
    { value: "bank", label: "Bank Transfer", description: "NEFT/IMPS/RTGS", icon: <CreditCard className="h-4 w-4" /> },
    { value: "upi", label: "UPI", description: "GPay/PhonePe/Paytm", icon: <Smartphone className="h-4 w-4" /> },
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

    useEffect(() => {
        if (open && payroll) {
            setOverrideAmount(payroll.netSalary);
            setUseOverride(false);
        }
    }, [open, payroll]);

    const totalPaid = payroll.totalPaid || 0;
    const netSalary = useOverride ? overrideAmount : payroll.netSalary;
    const remainingToPay = netSalary - totalPaid;

    const handleSettle = async () => {
        setSubmitting(true);
        try {
            await performFullSettlement(payroll.id, {
                mode,
                note: "Full settlement",
                finalAmountOverride: useOverride ? overrideAmount : undefined,
            });
            onSuccess?.();
            onClose();
        } catch (error) {
            console.error("Full settlement failed:", error);
            alert("Failed to complete settlement. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title="Full Settlement"
            size="sm"
            snapPoints={[0.6]}
        >
            <div className="p-4 space-y-4">
                {/* Summary */}
                <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount to pay:</span>
                        <span className="font-medium">{formatAmount(netSalary)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Already paid:</span>
                        <span className="font-medium text-success">{formatAmount(totalPaid)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-border">
                        <span className="text-muted-foreground">
                            {remainingToPay >= 0 ? "Remaining to pay:" : "Advance given:"}
                        </span>
                        <span
                            className={`font-semibold ${
                                remainingToPay >= 0 ? "text-warning" : "text-success"
                            }`}
                        >
                            {formatAmount(Math.abs(remainingToPay))}
                        </span>
                    </div>
                </div>

                {/* Override option */}
                <div className="border border-border rounded-lg p-3 space-y-3">
                    <button
                        type="button"
                        onClick={() => setUseOverride(!useOverride)}
                        className="flex items-center gap-2 text-sm w-full"
                    >
                        <input
                            type="checkbox"
                            checked={useOverride}
                            onChange={() => {}}
                            className="rounded"
                        />
                        <Edit3 className="h-4 w-4 text-primary" />
                        <span className="font-medium">Override final amount</span>
                    </button>
                    {useOverride && (
                        <>
                            <p className="text-xs text-muted-foreground flex gap-1">
                                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                                Pay full salary despite absences or make other adjustments.
                            </p>
                            <LNumberInput
                                value={overrideAmount}
                                onChange={setOverrideAmount}
                                prefix={currencySymbol}
                                min={0}
                            />
                        </>
                    )}
                </div>

                {/* Payment mode (when remaining > 0) */}
                {remainingToPay > 0 && (
                    <div>
                        <label className="text-sm font-medium text-foreground mb-2 block">
                            Payment Mode
                        </label>
                        <LRadioGroup
                            name="settlementMode"
                            value={mode}
                            onChange={(val) => setMode(val as PaymentMode)}
                            options={paymentModeOptions}
                        />
                    </div>
                )}

                <LButton
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleSettle}
                    loading={submitting}
                    disabled={useOverride && overrideAmount < 0}
                >
                    {remainingToPay > 0
                        ? `Settle & Record Payment of ${formatAmount(remainingToPay)}`
                        : "Confirm Settlement"}
                </LButton>
            </div>
        </LResponsiveDialog>
    );
}
