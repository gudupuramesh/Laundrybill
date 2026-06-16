import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { colors, fonts, radii } from '../../theme';

export function Field({
  label,
  dark,
  style,
  ...props
}: { label?: string; dark?: boolean } & TextInputProps) {
  return (
    <View style={style}>
      {label ? <Text style={[styles.label, dark && { color: '#7e90ab' }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={dark ? '#7e90ab' : colors.textMuted}
        style={[styles.input, dark && styles.inputDark]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 5,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
  },
  inputDark: {
    backgroundColor: '#1b2c46',
    borderColor: '#2a3c59',
    color: '#fff',
  },
});
