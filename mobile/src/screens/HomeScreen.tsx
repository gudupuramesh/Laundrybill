import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import { useMergedOrdersUsed } from '../lib/useBillingPeriodOrderCount';
import { usePlanLimits } from '../lib/usePlanLimits';
import { useShopCountrySettings } from '../lib/use-shop-country-settings';
import { formatCurrency } from '../lib/currency-format';
import { HelpButton } from '../components/HelpButton';
import { colors, fonts, radii, shadows, spacing, typography } from '../theme';

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
  onOpenSubscription,
}: {
  onNewOrder?: () => void;
  onScanQR?: () => void;
  onExpense?: () => void;
  onAttendance?: () => void;
  onDueOrders?: () => void;
  onViewOrders?: () => void;
  onSearchOrders?: () => void;
  onViewOrder?: (id: string) => void;
  onOpenSubscription?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const shopId = getShopId();
  const countrySettings = useShopCountrySettings(shopId);
  const [shopData, setShopData] = useState<any>(null);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [stats, setStats] = useState({ pending: 0, completed: 0, collected: 0, inProgress: 0, dueCount: 0, dueAmount: 0 });
  const [loading, setLoading] = useState(true);

  const ordersUsed = useMergedOrdersUsed(subscriptionData, shopId);
  const planLimits = usePlanLimits(subscriptionData);

  useEffect(() => {
    let unsubShop: (() => void) | undefined;
    let unsubOrders: (() => void) | undefined;
    let unsubSub: (() => void) | undefined;
    try {
      const sid = getShopId();
      if (!sid) { setLoading(false); return; }

      unsubShop = firestore().collection('shops').doc(sid)
        .onSnapshot((doc: any) => { if (doc.exists) setShopData(doc.data()); }, () => {});

      unsubSub = firestore().collection('subscriptions').doc(sid)
        .onSnapshot((doc: any) => {
          if (doc.exists) setSubscriptionData(doc.data());
        }, () => {});

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
    return () => { unsubShop?.(); unsubOrders?.(); unsubSub?.(); };
  }, []);

  const shopName = shopData?.name || t('mobile.myShopDefault');
  const shopCity = shopData?.location?.city || '';
  const planKey = (subscriptionData?.planId || subscriptionData?.planName || shopData?.plan || 'free').toString().toLowerCase();
  const subStatus = (subscriptionData?.status || 'trial').toLowerCase();
  const orderLimit = planLimits.maxOrders > 0 ? planLimits.maxOrders : 0;
  const isPaidPlan = subStatus === 'active' && planKey !== 'free' && planKey !== 'trial';
  const atFreeLimit = orderLimit > 0 && ordersUsed >= orderLimit && !isPaidPlan;
  const pendingOrderCount = stats.pending + stats.inProgress;

  const freeTierLabel =
    subStatus === 'trial' ? t('mobile.planStatusTrial') :
    subStatus === 'free' || planKey === 'free' ? t('mobile.planStatusFree') :
    t('mobile.planStatusFree');
  const normalizedPlanKey = planKey.replace(/[_\s-]/g, '');
  const paidPlanShort =
    (normalizedPlanKey === 'business' || normalizedPlanKey === 'enterprise' || normalizedPlanKey === 'proplus' || normalizedPlanKey === 'premium')
      ? 'Business'
      : (normalizedPlanKey === 'pro' || normalizedPlanKey === 'starter')
        ? 'Pro'
        : (subscriptionData?.planName || planKey || 'plan')
            .replace(/_/g, ' ')
            .split(' ')
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')
            .slice(0, 12);

  const SubBadgeWrap = onOpenSubscription ? TouchableOpacity : View;
  const subBadgeWrapProps = onOpenSubscription
    ? { onPress: onOpenSubscription, activeOpacity: 0.75 }
    : {};

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {isPaidPlan ? (
            <SubBadgeWrap {...subBadgeWrapProps} style={s.subBadgePaid}>
              <MaterialIcons name="workspace-premium" size={12} color={colors.primary} />
              <Text style={s.subBadgePaidText} numberOfLines={1}>{paidPlanShort}</Text>
            </SubBadgeWrap>
          ) : (
            <SubBadgeWrap
              {...subBadgeWrapProps}
              style={[s.subBadgeFree, atFreeLimit && s.subBadgeFreeLimit]}
            >
              <Text style={[s.subBadgeFreeLabel, atFreeLimit && s.subBadgeFreeLabelLimit]}>
                {freeTierLabel}
              </Text>
              {atFreeLimit ? (
                <Text style={s.subBadgeUpgradeHint} numberOfLines={1}>
                  {t('mobile.subscriptionUpgradeLimit')}
                </Text>
              ) : (
                <Text style={s.subBadgeUsageText}>
                  {ordersUsed}/{orderLimit}
                </Text>
              )}
            </SubBadgeWrap>
          )}
          <HelpButton pageId="mobile_home" />
          <TouchableOpacity style={s.gearBtn} onPress={onOpenSubscription} activeOpacity={0.7}>
            <MaterialIcons name="settings" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
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
          <TouchableOpacity style={s.statsCard} activeOpacity={0.7} onPress={onDueOrders}>
            <View style={s.statsHeader}>
              <View style={s.statsTitle}>
                <MaterialIcons name="calendar-today" size={16} color={colors.textSecondary} />
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
                  <MaterialIcons name="south" size={14} color={colors.success} />
                  <Text style={s.statLabelText}>{t('mobile.statsCollected')}</Text>
                </View>
                <Text style={s.statValue}>{formatCurrency(stats.collected, countrySettings)}</Text>
              </View>
              <View style={s.statColDivider} />
              <View style={s.statCol}>
                <View style={s.statLabel}>
                  <MaterialIcons name="lock-outline" size={14} color={colors.error} />
                  <Text style={s.statLabelText}>{t('mobile.outstanding', { defaultValue: 'Outstanding' })}</Text>
                </View>
                <Text style={s.statValue}>{formatCurrency(stats.dueAmount, countrySettings)}</Text>
              </View>
            </View>
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
              <View style={s.orderList}>
                {recentOrders.map((order: any) => {
                  const orderId = order.publicId || `ORD-${order.id?.slice(-4) || '??'}`;
                  const itemCount = (order.items || []).reduce((sum: number, i: any) => sum + (i.quantity || 1), 0);
                  const total = Math.round(order.financials?.total || 0);
                  const balance = Math.round(order.financials?.balance ?? ((order.financials?.total || 0) - (order.financials?.amountPaid || 0)));
                  const isPaid = balance <= 0;
                  const paymentLabel = isPaid ? t('mobile.paid', { defaultValue: 'PAID' }) : t('mobile.unpaid', { defaultValue: 'UNPAID' });
                  const dateStr = formatTimeAgo(order.createdAt, t, i18n.language);

                  return (
                    <TouchableOpacity
                      key={order.id}
                      style={s.orderCard}
                      activeOpacity={0.7}
                      onPress={() => onViewOrder?.(order.id)}
                    >
                      <View style={[s.accentBar, { backgroundColor: isPaid ? colors.primary : colors.error }]} />
                      <View style={{ flex: 1, paddingLeft: 12 }}>
                        <View style={s.ocHeader}>
                          <Text style={[s.ocId, { color: isPaid ? colors.primary : colors.error }]}>
                            {orderId} • {paymentLabel}
                          </Text>
                          <Text style={s.ocPrice}>{formatCurrency(total, countrySettings)}</Text>
                        </View>
                        <Text style={s.ocCustomer} numberOfLines={1}>{order.customerName || t('mobile.guestCustomer')}</Text>
                        <View style={s.ocMeta}>
                          <Text style={s.ocMetaText}>{itemCount} {t('mobile.items', { defaultValue: 'Items' })}</Text>
                          <Text style={s.ocMetaText}>{dateStr}</Text>
                        </View>
                        {!isPaid && (
                          <Text style={s.ocFooter}>
                            {t('mobile.dueLabel', { defaultValue: 'Due' })}: {formatCurrency(balance, countrySettings)}
                          </Text>
                        )}
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
    width: 36, height: 36, borderRadius: 10, backgroundColor: colors.darkBlue,
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

  // Card
  card: {
    backgroundColor: colors.surface, borderRadius: radii.card, padding: 16,
    ...shadows.card, ...shadows.cardBorder,
    gap: 16,
  },

  // Search
  searchWrapper: { position: 'relative', justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 14, zIndex: 1 },
  searchInput: {
    paddingVertical: 14, paddingLeft: 44, paddingRight: 14,
    borderRadius: radii.input, borderWidth: 1, borderColor: colors.border,
    fontSize: 15, fontFamily: fonts.semibold, color: colors.text,
  },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: 12 },
  btnSecondary: {
    flex: 1, paddingVertical: 14, borderRadius: radii.input,
    backgroundColor: colors.primaryTint,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnSecondaryText: { fontSize: 15, fontFamily: fonts.bold, color: colors.primary },
  btnPrimary: {
    flex: 1, paddingVertical: 14, borderRadius: radii.input,
    backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnPrimaryText: { fontSize: 15, fontFamily: fonts.bold, color: colors.surface },

  // Stats Card
  statsCard: {
    backgroundColor: colors.surface, borderRadius: radii.card,
    paddingHorizontal: 12, paddingVertical: 8,
    ...shadows.card, ...shadows.cardBorder,
    gap: 6,
  },
  statsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 6,
  },
  statsTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statsTitleText: { fontSize: 13, fontFamily: fonts.bold, color: colors.text },
  statsBadge: {
    backgroundColor: colors.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
  },
  statsBadgeText: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textSecondary },
  statsRow: { flexDirection: 'row', paddingTop: 0 },
  statCol: { flex: 1, gap: 0 },
  statColDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: 12 },
  statLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLabelText: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textSecondary },
  statValue: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },

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

  // Order Cards
  orderList: { gap: 12 },
  orderCard: {
    backgroundColor: colors.surface, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.border,
    ...shadows.card,
    overflow: 'hidden', flexDirection: 'row',
    padding: 14, paddingLeft: 0,
  },
  accentBar: {
    width: 4, borderTopLeftRadius: radii.card, borderBottomLeftRadius: radii.card,
    position: 'absolute', left: 0, top: 12, bottom: 12,
    borderTopRightRadius: 4, borderBottomRightRadius: 4,
  },
  ocHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  ocId: { fontSize: 12, fontFamily: fonts.bold, flexDirection: 'row', alignItems: 'center' },
  ocPrice: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  ocCustomer: { fontSize: 16, fontFamily: fonts.bold, color: colors.text, marginBottom: 4 },
  ocMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  ocMetaText: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary },
  ocFooter: { fontSize: 13, fontFamily: fonts.semibold, color: colors.error, marginTop: 4 },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary },
  emptySubtitle: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
});
