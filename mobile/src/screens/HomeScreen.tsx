import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import { useMergedOrdersUsed } from '../lib/useBillingPeriodOrderCount';
import { useShopCountrySettings } from '../lib/use-shop-country-settings';
import { formatCurrency } from '../lib/currency-format';

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

function getStatusConfig(status: string, t: TFunction) {
  switch (status) {
    case 'pending': return { label: t('mobile.orderStatusPending'), color: '#e65100', bg: '#fff3e0' };
    case 'processing': case 'washing': case 'drying': case 'ironing': case 'folding':
      return { label: t('mobile.orderStatusInProgress'), color: '#f9a825', bg: '#fff8e1' };
    case 'ready': case 'ready_for_pickup': case 'ready_for_delivery':
      return { label: t('mobile.orderStatusReady'), color: '#2e7d32', bg: '#e8f5e9' };
    case 'out_for_delivery': return { label: t('mobile.orderStatusDelivery'), color: '#1565c0', bg: '#e3f2fd' };
    case 'delivered': case 'picked_up': return { label: t('mobile.orderStatusCompleted'), color: '#2e7d32', bg: '#e8f5e9' };
    case 'cancelled': return { label: t('mobile.orderStatusCancelled'), color: '#c62828', bg: '#fce4ec' };
    default: return { label: status || t('mobile.orderStatusUnknown'), color: '#434654', bg: '#f3f4f6' };
  }
}

export default function HomeScreen({
  onNewOrder,
  onScanQR,
  onExpense,
  onDueOrders,
  onViewOrders,
  onViewOrder,
  onOpenSubscription,
}: {
  onNewOrder?: () => void;
  onScanQR?: () => void;
  onExpense?: () => void;
  onDueOrders?: () => void;
  onViewOrders?: () => void;
  onViewOrder?: (id: string) => void;
  onOpenSubscription?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const shopId = getShopId();
  const countrySettings = useShopCountrySettings(shopId);
  const withCurrencySymbol = (text: string) => text.replace(/₹/g, countrySettings.currencySymbol || '₹');
  const [shopData, setShopData] = useState<any>(null);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [stats, setStats] = useState({ pending: 0, completed: 0, collected: 0, inProgress: 0, dueCount: 0, dueAmount: 0 });
  const [loading, setLoading] = useState(true);

  const ordersUsed = useMergedOrdersUsed(subscriptionData, shopId);

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
          setRecentOrders(orders.slice(0, 5));
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
  const planKey = (subscriptionData?.planId || subscriptionData?.planName || shopData?.plan || 'free').toString().toLowerCase();
  const subStatus = (subscriptionData?.status || 'trial').toLowerCase();
  const orderLimit = subscriptionData?.limits?.maxOrders ?? 30;
  const isPaidPlan =
    subStatus === 'active' &&
    planKey !== 'free' &&
    planKey !== 'trial';
  const atFreeLimit = orderLimit > 0 && ordersUsed >= orderLimit && !isPaidPlan;
  const freeTierLabel =
    subStatus === 'trial' ? t('mobile.planStatusTrial') :
    subStatus === 'free' || planKey === 'free' ? t('mobile.planStatusFree') :
    t('mobile.planStatusFree');
  const paidPlanShort = (subscriptionData?.planName || planKey || 'plan')
    .replace(/_/g, ' ')
    .split(' ')
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .slice(0, 12);

  const SubBadgeWrap = onOpenSubscription ? TouchableOpacity : View;
  const subBadgeWrapProps = onOpenSubscription
    ? { onPress: onOpenSubscription, activeOpacity: 0.75, accessibilityRole: 'button' as const, accessibilityLabel: t('mobile.subscriptionAccessibilityLabel') }
    : {};

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.shopInitial}>
            <Text style={styles.shopInitialText}>{shopName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.shopName} numberOfLines={1}>{shopName}</Text>
        </View>
        <View style={styles.notifBtn}>
          {isPaidPlan ? (
            <SubBadgeWrap {...subBadgeWrapProps} style={styles.subBadgePaid}>
              <MaterialIcons name="workspace-premium" size={12} color="#00408f" />
              <Text style={styles.subBadgePaidText} numberOfLines={1}>{paidPlanShort}</Text>
            </SubBadgeWrap>
          ) : (
            <SubBadgeWrap
              {...subBadgeWrapProps}
              style={[styles.subBadgeFree, atFreeLimit && styles.subBadgeFreeLimit]}
            >
              <Text style={[styles.subBadgeFreeLabel, atFreeLimit && styles.subBadgeFreeLabelLimit]}>
                {freeTierLabel}
              </Text>
              {atFreeLimit ? (
                <Text style={styles.subBadgeUpgradeHint} numberOfLines={2}>
                  {t('mobile.subscriptionUpgradeLimit')}
                </Text>
              ) : (
                <Text style={styles.subBadgeUsageText}>
                  {ordersUsed}/{orderLimit}
                </Text>
              )}
            </SubBadgeWrap>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        {/* Quick Actions — single row */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.8} onPress={onNewOrder}>
            <View style={[styles.actionIcon, { backgroundColor: '#00408f' }]}>
              <MaterialIcons name="add-shopping-cart" size={20} color="#fff" />
            </View>
            <Text style={styles.actionLabel}>{t('dashboard.newOrder')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.8} onPress={onScanQR}>
            <View style={[styles.actionIcon, { backgroundColor: '#006b5f' }]}>
              <MaterialIcons name="qr-code-scanner" size={20} color="#fff" />
            </View>
            <Text style={styles.actionLabel}>{t('mobile.scanQr')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.8} onPress={onExpense}>
            <View style={[styles.actionIcon, { backgroundColor: '#5e3c00' }]}>
              <MaterialIcons name="payments" size={20} color="#fff" />
            </View>
            <Text style={styles.actionLabel}>{t('common.expenses')}</Text>
          </TouchableOpacity>
        </View>

        {/* Stats — compact inline row */}
        {loading ? (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#00408f" />
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t('mobile.statsPending')}</Text>
                <Text style={[styles.statValue, { color: '#e65100' }]}>{stats.pending}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t('mobile.statsInProgress')}</Text>
                <Text style={[styles.statValue, { color: '#006b5f' }]}>{stats.inProgress}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t('mobile.statsCompleted')}</Text>
                <Text style={[styles.statValue, { color: '#2e7d32' }]}>{stats.completed}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t('mobile.statsCollected')}</Text>
                <Text style={[styles.statValue, { color: '#00408f', fontSize: 14 }]}>{formatCurrency(stats.collected, countrySettings)}</Text>
              </View>
            </View>

            {/* Due Orders Card */}
            {stats.dueCount > 0 && (
              <TouchableOpacity style={styles.dueCard} activeOpacity={0.7} onPress={onDueOrders}>
                <View style={styles.dueIconBg}>
                  <MaterialIcons name="warning-amber" size={20} color="#93000a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dueTitle}>{t('mobile.dueOrdersTitle', { count: stats.dueCount })}</Text>
                  <Text style={styles.dueAmount}>{withCurrencySymbol(t('mobile.dueTotal', { amount: stats.dueAmount.toLocaleString() }) as string)}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#93000a" />
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Recent Orders */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('dashboard.recentOrders')}</Text>
          <TouchableOpacity onPress={onViewOrders}><Text style={styles.viewAll}>{t('dashboard.viewAll')}</Text></TouchableOpacity>
        </View>

        {loading ? null : recentOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="receipt-long" size={44} color="#c3c6d6" />
            <Text style={styles.emptyTitle}>{t('mobile.recentOrdersEmpty')}</Text>
            <Text style={styles.emptySubtitle}>{t('mobile.recentOrdersEmptyHint')}</Text>
          </View>
        ) : (
          <View style={styles.orderList}>
            {recentOrders.map((order: any) => {
              const cfg = getStatusConfig(order.status, t);
              const orderId = order.publicId || `#${order.id?.slice(-4) || '??'}`;
              const itemCount = (order.items || []).reduce((s: number, i: any) => s + (i.quantity || 1), 0);
              const balance = Math.round(order.financials?.balance || 0);
              return (
                <TouchableOpacity
                  key={order.id}
                  style={styles.orderCard}
                  activeOpacity={0.7}
                  onPress={() => onViewOrder?.(order.id)}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.orderTopRow}>
                      <Text style={styles.orderId}>#{orderId}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                        <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.orderName} numberOfLines={1}>{order.customerName || t('mobile.guestCustomer')}</Text>
                    <View style={styles.orderMeta}>
                      <Text style={styles.orderMetaText}>{t('mobile.orderItemsCount', { count: itemCount })}</Text>
                      <View style={styles.dot} />
                      <Text style={styles.orderMetaText}>{formatTimeAgo(order.createdAt, t, i18n.language)}</Text>
                      {order.financials?.total ? (
                        <>
                          <View style={styles.dot} />
                          <Text style={styles.orderAmount}>{formatCurrency(Math.round(order.financials.total), countrySettings)}</Text>
                        </>
                      ) : null}
                      {balance > 0 ? (
                        <>
                          <View style={styles.dot} />
                          <Text style={styles.dueBadgeText}>{withCurrencySymbol(t('mobile.orderDueShort', { amount: balance.toLocaleString() }) as string)}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fb' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, height: 52, backgroundColor: '#f8f9fb',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  shopInitial: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#00408f', alignItems: 'center', justifyContent: 'center' },
  shopInitialText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  shopName: { fontSize: 18, fontWeight: '700', color: '#0f172a', flex: 1 },
  notifBtn: { flexShrink: 0, justifyContent: 'center', alignItems: 'flex-end', paddingLeft: 8, maxWidth: 160 },
  subBadgeFree: {
    minWidth: 56,
    maxWidth: 148,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#e0faf5',
    borderWidth: 1,
    borderColor: '#76f4e0',
    alignItems: 'center',
  },
  subBadgeFreeLimit: {
    backgroundColor: '#ffdad6',
    borderColor: '#ffb4ab',
  },
  subBadgeFreeLabel: { fontSize: 8, fontWeight: '800', color: '#006f63', letterSpacing: 0.4 },
  subBadgeFreeLabelLimit: { color: '#93000a' },
  subBadgeUsageText: { fontSize: 10, fontWeight: '700', color: '#00408f', marginTop: 1 },
  subBadgeUpgradeHint: {
    fontSize: 8,
    fontWeight: '700',
    color: '#93000a',
    marginTop: 2,
    textAlign: 'center',
    lineHeight: 10,
  },
  subBadgePaid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 140,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#90caf9',
  },
  subBadgePaidText: { fontSize: 10, fontWeight: '800', color: '#00408f' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  // Quick actions — single row of 3
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  actionCard: {
    flex: 1, backgroundColor: '#ffffff', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', gap: 8,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  actionIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 11, fontWeight: '700', color: '#191c1e' },

  // Stats — compact inline row
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: '#ffffff', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 6,
    alignItems: 'center',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  statLabel: { fontSize: 7, fontWeight: '700', color: '#737685', letterSpacing: 0.3, marginBottom: 2 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#00408f' },

  // Due card
  dueCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#ffdad6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 14,
  },
  dueIconBg: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
  },
  dueTitle: { fontSize: 13, fontWeight: '700', color: '#93000a' },
  dueAmount: { fontSize: 12, fontWeight: '600', color: '#93000a', opacity: 0.7, marginTop: 1 },

  // Section
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#191c1e' },
  viewAll: { fontSize: 12, fontWeight: '700', color: '#00408f' },

  // Orders
  orderList: { gap: 8 },
  orderCard: {
    backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  orderTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  orderId: { fontSize: 12, fontWeight: '700', color: '#00408f' },
  orderName: { fontSize: 14, fontWeight: '700', color: '#191c1e', marginBottom: 3 },
  orderMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderMetaText: { fontSize: 11, color: '#434654', fontWeight: '500' },
  orderAmount: { fontSize: 11, fontWeight: '700', color: '#191c1e' },
  dueBadgeText: { fontSize: 10, fontWeight: '700', color: '#93000a' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#c3c6d6' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#434654' },
  emptySubtitle: { fontSize: 12, color: '#737685' },
});
