import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import { useShopCountrySettings } from '../lib/use-shop-country-settings';
import { formatCurrency } from '../lib/currency-format';
import { HelpButton } from '../components/HelpButton';
import { colors, fonts, radii, shadows, spacing, typography } from '../theme';

// Status palette — matches the order list on the customer detail screen.
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: colors.warningBg, text: colors.warning },
  confirmed: { bg: colors.primaryTint, text: colors.primary },
  processing: { bg: colors.inProgressBg, text: colors.inProgress },
  ready: { bg: '#F1FBE7', text: '#84CC16' },
  out_for_delivery: { bg: colors.primaryTint, text: colors.primary },
  delivered: { bg: colors.successBg, text: colors.success },
  picked_up: { bg: colors.successBg, text: colors.success },
  cancelled: { bg: colors.errorBg, text: colors.error },
};

function orderStatusLabel(status: string, t: TFunction): string {
  const tr = t(`mobile.odStatus_${status}` as any);
  return tr || status;
}

function formatTimeAgo(date: any, t: TFunction, locale: string): string {
  if (!date) return '';
  const now = new Date();
  const d = date.toDate ? date.toDate() : new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return t('mobile.timeJustNow');
  if (diffMins < 60) return t('mobile.timeMinutesAgo', { count: diffMins });
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return t('mobile.timeHoursAgo', { count: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return t('mobile.timeDaysAgo', { count: diffDays });
  return d.toLocaleDateString(locale || 'en-IN', { day: 'numeric', month: 'short' });
}

export default function HomeScreen({
  onNewOrder,
  onScanQR,
  onExpense,
  onAttendance,
  onDueOrders,
  onViewOrders,
  onSearchOrders,
  onViewOrder,
}: {
  onNewOrder?: () => void;
  onScanQR?: () => void;
  onExpense?: () => void;
  onAttendance?: () => void;
  onDueOrders?: () => void;
  onViewOrders?: () => void;
  onSearchOrders?: () => void;
  onViewOrder?: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const shopId = getShopId();
  const countrySettings = useShopCountrySettings(shopId);
  const [shopData, setShopData] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [stats, setStats] = useState({ pending: 0, completed: 0, collected: 0, inProgress: 0, dueCount: 0, dueAmount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubShop: (() => void) | undefined;
    let unsubOrders: (() => void) | undefined;
    try {
      const sid = getShopId();
      if (!sid) { setLoading(false); return; }

      unsubShop = firestore().collection('shops').doc(sid)
        .onSnapshot((doc: any) => { if (doc.exists) setShopData(doc.data()); }, () => {});

      unsubOrders = firestore().collection('shops').doc(sid).collection('orders')
        .orderBy('createdAt', 'desc').limit(50)
        .onSnapshot((snapshot: any) => {
          const orders = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
          setRecentOrders(orders.slice(0, 2));
          let pending = 0, completed = 0, inProgress = 0, collected = 0, dueCount = 0, dueAmount = 0;
          orders.forEach((o: any) => {
            const s = o.status || 'pending';
            if (s === 'pending') pending++;
            if (['delivered', 'picked_up'].includes(s)) completed++;
            if (['processing', 'ready', 'out_for_delivery', 'confirmed', 'picked_up_from_customer'].includes(s)) inProgress++;
            if (s !== 'cancelled') {
              collected += (o.financials?.amountPaid || 0);
              const balance = o.financials?.balance ?? ((o.financials?.total || 0) - (o.financials?.amountPaid || 0));
              if (balance > 0) {
                dueCount++;
                dueAmount += Math.round(balance);
              }
            }
          });
          setStats({ pending, completed, collected: Math.round(collected), inProgress, dueCount, dueAmount });
          setLoading(false);
        }, () => setLoading(false));
    } catch (e) { setLoading(false); }
    return () => { unsubShop?.(); unsubOrders?.(); };
  }, []);

  const shopName = shopData?.name || t('mobile.myShopDefault');
  const shopCity = shopData?.location?.city || '';
  const pendingOrderCount = stats.pending + stats.inProgress;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.brandSection}>
          <View style={s.appIcon}>
            {shopData?.logoUrl ? (
              <Image source={{ uri: shopData.logoUrl }} style={s.appIconImage} />
            ) : (
              <Text style={s.appIconInitial}>{shopName.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.brandTitle} numberOfLines={1}>{shopName}</Text>
            {shopCity ? <Text style={s.brandSubtitle}>Store: {shopCity}</Text> : null}
          </View>
        </View>
        <HelpButton pageId="mobile_home" />
      </View>

      <ScrollView contentContainerStyle={[s.scrollContent, { paddingBottom: 100 + insets.bottom }]} showsVerticalScrollIndicator={false}>

        {/* Card 1: Search + Actions */}
        <View style={s.card}>
          <TouchableOpacity
            style={s.searchWrapper}
            activeOpacity={0.7}
            onPress={onSearchOrders || onViewOrders}
          >
            <MaterialIcons name="search" size={20} color={colors.primary} style={s.searchIcon} />
            <TextInput
              style={s.searchInput}
              placeholder={t('mobile.searchPlaceholder', { defaultValue: 'Search order or phone...' })}
              placeholderTextColor={colors.textMuted}
              editable={false}
              pointerEvents="none"
            />
          </TouchableOpacity>
          <View style={s.actionRow}>
            <TouchableOpacity style={s.btnSecondary} activeOpacity={0.7} onPress={onScanQR}>
              <MaterialIcons name="qr-code-scanner" size={18} color={colors.primary} />
              <Text style={s.btnSecondaryText}>{t('mobile.scanQr')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnPrimary} activeOpacity={0.8} onPress={onNewOrder}>
              <MaterialIcons name="note-add" size={18} color={colors.surface} />
              <Text style={s.btnPrimaryText}>{t('dashboard.newOrder')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Card 2: This Month Stats */}
        {loading ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <TouchableOpacity activeOpacity={0.85} onPress={onDueOrders}>
            <LinearGradient
              colors={['#1B61E5', '#124BB8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.statsCard}
            >
              <View style={s.statsHeader}>
                <View style={s.statsTitle}>
                  <MaterialIcons name="calendar-today" size={15} color="rgba(255,255,255,0.85)" />
                  <Text style={s.statsTitleText}>{t('mobile.thisMonth', { defaultValue: 'This Month' })}</Text>
                </View>
                <View style={s.statsBadge}>
                  <Text style={s.statsBadgeText}>
                    {pendingOrderCount} {t('mobile.ordersPending', { defaultValue: 'orders pending' })}
                  </Text>
                </View>
              </View>
              <View style={s.statsRow}>
                <View style={s.statCol}>
                  <View style={s.statLabel}>
                    <MaterialIcons name="south" size={13} color="#86EFAC" />
                    <Text style={s.statLabelText}>{t('mobile.statsCollected')}</Text>
                  </View>
                  <Text style={s.statValue}>{formatCurrency(stats.collected, countrySettings)}</Text>
                </View>
                <View style={s.statColDivider} />
                <View style={s.statCol}>
                  <View style={s.statLabel}>
                    <MaterialIcons name="lock-outline" size={13} color="#FCA5A5" />
                    <Text style={s.statLabelText}>{t('mobile.outstanding', { defaultValue: 'Outstanding' })}</Text>
                  </View>
                  <Text style={s.statValue}>{formatCurrency(stats.dueAmount, countrySettings)}</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        {!loading && (
          <View>
            <Text style={s.overline}>{t('mobile.quickActions', { defaultValue: 'QUICK ACTIONS' })}</Text>
            <View style={s.qaGrid}>
              <TouchableOpacity style={s.qaTile} activeOpacity={0.7} onPress={onExpense}>
                <View style={s.qaContent}>
                  <View style={[s.qaIcon, { backgroundColor: colors.errorBg }]}>
                    <MaterialIcons name="trending-up" size={16} color={colors.error} />
                  </View>
                  <Text style={s.qaLabel}>{t('common.expenses')}</Text>
                </View>
                <View style={s.qaPlus}>
                  <Text style={s.qaPlusText}>+</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={s.qaTile} activeOpacity={0.7} onPress={onAttendance}>
                <View style={s.qaContent}>
                  <View style={[s.qaIcon, { backgroundColor: colors.primaryTint }]}>
                    <MaterialIcons name="groups" size={16} color={colors.primary} />
                  </View>
                  <Text style={s.qaLabel}>{t('mobile.attendance', { defaultValue: 'Attendance' })}</Text>
                </View>
                <View style={s.qaPlus}>
                  <Text style={s.qaPlusText}>+</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Recent Orders */}
        {!loading && (
          <View>
            <View style={s.sectionHeader}>
              <View style={s.sectionTitleRow}>
                <Text style={s.overline}>{t('dashboard.recentOrders')}</Text>
                {recentOrders.length > 0 && (
                  <View style={s.countBadge}>
                    <Text style={s.countBadgeText}>{recentOrders.length}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={onViewOrders}>
                <Text style={s.viewAll}>{t('dashboard.viewAll')} {'>'}</Text>
              </TouchableOpacity>
            </View>

            {recentOrders.length === 0 ? (
              <View style={s.emptyState}>
                <MaterialIcons name="receipt-long" size={44} color={colors.textMuted} />
                <Text style={s.emptyTitle}>{t('mobile.recentOrdersEmpty')}</Text>
                <Text style={s.emptySubtitle}>{t('mobile.recentOrdersEmptyHint')}</Text>
              </View>
            ) : (
              <View style={s.orderListCard}>
                {recentOrders.map((order: any, index: number) => {
                  const cfg = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
                  const statusLabel = order.status ? orderStatusLabel(order.status, t) : '';
                  const orderId = order.publicId || `ORD-${order.id?.slice(-4) || '??'}`;
                  const itemCount = (order.items || []).reduce((sum: number, i: any) => sum + (i.quantity || 1), 0);
                  const total = Math.round(order.financials?.total || 0);
                  const balance = Math.round(order.financials?.balance ?? ((order.financials?.total || 0) - (order.financials?.amountPaid || 0)));
                  const isPaid = balance <= 0;
                  const dateStr = formatTimeAgo(order.createdAt, t, i18n.language);

                  return (
                    <TouchableOpacity
                      key={order.id}
                      style={[s.historyRow, index < recentOrders.length - 1 && s.historyRowBorder]}
                      activeOpacity={0.7}
                      onPress={() => onViewOrder?.(order.id)}
                    >
                      <View style={[s.accentBar, { backgroundColor: cfg.text }]} />
                      <View style={{ flex: 1, paddingLeft: 12 }}>
                        <View style={s.orderTopRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
                            <Text style={s.orderId}>{orderId}</Text>
                            {!!statusLabel && (
                              <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
                                <Text style={[s.statusText, { color: cfg.text }]}>{statusLabel.toUpperCase()}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={s.orderAmount}>{formatCurrency(total, countrySettings)}</Text>
                        </View>
                        <Text style={s.orderMeta} numberOfLines={1}>
                          {(order.customerName || t('mobile.guestCustomer'))} · {itemCount} {t('mobile.items', { defaultValue: 'items' })} · {dateStr}
                          {!isPaid ? ` · ${t('mobile.dueLabel', { defaultValue: 'Due' })} ${formatCurrency(balance, countrySettings)}` : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4, marginLeft: 8 }}>
                        <View style={[s.payBadge, isPaid ? s.payBadgePaid : s.payBadgeUnpaid]}>
                          <Text style={[s.payBadgeText, { color: isPaid ? colors.success : colors.error }]}>
                            {isPaid ? t('mobile.paid', { defaultValue: 'PAID' }) : t('mobile.unpaid', { defaultValue: 'UNPAID' })}
                          </Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={16} color={colors.textMuted} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  brandSection: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  appIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.card,
  },
  appIconInitial: { fontSize: 17, fontFamily: fonts.bold, color: colors.surface },
  appIconImage: { width: 36, height: 36, borderRadius: 10 },
  brandTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },
  brandSubtitle: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textSecondary },
  gearBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },

  // Subscription badges
  subBadgeFree: {
    minWidth: 48, maxWidth: 120,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: radii.badge, backgroundColor: colors.primaryTint,
    borderWidth: 1, borderColor: colors.primary + '30',
    alignItems: 'center',
  },
  subBadgeFreeLimit: {
    backgroundColor: colors.errorBg, borderColor: colors.error + '30',
  },
  subBadgeFreeLabel: { fontSize: 8, fontFamily: fonts.bold, color: colors.primary, letterSpacing: 0.4 },
  subBadgeFreeLabelLimit: { color: colors.error },
  subBadgeUsageText: { fontSize: 10, fontFamily: fonts.bold, color: colors.primary, marginTop: 1 },
  subBadgeUpgradeHint: {
    fontSize: 7, fontFamily: fonts.bold, color: colors.error, marginTop: 1, textAlign: 'center',
  },
  subBadgePaid: {
    flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 120,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: radii.badge, backgroundColor: colors.primaryTint,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  subBadgePaidText: { fontSize: 10, fontFamily: fonts.bold, color: colors.primary },

  scrollContent: { padding: 16, gap: 24 },

  // Card (compact)
  card: {
    backgroundColor: colors.surface, borderRadius: radii.card, padding: 12,
    ...shadows.card, ...shadows.cardBorder,
    gap: 10,
  },

  // Search
  searchWrapper: { position: 'relative', justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 14, zIndex: 1 },
  searchInput: {
    paddingVertical: 9, paddingLeft: 44, paddingRight: 14,
    borderRadius: radii.input, borderWidth: 1, borderColor: colors.border,
    fontSize: 14, fontFamily: fonts.semibold, color: colors.text,
  },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: 10 },
  btnSecondary: {
    flex: 1, paddingVertical: 10, borderRadius: radii.input,
    backgroundColor: colors.primaryTint,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnSecondaryText: { fontSize: 14, fontFamily: fonts.bold, color: colors.primary },
  btnPrimary: {
    flex: 1, paddingVertical: 10, borderRadius: radii.input,
    backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnPrimaryText: { fontSize: 14, fontFamily: fonts.bold, color: colors.surface },

  // Stats Card — highlighted blue gradient hero (matches the Finances net-profit card)
  statsCard: {
    borderRadius: radii.card,
    paddingHorizontal: 14, paddingVertical: 12,
    ...shadows.card,
    gap: 10, overflow: 'hidden',
  },
  statsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  statsTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statsTitleText: {
    fontSize: 11, fontFamily: fonts.bold, color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.6, textTransform: 'uppercase',
  },
  statsBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  statsBadgeText: { fontSize: 10, fontFamily: fonts.bold, color: colors.surface },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 10,
  },
  statCol: { flex: 1, gap: 2 },
  statColDivider: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 12 },
  statLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLabelText: { fontSize: 10, fontFamily: fonts.semibold, color: 'rgba(255,255,255,0.7)' },
  statValue: { fontSize: 22, fontFamily: fonts.bold, color: colors.surface },

  // Overline
  overline: {
    fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12,
  },

  // Quick Actions Grid
  qaGrid: { flexDirection: 'row', gap: 8 },
  qaTile: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8,
    ...shadows.card,
  },
  qaContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qaIcon: {
    width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  qaLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.text },
  qaPlus: { borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 8 },
  qaPlusText: { fontSize: 16, fontFamily: fonts.bold, color: colors.primary },

  // Section Header
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countBadge: {
    backgroundColor: colors.primaryTint, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99,
  },
  countBadgeText: { fontSize: 11, fontFamily: fonts.bold, color: colors.primary },
  viewAll: { fontSize: 12, fontFamily: fonts.bold, color: colors.primary, textTransform: 'uppercase' },

  // Recent orders — compact rows in one card (same look as customer detail)
  orderListCard: {
    backgroundColor: colors.surface, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.border, ...shadows.card,
    paddingHorizontal: 0,
  },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingRight: 12, paddingLeft: 0,
  },
  historyRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  accentBar: {
    position: 'absolute', left: 0, top: 10, bottom: 10, width: 4,
    borderTopRightRadius: 4, borderBottomRightRadius: 4,
  },
  orderTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  orderId: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  orderAmount: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  orderMeta: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 9, fontFamily: fonts.bold },
  payBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  payBadgePaid: { backgroundColor: colors.successBg },
  payBadgeUnpaid: { backgroundColor: colors.errorBg },
  payBadgeText: { fontSize: 10, fontFamily: fonts.bold },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary },
  emptySubtitle: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
});
