import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Modal, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../theme';

/** Shows the pickup/delivery proof photos attached to an order. Tap to view full-screen. */
export function ProofPhotosCard({
  pickupPhoto,
  deliveryPhoto,
}: {
  pickupPhoto?: string;
  deliveryPhoto?: string;
}) {
  const insets = useSafeAreaInsets();
  const [viewer, setViewer] = useState<string | null>(null);

  const photos = [
    pickupPhoto ? { label: 'Pickup', url: pickupPhoto } : null,
    deliveryPhoto ? { label: 'Delivery', url: deliveryPhoto } : null,
  ].filter(Boolean) as { label: string; url: string }[];

  if (photos.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Proof photos</Text>
      <View style={styles.row}>
        {photos.map((p) => (
          <TouchableOpacity
            key={p.label}
            style={styles.thumbWrap}
            onPress={() => setViewer(p.url)}
            activeOpacity={0.85}
          >
            <Image source={{ uri: p.url }} style={styles.thumb} />
            <Text style={styles.thumbLabel}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewer(null)}>
          {viewer ? <Image source={{ uri: viewer }} style={styles.viewerImage} resizeMode="contain" /> : null}
          <View style={[styles.closeBtn, { top: insets.top + 12 }]}>
            <MaterialIcons name="close" size={26} color="#fff" />
          </View>
        </Pressable>
      </Modal>
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
    marginBottom: 10,
  },
  row: { flexDirection: 'row', gap: 12 },
  thumbWrap: { alignItems: 'center', gap: 5 },
  thumb: { width: 96, height: 96, borderRadius: 14, backgroundColor: colors.surfaceMuted },
  thumbLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '92%', height: '80%' },
  closeBtn: { position: 'absolute', right: 18, width: 40, height: 40, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
});
