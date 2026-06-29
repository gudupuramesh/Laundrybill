import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../theme';
import { DetailHeader } from '../components/DetailHeader';
import { StatusPill } from '../components/ui/StatusPill';
import { Button } from '../components/ui/Button';
import { CompletePickupSheet } from '../components/CompletePickupSheet';
import { AgentEditOrderSheet } from '../components/AgentEditOrderSheet';
import { OrderItemsCard } from '../components/OrderItemsCard';
import { OrderSummaryCard } from '../components/OrderSummaryCard';
import { ProofPhotosCard } from '../components/ProofPhotosCard';
import { CollectPaymentSheet } from '../components/CollectPaymentSheet';
import { useDriverTasks } from '../hooks/use-driver-tasks';
import { useNav } from '../lib/nav';
import { callCustomer, navigateToAddress } from '../lib/actions';

export default function PickupDetailScreen({ orderId, onEditOrder }: { orderId: string; onEditOrder?: (order: any) => void }) {
  const insets = useSafeAreaInsets();
  const nav = useNav();
  const { pickupTasks } = useDriverTasks();
  const task = pickupTasks.find((t) => t.orderId === orderId);
  const [sheet, setSheet] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  if (!task) {
    return (
      <View style={styles.flex}>
        <DetailHeader title="Pickup" />
        <View style={styles.center}>
          <Text style={styles.muted}>This pickup is no longer available.</Text>
        </View>
      </View>
    );
  }

  const done = task.status === 'completed';

  return (
    <View style={styles.flex}>
      <DetailHeader title={`Pickup · ${task.orderPublicId}`} />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 90 }}>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.row}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primaryTint }]}>
                <MaterialIcons name="person" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.name}>{task.customer.name}</Text>
                <Text style={styles.sub}>{task.customer.phone || 'No phone'}</Text>
              </View>
            </View>
            {task.timeSlot?.start ? (
              <StatusPill label={task.timeSlot.start} color={colors.warning} bgColor={colors.warningBg} />
            ) : null}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Pickup address</Text>
          <Text style={styles.address}>{task.customer.address || 'No address provided'}</Text>
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
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.label}>Items expected</Text>
              <Text style={styles.bigValue}>{task.itemCount} pcs</Text>
            </View>
            {/* Items lock once the order is picked up / delivered. */}
            {!done ? (
              <Button label="Edit order" icon="edit" variant="tint" small onPress={() => onEditOrder ? onEditOrder(task.raw) : setEditOpen(true)} />
            ) : (
              <View style={styles.lockedChip}>
                <MaterialIcons name="lock" size={13} color={colors.textMuted} />
                <Text style={styles.lockedText}>Locked</Text>
              </View>
            )}
          </View>
        </View>

        <OrderItemsCard items={task.items} />

        <OrderSummaryCard task={task} />

        <ProofPhotosCard pickupPhoto={task.pickupPhoto} deliveryPhoto={task.deliveryPhoto} />

        {(task.financials?.balance ?? 0) > 0 ? (
          <Button
            label="Collect payment"
            icon="payments"
            variant="successTint"
            onPress={() => setPayOpen(true)}
          />
        ) : null}

        {done ? (
          <View style={styles.doneBox}>
            <MaterialIcons name="check-circle" size={20} color={colors.success} />
            <Text style={styles.doneText}>Pickup completed</Text>
          </View>
        ) : null}
      </ScrollView>

      {!done && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Button label="Complete pickup" icon="check-circle" onPress={() => setSheet(true)} />
        </View>
      )}

      <CompletePickupSheet
        open={sheet}
        onClose={() => setSheet(false)}
        task={task}
        onDone={() => {
          setSheet(false);
          nav.goBack();
        }}
      />
      <AgentEditOrderSheet open={editOpen && !done} onClose={() => setEditOpen(false)} task={task} onSaved={() => {}} />
      <CollectPaymentSheet
        open={payOpen}
        onClose={() => setPayOpen(false)}
        task={task}
        onDone={() => setPayOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textMuted },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 11 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconCircle: { width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  sub: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  label: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 5 },
  address: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text, marginBottom: 11 },
  bigValue: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  actions: { flexDirection: 'row', gap: 8 },
  lockedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lockedText: { fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted },
  doneBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.successBg, borderRadius: radii.card, padding: 14 },
  doneText: { fontFamily: fonts.bold, fontSize: 14, color: colors.success },
  footer: { paddingHorizontal: 14, paddingTop: 10, backgroundColor: colors.background },
});
