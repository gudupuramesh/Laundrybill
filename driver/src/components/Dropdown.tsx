import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../theme';

export interface DropdownOption {
  key: string;
  label: string;
  /** Optional online indicator dot (used for agents). */
  online?: boolean;
}

/** Compact dropdown that opens a scrollable picker — scales to long option lists. */
export function Dropdown({
  title,
  value,
  placeholder,
  options,
  onSelect,
}: {
  title: string;
  value: string;
  placeholder?: string;
  options: DropdownOption[];
  onSelect: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const selected = options.find((o) => o.key === value);

  return (
    <>
      <TouchableOpacity style={styles.field} onPress={() => setOpen(true)} activeOpacity={0.8}>
        {selected?.online !== undefined ? (
          <MaterialIcons
            name="circle"
            size={8}
            color={selected.online ? colors.success : colors.textMuted}
            style={{ marginRight: 8 }}
          />
        ) : null}
        <Text style={selected ? styles.value : styles.placeholder} numberOfLines={1}>
          {selected ? selected.label : placeholder || 'Select…'}
        </Text>
        <MaterialIcons name="arrow-drop-down" size={22} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{title}</Text>
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {options.map((o) => {
                const active = o.key === value;
                return (
                  <TouchableOpacity
                    key={o.key}
                    style={styles.row}
                    onPress={() => {
                      onSelect(o.key);
                      setOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    {o.online !== undefined ? (
                      <MaterialIcons name="circle" size={8} color={o.online ? colors.success : colors.textMuted} />
                    ) : null}
                    <Text style={[styles.rowText, active && styles.rowTextActive]} numberOfLines={1}>
                      {o.label}
                    </Text>
                    {active ? <MaterialIcons name="check" size={18} color={colors.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  value: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  placeholder: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.textMuted },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,30,54,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 10,
  },
  handle: { width: 40, height: 4, borderRadius: 99, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 13, borderRadius: radii.button },
  rowText: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  rowTextActive: { color: colors.primary },
});
