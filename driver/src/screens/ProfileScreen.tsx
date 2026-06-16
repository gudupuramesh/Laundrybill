import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../theme';
import { useDriverAuth } from '../lib/DriverAuthContext';
import { useDriverTasks } from '../hooks/use-driver-tasks';

function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || 'A';
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { agent, shopName, isOnline, goOnline, goOffline, signOutAgent } = useDriverAuth();
  const { lifetimeStats } = useDriverTasks();

  const vehicle = agent?.vehicle;
  const areas = agent?.serviceAreas || [];

  const confirmSignOut = () =>
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOutAgent },
    ]);

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(agent?.name || '')}</Text>
          </View>
          <Text style={styles.name}>{agent?.name || 'Agent'}</Text>
          <Text style={styles.shop}>{shopName || 'Shop'}</Text>
        </View>

        <View style={[styles.card, styles.rowBetween]}>
          <View style={styles.row}>
            <MaterialIcons name="circle" size={14} color={isOnline ? colors.success : colors.textMuted} />
            <Text style={styles.cardTitle}>Online status</Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={(v) => (v ? goOnline() : goOffline())}
            trackColor={{ true: colors.success, false: colors.border }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{lifetimeStats.pickupsCompleted}</Text>
            <Text style={styles.statLabel}>Pickups done</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{lifetimeStats.deliveriesCompleted}</Text>
            <Text style={styles.statLabel}>Deliveries done</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>
            <MaterialIcons name="two-wheeler" size={13} color={colors.textMuted} /> Vehicle
          </Text>
          <Text style={styles.value}>
            {vehicle?.type
              ? `${vehicle.type[0].toUpperCase()}${vehicle.type.slice(1)}${vehicle.number ? ` · ${vehicle.number}` : ''}`
              : 'Not set'}
          </Text>
        </View>

        {areas.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.label}>
              <MaterialIcons name="place" size={13} color={colors.textMuted} /> Service areas
            </Text>
            <View style={styles.chips}>
              {areas.map((a) => (
                <View key={a} style={styles.chip}>
                  <Text style={styles.chipText}>{a}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.label}>Account</Text>
          <Text style={styles.value}>{agent?.email || '—'}</Text>
        </View>

        <TouchableOpacity style={[styles.card, styles.rowBetween]} onPress={confirmSignOut} activeOpacity={0.8}>
          <View style={styles.row}>
            <MaterialIcons name="logout" size={18} color={colors.error} />
            <Text style={[styles.cardTitle, { color: colors.error }]}>Sign out</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={colors.error} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  head: { alignItems: 'center', marginBottom: 14 },
  avatar: { width: 70, height: 70, borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { fontFamily: fonts.bold, fontSize: 26, color: '#fff' },
  name: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  shop: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 11 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  label: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 6 },
  value: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 11 },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, padding: 14, alignItems: 'center' },
  statValue: { fontFamily: fonts.bold, fontSize: 22, color: colors.text },
  statLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radii.chip, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
});
