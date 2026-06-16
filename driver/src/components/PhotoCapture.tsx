import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts } from '../theme';

/**
 * Tap-to-capture proof photo. Offers camera or library, returns a local URI to
 * the parent (which uploads it to R2 on submit). Keeps quality modest to keep
 * uploads small on weak networks.
 */
export function PhotoCapture({
  uri,
  onPick,
  label = 'Tap to add a photo',
}: {
  uri: string | null;
  onPick: (uri: string | null) => void;
  label?: string;
}) {
  const pick = async (camera: boolean) => {
    try {
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Camera permission needed', 'Enable camera access to take a photo.');
          return;
        }
        const res = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: false });
        if (!res.canceled && res.assets[0]) onPick(res.assets[0].uri);
      } else {
        const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsEditing: false });
        if (!res.canceled && res.assets[0]) onPick(res.assets[0].uri);
      }
    } catch (e) {
      console.error('Photo pick failed:', e);
    }
  };

  const choose = () =>
    Alert.alert('Add photo', undefined, [
      { text: 'Take photo', onPress: () => pick(true) },
      { text: 'Choose from library', onPress: () => pick(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  if (uri) {
    return (
      <TouchableOpacity style={styles.row} onPress={choose} activeOpacity={0.85}>
        <Image source={{ uri }} style={styles.thumb} />
        <View style={{ flex: 1 }}>
          <Text style={styles.changeText}>Photo added</Text>
          <Text style={styles.subText}>Tap to retake or change</Text>
        </View>
        <MaterialIcons name="check-circle" size={22} color={colors.success} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.row} onPress={choose} activeOpacity={0.85}>
      <View style={styles.empty}>
        <MaterialIcons name="photo-camera" size={22} color={colors.textMuted} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  empty: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: { width: 64, height: 64, borderRadius: 14 },
  label: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary, flex: 1 },
  changeText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  subText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
});
