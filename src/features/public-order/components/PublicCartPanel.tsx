/**
 * Public Cart Panel – Cart summary for public ordering (POS-like)
 * Shows items, totals, and Proceed to Checkout
 */

import {
  LButton,
  LCard,
  LAmount,
  LQuantityStepper,
  LEmptyState,
  LDivider,
} from "@/components/laundry";
import { ShoppingCart, Trash2 } from "lucide-react";
import { getTranslatedItemName } from "@/lib/inventory-translations";
import { groupOrderItemsByCategory } from "@/lib/order-item-groups";
import type { PublicCartItem } from "../hooks/use-public-cart";

interface PublicCartPanelProps {
  items: PublicCartItem[];
  subtotal: number;
  discountAmount?: number;
  taxAmount: number;
  taxRate?: number;
  taxName?: string;
  deliveryCharge: number;
  total: number;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onItemClick?: (item: PublicCartItem) => void;
  onCheckout: () => void;
  isDesktop?: boolean;
}

export function PublicCartPanel({
  items,
  subtotal,
  discountAmount = 0,
  taxAmount,
  taxRate,
  taxName,
  deliveryCharge,
  total,
  onUpdateQuantity,
  onRemoveItem,
  onItemClick,
  onCheckout,
  isDesktop,
}: PublicCartPanelProps) {
  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <LEmptyState
          icon={<ShoppingCart className="h-10 w-10" />}
          title="Cart empty"
          description="Add items to get started"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {isDesktop && (
        <div className="p-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Your order</h2>
            <span className="text-sm text-muted-foreground">
              {items.reduce((s, i) => s + i.quantity, 0)} items
            </span>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 space-y-4">
        {groupOrderItemsByCategory(items, (i) => i.service.categoryName || "").map(({ categoryName, items: groupItems }) => (
          <div key={categoryName}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {categoryName === "Others" ? "Other" : categoryName}
            </p>
            <div className="space-y-2">
              {groupItems.map((item) => (
                <LCard key={item.id} variant="outlined" className="p-3">
                  <div className="flex gap-3">
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => onItemClick?.(item)}
                    >
                      <h3 className="font-medium text-foreground truncate">
                        {getTranslatedItemName(item.service.name)}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        <LAmount value={item.unitPrice} size="sm" /> × {item.quantity}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <LAmount value={item.total} size="md" className="font-semibold" />
                      <div className="flex items-center gap-2">
                        <LQuantityStepper
                          value={item.quantity}
                          onChange={(q) => onUpdateQuantity(item.id, q)}
                          min={1}
                          max={99}
                          size="sm"
                        />
                        <button
                          onClick={() => onRemoveItem(item.id)}
                          className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </LCard>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-border bg-card space-y-2 shrink-0">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Subtotal</span>
          <LAmount value={subtotal} size="sm" />
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-sm text-success">
            <span>Discount</span>
            <span>-<LAmount value={discountAmount} size="sm" /></span>
          </div>
        )}
        {taxAmount > 0 && (
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{taxName || "Tax"} ({taxRate}%)</span>
            <LAmount value={taxAmount} size="sm" />
          </div>
        )}
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Delivery</span>
          <LAmount value={deliveryCharge} size="sm" />
        </div>
        <LDivider />
        <div className="flex justify-between font-semibold text-foreground">
          <span>Total</span>
          <LAmount value={total} size="lg" />
        </div>
        <LButton
          variant="primary"
          size="lg"
          fullWidth
          onClick={onCheckout}
          className="mt-2"
        >
          Proceed to Checkout
        </LButton>
      </div>
    </div>
  );
}
