import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import functions from '@react-native-firebase/functions';
import { endAppleIap, getAppleSubscriptionDisplayPrice, getIosProductId, initAppleIap, isAppleIapAvailable, normalizeReceipt, requestAppleSubscription, restoreAppleSubscriptions } from '../lib/billing/appleIap';
import { endGoogleIap, finishGoogleTransaction, getAndroidProductId, getGoogleSubscriptionDisplayPrice, initGoogleIap, isGoogleIapAvailable, normalizeGooglePurchase, requestGoogleSubscription, restoreGoogleSubscriptions } from '../lib/billing/googleIap';

type PlanDoc = {
  id: string;
  name?: string;
  description?: string;
  badge?: string;
  isActive?: boolean;
  prices?: { monthly?: number; yearly?: number };
  limits?: {
    maxOrders?: number;
    maxCustomers?: number;
    maxStaff?: number;
  };
};

const PRIMARY_PAID_PLAN_ID = (process.env.EXPO_PUBLIC_PRIMARY_PLAN_ID || 'pro').toLowerCase();

function formatLimit(v: number | undefined, t: (k: string) => string) {
  if (v === -1) return t('mobile.unlimited');
  return String(v ?? 0);
}

export default function SubscriptionScreen({
  onBack,
}: {
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const shopId = getShopId();
  const [plans, setPlans] = useState<PlanDoc[]>([]);
  const [sub, setSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [storePricesByPlanId, setStorePricesByPlanId] = useState<Record<string, string>>({});
  const [loadingStorePrices, setLoadingStorePrices] = useState(false);
  const [payLoadingPlanId, setPayLoadingPlanId] = useState<string | null>(null);
  const [purchaseState, setPurchaseState] = useState<'idle' | 'initiated' | 'pending_verify' | 'active' | 'failed' | 'cancelled'>('idle');
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let unsubPlans: (() => void) | undefined;
    let unsubSub: (() => void) | undefined;
    try {
      unsubPlans = firestore()
        .collection('plans')
        .onSnapshot(
          (snap: any) => {
            const list: PlanDoc[] = snap.docs
              .map((d: any) => ({ id: d.id, ...d.data() }))
              .filter((p: PlanDoc) => p.isActive !== false)
              .filter((p: PlanDoc) => p.id.toLowerCase() === PRIMARY_PAID_PLAN_ID)
              .sort((a: PlanDoc, b: PlanDoc) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
            setPlans(list);
            setLoading(false);
          },
          () => setLoading(false)
        );

      if (shopId) {
        unsubSub = firestore()
          .collection('subscriptions')
          .doc(shopId)
          .onSnapshot((doc: any) => {
            if (doc.exists) setSub(doc.data());
          });
      }
    } catch (_) {
      setLoading(false);
    }
    return () => {
      unsubPlans?.();
      unsubSub?.();
      endAppleIap().catch(() => {});
      endGoogleIap().catch(() => {});
    };
  }, [shopId]);

  const currentPlanId = useMemo(() => {
    return (sub?.planId || sub?.planName || 'free')?.toLowerCase();
  }, [sub]);

  useEffect(() => {
    let cancelled = false;

    const loadStorePrices = async () => {
      if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
        if (!cancelled) setStorePricesByPlanId({});
        return;
      }

      if (!Array.isArray(plans) || plans.length === 0) {
        if (!cancelled) setStorePricesByPlanId({});
        return;
      }

      try {
        setLoadingStorePrices(true);
        const entries = await Promise.all(
          plans.map(async (plan) => {
            try {
              if (Platform.OS === 'android') {
                if (!isGoogleIapAvailable()) return [plan.id, null] as const;
                await initGoogleIap();
                const productId = getAndroidProductId(plan.id, cycle);
                const price = await getGoogleSubscriptionDisplayPrice(productId);
                return [plan.id, price] as const;
              }

              if (!isAppleIapAvailable()) return [plan.id, null] as const;
              await initAppleIap();
              const productId = getIosProductId(plan.id, cycle);
              const price = await getAppleSubscriptionDisplayPrice(productId);
              return [plan.id, price] as const;
            } catch (_) {
              return [plan.id, null] as const;
            }
          })
        );

        if (cancelled) return;
        const next: Record<string, string> = {};
        for (const [planId, price] of entries) {
          if (typeof price === 'string' && price.length > 0) {
            next[planId] = price;
          }
        }
        setStorePricesByPlanId(next);
      } finally {
        if (!cancelled) setLoadingStorePrices(false);
      }
    };

    loadStorePrices();

    return () => {
      cancelled = true;
    };
  }, [plans, cycle]);

  const startAndroidPurchase = async (plan: PlanDoc) => {
    if (!shopId) return;
    if (Platform.OS !== 'android') return;
    if (payLoadingPlanId) return;
    if (!isGoogleIapAvailable()) {
      Alert.alert('Google Play Billing unavailable', 'Install native billing dependency and test on Android device.');
      return;
    }
    try {
      setPurchaseError(null);
      setPurchaseState('initiated');
      setPayLoadingPlanId(plan.id);
      await initGoogleIap();
      const productId = getAndroidProductId(plan.id, cycle);
      const purchase = await requestGoogleSubscription(productId);
      const normalized = normalizeGooglePurchase(purchase);
      if (!normalized.purchaseToken) {
        throw new Error('Missing Google purchase token');
      }
      setPurchaseState('pending_verify');
      const verifyGooglePurchase = functions().httpsCallable('verifyGooglePurchase');
      await verifyGooglePurchase({
        planId: plan.id,
        billingCycle: cycle,
        shopId,
        purchaseToken: normalized.purchaseToken,
        transactionId: normalized.transactionId,
        productId: normalized.productId,
        rawData: normalized.rawData,
        signature: normalized.signature,
      });
      const verified = await waitForSubscriptionActivation(plan.id);
      if (verified) {
        await finishGoogleTransaction(purchase as any).catch(() => {});
        Alert.alert(t('mobile.paymentSuccessTitle'), 'Subscription activated successfully.');
      } else {
        Alert.alert(t('mobile.paymentSuccessTitle'), 'Purchase submitted. Verification in progress.');
      }
    } catch (e: any) {
      setPurchaseState('failed');
      setPurchaseError(e?.message || t('mobile.couldNotStartPayment'));
      Alert.alert(t('mobile.paymentErrorTitle'), e?.message || t('mobile.couldNotStartPayment'));
    } finally {
      setPayLoadingPlanId(null);
    }
  };

  const startIosPurchase = async (plan: PlanDoc) => {
    if (!shopId) return;
    if (payLoadingPlanId) return;
    if (!isAppleIapAvailable()) {
      Alert.alert('Apple IAP unavailable', 'Install native billing dependency and test on iOS device.');
      return;
    }
    try {
      setPayLoadingPlanId(plan.id);
      setPurchaseState('initiated');
      setPurchaseError(null);
      await initAppleIap();
      const productId = getIosProductId(plan.id, cycle);
      const purchase = await requestAppleSubscription(productId);
      const normalized = normalizeReceipt(purchase);
      if (!normalized.receiptData) throw new Error('Missing purchase receipt');

      setPurchaseState('pending_verify');
      const verifyApplePurchase = functions().httpsCallable('verifyApplePurchase');
      await verifyApplePurchase({
        shopId,
        planId: plan.id,
        billingCycle: cycle,
        receiptData: normalized.receiptData,
        transactionId: normalized.transactionId,
        originalTransactionId: normalized.originalTransactionId,
        productId: normalized.productId,
      });
      const verified = await waitForSubscriptionActivation(plan.id);
      if (verified) {
        Alert.alert(t('mobile.paymentSuccessTitle'), 'Subscription activated successfully.');
      } else {
        Alert.alert(t('mobile.paymentSuccessTitle'), 'Purchase submitted. Verification in progress.');
      }
    } catch (e: any) {
      setPurchaseState('failed');
      setPurchaseError(e?.message || 'Unable to complete purchase.');
      Alert.alert(t('mobile.paymentErrorTitle'), e?.message || 'Unable to complete purchase.');
    } finally {
      setPayLoadingPlanId(null);
    }
  };

  const restorePurchases = async () => {
    if (!shopId) return;
    if (Platform.OS === 'ios' && !isAppleIapAvailable()) {
      Alert.alert('Apple IAP unavailable', 'Restore requires iOS native IAP support.');
      return;
    }
    if (Platform.OS === 'android' && !isGoogleIapAvailable()) {
      Alert.alert('Google Play Billing unavailable', 'Restore requires Android native billing support.');
      return;
    }
    try {
      setRestoring(true);
      const purchases = Platform.OS === 'ios'
        ? await (async () => { await initAppleIap(); return restoreAppleSubscriptions(); })()
        : await (async () => { await initGoogleIap(); return restoreGoogleSubscriptions(); })();
      if (!Array.isArray(purchases) || purchases.length === 0) {
        Alert.alert('Restore Purchases', 'No previous purchases found.');
        return;
      }
      const latest = purchases[purchases.length - 1] as any;

      if (Platform.OS === 'ios') {
        const normalized = normalizeReceipt(latest);
        const restorePlanId = plans.find((p) => normalized.productId?.includes(p.id))?.id || sub?.planId || "pro";
        const restoreCycle: "monthly" | "yearly" = normalized.productId?.includes("yearly") ? "yearly" : "monthly";
        if (!normalized.receiptData) {
          Alert.alert('Restore Purchases', 'Could not read receipt from restored purchase.');
          return;
        }
        const verifyApplePurchase = functions().httpsCallable('verifyApplePurchase');
        await verifyApplePurchase({
          shopId,
          planId: restorePlanId,
          billingCycle: restoreCycle,
          receiptData: normalized.receiptData,
          transactionId: normalized.transactionId,
          originalTransactionId: normalized.originalTransactionId,
          productId: normalized.productId,
          isRestore: true,
        });
        setPurchaseState('pending_verify');
        const verified = await waitForSubscriptionActivation(restorePlanId);
        if (verified) {
          Alert.alert('Restore Purchases', 'Your subscription has been restored.');
        } else {
          Alert.alert('Restore Purchases', 'Restore submitted. Verification in progress.');
        }
      } else {
        const normalized = normalizeGooglePurchase(latest);
        const restorePlanId = plans.find((p) => normalized.productId?.includes(p.id))?.id || sub?.planId || "pro";
        const restoreCycle: "monthly" | "yearly" = normalized.productId?.includes("yearly") ? "yearly" : "monthly";
        if (!normalized.purchaseToken) {
          Alert.alert('Restore Purchases', 'Could not read purchase token from restored purchase.');
          return;
        }
        const verifyGooglePurchase = functions().httpsCallable('verifyGooglePurchase');
        await verifyGooglePurchase({
          shopId,
          planId: restorePlanId,
          billingCycle: restoreCycle,
          purchaseToken: normalized.purchaseToken,
          transactionId: normalized.transactionId,
          productId: normalized.productId,
          rawData: normalized.rawData,
          signature: normalized.signature,
          isRestore: true,
        });
        setPurchaseState('pending_verify');
        const verified = await waitForSubscriptionActivation(restorePlanId);
        if (verified) {
          Alert.alert('Restore Purchases', 'Your subscription has been restored.');
        } else {
          Alert.alert('Restore Purchases', 'Restore submitted. Verification in progress.');
        }
      }
    } catch (e: any) {
      setPurchaseState('failed');
      setPurchaseError(e?.message || 'Unable to restore purchases.');
      Alert.alert('Restore Purchases', e?.message || 'Unable to restore purchases.');
    } finally {
      setRestoring(false);
    }
  };

  const waitForSubscriptionActivation = async (planId: string) => {
    if (!shopId) return false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        const snap = await firestore().collection('subscriptions').doc(shopId).get();
        const data = snap.data() as any;
        if (
          data?.status === 'active' &&
          String(data?.planId || '').toLowerCase() === String(planId).toLowerCase()
        ) {
          setPurchaseState('active');
          return true;
        }
      } catch (_) {
        // ignore and retry
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    setPurchaseState('pending_verify');
    return false;
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#00408f" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
          <MaterialIcons name="arrow-back" size={24} color="#00408f" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('mobile.subscriptionPlansTitle')}</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.cycleRow}>
        <TouchableOpacity
          style={[styles.cycleBtn, cycle === 'monthly' && styles.cycleBtnActive]}
          onPress={() => setCycle('monthly')}
        >
          <Text style={[styles.cycleText, cycle === 'monthly' && styles.cycleTextActive]}>{t('mobile.billingMonthly')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cycleBtn, cycle === 'yearly' && styles.cycleBtnActive]}
          onPress={() => setCycle('yearly')}
        >
          <Text style={[styles.cycleText, cycle === 'yearly' && styles.cycleTextActive]}>{t('mobile.billingYearly')}</Text>
        </TouchableOpacity>
      </View>
      {Platform.OS === 'ios' || Platform.OS === 'android' ? (
        <View style={styles.restoreRow}>
          <TouchableOpacity style={styles.restoreBtn} onPress={restorePurchases} disabled={restoring}>
            {restoring ? <ActivityIndicator size="small" color="#00408f" /> : <Text style={styles.restoreBtnText}>Restore Purchases</Text>}
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
        {purchaseState === 'pending_verify' ? (
          <View style={styles.pendingBanner}>
            <Text style={styles.pendingBannerText}>{t('mobile.paymentSuccessMsg')}</Text>
            <Text style={styles.pendingBannerSubText}>Waiting for secure payment verification...</Text>
          </View>
        ) : null}
        {purchaseState === 'failed' && purchaseError ? (
          <View style={styles.failedBanner}>
            <Text style={styles.failedBannerText}>{purchaseError}</Text>
          </View>
        ) : null}
        {plans.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="subscriptions" size={42} color="#c3c6d6" />
            <Text style={styles.emptyText}>{t('mobile.noPlansAdmin')}</Text>
          </View>
        ) : (
          plans.map((plan) => {
            const isCurrent = currentPlanId === plan.id.toLowerCase();
            const storePrice = storePricesByPlanId[plan.id] || '';
            const canPurchase = storePrice.length > 0;
            return (
              <View key={plan.id} style={[styles.planCard, isCurrent && styles.currentCard]}>
                <View style={styles.planTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text style={styles.planName}>{plan.name || plan.id}</Text>
                      {plan.badge ? <View style={styles.badge}><Text style={styles.badgeText}>{plan.badge}</Text></View> : null}
                    </View>
                    <Text style={styles.planDesc}>{plan.description || t('mobile.subscriptionPlanDefault')}</Text>
                  </View>
                  {isCurrent ? (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>{t('mobile.currentPlanBadge')}</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.price}>
                  {storePrice || (loadingStorePrices ? 'Loading store price...' : 'Price unavailable')}
                  {storePrice ? <Text style={styles.priceUnit}>{cycle === 'yearly' ? t('mobile.pricePerYr') : t('mobile.pricePerMo')}</Text> : null}
                </Text>

                <View style={styles.limitsRow}>
                  <Text style={styles.limitItem}>{t('mobile.limitOrders', { value: formatLimit(plan.limits?.maxOrders, t) })}</Text>
                  <Text style={styles.limitItem}>{t('mobile.limitCustomers', { value: formatLimit(plan.limits?.maxCustomers, t) })}</Text>
                  <Text style={styles.limitItem}>{t('mobile.limitStaff', { value: formatLimit(plan.limits?.maxStaff, t) })}</Text>
                </View>

                <TouchableOpacity
                  style={[styles.chooseBtn, (isCurrent || !canPurchase) && styles.chooseBtnDisabled]}
                  disabled={isCurrent || !canPurchase || payLoadingPlanId === plan.id || purchaseState === 'pending_verify'}
                  onPress={() => (Platform.OS === 'ios' ? startIosPurchase(plan) : startAndroidPurchase(plan))}
                >
                  {payLoadingPlanId === plan.id ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                  <Text style={[styles.chooseBtnText, (isCurrent || !canPurchase) && styles.chooseBtnTextDisabled]}>
                    {isCurrent
                      ? t('mobile.currentPlanBtn')
                      : !canPurchase
                        ? 'Store price unavailable'
                      : purchaseState === 'pending_verify'
                        ? 'Verifying payment...'
                        : Platform.OS === 'android'
                          ? t('mobile.requestUpgrade')
                          : 'Subscribe with Apple'}
                  </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fb' },
  header: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(195,198,214,0.25)',
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#191c1e' },
  cycleRow: {
    margin: 16,
    backgroundColor: '#e7e8ea',
    borderRadius: 10,
    padding: 4,
    flexDirection: 'row',
    gap: 6,
  },
  cycleBtn: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  cycleBtnActive: { backgroundColor: '#ffffff' },
  cycleText: { fontSize: 13, fontWeight: '700', color: '#737685' },
  cycleTextActive: { color: '#00408f' },
  restoreRow: { paddingHorizontal: 16, marginTop: -6, marginBottom: 10 },
  restoreBtn: {
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: '#bed4ff',
    backgroundColor: '#edf4ff',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restoreBtnText: { color: '#00408f', fontSize: 12, fontWeight: '700' },
  scrollContent: { paddingHorizontal: 16, gap: 10 },
  planCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(195,198,214,0.25)',
    gap: 8,
  },
  currentCard: { borderColor: '#00408f' },
  planTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' },
  planName: { fontSize: 16, fontWeight: '800', color: '#191c1e' },
  planDesc: { fontSize: 12, color: '#737685' },
  badge: { backgroundColor: '#fff3e0', borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10, color: '#e65100', fontWeight: '700' },
  currentBadge: { backgroundColor: '#e8f5e9', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  currentBadgeText: { fontSize: 10, color: '#2e7d32', fontWeight: '700' },
  price: { fontSize: 24, fontWeight: '800', color: '#00408f' },
  priceUnit: { fontSize: 13, fontWeight: '600', color: '#737685' },
  limitsRow: { gap: 2 },
  limitItem: { fontSize: 12, color: '#434654' },
  chooseBtn: {
    marginTop: 4,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#00408f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chooseBtnDisabled: { backgroundColor: '#e7e8ea' },
  chooseBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  chooseBtnTextDisabled: { color: '#434654' },
  emptyState: { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyText: { fontSize: 13, color: '#737685' },
  pendingBanner: {
    backgroundColor: '#e8f0ff',
    borderWidth: 1,
    borderColor: '#bed4ff',
    borderRadius: 10,
    padding: 10,
    gap: 3,
  },
  pendingBannerText: { color: '#00408f', fontSize: 13, fontWeight: '700' },
  pendingBannerSubText: { color: '#3567ad', fontSize: 12 },
  failedBanner: {
    backgroundColor: '#ffecec',
    borderWidth: 1,
    borderColor: '#ffcbcb',
    borderRadius: 10,
    padding: 10,
  },
  failedBannerText: { color: '#aa2222', fontSize: 12, fontWeight: '600' },
});
