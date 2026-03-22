/**
 * Public Order Content – Modern 2025 Design
 * 
 * Layout:
 * 1. Area selector (prominent, centered, compact) - RIGHT after hero
 * 2. Process steps (compact horizontal) - HIDDEN once area selected
 * 3. Testimonials (if available) - MOVED to bottom once area selected
 * 4. Order flow (after area selected)
 * 
 * Responsive: Desktop split view, Mobile scrollable with sticky checkout
 */

import { useState, useEffect } from "react";
import { flushSync } from "react-dom";
import {
  LCard,
  LButton,
  LTextInput,
  LTextArea,
  LPhoneInput,
  LResponsiveDialog,
  LOrderSummary,
  LAmount,
  LSelect,
  LBottomSheet,
} from "@/components/laundry";
import { useInventoryForShop } from "../hooks/use-inventory-for-shop";
import { usePublicCart } from "../hooks/use-public-cart";
import { useIsMobile } from "@/hooks/use-mobile";
import { AreaSelector } from "./AreaSelector";
import { SlotSelector } from "./SlotSelector";
import { PublicLocationMap } from "./PublicLocationMap";
import { PublicCartPanel } from "./PublicCartPanel";
import { TestimonialsSection } from "./TestimonialsSection";
import { ProcessStepsSection } from "./ProcessStepsSection";
import { PublicOfferCouponSection } from "./PublicOfferCouponSection";
import { PublicCheckoutCoupon } from "./PublicCheckoutCoupon";
import { PublicOrderSuccessSheet } from "./PublicOrderSuccessSheet";
import { ServiceGrid } from "@/features/pos/ServiceGrid";
import { useCreatePublicOrder } from "../hooks/use-create-public-order";
import { usePublicSlotAvailability } from "../hooks/use-public-slot-availability";
import { getShopOpenStatus } from "../lib/shop-hours";
import { getDeliveryCharge } from "@/hooks/use-shop";
import { ItemDetailSheet } from "@/features/pos/ItemDetailSheet";
import type { InventoryItem } from "@/types/inventory";
import type { Shop } from "@/types/shop";
import { User, ArrowRight, MapPin, ShoppingCart, Clock, Zap, ListOrdered, Loader2 } from "lucide-react";
import { getTranslatedItemName } from "@/lib/inventory-translations";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useLToast } from "@/components/laundry";
import { formatCurrencyValue } from "@/hooks/use-currency";
import { useNavigate } from "react-router-dom";
import { forwardGeocode } from "@/lib/geocoding";
import type { PublicDeliveryAddress } from "../hooks/use-public-cart";

type OrderMode = "quick" | "select";

interface PublicOrderContentProps {
  shop: Shop;
  onOrderingActive?: (active: boolean) => void;
  onCheckoutOpenChange?: (open: boolean) => void;
  onCartHasItemsChange?: (hasItems: boolean) => void;
}

export function PublicOrderContent({ shop, onOrderingActive, onCheckoutOpenChange, onCartHasItemsChange }: PublicOrderContentProps) {
  const [selectedArea, setSelectedArea] = useState("");
  const [mode, setMode] = useState<OrderMode>("quick");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [itemDetailOpen, setItemDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [mobileCartSheetOpen, setMobileCartSheetOpen] = useState(false);
  const [successPublicId, setSuccessPublicId] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const { createOrder: createPublicOrder, loading: creatingOrder, error: createError } =
    useCreatePublicOrder();
  const { addToast } = useLToast();
  const navigate = useNavigate();

  const shopCurrencySymbol = shop.settings?.currencySymbol || "₹";
  const shopLocale = shop.settings?.locale || "en-IN";
  const fmt = (v: number) => formatCurrencyValue(v, shopCurrencySymbol, shopLocale);
  const deliverySettings = shop.settings?.delivery;
  const areas = deliverySettings?.serviceAreas || [];
  const hasAreas = areas.some((a) => a.isActive);

  const { items, categories, loading } = useInventoryForShop(shop.id);
  const cart = usePublicCart(shop);
  const isMobile = useIsMobile();

  const checkoutDate = cart.pickupDate || format(new Date(), "yyyy-MM-dd");
  const { data: slotAvailability } = usePublicSlotAvailability(
    checkoutOpen ? shop.publicOrdering?.slug : undefined,
    checkoutOpen ? checkoutDate : undefined
  );

  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, selectedCategory]);

  const areaSelected = !!selectedArea;

  useEffect(() => {
    onOrderingActive?.(areaSelected && (mode === "select" || mode === "quick"));
  }, [areaSelected, mode, onOrderingActive]);

  useEffect(() => {
    onCheckoutOpenChange?.(checkoutOpen);
  }, [checkoutOpen, onCheckoutOpenChange]);

  const cartHasItems = cart.items.some((i) => i.quantity > 0);
  useEffect(() => {
    onCartHasItemsChange?.(cartHasItems);
  }, [cartHasItems, onCartHasItemsChange]);

  const openStatus = getShopOpenStatus(shop);

  const filteredItems = items.filter((item) => {
    if (!item.isActive) return false;
    if (selectedCategory && item.categoryId !== selectedCategory) return false;
    return true;
  });

  const handleProceedToCheckout = () => {
    if (!cart.pickupDate) {
      cart.setPickupSlot(format(new Date(), "yyyy-MM-dd"), cart.pickupSlot);
    }
    setCheckoutOpen(true);
  };

  const canPlaceOrder =
    cart.customerName.trim().length > 0 &&
    cart.customerPhone.replace(/\D/g, "").length >= 10;

  const showFloatingCheckout =
    areaSelected &&
    mode === "select" &&
    isMobile;

  const showQuickOrderProceed = areaSelected && mode === "quick";

  const selectItemsContent = (
    <div className={cn("flex flex-col", !isMobile && "h-full min-h-0")}>
      <h3 className="font-semibold text-foreground shrink-0 mb-3">Our Services</h3>
      <ServiceGrid
        categories={categories}
        items={filteredItems}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        cartItems={cart.items}
        onServiceClick={(s) => cart.addItem(s)}
        onServiceLongPress={(s) => {
          setSelectedItem(s);
          setItemDetailOpen(true);
        }}
        loading={loading}
        stickyCategories={!isMobile}
      />
    </div>
  );

  const hasTestimonials = (shop.publicOrdering?.testimonials?.length ?? 0) > 0;

  const startOrderBlock = (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Start your order
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className={cn("flex gap-3", isMobile ? "justify-center flex-wrap" : "flex-wrap")}>
        <button
          onClick={() => setMode("quick")}
          className={cn(
            "flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all",
            mode === "quick"
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          )}
        >
          <Zap className="h-4 w-4" />
          Quick Order
        </button>
        <button
          onClick={() => setMode("select")}
          className={cn(
            "flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all",
            mode === "select"
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          )}
        >
          <ListOrdered className="h-4 w-4" />
          Select Items
        </button>
      </div>
      <p className={cn("text-xs text-muted-foreground mt-2", isMobile && "text-center")}>
        {mode === "quick"
          ? "Agent will confirm pricing at pickup"
          : "Browse services and add to cart"}
      </p>
    </>
  );

  const isDesktopSelectItems = !isMobile && areaSelected && mode === "select";

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Shop closed notice - full width */}
      {!openStatus.isOpen && (
        <div className="px-4 pt-4 shrink-0">
          <div className="max-w-4xl mx-auto flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <Clock className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Currently closed. You can still place an order for the next available day.
            </p>
          </div>
        </div>
      )}

      {/* Desktop Select Items: left column scrolls, right sidebar sticky (no coupon/banner for more space) */}
      {isDesktopSelectItems ? (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col">
            <div className="p-6 pb-4 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground uppercase tracking-wide mb-3">Start your order</h3>
                {startOrderBlock}
              </div>
            </div>
            <div className="flex-1 min-h-0 p-6 pt-0 border-t border-border">
              {selectItemsContent}
            </div>
          </div>
          <div className="w-[380px] flex-shrink-0 border-l border-border bg-card flex flex-col min-h-0 overflow-hidden">
            <div className="p-4 border-b border-border shrink-0">
              <AreaSelector areas={areas} value={selectedArea} onChange={setSelectedArea} variant="sidebar" />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <PublicCartPanel
                items={cart.items}
                subtotal={cart.subtotal}
                discountAmount={cart.discountAmount}
                taxAmount={cart.taxAmount}
                taxRate={cart.taxRate}
                taxName={cart.taxName}
                deliveryCharge={cart.deliveryCharge}
                total={cart.total}
                onUpdateQuantity={(id, qty) => cart.updateItem(id, { quantity: qty })}
                onRemoveItem={cart.removeItem}
                onItemClick={(item) => {
                  setSelectedItem(item.service);
                  setItemDetailOpen(true);
                }}
                onCheckout={handleProceedToCheckout}
                isDesktop
              />
            </div>
          </div>
        </div>
      ) : (
        /* Main scrollable area: mobile + desktop (before area / Quick Order) */
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {/* ========== MOBILE: single column ========== */}
          {isMobile && (
          <>
            {/* Hide coupon in Select Items – area is beside Our Services */}
            {!(areaSelected && mode === "select") && (
              <PublicOfferCouponSection shop={shop} className="pt-4" />
            )}
            {/* Hide "Where should we pick up?" when Select Items – area dropdown is beside Our Services */}
            {!(areaSelected && mode === "select") && (
              <div className="px-4 py-6">
                <div className="max-w-md mx-auto">
                  {hasAreas ? (
                    <AreaSelector areas={areas} value={selectedArea} onChange={setSelectedArea} />
                  ) : (
                    <div className="text-center p-6 rounded-xl bg-muted/50 border border-dashed border-border">
                      <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">Service areas not configured yet.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {!areaSelected && (
              <div className="border-t border-b border-border bg-muted/30">
                <ProcessStepsSection templateId={shop.publicOrdering?.template} compact />
              </div>
            )}
            {hasTestimonials && !areaSelected && (
              <TestimonialsSection
                testimonials={shop.publicOrdering!.testimonials!}
                templateId={shop.publicOrdering?.template}
                compact
              />
            )}
            {areaSelected && (
              <>
                <div className="px-4 py-4">
                  <div className="max-w-2xl mx-auto">{startOrderBlock}</div>
                </div>
                {showQuickOrderProceed && (
                  <div className="px-4 pb-6">
                    <div className="max-w-sm mx-auto">
                      <LButton variant="primary" size="lg" fullWidth onClick={handleProceedToCheckout} className="shadow-lg shadow-primary/25">
                        <ArrowRight className="h-5 w-5 mr-2" />
                        Continue to Checkout
                      </LButton>
                    </div>
                  </div>
                )}
                {mode === "select" && (
                  <div className="px-4 pb-28">
                    <div className="flex flex-col">
                      {/* Our Services row with area dropdown on the right (match screenshot) */}
                      <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
                        <h3 className="font-semibold text-foreground">Our Services</h3>
                        {hasAreas && (
                          <div className="w-[140px] shrink-0">
                            <LSelect
                              value={selectedArea}
                              onChange={setSelectedArea}
                              options={areas.filter((a) => a.isActive).map((a) => ({ value: a.value, label: a.value }))}
                              placeholder="Area"
                              className="!mb-0"
                            />
                          </div>
                        )}
                      </div>
                      <ServiceGrid
                        categories={categories}
                        items={filteredItems}
                        selectedCategory={selectedCategory}
                        onCategoryChange={setSelectedCategory}
                        cartItems={cart.items}
                        onServiceClick={(s) => cart.addItem(s)}
                        onServiceLongPress={(s) => {
                          setSelectedItem(s);
                          setItemDetailOpen(true);
                        }}
                        loading={loading}
                        stickyCategories={false}
                      />
                    </div>
                  </div>
                )}
                {hasTestimonials && (
                  <div className="py-8 bg-muted/20 border-t border-border/50">
                    <TestimonialsSection testimonials={shop.publicOrdering!.testimonials!} templateId={shop.publicOrdering?.template} compact />
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ========== DESKTOP: two-column layouts per mockups ========== */}
        {!isMobile && (
          <>
            {/* Before area selected: left = area, right = steps + testimonials */}
            {!areaSelected && (
              <div className="px-4 py-6 md:py-8">
                <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                  <div className="flex flex-col justify-center">
                    {hasAreas ? (
                      <AreaSelector areas={areas} value={selectedArea} onChange={setSelectedArea} />
                    ) : (
                      <div className="text-center p-6 rounded-xl bg-muted/50 border border-dashed border-border">
                        <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">Service areas not configured yet.</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-6">
                    <div className="border border-border rounded-xl bg-muted/20 p-6">
                      <ProcessStepsSection templateId={shop.publicOrdering?.template} compact />
                    </div>
                    {hasTestimonials && (
                      <TestimonialsSection
                        testimonials={shop.publicOrdering!.testimonials!}
                        templateId={shop.publicOrdering?.template}
                        compact
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Area selected + Quick Order: left = area, right = coupon + start order + CTA; below = steps + testimonials */}
            {areaSelected && mode === "quick" && (
              <>
                <div className="px-4 py-6 md:py-8">
                  <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                    <div className="flex flex-col justify-center">
                      {hasAreas && (
                        <AreaSelector areas={areas} value={selectedArea} onChange={setSelectedArea} />
                      )}
                    </div>
                    <div className="space-y-6">
                      <PublicOfferCouponSection shop={shop} inline className="pt-0" />
                      <div className="border border-border rounded-xl bg-card p-6">
                        <h3 className="text-lg font-semibold text-foreground mb-4 uppercase tracking-wide">Start your order</h3>
                        {startOrderBlock}
                        {showQuickOrderProceed && (
                          <LButton
                            variant="primary"
                            size="lg"
                            fullWidth
                            onClick={handleProceedToCheckout}
                            className="mt-6 shadow-lg shadow-primary/25"
                          >
                            <ArrowRight className="h-5 w-5 mr-2" />
                            Continue to Checkout
                          </LButton>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="border-t border-border bg-muted/30">
                  <ProcessStepsSection templateId={shop.publicOrdering?.template} compact />
                </div>
                {hasTestimonials && (
                  <div className="py-8 bg-muted/20">
                    <TestimonialsSection
                      testimonials={shop.publicOrdering!.testimonials!}
                      templateId={shop.publicOrdering?.template}
                      compact
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}

          {/* Bottom padding for mobile floating button */}
          {showFloatingCheckout && <div className="h-4" />}
        </div>
      )}

      {/* Mobile: Floating cart bar (dark green) – tap opens order summary sheet */}
      {showFloatingCheckout && (
        <button
          type="button"
          onClick={() => setMobileCartSheetOpen(true)}
          className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-4 bg-primary text-primary-foreground shadow-2xl md:hidden safe-area-pb hover:opacity-95 active:opacity-90 transition-opacity"
        >
          <span className="flex items-center gap-2 font-medium">
            <ShoppingCart className="h-5 w-5" />
            <span>
              {cart.items.reduce((s, i) => s + i.quantity, 0)} {cart.items.reduce((s, i) => s + i.quantity, 0) === 1 ? "item" : "items"}
            </span>
          </span>
          <LAmount value={cart.total} size="lg" className="text-primary-foreground font-semibold" />
        </button>
      )}

      {/* Mobile: Cart summary bottom sheet (no area – already beside Our Services) */}
      {isMobile && (
        <LBottomSheet
          open={mobileCartSheetOpen}
          onClose={() => setMobileCartSheetOpen(false)}
          title="Your order"
          snapPoints={[0.85]}
          className="md:hidden"
        >
          <div className="flex flex-col h-full min-h-0">
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <PublicCartPanel
                items={cart.items}
                subtotal={cart.subtotal}
                discountAmount={cart.discountAmount}
                taxAmount={cart.taxAmount}
                taxRate={cart.taxRate}
                taxName={cart.taxName}
                deliveryCharge={cart.deliveryCharge}
                total={cart.total}
                onUpdateQuantity={(id, qty) => cart.updateItem(id, { quantity: qty })}
                onRemoveItem={cart.removeItem}
                onItemClick={(item) => {
                  setSelectedItem(item.service);
                  setItemDetailOpen(true);
                  setMobileCartSheetOpen(false);
                }}
                onCheckout={() => {
                  setMobileCartSheetOpen(false);
                  handleProceedToCheckout();
                }}
                isDesktop={false}
              />
            </div>
          </div>
        </LBottomSheet>
      )}

      {/* Success sheet – Close lands on public page home */}
      <PublicOrderSuccessSheet
        open={!!successPublicId}
        onClose={() => {
          setSuccessPublicId(null);
          const slug = shop.publicOrdering?.slug;
          if (slug) navigate(`/order/${slug}`);
        }}
        publicId={successPublicId || ""}
      />

      {/* Item detail sheet */}
      <ItemDetailSheet
        open={itemDetailOpen}
        onClose={() => {
          setItemDetailOpen(false);
          setSelectedItem(null);
        }}
        item={selectedItem || undefined}
        initialValues={
          selectedItem
            ? (() => {
                const existing = cart.items.find((i) => i.service.id === selectedItem.id);
                return existing
                  ? {
                      quantity: existing.quantity,
                      express: existing.express,
                      notes: existing.notes,
                    }
                  : undefined;
              })()
            : undefined
        }
        onAdd={(item, qty, express, notes) => {
          cart.addItem(item, qty, express, notes);
          setItemDetailOpen(false);
          setSelectedItem(null);
        }}
      />

      {/* Checkout dialog */}
      <LResponsiveDialog
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title="Checkout"
        size="lg"
      >
        <div className="relative space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Placing order overlay – show the instant user clicks; clear feedback while request is in flight */}
          {(isPlacingOrder || creatingOrder) && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 min-h-[280px] rounded-lg bg-background/98 backdrop-blur-md border border-border/50">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
              <p className="text-lg font-semibold text-foreground">Placing your order...</p>
              <p className="text-sm text-muted-foreground">Please wait. Do not close this window.</p>
            </div>
          )}
          {/* Order Summary or Quick Order message */}
          {mode === "quick" ? (
            <LCard variant="outlined" padding="md" className="bg-muted/30">
              <p className="text-sm text-muted-foreground text-center">
                Agent will update you the pricing at the time of pickup.
              </p>
            </LCard>
          ) : (
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Order Summary</h3>
              <LOrderSummary
                items={cart.items.map((i) => ({
                  id: i.id,
                  name: getTranslatedItemName(i.service.name),
                  categoryName: i.service.categoryName,
                  quantity: i.quantity,
                  price: i.unitPrice,
                  express: i.express,
                  processingDays: i.express ? 1 : i.service.turnaroundDays,
                }))}
                subtotal={cart.subtotal}
                discount={cart.discountAmount}
                taxAmount={cart.taxAmount}
                taxRate={cart.taxRate}
                taxName={cart.taxName}
                delivery={cart.deliveryCharge}
                total={cart.total}
              />
              
              {(shop.settings?.publicCoupons?.length ?? 0) > 0 && (
                <PublicCheckoutCoupon
                  shop={shop}
                  subtotal={cart.subtotal}
                  discountAmount={cart.discountAmount}
                  appliedCoupon={cart.discountType ? { type: cart.discountType, value: cart.discountValue ?? 0 } : null}
                  onApply={(type, value) => cart.setDiscount(type, value)}
                  onRemove={() => cart.setDiscount(undefined, undefined)}
                />
              )}
            </div>
          )}

          {/* Pickup Date & Slots */}
          <SlotSelector
            slots={deliverySettings?.pickupTimeSlots || []}
            selectedDate={checkoutDate}
            selectedSlot={cart.pickupSlot}
            onDateChange={(d) => cart.setPickupSlot(d, "")}
            onSlotChange={(s) =>
              cart.setPickupSlot(cart.pickupDate || format(new Date(), "yyyy-MM-dd"), s)
            }
            enableSlots={!!deliverySettings?.enablePickupSlots}
            slotAvailability={slotAvailability ?? undefined}
            bufferMinutes={deliverySettings?.bufferMinutes ?? 0}
          />

          {/* Pickup Address */}
          <LCard variant="outlined" padding="md" className="space-y-4">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              Pickup Address
            </div>
            <PublicLocationMap
              lat={cart.deliveryAddress?.lat}
              lng={cart.deliveryAddress?.lng}
              onLocationChange={(lat, lng) => {
                cart.setDeliveryAddress({ ...(cart.deliveryAddress || {}), lat, lng });
              }}
              onAddressChange={(addr) => {
                cart.setDeliveryAddressMerge({ fullAddress: addr });
              }}
              autoGetLocationOnMount={checkoutOpen}
            />
            {!cart.deliveryAddress?.lat && (
              <p className="text-xs text-muted-foreground">
                Use current location or enter your address below
              </p>
            )}
            <LTextInput
              label="Flat / House No. / Building *"
              value={cart.deliveryAddress?.flatNumber ?? ""}
              onChange={(e) => cart.setDeliveryAddressMerge({ flatNumber: e.target.value })}
              placeholder="e.g. 402, Tower B"
            />
            <LTextInput
              label="Landmark (optional)"
              value={cart.deliveryAddress?.landmark ?? ""}
              onChange={(e) => cart.setDeliveryAddressMerge({ landmark: e.target.value })}
              placeholder="e.g. Near City Center Mall"
            />
            <LTextInput
              label="Full Address"
              value={cart.deliveryAddress?.fullAddress ?? ""}
              onChange={(e) => cart.setDeliveryAddressMerge({ fullAddress: e.target.value })}
              placeholder="Road, area, city (auto-filled from map or type here)"
            />
          </LCard>

          {/* Special Instructions */}
          <LTextArea
            label="Special Instructions (optional)"
            value={cart.customerNotes}
            onChange={(e) => cart.setCustomerNotes(e.target.value)}
            placeholder="e.g. Ring doorbell twice, Call before coming"
            rows={3}
          />

          {/* Contact Details */}
          <LCard variant="outlined" padding="md" className="space-y-4">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <User className="h-4 w-4 text-primary" />
              Your details
            </div>
            <LTextInput
              label="Name *"
              value={cart.customerName}
              onChange={(e) =>
                cart.setCustomer(e.target.value, cart.customerPhone, cart.customerEmail)
              }
              placeholder="Your name"
            />
            <LPhoneInput
              label="Phone *"
              value={cart.customerPhone}
              onValueChange={(v) => cart.setCustomer(cart.customerName, v, cart.customerEmail)}
            />
            <LTextInput
              label="Email (optional)"
              value={cart.customerEmail}
              onChange={(e) =>
                cart.setCustomer(cart.customerName, cart.customerPhone, e.target.value)
              }
              placeholder="email@example.com"
              type="email"
            />
          </LCard>

          {/* Actions */}
          <div className="flex gap-3">
            <LButton variant="outline" fullWidth onClick={() => setCheckoutOpen(false)}>
              Back
            </LButton>
            <LButton
              variant="primary"
              fullWidth
              disabled={
                (!!deliverySettings?.enablePickupSlots && !cart.pickupSlot) ||
                !(
                  (cart.deliveryAddress?.lat != null && cart.deliveryAddress?.flatNumber?.trim()) ||
                  (cart.deliveryAddress?.fullAddress?.trim() && cart.deliveryAddress?.flatNumber?.trim())
                ) ||
                !canPlaceOrder
              }
              loading={creatingOrder || isPlacingOrder}
              onClick={async () => {
                const addr = cart.deliveryAddress;
                const hasLatLng = addr?.lat != null && addr?.lng != null;
                const hasManualAddress = !!addr?.fullAddress?.trim() && !!addr?.flatNumber?.trim();
                if (!hasLatLng && !hasManualAddress) return;
                if (!addr?.flatNumber?.trim()) return;

                flushSync(() => setIsPlacingOrder(true));
                await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                try {
                  let effectiveAddress: PublicDeliveryAddress;
                  if (hasLatLng) {
                    effectiveAddress = {
                      lat: addr.lat,
                      lng: addr.lng,
                      flatNumber: addr.flatNumber?.trim(),
                      landmark: addr.landmark?.trim() || undefined,
                      fullAddress: addr.fullAddress?.trim() || undefined,
                    };
                  } else {
                    const query = [addr.flatNumber?.trim(), addr.landmark?.trim(), addr.fullAddress?.trim()]
                      .filter(Boolean)
                      .join(", ");
                    const geocoded = await forwardGeocode(query);
                    if (!geocoded) {
                      addToast({
                        type: "error",
                        title: "Could not find location",
                        description: "Please use the map or current location, or enter a more specific address.",
                      });
                      return;
                    }
                    effectiveAddress = {
                      lat: geocoded.lat,
                      lng: geocoded.lng,
                      flatNumber: addr.flatNumber?.trim(),
                      landmark: addr.landmark?.trim() || undefined,
                      fullAddress: addr.fullAddress?.trim() || undefined,
                    };
                  }

                  const isQuick = mode === "quick";
                  const effectiveDeliveryCharge =
                    isQuick && cart.deliveryCharge === 0
                      ? getDeliveryCharge(shop.settings?.delivery, 0, "pickup_home") || 50
                      : cart.deliveryCharge;
                  const effectiveTotal =
                    isQuick && cart.deliveryCharge === 0
                      ? Math.max(0, cart.subtotal - (cart.discountAmount ?? 0) + cart.taxAmount + effectiveDeliveryCharge)
                      : cart.total;

                  const result = await createPublicOrder(shop, {
                    deliveryArea: selectedArea,
                    customerName: cart.customerName.trim(),
                    customerPhone: cart.customerPhone,
                    customerEmail: cart.customerEmail.trim() || undefined,
                    items: cart.items,
                    subtotal: cart.subtotal,
                    discountType: cart.discountType,
                    discountValue: cart.discountValue,
                    discountAmount: cart.discountAmount,
                    taxAmount: cart.taxAmount,
                    taxRate: cart.taxRate,
                    taxName: cart.taxName,
                    deliveryCharge: effectiveDeliveryCharge,
                    total: effectiveTotal,
                    pickupDate: cart.pickupDate || format(new Date(), "yyyy-MM-dd"),
                    pickupSlot: cart.pickupSlot,
                    deliveryAddress: effectiveAddress,
                    customerNotes: cart.customerNotes.trim() || undefined,
                    isQuickOrder: isQuick,
                  });

                  if (result) {
                    setCheckoutOpen(false);
                    cart.clearCart();
                    setSuccessPublicId(result.publicId);
                  } else if (createError) {
                    addToast({ type: "error", title: createError });
                  }
                } finally {
                  setIsPlacingOrder(false);
                }
              }}
            >
              {mode === "quick" ? "Place Quick Order" : `Place Order – ${fmt(cart.total)}`}
            </LButton>
          </div>
        </div>
      </LResponsiveDialog>
    </div>
  );
}
