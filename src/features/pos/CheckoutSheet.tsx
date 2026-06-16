/**
 * Checkout Sheet
 * 
 * Multi-step checkout: Review → Delivery → Payment
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
    LResponsiveDialog,
    LOrderSummary,
    LRadioGroup,
    LTextInput,
    LTextArea,
    LButton,
    LProgressStepper,
    LDivider,
    LCard,
    LSelect,
    LSmartImageUploader,
    type LSmartImageUploaderRef,
} from "@/components/laundry";
import { useAuth } from "@/features/auth";
import { useCart } from "./useCart";
import { useCurrency } from "@/hooks/use-currency";
import type { ImageMetadata } from "@/types/image-upload";
import { useInventory } from "@/hooks/use-inventory";
import { useCreateOrder, useOrderMutations } from "@/hooks/use-orders";
import { useCustomers } from "@/hooks/use-customers";
import { useAvailableAgents } from "@/hooks/use-available-agents";
import { addDays } from "date-fns";
import { Clock, Truck, Store, Home } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getTranslatedItemName, getTranslatedCategoryName } from "@/lib/inventory-translations";
import { useStaffAuthOptional } from "@/features/staff-app/StaffAuthContext";
import { useDeliverySettings } from "@/hooks/use-delivery-settings";
import { useShopLimits } from "@/hooks/use-shop-limits";

interface CheckoutSheetProps {
    open: boolean;
    onClose: () => void;
    cart: ReturnType<typeof useCart>;
    onComplete: (orderId: string) => void;
    editOrderId?: string; // If provided, update this order instead of creating new
}

type Step = "review" | "delivery" | "payment";
type PaymentMethod = "cash" | "upi" | "card" | "pay_later";

export function CheckoutSheet({
    open,
    onClose,
    cart,
    onComplete,
    editOrderId,
}: CheckoutSheetProps) {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();
    const [step, setStep] = useState<Step>("review");

    // Get inventory to check category turnaround times
    const { allCategories } = useInventory();

    // Calculate max turnaround days from cart items
    const maxTurnaroundDays = useMemo(() => {
        if (cart.items.length === 0) return 2; // Default

        return Math.max(...cart.items.map(i => {
            // 1. Get Item turnaround (default to 2 if missing)
            const itemTurnaround = i.service.turnaroundDays || 2;

            // 2. Get Category turnaround
            const category = allCategories.find(c => c.id === i.service.categoryId);
            const categoryTurnaround = category?.turnaroundDays || 2;

            // 3. Use the greater of the two (ensures updated category times apply to existing items)
            return Math.max(itemTurnaround, categoryTurnaround);
        }));
    }, [cart.items, allCategories]);

    // Initialize expected date logic
    // We want the default to be today + maxTurnaround
    const minExpectedDate = useMemo(() => addDays(new Date(), maxTurnaroundDays), [maxTurnaroundDays]);

    const [expectedDate, setExpectedDate] = useState<Date>(minExpectedDate);
    const [scheduledPickupDate, setScheduledPickupDate] = useState<Date>(new Date()); // Default to today
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
    const [amountPaid, setAmountPaid] = useState<number>(0);
    const [upiRef, setUpiRef] = useState("");

    const { createOrder, loading } = useCreateOrder();
    const { updateOrder } = useOrderMutations();
    const { addAddress } = useCustomers();
    const [updating, setUpdating] = useState(false);
    const [saveNewAddress, setSaveNewAddress] = useState(true); // Checkbox for saving new address
    const [selectedAgentId, setSelectedAgentId] = useState<string>(""); // Selected agent for delivery
    const [selectedArea, setSelectedArea] = useState<string>(""); // Selected service area for filtering
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>(""); // Selected time slot
    const [slotError, setSlotError] = useState(false); // Validation state for slot
    const [damagePhotoMetadata, setDamagePhotoMetadata] = useState<ImageMetadata[]>([]);
    const damagePhotoUploaderRef = useRef<LSmartImageUploaderRef>(null);

    const { shopId } = useAuth();

    // Reset expected date when cart changes significantly (optional, but good practice)
    useEffect(() => {
        // If pickup/home delivery, base expectation on pickup date
        if (["pickup_home", "delivery_home"].includes(cart.deliveryType)) {
            setExpectedDate(addDays(scheduledPickupDate, maxTurnaroundDays));
        } else {
            setExpectedDate(minExpectedDate);
        }
    }, [minExpectedDate, cart.deliveryType, scheduledPickupDate, maxTurnaroundDays]);

    // Get delivery settings (service areas and time slots)
    const { settings: deliverySettings } = useDeliverySettings();

    // Check if plan allows delivery agents
    const { checkLimit, hasFeature, loading: limitsLoading } = useShopLimits();
    const canUploadDamagePhotos = hasFeature("damagePhotos");
    const agentLimitCheck = checkLimit("maxDeliveryAgents", 0);
    const agentLimit = agentLimitCheck.limit;
    // Hide agent selection if limit is 0, undefined, or null. Show only if limit > 0 OR -1 (unlimited)
    const canHaveAgents = !limitsLoading && (agentLimit === -1 || (typeof agentLimit === 'number' && agentLimit > 0));

    // Auto-select first service area when the feature is on, areas exist and none selected
    useEffect(() => {
        if (deliverySettings.enableServiceAreas && deliverySettings.serviceAreas?.length > 0 && !selectedArea) {
            const firstActive = deliverySettings.serviceAreas.find(a => a.isActive);
            if (firstActive) {
                setSelectedArea(firstActive.value);
            }
        }
    }, [deliverySettings.enableServiceAreas, deliverySettings.serviceAreas, selectedArea]);

    // Clear any selected area/agent when the area+agent UI isn't applicable
    // (store order, feature off, or a plan without agents). The sheet stays
    // mounted across cart changes, so without this a previously-picked agent
    // could be written onto a store/feature-off order.
    const areaAgentUiActive =
        (cart.deliveryType === "delivery_home" || cart.deliveryType === "pickup_home") &&
        deliverySettings.enableServiceAreas;
    useEffect(() => {
        if (!areaAgentUiActive || !canHaveAgents) {
            if (selectedAgentId) setSelectedAgentId("");
        }
        if (!areaAgentUiActive) {
            if (selectedArea) setSelectedArea("");
        }
    }, [areaAgentUiActive, canHaveAgents, selectedAgentId, selectedArea]);

    // Get available agents filtered by selected area (or customer address if no area selected)
    const filterArea = useMemo(() => {
        if (selectedArea && deliverySettings.serviceAreas?.length > 0) {
            return selectedArea;
        }
        // Fallback to parsing from address when no areas configured
        const addr = cart.deliveryAddress || '';
        const parts = addr.split(',').map(p => p.trim());
        return parts[0] || '';
    }, [selectedArea, deliverySettings.serviceAreas, cart.deliveryAddress]);

    const { agents } = useAvailableAgents({ area: filterArea });
    const selectedAgent = useMemo(() =>
        agents.find(a => a.id === selectedAgentId),
        [agents, selectedAgentId]
    );

    // Area options for dropdown
    const areaOptions = useMemo(() => [
        { value: "", label: t('checkout.selectArea', 'Select area...') },
        ...deliverySettings.serviceAreas
            .filter(area => area.isActive)
            .map(area => ({
                value: area.value,
                label: area.value,
            })),
        { value: "__NEW__", label: t('common.addNewRequest', '+ Add New Area') }
    ], [deliverySettings.serviceAreas, t]);

    const agentOptions = useMemo(() => [
        { value: "", label: t('checkout.noAgent', 'No agent assigned') },
        ...agents.map(a => ({
            value: a.id,
            label: `${a.name}${a.isOnline ? ' 🟢' : ' ⚪'}`,
        })),
        { value: "__NEW__", label: t('common.addNewRequest', '+ Add New Agent') }
    ], [agents, t]);

    const handleAreaChange = (value: string) => {
        if (value === "__NEW__") {
            // Redirect to Inventory page with Service Areas tab
            navigate("/inventory?tab=service-areas");
            return;
        }
        setSelectedArea(value);
        setSelectedAgentId(""); // Reset agent
    };

    const handleAgentChange = (value: string) => {
        if (value === "__NEW__") {
            // Redirect to Manage Staff page and trigger new staff sheet
            navigate("/manage-staff?new=true");
            return;
        }
        setSelectedAgentId(value);
    };

    // Get time slots based on delivery type
    const availableTimeSlots = useMemo(() => {
        if (cart.deliveryType === 'pickup_home') {
            if (!deliverySettings.enablePickupSlots) return [];
            return deliverySettings.pickupTimeSlots
                .filter(slot => slot.isActive)
                .map(slot => slot.value);
        }
        if (cart.deliveryType === 'delivery_home') {
            if (!deliverySettings.enableDeliverySlots) return [];
            return deliverySettings.deliveryTimeSlots
                .filter(slot => slot.isActive)
                .map(slot => slot.value);
        }
        return [];
    }, [cart.deliveryType, deliverySettings]);

    const isEditMode = !!editOrderId;

    // Detect if we're in staff context
    const location = useLocation();
    const isStaffRoute = location.pathname.startsWith('/staff');
    const staffAuth = useStaffAuthOptional();
    const staff = staffAuth?.staff;

    // Check if delivery address is new (not in customer's saved addresses)
    const isNewAddress = cart.deliveryType !== 'pickup_store' &&
        cart.deliveryAddress &&
        cart.customerId &&
        !cart.isGuest &&
        !cart.customerAddresses?.some(
            (a) => a.address.toLowerCase().trim() === cart.deliveryAddress?.toLowerCase().trim()
        );

    // Check if this is the first address for customer
    const isFirstAddress = !cart.customerAddresses || cart.customerAddresses.length === 0;

    const steps = [
        { id: "review", label: t('checkout.review') },
        { id: "delivery", label: t('checkout.delivery') },
        { id: "payment", label: t('checkout.payment') },
    ];

    const currentStepIndex = steps.findIndex((s) => s.id === step);

    const handleNext = () => {
        if (step === "review") setStep("delivery");
        else if (step === "delivery") {
            // Validate Time Slot if slots are available
            if (availableTimeSlots.length > 0 && !selectedTimeSlot) {
                setSlotError(true);
                return;
            }
            setSlotError(false);
            setStep("payment");
        }
    };

    const handleBack = () => {
        if (step === "delivery") setStep("review");
        else if (step === "payment") setStep("delivery");
    };

    const handleComplete = async () => {
        if (isEditMode && editOrderId) {
            // Update existing order
            setUpdating(true);
            try {
                await updateOrder(editOrderId, {
                    items: cart.items.map((item, index) => ({
                        id: `item-${item.service.id}-${index}`,
                        serviceId: item.service.id,
                        serviceName: item.service.name,
                        categoryId: item.service.categoryId,
                        categoryName: item.service.categoryName,
                        quantity: item.quantity,
                        unit: item.service.pricingType,
                        unitPrice: item.unitPrice,
                        total: item.total,
                        express: item.express,
                        notes: item.notes,
                        damages: item.damages,
                        expressMultiplier: item.service.expressMultiplier,
                    })),
                    financials: {
                        subtotal: cart.subtotal,
                        discountType: cart.discountType,
                        discountValue: cart.discountValue,
                        discountAmount: cart.discountAmount,
                        expressCharge: cart.expressCharge,
                        deliveryCharge: cart.deliveryCharge,
                        taxAmount: cart.taxAmount,
                        taxRate: cart.taxRate,
                        taxName: cart.taxName,
                        total: cart.total,
                        amountPaid,
                    },
                    deliveryType: cart.deliveryType,
                    deliveryAddress: cart.deliveryAddress,
                    deliveryNotes: cart.deliveryNotes,
                    expectedDelivery: expectedDate,
                    scheduledPickupDate: (cart.deliveryType === 'pickup_home' || cart.deliveryType === 'delivery_home') ? scheduledPickupDate : undefined,
                    deliverySlot: cart.deliveryType === 'delivery_home' ? selectedTimeSlot : undefined,
                    pickupSlot: cart.deliveryType === 'pickup_home' ? selectedTimeSlot : undefined,
                });
                setUpdating(false);
                onComplete(editOrderId);
            } catch (error) {
                console.error('Failed to update order:', error);
                setUpdating(false);
            }
        } else {
            // Create new order - upload damage photos first if any (deferUpload)
            let finalDamageUrls: string[] | undefined;
            if (damagePhotoMetadata.length > 0) {
                try {
                    const finalMeta = await damagePhotoUploaderRef.current?.uploadPendingImages?.();
                    finalDamageUrls = finalMeta?.map((m) => m.url).filter(Boolean) as string[] | undefined;
                } catch (e) {
                    console.error("Failed to upload damage photos:", e);
                }
            }
            const order = await createOrder({
                customerId: cart.customerId,
                customerName: cart.customerName || "Guest",
                customerPhone: cart.customerPhone || "",
                isGuest: cart.isGuest,
                items: cart.items.map((item, index) => ({
                    id: `item-${item.service.id}-${index}`,
                    serviceId: item.service.id,
                    serviceName: item.service.name,
                    categoryId: item.service.categoryId,
                    categoryName: item.service.categoryName,
                    quantity: item.quantity,
                    unit: item.service.pricingType,
                    unitPrice: item.unitPrice,
                    total: item.total,
                    express: item.express,
                    notes: item.notes,
                    damages: item.damages,
                    expressMultiplier: item.service.expressMultiplier,
                })),
                damagePhotoUrls: (finalDamageUrls && finalDamageUrls.length > 0) ? finalDamageUrls : undefined,
                financials: {
                    subtotal: cart.subtotal,
                    discountType: cart.discountType,
                    discountValue: cart.discountValue,
                    discountAmount: cart.discountAmount,
                    expressCharge: cart.expressCharge,
                    deliveryCharge: cart.deliveryCharge,
                    taxAmount: cart.taxAmount,
                    taxRate: cart.taxRate,
                    taxName: cart.taxName,
                    total: cart.total,
                    amountPaid,
                },
                deliveryType: cart.deliveryType,
                deliveryAddress: cart.deliveryAddress,
                deliveryNotes: cart.deliveryNotes,
                expectedDelivery: expectedDate,
                scheduledPickupDate: (cart.deliveryType === 'pickup_home' || cart.deliveryType === 'delivery_home') ? scheduledPickupDate : undefined,
                // Pass slot info
                deliverySlot: cart.deliveryType === 'delivery_home' ? selectedTimeSlot : undefined,
                pickupSlot: cart.deliveryType === 'pickup_home' ? selectedTimeSlot : undefined,
                paymentMethod,
                paymentReference: paymentMethod === "upi" ? upiRef : undefined,
                // Pass staff info if in staff context
                staffId: isStaffRoute ? staff?.id : undefined,
                staffName: isStaffRoute ? staff?.name : undefined,
                // Pass agent info if assigned
                assignedAgentId: selectedAgentId || undefined,
                assignedAgentName: selectedAgent?.name || undefined,
            });

            if (order) {
                // Save address to customer if needed
                if (cart.customerId && cart.deliveryAddress && !cart.isGuest) {
                    // First address: auto-save; 2nd+: save only if checkbox checked
                    if (isFirstAddress || (isNewAddress && saveNewAddress)) {
                        await addAddress(cart.customerId, cart.deliveryAddress);
                    }
                }
                onComplete(order.id);
            }
        }
    };

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title={t('checkout.title')}
            size="md"
            snapPoints={[0.9]}
        >
            <div className="space-y-6">
                {/* Progress Stepper */}
                <LProgressStepper
                    steps={steps}
                    currentStep={currentStepIndex}
                />

                <LDivider />

                {/* Step Content */}
                {step === "review" && (
                    <div className="space-y-4">
                        <h3 className="font-semibold text-foreground">{t('checkout.orderSummary')}</h3>
                        <LOrderSummary
                            items={cart.items.map((item) => ({
                                id: item.id,
                                name: (item.service.categoryName
                                    ? `${getTranslatedItemName(item.service.name)} (${getTranslatedCategoryName(item.service.categoryName, item.service.categoryId)})`
                                    : getTranslatedItemName(item.service.name)) + (item.express ? " ⚡ (Express)" : ""),
                                quantity: item.quantity,
                                price: item.unitPrice,
                                unit: item.service.pricingType,
                            }))}
                            subtotal={cart.subtotal}
                            discount={cart.discountAmount}
                            delivery={cart.deliveryCharge}
                            taxAmount={cart.taxAmount}
                            taxName={cart.taxName}
                            taxRate={cart.taxRate}
                            total={cart.total}
                        />
                        {/* GST toggle: allow disabling tax for this order in POS */}
                        {cart.taxSettings?.enabled && (
                            <label className="flex items-center gap-3 text-sm cursor-pointer mt-2">
                                <input
                                    type="checkbox"
                                    checked={cart.taxEnabled}
                                    onChange={() => cart.toggleTax()}
                                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                />
                                <span className="text-muted-foreground">{t('checkout.includeGST', 'Include GST for this order')}</span>
                            </label>
                        )}
                        {/* Waive delivery fee for this order (home delivery / pickup & delivery only) */}
                        {(cart.deliveryType === 'delivery_home' || cart.deliveryType === 'pickup_home') && (
                            <label className="flex items-center gap-3 text-sm cursor-pointer mt-2">
                                <input
                                    type="checkbox"
                                    checked={cart.deliveryFeeWaived}
                                    onChange={(e) => cart.setDeliveryFeeWaived(e.target.checked)}
                                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                />
                                <span className="text-muted-foreground">{t('checkout.waiveDeliveryFee', 'Waive delivery fee for this order')}</span>
                            </label>
                        )}
                        {shopId && canUploadDamagePhotos && (
                            <div className="pt-2">
                                <LSmartImageUploader
                                    ref={damagePhotoUploaderRef}
                                    folder="damage-photos"
                                    shopId={shopId}
                                    value={damagePhotoMetadata}
                                    onChange={setDamagePhotoMetadata}
                                    maxFiles={5}
                                    showStats={true}
                                    deferUpload
                                    label={t('checkout.damageStainPhotos', 'Damage / stain photos (optional)')}
                                    hint={t('checkout.damageStainPhotosHint', 'Upload photos of damaged fabric or stains for this order')}
                                />
                            </div>
                        )}
                    </div>
                )}

                {step === "delivery" && (
                    <div className="space-y-4">
                        <h3 className="font-semibold text-foreground">{t('checkout.deliveryDetails')}</h3>

                        {/* Read-only: delivery type was chosen in Cart – no re-selection here to avoid accidentally waiving delivery fee */}
                        <LCard variant="outlined" padding="md" className="bg-muted/20">
                            <div className="flex items-center gap-3">
                                {cart.deliveryType === "pickup_store" && <Store className="h-5 w-5 text-muted-foreground" />}
                                {cart.deliveryType === "delivery_home" && <Truck className="h-5 w-5 text-primary" />}
                                {cart.deliveryType === "pickup_home" && <Home className="h-5 w-5 text-primary" />}
                                <div>
                                    <p className="text-sm font-medium text-foreground">
                                        {cart.deliveryType === "pickup_store" && t('checkout.shopPickup')}
                                        {cart.deliveryType === "delivery_home" && t('checkout.homeDelivery')}
                                        {cart.deliveryType === "pickup_home" && t('checkout.pickupFromHome', 'Pickup & Delivery')}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{t('checkout.selectedInCart', 'Selected in cart. Change delivery type in cart if needed.')}</p>
                                </div>
                            </div>
                        </LCard>

                        {(cart.deliveryType === "delivery_home" || cart.deliveryType === "pickup_home") && (
                            <>
                                <LTextArea
                                    label={cart.deliveryType === "delivery_home" ? t('checkout.deliveryAddress') : t('checkout.pickupAddress')}
                                    value={cart.deliveryAddress || ""}
                                    onChange={(e) => cart.setDelivery(cart.deliveryType, e.target.value, cart.deliveryNotes, cart.deliveryCharge)}
                                    placeholder={t('checkout.enterFullAddress')}
                                />
                                <LTextInput
                                    label={t('checkout.notesOptional')}
                                    value={cart.deliveryNotes || ""}
                                    onChange={(e) => cart.setDelivery(cart.deliveryType, cart.deliveryAddress, e.target.value, cart.deliveryCharge)}
                                    placeholder={t('checkout.notesPlaceholder')}
                                />

                                {/* Show save checkbox only for 2nd+ addresses (first is auto-saved) */}
                                {isNewAddress && !isFirstAddress && cart.customerId && !cart.isGuest && (
                                    <label className="flex items-center gap-3 text-sm cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={saveNewAddress}
                                            onChange={(e) => setSaveNewAddress(e.target.checked)}
                                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                        />
                                        <span className="text-muted-foreground">
                                            {t('checkout.saveAddressToCustomer')}
                                        </span>
                                    </label>
                                )}

                                {/* Area & Agent Selection for pickup/delivery - gated on the Service Areas master toggle */}
                                {deliverySettings.enableServiceAreas && (
                                <LCard variant="outlined" padding="md" className="bg-muted/30">
                                    {/* Area Selection - show first when service areas are configured */}
                                    {deliverySettings.serviceAreas?.length > 0 && (
                                        <div className="mb-4">
                                            <LSelect
                                                label={t('checkout.serviceArea', 'Service Area')}
                                                value={selectedArea}
                                                onChange={handleAreaChange}
                                                options={areaOptions}
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {t('checkout.areaHelp', 'Select area first to see assigned agents')}
                                            </p>
                                        </div>
                                    )}

                                    {/* Agent Selection - below area; shows agents for selected area + unassigned agents */}
                                    {canHaveAgents && (
                                        <>
                                            <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                                                <Truck className="h-4 w-4" />
                                                {t('checkout.assignAgent', 'Assign Delivery Agent')}
                                            </h4>
                                            <LSelect
                                                label={t('checkout.selectAgent', 'Select Agent')}
                                                value={selectedAgentId}
                                                onChange={handleAgentChange}
                                                options={agentOptions}
                                                disabled={deliverySettings.serviceAreas?.length > 0 && !selectedArea}
                                            />
                                            {deliverySettings.serviceAreas?.length > 0 && !selectedArea && (
                                                <p className="text-xs text-muted-foreground mt-1 text-warning">
                                                    {t('checkout.selectAreaFirst', 'Please select a service area first to see available agents')}
                                                </p>
                                            )}
                                            {selectedArea && agents.length === 0 && (
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    {t('checkout.noAgentsAvailable', 'No agents assigned for this area. You can assign one later in order details.')}
                                                </p>
                                            )}
                                        </>
                                    )}
                                </LCard>
                                )}
                            </>
                        )}

                        {/* Time Slot Selection - show when enabled for pickup or delivery */}
                        {availableTimeSlots.length > 0 && (
                            <LCard variant="outlined" padding="md" className={slotError ? "border-destructive/50 ring-1 ring-destructive/50" : ""}>
                                <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    {cart.deliveryType === 'pickup_home'
                                        ? t('checkout.pickupSchedule')
                                        : t('checkout.deliverySchedule', 'Delivery Time')}
                                    <span className="text-destructive ml-1">*</span>
                                </h4>

                                <div className="grid grid-cols-2 gap-2">
                                    {availableTimeSlots.map((slot) => (
                                        <button
                                            key={slot}
                                            type="button"
                                            onClick={() => {
                                                setSelectedTimeSlot(slot);
                                                setSlotError(false);
                                            }}
                                            className={`
                                                p-2 rounded-lg text-xs text-center transition-all
                                                ${selectedTimeSlot === slot
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-muted hover:bg-muted/80 text-foreground"
                                                }
                                            `}
                                        >
                                            {slot}
                                        </button>
                                    ))}
                                </div>
                                {slotError && (
                                    <p className="text-xs text-destructive mt-2">
                                        {t('checkout.timeSlotRequired', 'Please select a time slot')}
                                    </p>
                                )}
                            </LCard>
                        )}

                        {/* Pickup Date - Only for Home Pickup */}
                        {cart.deliveryType === 'pickup_home' && (
                            <div className="p-3 bg-muted rounded-xl space-y-2 mb-3">
                                <p className="text-sm text-muted-foreground">{t('checkout.scheduledPickupDate', 'Scheduled Pickup Date')}</p>
                                <div className="flex items-center gap-3">
                                    <LTextInput
                                        type="date"
                                        value={scheduledPickupDate.toISOString().split('T')[0]}
                                        onChange={(e) => {
                                            const date = new Date(e.target.value);
                                            if (!isNaN(date.getTime())) {
                                                setScheduledPickupDate(date);
                                            }
                                        }}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="flex-1"
                                    />
                                    <div className="text-sm font-medium">
                                        {scheduledPickupDate.toLocaleDateString("en-IN", {
                                            weekday: "short",
                                            day: "numeric",
                                            month: "short",
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="p-3 bg-muted rounded-xl space-y-2">
                            <p className="text-sm text-muted-foreground">{t('checkout.expectedDelivery')}</p>

                            {/* Date Picker for Expected Delivery */}
                            <div className="flex items-center gap-3">
                                <LTextInput
                                    type="date"
                                    value={expectedDate.toISOString().split('T')[0]} // Format YYYY-MM-DD
                                    onChange={(e) => {
                                        const date = new Date(e.target.value);
                                        if (!isNaN(date.getTime())) {
                                            setExpectedDate(date);
                                        }
                                    }}
                                    min={minExpectedDate.toISOString().split('T')[0]} // Min date constraint
                                    className="flex-1"
                                />
                                <div className="text-sm font-medium">
                                    {expectedDate.toLocaleDateString("en-IN", {
                                        weekday: "short",
                                        day: "numeric",
                                        month: "short",
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === "payment" && (
                    <div className="space-y-4">
                        <h3 className="font-semibold text-foreground">{t('checkout.payment')}</h3>

                        <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                            <span className="text-muted-foreground">{t('checkout.totalAmount')}</span>
                            <span className="text-xl font-bold text-foreground">
                                {formatAmount(cart.total)}
                            </span>
                        </div>

                        <LRadioGroup
                            name="paymentMethod"
                            value={paymentMethod}
                            onChange={(v) => setPaymentMethod(v as PaymentMethod)}
                            options={[
                                { value: "cash", label: t('checkout.cash'), description: t('checkout.cashDesc') },
                                { value: "upi", label: t('checkout.upi'), description: t('checkout.upiDesc') },
                                { value: "card", label: t('checkout.card'), description: t('checkout.cardDesc') },
                                { value: "pay_later", label: t('checkout.payLater'), description: t('checkout.payLaterDesc') },
                            ]}
                        />

                        {paymentMethod === "upi" && (
                            <LTextInput
                                label={t('checkout.upiReference')}
                                value={upiRef}
                                onChange={(e) => setUpiRef(e.target.value)}
                                placeholder={t('checkout.enterTransactionId')}
                            />
                        )}

                        {paymentMethod !== "pay_later" && (
                            <LTextInput
                                label={t('checkout.amountReceived')}
                                value={amountPaid.toString()}
                                onChange={(e) => setAmountPaid(Number(e.target.value) || 0)}
                                inputMode="numeric"
                            />
                        )}

                        {amountPaid > 0 && amountPaid < cart.total && (
                            <div className="p-3 bg-warning-muted rounded-xl">
                                <p className="text-sm text-warning">
                                    {t('checkout.balanceDue')}: {formatAmount(cart.total - amountPaid)}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                <LDivider />

                {/* Actions */}
                <div className="flex gap-3">
                    {step !== "review" && (
                        <LButton
                            variant="ghost"
                            onClick={handleBack}
                        >
                            {t('common.back')}
                        </LButton>
                    )}

                    <LButton
                        variant="primary"
                        fullWidth
                        onClick={step === "payment" ? handleComplete : handleNext}
                        loading={loading || updating}
                    >
                        {step === "payment" ? (isEditMode ? t('checkout.updateOrder') : t('checkout.createOrder')) : t('common.continue')}
                    </LButton>
                </div>
            </div>
        </LResponsiveDialog>
    );
}
