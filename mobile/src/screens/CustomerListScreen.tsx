import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import { useShopCountrySettings } from '../lib/use-shop-country-settings';
import { formatCurrency } from '../lib/currency-format';
import { HelpButton } from '../components/HelpButton';
import { colors, fonts, radii, shadows, spacing } from '../theme';
import { Avatar } from '../components/ui';

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  if (val instanceof Date) return val;
  return new Date(val);
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

export default function CustomerListScreen({
  onViewCustomer,
  onAddCustomer,
}: {
  onViewCustomer?: (id: string) => void;
  onAddCustomer?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const shopId = getShopId();
  const countrySettings = useShopCountrySettings(shopId);

  const FILTERS = useMemo(() => [
    { key: 'all', label: t('mobile.customersFilterAll') },
    { key: 'active', label: t('mobile.customersFilterActive') },
    { key: 'inactive', label: t('mobile.customersFilterInactive') },
  ], [t]);

  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (!shopId) { setLoading(false); return; }
    const unsub = firestore()
      .collection(`shops/${shopId}/customers`)
      .orderBy('name')
      .limit(200)
      .onSnapshot(
        (snap: any) => {
          setCustomers(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        () => setLoading(false),
      );
    return unsub;
  }, [shopId]);

  const stats = useMemo(() => {
    let total = customers.length;
    let active = 0;
    let totalSpent = 0;
    let totalOrders = 0;
    customers.forEach((c) => {
      if (c.isActive !== false) active++;
      totalSpent += c.totalSpent || 0;
      totalOrders += c.totalOrders || 0;
    });
    const avgValue = totalOrders > 0 ? Math.round(totalSpent / totalOrders) : 0;
    return { total, active, inactive: total - active, avgValue };
  }, [customers]);

  const filtered = useMemo(() => {
    let list = customers;
    if (filter === 'active') list = list.filter((c) => c.isActive !== false);
    if (filter === 'inactive') list = list.filter((c) => c.isActive === false);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((c) => [c.name, c.phone, c.email].filter(Boolean).join(' ').toLowerCase().includes(q));
    return list;
  }, [customers, filter, search]);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>{t('mobile.customersScreenTitle')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={s.iconBtn} onPress={onAddCustomer} activeOpacity={0.7}>
            <MaterialIcons name="person-add" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.iconBtn, showSearch && { backgroundColor: colors.primaryTint }]}
            onPress={() => { setShowSearch(!showSearch); if (showSearch) { setSearch(''); } }}
            activeOpacity={0.7}
          >
            <MaterialIcons name="search" size={20} color={showSearch ? colors.primary : colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[s.scrollContent, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Search (toggle) */}
        {showSearch && (
          <View style={s.searchWrapper}>
            <MaterialIcons name="search" size={20} color={colors.textMuted} style={{ position: 'absolute', left: 16, zIndex: 1 }} />
            <TextInput
              style={s.searchInput}
              placeholder={t('mobile.customersSearchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')} style={{ position: 'absolute', right: 14 }}>
                <MaterialIcons name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* Stats Card */}
        {!loading && (
          <View style={s.statsCard}>
            <View style={s.statsRow}>
              <View style={s.statCol}>
                <Text style={s.statLabel}>{t('mobile.customersStatTotal', { defaultValue: 'Total Cust' })}</Text>
                <Text style={s.statValue}>{stats.total}</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statCol}>
                <Text style={s.statLabel}>{t('mobile.customersStatActive', { defaultValue: 'Active' })}</Text>
                <Text style={s.statValue}>{stats.active}</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statCol}>
                <Text style={s.statLabel}>{t('mobile.customersStatInactive', { defaultValue: 'Inactive' })}</Text>
                <Text style={s.statValue}>{stats.inactive}</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statCol}>
                <Text style={s.statLabel}>{t('mobile.customersStatAvgValue', { defaultValue: 'Avg Order' })}</Text>
                <Text style={s.statValue}>{formatCurrency(stats.avgValue, countrySettings)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[s.chip, filter === f.key && s.chipActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[s.chipText, filter === f.key && s.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Customer List */}
        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={s.emptyState}>
            <MaterialIcons name="search" size={40} color={colors.textMuted} />
            <Text style={s.emptyTitle}>{t('mobile.customersEmpty')}</Text>
            <Text style={s.emptySubtitle}>{t('mobile.customersEmptyHint', { defaultValue: 'Try a different search or filter.' })}</Text>
          </View>
        ) : (
          <View style={s.listCard}>
            {filtered.map((customer, index) => {
              const isActive = customer.isActive !== false;
              const totalSpent = Math.round(customer.totalSpent || 0);
              const totalOrders = customer.totalOrders || 0;
              return (
                <TouchableOpacity
                  key={customer.id}
                  style={[s.listRow, index < filtered.length - 1 && s.listRowBorder]}
                  activeOpacity={0.7}
                  onPress={() => onViewCustomer?.(customer.id)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <Avatar name={customer.name || '?'} size={44} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.custName} numberOfLines={1}>{customer.name || t('mobile.unknownName')}</Text>
                      <Text style={s.custMeta} numberOfLines={1}>
                        {customer.phone || t('mobile.noPhoneLabel')} · {totalOrders} {t('mobile.ordersLower', { defaultValue: 'orders' })}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={[s.indicator, totalSpent > 0 ? s.indicatorSpent : s.indicatorPending]}>
                      <Text style={[s.indicatorText, { color: totalSpent > 0 ? colors.success : colors.error }]}>
                        {formatCurrency(totalSpent, countrySettings)} {totalSpent > 0 ? t('mobile.spentLabel', { defaultValue: 'Spent' }) : ''}
                      </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={16} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={[s.fab, { bottom: 70 + insets.bottom }]} activeOpacity={0.85} onPress={onAddCustomer}>
        <MaterialIcons name="add" size={28} color={colors.surface} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },

  scrollContent: { padding: 16, gap: 12 },

  // Search
  searchWrapper: { position: 'relative', justifyContent: 'center' },
  searchInput: {
    paddingVertical: 14, paddingLeft: 48, paddingRight: 40,
    borderRadius: radii.input, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
    fontSize: 15, fontFamily: fonts.medium, color: colors.text,
  },

  // Stats card
  statsCard: {
    backgroundColor: colors.surface, borderRadius: radii.card,
    ...shadows.card, ...shadows.cardBorder,
    paddingVertical: 10, paddingHorizontal: 8,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statCol: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, backgroundColor: colors.border, alignSelf: 'stretch', marginHorizontal: 4 },
  statLabel: { fontSize: 9, fontFamily: fonts.bold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  statValue: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },

  // Filter chips
  chipsRow: { gap: 10, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primaryTint, borderColor: 'transparent' },
  chipText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  chipTextActive: { color: colors.primary },

  // Customer list card
  listCard: {
    backgroundColor: colors.surface, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.border,
    ...shadows.card,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  custName: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  custMeta: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 2 },
  indicator: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  indicatorSpent: { backgroundColor: colors.successBg },
  indicatorPending: { backgroundColor: colors.errorBg },
  indicatorText: { fontSize: 12, fontFamily: fonts.bold },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textSecondary, marginTop: 8 },
  emptySubtitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, textAlign: 'center' },

  // FAB
  fab: {
    position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    ...shadows.fab,
  },
});
