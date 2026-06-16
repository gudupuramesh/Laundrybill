import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fonts } from '../../theme';

interface StatusPillProps {
  label: string;
  color: string;
  bgColor: string;
  size?: 'sm' | 'md';
}

export function StatusPill({ label, color, bgColor, size = 'sm' }: StatusPillProps) {
  return (
    <View style={[
      styles.pill,
      { backgroundColor: bgColor },
      size === 'md' && styles.pillMd,
    ]}>
      <Text style={[
        styles.label,
        { color },
        size === 'md' && styles.labelMd,
      ]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  pillMd: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelMd: {
    fontSize: 12,
  },
});
