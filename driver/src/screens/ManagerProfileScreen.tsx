import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../theme';
import { TutorialVideosSheet } from '../components/HelpButton';

type Row = { key: string; label: string; icon: keyof typeof MaterialIcons.glyphMap; onPress: () => void };

/**
 * The manager's Profile — a settings menu mirroring the owner Settings (minus
 * shop-account deletion, billing, and shop profile). Each row opens a ported
 * owner screen as an overlay; Tutorial Videos opens the shared sheet locally.
 */
export default function ManagerProfileScreen({
  name, shopName, onSignOut,
  onManageExpenses, onManageStaff, onMarkAttendance, onManageService,
  onManageItems, onTaxSettings, onServiceArea,
}: {
  name?: string;
  shopName?: string | null;
  onSignOut: () => void;
  onManageExpenses: () => void;
  onManageStaff: () => void;
  onMarkAttendance: () => void;
  onManageService: () => void;
  onManageItems: () => void;
  onTaxSettings: () => void;
  onServiceArea: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [showTutorials, setShowTutorials] = useState(false);

  const rows: Row[] = [
    { key: 'expenses', label: 'Manage Expenses', icon: 'account-balance-wallet', onPress: onManageExpenses },
    { key: 'staff', label: 'Manage Staff', icon: 'groups', onPress: onManageStaff },
    { key: 'attendance', label: 'Mark Attendance', icon: 'how-to-reg', onPress: onMarkAttendance },
    { key: 'service', label: 'Manage Service', icon: 'design-services', onPress: onManageService },
    { key: 'items', label: 'Manage Items', icon: 'inventory-2', onPress: onManageItems },
    { key: 'taxDetail', label: 'Tax Detail', icon: 'request-quote', onPress: onTaxSettings },
    { key: 'chargeTax', label: 'Charge Tax', icon: 'percent', onPress: onTaxSettings },
    { key: 'tutorials', label: 'Tutorial Videos', icon: 'ondemand-video', onPress: () => setShowTutorials(true) },
    { key: 'serviceArea', label: 'Service Area', icon: 'map', onPress: onServiceArea },
  ];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Profile</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={s.idCard}>
          <View style={s.avatar}><MaterialIcons name="person" size={30} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.idName}>{name || 'Manager'}</Text>
            <Text style={s.idRole}>Manager{shopName ? ` · ${shopName}` : ''}</Text>
          </View>
        </View>

        <View style={s.menu}>
          {rows.map((r, i) => (
            <TouchableOpacity key={r.key} style={[s.row, i < rows.length - 1 && s.rowBorder]} activeOpacity={0.7} onPress={r.onPress}>
              <View style={s.rowIcon}><MaterialIcons name={r.icon} size={20} color={colors.primary} /></View>
              <Text style={s.rowLabel}>{r.label}</Text>
              <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={s.signOut} activeOpacity={0.85} onPress={onSignOut}>
          <MaterialIcons name="logout" size={18} color={colors.error} />
          <Text style={s.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>

      <TutorialVideosSheet visible={showTutorials} onClose={() => setShowTutorials(false)} allMode />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 16, paddingTop: 0, paddingBottom: 10,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 20, fontFamily: fonts.bold, color: colors.text },
  idCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface,
    margin: 16, marginBottom: 12, padding: 16, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  idName: { fontSize: 17, fontFamily: fonts.bold, color: colors.text },
  idRole: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 2 },
  menu: {
    backgroundColor: colors.surface, marginHorizontal: 16, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: fonts.semibold, color: colors.text },
  signOut: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    margin: 16, marginTop: 20, paddingVertical: 14, borderRadius: radii.button, borderWidth: 1, borderColor: colors.error,
  },
  signOutText: { fontSize: 15, fontFamily: fonts.bold, color: colors.error },
});
