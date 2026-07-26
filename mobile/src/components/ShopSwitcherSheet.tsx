/**
 * Shop switcher (multi-shop / Franchise) — pick which shop the app is showing.
 * Switching re-points the shared shopId and remounts the app tree, so every
 * screen (orders, customers, reports…) reloads against the chosen shop.
 */
import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fonts, radii } from '../theme';
import type { OwnedShop } from '../lib/activeShop';

export function ShopSwitcherSheet({
  open,
  onClose,
  shops,
  activeShopId,
  primaryShopId,
  canAdd,
  onSelect,
  onAddShop,
  onViewAll,
}: {
  open: boolean;
  onClose: () => void;
  shops: OwnedShop[];
  activeShopId: string;
  primaryShopId: string | null;
  canAdd: boolean;
  onSelect: (shopId: string) => void;
  onAddShop: () => void;
  onViewAll: () => void;
}) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.grabber} />
        <Text style={s.title}>Your shops</Text>

        <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
          {shops.map((shop) => {
            const active = shop.id === activeShopId;
            return (
              <TouchableOpacity
                key={shop.id}
                style={[s.row, active && s.rowActive]}
                activeOpacity={0.8}
                onPress={() => onSelect(shop.id)}
              >
                <View style={[s.icon, active && { backgroundColor: colors.primary }]}>
                  <MaterialIcons name="storefront" size={17} color={active ? '#fff' : colors.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.name} numberOfLines={1}>{shop.name}</Text>
                  {shop.id === primaryShopId ? <Text style={s.sub}>Main shop · billing</Text> : <Text style={s.sub}>Branch</Text>}
                </View>
                {active && <MaterialIcons name="check-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={s.divider} />

        <TouchableOpacity style={s.actionRow} activeOpacity={0.8} onPress={onViewAll}>
          <MaterialIcons name="dashboard" size={19} color={colors.textSecondary} />
          <Text style={s.actionText}>All shops overview</Text>
          <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {canAdd && (
          <TouchableOpacity style={s.actionRow} activeOpacity={0.8} onPress={onAddShop}>
            <MaterialIcons name="add-business" size={19} color={colors.textSecondary} />
            <Text style={s.actionText}>Add a branch</Text>
            <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={s.close} onPress={onClose} activeOpacity={0.8}>
          <Text style={s.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 26,
  },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 999, backgroundColor: colors.border, marginBottom: 12 },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, marginBottom: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, paddingHorizontal: 11,
    borderRadius: radii.input, borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  rowActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  icon: {
    width: 34, height: 34, borderRadius: 11, backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  sub: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12 },
  actionText: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  close: {
    marginTop: 8, backgroundColor: colors.surfaceMuted, borderRadius: radii.input,
    paddingVertical: 13, alignItems: 'center',
  },
  closeText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.textSecondary },
});
