import React, { useState } from 'react';
import { View, Text, Image, ScrollView, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { colors, fonts, radii } from '../theme';
import { firestore } from '../lib/firebase';
import { useDriverAuth } from '../lib/DriverAuthContext';
import { uploadImageToR2 } from '../lib/uploadR2';
import { PhotoCapture } from './PhotoCapture';
import type { Order } from '../types/order';

/**
 * Plant damage / processing photos for an order. Captures a photo, uploads to
 * R2, then appends the URL to the order's `damagePhotoUrls` (and sets the latest
 * as `plantPhoto`) with a timeline note. Existing photos render as thumbnails.
 */
export function PlantPhotosCard({ order }: { order: Order }) {
  const { shopId, agent } = useDriverAuth();
  const [uploading, setUploading] = useState(false);
  const existing = order.damagePhotoUrls || [];

  const onPick = async (uri: string | null) => {
    if (!uri || !shopId) return;
    setUploading(true);
    try {
      const { publicUrl } = await uploadImageToR2(shopId, uri, 'plant-photos');
      const timelineEvent = {
        id: `t-${Date.now()}`,
        status: order.status,
        timestamp: firestore.Timestamp.now(),
        staffId: agent?.id || 'plant',
        staffName: agent?.name || 'Plant',
        notes: 'Damage / processing photo added at plant',
        notifiedCustomer: false,
      };
      await firestore().doc(`shops/${shopId}/orders/${order.id}`).update({
        damagePhotoUrls: firestore.FieldValue.arrayUnion(publicUrl),
        plantPhoto: publicUrl,
        timeline: firestore.FieldValue.arrayUnion(timelineEvent),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      Alert.alert('Upload failed', 'Could not add the photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Damage / processing photos{existing.length ? ` (${existing.length})` : ''}</Text>

      {existing.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
          {existing.map((url, i) => (
            <Image key={url + i} source={{ uri: url }} style={styles.thumb} />
          ))}
        </ScrollView>
      )}

      {uploading ? (
        <View style={styles.uploading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.uploadingText}>Uploading…</Text>
        </View>
      ) : (
        <PhotoCapture uri={null} onPick={onPick} label="Add a damage or processing photo" />
      )}
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
  thumbRow: { marginBottom: 12 },
  thumb: { width: 72, height: 72, borderRadius: radii.input, marginRight: 8 },
  uploading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  uploadingText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
});
