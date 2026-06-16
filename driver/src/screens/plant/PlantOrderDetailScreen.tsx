import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../../theme';
import { firestore } from '../../lib/firebase';
import { useDriverAuth } from '../../lib/DriverAuthContext';
import { DetailHeader } from '../../components/DetailHeader';
import { OrderItemsCard } from '../../components/OrderItemsCard';
import { StatusPill } from '../../components/ui/StatusPill';
import { Button } from '../../components/ui/Button';
import { TagSheet } from '../../components/TagSheet';
import { PlantPhotosCard } from '../../components/PlantPhotosCard';
import { formatDate, formatDateTime } from '../../lib/format-date';
import { STATUS_LABELS, DELIVERY_TYPE_LABELS } from '../../types/order';
import type { Order, OrderStatus } from '../../types/order';

const STATUS_TINT: Record<string, { color: string; bg: string }> = {
  pending: { color: colors.warning, bg: colors.warningBg },
  pickup_completed: { color: colors.primary, bg: colors.primaryTint },
  processing: { color: colors.primary, bg: colors.primaryTint },
  ready: { color: colors.success, bg: colors.successBg },
  ready_for_pickup: { color: colors.success, bg: colors.successBg },
  out_for_delivery: { color: colors.primary, bg: colors.primaryTint },
  delivered: { color: colors.success, bg: colors.successBg },
  picked_up: { color: colors.success, bg: colors.successBg },
  cancelled: { color: colors.error, bg: colors.errorBg },
};

function statusTint(s: OrderStatus) {
  return STATUS_TINT[s] || { color: colors.textSecondary, bg: colors.surfaceMuted };
}

export default function PlantOrderDetailScreen({ orderId }: { orderId: string }) {
  const insets = useSafeAreaInsets();
  const { shopId } = useDriverAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [tagOpen, setTagOpen] = useState(false);

  useEffect(() => {
    if (!shopId || !orderId) {
      setLoading(false);
      return;
    }
    const unsub = firestore()
      .doc(`shops/${shopId}/orders/${orderId}`)
      .onSnapshot(
        (snap) => {
          if (snap.exists) setOrder({ id: snap.id, ...(snap.data() as object) } as Order);
          else setOrder(null);
          setLoading(false);
        },
        () => setLoading(false),
      );
    return () => unsub();
  }, [shopId, orderId]);

  if (loading) {
    return (
      <View style={styles.flex}>
        <DetailHeader title="Order" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.flex}>
        <DetailHeader title="Order" />
        <View style={styles.center}>
          <Text style={styles.muted}>Order not found</Text>
        </View>
      </View>
    );
  }

  const tint = statusTint(order.status);
  const timeline = [...(order.timeline || [])].sort(
    (a, b) => (a.timestamp?.toMillis?.() || 0) - (b.timestamp?.toMillis?.() || 0),
  );

  return (
    <View style={styles.flex}>
      <DetailHeader title={order.orderNumber || order.publicId || 'Order'} />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 24 }}>
        {/* Status */}
        <View style={styles.statusRow}>
          <StatusPill label={STATUS_LABELS[order.status] || order.status} color={tint.color} bgColor={tint.bg} size="md" />
          <Text style={styles.deliveryType}>{DELIVERY_TYPE_LABELS[order.deliveryType] || ''}</Text>
        </View>

        {/* Generate tag */}
        <Button label="Generate Tag" variant="tint" icon="qr-code-2" onPress={() => setTagOpen(true)} style={{ marginBottom: 12 }} />

        {/* Customer */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Customer</Text>
          <Text style={styles.custName}>{order.customerName || 'Customer'}</Text>
          {order.customerPhone ? (
            <View style={styles.iconLine}>
              <MaterialIcons name="phone" size={15} color={colors.textMuted} />
              <Text style={styles.iconLineText}>{order.customerPhone}</Text>
            </View>
          ) : null}
          {order.deliveryAddress ? (
            <View style={styles.iconLine}>
              <MaterialIcons name="place" size={15} color={colors.textMuted} />
              <Text style={styles.iconLineText}>{order.deliveryAddress}</Text>
            </View>
          ) : null}
        </View>

        {/* Items */}
        <OrderItemsCard items={order.items || []} />

        {/* Damage / processing photos */}
        <PlantPhotosCard order={order} />

        {/* Timeline */}
        {timeline.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Timeline</Text>
            {timeline.map((ev, i) => (
              <View key={ev.id || i} style={styles.timelineRow}>
                <View style={styles.dot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.tlStatus}>{STATUS_LABELS[ev.status] || ev.status}</Text>
                  <Text style={styles.tlMeta}>
                    {ev.staffName ? `${ev.staffName} · ` : ''}
                    {formatDateTime(ev.timestamp)}
                  </Text>
                  {ev.notes ? <Text style={styles.tlNotes}>{ev.notes}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Dates */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Dates</Text>
          <View style={styles.dateRow}>
            <Text style={styles.dateKey}>Created</Text>
            <Text style={styles.dateVal}>{formatDateTime(order.createdAt)}</Text>
          </View>
          <View style={styles.dateRow}>
            <Text style={styles.dateKey}>Expected Ready</Text>
            <Text style={styles.dateVal}>{formatDate(order.expectedDelivery)}</Text>
          </View>
        </View>
      </ScrollView>

      <TagSheet order={order} open={tagOpen} onClose={() => setTagOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textMuted },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  deliveryType: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 11,
  },
  cardLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 8,
  },
  custName: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  iconLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  iconLineText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary, flex: 1 },
  timelineRow: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 5 },
  tlStatus: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  tlMeta: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  tlNotes: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  dateKey: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  dateVal: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
});
