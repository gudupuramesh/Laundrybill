/**
 * Payment Sheet
 * 
 * Bottom sheet for adding payments to payroll
 */

import { useState, useEffect } from "react";
import {
    LButton,
    LNumberInput,
    LTextInput,
    LRadioGroup,
    LResponsiveDialog,
} from "@/components/laundry";
import type { PaymentMode } from "@/types/staff";
import { useCurrency } from "@/hooks/use-currency";
import { Banknote, CreditCard, Smartphone } from "lucide-react";

interface PaymentSheetProps {
    open: boolean;
    onClose: () => void;
    maxAmount: number;
    onSubmit: (amount: number, mode: PaymentMode, note?: string) => Promise<void>;
}

const paymentModeOptions = [
    {
        value: "cash",
        label: "Cash",
        description: "Pay by cash",
        icon: <Banknote className="h-4 w-4" />,
    },
    {
        value: "bank",
        label: "Bank Transfer",
        description: "NEFT/IMPS/RTGS",
        icon: <CreditCard className="h-4 w-4" />,
    },
    {
        value: "upi",
        label: "UPI",
        description: "GPay/PhonePe/Paytm",
        icon: <Smartphone className="h-4 w-4" />,
    },
];

export function PaymentSheet({ open, onClose, maxAmount, onSubmit }: PaymentSheetProps) {
    const { formatAmount, currencySymbol } = useCurrency();
    const effectiveMax = maxAmount > 0 ? maxAmount : 999999;
    const [amount, setAmount] = useState(() => Math.max(1, Math.min(maxAmount || 1, 999999)));
    useEffect(() => {
        if (open) setAmount(Math.max(1, maxAmount > 0 ? maxAmount : 1000));
    }, [open, maxAmount]);
    const [mode, setMode] = useState<PaymentMode>("cash");
    const [note, setNote] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (amount <= 0 || amount > effectiveMax) return;

        setSubmitting(true);
        try {
            await onSubmit(amount, mode, note || undefined);
            onClose();
        } catch (error) {
            console.error("Payment failed:", error);
            alert("Failed to record payment. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const handlePayFull = () => {
        if (effectiveMax < 999999) setAmount(effectiveMax);
    };

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title="Add Payment"
            size="sm"
            snapPoints={[0.55]}
        >
            <div className="p-4 space-y-4">
                {/* Amount Input */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-foreground">
                            Payment Amount
                        </label>
                        {effectiveMax < 999999 && (
                            <LButton
                                variant="ghost"
                                size="sm"
                                onClick={handlePayFull}
                            >
                                Pay Full ({formatAmount(effectiveMax)})
                            </LButton>
                        )}
                    </div>
                    <LNumberInput
                        value={amount}
                        onChange={setAmount}
                        min={1}
                        max={effectiveMax}
                        prefix={currencySymbol}
                    />
                    {amount > effectiveMax && (
                        <p className="text-xs text-destructive mt-1">
                            Amount cannot exceed remaining balance
                        </p>
                    )}
                </div>

                {/* Payment Mode */}
                <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                        Payment Mode
                    </label>
                    <LRadioGroup
                        name="paymentMode"
                        value={mode}
                        onChange={(val) => setMode(val as PaymentMode)}
                        options={paymentModeOptions}
                    />
                </div>

                {/* Note */}
                <LTextInput
                    label="Note (Optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g., Advance payment, Final settlement"
                />

                {/* Submit Button */}
                <LButton
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleSubmit}
                    loading={submitting}
                    disabled={amount <= 0 || amount > effectiveMax || submitting}
                >
                    Record Payment of {formatAmount(amount)}
                </LButton>
            </div>
        </LResponsiveDialog>
    );
}
