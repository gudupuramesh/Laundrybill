/**
 * Complete Delivery Sheet - Driver App
 *
 * Amount collected, payment method, optional proof photo (R2), notes.
 */

import { useState, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useCompleteDelivery, type DriverTask } from "../hooks/use-driver-tasks";
import { useDriverAuth } from "../DriverAuthContext";
import { useCurrencyByShopId } from "@/hooks/use-currency";
import {
    LBottomSheet,
    LButton,
    LTextArea,
    LNumberInput,
    LRadioGroup,
    LSmartImageUploader,
    type LSmartImageUploaderRef,
} from "@/components/laundry";
import { CheckCircle2, Banknote } from "lucide-react";
import type { ImageMetadata } from "@/types/image-upload";

interface CompleteDeliverySheetProps {
    open: boolean;
    onClose: () => void;
    task: DriverTask;
    onComplete: () => void;
}

export function CompleteDeliverySheet({
    open,
    onClose,
    task,
    onComplete,
}: CompleteDeliverySheetProps) {
    const { t } = useTranslation();
    const { shopId } = useDriverAuth();
    const { formatAmount, currencySymbol } = useCurrencyByShopId(shopId);
    const { completeDelivery, loading } = useCompleteDelivery();

    const photoUploaderRef = useRef<LSmartImageUploaderRef>(null);

    const [collectedAmount, setCollectedAmount] = useState(task.amountToCollect || 0);
    const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | "paid_already">(
        task.paymentStatus === "paid" ? "paid_already" : "cash"
    );
    const [notes, setNotes] = useState("");
    const [deliveryPhotos, setDeliveryPhotos] = useState<ImageMetadata[]>([]);

    const photoUrl = useMemo(() => deliveryPhotos[0]?.url ?? null, [deliveryPhotos]);

    const paymentOptions = [
        { value: "cash", label: t("agent.cash", "Cash"), description: t("agent.cashDesc", "Collected cash payment") },
        { value: "upi", label: t("agent.upi", "UPI"), description: t("agent.upiDesc", "Customer paid via UPI") },
        { value: "paid_already", label: t("agent.paidAlready", "Already Paid"), description: t("agent.paidAlreadyDesc", "Payment was made online/earlier") },
    ];

    const handleSubmit = async () => {
        try {
            const finalMeta = await photoUploaderRef.current?.uploadPendingImages?.();
            const url = finalMeta?.[0]?.url ?? photoUrl ?? undefined;
            await completeDelivery(
                task.orderId,
                {
                    collectedAmount: paymentMethod === "paid_already" ? 0 : collectedAmount,
                    paymentMethod,
                    notes: notes || undefined,
                    photoUrl: url || undefined,
                },
                task.orderTotal,
                task.previouslyPaid
            );
            onComplete();
        } catch (error) {
            console.error("Failed to complete delivery:", error);
        }
    };

    const isAmountRequired = paymentMethod !== "paid_already" && (task.amountToCollect || 0) > 0;

    return (
        <LBottomSheet
            open={open}
            onClose={onClose}
            title={t("agent.completeDelivery", "Complete Delivery")}
        >
            <div className="p-4 space-y-6">
                {/* Amount to Collect Summary */}
                {(task.amountToCollect || 0) > 0 && (
                    <div className="bg-success/5 border border-success/20 rounded-xl p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                                <Banknote className="h-5 w-5 text-success" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{t("agent.expectedAmount", "Expected Amount")}</p>
                                <p className="text-xl font-bold text-success">{formatAmount(task.amountToCollect ?? 0)}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Payment Method */}
                <div>
                    <label className="text-sm font-medium text-foreground mb-3 block">
                        {t("agent.paymentMethod", "Payment Method")}
                    </label>
                    <LRadioGroup
                        name="paymentMethod"
                        value={paymentMethod}
                        onChange={(v) => setPaymentMethod(v as "cash" | "upi" | "paid_already")}
                        options={paymentOptions}
                    />
                </div>

                {/* Amount Collected (only if not already paid) */}
                {isAmountRequired && (
                    <LNumberInput
                        label={t("agent.amountCollected", "Amount Collected")}
                        value={collectedAmount}
                        onChange={setCollectedAmount}
                        prefix={currencySymbol}
                        min={0}
                    />
                )}

                {/* Proof Photo (R2 upload) */}
                {shopId && (
                    <div>
                        <LSmartImageUploader
                            ref={photoUploaderRef}
                            folder="delivery-photos"
                            shopId={shopId}
                            value={deliveryPhotos}
                            onChange={setDeliveryPhotos}
                            maxFiles={1}
                            showStats={false}
                            deferUpload
                            label={t("agent.proofPhoto", "Proof Photo")}
                            hint={t("common.optional", "Optional")}
                        />
                    </div>
                )}

                {/* Notes */}
                <LTextArea
                    label={t("agent.notes", "Notes")}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t("agent.deliveryNotesPlaceholder", "Any issues or notes about the delivery...")}
                    rows={2}
                />

                {/* Submit Button */}
                <LButton
                    variant="primary"
                    size="lg"
                    leftIcon={<CheckCircle2 className="h-5 w-5" />}
                    onClick={handleSubmit}
                    loading={loading}
                    fullWidth
                >
                    {t("agent.confirmDelivery", "Confirm Delivery")}
                </LButton>
            </div>
        </LBottomSheet>
    );
}
