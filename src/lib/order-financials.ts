/**
 * Canonical order-financial computations — the SINGLE source of truth for every
 * money summary in the web app. The same logic is mirrored verbatim into the
 * owner app (mobile/src/lib/order-financials.ts) and the Team app
 * (driver/src/lib/order-financials.ts) so all three apps agree to the cent.
 *
 * Standard metric definitions (industry practice):
 *  - Sales (billed)   = Σ financials.total over non-cancelled orders (accrual / invoiced).
 *  - Collected (cash) = Σ financials.amountPaid over non-cancelled orders. Cancelled
 *                       orders are auto-refunded (amountPaid → 0), so they never count.
 *  - Outstanding      = Σ balance over orders with balance > 0, ANY status except
 *                       cancelled — all-time receivables ("money customers still owe").
 *  - Net profit       = Collected − Expenses (cash basis).
 *
 * Rules baked in here so no screen re-derives them differently:
 *  - Cancelled orders contribute 0 to sales, collected, and outstanding.
 *  - balance is clamped to ≥ 0 (overpayments never reduce outstanding).
 *  - balance falls back to (total − amountPaid) when not stored.
 */

/** Minimal structural shape — works for web Order and the apps' order docs alike. */
export interface OrderFinancialsLike {
  status?: string;
  financials?: {
    total?: number;
    amountPaid?: number;
    balance?: number;
  } | null;
}

export function isCancelledOrder(o: OrderFinancialsLike): boolean {
  return o?.status === "cancelled";
}

/** Billed (invoiced) value of an order. 0 for cancelled orders. */
export function orderBilled(o: OrderFinancialsLike): number {
  if (isCancelledOrder(o)) return 0;
  return o?.financials?.total || 0;
}

/** Cash actually collected on an order. 0 for cancelled (auto-refunded) orders. */
export function orderCollected(o: OrderFinancialsLike): number {
  if (isCancelledOrder(o)) return 0;
  return o?.financials?.amountPaid || 0;
}

/** Outstanding balance still owed on an order (≥ 0). 0 for cancelled orders. */
export function orderBalance(o: OrderFinancialsLike): number {
  if (isCancelledOrder(o)) return 0;
  const total = o?.financials?.total || 0;
  const paid = o?.financials?.amountPaid || 0;
  const stored = o?.financials?.balance;
  const bal = typeof stored === "number" ? stored : total - paid;
  return Math.max(0, bal);
}

export interface FinancialSummary {
  /** Billed / invoiced (accrual). */
  sales: number;
  /** Cash collected. */
  collected: number;
  /** Receivables: Σ positive balances (over the orders passed in). */
  outstanding: number;
  /** Count of non-cancelled orders. */
  orderCount: number;
  /** Count of cancelled orders (for reference; excluded from money). */
  cancelledCount: number;
}

/**
 * Summarise a list of orders with the canonical rules. NOTE: `outstanding` is
 * computed over exactly the orders you pass — for the headline all-time
 * receivables, pass the full order set (not a date-windowed slice).
 */
export function summarizeOrders(orders: OrderFinancialsLike[]): FinancialSummary {
  let sales = 0;
  let collected = 0;
  let outstanding = 0;
  let orderCount = 0;
  let cancelledCount = 0;
  for (const o of orders) {
    if (isCancelledOrder(o)) {
      cancelledCount++;
      continue;
    }
    sales += orderBilled(o);
    collected += orderCollected(o);
    outstanding += orderBalance(o);
    orderCount++;
  }
  return { sales, collected, outstanding, orderCount, cancelledCount };
}

/** Net profit on a cash basis. */
export function netProfit(collected: number, expenses: number): number {
  return collected - expenses;
}
