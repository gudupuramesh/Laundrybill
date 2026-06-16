import React from 'react';
import { View, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, radii } from '../theme';

/** Optional multi-photo picker (camera or library) holding local URIs; parent uploads on submit. */
export function DamagePhotos({
  value,
  onChange,
  max = 5,
}: {
  value: string[];
  onChange: (uris: string[]) => void;
  max?: number;
}) {
  const add = async (camera: boolean) => {
    try {
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Camera permission needed', 'Enable camera access to take a photo.');
          return;
        }
        const res = await ImagePicker.launchCameraAsync({ quality: 0.6 });
        if (!res.canceled && res.assets[0]) onChange([...value, res.assets[0].uri].slice(0, max));
      } else {
        const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, mediaTypes: ['images'] });
        if (!res.canceled && res.assets[0]) onChange([...value, res.assets[0].uri].slice(0, max));
      }
    } catch (e) {
      console.error('Damage photo pick failed:', e);
    }
  };

  const choose = () =>
    Alert.alert('Add photo', undefined, [
      { text: 'Take photo', onPress: () => add(true) },
      { text: 'Choose from library', onPress: () => add(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <View style={styles.row}>
      {value.map((uri, i) => (
        <View key={uri + i} style={styles.thumbWrap}>
          <Image source={{ uri }} style={styles.thumb} />
          <TouchableOpacity style={styles.removeBtn} onPress={() => onChange(value.filter((_, idx) => idx !== i))}>
            <MaterialIcons name="close" size={13} color="#fff" />
          </TouchableOpacity>
        </View>
      ))}
      {value.length < max && (
        <TouchableOpacity style={styles.addBox} onPress={choose} activeOpacity={0.8}>
          <MaterialIcons name="add-a-photo" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 64, height: 64, borderRadius: radii.input },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBox: {
    width: 64,
    height: 64,
    borderRadius: radii.input,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
