/**
 * Payment Collection Sheet
 * 
 * Collect payment for order balance
 */

import { useState } from "react";
import {
    LResponsiveDialog,
    LRadioGroup,
    LTextInput,
    LNumberInput,
    LButton,
    LAmount,
    LDivider,
    LSpacer,
} from "@/components/laundry";
import { useOrderMutations } from "@/hooks/use-orders";
import type { Order, PaymentMethod } from "@/types/order";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";

interface PaymentCollectionSheetProps {
    open: boolean;
    onClose: () => void;
    order: Order;
}

export function PaymentCollectionSheet({ open, onClose, order }: PaymentCollectionSheetProps) {
    const { t } = useTranslation();
    const { collectPayment } = useOrderMutations();
    const [amount, setAmount] = useState(order.financials.balance);
    const [method, setMethod] = useState<PaymentMethod>("cash");
    const [reference, setReference] = useState("");
    const [loading, setLoading] = useState(false);
    const { currencySymbol } = useCurrency();

    const handleSubmit = async () => {
        if (amount <= 0) return;

        setLoading(true);
        try {
            await collectPayment(
                order.id,
                amount,
                method,
                method === "upi" || method === "card" ? reference : undefined
            );
            onClose();
        } catch (error) {
            console.error("Failed to collect payment:", error);
        } finally {
            setLoading(false);
        }
    };

    const isOverpayment = amount > order.financials.balance;

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title={t('orders.collectPayment')}
            size="sm"
            snapPoints={[0.7]}
        >
            <div className="space-y-6">
                {/* Balance Info */}
                <div className="p-5 bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 rounded-2xl shadow-sm">
                    <div className="flex justify-between text-sm mb-3">
                        <span className="text-muted-foreground font-medium">{t('orders.totalAmount')}</span>
                        <LAmount value={order.financials.total} className="font-bold" />
                    </div>
                    <div className="flex justify-between text-sm mb-3">
                        <span className="text-muted-foreground font-medium">{t('orders.alreadyPaid')}</span>
                        <LAmount value={order.financials.amountPaid} className="font-bold" />
                    </div>
                    <LDivider className="my-3 border-dashed border-primary/20" />
                    <div className="flex justify-between font-black text-lg">
                        <span className="text-primary">{t('orders.balanceDue')}</span>
                        <LAmount value={order.financials.balance} size="lg" className="text-primary" />
                    </div>
                </div>

                {/* Amount Input */}
                <LNumberInput
                    label={t('orders.amountToCollect')}
                    value={amount}
                    onChange={setAmount}
                    prefix={currencySymbol}
                    formatAsCurrency
                    min={0}
                    max={order.financials.balance * 2}
                />

                {isOverpayment && (
                    <div className="p-3 bg-warning-muted rounded-xl">
                        <p className="text-sm text-warning">
                            {t('orders.overpaymentWarning', { change: (amount - order.financials.balance).toLocaleString("en-IN") })}
                        </p>
                    </div>
                )}

                {/* Payment Method */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                        {t('checkout.paymentMethod')}
                    </label>
                    <LRadioGroup
                        name="method"
                        value={method}
                        onChange={(v) => setMethod(v as PaymentMethod)}
                        options={[
                            { value: "cash", label: t('checkout.cash') },
                            { value: "upi", label: t('checkout.upi') },
                            { value: "card", label: t('checkout.card') },
                        ]}
                    />

                    {/* Reference for UPI/Card */}
                    {(method === "upi" || method === "card") && (
                        <LTextInput
                            label={t('orders.referenceNumber')}
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            placeholder={method === "upi" ? t('orders.upiTransactionId') : t('orders.cardLastDigits')}
                        />
                    )}

                    <LSpacer size="md" />

                    {/* Submit */}
                    <LButton
                        variant="primary"
                        size="lg"
                        fullWidth
                        className="rounded-xl font-bold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 mt-2"
                        onClick={handleSubmit}
                        loading={loading}
                        disabled={amount <= 0}
                    >
                        {t('orders.collectAmount', { amount: amount.toLocaleString("en-IN") })}
                    </LButton>
                </div>
            </div>
        </LResponsiveDialog>
    );
}
