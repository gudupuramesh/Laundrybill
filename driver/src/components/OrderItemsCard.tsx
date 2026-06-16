import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radii } from '../theme';
import { useCurrency } from '../lib/currency';
import { getUnitLabel, isWeightUnit } from '../lib/country-config';
import { groupOrderItemsByCategory } from '../lib/order-item-groups';
import type { OrderItem } from '../types/order';

/** Itemised list grouped by service category (Iron, Wash & Fold, …) like the shop app. */
export function OrderItemsCard({ items }: { items: OrderItem[] }) {
  const { format: money } = useCurrency();
  if (!items || items.length === 0) return null;

  const groups = groupOrderItemsByCategory(
    items,
    (it) => it.categoryName || 'Others',
  );

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Items ({items.length})</Text>
      {groups.map((group) => (
        <View key={group.categoryName} style={styles.group}>
          <Text style={styles.groupHeader}>{group.categoryName}</Text>
          {group.items.map((it, i) => (
            <View key={it.id || `${it.serviceId}-${i}`} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{it.serviceName}</Text>
                <Text style={styles.sub}>
                  {money(it.unitPrice)}/{getUnitLabel(it.unit)}
                  {it.express ? ' · Express' : ''}
                </Text>
              </View>
              <Text style={styles.qty}>
                {isWeightUnit(it.unit) ? `${it.quantity} ${getUnitLabel(it.unit)}` : `×${it.quantity}`}
              </Text>
              <Text style={styles.total}>{money(it.total)}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 11,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 8,
  },
  group: { marginTop: 4 },
  groupHeader: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.primary,
    backgroundColor: colors.primaryTint,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 8,
    marginBottom: 4,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  name: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  sub: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  qty: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary, minWidth: 28, textAlign: 'right' },
  total: { fontFamily: fonts.bold, fontSize: 14, color: colors.text, minWidth: 64, textAlign: 'right' },
});
