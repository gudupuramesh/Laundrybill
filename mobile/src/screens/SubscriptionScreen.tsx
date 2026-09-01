import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, radii, shadows, spacing } from '../theme';
import { HelpButton } from '../components/HelpButton';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import {
  addCustomerInfoListener,
  ENTITLEMENT_ID,
  getCurrentOffering,
  getCustomerInfo,
  hasProEntitlement,
  isRevenueCatConfigured,
  purchasePackage,
  restorePurchases,
  type PurchasesOffering,
  type PurchasesPackage,
} from '../lib/billing/revenuecat';
import { createNamedHttpsCallable } from '../lib/httpsCallable';
import { usePlanLimits } from '../lib/usePlanLimits';
import { useMergedOrdersUsed } from '../lib/useBillingPeriodOrderCount';

type PurchaseUIState = 'idle' | 'loading' | 'purchasing' | 'restoring' | 'syncing' | 'done' | 'failed';

// ────────────────────────────────────────────────────────────────────────────
// Four-tier feature comparison: Free → Pro → Pro+ → Business.
// Values mirror the canonical plan features in web src/config/plans.ts (the
// authoritative entitlement source). Pro+ = single-shop team; Business adds
// damage photos on top of everything Pro+ has.
// ────────────────────────────────────────────────────────────────────────────
const PLAN_FEATURES = [
  { label: 'Orders & POS',          free: true,  pro: true,  proPlus: true,  biz: true,  icon: 'receipt-long' },
  { label: 'Customer management',   free: true,  pro: true,  proPlus: true,  biz: true,  icon: 'people' },
  { label: 'Services & items',      free: true,  pro: true,  proPlus: true,  biz: true,  icon: 'grid-view' },
  { label: 'Order tracking link',   free: false, pro: true,  proPlus: true,  biz: true,  icon: 'link' },
  { label: 'QR code scanning',      free: false, pro: true,  proPlus: true,  biz: true,  icon: 'qr-code-scanner' },
  { label: 'WhatsApp receipts',     free: false, pro: true,  proPlus: true,  biz: true,  icon: 'chat' },
  { label: 'Reports & analytics',   free: false, pro: true,  proPlus: true,  biz: true,  icon: 'bar-chart' },
  { label: 'Staff management',      free: false, pro: true,  proPlus: true,  biz: true,  icon: 'badge' },
  { label: 'Attendance & payroll',  free: false, pro: true,  proPlus: true,  biz: true,  icon: 'event-available' },
  { label: 'Expenses tracking',     free: false, pro: true,  proPlus: true,  biz: true,  icon: 'account-balance-wallet' },
  { label: 'Web dashboard access',  free: false, pro: true,  proPlus: true,  biz: true,  icon: 'computer' },
  { label: 'Coupons & offers',      free: false, pro: false, proPlus: true,  biz: true,  icon: 'local-offer' },
  { label: 'Loyalty points',        free: false, pro: false, proPlus: true,  biz: true,  icon: 'stars' },
  { label: 'Per-item tracking',     free: false, pro: false, proPlus: true,  biz: true,  icon: 'checklist' },
  { label: 'Order reminders',       free: false, pro: false, proPlus: true,  biz: true,  icon: 'notifications-active' },
  { label: 'Staff app logins',      free: false, pro: false, proPlus: true,  biz: true,  icon: 'group-add' },
  { label: 'Driver / agent app',    free: false, pro: false, proPlus: true,  biz: true,  icon: 'local-shipping' },
  { label: 'Plant processing',      free: false, pro: false, proPlus: true,  biz: true,  icon: 'precision-manufacturing' },
  { label: 'Public booking page',   free: false, pro: false, proPlus: true,  biz: true,  icon: 'storefront' },
  { label: 'Damage photos',         free: false, pro: false, proPlus: false, biz: true,  icon: 'photo-camera' },
] as const;

// Plan limits summary for the cards
const PLAN_LIMITS = {
  free:     { orders: '50/mo',       customers: '100',       staff: '1 admin' },
  pro:      { orders: 'Unlimited',   customers: 'Unlimited', staff: '1 staff login' },
  business: { orders: 'Unlimited',   customers: 'Unlimited', staff: 'Unlimited staff' },
} as const;

// Static fallback prices (shown when RevenueCat isn't configured, e.g. iOS without Apple key)
// Android: Pro ₹299/mo, Business ₹1,299/mo | iOS: Pro ₹499/mo, Business ₹1,499/mo
const STATIC_PRICES = Platform.OS === 'ios'
  ? { pro: { monthly: '₹499', yearly: '₹4,999', monthlyNum: 499 }, business: { monthly: '₹1,499', yearly: '₹14,999', monthlyNum: 1499 } }
  : { pro: { monthly: '₹299', yearly: '₹2,999', monthlyNum: 299 }, business: { monthly: '₹1,299', yearly: '₹12,999', monthlyNum: 1299 } };

/**
 * Show the Business plan card. Kept OFF until Business in-app-purchase products
 * exist on BOTH stores (App Store Connect + Play) and are attached to the
 * RevenueCat offering — displaying a non-purchasable plan can fail store review.
 * Flip to true once those products exist.
 */
// Business is sold on the web (Razorpay), NOT via in-app purchase — Apple/Play
// forbid non-IAP digital unlocks inside the app. The app still HONORS a Business
// subscription bought on web (see currentPlanId / isPaidPlan), it just doesn't
// sell or advertise it as buyable here. Flip to true only if Business IAP
// products are ever created on BOTH stores and attached to the RC offering.
const SHOW_BUSINESS_PLAN: boolean = false;

/**
 * Single source of truth for the plan tier ('pro' | 'business'), derived from a
 * RevenueCat package id AND/OR the store product id. Used by BOTH the plan cards
 * (display) and the post-purchase Firestore sync, so the tier we SAVE always
 * matches the tier the user TAPPED. (Previously the sync re-guessed from only the
 * product id and would silently record a Business purchase as 'pro'.)
 */
function tierFromIds(packageId?: string, productId?: string): 'pro' | 'business' {
  const id = (packageId || '').toLowerCase();
  const prodId = (productId || '').toLowerCase();
  if (
    id.includes('business') || prodId.includes('business') ||
    id.includes('enterprise') || prodId.includes('enterprise')
  ) {
    return 'business';
  }
  return 'pro';
}

/**
 * Format an amount in the live product's currency (so the savings line matches
 * the headline price for every App Store / Play storefront — ₹ for India, $ for
 * the US, etc.). Falls back to the symbol parsed from the product's priceString
 * if Intl currency formatting isn't available at runtime.
 */
function fmtCurrency(amount: number, currencyCode?: string, sampleStr?: string): string {
  if (currencyCode) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode,
        maximumFractionDigits: amount >= 100 ? 0 : 2,
      }).format(amount);
    } catch {
      // fall through to symbol parsing
    }
  }
  const symbol = (sampleStr || '').replace(/[\d.,\s ]/g, '');
  const n = amount >= 100 ? String(Math.round(amount)) : amount.toFixed(2);
  return symbol ? `${symbol}${n}` : `${n}${currencyCode ? ' ' + currencyCode : ''}`;
}

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
  // Pro+ & Business are contact-only (no in-app price/purchase) — sales-assisted via WhatsApp.
  const [waNumber, setWaNumber] = useState('919666211137');
  useEffect(() => {
    firestore().collection('platformSettings').doc('emailBranding').get()
      .then((d: any) => { const n = d?.data()?.whatsappNumber; if (n) setWaNumber(String(n)); })
      .catch(() => { /* keep default */ });
  }, []);
  const [uiState, setUiState] = useState<PurchaseUIState>('loading');
  // Inline re-fetch of Play prices from the Subscribe button (kept separate from
  // uiState: 'loading' there swaps the whole screen for the boot spinner).
  const [priceLoading, setPriceLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');

  const planLimits = usePlanLimits(sub);
  const ordersUsed = useMergedOrdersUsed(sub, shopId);
  // Live customer + lifetime order counts — subscription.usage.* is NOT
  // maintained (stays 0). count() aggregates: no doc downloads.
  const [customerCount, setCustomerCount] = useState(0);
  const [lifetimeOrders, setLifetimeOrders] = useState(0);
  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await firestore().collection(`shops/${shopId}/customers`).count().get();
        if (!cancelled) setCustomerCount(snap.data().count ?? 0);
      } catch { /* leave 0 on error */ }
      try {
        const snap = await firestore().collection(`shops/${shopId}/orders`).count().get();
        if (!cancelled) setLifetimeOrders(snap.data().count ?? 0);
      } catch { /* leave 0 on error */ }
    })();
    return () => { cancelled = true; };
  }, [shopId]);

  // Metered plans (Free/trial monthly cap) show this-period usage against the
  // cap; unlimited plans show the shop's TOTAL lifetime orders.
  const ordersMetered = planLimits.maxOrders > 0;
  // Live count of team logins — subscription.usage.totalStaff is NOT maintained
  // (it stays 0 forever), so count the teamMembers docs the cap applies to.
  const [teamLoginCount, setTeamLoginCount] = useState(0);
  useEffect(() => {
    if (!shopId) return;
    const unsub = firestore()
      .collection(`shops/${shopId}/teamMembers`)
      .onSnapshot((snap: any) => setTeamLoginCount(snap?.size ?? 0), () => {});
    return () => unsub();
  }, [shopId]);

  // ── Load current offering + subscription doc + entitlement ──────────────
  useEffect(() => {
    let unsubFirestore: (() => void) | undefined;

    let cancelled = false;
    const load = async () => {
      try {
        if (isRevenueCatConfigured()) {
          const [off, info] = await Promise.all([
            getCurrentOffering(),
            getCustomerInfo(),
          ]);
          if (cancelled) return;
          setOffering(off);
          setIsPro(hasProEntitlement(info));
          // Google Play sometimes fails the FIRST products fetch (fresh install /
          // slow Play session). Retry quietly so the Subscribe button self-heals
          // instead of staying disabled — a dead buy button loses the customer.
          if (!(off?.availablePackages?.length)) {
            for (const delayMs of [4000, 10000]) {
              await new Promise((r) => setTimeout(r, delayMs));
              if (cancelled) return;
              try {
                const again = await getCurrentOffering();
                if (cancelled) return;
                if (again?.availablePackages?.length) { setOffering(again); break; }
              } catch {}
            }
          }
        }
      } catch (e: any) {
        console.warn('[SubscriptionScreen] load error', e);
      } finally {
        if (!cancelled) setUiState('idle');
      }
    };
    load();

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

    const removeRcListener = addCustomerInfoListener((info) => {
      setIsPro(hasProEntitlement(info));
    });

    return () => {
      cancelled = true;
      unsubFirestore?.();
      removeRcListener();
    };
  }, [shopId]);

  // ── Current plan identification ──────────────────────────────────────
  const currentPlanId = useMemo(() => {
    const raw = (sub?.planId || sub?.planName || 'free');
    const n = String(raw).toLowerCase().replace(/[_\s-]/g, '');
    if (n === 'franchise' || n === 'multishop') return 'franchise';
    if (n === 'proplus' || n === 'pro+') return 'pro_plus';
    if (n === 'business' || n === 'enterprise' || n === 'premium') return 'business';
    if (n === 'pro' || n === 'starter') return 'pro';
    return 'free';
  }, [sub]);

  const planDisplayName = useMemo(() => {
    if (currentPlanId === 'franchise') return 'Franchise Plan';
    if (currentPlanId === 'business') return 'Business Plan';
    if (currentPlanId === 'pro_plus') return 'Pro+ Plan';
    if (currentPlanId === 'pro') return 'Pro Plan';
    return 'Free Plan';
  }, [currentPlanId]);

  const planStatus = sub?.status || (isPro ? 'active' : 'free');
  const storeName = Platform.OS === 'ios' ? 'App Store' : 'Google Play';

  const formatSubDate = (raw: any): string | null => {
    if (!raw) return null;
    try {
      const d = typeof raw.toDate === 'function' ? raw.toDate() : raw.seconds ? new Date(raw.seconds * 1000) : new Date(raw);
      return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return null; }
  };
  const expiryDate = formatSubDate(sub?.endDate || sub?.expiresAt);
  const trialEndDate = formatSubDate(sub?.trialEndDate);

  // A trial shop carries planId 'pro'/'pro_plus' but has PAID for nothing yet — it
  // must see the purchase cards (not just "Manage"), otherwise upgrading is
  // impossible until the trial runs out. A real store entitlement (isPro) still
  // counts as genuinely paid.
  const isTrial = String(sub?.status || '').toLowerCase().startsWith('trial');
  // Firestore is the AUTHORITY for what this SHOP has paid for. A RevenueCat
  // entitlement on the device's store account alone must NOT hide the purchase
  // cards: TestFlight/sandbox testing, a reinstall onto a fresh shop, or a
  // failed post-purchase sync all leave RC "entitled" while the shop is
  // actually Free — hiding the upgrade path then dead-ends the owner. When RC
  // is entitled but Firestore says Free, the auto-heal effect below syncs the
  // plan doc so the paid banner reappears on its own.
  const isPaidPlan = !isTrial && (currentPlanId === 'pro' || currentPlanId === 'pro_plus' || currentPlanId === 'business' || currentPlanId === 'franchise');

  // Auto-heal: store entitlement present but the shop's plan doc says Free →
  // the post-purchase sync never landed (or never ran for this shop). Sync once.
  const autoSyncedRef = useRef(false);
  useEffect(() => {
    if (!isPro || isPaidPlan || autoSyncedRef.current || uiState !== 'idle') return;
    autoSyncedRef.current = true;
    (async () => {
      try {
        setUiState('syncing');
        await syncEntitlementToFirestore(await getCustomerInfo());
      } catch {
        // Leave the purchase cards available — Restore also remains an option.
      } finally {
        setUiState('idle');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro, isPaidPlan, uiState]);

  // ── Purchase ─────────────────────────────────────────────────────────
  const handlePurchase = async (pkg: PurchasesPackage) => {
    if (uiState === 'purchasing' || uiState === 'syncing') return;
    try {
      setUiState('purchasing');
      setErrorMsg(null);
      const { customerInfo, cancelled } = await purchasePackage(pkg);
      if (cancelled) { setUiState('idle'); return; }
      const entitled = hasProEntitlement(customerInfo);
      setIsPro(entitled);
      if (entitled) {
        setUiState('syncing');
        // Save the SAME tier the user tapped — not a re-guess from the product id.
        await syncEntitlementToFirestore(customerInfo, tierFromIds(pkg.identifier, pkg.product?.identifier));
        setUiState('done');
        Alert.alert('Payment Successful', 'Your subscription is now active!');
      } else {
        setUiState('idle');
        Alert.alert('Purchase Submitted', 'Verification in progress.');
      }
    } catch (e: any) {
      setUiState('failed');
      setErrorMsg(e?.message || 'Could not complete purchase.');
      Alert.alert('Payment Error', e?.message || 'Could not complete purchase.');
    }
  };

  // ── Restore ──────────────────────────────────────────────────────────
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
        Alert.alert('Restored', 'Your subscription has been restored.');
      } else {
        setUiState('idle');
        Alert.alert('No Subscription Found', 'No active subscription linked to your account.');
      }
    } catch (e: any) {
      setUiState('failed');
      setErrorMsg(e?.message || 'Unable to restore.');
      Alert.alert('Restore Error', e?.message || 'Unable to restore purchases.');
    }
  };

  // ── Sync to Firestore ────────────────────────────────────────────────
  const syncEntitlementToFirestore = async (info: any, tierOverride?: 'pro' | 'business') => {
    if (!shopId) return;
    try {
      const entitlement = info.entitlements?.active?.[ENTITLEMENT_ID];
      if (!entitlement) return;
      // Prefer the tier the user tapped; fall back to the product id (restore path).
      const planId = tierOverride ?? tierFromIds(undefined, entitlement.productIdentifier);
      const syncRcSubscription = createNamedHttpsCallable('syncRevenueCatSubscription');
      await syncRcSubscription({
        shopId,
        planId,
        productIdentifier: entitlement.productIdentifier || '',
        expirationDate: entitlement.expirationDate || null,
        isActive: true,
        willRenew: entitlement.willRenew ?? true,
        store: entitlement.store || (Platform.OS === 'ios' ? 'app_store' : 'play_store'),
      });
    } catch (e) {
      console.warn('[SubscriptionScreen] sync error', e);
    }
  };

  const handleManageSubscription = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('https://apps.apple.com/account/subscriptions').catch(() => {
        Alert.alert('Manage', 'Go to Settings > Apple ID > Subscriptions.');
      });
    } else {
      Linking.openURL('https://play.google.com/store/account/subscriptions').catch(() => {
        Alert.alert('Manage', 'Go to Play Store > Payments & subscriptions.');
      });
    }
  };

  // ── RevenueCat packages → map to Pro & Business ──────────────────────
  const packages = offering?.availablePackages ?? [];

  // Try to identify Pro vs Business packages by identifier pattern
  // RevenueCat identifiers: e.g. "$rc_monthly", "$rc_annual", "pro_monthly", "business_monthly"
  const classifyPkg = (pkg: PurchasesPackage) =>
    tierFromIds(pkg.identifier, pkg.product?.identifier);

  const proPackages = packages.filter((p) => classifyPkg(p) === 'pro');
  const bizPackages = packages.filter((p) => classifyPkg(p) === 'business');

  // If all packages classify as "pro" (no "business" in identifiers),
  // treat them as a single tier — split monthly/annual
  const hasSeparateBizProducts = bizPackages.length > 0;

  // Robust monthly/annual detection — works for standard ($rc_monthly/$rc_annual)
  // AND custom identifiers like "$rc_monthly_bus", "business_yearly", etc.
  const isAnnual = (p: PurchasesPackage) => {
    if (p.packageType === 'ANNUAL') return true;
    const id = (p.identifier || '').toLowerCase();
    const prodId = (p.product?.identifier || '').toLowerCase();
    const period = (p.product as any)?.subscriptionPeriod || '';
    return id.includes('annual') || id.includes('year') || prodId.includes('year') || period === 'P1Y';
  };
  const isMonthly = (p: PurchasesPackage) => {
    if (p.packageType === 'MONTHLY') return true;
    const id = (p.identifier || '').toLowerCase();
    const prodId = (p.product?.identifier || '').toLowerCase();
    const period = (p.product as any)?.subscriptionPeriod || '';
    return id.includes('month') || prodId.includes('month') || period === 'P1M';
  };

  const getSelectedPkg = (pkgs: PurchasesPackage[]) => {
    const monthly = pkgs.find(isMonthly);
    const annual = pkgs.find(isAnnual);
    return billingCycle === 'yearly' ? (annual || monthly) : (monthly || annual);
  };

  const proSelectedPkg = getSelectedPkg(hasSeparateBizProducts ? proPackages : packages);
  const bizSelectedPkg = hasSeparateBizProducts ? getSelectedPkg(bizPackages) : null;

  const calcSavings = (pkgs: PurchasesPackage[]) => {
    const m = pkgs.find(isMonthly);
    const a = pkgs.find(isAnnual);
    if (!m || !a) return null;
    const fullYear = m.product.price * 12;
    const saved = fullYear - a.product.price;
    if (saved <= 0) return null;
    return {
      pct: Math.round((saved / fullYear) * 100),
      perMonth: fmtCurrency(a.product.price / 12, a.product.currencyCode, a.product.priceString),
      monthsSaved: Math.round(saved / m.product.price),
    };
  };

  const proSavings = calcSavings(hasSeparateBizProducts ? proPackages : packages);
  const bizSavings = hasSeparateBizProducts ? calcSavings(bizPackages) : null;

  const rcNotConfigured = !isRevenueCatConfigured();

  // Comparison shows all four tiers (Free/Pro/Pro+/Business) as an informational
  // table — Pro+/Business are sold on the web, not in-app, but the shop owner
  // should still see what each tier includes. So show every feature row.
  const compFeatures = PLAN_FEATURES;

  // ── Loading ──────────────────────────────────────────────────────────
  if (uiState === 'loading') {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[s.loadingText, { marginTop: 12 }]}>Loading plans...</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={s.headerBackBtn} onPress={onBack}>
          <MaterialIcons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Subscription Plans</Text>
        <HelpButton pageId="mobile_subscription" />
      </View>

      <ScrollView
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status banners */}
        {uiState === 'syncing' && (
          <View style={s.infoBanner}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={s.infoBannerText}>Activating your subscription...</Text>
          </View>
        )}
        {uiState === 'failed' && errorMsg && (
          <View style={s.errorBanner}>
            <MaterialIcons name="error-outline" size={16} color={colors.error} />
            <Text style={s.errorBannerText}>{errorMsg}</Text>
          </View>
        )}

        {/* ── Current Plan Card (Blue Gradient) ──────────────────────── */}
        <LinearGradient
          colors={['#1B61E5', '#124BB8'] as const}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.planGradient}
        >
          <View style={s.gradientCircle} />
          <View style={s.planGradientHeader}>
            <View style={{ flex: 1 }}>
              <View style={s.planBadgeRow}>
                <View style={s.planStatusBadge}>
                  <Text style={s.planStatusBadgeText}>
                    {isPaidPlan ? 'ACTIVE PLAN' : isTrial ? 'FREE TRIAL' : 'FREE PLAN'}
                  </Text>
                </View>
              </View>
              <Text style={s.planGradientTitle}>{planDisplayName}</Text>
              {expiryDate && (
                <Text style={s.planGradientExpiry}>
                  {planStatus === 'active' ? 'Renews' : 'Expires'} {expiryDate}
                </Text>
              )}
              {trialEndDate && !expiryDate && (
                <Text style={s.planGradientExpiry}>Trial ends {trialEndDate}</Text>
              )}
              {isTrial && !trialEndDate && (sub?.trialOrderLimit || 0) > 0 && (
                <Text style={s.planGradientExpiry}>
                  Trial · {Math.min(sub?.trialOrdersUsed || 0, sub?.trialOrderLimit)}/{sub?.trialOrderLimit} orders used
                </Text>
              )}
            </View>
            {isPaidPlan ? (
              <TouchableOpacity style={s.manageGradientBtn} onPress={handleManageSubscription}>
                <Text style={s.manageGradientBtnText}>Manage</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.upgradeGradientBtn}>
                <Text style={s.upgradeGradientBtnText}>Upgrade ↓</Text>
              </View>
            )}
          </View>

          {/* Usage Progress Bars */}
          <View style={s.usageGroup}>
            <UsageBar
              label={ordersMetered ? 'Orders (this month)' : 'Total Orders'}
              used={ordersMetered ? ordersUsed : lifetimeOrders}
              limit={planLimits.maxOrders}
            />
            <UsageBar label="Customers" used={customerCount} limit={planLimits.maxCustomers} />
            <UsageBar label="Team Logins" used={teamLoginCount} limit={planLimits.maxTeamLogins} />
          </View>
        </LinearGradient>

        {/* ── Platform Notice (iOS without Apple key) ────────────────── */}
        {rcNotConfigured && Platform.OS === 'ios' && (
          <View style={s.platformNotice}>
            <MaterialIcons name="info-outline" size={18} color={colors.primary} />
            <Text style={s.platformNoticeText}>
              App Store subscriptions are coming soon. Currently available on Android via Google Play.
            </Text>
          </View>
        )}

        {/* ── Billing Cycle Toggle ───────────────────────────────────── */}
        {!isPaidPlan && (
          <>
            <Text style={s.sectionTitle}>CHOOSE YOUR PLAN</Text>
            <View style={s.toggleRow}>
              <TouchableOpacity
                style={[s.toggleBtn, billingCycle === 'monthly' && s.toggleBtnActive]}
                onPress={() => setBillingCycle('monthly')}
              >
                <Text style={[s.toggleBtnText, billingCycle === 'monthly' && s.toggleBtnTextActive]}>
                  Monthly
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.toggleBtn, billingCycle === 'yearly' && s.toggleBtnActive]}
                onPress={() => setBillingCycle('yearly')}
              >
                <Text style={[s.toggleBtnText, billingCycle === 'yearly' && s.toggleBtnTextActive]}>
                  Yearly
                </Text>
                {(proSavings) && (
                  <View style={s.savePill}>
                    <Text style={s.savePillText}>
                      Save {proSavings.pct}%
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── Pro Plan Card — Best Value ────────────────────────────── */}
        {!isPaidPlan && (
          <View style={[s.planCard, { borderColor: colors.success, borderWidth: 2, overflow: 'visible' }]}>
            <View style={s.bestValueRibbon}>
              <Text style={s.bestValueRibbonText}>BEST VALUE</Text>
            </View>

            <View style={s.planCardHeader}>
              <View style={[s.planIcon, { backgroundColor: colors.primaryTint }]}>
                <MaterialIcons name="rocket-launch" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={s.planCardName}>Pro</Text>
                  <View style={[s.planBadgePill, { backgroundColor: colors.successBg }]}>
                    <Text style={[s.planBadgePillText, { color: colors.success }]}>Best Value</Text>
                  </View>
                </View>
                <Text style={s.planCardDesc}>Run your laundry on autopilot</Text>
              </View>
            </View>

            <View style={s.planPriceRow}>
              <Text style={s.planPrice}>
                {proSelectedPkg ? proSelectedPkg.product.priceString : (billingCycle === 'yearly' ? STATIC_PRICES.pro.yearly : STATIC_PRICES.pro.monthly)}
              </Text>
              <Text style={s.planPricePeriod}>/{billingCycle === 'yearly' ? 'year' : 'month'}</Text>
            </View>

            {billingCycle === 'yearly' && proSavings && (
              <View style={s.savingsRow}>
                <MaterialIcons name="local-offer" size={14} color={colors.success} />
                <Text style={s.savingsText}>
                  Save {proSavings.monthsSaved} month{proSavings.monthsSaved > 1 ? 's' : ''} — just {proSavings.perMonth}/mo
                </Text>
              </View>
            )}

            {/* Pro features highlights */}
            <View style={s.featureHighlights}>
              <HighlightItem icon="all-inclusive" text="Unlimited orders" color={colors.success} />
              <HighlightItem icon="all-inclusive" text="Unlimited customers" color={colors.success} />
              <HighlightItem icon="check-circle" text="Staff, attendance & payroll" />
              <HighlightItem icon="check-circle" text="Reports, QR & WhatsApp receipts" />
              <HighlightItem icon="check-circle" text="Order tracking & analytics" />
            </View>

            <TouchableOpacity
              style={[s.subscribeBtn, uiState === 'purchasing' && s.subscribeBtnDisabled]}
              disabled={uiState === 'purchasing' || uiState === 'syncing' || priceLoading}
              onPress={async () => {
                if (proSelectedPkg) { handlePurchase(proSelectedPkg); return; }
                // Prices didn't load (Play session hiccup) — fetch them NOW and go
                // straight into the purchase, instead of leaving a dead button.
                setPriceLoading(true);
                try {
                  const off = await getCurrentOffering();
                  setOffering(off);
                  const pkgs = off?.availablePackages ?? [];
                  const pros = pkgs.filter((p) => classifyPkg(p) === 'pro');
                  const list = pkgs.some((p) => classifyPkg(p) === 'business') ? pros : pkgs;
                  const monthly = list.find(isMonthly);
                  const annual = list.find(isAnnual);
                  const pick = billingCycle === 'yearly' ? (annual || monthly) : (monthly || annual);
                  setPriceLoading(false);
                  if (pick) { handlePurchase(pick); return; }
                  Alert.alert(
                    'Google Play unavailable',
                    'We could not load subscription prices from Google Play. Make sure the Play Store app is signed in to a Google account and your connection is working, then tap Subscribe again.'
                  );
                } catch {
                  setPriceLoading(false);
                  Alert.alert(
                    'Google Play unavailable',
                    'We could not reach Google Play. Please check your internet connection and tap Subscribe again.'
                  );
                }
              }}
              activeOpacity={0.85}
            >
              {uiState === 'purchasing' || priceLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={s.subscribeBtnText}>
                    {proSelectedPkg
                      ? (billingCycle === 'yearly' ? 'Subscribe & Save' : 'Subscribe to Pro')
                      : `Subscribe — ${STATIC_PRICES.pro.monthly}/mo`}
                  </Text>
                  <MaterialIcons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>
            <Text style={s.storeNote}>Payment via {storeName}. Cancel anytime.</Text>
          </View>
        )}

        {/* ── Business Plan Card (Multi-branch / Enterprise) ─────────── */}
        {/* Hidden until Business IAP products exist on both stores. Showing a
            non-purchasable plan risks App Store/Play review rejection. */}
        {!isPaidPlan && SHOW_BUSINESS_PLAN && (
          <View style={[s.planCard, s.businessCard]}>
            <View style={[s.bestValueRibbon, { backgroundColor: '#0D47A1' }]}>
              <Text style={s.bestValueRibbonText}>ENTERPRISE</Text>
            </View>

            <View style={s.planCardHeader}>
              <View style={[s.planIcon, { backgroundColor: '#E3F2FD' }]}>
                <MaterialIcons name="domain" size={22} color="#0D47A1" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={s.planCardName}>Business</Text>
                  <View style={[s.planBadgePill, { backgroundColor: '#E3F2FD' }]}>
                    <Text style={[s.planBadgePillText, { color: '#0D47A1' }]}>Multi-branch</Text>
                  </View>
                </View>
                <Text style={s.planCardDesc}>Scale with plant, drivers & public bookings</Text>
              </View>
            </View>

            <View style={s.planPriceRow}>
              <Text style={[s.planPrice, { color: '#0D47A1' }]}>
                {bizSelectedPkg ? bizSelectedPkg.product.priceString : (billingCycle === 'yearly' ? STATIC_PRICES.business.yearly : STATIC_PRICES.business.monthly)}
              </Text>
              <Text style={s.planPricePeriod}>/{billingCycle === 'yearly' ? 'year' : 'month'}</Text>
            </View>

            {billingCycle === 'yearly' && bizSavings && (
              <View style={s.savingsRow}>
                <MaterialIcons name="local-offer" size={14} color={colors.success} />
                <Text style={s.savingsText}>
                  Save {bizSavings.monthsSaved} month{bizSavings.monthsSaved > 1 ? 's' : ''}
                </Text>
              </View>
            )}

            {/* Business features highlights */}
            <View style={s.featureHighlights}>
              <HighlightItem icon="all-inclusive" text="Unlimited orders & customers" color={colors.success} />
              <HighlightItem icon="all-inclusive" text="Unlimited staff logins" color={colors.success} />
              <HighlightItem icon="check-circle" text="Plant processing dashboard" />
              <HighlightItem icon="check-circle" text="Driver & delivery agent app" />
              <HighlightItem icon="check-circle" text="Public booking page" />
              <HighlightItem icon="check-circle" text="Web dashboard access" />
              <HighlightItem icon="check-circle" text="Everything in Pro included" />
            </View>

            <TouchableOpacity
              style={[
                s.subscribeBtn,
                { backgroundColor: '#0D47A1' },
                (uiState === 'purchasing' || !bizSelectedPkg) && s.subscribeBtnDisabled,
              ]}
              disabled={uiState === 'purchasing' || uiState === 'syncing' || !bizSelectedPkg}
              onPress={() => bizSelectedPkg && handlePurchase(bizSelectedPkg)}
              activeOpacity={0.85}
            >
              {uiState === 'purchasing' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={s.subscribeBtnText}>
                    {bizSelectedPkg
                      ? (billingCycle === 'yearly' ? 'Subscribe & Save' : 'Subscribe to Business')
                      : `Subscribe — ${STATIC_PRICES.business.monthly}/mo`}
                  </Text>
                  <MaterialIcons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>
            <Text style={s.storeNote}>Payment via {storeName}. Cancel anytime.</Text>
          </View>
        )}

        {/* ── Pro+ & Business: quotation-only (on-site setup, training, POS hardware) ──
            Enterprise service packages for growing laundries and multi-branch chains,
            priced by written quotation (keeps app-store review happy: no dead
            purchase button, a clear sales-assisted path instead). */}
        {currentPlanId !== 'business' && currentPlanId !== 'pro_plus' && (
          <View style={{ marginTop: 8 }}>
            <Text style={s.sectionTitle}>TEAM & MULTI-BRANCH PLANS</Text>

            {/* Sets expectations up front: enterprise plans, sales-assisted pricing. */}
            <View style={s.quoteNotice}>
              <MaterialIcons name="handshake" size={20} color={colors.primary} />
              <Text style={s.quoteNoticeText}>
                Pro+ and Business are designed for growing laundries and multi-branch
                chains. Every deployment includes professional POS hardware installation,
                staff training and guided onboarding at your premises. Pricing is tailored
                to your business — request a quotation and our team will reach out on
                WhatsApp (+91 96662 11137).
              </Text>
            </View>

            {/* Pro+ — a single shop that needs a team */}
            <View style={s.planCard}>
              <View style={s.planCardHeader}>
                <View style={[s.planIcon, { backgroundColor: colors.primaryTint }]}>
                  <MaterialIcons name="groups" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={s.planCardName}>Pro+</Text>
                    <View style={[s.planBadgePill, { backgroundColor: colors.primaryTint }]}>
                      <Text style={[s.planBadgePillText, { color: colors.primary }]}>For teams</Text>
                    </View>
                  </View>
                  <Text style={s.planCardDesc}>One shop that needs staff logins</Text>
                </View>
              </View>
              <View style={s.quotePriceRow}>
                <Text style={s.quotePrice}>By quotation</Text>
                <Text style={s.quotePriceSub}>incl. setup &amp; training</Text>
              </View>
              <View style={s.featureHighlights}>
                <HighlightItem icon="check-circle" text="Everything in Pro, plus:" color={colors.success} />
                <HighlightItem icon="badge" text="Staff, delivery-agent & plant logins" />
                <HighlightItem icon="inventory-2" text="Per-item delivery tracking" />
                <HighlightItem icon="notifications-active" text="Order reminder alerts" />
                <HighlightItem icon="public" text="Public booking page" />
              </View>
              <TouchableOpacity
                style={s.quoteBtn}
                activeOpacity={0.85}
                onPress={() => Linking.openURL(
                  `https://wa.me/${waNumber.replace(/\D/g, '')}?text=${encodeURIComponent("Hi, I'd like a quotation for the Pro+ plan (single shop + staff logins, includes on-site POS hardware setup, staff training & onboarding).")}`
                ).catch(() => {})}
              >
                <MaterialIcons name="chat" size={18} color="#fff" />
                <Text style={s.contactBtnText}>Request a Pro+ quote</Text>
              </TouchableOpacity>
            </View>

            {/* Business — multi-branch / high volume */}
            <View style={[s.planCard, s.businessCard]}>
              <View style={s.planCardHeader}>
                <View style={[s.planIcon, { backgroundColor: '#E3F2FD' }]}>
                  <MaterialIcons name="storefront" size={22} color="#0D47A1" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={s.planCardName}>Business</Text>
                    <View style={[s.planBadgePill, { backgroundColor: '#E3F2FD' }]}>
                      <Text style={[s.planBadgePillText, { color: '#0D47A1' }]}>Multi-branch</Text>
                    </View>
                  </View>
                  <Text style={s.planCardDesc}>High volume, plants &amp; bigger teams</Text>
                </View>
              </View>
              <View style={s.quotePriceRow}>
                <Text style={[s.quotePrice, { color: '#0D47A1' }]}>By quotation</Text>
                <Text style={s.quotePriceSub}>incl. setup &amp; training</Text>
              </View>
              <View style={s.featureHighlights}>
                <HighlightItem icon="check-circle" text="Everything in Pro+, plus:" color={colors.success} />
                <HighlightItem icon="groups" text="Up to 15 staff, agents & plant logins each" />
                <HighlightItem icon="photo-camera" text="Damage & proof photos" />
                <HighlightItem icon="local-laundry-service" text="Full plant processing dashboard" />
                <HighlightItem icon="support-agent" text="Priority support & onboarding" />
              </View>
              <TouchableOpacity
                style={[s.quoteBtn, { backgroundColor: '#0D47A1' }]}
                activeOpacity={0.85}
                onPress={() => Linking.openURL(
                  `https://wa.me/${waNumber.replace(/\D/g, '')}?text=${encodeURIComponent("Hi, I'd like a quotation for the Business plan (multi-branch, plant & large team, includes on-site POS hardware setup, staff training & onboarding).")}`
                ).catch(() => {})}
              >
                <MaterialIcons name="chat" size={18} color="#fff" />
                <Text style={s.contactBtnText}>Request a Business quote</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── No plans available (RC configured but network issue) ───── */}
        {packages.length === 0 && !isPaidPlan && !rcNotConfigured && (
          <View style={s.retryRow}>
            <TouchableOpacity
              style={s.retryBtn}
              onPress={async () => {
                setUiState('loading');
                try { const off = await getCurrentOffering(); setOffering(off); } catch {} finally { setUiState('idle'); }
              }}
            >
              <Text style={s.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Full Feature Comparison ───────────────────────────────── */}
        <Text style={s.sectionTitle}>FEATURE COMPARISON</Text>
        <View style={s.comparisonCard}>
          {/* Column headers */}
          <View style={s.compHeaderRow}>
            <Text style={[s.compHeaderCell, { flex: 1, textAlign: 'left' }]}>Feature</Text>
            <Text style={s.compHeaderCell}>Free</Text>
            <Text style={[s.compHeaderCell, { color: colors.primary }]}>Pro</Text>
            <Text style={[s.compHeaderCell, { color: '#6D28D9' }]}>Pro+</Text>
            <Text style={[s.compHeaderCell, { color: '#0D47A1' }]}>Biz</Text>
          </View>

          {compFeatures.map((f, i) => (
            <View key={f.label} style={[s.compRow, i === compFeatures.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={s.compFeatureCell}>
                <MaterialIcons name={f.icon as any} size={14} color={f.biz ? colors.primary : colors.textMuted} />
                <Text style={s.compFeatureText} numberOfLines={1}>{f.label}</Text>
              </View>
              {([f.free, f.pro, f.proPlus, f.biz] as boolean[]).map((on, ci) => (
                <View key={ci} style={s.compCheckCell}>
                  <MaterialIcons
                    name={on ? 'check-circle' : 'cancel'}
                    size={15}
                    color={on ? colors.success : colors.border}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* ── Actions: Manage + Restore ─────────────────────────────── */}
        <View style={s.actionsCard}>
          {isPaidPlan && (
            <TouchableOpacity style={s.actionRow} onPress={handleManageSubscription}>
              <View style={[s.actionIconBox, { backgroundColor: colors.primaryTint }]}>
                <MaterialIcons name="settings" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.actionTitle}>Manage Subscription</Text>
                <Text style={s.actionSubtitle}>Change, cancel or update via {storeName}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[s.actionRow, isPaidPlan && { borderTopWidth: 1, borderTopColor: colors.border }]}
            onPress={handleRestore}
            disabled={uiState === 'restoring' || uiState === 'syncing'}
          >
            <View style={[s.actionIconBox, { backgroundColor: colors.successBg }]}>
              {uiState === 'restoring' ? (
                <ActivityIndicator size="small" color={colors.success} />
              ) : (
                <MaterialIcons name="restore" size={18} color={colors.success} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.actionTitle}>Restore Purchases</Text>
              <Text style={s.actionSubtitle}>Already purchased? Restore from {storeName}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            Subscriptions automatically renew unless canceled at least 24 hours before the
            end of the current period. Payment is charged to your{' '}
            {Platform.OS === 'ios' ? 'Apple ID' : 'Google account'} at confirmation of
            purchase. Manage or cancel anytime in your account settings. Prices may vary by
            region.
          </Text>
          <View style={s.footerLinks}>
            <TouchableOpacity onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}>
              <Text style={s.footerLink}>Terms of Use (EULA)</Text>
            </TouchableOpacity>
            <Text style={s.footerDot}>·</Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://laundrybill.com/privacy.html')}>
              <Text style={s.footerLink}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────
function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const isUnlimited = limit <= 0 || limit === -1;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const displayLimit = isUnlimited ? '∞' : limit.toLocaleString();
  return (
    <View style={s.usageBarRow}>
      <View style={s.usageBarLabels}>
        <Text style={s.usageBarLabel}>{label}</Text>
        <Text style={s.usageBarValue}>
          {used.toLocaleString()} / {displayLimit}{!isUnlimited ? ` (${pct}%)` : ''}
        </Text>
      </View>
      <View style={s.usageBarTrack}>
        <View style={[s.usageBarFill, { width: isUnlimited ? '5%' : `${Math.max(3, pct)}%` }, pct > 80 && { backgroundColor: '#FF6B6B' }]} />
      </View>
    </View>
  );
}

function HighlightItem({ icon, text, color }: { icon: string; text: string; color?: string }) {
  return (
    <View style={s.highlightRow}>
      <MaterialIcons name={icon as any} size={16} color={color || colors.success} />
      <Text style={s.highlightText}>{text}</Text>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBackBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: fonts.bold, color: colors.text },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  loadingText: { fontSize: 13, fontFamily: fonts.medium, color: colors.textMuted },

  // Banners
  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primaryTint, borderRadius: radii.button, padding: 14 },
  infoBannerText: { color: colors.primary, fontSize: 13, fontFamily: fonts.semibold, flex: 1 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.errorBg, borderRadius: radii.button, padding: 14 },
  errorBannerText: { color: colors.error, fontSize: 13, fontFamily: fonts.semibold, flex: 1 },

  // Current plan gradient
  planGradient: { borderRadius: radii.card, padding: 20, overflow: 'hidden', gap: 16 },
  contactCard: { backgroundColor: colors.surface, borderRadius: radii.card, padding: 18, marginTop: 16, ...shadows.card, ...shadows.cardBorder },
  contactTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  contactDesc: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 6, lineHeight: 19 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#25D366', borderRadius: radii.button, paddingVertical: 14, marginTop: 14 },
  contactBtnText: { fontSize: 15, fontFamily: fonts.bold, color: '#fff' },
  // Quotation-only Pro+/Business
  quoteNotice: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', backgroundColor: colors.primaryTint, borderRadius: radii.card, padding: 14, marginTop: 10, marginBottom: 12 },
  quoteNoticeText: { flex: 1, fontSize: 12.5, fontFamily: fonts.medium, color: colors.text, lineHeight: 18.5 },
  quotePriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4, marginBottom: 2 },
  quotePrice: { fontSize: 19, fontFamily: fonts.extrabold, color: colors.primary },
  quotePriceSub: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary },
  quoteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 14, marginTop: 14 },
  gradientCircle: { position: 'absolute', right: -20, top: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)' },
  planGradientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  planBadgeRow: { flexDirection: 'row', marginBottom: 6 },
  planStatusBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  planStatusBadgeText: { color: '#fff', fontSize: 10, fontFamily: fonts.bold, letterSpacing: 0.5 },
  planGradientTitle: { color: '#fff', fontSize: 18, fontFamily: fonts.extrabold },
  planGradientExpiry: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontFamily: fonts.semibold, marginTop: 2 },
  upgradeGradientBtn: {
    backgroundColor: '#fff', paddingHorizontal: 18, paddingVertical: 10, borderRadius: radii.button,
    shadowColor: 'rgba(27,97,229,0.3)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 4,
  },
  upgradeGradientBtnText: { color: colors.primary, fontSize: 13, fontFamily: fonts.extrabold },
  manageGradientBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.button, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  manageGradientBtnText: { color: '#fff', fontSize: 12, fontFamily: fonts.bold },

  // Usage bars
  usageGroup: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 14, gap: 10 },
  usageBarRow: { gap: 4 },
  usageBarLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  usageBarLabel: { fontSize: 11, fontFamily: fonts.bold, color: 'rgba(255,255,255,0.9)' },
  usageBarValue: { fontSize: 11, fontFamily: fonts.bold, color: 'rgba(255,255,255,0.9)' },
  usageBarTrack: { width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' },
  usageBarFill: { height: '100%', backgroundColor: '#fff', borderRadius: 3 },

  // Platform notice
  platformNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.primaryTint, borderRadius: radii.button, padding: 14, borderWidth: 1, borderColor: 'rgba(27,97,229,0.15)' },
  platformNoticeText: { flex: 1, fontSize: 13, fontFamily: fonts.medium, color: colors.primary, lineHeight: 18 },

  // Section title
  sectionTitle: { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', paddingLeft: 4, marginTop: 4 },

  // Toggle
  toggleRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radii.button, padding: 4, borderWidth: 1, borderColor: colors.border },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: radii.button - 2, gap: 6 },
  toggleBtnActive: { backgroundColor: colors.primary },
  toggleBtnText: { fontSize: 14, fontFamily: fonts.bold, color: colors.textSecondary },
  toggleBtnTextActive: { color: '#fff' },
  savePill: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  savePillText: { fontSize: 10, fontFamily: fonts.bold, color: '#fff' },

  // Plan cards
  planCard: {
    backgroundColor: colors.surface, borderRadius: radii.card, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 12, ...shadows.card,
  },
  businessCard: {
    borderColor: '#0D47A1', borderWidth: 2, overflow: 'visible',
  },
  bestValueRibbon: {
    position: 'absolute', top: -10, right: 14, backgroundColor: colors.success, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, zIndex: 1,
  },
  bestValueRibbonText: { color: '#fff', fontSize: 10, fontFamily: fonts.bold, letterSpacing: 0.5 },
  planCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  planCardName: { fontSize: 18, fontFamily: fonts.extrabold, color: colors.text },
  planCardDesc: { fontSize: 12, fontFamily: fonts.medium, color: colors.textMuted, marginTop: 1 },
  planBadgePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  planBadgePillText: { fontSize: 10, fontFamily: fonts.bold, letterSpacing: 0.3 },
  planPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  planPrice: { fontSize: 28, fontFamily: fonts.extrabold, color: colors.primary },
  planPricePeriod: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textMuted },
  savingsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.successBg, borderRadius: radii.badge, paddingHorizontal: 10, paddingVertical: 6 },
  savingsText: { fontSize: 12, fontFamily: fonts.bold, color: colors.success, flex: 1 },

  // Feature highlights inside plan card
  featureHighlights: { gap: 6, paddingTop: 4 },
  highlightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  highlightText: { fontSize: 13, fontFamily: fonts.medium, color: colors.text },

  // Subscribe button
  subscribeBtn: { height: 48, borderRadius: radii.button, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  subscribeBtnDisabled: { backgroundColor: colors.border },
  subscribeBtnText: { color: '#fff', fontSize: 15, fontFamily: fonts.bold },
  storeNote: { fontSize: 11, fontFamily: fonts.medium, color: colors.textMuted, textAlign: 'center' },

  // Empty state
  retryRow: { alignItems: 'center', paddingVertical: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyText: { fontSize: 13, fontFamily: fonts.medium, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: radii.button, backgroundColor: colors.primaryTint, marginTop: 4 },
  retryBtnText: { color: colors.primary, fontSize: 13, fontFamily: fonts.bold },

  // Comparison table
  comparisonCard: { backgroundColor: colors.surface, borderRadius: radii.card, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, ...shadows.card },
  compHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, backgroundColor: colors.surfaceMuted, borderBottomWidth: 1, borderBottomColor: colors.border },
  compHeaderCell: { fontSize: 9.5, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 0.3, textTransform: 'uppercase', width: 34, textAlign: 'center' },
  compRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  compFeatureCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  compFeatureText: { fontSize: 11.5, fontFamily: fonts.medium, color: colors.text, flex: 1 },
  compCheckCell: { width: 34, alignItems: 'center' },

  // Actions
  actionsCard: { backgroundColor: colors.surface, borderRadius: radii.card, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, ...shadows.card },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  actionIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  actionSubtitle: { fontSize: 12, fontFamily: fonts.medium, color: colors.textMuted, marginTop: 1 },

  // Footer
  footer: { alignItems: 'center', paddingTop: 8, paddingHorizontal: 8, gap: 8 },
  footerText: { fontSize: 11, fontFamily: fonts.medium, color: colors.textMuted, textAlign: 'center', lineHeight: 16 },
  footerLinks: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerLink: { fontSize: 12, fontFamily: fonts.semibold, color: colors.primary },
  footerDot: { fontSize: 12, color: colors.textMuted },
});
