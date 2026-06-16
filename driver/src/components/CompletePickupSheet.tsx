import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { colors, fonts, radii } from '../theme';
import { BottomSheet } from './BottomSheet';
import { PhotoCapture } from './PhotoCapture';
import { Button } from './ui/Button';
import { useCompletePickup, type DriverTask } from '../hooks/use-driver-tasks';
import { useDriverAuth } from '../lib/DriverAuthContext';
import { uploadImageToR2 } from '../lib/uploadR2';

export function CompletePickupSheet({
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
  const { completePickup, loading } = useCompletePickup();
  const [items, setItems] = useState(String(task.itemCount || 0));
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      let photoUrl: string | undefined;
      if (photoUri && shopId) {
        const { publicUrl } = await uploadImageToR2(shopId, photoUri, 'pickup-photos');
        photoUrl = publicUrl;
      }
      await completePickup(task.orderId, {
        itemsCollected: Number(items) || 0,
        photoUrl,
        notes: notes || undefined,
      });
      onDone();
    } catch (e) {
      console.error('Complete pickup failed:', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Complete pickup"
      footer={
        <Button
          label="Confirm pickup"
          icon="check-circle"
          onPress={submit}
          loading={loading || submitting}
        />
      }
    >
      <Text style={styles.label}>Items collected</Text>
      <TextInput
        value={items}
        onChangeText={setItems}
        keyboardType="number-pad"
        style={styles.input}
        placeholder="0"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>Pickup photo (optional)</Text>
      <View style={{ marginBottom: 16 }}>
        <PhotoCapture uri={photoUri} onPick={setPhotoUri} label="Tap to add a photo of the bag" />
      </View>

      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        style={[styles.input, styles.area]}
        multiline
        placeholder="Any issues collecting the items…"
        placeholderTextColor={colors.textMuted}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 6,
  },
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
