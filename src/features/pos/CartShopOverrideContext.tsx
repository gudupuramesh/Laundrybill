/**
 * Optional shop override for useCart when used in agent edit flow.
 * When AgentEditOrderSheet is open it provides shop from useShopByShopId so
 * delivery charge can be recalculated (e.g. 0 when subtotal >= min order).
 */

import { createContext, useContext, type ReactNode } from "react";
import type { Shop } from "@/types/shop";

const CartShopOverrideContext = createContext<Shop | null>(null);

export function CartShopOverrideProvider({
  shop,
  children,
}: {
  shop: Shop | null;
  children: ReactNode;
}) {
  return (
    <CartShopOverrideContext.Provider value={shop}>
      {children}
    </CartShopOverrideContext.Provider>
  );
}

export function useCartShopOverride() {
  return useContext(CartShopOverrideContext);
}
