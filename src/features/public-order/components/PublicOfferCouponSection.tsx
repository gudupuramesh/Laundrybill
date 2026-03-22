/**
 * Public Offer / Coupon Section
 * Shows copyable coupon code for use at checkout (no banner image).
 */

import { useState } from "react";
import { Tag, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLToast } from "@/components/laundry";
import type { Shop } from "@/types/shop";

interface PublicOfferCouponSectionProps {
  shop: Shop;
  className?: string;
  /** Inline: no max-width, for use in sidebar or column */
  inline?: boolean;
}

export function PublicOfferCouponSection({ shop, className, inline }: PublicOfferCouponSectionProps) {
  const [copied, setCopied] = useState(false);
  const { addToast } = useLToast();
  const featuredCode = shop.publicOrdering?.featuredCouponCode?.trim().toUpperCase();
  const fallbackCode =
    shop.settings?.publicCoupons?.[0]?.code?.trim().toUpperCase();
  const displayCode = featuredCode || fallbackCode;

  if (!displayCode) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(displayCode).then(() => {
      setCopied(true);
      addToast({ type: "success", title: "Coupon code copied! Use it at checkout." });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <section
      className={cn("w-full", inline ? "pb-3" : "px-4 pb-4", className)}
      data-testid="public-offer-coupon"
    >
      <div className={cn(inline ? "w-full" : "max-w-md mx-auto")}>
        {/* Copyable coupon code only */}
        {displayCode && (
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl",
              "bg-primary/10 hover:bg-primary/15 border-2 border-primary/30",
              "transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Tag className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm font-medium text-foreground">
                Use at checkout:
              </span>
              <span className="font-mono font-bold text-primary truncate">
                {displayCode}
              </span>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-medium text-primary shrink-0">
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
