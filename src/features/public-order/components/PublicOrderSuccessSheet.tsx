/**
 * Public Order Success – shown after order placement
 * Uses useOrderTracking (no auth required)
 */

import {
  LResponsiveDialog,
  LButton,
  LCard,
  LAmount,
  LDivider,
  LPageLoader,
} from "@/components/laundry";
import { useOrderTracking } from "@/hooks/use-tracking";
import { groupOrderItemsByCategory } from "@/lib/order-item-groups";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { useCurrencyByShopId } from "@/hooks/use-currency";

interface PublicOrderSuccessSheetProps {
  open: boolean;
  onClose: () => void;
  publicId: string;
  /** Customer phone (verifier) so the just-placed order can load. */
  phone: string;
}

export function PublicOrderSuccessSheet({
  open,
  onClose,
  publicId,
  phone,
}: PublicOrderSuccessSheetProps) {
  const { data, loading, error } = useOrderTracking(publicId, phone);
  const { formatAmount, currencySymbol } = useCurrencyByShopId(data?.shopId || null);

  const trackingUrl = `${window.location.origin}/track/${publicId}`;

  if (loading) {
    return (
      <LResponsiveDialog open={open} onClose={onClose} title="" size="sm">
        <LPageLoader message="Loading order..." />
      </LResponsiveDialog>
    );
  }

  if (error || !data) {
    return (
      <LResponsiveDialog open={open} onClose={onClose} title="Order Placed" size="sm">
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <p className="text-muted-foreground">{error || "Order placed successfully."}</p>
          <p className="font-mono font-bold text-lg">#{publicId}</p>
          <LButton fullWidth onClick={() => window.open(trackingUrl, "_blank")}>
            Track Order
          </LButton>
          <LButton variant="outline" fullWidth onClick={onClose}>
            Close
          </LButton>
        </div>
      </LResponsiveDialog>
    );
  }

  return (
    <LResponsiveDialog open={open} onClose={onClose} title="" size="sm">
      <div className="space-y-6 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-12 h-12 text-green-600" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Order Placed!</h2>
          <p className="text-muted-foreground">Thank you for your order.</p>
          <p className="text-xs text-muted-foreground">
            Shop owners: this order appears in your Orders list. Refresh the Orders page if you don’t see it.
          </p>
        </div>

        <LCard variant="outlined" className="text-left">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Order ID</span>
              <span className="font-bold">#{data.publicId}</span>
            </div>
            <LDivider />
            <div className="space-y-3">
              {groupOrderItemsByCategory(data.items, (i) => i.categoryName || "").map(({ categoryName, items: groupItems }) => (
                <div key={categoryName}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    {categoryName === "Others" ? "Other" : categoryName}
                  </p>
                  <div className="space-y-1">
                    {groupItems.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{item.name} × {item.quantity}</span>
                        {item.price != null && (
                          <span>{formatAmount(item.price * item.quantity)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <LDivider />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <LAmount value={data.total} currency={currencySymbol} size="md" />
            </div>
          </div>
        </LCard>

        <div className="space-y-2">
          <LButton
            fullWidth
            leftIcon={<ExternalLink className="h-4 w-4" />}
            onClick={() => window.open(trackingUrl, "_blank")}
          >
            Track Order
          </LButton>
          <LButton variant="outline" fullWidth onClick={onClose}>
            Close
          </LButton>
        </div>
      </div>
    </LResponsiveDialog>
  );
}
