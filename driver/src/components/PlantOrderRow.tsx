import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fonts, radii } from '../theme';
import { Button } from './ui/Button';
import { formatDateTime } from '../lib/format-date';
import { DELIVERY_TYPE_LABELS } from '../types/order';
import type { Order } from '../types/order';

/** One order row in a plant queue (Inbound / Processing / Ready). */
export function PlantOrderRow({
  order,
  onView,
  actionLabel,
  actionVariant = 'primary',
  onAction,
  actionLoading,
}: {
  order: Order;
  onView: () => void;
  actionLabel?: string;
  actionVariant?: 'primary' | 'success' | 'tint' | 'successTint' | 'ghost';
  onAction?: () => void;
  actionLoading?: boolean;
}) {
  const itemCount = order.items?.length || 0;
  const dtLabel = DELIVERY_TYPE_LABELS[order.deliveryType] || '';
  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.top} activeOpacity={0.7} onPress={onView}>
        <View style={styles.iconTile}>
          <MaterialIcons name="inventory-2" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.orderNo} numberOfLines={1}>
              {order.orderNumber || order.publicId}
            </Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
            </View>
          </View>
          <Text style={styles.sub} numberOfLines={1}>
            {order.customerName || 'Customer'}{dtLabel ? ` · ${dtLabel}` : ''}
          </Text>
          <Text style={styles.time}>{formatDateTime(order.createdAt)}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
      </TouchableOpacity>

      {actionLabel && onAction ? (
        <View style={styles.actionRow}>
          <Button label="View" variant="ghost" small icon="visibility" onPress={onView} style={styles.viewBtn} />
          <Button
            label={actionLabel}
            variant={actionVariant}
            small
            loading={actionLoading}
            onPress={onAction}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 11,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderNo: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, flexShrink: 1 },
  countBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.badge,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countText: { fontFamily: fonts.bold, fontSize: 10, color: colors.textSecondary },
  sub: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  time: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  viewBtn: { paddingHorizontal: 12 },
});
