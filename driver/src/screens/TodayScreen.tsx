import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { useDriverAuth } from '../lib/DriverAuthContext';
import { useDriverTasks } from '../hooks/use-driver-tasks';
import { useNav } from '../lib/nav';
import { TaskCard } from '../components/TaskCard';
import { useCurrency } from '../lib/currency';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 17) return 'Good afternoon,';
  return 'Good evening,';
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { agent, isOnline, goOnline, goOffline } = useDriverAuth();
  const { todayStats, tasks } = useDriverTasks();
  const { formatCompact } = useCurrency();
  const nav = useNav();

  const upNext = tasks.filter((t) => t.status === 'pending').slice(0, 4);

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.greeting}>{greeting()}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {agent?.name || 'Agent'}
          </Text>
        </View>
        <View style={styles.onlineRow}>
          <Text style={[styles.onlineLabel, { color: isOnline ? colors.success : colors.textMuted }]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
          <Switch
            value={isOnline}
            onValueChange={(v) => (v ? goOnline() : goOffline())}
            trackColor={{ true: colors.success, false: colors.border }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsCard}>
          <Stat label="Pickups" value={`${todayStats.pickups.completed}/${todayStats.pickups.total}`} />
          <View style={styles.statDivider} />
          <Stat label="Delivers" value={`${todayStats.deliveries.completed}/${todayStats.deliveries.total}`} />
          <View style={styles.statDivider} />
          <Stat label="Collected" value={formatCompact(todayStats.collected)} />
        </View>

        <Text style={styles.sectionLabel}>Up next</Text>
        {upNext.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No pending tasks. You&apos;re all caught up 🎉</Text>
          </View>
        ) : (
          upNext.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onPress={() =>
                nav.navigate(
                  t.type === 'pickup'
                    ? { name: 'pickupDetail', orderId: t.orderId }
                    : { name: 'deliveryDetail', orderId: t.orderId },
                )
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  greeting: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  name: { fontFamily: fonts.bold, fontSize: 21, color: colors.text },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  onlineLabel: { fontFamily: fonts.bold, fontSize: 11 },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    marginBottom: 16,
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontFamily: fonts.bold, fontSize: 22, color: colors.text },
  statLabel: { fontFamily: fonts.semibold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textMuted },
  statDivider: { width: 1, height: 34, backgroundColor: colors.border },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 8,
  },
  empty: { backgroundColor: colors.surface, borderRadius: 18, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emptyText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
});
