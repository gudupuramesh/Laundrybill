import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { useNav } from '../lib/nav';

export function DetailHeader({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  const nav = useNav();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
      <TouchableOpacity onPress={() => nav.goBack()} hitSlop={10} style={styles.back}>
        <MaterialIcons name="arrow-back" size={22} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { padding: 4 },
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, flexShrink: 1 },
});
