import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HelpButton } from '../components/HelpButton';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import {
  addCustomerInfoListener,
  ENTITLEMENT_ID,
  getCurrentOffering,
  getCustomerInfo,
  hasProEntitlement,
  purchasePackage,
  restorePurchases,
  type PurchasesOffering,
  type PurchasesPackage,
} from '../lib/billing/revenuecat';
import { createNamedHttpsCallable } from '../lib/httpsCallable';

type PurchaseUIState = 'idle' | 'loading' | 'purchasing' | 'restoring' | 'syncing' | 'done' | 'failed';

export default function SubscriptionScreen({
  onBack,
}: {
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const shopId = getShopId();

  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [sub, setSub] = useState<any>(null);
  const [uiState, setUiState] = useState<PurchaseUIState>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);

  // ── Load current offering + subscription doc + entitlement ──────────────
  useEffect(() => {
    let unsubFirestore: (() => void) | undefined;

    const load = async () => {
      try {
        const [off, info] = await Promise.all([
          getCurrentOffering(),
          getCustomerInfo(),
        ]);
        setOffering(off);
        setIsPro(hasProEntitlement(info));
      } catch (e: any) {
        console.warn('[SubscriptionScreen] load error', e);
      } finally {
        setUiState('idle');
      }
    };
    load();

    // Firestore subscription doc (for status display)
    if (shopId) {
      try {
        unsubFirestore = firestore()
          .collection('subscriptions')
          .doc(shopId)
          .onSnapshot((doc: any) => {
            if (doc.exists) setSub(doc.data());
          });
      } catch (_) {}
    }

    // RC customer info listener — keeps isPro in sync
    const removeRcListener = addCustomerInfoListener((info) => {
      setIsPro(hasProEntitlement(info));
    });

    return () => {
      unsubFirestore?.();
      removeRcListener();
    };
  }, [shopId]);

  const currentPlanId = useMemo(() => {
    return (sub?.planId || sub?.planName || 'free')?.toLowerCase();
  }, [sub]);

  // ── Purchase a package via native Google Play / App Store checkout ────
  const handlePurchase = async (pkg: PurchasesPackage) => {
    if (uiState === 'purchasing' || uiState === 'syncing') return;
    try {
      setUiState('purchasing');
      setErrorMsg(null);

      const { customerInfo, cancelled } = await purchasePackage(pkg);
      if (cancelled) {
        setUiState('idle');
        return;
      }

      const entitled = hasProEntitlement(customerInfo);
      setIsPro(entitled);

      if (entitled) {
        setUiState('syncing');
        await syncEntitlementToFirestore(customerInfo);
        setUiState('done');
        Alert.alert(t('mobile.paymentSuccessTitle'), 'Subscription activated successfully.');
      } else {
        setUiState('idle');
        Alert.alert(t('mobile.paymentSuccessTitle'), 'Purchase submitted. Verification in progress.');
      }
    } catch (e: any) {
      setUiState('failed');
      setErrorMsg(e?.message || t('mobile.couldNotStartPayment'));
      Alert.alert(t('mobile.paymentErrorTitle'), e?.message || t('mobile.couldNotStartPayment'));
    }
  };

  // ── Restore purchases ─────────────────────────────────────────────────
  const handleRestore = async () => {
    if (uiState === 'restoring' || uiState === 'syncing') return;
    try {
      setUiState('restoring');
      setErrorMsg(null);

      const customerInfo = await restorePurchases();
      const entitled = hasProEntitlement(customerInfo);
      setIsPro(entitled);

      if (entitled) {
        setUiState('syncing');
        await syncEntitlementToFirestore(customerInfo);
        setUiState('done');
        Alert.alert('Restore Purchases', 'Your subscription has been restored.');
      } else {
        setUiState('idle');
        Alert.alert('Restore Purchases', 'No active subscription found.');
      }
    } catch (e: any) {
      setUiState('failed');
      setErrorMsg(e?.message || 'Unable to restore purchases.');
      Alert.alert('Restore Purchases', e?.message || 'Unable to restore purchases.');
    }
  };

  // ── Sync RC entitlement → Firestore (via Cloud Function) ──────────────
  const syncEntitlementToFirestore = async (info: any) => {
    if (!shopId) return;
    try {
      const entitlement = info.entitlements?.active?.[ENTITLEMENT_ID];
      if (!entitlement) return;

      const syncRcSubscription = createNamedHttpsCallable('syncRevenueCatSubscription');
      await syncRcSubscription({
        shopId,
        planId: 'pro',
        productIdentifier: entitlement.productIdentifier || '',
        expirationDate: entitlement.expirationDate || null,
        isActive: true,
        willRenew: entitlement.willRenew ?? true,
        store: entitlement.store || (Platform.OS === 'ios' ? 'app_store' : 'play_store'),
      });
    } catch (e) {
      console.warn('[SubscriptionScreen] sync to Firestore error', e);
      // Non-fatal — RC is the source of truth; Firestore will sync via webhook
    }
  };

  // ── Render ──────────────────────────────────────────────────────────��──
  if (uiState === 'loading') {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#00408f" />
      </View>
    );
  }

  const packages = offering?.availablePackages ?? [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
          <MaterialIcons name="arrow-back" size={24} color="#00408f" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('mobile.subscriptionPlansTitle')}</Text>
        <HelpButton pageId="mobile_subscription" />
      </View>

      {/* Restore button */}
      {(Platform.OS === 'ios' || Platform.OS === 'android') && (
        <View style={styles.restoreRow}>
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestore}
            disabled={uiState === 'restoring' || uiState === 'syncing'}
          >
            {uiState === 'restoring' ? (
              <ActivityIndicator size="small" color="#00408f" />
            ) : (
              <Text style={styles.restoreBtnText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
        {/* Status banners */}
        {uiState === 'syncing' && (
          <View style={styles.pendingBanner}>
            <Text style={styles.pendingBannerText}>{t('mobile.paymentSuccessMsg')}</Text>
            <Text style={styles.pendingBannerSubText}>Syncing your subscription...</Text>
          </View>
        )}
        {uiState === 'failed' && errorMsg && (
          <View style={styles.failedBanner}>
            <Text style={styles.failedBannerText}>{errorMsg}</Text>
          </View>
        )}
        {isPro && (
          <View style={styles.activeBanner}>
            <MaterialIcons name="verified" size={20} color="#2e7d32" />
            <Text style={styles.activeBannerText}>Laundrybill Pro is active</Text>
          </View>
        )}

        {/* Pro features */}
        <View style={styles.featuresCard}>
          <Text style={styles.featuresTitle}>Everything in Pro</Text>
          <View style={styles.featuresList}>
            <FeatureItem icon="all-inclusive" text="Unlimited orders every month" />
            <FeatureItem icon="people" text="Unlimited customers & staff" />
            <FeatureItem icon="link" text="Public tracking link for customers" />
            <FeatureItem icon="bar-chart" text="Reports & analytics" />
            <FeatureItem icon="qr-code-scanner" text="QR code scanning for orders" />
            <FeatureItem icon="receipt-long" text="WhatsApp receipts & multi-language" />
          </View>
          <View style={styles.webOnlySection}>
            <Text style={styles.webOnlyTitle}>Also included on Web Dashboard</Text>
            <Text style={styles.webOnlyItem}>• Staff management, attendance & payroll</Text>
            <Text style={styles.webOnlyItem}>• Driver / delivery agent app</Text>
            <Text style={styles.webOnlyItem}>• Plant processing dashboard</Text>
            <Text style={styles.webOnlyItem}>• Damage photos on pickup</Text>
            <Text style={styles.webOnlyItem}>• Public ordering page for your shop</Text>
          </View>
        </View>

        {/* Plan cards — each with a Subscribe button that opens native checkout */}
        {packages.length === 0 && !isPro ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="subscriptions" size={42} color="#c3c6d6" />
            <Text style={styles.emptyText}>Loading plans... If this persists, check your internet connection.</Text>
          </View>
        ) : (
          packages.map((pkg) => {
            const product = pkg.product;
            const isCurrentPkg = isPro && currentPlanId === 'pro';
            const isAnnual = pkg.packageType === 'ANNUAL';
            const isMonthly = pkg.packageType === 'MONTHLY';

            // Calculate savings for annual plan
            const monthlyPkg = packages.find((p) => p.packageType === 'MONTHLY');
            const annualSavingsText = isAnnual && monthlyPkg
              ? (() => {
                  const monthlyPrice = monthlyPkg.product.price;
                  const fullYearPrice = monthlyPrice * 12;
                  const annualPrice = product.price;
                  const saved = fullYearPrice - annualPrice;
                  const monthsSaved = Math.round(saved / monthlyPrice);
                  if (monthsSaved > 0 && saved > 0) {
                    return `Save ${monthsSaved} month${monthsSaved > 1 ? 's' : ''} — ${product.currencyCode === 'INR' ? '₹' : ''}${Math.round(fullYearPrice)} → ${product.priceString}`;
                  }
                  return null;
                })()
              : null;

            return (
              <View key={pkg.identifier} style={[styles.planCard, isCurrentPkg && styles.currentCard, isAnnual && !isCurrentPkg && styles.bestValueCard]}>
                {isAnnual && !isCurrentPkg && (
                  <View style={styles.bestValueBadge}>
                    <Text style={styles.bestValueText}>BEST VALUE</Text>
                  </View>
                )}
                <View style={styles.planTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text style={styles.planName}>
                        {isAnnual ? 'Yearly' : isMonthly ? 'Monthly' : product.title || pkg.identifier}
                      </Text>
                      {pkg.packageType === 'LIFETIME' && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>Lifetime</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.planDesc}>
                      {isMonthly
                        ? 'Full Pro access, billed monthly. Cancel anytime.'
                        : isAnnual
                          ? 'Full Pro access for 12 months. Pay once, save more.'
                          : product.description || 'Laundrybill Pro subscription'}
                    </Text>
                  </View>
                  {isCurrentPkg && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>{t('mobile.currentPlanBadge')}</Text>
                    </View>
                  )}
                </View>

                <View>
                  <Text style={styles.price}>
                    {product.priceString}
                    <Text style={styles.priceUnit}>
                      {isAnnual ? '/yr'
                        : isMonthly ? '/mo'
                        : pkg.packageType === 'LIFETIME' ? ' once'
                        : ''}
                    </Text>
                  </Text>
                  {isAnnual && monthlyPkg && (
                    <Text style={styles.perMonthBreakdown}>
                      That's just {product.currencyCode === 'INR' ? '₹' : ''}{Math.round(product.price / 12)}/mo
                    </Text>
                  )}
                  {annualSavingsText && (
                    <View style={styles.savingsBanner}>
                      <MaterialIcons name="local-offer" size={14} color="#2e7d32" />
                      <Text style={styles.savingsText}>{annualSavingsText}</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.chooseBtn, (isCurrentPkg || uiState === 'purchasing') && styles.chooseBtnDisabled]}
                  disabled={isCurrentPkg || uiState === 'purchasing' || uiState === 'syncing'}
                  onPress={() => handlePurchase(pkg)}
                >
                  {uiState === 'purchasing' ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={[styles.chooseBtnText, isCurrentPkg && styles.chooseBtnTextDisabled]}>
                      {isCurrentPkg
                        ? t('mobile.currentPlanBtn')
                        : pkg.packageType === 'LIFETIME'
                          ? 'Buy Lifetime'
                          : isAnnual
                            ? 'Subscribe & Save'
                            : 'Subscribe'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}

        {/* Manage subscription link */}
        {isPro && (
          <TouchableOpacity
            style={styles.manageBtn}
            onPress={() => {
              Alert.alert(
                'Manage Subscription',
                Platform.OS === 'ios'
                  ? 'To manage or cancel, go to Settings > Apple ID > Subscriptions on your device.'
                  : 'To manage or cancel, go to Play Store > Payments & subscriptions > Subscriptions.',
              );
            }}
          >
            <MaterialIcons name="settings" size={16} color="#00408f" />
            <Text style={styles.manageBtnText}>Manage Subscription</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureItem}>
      <MaterialIcons name={icon as any} size={18} color="#00408f" />
      <Text style={styles.featureText}>{text}</Text>
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
  restoreRow: { paddingHorizontal: 16, marginTop: 12, marginBottom: 6 },
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
  scrollContent: { paddingHorizontal: 16, gap: 10, paddingTop: 10 },
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
  emptyText: { fontSize: 13, color: '#737685', textAlign: 'center' },
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
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#a5d6a7',
    borderRadius: 10,
    padding: 12,
  },
  activeBannerText: { color: '#2e7d32', fontSize: 14, fontWeight: '700' },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  manageBtnText: { color: '#00408f', fontSize: 13, fontWeight: '600' },
  featuresCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(195,198,214,0.25)',
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#191c1e',
    marginBottom: 12,
  },
  featuresList: { gap: 8 },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 13,
    color: '#434654',
    fontWeight: '500',
    flex: 1,
  },
  webOnlySection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e7e8ea',
  },
  webOnlyTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#737685',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  webOnlyItem: {
    fontSize: 12,
    color: '#737685',
    lineHeight: 20,
  },
  bestValueCard: {
    borderColor: '#2e7d32',
    borderWidth: 2,
  },
  bestValueBadge: {
    position: 'absolute',
    top: -10,
    right: 14,
    backgroundColor: '#2e7d32',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    zIndex: 1,
  },
  bestValueText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  perMonthBreakdown: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: '700',
    marginTop: 2,
  },
  savingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  savingsText: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: '700',
    flex: 1,
  },
});
