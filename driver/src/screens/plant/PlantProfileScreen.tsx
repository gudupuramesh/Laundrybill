import React from 'react';
import { View, Text, Switch, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../../theme';
import { useDriverAuth } from '../../lib/DriverAuthContext';
import { Button } from '../../components/ui/Button';

export default function PlantProfileScreen() {
  const insets = useSafeAreaInsets();
  const { agent, shopName, isOnline, goOnline, goOffline, signOutAgent } = useDriverAuth();
  const initial = (agent?.name || 'P').charAt(0).toUpperCase();

  const confirmSignOut = () =>
    Alert.alert('Sign out', 'Sign out of the Plant app?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOutAgent() },
    ]);

  return (
    <View style={[styles.flex, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.header}>Profile</Text>

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.name}>{agent?.name || 'Plant Operator'}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>Plant Operator</Text>
        </View>
        {shopName ? <Text style={styles.shop}>{shopName}</Text> : null}
        {agent?.email ? <Text style={styles.email}>{agent.email}</Text> : null}
      </View>

      <View style={styles.toggleCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleTitle}>Station {isOnline ? 'Active' : 'Offline'}</Text>
          <Text style={styles.toggleSub}>Show as available to receive work.</Text>
        </View>
        <Switch
          value={isOnline}
          onValueChange={(v) => (v ? goOnline() : goOffline())}
          trackColor={{ true: colors.success, false: colors.border }}
          thumbColor="#fff"
        />
      </View>

      <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
        <Button label="Sign out" variant="ghost" icon="logout" onPress={confirmSignOut} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: { fontFamily: fonts.bold, fontSize: 22, color: colors.text, paddingHorizontal: 16, marginBottom: 16 },
  card: {
    marginHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.darkBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 26, color: '#fff' },
  name: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginTop: 12 },
  roleBadge: { backgroundColor: colors.primaryTint, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  roleText: { fontFamily: fonts.bold, fontSize: 11, color: colors.primary },
  shop: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary, marginTop: 8 },
  email: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  toggleTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  toggleSub: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
