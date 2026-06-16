import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../../theme';
import { usePlantOrders, filterInbound } from '../../hooks/use-plant-orders';
import { PlantOrderRow } from '../../components/PlantOrderRow';
import { useDriverAuth } from '../../lib/DriverAuthContext';
import { useNav } from '../../lib/nav';
import { tsToMillis } from '../../lib/format-date';

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function PlantDashboardScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNav();
  const { agent } = useDriverAuth();

  const inboundRaw = usePlantOrders(['pickup_completed', 'pending']);
  const processing = usePlantOrders(['processing']);
  const ready = usePlantOrders(['ready', 'ready_for_pickup']);
  const dispatched = usePlantOrders(['out_for_delivery', 'delivered', 'picked_up']);

  const inbound = useMemo(() => filterInbound(inboundRaw.orders), [inboundRaw.orders]);
  const dispatchedToday = useMemo(() => {
    const start = startOfToday();
    return dispatched.orders.filter((o) => tsToMillis(o.updatedAt) >= start).length;
  }, [dispatched.orders]);

  const kpis = [
    { label: 'Inbound', value: inbound.length, color: colors.warning, bg: colors.warningBg, tab: 'plantInbound' as const },
    { label: 'Processing', value: processing.orders.length, color: colors.primary, bg: colors.primaryTint, tab: 'plantProcessing' as const },
    { label: 'Ready', value: ready.orders.length, color: colors.success, bg: colors.successBg, tab: 'plantReady' as const },
  ];

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 14, paddingBottom: insets.bottom + 100 }}>
        <Text style={styles.greeting}>Plant Dashboard</Text>
        <Text style={styles.sub}>Welcome back, {agent?.name || 'Operator'}</Text>

        {/* KPIs */}
        <View style={styles.kpiRow}>
          {kpis.map((k) => (
            <TouchableOpacity key={k.label} style={{ flex: 1 }} activeOpacity={0.85} onPress={() => nav.setTab(k.tab)}>
              <View style={[styles.kpiCard, { backgroundColor: k.bg }]}>
                <Text style={[styles.kpiValue, { color: k.color }]}>{k.value}</Text>
                <Text style={[styles.kpiLabel, { color: k.color }]}>{k.label}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity activeOpacity={0.85} onPress={() => nav.navigate({ name: 'plantCompleted' })}>
          <View style={styles.dispatchedCard}>
            <MaterialIcons name="local-shipping" size={20} color={colors.textSecondary} />
            <Text style={styles.dispatchedLabel}>Dispatched today</Text>
            <Text style={styles.dispatchedValue}>{dispatchedToday}</Text>
            <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
          </View>
        </TouchableOpacity>

        {/* Recent inbound */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>New Arrivals</Text>
          <TouchableOpacity onPress={() => nav.setTab('plantInbound')}>
            <Text style={styles.viewAll}>View all</Text>
          </TouchableOpacity>
        </View>
        {inbound.length === 0 ? (
          <Text style={styles.empty}>No pending orders</Text>
        ) : (
          inbound.slice(0, 5).map((o) => (
            <PlantOrderRow key={o.id} order={o} onView={() => nav.navigate({ name: 'plantOrderDetail', orderId: o.id })} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  greeting: { fontFamily: fonts.bold, fontSize: 22, color: colors.text },
  sub: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, marginTop: 2, marginBottom: 16 },
  kpiRow: { flexDirection: 'row', gap: 10 },
  kpiCard: { borderRadius: radii.card, paddingVertical: 16, alignItems: 'center', gap: 4 },
  kpiValue: { fontFamily: fonts.extrabold, fontSize: 26 },
  kpiLabel: { fontFamily: fonts.bold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  dispatchedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: 14,
    marginTop: 12,
  },
  dispatchedLabel: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  dispatchedValue: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  viewAll: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  empty: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, paddingVertical: 16, textAlign: 'center' },
});
