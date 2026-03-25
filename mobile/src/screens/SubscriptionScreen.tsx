import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import functions from '@react-native-firebase/functions';
import { WebView } from 'react-native-webview';

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
  const [shopData, setShopData] = useState<any>(null);
  const [payLoadingPlanId, setPayLoadingPlanId] = useState<string | null>(null);
  const [checkoutHtml, setCheckoutHtml] = useState<string | null>(null);

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
              .sort((a: PlanDoc, b: PlanDoc) => (a.prices?.monthly || 0) - (b.prices?.monthly || 0));
            setPlans(list);
            setLoading(false);
          },
          () => setLoading(false)
        );

      if (shopId) {
        firestore().collection('shops').doc(shopId).get().then((d: any) => {
          if (d.exists) setShopData(d.data());
        }).catch(() => {});

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
    };
  }, [shopId]);

  const currentPlanId = useMemo(() => {
    return (sub?.planId || sub?.planName || 'free')?.toLowerCase();
  }, [sub]);

  const startCheckout = async (plan: PlanDoc) => {
    if (!shopId) return;
    if (payLoadingPlanId) return;
    try {
      setPayLoadingPlanId(plan.id);
      const createOrder = functions().httpsCallable('createRazorpayOrder');
      const result: any = await createOrder({
        planId: plan.id,
        billingCycle: cycle,
        shopId,
      });

      const orderId = result?.data?.orderId;
      const key = result?.data?.key || process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID;
      const amount = result?.data?.amount || 0;

      if (!orderId || !key) {
        throw new Error('Unable to initialize payment.');
      }

      const prefillName = shopData?.name || 'LaundryBill';
      const prefillEmail = shopData?.email || '';
      const prefillPhone = String(shopData?.phone || '').replace(/\D/g, '');
      const notes = {
        shopId,
        planId: plan.id,
        billingCycle: cycle,
      };

      const html = `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
    <style>
      html, body { margin:0; padding:0; background:#0f172a; color:#fff; font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif; }
      .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; }
      .card { text-align:center; padding:24px; }
      .title { font-size:16px; opacity:.85; margin-bottom:8px; }
      .amount { font-size:28px; font-weight:700; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="title">Opening secure payment</div>
        <div class="amount">${amount ? `INR ${Math.round(Number(amount) / 100)}` : ''}</div>
      </div>
    </div>
    <script>
      (function () {
        var sent = false;
        function send(type, payload) {
          if (sent && (type === 'dismiss')) return;
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload || {} }));
          }
          if (type !== 'error') sent = true;
        }
        var options = {
          key: ${JSON.stringify(key)},
          order_id: ${JSON.stringify(orderId)},
          amount: ${JSON.stringify(amount)},
          currency: 'INR',
          name: 'LaundryBill',
          description: ${JSON.stringify(`${plan.name || plan.id} (${cycle})`)},
          prefill: {
            name: ${JSON.stringify(prefillName)},
            email: ${JSON.stringify(prefillEmail)},
            contact: ${JSON.stringify(prefillPhone)}
          },
          notes: ${JSON.stringify(notes)},
          theme: { color: '#00408f' },
          handler: function (response) {
            send('success', response || {});
          },
          modal: {
            ondismiss: function () {
              send('dismiss', {});
            }
          }
        };
        try {
          var rz = new Razorpay(options);
          rz.on('payment.failed', function (resp) {
            send('failed', resp && resp.error ? resp.error : {});
          });
          rz.open();
        } catch (e) {
          send('error', { message: e && e.message ? e.message : 'Checkout initialization failed' });
        }
      })();
    </script>
  </body>
</html>`;
      setCheckoutHtml(html);
    } catch (e: any) {
      Alert.alert(t('mobile.paymentErrorTitle'), e?.message || t('mobile.couldNotStartPayment'));
    } finally {
      setPayLoadingPlanId(null);
    }
  };

  const closeCheckout = () => setCheckoutHtml(null);

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

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
        {plans.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="subscriptions" size={42} color="#c3c6d6" />
            <Text style={styles.emptyText}>{t('mobile.noPlansAdmin')}</Text>
          </View>
        ) : (
          plans.map((plan) => {
            const price = cycle === 'yearly' ? (plan.prices?.yearly ?? 0) : (plan.prices?.monthly ?? 0);
            const isCurrent = currentPlanId === plan.id.toLowerCase();
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
                  {price === 0 ? t('mobile.planFree') : `₹${Math.round(price).toLocaleString()}`}
                  {price === 0 ? '' : <Text style={styles.priceUnit}>{cycle === 'yearly' ? t('mobile.pricePerYr') : t('mobile.pricePerMo')}</Text>}
                </Text>

                <View style={styles.limitsRow}>
                  <Text style={styles.limitItem}>{t('mobile.limitOrders', { value: formatLimit(plan.limits?.maxOrders, t) })}</Text>
                  <Text style={styles.limitItem}>{t('mobile.limitCustomers', { value: formatLimit(plan.limits?.maxCustomers, t) })}</Text>
                  <Text style={styles.limitItem}>{t('mobile.limitStaff', { value: formatLimit(plan.limits?.maxStaff, t) })}</Text>
                </View>

                <TouchableOpacity
                  style={[styles.chooseBtn, isCurrent && styles.chooseBtnDisabled]}
                  disabled={isCurrent || payLoadingPlanId === plan.id}
                  onPress={() => startCheckout(plan)}
                >
                  {payLoadingPlanId === plan.id ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                  <Text style={[styles.chooseBtnText, isCurrent && styles.chooseBtnTextDisabled]}>
                    {isCurrent ? t('mobile.currentPlanBtn') : t('mobile.requestUpgrade')}
                  </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={!!checkoutHtml} animationType="slide" onRequestClose={closeCheckout}>
        <View style={styles.checkoutHeader}>
          <TouchableOpacity onPress={closeCheckout} style={styles.iconBtn}>
            <MaterialIcons name="close" size={24} color="#191c1e" />
          </TouchableOpacity>
          <Text style={styles.checkoutTitle}>{t('mobile.secureCheckout')}</Text>
          <View style={styles.iconBtn} />
        </View>
        {checkoutHtml ? (
          <WebView
            originWhitelist={['*']}
            source={{ html: checkoutHtml }}
            onMessage={(event) => {
              try {
                const msg = JSON.parse(event.nativeEvent.data || '{}');
                const type = msg?.type;
                if (type === 'success') {
                  closeCheckout();
                  Alert.alert(t('mobile.paymentSuccessTitle'), t('mobile.paymentSuccessMsg'));
                } else if (type === 'failed') {
                  closeCheckout();
                  Alert.alert(t('mobile.paymentFailedTitle'), msg?.payload?.description || t('mobile.paymentFailedMsg'));
                } else if (type === 'dismiss') {
                  closeCheckout();
                } else if (type === 'error') {
                  closeCheckout();
                  Alert.alert(t('mobile.paymentErrorTitle'), msg?.payload?.message || t('mobile.paymentCheckoutError'));
                }
              } catch (_) {
                closeCheckout();
              }
            }}
          />
        ) : null}
      </Modal>
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
  checkoutHeader: {
    height: 54,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(195,198,214,0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkoutTitle: { fontSize: 16, fontWeight: '700', color: '#191c1e' },
  emptyState: { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyText: { fontSize: 13, color: '#737685' },
});
