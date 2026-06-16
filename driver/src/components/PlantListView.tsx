import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../theme';
import { PlantOrderRow } from './PlantOrderRow';
import type { Order } from '../types/order';

/**
 * Header + search + scrollable list of plant orders with an optional per-row
 * action. Shared by Inbound / Processing / Ready queues. The action handler is
 * awaited and the row shows a spinner while it runs.
 */
export function PlantListView({
  title,
  subtitle,
  orders,
  loading,
  emptyMessage,
  actionLabel,
  actionVariant = 'primary',
  onAction,
  onView,
}: {
  title: string;
  subtitle?: string;
  orders: Order[];
  loading: boolean;
  emptyMessage: string;
  actionLabel?: string;
  actionVariant?: 'primary' | 'success' | 'tint' | 'successTint' | 'ghost';
  onAction?: (order: Order) => Promise<void> | void;
  onView: (order: Order) => void;
}) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter(
      (o) =>
        (o.orderNumber || '').toLowerCase().includes(term) ||
        (o.customerName || '').toLowerCase().includes(term),
    );
  }, [orders, q]);

  const handleAction = async (order: Order) => {
    if (!onAction) return;
    setBusyId(order.id);
    try {
      await onAction(order);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      <View style={styles.searchWrap}>
        <MaterialIcons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.search}
          value={q}
          onChangeText={setQ}
          placeholder="Search order # or name"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: insets.bottom + 100 }}
          renderItem={({ item }) => (
            <PlantOrderRow
              order={item}
              onView={() => onView(item)}
              actionLabel={actionLabel}
              actionVariant={actionVariant}
              actionLoading={busyId === item.id}
              onAction={onAction ? () => handleAction(item) : undefined}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="inbox" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>{q.trim() ? 'No orders match your search' : emptyMessage}</Text>
            </View>
          }
        />
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginTop: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
  },
  search: { flex: 1, paddingVertical: 10, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textMuted, textAlign: 'center' },
});
