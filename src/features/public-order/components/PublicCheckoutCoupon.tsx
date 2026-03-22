/**
 * Public Checkout Coupon – customer enters coupon code; no manual discount amount
 * Coupons are configured by shop owner in settings.
 */

import { useState } from "react";
import { LCard, LButton, LTextInput } from "@/components/laundry";
import type { Shop } from "@/types/shop";
import type { PublicCoupon } from "@/types/shop";
import { formatCurrencyValue } from "@/hooks/use-currency";

interface PublicCheckoutCouponProps {
  shop: Shop;
  subtotal: number;
  discountAmount: number;
  appliedCoupon: { type: "percent" | "flat"; value: number } | null;
  onApply: (type: "percent" | "flat", value: number) => void;
  onRemove: () => void;
}

export function PublicCheckoutCoupon({
  shop,
  subtotal,
  discountAmount,
  appliedCoupon,
  onApply,
  onRemove,
}: PublicCheckoutCouponProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fmt = (v: number) => formatCurrencyValue(v, shop.settings?.currencySymbol || "₹", shop.settings?.locale || "en-IN");

  const coupons: PublicCoupon[] = shop.settings?.publicCoupons ?? [];

  const handleApply = () => {
    setError(null);
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Enter a coupon code");
      return;
    }
    const coupon = coupons.find(
      (c) => c.code.trim().toUpperCase() === trimmed
    );
    if (!coupon) {
      setError("Invalid coupon code");
      return;
    }
    if (coupon.minOrder != null && coupon.minOrder > 0 && subtotal < coupon.minOrder) {
      setError(`Minimum order ${fmt(coupon.minOrder)} required for this coupon`);
      return;
    }
    onApply(coupon.type, coupon.value);
    setCode("");
  };

  return (
    <LCard variant="outlined" padding="md" className="space-y-3">
      <div className="font-medium text-foreground">Coupon</div>
      {appliedCoupon ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-success">
            Coupon applied: -{fmt(Math.round(discountAmount))}
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="text-destructive text-xs font-medium hover:underline"
          >
            Remove
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <LTextInput
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter coupon code"
              className="flex-1"
            />
            <LButton variant="secondary" size="md" onClick={handleApply}>
              Apply
            </LButton>
          </div>
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </>
      )}
    </LCard>
  );
}
