import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fonts, radii } from '../../theme';

type Variant = 'primary' | 'success' | 'tint' | 'successTint' | 'ghost';

const BG: Record<Variant, string> = {
  primary: colors.primary,
  success: colors.success,
  tint: colors.primaryTint,
  successTint: colors.successBg,
  ghost: 'transparent',
};
const FG: Record<Variant, string> = {
  primary: '#fff',
  success: '#fff',
  tint: colors.primary,
  successTint: colors.success,
  ghost: colors.textSecondary,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
  small,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof MaterialIcons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  small?: boolean;
}) {
  const fg = FG[variant];
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        { backgroundColor: BG[variant] },
        small && styles.small,
        (disabled || loading) && { opacity: 0.6 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <MaterialIcons name={icon} size={small ? 16 : 18} color={fg} /> : null}
          <Text style={[styles.label, { color: fg }, small && { fontSize: 13 }]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radii.button,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: { paddingVertical: 9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  label: { fontFamily: fonts.bold, fontSize: 15 },
});
