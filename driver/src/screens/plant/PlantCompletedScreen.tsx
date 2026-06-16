import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../../theme';
import { firestore } from '../../lib/firebase';
import { useDriverAuth } from '../../lib/DriverAuthContext';
import { PlantOrderRow } from '../../components/PlantOrderRow';
import { DetailHeader } from '../../components/DetailHeader';
import { useNav } from '../../lib/nav';
import { tsToMillis } from '../../lib/format-date';
import type { Order } from '../../types/order';

type TimeKey = 'today' | 'week' | 'month' | 'all';
type TypeKey = 'all' | 'pickup_store' | 'delivery_home' | 'pickup_home';

const TIME_FILTERS: { key: TimeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: '7 days' },
  { key: 'month', label: '30 days' },
  { key: 'all', label: 'All' },
];
const TYPE_FILTERS: { key: TypeKey; label: string }[] = [
  { key: 'all', label: 'All types' },
  { key: 'pickup_store', label: 'Shop Pickup' },
  { key: 'delivery_home', label: 'Home Delivery' },
  { key: 'pickup_home', label: 'Pickup & Delivery' },
];
const PAGE = 20;

function timeFloor(key: TimeKey): number {
  if (key === 'all') return 0;
  const d = new Date();
  if (key === 'today') {
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  return Date.now() - (key === 'week' ? 7 : 30) * 24 * 60 * 60 * 1000;
}

export default function PlantCompletedScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNav();
  const { shopId } = useDriverAuth();
  const [all, setAll] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState<TimeKey>('week');
  const [type, setType] = useState<TypeKey>('all');
  const [visible, setVisible] = useState(PAGE);

  // One-shot bounded fetch (history doesn't need a live listener).
  useEffect(() => {
    if (!shopId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await firestore()
          .collection(`shops/${shopId}/orders`)
          .where('status', 'in', ['delivered', 'picked_up'])
          .get();
        if (cancelled) return;
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as object) }) as Order)
          .sort((a, b) => tsToMillis(b.updatedAt) - tsToMillis(a.updatedAt));
        setAll(list);
      } catch (e) {
        console.error('Completed fetch error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopId]);

  const filtered = useMemo(() => {
    const floor = timeFloor(time);
    return all.filter((o) => {
      if (floor && tsToMillis(o.updatedAt) < floor) return false;
      if (type !== 'all' && o.deliveryType !== type) return false;
      return true;
    });
  }, [all, time, type]);

  const stats = useMemo(
    () => ({
      total: filtered.length,
      shop: filtered.filter((o) => o.deliveryType === 'pickup_store').length,
      home: filtered.filter((o) => o.deliveryType === 'delivery_home').length,
      pud: filtered.filter((o) => o.deliveryType === 'pickup_home').length,
    }),
    [filtered],
  );

  // Reset paging when filters change.
  useEffect(() => setVisible(PAGE), [time, type]);
  const shown = filtered.slice(0, visible);

  return (
    <View style={styles.flex}>
      <DetailHeader title="Completed" />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={
            <View>
              {/* Stats */}
              <View style={styles.statsRow}>
                <Stat label="Total" value={stats.total} color={colors.primary} />
                <Stat label="Shop" value={stats.shop} color={colors.text} />
                <Stat label="Delivery" value={stats.home} color={colors.success} />
                <Stat label="P&D" value={stats.pud} color={colors.warning} />
              </View>
              {/* Time filter */}
              <View style={styles.chipRow}>
                {TIME_FILTERS.map((f) => (
                  <Chip key={f.key} label={f.label} active={time === f.key} onPress={() => setTime(f.key)} />
                ))}
              </View>
              {/* Type filter */}
              <View style={[styles.chipRow, { marginBottom: 6 }]}>
                {TYPE_FILTERS.map((f) => (
                  <Chip key={f.key} label={f.label} active={type === f.key} onPress={() => setType(f.key)} small />
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <PlantOrderRow order={item} onView={() => nav.navigate({ name: 'plantOrderDetail', orderId: item.id })} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="check-circle" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No completed orders in this range</Text>
            </View>
          }
          ListFooterComponent={
            filtered.length > visible ? (
              <TouchableOpacity style={styles.loadMore} onPress={() => setVisible((v) => v + PAGE)}>
                <Text style={styles.loadMoreText}>Load more ({filtered.length - visible})</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Chip({ label, active, onPress, small }: { label: string; active: boolean; onPress: () => void; small?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive, small && styles.chipSmall]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statValue: { fontFamily: fonts.extrabold, fontSize: 18 },
  statLabel: { fontFamily: fonts.semibold, fontSize: 10, color: colors.textMuted, marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.chip,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSmall: { paddingHorizontal: 11, paddingVertical: 6 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary },
  chipTextActive: { color: '#fff' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textMuted },
  loadMore: {
    marginTop: 6,
    paddingVertical: 12,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  loadMoreText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
});
