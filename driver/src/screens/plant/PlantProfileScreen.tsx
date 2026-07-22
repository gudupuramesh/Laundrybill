import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { colors, fonts, radii } from '../../theme';
import { useDriverAuth } from '../../lib/DriverAuthContext';
import TeamProfileScreen from '../TeamProfileScreen';

/** The plant operator's station availability toggle — shown between the member
 *  and shop cards on the shared profile screen. */
function StationToggle() {
  const { isOnline, goOnline, goOffline } = useDriverAuth();
  return (
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
  );
}

export default function PlantProfileScreen() {
  return <TeamProfileScreen extras={<StationToggle />} />;
}

const styles = StyleSheet.create({
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  toggleTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  toggleSub: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
