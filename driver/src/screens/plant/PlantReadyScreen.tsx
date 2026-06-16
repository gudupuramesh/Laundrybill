import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../../theme';
import { usePlantOrders } from '../../hooks/use-plant-orders';
import { PlantOrderRow } from '../../components/PlantOrderRow';
import { useNav } from '../../lib/nav';
import type { Order } from '../../types/order';

export default function PlantReadyScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNav();
  const { orders, loading, markOutForDelivery } = usePlantOrders(['ready', 'ready_for_pickup']);
  const [busyId, setBusyId] = useState<string | null>(null);

  const deliveryOrders = useMemo(() => orders.filter((o) => o.deliveryType !== 'pickup_store'), [orders]);
  const pickupOrders = useMemo(() => orders.filter((o) => o.deliveryType === 'pickup_store'), [orders]);

  const dispatch = (order: Order) => {
    Alert.alert('Dispatch Order?', 'This will mark the order as Out for Delivery.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Dispatch',
        onPress: async () => {
          setBusyId(order.id);
          try {
            await markOutForDelivery(order.id, order);
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to dispatch order');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const view = (o: Order) => nav.navigate({ name: 'plantOrderDetail', orderId: o.id });

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Text style={styles.title}>Ready</Text>
        <Text style={styles.subtitle}>
          {deliveryOrders.length} to dispatch · {pickupOrders.length} for pickup
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="inbox" size={40} color={colors.textMuted} />
          <Text style={styles.emptyText}>No orders ready yet</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 100 }}>
          <Text style={styles.sectionLabel}>For Delivery ({deliveryOrders.length})</Text>
          {deliveryOrders.length === 0 ? (
            <Text style={styles.sectionEmpty}>No delivery orders ready</Text>
          ) : (
            deliveryOrders.map((o) => (
              <PlantOrderRow
                key={o.id}
                order={o}
                onView={() => view(o)}
                actionLabel="Mark Out for Delivery"
                actionVariant="primary"
                actionLoading={busyId === o.id}
                onAction={() => dispatch(o)}
              />
            ))
          )}

          <Text style={[styles.sectionLabel, { marginTop: 18 }]}>For Customer Pickup ({pickupOrders.length})</Text>
          {pickupOrders.length === 0 ? (
            <Text style={styles.sectionEmpty}>No customer-pickup orders ready</Text>
          ) : (
            pickupOrders.map((o) => <PlantOrderRow key={o.id} order={o} onView={() => view(o)} />)
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  subtitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textMuted },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 10,
  },
  sectionEmpty: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginBottom: 8 },
});
