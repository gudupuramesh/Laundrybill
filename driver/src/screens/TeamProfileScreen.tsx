/**
 * Shared profile screen for the Team app. Shows the logged-in member's own
 * details and the company/shop they work for, plus a sign-out. Role-specific
 * extras (e.g. the plant's station toggle) are injected via `extras`.
 *
 * Used directly by Staff and Plant; Agent and Manager embed the cards from
 * TeamProfileCards into their own screens instead (they have more extras).
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { useDriverAuth } from '../lib/DriverAuthContext';
import { MemberCard, ShopCard } from '../components/TeamProfileCards';
import { Button } from '../components/ui/Button';

export default function TeamProfileScreen({
  extras,
  padTop = true,
}: {
  /** Role-specific card(s) rendered between the member card and the shop card. */
  extras?: React.ReactNode;
  /** When the parent shell already pads the top inset, pass false. */
  padTop?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { agent, shop, shopName, signOutAgent } = useDriverAuth();

  const confirmSignOut = () =>
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOutAgent() },
    ]);

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingTop: (padTop ? insets.top : 0) + 12,
          paddingBottom: insets.bottom + 90,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.header}>Profile</Text>
        <MemberCard agent={agent} />
        {extras}
        <ShopCard shop={shop} shopName={shopName} />
        <View style={{ marginTop: 12 }}>
          <Button label="Sign out" variant="ghost" icon="logout" onPress={confirmSignOut} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: { fontFamily: fonts.bold, fontSize: 22, color: colors.text, marginBottom: 16 },
});
