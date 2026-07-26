/**
 * Franchise master dashboard (owner app) — all shops in one view.
 *
 * Period-filtered financials per branch using the same semantics as Reports
 * (revenue = billed non-cancelled orders, profit = revenue − expenses),
 * combined totals, growth vs the previous period, and a profit ranking.
 * Tap a branch to switch the whole app into it; owners can add a branch or
 * delete one (never the main shop).
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../theme';
import { getShopId } from '../lib/auth';
import { getPrimaryShopId, switchActiveShop } from '../lib/activeShop';
import { useOwnedShops } from '../lib/useOwnedShops';
import { useFranchiseReport, type BranchReport } from '../lib/useFranchiseReport';
import { useShopCountrySettings } from '../lib/use-shop-country-settings';
import { formatCurrency } from '../lib/currency-format';
import { createNamedHttpsCallable } from '../lib/httpsCallable';

type PeriodKey = 'today' | '7d' | 'month' | 'lastMonth';

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: 'month', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
];

function periodRange(key: PeriodKey) {
  const now = new Date();
  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

  switch (key) {
    case 'today':
      return { start: startOfDay(now), end: now, prevStart: startOfDay(addDays(now, -1)), prevEnd: endOfDay(addDays(now, -1)) };
    case '7d':
      return { start: startOfDay(addDays(now, -6)), end: now, prevStart: startOfDay(addDays(now, -13)), prevEnd: endOfDay(addDays(now, -7)) };
    case 'month': {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { start: startOfMonth(now), end: now, prevStart: startOfMonth(prev), prevEnd: endOfMonth(prev) };
    }
    case 'lastMonth': {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prev2 = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return { start: startOfMonth(prev), end: endOfMonth(prev), prevStart: startOfMonth(prev2), prevEnd: endOfMonth(prev2) };
    }
  }
}

export default function FranchiseScreen({
  onBack,
  onAddShop,
  onShopSwitched,
  maxShops = 1,
}: {
  onBack: () => void;
  onAddShop: () => void;
  onShopSwitched: () => void;
  /** Shops the plan covers — gates the Add-branch action. */
  maxShops?: number;
}) {
  const insets = useSafeAreaInsets();
  const { shops, loading: shopsLoading, refresh } = useOwnedShops();
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [reloadKey, setReloadKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeShopId = getShopId();
  const primaryId = getPrimaryShopId();
  const countrySettings = useShopCountrySettings(activeShopId);
  const money = (n: number) => formatCurrency(Math.round(n), countrySettings);

  const range = useMemo(() => periodRange(period), [period]);
  const { reports, loading } = useFranchiseReport(
    shops, range.start, range.end, range.prevStart, range.prevEnd, reloadKey,
  );

  const totals = useMemo(() => {
    const t = { orders: 0, revenue: 0, collected: 0, expenses: 0, profit: 0 };
    reports.forEach((r) => {
      t.orders += r.orders; t.revenue += r.revenue; t.collected += r.collected;
      t.expenses += r.expenses; t.profit += r.profit;
    });
    return t;
  }, [reports]);

  const ranked = useMemo(() => [...reports].sort((a, b) => b.profit - a.profit), [reports]);
  const maxRevenue = Math.max(1, ...reports.map((r) => r.revenue));
  const margin = totals.revenue > 0 ? Math.round((totals.profit / totals.revenue) * 100) : 0;
  const canAdd = shops.length < maxShops;

  const handleSwitch = async (shopId: string, name: string) => {
    if (shopId === activeShopId) { onBack(); return; }
    await switchActiveShop(shopId);
    onShopSwitched();
  };

  const handleDelete = (shopId: string, name: string) => {
    Alert.alert(
      `Delete ${name}?`,
      `This permanently deletes this branch and ALL its data — orders, customers, inventory, reports — and revokes its staff logins. Its public page goes offline.\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(shopId);
            try {
              const fn = createNamedHttpsCallable('deleteBranchShop');
              await fn({ shopId });
              // If the deleted branch was active, fall back to the main shop.
              if (shopId === activeShopId && primaryId) await switchActiveShop(primaryId);
              await refresh();
              setReloadKey((k) => k + 1);
              Alert.alert('Branch deleted', `${name} and all its data were permanently removed.`);
              if (shopId === activeShopId) onShopSwitched();
            } catch (e: any) {
              Alert.alert('Could not delete branch', e?.message || 'Please try again.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={s.flex}>
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={10} style={s.back}>
          <MaterialIcons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>All shops</Text>
          <Text style={s.subtitle}>{shops.length} shop{shops.length === 1 ? '' : 's'} · combined performance</Text>
        </View>
        <TouchableOpacity
          onPress={() => (canAdd ? onAddShop() : Alert.alert('Shop limit reached', `Your plan covers ${maxShops} shop${maxShops === 1 ? '' : 's'}. Upgrade to Franchise to run more shops under one subscription.`))}
          style={s.addBtn}
          activeOpacity={0.85}
        >
          <MaterialIcons name="add" size={18} color="#fff" />
          <Text style={s.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 30 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={() => { refresh(); setReloadKey((k) => k + 1); }} tintColor={colors.primary} />
        }
      >
        {/* Period filter */}
        <View style={s.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.key}
              onPress={() => setPeriod(p.key)}
              style={[s.periodChip, period === p.key && s.periodChipActive]}
              activeOpacity={0.8}
            >
              <Text style={[s.periodChipText, period === p.key && s.periodChipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Combined KPIs */}
        <View style={s.kpiGrid}>
          <Kpi icon="trending-up" tint={colors.primary} label="Revenue" value={loading ? '…' : money(totals.revenue)} sub={`${totals.orders} order${totals.orders === 1 ? '' : 's'}`} />
          <Kpi icon="payments" tint={colors.success} label="Collected" value={loading ? '…' : money(totals.collected)} sub={totals.revenue > 0 ? `${Math.round((totals.collected / totals.revenue) * 100)}% of billed` : '—'} />
          <Kpi icon="receipt-long" tint={colors.warning} label="Expenses" value={loading ? '…' : money(totals.expenses)} sub="all shops" />
          <Kpi icon="savings" tint={totals.profit >= 0 ? colors.success : colors.error} label="Net profit" value={loading ? '…' : money(totals.profit)} sub={`${margin}% margin`} />
        </View>

        <Text style={s.sectionLabel}>Branch performance</Text>

        {shopsLoading || (loading && reports.length === 0) ? (
          <View style={s.loadingBox}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          ranked.map((r, i) => (
            <BranchCard
              key={r.shopId}
              report={r}
              rank={i + 1}
              isTop={i === 0 && ranked.length > 1 && r.profit > 0}
              needsAttention={ranked.length > 1 && i === ranked.length - 1 && r.profit < ranked[0].profit && (r.profit < 0 || r.revenue < maxRevenue * 0.4)}
              isActive={r.shopId === activeShopId}
              isPrimary={r.shopId === primaryId}
              revenueShare={r.revenue / maxRevenue}
              deleting={deletingId === r.shopId}
              money={money}
              onOpen={() => handleSwitch(r.shopId, r.name)}
              onDelete={r.shopId === primaryId ? undefined : () => handleDelete(r.shopId, r.name)}
            />
          ))
        )}

        {!canAdd && (
          <View style={s.limitBox}>
            <Text style={s.limitText}>
              Your plan covers {maxShops} shop{maxShops === 1 ? '' : 's'}. Upgrade to Franchise to run more shops
              under one subscription.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Kpi({ icon, tint, label, value, sub }: {
  icon: keyof typeof MaterialIcons.glyphMap; tint: string; label: string; value: string; sub: string;
}) {
  return (
    <View style={s.kpiCard}>
      <View style={s.kpiHead}>
        <MaterialIcons name={icon} size={13} color={tint} />
        <Text style={s.kpiLabel}>{label}</Text>
      </View>
      <Text style={s.kpiValue} numberOfLines={1}>{value}</Text>
      <Text style={s.kpiSub} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

function BranchCard({
  report: r, rank, isTop, needsAttention, isActive, isPrimary, revenueShare, deleting, money, onOpen, onDelete,
}: {
  report: BranchReport; rank: number; isTop: boolean; needsAttention: boolean; isActive: boolean;
  isPrimary: boolean; revenueShare: number; deleting: boolean; money: (n: number) => string;
  onOpen: () => void; onDelete?: () => void;
}) {
  const growth = Math.round(r.growthPct);
  return (
    <TouchableOpacity style={[s.card, isActive && s.cardActive]} activeOpacity={0.85} onPress={onOpen}>
      <View style={s.cardTop}>
        <View style={s.rankBadge}><Text style={s.rankText}>#{rank}</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={s.nameRow}>
            <Text style={s.name} numberOfLines={1}>{r.name}</Text>
            {isPrimary && <View style={s.chipMuted}><Text style={s.chipMutedText}>MAIN</Text></View>}
            {isTop && <View style={s.chipGood}><Text style={s.chipGoodText}>TOP</Text></View>}
            {needsAttention && <View style={s.chipWarn}><Text style={s.chipWarnText}>ATTENTION</Text></View>}
          </View>
          <View style={s.metaRow}>
            <Text style={s.metaText}>{r.orders} orders</Text>
            {r.prevRevenue > 0 && (
              <Text style={[s.metaText, { color: growth >= 0 ? colors.success : colors.error, fontFamily: fonts.bold }]}>
                {growth >= 0 ? '▲' : '▼'} {Math.abs(growth)}%
              </Text>
            )}
            {isActive && <Text style={[s.metaText, { color: colors.primary }]}>· Viewing</Text>}
          </View>
        </View>
        {onDelete && (
          deleting ? <ActivityIndicator color={colors.error} style={{ marginRight: 6 }} /> : (
            <TouchableOpacity onPress={onDelete} hitSlop={10} style={s.deleteBtn}>
              <MaterialIcons name="delete-outline" size={20} color={colors.error} />
            </TouchableOpacity>
          )
        )}
        <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
      </View>

      <View style={s.metricRow}>
        <Metric label="Revenue" value={money(r.revenue)} />
        <Metric label="Expenses" value={money(r.expenses)} />
        <Metric label="Profit" value={money(r.profit)} valueColor={r.profit >= 0 ? colors.success : colors.error} />
      </View>

      <View style={s.bar}>
        <View style={[s.barFill, { width: `${Math.max(3, Math.round(revenueShare * 100))}%` }]} />
      </View>
    </TouchableOpacity>
  );
}

function Metric({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={s.metric}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={[s.metricValue, valueColor ? { color: valueColor } : null]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 10,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { padding: 4 },
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  subtitle: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.primary,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
  },
  addBtnText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },

  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  periodChip: {
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  periodChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  periodChipText: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary },
  periodChipTextActive: { color: '#fff' },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  kpiCard: {
    flexGrow: 1, flexBasis: '46%', backgroundColor: colors.surface, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.border, padding: 12,
  },
  kpiHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  kpiLabel: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.textMuted },
  kpiValue: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginTop: 6 },
  kpiSub: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted, marginTop: 2 },

  sectionLabel: {
    fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase',
    color: colors.textMuted, marginBottom: 9,
  },
  loadingBox: {
    backgroundColor: colors.surface, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 34, alignItems: 'center',
  },

  card: {
    backgroundColor: colors.surface, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border,
    padding: 13, marginBottom: 10,
  },
  cardActive: { borderColor: colors.primary },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  rankBadge: {
    width: 34, height: 34, borderRadius: 11, backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center',
  },
  rankText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  name: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  chipMuted: { backgroundColor: colors.surfaceMuted, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1.5 },
  chipMutedText: { fontFamily: fonts.bold, fontSize: 8.5, letterSpacing: 0.4, color: colors.textMuted },
  chipGood: { backgroundColor: colors.successBg, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1.5 },
  chipGoodText: { fontFamily: fonts.bold, fontSize: 8.5, letterSpacing: 0.4, color: colors.success },
  chipWarn: { backgroundColor: colors.warningBg, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1.5 },
  chipWarnText: { fontFamily: fonts.bold, fontSize: 8.5, letterSpacing: 0.4, color: colors.warning },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 3, flexWrap: 'wrap' },
  metaText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textMuted },
  deleteBtn: { padding: 4 },

  metricRow: { flexDirection: 'row', gap: 7, marginTop: 11 },
  metric: { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 7 },
  metricLabel: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.textMuted },
  metricValue: { fontFamily: fonts.bold, fontSize: 13, color: colors.text, marginTop: 2 },

  bar: { height: 5, borderRadius: 999, backgroundColor: colors.surfaceMuted, overflow: 'hidden', marginTop: 10 },
  barFill: { height: '100%', borderRadius: 999, backgroundColor: colors.primary, opacity: 0.75 },

  limitBox: {
    backgroundColor: colors.surfaceMuted, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border,
    padding: 13, marginTop: 6,
  },
  limitText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 },
});
