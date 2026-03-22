/**
 * Complete Pickup Sheet - Driver App
 *
 * Items collected, optional proof photo (R2), notes.
 */

import { useState, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useCompletePickup, type DriverTask } from "../hooks/use-driver-tasks";
import { useDriverAuth } from "../DriverAuthContext";
import {
    LBottomSheet,
    LButton,
    LTextArea,
    LNumberInput,
    LSmartImageUploader,
    type LSmartImageUploaderRef,
} from "@/components/laundry";
import { CheckCircle2, Package } from "lucide-react";
import type { ImageMetadata } from "@/types/image-upload";

interface CompletePickupSheetProps {
    open: boolean;
    onClose: () => void;
    task: DriverTask;
    onComplete: () => void;
}

export function CompletePickupSheet({
    open,
    onClose,
    task,
    onComplete,
}: CompletePickupSheetProps) {
    const { t } = useTranslation();
    const { shopId } = useDriverAuth();
    const { completePickup, loading } = useCompletePickup();

    const [itemsCollected, setItemsCollected] = useState(task.itemCount);
    const [notes, setNotes] = useState("");
    const [pickupPhotos, setPickupPhotos] = useState<ImageMetadata[]>([]);
    const photoUploaderRef = useRef<LSmartImageUploaderRef>(null);

    const photoUrl = useMemo(() => pickupPhotos[0]?.url ?? null, [pickupPhotos]);

    const handleSubmit = async () => {
        try {
            const finalMeta = await photoUploaderRef.current?.uploadPendingImages?.();
            const url = finalMeta?.[0]?.url ?? photoUrl ?? undefined;
            await completePickup(task.orderId, {
                itemsCollected,
                notes: notes || undefined,
                photoUrl: url || undefined,
            });
            onComplete();
        } catch (error) {
            console.error("Failed to complete pickup:", error);
        }
    };

    return (
        <LBottomSheet
            open={open}
            onClose={onClose}
            title={t("agent.completePickup", "Complete Pickup")}
        >
            <div className="p-4 space-y-6">
                {/* Items Collected */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
                        <Package className="h-4 w-4" />
                        {t("agent.itemsCollected", "Items Collected")}
                    </label>
                    <LNumberInput
                        value={itemsCollected}
                        onChange={setItemsCollected}
                        min={0}
                        max={999}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                        {t("agent.expectedItems", "Expected")}: {task.itemCount} {t("agent.items", "items")}
                    </p>
                </div>

                {/* Proof Photo (R2 upload) */}
                {shopId && (
                    <div>
                        <LSmartImageUploader
                            ref={photoUploaderRef}
                            folder="pickup-photos"
                            shopId={shopId}
                            value={pickupPhotos}
                            onChange={setPickupPhotos}
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
                    placeholder={t("agent.notesPlaceholder", "Any issues or special notes...")}
                    rows={2}
                />

                {/* Submit Button */}
                <LButton
                    variant="primary"
                    size="lg"
                    leftIcon={<CheckCircle2 className="h-5 w-5" />}
                    onClick={handleSubmit}
                    loading={loading}
                    disabled={itemsCollected < 1}
                    fullWidth
                >
                    {t("agent.confirmPickup", "Confirm Pickup")}
                </LButton>
            </div>
        </LBottomSheet>
    );
}
