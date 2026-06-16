import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fonts, radii } from '../theme';
import { BottomSheet } from './BottomSheet';
import { PhotoCapture } from './PhotoCapture';
import { Button } from './ui/Button';
import { useCompleteDelivery, type DriverTask } from '../hooks/use-driver-tasks';
import { useDriverAuth } from '../lib/DriverAuthContext';
import { uploadImageToR2 } from '../lib/uploadR2';
import { useCurrency } from '../lib/currency';

type Method = 'cash' | 'upi' | 'paid_already';

const METHODS: { key: Method; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'cash', label: 'Cash', icon: 'payments' },
  { key: 'upi', label: 'UPI', icon: 'qr-code' },
  { key: 'paid_already', label: 'Paid', icon: 'check' },
];

export function CompleteDeliverySheet({
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
  const { shopId } = useDriverAuth();
  const { completeDelivery, loading } = useCompleteDelivery();
  const { format: money } = useCurrency();

  const [method, setMethod] = useState<Method>(task.paymentStatus === 'paid' ? 'paid_already' : 'cash');
  const [amount, setAmount] = useState(String(task.amountToCollect || 0));
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const amountRequired = method !== 'paid_already' && (task.amountToCollect || 0) > 0;

  const submit = async () => {
    setSubmitting(true);
    try {
      let photoUrl: string | undefined;
      if (photoUri && shopId) {
        const { publicUrl } = await uploadImageToR2(shopId, photoUri, 'delivery-photos');
        photoUrl = publicUrl;
      }
      await completeDelivery(
        task.orderId,
        {
          collectedAmount: method === 'paid_already' ? 0 : Number(amount) || 0,
          paymentMethod: method,
          notes: notes || undefined,
          photoUrl,
        },
        task.orderTotal,
        task.previouslyPaid,
      );
      onDone();
    } catch (e) {
      console.error('Complete delivery failed:', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Complete delivery"
      footer={
        <Button
          label="Mark delivered"
          icon="check-circle"
          variant="success"
          onPress={submit}
          loading={loading || submitting}
        />
      }
    >
      {(task.amountToCollect || 0) > 0 && (
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Amount to collect</Text>
          <Text style={styles.amountValue}>{money(task.amountToCollect)}</Text>
        </View>
      )}

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
          <Text style={styles.label}>Amount collected</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
            style={styles.input}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
          />
        </>
      )}

      <Text style={styles.label}>Delivery photo (optional)</Text>
      <View style={{ marginBottom: 16 }}>
        <PhotoCapture uri={photoUri} onPick={setPhotoUri} label="Tap to add a photo of the handover" />
      </View>

      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        style={[styles.input, styles.area]}
        multiline
        placeholder="Any issues or notes about the delivery…"
        placeholderTextColor={colors.textMuted}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  amountBox: { backgroundColor: colors.darkBlue, borderRadius: radii.card, padding: 14, marginBottom: 16 },
  amountLabel: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: '#9fb0c9' },
  amountValue: { fontFamily: fonts.bold, fontSize: 26, color: '#fff', marginTop: 2 },
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
  area: { minHeight: 70, textAlignVertical: 'top' },
});
