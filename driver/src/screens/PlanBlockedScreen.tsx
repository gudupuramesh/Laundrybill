/**
 * Full-screen block shown to a team login whose shop plan no longer covers it:
 *  - expired  → the shop dropped to a plan without team app access (Free/Pro or
 *               a lapsed subscription): every team login is blocked.
 *  - over_cap → the plan includes team logins but the shop has more logins than
 *               the plan's total cap (e.g. Business 15 → Pro+ 4); this login is
 *               outside the oldest-N that keep working.
 * Only the shop OWNER can fix either case (renew/upgrade or delete extra logins),
 * so the only action here is Sign out.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../theme';
import { useDriverAuth } from '../lib/DriverAuthContext';
import type { TeamAccess } from '../lib/planAccess';

export default function PlanBlockedScreen({ access }: { access: Exclude<TeamAccess, { state: 'ok' }> }) {
  const insets = useSafeAreaInsets();
  const { shopName, signOutAgent } = useDriverAuth();
  const shop = shopName || 'Your shop';

  const title = access.state === 'expired' ? 'Shop plan expired' : 'Login limit reached';
  const message =
    access.state === 'expired'
      ? `${shop}'s subscription no longer includes team app access. Ask your shop owner to renew or upgrade to the Pro+ or Business plan to continue.`
      : `${shop}'s current plan allows ${access.cap} team login${access.cap === 1 ? '' : 's'} and this login is outside that limit. Ask your shop owner to upgrade the plan or free up a login slot.`;

  const confirmSignOut = () =>
    Alert.alert('Sign out', 'Sign out of this account?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOutAgent() },
    ]);

  return (
    <View style={[s.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.body}>
        <View style={s.iconWrap}>
          <MaterialIcons name="lock" size={40} color={colors.warning} />
        </View>
        <Text style={s.title}>{title}</Text>
        <Text style={s.message}>{message}</Text>
      </View>
      <TouchableOpacity style={s.signOutBtn} activeOpacity={0.85} onPress={confirmSignOut}>
        <MaterialIcons name="logout" size={18} color={colors.error} />
        <Text style={s.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 24 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: colors.warningBg,
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  title: { fontSize: 20, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  message: { fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary, textAlign: 'center', lineHeight: 21, marginTop: 10 },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: radii.button, borderWidth: 1, borderColor: colors.error,
  },
  signOutText: { fontSize: 15, fontFamily: fonts.bold, color: colors.error },
});
