/**
 * Delivery charge — pure function, identical to the web (`getDeliveryCharge` in
 * @/hooks/use-shop). Free at/above the min order, else the configured fee.
 */
export interface DeliveryChargeSettings {
  defaultCharge?: number;
  deliveryFeeEnabled?: boolean;
  deliveryFeeMinOrder?: number;
  deliveryFeeAmount?: number;
}

export function getDeliveryCharge(
  delivery: DeliveryChargeSettings | undefined,
  subtotalAfterDiscount: number,
  deliveryType: 'pickup_store' | 'delivery_home' | 'pickup_home',
): number {
  if (deliveryType === 'pickup_store') return 0;
  if (!delivery) return 0;
  if (delivery.deliveryFeeEnabled === false) return 0;
  if (delivery.deliveryFeeEnabled === true) {
    const min = delivery.deliveryFeeMinOrder ?? 0;
    const fee = delivery.deliveryFeeAmount ?? delivery.defaultCharge ?? 0;
    return subtotalAfterDiscount >= min ? 0 : fee;
  }
  return delivery.defaultCharge ?? 0;
}
