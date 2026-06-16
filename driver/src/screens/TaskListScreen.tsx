import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../theme';
import { FilterChips } from '../components/ui/FilterChips';
import { TaskCard } from '../components/TaskCard';
import { useDriverTasks, type DriverTask, type TaskType } from '../hooks/use-driver-tasks';
import { useNav } from '../lib/nav';

type FilterKey = 'today' | 'overdue' | 'upcoming' | 'completed';

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function endOfToday(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function matches(task: DriverTask, filter: FilterKey): boolean {
  if (filter === 'completed') return task.status === 'completed';
  if (task.status === 'completed') return false;
  const t = task.scheduledDate.getTime();
  if (filter === 'today') return t >= startOfToday() && t <= endOfToday();
  if (filter === 'overdue') return t < startOfToday();
  return t > endOfToday(); // upcoming
}

export function TaskListScreen({ type, title }: { type: TaskType; title: string }) {
  const insets = useSafeAreaInsets();
  const { tasks } = useDriverTasks({ type });
  const nav = useNav();
  const [filter, setFilter] = useState<FilterKey>('today');
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { today: 0, overdue: 0, upcoming: 0, completed: 0 };
    (['today', 'overdue', 'upcoming', 'completed'] as FilterKey[]).forEach((f) => {
      c[f] = tasks.filter((t) => matches(t, f)).length;
    });
    return c;
  }, [tasks]);

  const filters = [
    { key: 'today', label: `Today ${counts.today}` },
    { key: 'overdue', label: `Overdue ${counts.overdue}` },
    { key: 'upcoming', label: `Upcoming ${counts.upcoming}` },
    { key: 'completed', label: `Done ${counts.completed}` },
  ];

  // When searching, look across ALL statuses (by order id, customer name, or phone);
  // otherwise constrain to the active filter chip.
  const data = useMemo(() => {
    if (query) {
      return tasks.filter((t) => {
        const phone = (t.customer.phone || '').replace(/\s/g, '');
        return (
          (t.orderPublicId || '').toLowerCase().includes(query) ||
          (t.customer.name || '').toLowerCase().includes(query) ||
          phone.includes(query)
        );
      });
    }
    return tasks.filter((t) => matches(t, filter));
  }, [tasks, filter, query]);

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.searchWrap}>
        <MaterialIcons name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search order ID, name or phone…"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <MaterialIcons name="close" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {query.length === 0 && (
        <View style={{ paddingBottom: 12 }}>
          <FilterChips filters={filters} active={filter} onChange={(k) => setFilter(k as FilterKey)} />
        </View>
      )}
      <FlatList
        data={data}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            onPress={() =>
              nav.navigate(
                type === 'pickup'
                  ? { name: 'pickupDetail', orderId: item.orderId }
                  : { name: 'deliveryDetail', orderId: item.orderId },
              )
            }
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {query ? 'No orders match your search.' : 'Nothing here.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingBottom: 10 },
  title: { fontFamily: fonts.bold, fontSize: 21, color: colors.text },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
  },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted },
});
