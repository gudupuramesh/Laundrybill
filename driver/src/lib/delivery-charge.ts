/**
 * Delivery charge — pure function, identical to the web (`getDeliveryCharge` in
 * @/hooks/use-shop). Free at/above the min order, else the configured fee.
 *
 * Distance-band mode: when `distanceFeeEnabled` is set, the fee comes from a
 * manually-picked km band (resolveDistanceFee) instead of the flat min-order rule.
 */
export interface DistanceBand {
  id: string;
  label: string;
  fee: number;
}

export interface DeliveryChargeSettings {
  defaultCharge?: number;
  deliveryFeeEnabled?: boolean;
  deliveryFeeMinOrder?: number;
  deliveryFeeAmount?: number;
  distanceFeeEnabled?: boolean;
  distanceBands?: DistanceBand[];
}

/** Active distance bands for this shop (empty when distance mode is off). */
export function getDistanceBands(delivery: DeliveryChargeSettings | undefined): DistanceBand[] {
  if (!delivery?.distanceFeeEnabled) return [];
  return Array.isArray(delivery.distanceBands) ? delivery.distanceBands : [];
}

/** Fee for the selected band id (defaults to the nearest/first band). */
export function resolveDistanceFee(
  delivery: DeliveryChargeSettings | undefined,
  bandId: string | undefined,
): number {
  const bands = getDistanceBands(delivery);
  if (bands.length === 0) return 0;
  const sel = bands.find((b) => b.id === bandId) || bands[0];
  return sel?.fee || 0;
}

export function getDeliveryCharge(
  delivery: DeliveryChargeSettings | undefined,
  subtotalAfterDiscount: number,
  deliveryType: 'pickup_store' | 'delivery_home' | 'pickup_home',
  bandId?: string,
): number {
  if (deliveryType === 'pickup_store') return 0;
  if (!delivery) return 0;
  // Distance-band mode takes precedence for home delivery / pickup-from-home.
  if (delivery.distanceFeeEnabled && getDistanceBands(delivery).length > 0) {
    return resolveDistanceFee(delivery, bandId);
  }
  if (delivery.deliveryFeeEnabled === false) return 0;
  if (delivery.deliveryFeeEnabled === true) {
    const min = delivery.deliveryFeeMinOrder ?? 0;
    const fee = delivery.deliveryFeeAmount ?? delivery.defaultCharge ?? 0;
    return subtotalAfterDiscount >= min ? 0 : fee;
  }
  return delivery.defaultCharge ?? 0;
}
