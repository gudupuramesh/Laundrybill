import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  if (val instanceof Date) return val;
  return new Date(val);
}

function timeAgo(date: Date | null): string {
  if (!date) return '';
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
];

export default function CustomerListScreen({
  onViewCustomer,
  onAddCustomer,
}: {
  onViewCustomer?: (id: string) => void;
  onAddCustomer?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const shopId = getShopId();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!shopId) { setLoading(false); return; }
    const unsub = firestore()
      .collection(`shops/${shopId}/customers`)
      .orderBy('name')
      .limit(200)
      .onSnapshot(
        (snap: any) => {
          const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          setCustomers(list);
          setLoading(false);
        },
        () => setLoading(false),
      );
    return unsub;
  }, [shopId]);

  // Stats
  const stats = useMemo(() => {
    let total = customers.length;
    let active = 0;
    let totalSpent = 0;
    customers.forEach((c) => {
      if (c.isActive !== false) active++;
      totalSpent += c.totalSpent || 0;
    });
    const avgValue = total > 0 ? Math.round(totalSpent / total) : 0;
    return { total, active, avgValue };
  }, [customers]);

  // Filter + search
  const filtered = useMemo(() => {
    let list = customers;
    if (filter === 'active') list = list.filter((c) => c.isActive !== false);
    if (filter === 'inactive') list = list.filter((c) => c.isActive === false);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const fields = [c.name, c.phone, c.email].filter(Boolean).join(' ').toLowerCase();
        return fields.includes(q);
      });
    }
    return list;
  }, [customers, filter, search]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Customers</Text>
        <TouchableOpacity style={styles.headerAddBtn} onPress={onAddCustomer} activeOpacity={0.7}>
          <MaterialIcons name="person-add" size={18} color="#fff" />
          <Text style={styles.headerAddBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#00408f" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 70 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>TOTAL</Text>
              <Text style={styles.statValue}>{stats.total}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>ACTIVE</Text>
              <Text style={[styles.statValue, { color: '#2e7d32' }]}>{stats.active}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>INACTIVE</Text>
              <Text style={[styles.statValue, { color: '#e65100' }]}>{stats.total - stats.active}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>AVG VALUE</Text>
              <Text style={[styles.statValue, { color: '#00408f', fontSize: 14 }]}>₹{stats.avgValue}</Text>
            </View>
          </View>

          {/* Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer} contentContainerStyle={styles.filterContent}>
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={filter === f.key ? styles.filterChipActive : styles.filterChip}
                onPress={() => setFilter(f.key)}
              >
                <Text style={filter === f.key ? styles.filterTextActive : styles.filterText}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Search */}
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={20} color="#737685" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search name or phone..."
              placeholderTextColor="#737685"
              value={search}
              onChangeText={setSearch}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <MaterialIcons name="close" size={18} color="#737685" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Section header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {filter === 'all' ? 'ALL CUSTOMERS' : filter.toUpperCase()}
            </Text>
            <Text style={styles.resultCount}>{filtered.length} customers</Text>
          </View>

          {/* List */}
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="people-outline" size={44} color="#c3c6d6" />
              <Text style={styles.emptyText}>No customers found</Text>
            </View>
          ) : (
            <View style={styles.customerList}>
              {filtered.map((customer) => {
                const lastOrder = toDate(customer.lastOrderAt);
                const isActive = customer.isActive !== false;
                return (
                  <TouchableOpacity
                    key={customer.id}
                    style={styles.customerCard}
                    activeOpacity={0.7}
                    onPress={() => onViewCustomer?.(customer.id)}
                  >
                    <View style={[styles.avatar, !isActive && { backgroundColor: '#f3f4f6' }]}>
                      <Text style={[styles.avatarText, !isActive && { color: '#737685' }]}>{getInitials(customer.name || '')}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.nameRow}>
                        <Text style={styles.customerName} numberOfLines={1}>{customer.name || 'Unknown'}</Text>
                        {!isActive && (
                          <View style={styles.inactiveBadge}>
                            <Text style={styles.inactiveBadgeText}>INACTIVE</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.customerPhone}>{customer.phone || 'No phone'}</Text>
                      <View style={styles.customerMeta}>
                        <Text style={styles.metaText}>{customer.totalOrders || 0} orders</Text>
                        <View style={styles.dot} />
                        <Text style={styles.metaText}>₹{Math.round(customer.totalSpent || 0)}</Text>
                        {lastOrder ? (
                          <>
                            <View style={styles.dot} />
                            <Text style={styles.metaTime}>{timeAgo(lastOrder)}</Text>
                          </>
                        ) : null}
                      </View>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#c3c6d6" />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity style={[styles.fab, { bottom: 56 + insets.bottom }]} activeOpacity={0.8} onPress={onAddCustomer}>
        <MaterialIcons name="person-add" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fb' },
  header: {
    paddingHorizontal: 20, height: 48,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#f8f9fb',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#00408f' },
  headerAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#00408f', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  headerAddBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: '#ffffff', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10,
    alignItems: 'center',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  statLabel: { fontSize: 8, fontWeight: '700', color: '#737685', letterSpacing: 0.3, marginBottom: 2 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#00408f' },

  // Filters
  filterContainer: { marginBottom: 10 },
  filterContent: { gap: 8, paddingVertical: 2 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 18, backgroundColor: '#e7e8ea' },
  filterChipActive: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 18, backgroundColor: '#00408f' },
  filterText: { fontSize: 12, fontWeight: '600', color: '#434654' },
  filterTextActive: { fontSize: 12, fontWeight: '700', color: '#ffffff' },

  // Search
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff',
    borderRadius: 10, paddingHorizontal: 12, height: 40, marginBottom: 12,
    borderWidth: 1, borderColor: '#edeef0',
  },
  searchInput: { flex: 1, fontSize: 13, color: '#191c1e', fontWeight: '500' },

  // Section
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8, paddingHorizontal: 2,
  },
  sectionTitle: { fontSize: 10, fontWeight: '800', color: '#434654', letterSpacing: 1.2 },
  resultCount: { fontSize: 11, fontWeight: '600', color: '#737685' },

  // List
  customerList: { gap: 8 },
  customerCard: {
    backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#00408f',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 1 },
  customerName: { fontSize: 14, fontWeight: '700', color: '#191c1e', flexShrink: 1 },
  customerPhone: { fontSize: 12, color: '#434654', marginBottom: 2 },
  customerMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 11, color: '#434654', fontWeight: '500' },
  metaTime: { fontSize: 11, color: '#737685' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#c3c6d6' },
  inactiveBadge: { backgroundColor: '#fff3e0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  inactiveBadgeText: { fontSize: 8, fontWeight: '700', color: '#e65100' },

  // Empty
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50 },
  emptyText: { fontSize: 14, color: '#737685', marginTop: 10 },

  // FAB
  fab: {
    position: 'absolute', right: 20, width: 54, height: 54, borderRadius: 16,
    backgroundColor: '#00408f', justifyContent: 'center', alignItems: 'center',
    elevation: 8, shadowColor: '#00408f', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 8 },
  },
});
