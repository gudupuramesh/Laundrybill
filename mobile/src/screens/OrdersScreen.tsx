import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal, Pressable, Alert, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import { useShopCountrySettings } from '../lib/use-shop-country-settings';
import { formatCurrency } from '../lib/currency-format';
import { HelpButton } from '../components/HelpButton';
import { colors, fonts, radii, shadows, spacing } from '../theme';

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
    case 'today': { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; }
    case 'week': { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d; }
    case 'month': return new Date(now.getFullYear(), now.getMonth(), 1);
    case '3months': return new Date(now.getFullYear(), now.getMonth() - 2, 1);
    case 'year': return new Date(now.getFullYear(), 0, 1);
    default: return null;
  }
}

const STATUS_COLORS: Record<string, { color: string; bg: string; accent: string }> = {
  pending: { color: colors.warning, bg: colors.warningBg, accent: colors.warning },
  confirmed: { color: colors.inProgress, bg: colors.inProgressBg, accent: colors.inProgress },
  picked_up_from_customer: { color: colors.inProgress, bg: colors.inProgressBg, accent: colors.inProgress },
  processing: { color: colors.inProgress, bg: colors.inProgressBg, accent: colors.inProgress },
  ready: { color: '#84CC16', bg: '#F1FBE7', accent: '#84CC16' },
  ready_for_pickup: { color: '#84CC16', bg: '#F1FBE7', accent: '#84CC16' },
  ready_for_delivery: { color: '#84CC16', bg: '#F1FBE7', accent: '#84CC16' },
  out_for_delivery: { color: colors.primary, bg: colors.primaryTint, accent: colors.primary },
  delivered: { color: colors.success, bg: colors.successBg, accent: colors.success },
  picked_up: { color: colors.success, bg: colors.successBg, accent: colors.success },
  cancelled: { color: colors.error, bg: colors.errorBg, accent: colors.error },
};

export default function OrdersScreen({
  onNewOrder,
  onViewOrder,
  onBack,
  initialFilter,
}: {
  onNewOrder?: () => void;
  onViewOrder?: (id: string) => void;
  onBack?: () => void;
  initialFilter?: string;
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const shopId = getShopId();
  const countrySettings = useShopCountrySettings(shopId);

  const STATUS_LABELS = useMemo((): Record<string, string> => ({
    pending: t('mobile.orderStatusPending'),
    confirmed: t('mobile.orderStatusConfirmed'),
    picked_up_from_customer: t('mobile.orderStatusPickedUp'),
    processing: t('mobile.orderStatusInProgress'),
    ready: t('mobile.orderStatusReady'),
    ready_for_pickup: t('mobile.orderStatusReady'),
    ready_for_delivery: t('mobile.orderStatusReady'),
    out_for_delivery: t('mobile.orderStatusOutForDelivery'),
    delivered: t('mobile.orderStatusCompleted'),
    picked_up: t('mobile.orderStatusCompleted'),
    cancelled: t('mobile.orderStatusCancelled'),
  }), [t]);

  const STATUS_FILTERS = useMemo(() => [
    { key: 'all', label: t('mobile.ordersFilterAll') },
    { key: 'pending', label: t('mobile.ordersFilterPending') },
    { key: 'processing', label: t('mobile.ordersFilterProcessing') },
    { key: 'ready', label: t('mobile.ordersFilterReady') },
    { key: 'completed', label: t('mobile.ordersFilterCompleted') },
    { key: 'due', label: t('mobile.ordersFilterDue') },
  ], [t]);

  const TIME_FILTERS = useMemo(() => [
    { key: 'today', label: t('mobile.timeFilterToday') },
    { key: 'week', label: t('mobile.timeFilterWeek') },
    { key: 'month', label: t('mobile.timeFilterMonth') },
    { key: '3months', label: t('mobile.timeFilter3Months') },
    { key: 'year', label: t('mobile.timeFilterYear') },
    { key: 'all_time', label: t('mobile.timeFilterAll') },
  ], [t]);

  const timeAgo = (date: Date | null): string => {
    if (!date) return '';
    const now = Date.now();
    const diff = now - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('mobile.timeJustNowLower');
    if (mins < 60) return t('mobile.timeMinutesAgoShort', { count: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t('mobile.timeHoursAgoShort', { count: hrs });
    const days = Math.floor(hrs / 24);
    if (days === 1) return t('mobile.timeYesterday');
    if (days < 7) return t('mobile.timeDaysAgoShort', { count: days });
    return date.toLocaleDateString(i18n.language || 'en-IN', { day: 'numeric', month: 'short' });
  };

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(initialFilter || 'all');
  const [timePeriod, setTimePeriod] = useState('all_time');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

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
          setOrders(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        () => setLoading(false)
      );
    return unsub;
  }, [shopId]);

  const stats = useMemo(() => {
    let active = 0, pending = 0, dueCount = 0, dueAmount = 0, todayCollected = 0;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    orders.forEach((o) => {
      const st = o.status || 'pending';
      if (st !== 'delivered' && st !== 'picked_up' && st !== 'cancelled') active++;
      if (st === 'pending') pending++;
      if (st !== 'cancelled') {
        const bal = o.financials?.balance ?? ((o.financials?.total || 0) - (o.financials?.amountPaid || 0));
        if (bal > 0) { dueCount++; dueAmount += Math.round(bal); }
      }
      const created = toDate(o.createdAt);
      if (created && created >= todayStart && st !== 'cancelled') todayCollected += (o.financials?.amountPaid || 0);
    });
    return { active, pending, dueCount, dueAmount, todayCollected: Math.round(todayCollected) };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let list = orders;
    const rangeStart = getTimeRange(timePeriod);
    if (rangeStart) list = list.filter((o) => { const c = toDate(o.createdAt); return c && c >= rangeStart; });

    if (filter === 'pending') list = list.filter((o) => o.status === 'pending');
    else if (filter === 'processing') list = list.filter((o) => ['confirmed', 'picked_up_from_customer', 'processing'].includes(o.status));
    else if (filter === 'ready') list = list.filter((o) => ['ready', 'ready_for_pickup', 'ready_for_delivery', 'out_for_delivery'].includes(o.status));
    else if (filter === 'completed') list = list.filter((o) => ['delivered', 'picked_up'].includes(o.status));
    else if (filter === 'due') list = list.filter((o) => {
      if (o.status === 'cancelled') return false;
      const bal = o.financials?.balance ?? ((o.financials?.total || 0) - (o.financials?.amountPaid || 0));
      return bal > 0;
    });

    const q = search.trim().toLowerCase();
    if (q) list = list.filter((o) => {
      return [o.customerName, o.customerPhone, o.publicId, o.orderNumber].filter(Boolean).join(' ').toLowerCase().includes(q);
    });

    return list;
  }, [orders, filter, timePeriod, search]);

  const handleQuickStatus = (order: any, nextStatus: string, label: string) => {
    Alert.alert(
      label,
      `${order.customerName || t('mobile.guestCustomer')} — ${order.publicId || order.orderNumber}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: label,
          onPress: async () => {
            try {
              const docRef = firestore().collection(`shops/${shopId}/orders`).doc(order.id);
              const currentTimeline = order.timeline || [];
              const newEvent = {
                id: `t-${Date.now()}`,
                status: nextStatus,
                timestamp: new Date(),
                staffId: 'mobile',
                staffName: 'Shop Owner',
                notifiedCustomer: false,
              };
              const updateData: any = { status: nextStatus, updatedAt: new Date(), timeline: [...currentTimeline, newEvent] };
              if (nextStatus === 'delivered' || nextStatus === 'picked_up') updateData.deliveredAt = new Date();
              await docRef.update(updateData);
            } catch (e: any) {
              Alert.alert(t('mobile.errorTitle'), e.message || 'Failed');
            }
          },
        },
      ]
    );
  };

  const handleQuickCollect = (order: any) => {
    const total = Math.round(order.financials?.total || 0);
    const balance = Math.round(order.financials?.balance ?? (total - (order.financials?.amountPaid || 0)));
    Alert.alert(
      t('mobile.collectPaymentTitle', { defaultValue: 'Collect Payment' }),
      `${formatCurrency(balance, countrySettings)} — ${order.customerName || t('mobile.guestCustomer')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('mobile.collectCash', { defaultValue: 'Collect Cash' }),
          onPress: async () => {
            try {
              const docRef = firestore().collection(`shops/${shopId}/orders`).doc(order.id);
              const currentPayments = order.payments || [];
              await docRef.update({
                'financials.amountPaid': total,
                'financials.balance': 0,
                paymentStatus: 'paid',
                payments: [...currentPayments, { id: `p-${Date.now()}`, amount: balance, method: 'cash', collectedBy: 'Shop Owner', collectedAt: new Date() }],
                updatedAt: new Date(),
              });
            } catch (e: any) {
              Alert.alert(t('mobile.errorTitle'), e.message || 'Failed');
            }
          },
        },
      ]
    );
  };

  const handleMessage = (order: any) => {
    const phone = order.customerPhone;
    if (phone) {
      const cleaned = phone.replace(/\s+/g, '');
      Linking.openURL(`https://wa.me/${cleaned.replace('+', '')}`).catch(() => {
        Linking.openURL(`tel:${cleaned}`).catch(() => {});
      });
    }
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={onBack} activeOpacity={0.7}>
          <MaterialIcons name="chevron-left" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('mobile.ordersScreenTitle')}</Text>
        <TouchableOpacity
          style={[s.iconBtn, showSearch && { backgroundColor: colors.primaryTint }]}
          onPress={() => { setShowSearch(!showSearch); if (showSearch) { setSearch(''); } }}
          activeOpacity={0.7}
        >
          <MaterialIcons name="search" size={20} color={showSearch ? colors.primary : colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[s.scrollContent, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Input (toggle) */}
        {showSearch && (
          <View style={s.searchWrapper}>
            <MaterialIcons name="search" size={20} color={colors.textMuted} style={{ position: 'absolute', left: 16, zIndex: 1 }} />
            <TextInput
              style={s.searchInput}
              placeholder={t('mobile.ordersSearchPlaceholder')}
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

        {/* Stats Card — single card with dividers */}
        {!loading && (
          <View style={s.statsCard}>
            <View style={s.statsCardRow}>
              <View style={s.statCol}>
                <Text style={s.statColLabel}>{t('mobile.ordersStatToday', { defaultValue: 'Today Rev' })}</Text>
                <Text style={s.statColValue}>{formatCurrency(stats.todayCollected, countrySettings)}</Text>
              </View>
              <View style={s.statColDivider} />
              <View style={s.statCol}>
                <Text style={s.statColLabel}>{t('mobile.ordersStatActive', { defaultValue: 'Active' })}</Text>
                <Text style={s.statColValue}>{stats.active}</Text>
              </View>
              <View style={s.statColDivider} />
              <View style={s.statCol}>
                <Text style={s.statColLabel}>{t('mobile.ordersStatPending', { defaultValue: 'Pending' })}</Text>
                <Text style={s.statColValue}>{stats.pending}</Text>
              </View>
              <View style={s.statColDivider} />
              <TouchableOpacity style={s.statCol} onPress={() => setFilter(filter === 'due' ? 'all' : 'due')}>
                <Text style={s.statColLabel}>{t('mobile.ordersStatDue', { defaultValue: 'Due Amt' })}</Text>
                <Text style={[s.statColValue, stats.dueAmount > 0 && { color: colors.error }]}>
                  {formatCurrency(stats.dueAmount, countrySettings)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
          {STATUS_FILTERS.map((f) => (
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

        {/* Orders List */}
        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filteredOrders.length === 0 ? (
          <View style={s.emptyState}>
            <MaterialIcons name="search" size={40} color={colors.textMuted} />
            <Text style={s.emptyTitle}>{t('mobile.ordersEmpty')}</Text>
            <Text style={s.emptySubtitle}>{t('mobile.ordersEmptyHint', { defaultValue: 'Try searching for a different name, ID, or filter.' })}</Text>
          </View>
        ) : (
          <View style={s.orderList}>
            {filteredOrders.map((order) => {
              const status = order.status || 'pending';
              const sc = STATUS_COLORS[status] || { color: colors.textSecondary, bg: colors.surfaceMuted, accent: colors.textMuted };
              const statusLabel = STATUS_LABELS[status] || status;
              const created = toDate(order.createdAt);
              const itemCount = (order.items || []).reduce((sum: number, i: any) => sum + (i.quantity || 1), 0);
              const itemSummary = (order.items || []).map((i: any) => i.serviceName || i.categoryName || '').filter(Boolean).slice(0, 2).join(', ');
              const total = Math.round(order.financials?.total || 0);
              const balance = Math.round(order.financials?.balance ?? ((order.financials?.total || 0) - (order.financials?.amountPaid || 0)));
              const isPaid = balance <= 0;
              const orderId = order.publicId || order.orderNumber || `ORD-${order.id?.slice(-4)}`;

              return (
                <TouchableOpacity key={order.id} style={s.orderCard} activeOpacity={0.7} onPress={() => onViewOrder?.(order.id)}>
                  {/* Left accent bar */}
                  <View style={[s.accentBar, { backgroundColor: sc.accent }]} />

                  {/* Row 1: Order ID + Status + Price */}
                  <View style={s.ocRow1}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={[s.ocOrderId, { color: sc.color }]}>{orderId}</Text>
                      <View style={s.ocDot} />
                      <View style={[s.ocStatusBadge, { backgroundColor: sc.bg }]}>
                        <Text style={[s.ocStatusText, { color: sc.color }]}>{statusLabel.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={s.ocPrice}>{formatCurrency(total, countrySettings)}</Text>
                  </View>

                  {/* Row 2: Customer name + item summary */}
                  <View>
                    <Text style={s.ocCustomer} numberOfLines={1}>{order.customerName || t('mobile.guestCustomer')}</Text>
                    <Text style={s.ocItemSummary} numberOfLines={1}>
                      {itemCount} {t('mobile.items', { defaultValue: 'items' })}
                      {itemSummary ? ` · ${itemSummary}` : ''}
                    </Text>
                  </View>

                  {/* Dashed separator */}
                  <View style={s.dashedLine} />
                  {/* Row 3: Badges + date */}
                  <View style={s.ocRow3NoBorder}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <View style={[s.ocBadge, isPaid ? s.ocBadgePaid : s.ocBadgeUnpaid]}>
                        <Text style={[s.ocBadgeText, { color: isPaid ? colors.success : colors.error }]}>
                          {isPaid ? t('mobile.paid', { defaultValue: 'PAID' }) : t('mobile.unpaid', { defaultValue: 'UNPAID' })}
                        </Text>
                      </View>
                      {order.deliveryType ? (
                        <View style={s.ocBadgeDelivery}>
                          <Text style={s.ocBadgeDeliveryText}>{order.deliveryType}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={s.ocDate}>{timeAgo(created)}</Text>
                  </View>

                  {/* Row 4: Smart Action Buttons */}
                  {(status !== 'delivered' && status !== 'picked_up' && status !== 'cancelled') || !isPaid ? (
                    <View style={s.cardActions}>
                      {!isPaid && (
                        <TouchableOpacity
                          style={s.btnActionSecondary}
                          activeOpacity={0.7}
                          onPress={(e) => { e.stopPropagation?.(); handleQuickCollect(order); }}
                        >
                          <Text style={s.btnActionSecondaryText}>
                            {t('mobile.collect', { defaultValue: 'Collect' })} {formatCurrency(balance, countrySettings)}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {status === 'pending' && (
                        <TouchableOpacity
                          style={s.btnActionPrimary}
                          activeOpacity={0.7}
                          onPress={(e) => { e.stopPropagation?.(); handleQuickStatus(order, 'processing', t('mobile.startProcessing', { defaultValue: 'Start Processing' })); }}
                        >
                          <Text style={s.btnActionPrimaryText}>{t('mobile.startProcessing', { defaultValue: 'Start Processing' })}</Text>
                        </TouchableOpacity>
                      )}
                      {(status === 'processing' || status === 'confirmed' || status === 'picked_up_from_customer') && (
                        <TouchableOpacity
                          style={s.btnActionSuccess}
                          activeOpacity={0.7}
                          onPress={(e) => { e.stopPropagation?.(); handleQuickStatus(order, 'ready', t('mobile.markReady', { defaultValue: 'Mark Ready' })); }}
                        >
                          <Text style={s.btnActionSuccessText}>{t('mobile.markReady', { defaultValue: 'Mark Ready' })}</Text>
                        </TouchableOpacity>
                      )}
                      {(status === 'ready' || status === 'ready_for_pickup' || status === 'ready_for_delivery') && (
                        <TouchableOpacity
                          style={s.btnActionPrimary}
                          activeOpacity={0.7}
                          onPress={(e) => { e.stopPropagation?.(); handleQuickStatus(order, 'delivered', t('mobile.deliverOrder', { defaultValue: 'Deliver Order' })); }}
                        >
                          <Text style={s.btnActionPrimaryText}>{t('mobile.deliverOrder', { defaultValue: 'Deliver Order' })}</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={s.btnActionIcon}
                        activeOpacity={0.7}
                        onPress={(e) => { e.stopPropagation?.(); handleMessage(order); }}
                      >
                        <MaterialIcons name="chat-bubble-outline" size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* FAB — positioned above bottom nav */}
      <TouchableOpacity style={[s.fab, { bottom: 70 + insets.bottom }]} activeOpacity={0.85} onPress={onNewOrder}>
        <MaterialIcons name="add" size={28} color={colors.surface} />
      </TouchableOpacity>

      {/* Time Period Dropdown */}
      <Modal visible={showTimePicker} transparent animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
        <Pressable style={s.dropdownOverlay} onPress={() => setShowTimePicker(false)}>
          <View style={s.dropdownMenu}>
            {TIME_FILTERS.map((row) => (
              <TouchableOpacity
                key={row.key}
                style={[s.dropdownItem, timePeriod === row.key && s.dropdownItemActive]}
                onPress={() => { setTimePeriod(row.key); setShowTimePicker(false); }}
              >
                <Text style={[s.dropdownItemText, timePeriod === row.key && s.dropdownItemTextActive]}>{row.label}</Text>
                {timePeriod === row.key && <MaterialIcons name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    paddingHorizontal: 12, paddingTop: 0, paddingBottom: 6,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },

  scrollContent: { padding: 16, gap: 12 },

  // Stats card
  statsCard: {
    backgroundColor: colors.surface, borderRadius: radii.card,
    ...shadows.card, ...shadows.cardBorder,
    paddingVertical: 10, paddingHorizontal: 8,
  },
  statsCardRow: { flexDirection: 'row', alignItems: 'center' },
  statCol: { flex: 1, alignItems: 'center', gap: 2 },
  statColDivider: { width: 1, backgroundColor: colors.border, alignSelf: 'stretch', marginHorizontal: 4 },
  statColLabel: { fontSize: 9, fontFamily: fonts.bold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  statColValue: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },

  // Search
  searchWrapper: { position: 'relative', justifyContent: 'center' },
  searchInput: {
    paddingVertical: 14, paddingLeft: 48, paddingRight: 40,
    borderRadius: radii.input, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
    fontSize: 15, fontFamily: fonts.medium, color: colors.text,
  },

  // Filter chips
  chipsRow: { gap: 10, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.primaryTint, borderColor: 'transparent',
  },
  chipText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  chipTextActive: { color: colors.primary },

  // Order cards
  orderList: { gap: 16 },
  orderCard: {
    backgroundColor: colors.surface, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.border,
    ...shadows.card,
    overflow: 'hidden', padding: 12, paddingLeft: 16,
    gap: 8,
  },
  accentBar: {
    position: 'absolute', left: 0, top: 12, bottom: 12, width: 4,
    borderTopRightRadius: 4, borderBottomRightRadius: 4,
  },

  // Row 1
  ocRow1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ocOrderId: { fontSize: 11, fontFamily: fonts.bold, textTransform: 'uppercase', letterSpacing: 0.8 },
  ocDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textMuted },
  ocStatusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  ocStatusText: { fontSize: 11, fontFamily: fonts.bold },
  ocPrice: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },

  // Row 2
  ocCustomer: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  ocItemSummary: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 2 },

  // Dashed separator
  dashedLine: {
    height: 1, borderStyle: 'dashed' as any, borderWidth: 1, borderColor: colors.border,
    marginHorizontal: 0,
  },
  // Row 3
  ocRow3NoBorder: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  ocBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  ocBadgePaid: { backgroundColor: colors.successBg },
  ocBadgeUnpaid: { backgroundColor: colors.errorBg },
  ocBadgeText: { fontSize: 11, fontFamily: fonts.bold },
  ocBadgeDelivery: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border,
  },
  ocBadgeDeliveryText: { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary },
  ocDate: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary },

  // Action buttons
  cardActions: {
    flexDirection: 'row', gap: 8,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 2,
  },
  btnActionPrimary: {
    flex: 1, paddingVertical: 8, borderRadius: radii.button,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6,
  },
  btnActionPrimaryText: { fontSize: 13, fontFamily: fonts.bold, color: colors.surface },
  btnActionSecondary: {
    flex: 1, paddingVertical: 8, borderRadius: radii.button,
    backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, flexDirection: 'row', gap: 6,
  },
  btnActionSecondaryText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  btnActionSuccess: {
    flex: 1, paddingVertical: 8, borderRadius: radii.button,
    backgroundColor: '#F1FBE7', alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6,
  },
  btnActionSuccessText: { fontSize: 13, fontFamily: fonts.bold, color: '#84CC16' },
  btnActionIcon: {
    width: 34, height: 34, borderRadius: radii.button,
    backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, flex: 0,
  },

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

  // Dropdown
  dropdownOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-start', alignItems: 'flex-end',
    paddingTop: 90, paddingRight: 16,
  },
  dropdownMenu: {
    backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 6, minWidth: 160,
    ...shadows.elevated,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  dropdownItemActive: { backgroundColor: colors.primaryTint },
  dropdownItemText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.text },
  dropdownItemTextActive: { fontFamily: fonts.bold, color: colors.primary },
});
