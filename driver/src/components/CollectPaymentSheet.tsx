import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fonts, radii } from '../theme';
import { BottomSheet } from './BottomSheet';
import { Button } from './ui/Button';
import { useCollectPayment, type DriverTask } from '../hooks/use-driver-tasks';
import { useCurrency } from '../lib/currency';

type Method = 'cash' | 'upi' | 'paid_already';

const METHODS: { key: Method; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'cash', label: 'Cash', icon: 'payments' },
  { key: 'upi', label: 'UPI', icon: 'qr-code' },
  { key: 'paid_already', label: 'Paid', icon: 'check' },
];

export function CollectPaymentSheet({
  open,
  onClose,
  task,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  task: DriverTask;
  onDone: () => void;
}) {
  const { collectPayment, loading } = useCollectPayment();
  const { format: money } = useCurrency();

  const orderTotal = task.orderTotal ?? task.financials?.total ?? 0;
  const previouslyPaid = task.previouslyPaid ?? task.financials?.amountPaid ?? 0;
  const due = task.amountToCollect ?? task.financials?.balance ?? Math.max(0, orderTotal - previouslyPaid);
  const [method, setMethod] = useState<Method>('cash');
  const [amount, setAmount] = useState(String(due));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const amountRequired = method !== 'paid_already';

  const submit = async () => {
    setSubmitting(true);
    try {
      await collectPayment(
        task.orderId,
        {
          amount: method === 'paid_already' ? 0 : Number(amount) || 0,
          method,
          notes: notes || undefined,
          currentStatus: task.orderStatus,
        },
        orderTotal,
        previouslyPaid,
      );
      onDone();
    } catch (e) {
      console.error('Collect payment failed:', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Collect payment"
      footer={
        <Button label="Record payment" icon="check-circle" onPress={submit} loading={loading || submitting} />
      }
    >
      <View style={styles.amountBox}>
        <Text style={styles.amountLabel}>Balance due</Text>
        <Text style={styles.amountValue}>{money(due)}</Text>
        <Text style={styles.amountMeta}>
          Order total {money(orderTotal)} · Paid {money(previouslyPaid)}
        </Text>
      </View>

      <Text style={styles.label}>Payment method</Text>
      <View style={styles.methods}>
        {METHODS.map((m) => {
          const active = method === m.key;
          return (
            <TouchableOpacity
              key={m.key}
              style={[styles.method, active && styles.methodActive]}
              onPress={() => setMethod(m.key)}
              activeOpacity={0.8}
            >
              <MaterialIcons name={m.icon} size={16} color={active ? colors.primary : colors.textSecondary} />
              <Text style={[styles.methodText, active && { color: colors.primary }]}>{m.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {amountRequired && (
        <>
          <Text style={styles.label}>Amount received</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            style={styles.input}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
          />
        </>
      )}

      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        style={[styles.input, styles.area]}
        multiline
        placeholder="e.g. paid in advance, partial payment…"
        placeholderTextColor={colors.textMuted}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  amountBox: { backgroundColor: colors.darkBlue, borderRadius: radii.card, padding: 14, marginBottom: 16 },
  amountLabel: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#9fb0c9' },
  amountValue: { fontFamily: fonts.bold, fontSize: 26, color: '#fff', marginTop: 2 },
  amountMeta: { fontFamily: fonts.semibold, fontSize: 11, color: '#7e90ab', marginTop: 5 },
  label: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6 },
  methods: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  method: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radii.chip,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  methodActive: { backgroundColor: colors.primaryTint, borderColor: 'transparent' },
  methodText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
    marginBottom: 16,
  },
  area: { minHeight: 64, textAlignVertical: 'top' },
});
