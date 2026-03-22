/**
 * Delivery Step Component
 * 
 * Step 3 in checkout - delivery type selection and expected dates
 */

import {
    LCard,
    LToggle,
} from "@/components/laundry";
import { Store, Truck, Home, Calendar, Clock, MapPin, AlertCircle } from "lucide-react";
import type { DeliveryType } from "@/types/order";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

interface ExpectedDateItem {
    serviceName: string;
    categoryName?: string;
    date: Date;
}

interface DeliveryStepProps {
    deliveryType: DeliveryType;
    onDeliveryTypeChange: (type: DeliveryType) => void;
    expectedDates: ExpectedDateItem[];
    finalDate: Date;
    customerAddress?: string;
    // Pickup from home specific
    pickupDate?: Date;
    pickupTimeSlot?: string;
    onPickupDateChange?: (date: Date) => void;
    onPickupTimeSlotChange?: (slot: string) => void;
    // Manual date override
    isManualDate?: boolean;
    onIsManualDateChange?: (manual: boolean) => void;
}

const DELIVERY_OPTIONS = [
    {
        value: "pickup_store" as DeliveryType,
        label: "Shop Pickup",
        description: "Customer will collect from shop",
        icon: Store,
    },
    {
        value: "delivery_home" as DeliveryType,
        label: "Home Delivery",
        description: "Deliver to customer address",
        icon: Truck,
    },
    {
        value: "pickup_home" as DeliveryType,
        label: "Pickup from Home",
        description: "Collect clothes from customer",
        icon: Home,
    },
];

const TIME_SLOTS = [
    "9:00 AM - 11:00 AM",
    "11:00 AM - 1:00 PM",
    "2:00 PM - 4:00 PM",
    "4:00 PM - 6:00 PM",
    "6:00 PM - 8:00 PM",
];

export function DeliveryStep({
    deliveryType,
    onDeliveryTypeChange,
    expectedDates,
    finalDate,
    customerAddress,
    pickupTimeSlot,
    onPickupTimeSlotChange,
    isManualDate,
    onIsManualDateChange,
}: DeliveryStepProps) {
    const { t } = useTranslation();
    // Check if address is required
    const needsAddress = deliveryType === "delivery_home" || deliveryType === "pickup_home";
    const hasAddress = !!customerAddress;

    return (
        <div className="space-y-6">
            {/* Delivery Type Selection */}
            <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">{t('checkout.deliveryType')}</h3>

                {DELIVERY_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = deliveryType === option.value;

                    return (
                        <div
                            key={option.value}
                            onClick={() => onDeliveryTypeChange(option.value)}
                            className={`
                                flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                                ${isSelected
                                    ? "border-primary bg-primary-muted"
                                    : "border-border hover:border-muted-foreground"
                                }
                            `}
                        >
                            <div className={`
                                w-5 h-5 rounded-full border-2 flex items-center justify-center
                                ${isSelected ? "border-primary" : "border-muted-foreground"}
                            `}>
                                {isSelected && (
                                    <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                                )}
                            </div>

                            <Icon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />

                            <div className="flex-1">
                                <p className={`font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>
                                    {option.label}
                                </p>
                                <p className="text-xs text-muted-foreground">{option.description}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Address Warning */}
            {needsAddress && !hasAddress && (
                <div className="p-3 bg-warning-muted rounded-lg border border-warning flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-warning">
                        {t('checkout.addressRequired')}{" "}
                        {deliveryType === "delivery_home" ? t('checkout.forDelivery') : t('checkout.forPickup')}.
                    </p>
                </div>
            )}

            {/* Address Display */}
            {needsAddress && hasAddress && (
                <div className="p-3 bg-muted rounded-lg flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-xs text-muted-foreground">{deliveryType === "delivery_home" ? t('checkout.deliveryAddress') : t('checkout.pickupAddress')}</p>
                        <p className="text-sm text-foreground">{customerAddress}</p>
                    </div>
                </div>
            )}

            {/* Pickup from Home - Time Slot Selection */}
            {deliveryType === "pickup_home" && (
                <LCard variant="outlined" padding="md">
                    <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {t('checkout.pickupSchedule')}
                    </h3>

                    <div className="grid grid-cols-2 gap-2">
                        {TIME_SLOTS.map((slot) => (
                            <button
                                key={slot}
                                onClick={() => onPickupTimeSlotChange?.(slot)}
                                className={`
                                    p-2 rounded-lg text-xs text-center transition-all
                                    ${pickupTimeSlot === slot
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted hover:bg-muted/80 text-foreground"
                                    }
                                `}
                            >
                                {slot}
                            </button>
                        ))}
                    </div>
                </LCard>
            )}

            {/* Expected Delivery Dates */}
            <LCard variant="outlined" padding="md">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {t('checkout.expectedDelivery')}
                    </h3>

                    {onIsManualDateChange && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{t('checkout.setManually')}</span>
                            <LToggle
                                checked={isManualDate || false}
                                onChange={onIsManualDateChange}
                                size="sm"
                            />
                        </div>
                    )}
                </div>

                {/* Service-wise dates (if multiple) */}
                {expectedDates.length > 1 && (
                    <div className="space-y-2 mb-4">
                        <p className="text-xs text-muted-foreground">{t('checkout.perService')}:</p>
                        {expectedDates.map((item, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                    {item.serviceName} {item.categoryName ? `(${item.categoryName})` : ""}
                                </span>
                                <span className="font-medium">{format(item.date, "EEE, d MMM")}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Final date */}
                <div className="flex items-center justify-between p-3 bg-primary-muted rounded-lg">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-primary">
                            {deliveryType === "pickup_store" ? t('checkout.readyForPickup') : t('checkout.deliveryDate')}
                        </span>
                    </div>
                    <span className="text-sm font-semibold text-primary">
                        {format(finalDate, "EEE, d MMM yyyy")}
                    </span>
                </div>

                {expectedDates.length > 1 && (
                    <p className="text-xs text-muted-foreground mt-2">
                        * {t('checkout.allItemsReadyBy')}
                    </p>
                )}
            </LCard>
        </div>
    );
}
