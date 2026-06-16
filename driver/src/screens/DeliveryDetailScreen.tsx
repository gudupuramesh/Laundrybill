import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../theme';
import { DetailHeader } from '../components/DetailHeader';
import { StatusPill } from '../components/ui/StatusPill';
import { Button } from '../components/ui/Button';
import { CompleteDeliverySheet } from '../components/CompleteDeliverySheet';
import { OrderItemsCard } from '../components/OrderItemsCard';
import { OrderSummaryCard } from '../components/OrderSummaryCard';
import { ProofPhotosCard } from '../components/ProofPhotosCard';
import { useDriverTasks } from '../hooks/use-driver-tasks';
import { useNav } from '../lib/nav';
import { callCustomer, navigateToAddress } from '../lib/actions';
import { useCurrency } from '../lib/currency';

const PAY_PILL: Record<string, { label: string; color: string }> = {
  paid: { label: 'Paid', color: colors.success },
  partial: { label: 'Partial', color: colors.warning },
  unpaid: { label: 'Unpaid', color: colors.warning },
};

export default function DeliveryDetailScreen({ orderId }: { orderId: string }) {
  const insets = useSafeAreaInsets();
  const nav = useNav();
  const { deliveryTasks } = useDriverTasks();
  const { format: money } = useCurrency();
  const task = deliveryTasks.find((t) => t.orderId === orderId);
  const [sheet, setSheet] = useState(false);

  if (!task) {
    return (
      <View style={styles.flex}>
        <DetailHeader title="Delivery" />
        <View style={styles.center}>
          <Text style={styles.muted}>This delivery is no longer available.</Text>
        </View>
      </View>
    );
  }

  const done = task.status === 'completed';
  const due = task.amountToCollect || 0;
  const pay = PAY_PILL[task.paymentStatus || 'unpaid'] || PAY_PILL.unpaid;

  return (
    <View style={styles.flex}>
      <DetailHeader title={`Deliver · ${task.orderPublicId}`} />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 90 }}>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: colors.inProgressBg }]}>
              <MaterialIcons name="person" size={18} color={colors.inProgress} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{task.customer.name}</Text>
              <Text style={styles.sub} numberOfLines={1}>
                {task.customer.address || 'No address'}
              </Text>
            </View>
          </View>
        </View>

        {due > 0 && (
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Amount to collect</Text>
            <View style={styles.amountRow}>
              <Text style={styles.amountValue}>{money(due)}</Text>
              <StatusPill label={pay.label} color={pay.color} bgColor="rgba(245,158,11,0.18)" />
            </View>
            <Text style={styles.amountMeta}>
              Order total {money(task.orderTotal)} · Paid {money(task.previouslyPaid)}
            </Text>
          </View>
        )}

        <OrderItemsCard items={task.items} />

        <OrderSummaryCard task={task} />

        <ProofPhotosCard pickupPhoto={task.pickupPhoto} deliveryPhoto={task.deliveryPhoto} />

        <View style={styles.actions}>
          <Button
            label="Call"
            icon="call"
            variant="successTint"
            style={{ flex: 1 }}
            onPress={() => callCustomer(task.customer.phone)}
          />
          <Button
            label="Navigate"
            icon="navigation"
            variant="tint"
            style={{ flex: 1 }}
            onPress={() => navigateToAddress(task.customer.address)}
          />
        </View>

        {done ? (
          <View style={styles.doneBox}>
            <MaterialIcons name="check-circle" size={20} color={colors.success} />
            <Text style={styles.doneText}>Delivered</Text>
          </View>
        ) : null}
      </ScrollView>

      {!done && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Button label="Collect & complete" icon="payments" variant="success" onPress={() => setSheet(true)} />
        </View>
      )}

      <CompleteDeliverySheet
        open={sheet}
        onClose={() => setSheet(false)}
        task={task}
        onDone={() => {
          setSheet(false);
          nav.goBack();
        }}
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
  amountBox: { backgroundColor: colors.darkBlue, borderRadius: radii.card, padding: 14, marginBottom: 11 },
  amountLabel: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#9fb0c9', marginBottom: 4 },
  amountRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  amountValue: { fontFamily: fonts.bold, fontSize: 28, color: '#fff' },
  amountMeta: { fontFamily: fonts.semibold, fontSize: 11, color: '#7e90ab', marginTop: 5 },
  label: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  bigValue: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 11 },
  doneBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.successBg, borderRadius: radii.card, padding: 14 },
  doneText: { fontFamily: fonts.bold, fontSize: 14, color: colors.success },
  footer: { paddingHorizontal: 14, paddingTop: 10, backgroundColor: colors.background },
});
