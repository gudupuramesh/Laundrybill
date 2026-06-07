import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { fonts, colors, radii, spacing } from '../../theme';

interface StatsCardProps {
  label: string;
  value: string | number;
  color?: string;
  bgColor?: string;
  style?: ViewStyle;
}

export function StatsCard({ label, value, color, bgColor, style }: StatsCardProps) {
  return (
    <View style={[
      styles.card,
      bgColor ? { backgroundColor: bgColor } : undefined,
      style,
    ]}>
      <Text style={[styles.label, color ? { color } : undefined]}>{label}</Text>
      <Text style={[styles.value, color ? { color } : undefined]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.card,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    color: colors.text,
  },
});
