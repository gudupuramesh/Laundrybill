import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  pending:          { label: 'Pending',          bg: '#fff3e0', color: '#e65100' },
  confirmed:        { label: 'Confirmed',        bg: '#e3f2fd', color: '#1565c0' },
  picked_up:        { label: 'Picked Up',        bg: '#e3f2fd', color: '#1565c0' },
  processing:       { label: 'In Progress',      bg: '#fff8e1', color: '#f9a825' },
  ready:            { label: 'Ready',             bg: '#e8f5e9', color: '#2e7d32' },
  out_for_delivery: { label: 'Out for Delivery',  bg: '#e3f2fd', color: '#1565c0' },
  delivered:        { label: 'Completed',         bg: '#e8f5e9', color: '#2e7d32' },
  cancelled:        { label: 'Cancelled',         bg: '#fce4ec', color: '#c62828' },
};

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'processing', label: 'In Progress' },
  { key: 'ready', label: 'Ready' },
  { key: 'completed', label: 'Completed' },
  { key: 'due', label: 'Due' },
];

const TIME_FILTERS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: '3months', label: '3 Months' },
  { key: 'year', label: 'This Year' },
  { key: 'all_time', label: 'All' },
];

function timeAgo(date: Date | null): string {
  if (!date) return '';
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  if (val instanceof Date) return val;
  return new Date(val);
}

function getTimeRange(key: string): Date | null {
  const now = new Date();
  switch (key) {
    case 'today': {
      const d = new Date(now); d.setHours(0, 0, 0, 0); return d;
    }
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay()); // start of week (Sunday)
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'month': {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    case '3months': {
      return new Date(now.getFullYear(), now.getMonth() - 2, 1);
    }
    case 'year': {
      return new Date(now.getFullYear(), 0, 1);
    }
    default: return null;
  }
}

export default function OrdersScreen({
  onNewOrder,
  onViewOrder,
  initialFilter,
}: {
  onNewOrder?: () => void;
  onViewOrder?: (id: string) => void;
  initialFilter?: string;
}) {
  const insets = useSafeAreaInsets();
  const shopId = getShopId();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(initialFilter || 'all');
  const [timePeriod, setTimePeriod] = useState('all_time');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [search, setSearch] = useState('');

  // Sync initialFilter when it changes (e.g. navigating from due card)
  useEffect(() => {
    if (initialFilter) setFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    if (!shopId) { setLoading(false); return; }
    const unsub = firestore()
      .collection(`shops/${shopId}/orders`)
      .orderBy('createdAt', 'desc')
      .limit(500)
      .onSnapshot(
        (snap: any) => {
          const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          setOrders(list);
          setLoading(false);
        },
        () => setLoading(false)
      );
    return unsub;
  }, [shopId]);

  // Stats
  const stats = useMemo(() => {
    let active = 0, pending = 0, processing = 0, dueCount = 0, dueAmount = 0, todayCollected = 0;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    orders.forEach((o) => {
      const s = o.status || 'pending';
      if (s !== 'delivered' && s !== 'cancelled') active++;
      if (s === 'pending') pending++;
      if (s === 'processing' || s === 'confirmed' || s === 'picked_up') processing++;
      if (s !== 'cancelled') {
        const balance = o.financials?.balance ?? ((o.financials?.total || 0) - (o.financials?.amountPaid || 0));
        if (balance > 0) { dueCount++; dueAmount += Math.round(balance); }
      }
      const created = toDate(o.createdAt);
      if (created && created >= todayStart && s !== 'cancelled') {
        todayCollected += (o.financials?.amountPaid || 0);
      }
    });
    return { active, pending, processing, dueCount, dueAmount, todayCollected: Math.round(todayCollected) };
  }, [orders]);

  // Filtered & searched orders
  const filteredOrders = useMemo(() => {
    let list = orders;

    // Time period filter
    const rangeStart = getTimeRange(timePeriod);
    if (rangeStart) {
      list = list.filter((o) => {
        const created = toDate(o.createdAt);
        return created && created >= rangeStart;
      });
    }

    // Status filter
    if (filter === 'pending') list = list.filter((o) => o.status === 'pending');
    else if (filter === 'processing') list = list.filter((o) => ['confirmed', 'picked_up', 'processing'].includes(o.status));
    else if (filter === 'ready') list = list.filter((o) => o.status === 'ready' || o.status === 'out_for_delivery');
    else if (filter === 'completed') list = list.filter((o) => o.status === 'delivered');
    else if (filter === 'due') list = list.filter((o) => {
      if (o.status === 'cancelled') return false;
      const balance = o.financials?.balance ?? ((o.financials?.total || 0) - (o.financials?.amountPaid || 0));
      return balance > 0;
    });

    // Search
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((o) => {
        const fields = [o.customerName, o.customerPhone, o.publicId, o.orderNumber].filter(Boolean).join(' ').toLowerCase();
        return fields.includes(q);
      });
    }

    return list;
  }, [orders, filter, timePeriod, search]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orders</Text>
        <TouchableOpacity style={styles.timePicker} onPress={() => setShowTimePicker(true)} activeOpacity={0.7}>
          <Text style={styles.timePickerText}>{TIME_FILTERS.find(t => t.key === timePeriod)?.label || 'All'}</Text>
          <MaterialIcons name="expand-more" size={18} color="#00408f" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#00408f" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Compact Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>ACTIVE</Text>
              <Text style={styles.statValue}>{stats.active}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>PENDING</Text>
              <Text style={[styles.statValue, { color: '#e65100' }]}>{stats.pending}</Text>
            </View>
            <TouchableOpacity style={[styles.statCard, stats.dueCount > 0 && { backgroundColor: '#ffdad6' }]} onPress={() => setFilter(filter === 'due' ? 'all' : 'due')}>
              <Text style={[styles.statLabel, stats.dueCount > 0 && { color: '#93000a' }]}>DUE</Text>
              <Text style={[styles.statValue, { color: stats.dueCount > 0 ? '#93000a' : '#00408f', fontSize: 14 }]}>
                {stats.dueCount > 0 ? `₹${stats.dueAmount}` : '0'}
              </Text>
            </TouchableOpacity>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>TODAY</Text>
              <Text style={[styles.statValue, { color: '#00408f', fontSize: 14 }]}>₹{stats.todayCollected}</Text>
            </View>
          </View>

          {/* Status Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer} contentContainerStyle={styles.filterContent}>
            {STATUS_FILTERS.map((f) => (
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
              placeholder="Search orders..."
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

          {/* Section Header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {filter === 'all' ? 'ALL ORDERS' : STATUS_FILTERS.find((f) => f.key === filter)?.label.toUpperCase() || 'ORDERS'}
            </Text>
            <Text style={styles.resultCount}>{filteredOrders.length} orders</Text>
          </View>

          {/* Orders List */}
          {filteredOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="inbox" size={44} color="#c3c6d6" />
              <Text style={styles.emptyText}>No orders found</Text>
            </View>
          ) : (
            <View style={styles.orderStack}>
              {filteredOrders.map((order) => {
                const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                const created = toDate(order.createdAt);
                const itemCount = (order.items || []).reduce((sum: number, i: any) => sum + (i.quantity || 1), 0);
                const total = Math.round(order.financials?.total || 0);
                const balance = Math.round(order.financials?.balance ?? ((order.financials?.total || 0) - (order.financials?.amountPaid || 0)));

                return (
                  <TouchableOpacity
                    key={order.id}
                    style={styles.orderCard}
                    activeOpacity={0.7}
                    onPress={() => onViewOrder?.(order.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.orderTopRow}>
                        <Text style={styles.orderId}>#{order.publicId || order.orderNumber}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {balance > 0 && (
                            <View style={styles.dueBadge}>
                              <Text style={styles.dueBadgeText}>DUE ₹{balance}</Text>
                            </View>
                          )}
                          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                          </View>
                        </View>
                      </View>
                      <Text style={styles.orderCustomer} numberOfLines={1}>
                        {order.customerName || 'Guest'}
                      </Text>
                      <View style={styles.orderMeta}>
                        <Text style={styles.orderMetaText}>{itemCount} items</Text>
                        <View style={styles.dot} />
                        <Text style={styles.orderAmount}>₹{total}</Text>
                        <View style={styles.dot} />
                        <Text style={styles.orderTime}>{timeAgo(created)}</Text>
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
      <TouchableOpacity style={[styles.fab, { bottom: 56 + insets.bottom }]} activeOpacity={0.8} onPress={onNewOrder}>
        <MaterialIcons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Time Period Dropdown */}
      <Modal visible={showTimePicker} transparent animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
        <Pressable style={styles.dropdownOverlay} onPress={() => setShowTimePicker(false)}>
          <View style={styles.dropdownMenu}>
            {TIME_FILTERS.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.dropdownItem, timePeriod === t.key && styles.dropdownItemActive]}
                onPress={() => { setTimePeriod(t.key); setShowTimePicker(false); }}
              >
                <Text style={[styles.dropdownItemText, timePeriod === t.key && styles.dropdownItemTextActive]}>{t.label}</Text>
                {timePeriod === t.key && <MaterialIcons name="check" size={16} color="#00408f" />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
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
  timePicker: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: '#e3f2fd', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  timePickerText: { fontSize: 12, fontWeight: '700', color: '#00408f' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  statCard: {
    flex: 1, backgroundColor: '#ffffff', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 6,
    alignItems: 'center',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  statLabel: { fontSize: 8, fontWeight: '700', color: '#737685', letterSpacing: 0.3, marginBottom: 2 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#00408f' },

  // Status filters
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

  // Orders
  orderStack: { gap: 8 },
  orderCard: {
    backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  orderTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  orderId: { fontSize: 12, fontWeight: '700', color: '#00408f' },
  orderCustomer: { fontSize: 15, fontWeight: '700', color: '#191c1e', marginBottom: 3 },
  orderMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderMetaText: { fontSize: 11, color: '#434654', fontWeight: '500' },
  orderAmount: { fontSize: 11, fontWeight: '700', color: '#191c1e' },
  orderTime: { fontSize: 11, color: '#737685' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#c3c6d6' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  dueBadge: { backgroundColor: '#ffdad6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  dueBadgeText: { fontSize: 8, fontWeight: '800', color: '#93000a' },

  // Empty
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50 },
  emptyText: { fontSize: 14, color: '#737685', marginTop: 10 },

  // FAB
  fab: {
    position: 'absolute', right: 20, width: 54, height: 54, borderRadius: 16,
    backgroundColor: '#00408f', justifyContent: 'center', alignItems: 'center',
    elevation: 8, shadowColor: '#00408f', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 8 },
  },

  // Dropdown
  dropdownOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-start', alignItems: 'flex-end',
    paddingTop: 90, paddingRight: 16,
  },
  dropdownMenu: {
    backgroundColor: '#ffffff', borderRadius: 12, paddingVertical: 6, minWidth: 160,
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  dropdownItemActive: { backgroundColor: '#e3f2fd' },
  dropdownItemText: { fontSize: 13, fontWeight: '600', color: '#191c1e' },
  dropdownItemTextActive: { fontSize: 13, fontWeight: '700', color: '#00408f' },
});
