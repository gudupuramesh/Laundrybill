import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, fonts, radii, spacing } from '../../theme';

interface Filter {
  key: string;
  label: string;
}

interface FilterChipsProps {
  filters: Filter[];
  active: string;
  onChange: (key: string) => void;
}

export function FilterChips({ filters, active, onChange }: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {filters.map((f) => (
        <TouchableOpacity
          key={f.key}
          style={[styles.chip, active === f.key && styles.chipActive]}
          onPress={() => onChange(f.key)}
          activeOpacity={0.7}
        >
          <Text style={[styles.chipText, active === f.key && styles.chipTextActive]}>
            {f.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.chip,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.surface,
  },
});
