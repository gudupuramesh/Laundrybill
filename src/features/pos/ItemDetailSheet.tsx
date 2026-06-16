/**
 * Item Detail Sheet
 * 
 * Configure item before adding to cart
 */

import { useState, useEffect } from "react";
import {
    LResponsiveDialog,
    LQuantityStepper,
    LToggle,
    LTextArea,
    LButton,
    LAmount,
    LBadge,
    LDivider,
} from "@/components/laundry";
import type { InventoryItem } from "@/types/inventory";
import { Zap, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isWeightUnit, getTranslatedUnit } from "@/lib/inventory-translations";

interface ItemDetailSheetProps {
    open: boolean;
    onClose: () => void;
    item?: InventoryItem;
    onAdd: (
        item: InventoryItem,
        quantity: number,
        express: boolean,
        notes?: string
    ) => void;
    initialValues?: {
        quantity: number;
        express: boolean;
        notes?: string;
    };
}

export function ItemDetailSheet({
    open,
    onClose,
    item,
    onAdd,
    initialValues,
}: ItemDetailSheetProps) {
    const { t } = useTranslation();
    const [quantity, setQuantity] = useState(1);
    const [weightText, setWeightText] = useState("1");
    const [express, setExpress] = useState(false);
    const [notes, setNotes] = useState("");

    // Reset state when item changes
    useEffect(() => {
        if (open) {
            const q = initialValues?.quantity || 1;
            setQuantity(q);
            setWeightText(String(q));
            setExpress(initialValues?.express || false);
            setNotes(initialValues?.notes || "");
        }
    }, [open, item?.id, initialValues]);

    if (!item) return null;

    const weighed = isWeightUnit(item.pricingType);
    const unitLabel = getTranslatedUnit(item.pricingType);

    // Decimal weight entry (e.g. 2.5 kg) for weight/area units.
    const onWeightChange = (raw: string) => {
        const normalized = raw.replace(",", ".");
        if (normalized !== "" && !/^\d*\.?\d*$/.test(normalized)) return;
        setWeightText(normalized);
        const parsed = parseFloat(normalized);
        if (!Number.isNaN(parsed) && parsed >= 0) setQuantity(parsed);
    };

    const unitPrice = express ? item.basePrice * item.expressMultiplier : item.basePrice;
    const total = quantity * unitPrice;
    const turnaroundDays = express ? 1 : item.turnaroundDays;

    const handleAdd = () => {
        onAdd(item, quantity, express, notes || undefined);
    };

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title={item.name}
            size="sm"
            snapPoints={[0.7]}
        >
            <div className="space-y-6">
                {/* Price Info */}
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground">
                            {t('pos.pricePerPiece')}{weighed ? ` / ${unitLabel}` : ''}
                        </p>
                        <LAmount value={item.basePrice} size="xl" />
                    </div>
                    <LBadge variant="muted">
                        <Clock className="h-3 w-3 mr-1" />
                        {t('pos.processingTime', { days: turnaroundDays })}
                    </LBadge>
                </div>

                <LDivider />

                {/* Quantity / Weight */}
                <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">
                        {weighed ? `${t('pos.quantity')} (${unitLabel})` : t('pos.quantity')}
                    </span>
                    {weighed ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                inputMode="decimal"
                                value={weightText}
                                onChange={(e) => onWeightChange(e.target.value)}
                                placeholder="0"
                                className="h-10 w-24 rounded-lg border border-border bg-background px-3 text-right text-lg font-semibold text-foreground focus:border-primary focus:outline-none"
                            />
                            <span className="text-sm font-medium text-muted-foreground">{unitLabel}</span>
                        </div>
                    ) : (
                        <LQuantityStepper
                            value={quantity}
                            onChange={setQuantity}
                            min={1}
                            max={99}
                            size="lg"
                        />
                    )}
                </div>

                {/* Express Toggle */}
                <div className="flex items-center justify-between p-3 bg-warning-muted rounded-xl">
                    <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-warning" />
                        <div>
                            <p className="font-medium text-foreground">{t('pos.expressDelivery')}</p>
                            <p className="text-xs text-muted-foreground">
                                {t('pos.expressDeliveryDesc_dynamic', `+${Math.round((item.expressMultiplier - 1) * 100)}% • Ready in 24 hours`)}
                            </p>
                        </div>
                    </div>
                    <LToggle checked={express} onChange={setExpress} />
                </div>

                {/* Notes */}
                <LTextArea
                    label={t('pos.specialInstructions')}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('pos.specialInstructionsPlaceholder')}
                    minRows={2}
                />

                <LDivider />

                {/* Total & Add Button */}
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground">{t('pos.total')}</p>
                        <LAmount value={total} size="xl" />
                    </div>
                    <LButton
                        variant="primary"
                        size="lg"
                        onClick={handleAdd}
                    >
                        {t('pos.addToCart')}
                    </LButton>
                </div>
            </div>
        </LResponsiveDialog>
    );
}
