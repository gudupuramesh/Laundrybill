import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fonts, radii } from '../theme';
import { StatusPill } from './ui/StatusPill';
import { Button } from './ui/Button';
import { useCurrency } from '../lib/currency';
import { callCustomer, navigateToAddress } from '../lib/actions';
import type { DriverTask } from '../hooks/use-driver-tasks';

function pill(
  task: DriverTask,
  money: (n?: number | null) => string,
): { label: string; color: string; bg: string } {
  if (task.type === 'pickup') {
    if (task.status === 'completed') return { label: 'Picked up', color: colors.success, bg: colors.successBg };
    if (task.timeSlot?.start) return { label: task.timeSlot.start, color: colors.warning, bg: colors.warningBg };
    return { label: 'Scheduled', color: colors.warning, bg: colors.warningBg };
  }
  if (task.status === 'completed') return { label: 'Delivered', color: colors.success, bg: colors.successBg };
  if ((task.amountToCollect || 0) > 0)
    return { label: `${money(task.amountToCollect)} due`, color: colors.error, bg: colors.errorBg };
  return { label: 'Ready', color: colors.warning, bg: colors.warningBg };
}

export function TaskCard({ task, onPress }: { task: DriverTask; onPress: () => void }) {
  const { format: money } = useCurrency();
  const isPickup = task.type === 'pickup';
  const accent = task.status === 'completed' ? colors.success : isPickup ? colors.primary : colors.inProgress;
  const p = pill(task, money);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.card}>
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={styles.headerRow}>
        <View style={styles.idRow}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: isPickup ? colors.primaryTint : colors.inProgressBg },
            ]}
          >
            <MaterialIcons
              name={isPickup ? 'arrow-upward' : 'arrow-downward'}
              size={18}
              color={isPickup ? colors.primary : colors.inProgress}
            />
          </View>
          <View>
            <Text style={styles.title}>
              {isPickup ? 'Pickup' : 'Deliver'} · {task.orderPublicId}
            </Text>
            <Text style={styles.customer}>{task.customer.name}</Text>
          </View>
        </View>
        <StatusPill label={p.label} color={p.color} bgColor={p.bg} />
      </View>

      <View style={styles.addrRow}>
        <MaterialIcons name="place" size={14} color={colors.textMuted} />
        <Text style={styles.addr} numberOfLines={1}>
          {task.customer.address || 'No address'} · {task.itemCount} items
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          label="Call"
          icon="call"
          variant="successTint"
          small
          style={{ flex: 1 }}
          onPress={() => callCustomer(task.customer.phone)}
        />
        <Button
          label="Navigate"
          icon="navigation"
          variant="tint"
          small
          style={{ flex: 1 }}
          onPress={() => navigateToAddress(task.customer.address)}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 13,
    paddingLeft: 18,
    marginBottom: 10,
    overflow: 'hidden',
  },
  accent: { position: 'absolute', left: 0, top: 12, bottom: 12, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  iconCircle: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  customer: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  addr: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
  actions: { flexDirection: 'row', gap: 8 },
});
