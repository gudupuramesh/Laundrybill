/**
 * PERMANENT order deletion (owner / manager only — Firestore rules enforce it).
 *
 * Mirrors the web's useOrderMutations().deleteOrder: the order is removed from
 * the database entirely — not cancelled, not hidden — so it disappears from
 * orders, reports and the customer's history, and its tracking link dies.
 * A non-cancelled order first REVERSES its contribution to the customer's
 * lifetime stats + loyalty (a cancelled order already reversed those on cancel),
 * otherwise deleting would leave the customer's totals permanently inflated.
 */
import { firestore } from './db';

export async function deleteOrderPermanently(shopId: string, orderId: string): Promise<void> {
  if (!shopId) throw new Error('No shop ID');

  const orderRef = firestore().doc(`shops/${shopId}/orders/${orderId}`);
  const snap = await orderRef.get();
  if (!snap.exists) throw new Error('Order not found');
  const order: any = snap.data() || {};

  if (order.status !== 'cancelled' && order.customerId && !order.isGuest) {
    try {
      const fin: any = order.financials || {};
      const custRef = firestore().doc(`shops/${shopId}/customers/${order.customerId}`);
      const custSnap = await custRef.get();
      if (custSnap.exists) {
        const c: any = custSnap.data() || {};
        // Points spent on this order come back; points it earned are revoked.
        const redeemedBack = fin.pointsRedeemed || 0;
        const earnedRevoke = order.loyalty?.earnedPoints || 0;
        const update: Record<string, any> = {
          totalOrders: Math.max(0, (c.totalOrders || 0) - 1),
          totalSpent: Math.max(0, (c.totalSpent || 0) - (fin.total || 0)),
          updatedAt: new Date(),
        };
        if (redeemedBack - earnedRevoke !== 0) {
          update.loyaltyPoints = Math.max(0, (c.loyaltyPoints || 0) + redeemedBack - earnedRevoke);
        }
        if (earnedRevoke > 0) update.loyaltyEarned = Math.max(0, (c.loyaltyEarned || 0) - earnedRevoke);
        await custRef.update(update);
      }
    } catch {
      // Non-fatal: a missing customer doc must not block the deletion.
    }
  }

  await orderRef.delete();
}
