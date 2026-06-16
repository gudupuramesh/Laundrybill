import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View, ScrollView, TouchableOpacity, Switch, ActivityIndicator, Alert, Modal, Pressable, Linking, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { auth, getShopId } from '../lib/auth';
import { useMergedOrdersUsed } from '../lib/useBillingPeriodOrderCount';
import { useShopCountrySettings } from '../lib/use-shop-country-settings';
import { COUNTRIES, getCountry } from '../lib/country-config';
import appJson from '../../app.json';
import { HelpButton, TutorialVideosSheet } from '../components/HelpButton';
import { usePlanLimits } from '../lib/usePlanLimits';
import { colors, fonts, radii, shadows, spacing } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';
import {
  LANGUAGE_OPTIONS,
  nativeLabelForCode,
  resolveLanguageToCode,
  setAppLanguageCode,
} from '../lib/i18n';

export default function SettingsScreen({
  onManageServices,
  onManageItems,
  onEditProfile,
  onOpenSubscription,
  onStaffList,
  onAttendance,
  onCreateStaffLogin,
  onExpenseList,
  onServiceAreas,
  onFeedback,
}: {
  onManageServices: () => void,
  onManageItems: () => void,
  onEditProfile: () => void,
  onOpenSubscription: () => void,
  onStaffList?: () => void,
  onAttendance?: () => void,
  onCreateStaffLogin?: () => void,
  onExpenseList?: () => void,
  onServiceAreas?: () => void,
  onFeedback?: () => void,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const shopId = getShopId();
  const countrySettings = useShopCountrySettings(shopId);

  const [shopData, setShopData] = useState<any>(null);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [userProfileEmail, setUserProfileEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [serviceCount, setServiceCount] = useState(0);

  // Settings state
  const [darkMode, setDarkMode] = useState(false);
  const [languageCode, setLanguageCode] = useState('en');
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [platformSettings, setPlatformSettings] = useState<{ supportEmail?: string; supportPhone?: string; whatsappNumber?: string; privacyPolicyUrl?: string; websiteUrl?: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showTutorials, setShowTutorials] = useState(false);

  // Tax / GST settings
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxName, setTaxName] = useState('GST');
  const [taxRate, setTaxRate] = useState(0);
  const [gstNumber, setGstNumber] = useState('');
  const [showTaxEditor, setShowTaxEditor] = useState(false);
  const [taxNameDraft, setTaxNameDraft] = useState('GST');
  const [taxRateDraft, setTaxRateDraft] = useState('0');
  const [gstNumberDraft, setGstNumberDraft] = useState('');
  const [savingTax, setSavingTax] = useState(false);
  const isIndiaCountry = countrySettings.countryCode === 'IN';
  const languageOptionsForCountry = isIndiaCountry
    ? LANGUAGE_OPTIONS
    : LANGUAGE_OPTIONS.filter((opt) => opt.code === 'en');
  const filteredCountries = COUNTRIES.filter((country) => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return true;
    return (
      country.name.toLowerCase().includes(q) ||
      country.code.toLowerCase().includes(q) ||
      country.phoneCode.toLowerCase().includes(q) ||
      country.currencyCode.toLowerCase().includes(q)
    );
  });

  const ordersUsed = useMergedOrdersUsed(subscriptionData, shopId);
  const planLimits = usePlanLimits(subscriptionData);

  useEffect(() => {
    let unsubShop: (() => void) | undefined;
    let unsubSub: (() => void) | undefined;

    try {
      const shopId = getShopId();
      if (!shopId) { setLoading(false); return; }
      const uid = auth().currentUser?.uid;
      if (uid) {
        firestore()
          .collection('users')
          .doc(uid)
          .get()
          .then((doc: any) => {
            const userData = (doc?.data?.() ?? {}) as any;
            if (userData?.email) setUserProfileEmail(String(userData.email));
          })
          .catch((err: any) => console.error('Settings user email fetch error:', err));
      }

      unsubShop = firestore()
        .collection('shops')
        .doc(shopId)
        .onSnapshot(
          (doc: any) => {
            if (doc.exists) {
              const data = doc.data();
              if (data) {
                setShopData(data);
                setDarkMode(data.settings?.darkMode ?? false);
                setLanguageCode(resolveLanguageToCode(data.settings?.language));
                const tax = data.settings?.tax;
                if (tax) {
                  setTaxEnabled(!!tax.enabled);
                  setTaxName(tax.name || 'GST');
                  setTaxRate(Number(tax.rate) || 0);
                }
                setGstNumber(data.gstNumber || '');
              }
            }
            setLoading(false);
          },
          (err: any) => {
            console.error('Settings shop snapshot error:', err);
            setLoading(false);
          }
        );

      unsubSub = firestore()
        .collection('subscriptions')
        .doc(shopId)
        .onSnapshot(
          (doc: any) => {
            if (doc.exists) {
              setSubscriptionData(doc.data());
            }
          },
          (err: any) => console.error('Subscription snapshot error:', err)
        );

      firestore()
        .collection('shops')
        .doc(shopId)
        .collection('categories')
        .where('isActive', '==', true)
        .get()
        .then((snapshot: any) => {
          setServiceCount(snapshot.docs?.length || 0);
        })
        .catch((err: any) => {
          const code = err?.code || '';
          if (code === 'firestore/permission-denied') {
            setServiceCount(0);
            console.warn('Service count unavailable due to access rules');
            return;
          }
          console.error('Service count error:', err);
        });

      // Fetch platform settings for support & privacy links
      firestore()
        .collection('platformSettings')
        .doc('emailBranding')
        .get()
        .then((doc: any) => {
          if (doc.exists) {
            const d = doc.data();
            setPlatformSettings({
              supportEmail: d?.supportEmail || 'support@laundrybill.com',
              supportPhone: d?.supportPhone || '',
              whatsappNumber: d?.whatsappNumber || '',
              privacyPolicyUrl: d?.privacyPolicyUrl || (d?.websiteUrl ? `${d.websiteUrl}/privacy` : 'https://laundrybill.com/privacy'),
              websiteUrl: d?.websiteUrl || 'https://laundrybill.com',
            });
          } else {
            setPlatformSettings({
              supportEmail: 'support@laundrybill.com',
              privacyPolicyUrl: 'https://laundrybill.com/privacy',
              websiteUrl: 'https://laundrybill.com',
            });
          }
        })
        .catch(() => {
          setPlatformSettings({
            supportEmail: 'support@laundrybill.com',
            privacyPolicyUrl: 'https://laundrybill.com/privacy',
            websiteUrl: 'https://laundrybill.com',
          });
        });

    } catch (e) {
      console.error('Settings fetch error:', e);
      setLoading(false);
    }

    return () => {
      unsubShop?.();
      unsubSub?.();
    };
  }, []);

  const saveSetting = async (path: string, value: any) => {
    try {
      const shopId = getShopId();
      if (!shopId) return;
      await firestore().collection('shops').doc(shopId).set(
        { settings: { [path]: value }, updatedAt: new Date() },
        { merge: true }
      );
    } catch (e) {
      console.error('Failed to save setting:', e);
    }
  };

  const saveTaxEnabled = async (enabled: boolean) => {
    try {
      const sid = getShopId();
      if (!sid) return;
      setTaxEnabled(enabled);
      await firestore().collection('shops').doc(sid).set(
        {
          settings: {
            tax: { enabled, name: taxName || 'GST', rate: Number(taxRate) || 0 },
          },
          updatedAt: new Date(),
        },
        { merge: true }
      );
    } catch (e) {
      console.error('Failed to save tax enabled:', e);
      Alert.alert(t('mobile.errorTitle'), 'Failed to update tax setting');
    }
  };

  const openTaxEditor = () => {
    setTaxNameDraft(taxName || 'GST');
    setTaxRateDraft(String(taxRate || 0));
    setGstNumberDraft(gstNumber || '');
    setShowTaxEditor(true);
  };

  const saveTaxDetails = async () => {
    try {
      const sid = getShopId();
      if (!sid) return;
      const rate = parseFloat(taxRateDraft);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        Alert.alert(t('mobile.errorTitle'), t('mobile.taxRateInvalid'));
        return;
      }
      const name = (taxNameDraft || 'GST').trim();
      if (!name) {
        Alert.alert(t('mobile.errorTitle'), t('mobile.taxNameInvalid'));
        return;
      }
      setSavingTax(true);
      await firestore().collection('shops').doc(sid).set(
        {
          settings: {
            tax: { enabled: taxEnabled, name, rate },
          },
          gstNumber: gstNumberDraft.trim(),
          updatedAt: new Date(),
        },
        { merge: true }
      );
      setTaxName(name);
      setTaxRate(rate);
      setGstNumber(gstNumberDraft.trim());
      setShowTaxEditor(false);
    } catch (e) {
      console.error('Failed to save tax details:', e);
      Alert.alert(t('mobile.errorTitle'), 'Failed to save tax details');
    } finally {
      setSavingTax(false);
    }
  };

  const saveCountrySettings = async (countryCode: string) => {
    try {
      const sid = getShopId();
      if (!sid) return;
      const selected = getCountry(countryCode);
      const forceEnglish = selected.code !== 'IN';

      // Check if country is actually changing
      const prevCode = countrySettings.countryCode;
      const isCountryChange = prevCode && prevCode !== selected.code;

      await firestore().collection('shops').doc(sid).set(
        {
          settings: {
            countryCode: selected.code,
            phoneCountryCode: selected.phoneCode,
            currency: selected.currencyCode,
            currencySymbol: selected.currencySymbol,
            locale: selected.locale,
            timezone: selected.timezone,
            taxName: selected.taxName,
            // Also update the tax.name so it's consistent
            tax: { name: selected.taxName },
            ...(forceEnglish ? { language: 'en' } : {}),
          },
          updatedAt: new Date(),
        },
        { merge: true }
      );
      // Update local state immediately
      setTaxName(selected.taxName);
      if (forceEnglish) {
        setLanguageCode('en');
        void setAppLanguageCode('en');
      }

      // Force user to update phone number when country changes
      if (isCountryChange) {
        Alert.alert(
          'Update Phone Number',
          `Your country has been changed to ${selected.name} (${selected.phoneCode}). Please update your shop phone number to match the new country format (${selected.phoneDigits} digits).`,
          [
            {
              text: 'Update Now',
              onPress: () => onEditProfile(),
            },
          ],
          { cancelable: false }
        );
      }
    } catch (e) {
      console.error('Failed to save country settings:', e);
      Alert.alert(t('mobile.errorTitle'), 'Failed to update country settings');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('mobile.logoutConfirmTitle'),
      t('mobile.logoutConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.logout'),
          style: 'destructive',
          onPress: async () => {
            try {
              try {
                const { GoogleSignin } = require('@react-native-google-signin/google-signin');
                if (GoogleSignin.getCurrentUser()) {
                  await GoogleSignin.signOut();
                }
              } catch (_) {}
              await auth().signOut();
            } catch (e) {
              console.error('Logout error:', e);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('mobile.deleteAccountTitle'),
      t('mobile.deleteAccountMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('mobile.deleteAccountConfirm'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('mobile.deleteAccountFinalTitle'),
              t('mobile.deleteAccountFinalMessage'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('mobile.deleteAccountFinalConfirm'),
                  style: 'destructive',
                  onPress: async () => {
                    setDeleting(true);
                    try {
                      const user = auth().currentUser;
                      if (user) {
                        // Mark account for deletion in Firestore
                        const sid = getShopId();
                        if (sid) {
                          await firestore().collection('shops').doc(sid).set(
                            { deletionRequested: true, deletionRequestedAt: new Date(), deletionRequestedBy: user.uid },
                            { merge: true }
                          );
                        }
                        await user.delete();
                      }
                    } catch (e: any) {
                      // If re-auth required, sign out so they can sign in again and retry
                      if (e.code === 'auth/requires-recent-login') {
                        Alert.alert(
                          t('mobile.reAuthRequiredTitle'),
                          t('mobile.reAuthRequiredMessage'),
                          [{ text: t('common.ok'), onPress: () => auth().signOut() }]
                        );
                      } else {
                        Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.deleteAccountError'));
                      }
                    }
                    setDeleting(false);
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  // Display values
  const shopName = shopData?.name || t('mobile.myShopDefault');
  const shopPhone = shopData?.phone || auth().currentUser?.phoneNumber || '';
  const shopEmail = shopData?.email || auth().currentUser?.email || userProfileEmail || '';
  const ownerDisplay = [shopEmail, shopPhone].filter(Boolean).join(' \u2022 ');

  // Subscription
  const planName = subscriptionData?.planId || subscriptionData?.planName || shopData?.plan || 'free';
  const normalizedPlan = String(planName).toLowerCase().replace(/[_\s-]/g, '');
  const planDisplayName = (normalizedPlan === 'business' || normalizedPlan === 'enterprise' || normalizedPlan === 'proplus' || normalizedPlan === 'premium')
    ? 'Business Plan'
    : (normalizedPlan === 'pro' || normalizedPlan === 'starter')
      ? 'Pro Plan'
      : 'Free Plan';
  const planStatus = subscriptionData?.status || 'trial';
  const billingCycle = subscriptionData?.billingCycle || '';

  const formatSubDate = (val: any): string => {
    if (!val) return '';
    const d = val.toDate ? val.toDate() : val.seconds ? new Date(val.seconds * 1000) : new Date(val);
    return d.toLocaleDateString(countrySettings.locale || 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const endDate = formatSubDate(subscriptionData?.endDate);
  const trialEndDate = formatSubDate(subscriptionData?.trialEndDate);
  const startDate = formatSubDate(subscriptionData?.startDate);
  const displayEndDate = endDate || trialEndDate || '';

  // Usage (ordersUsed from live order count + subscription fallback — see useMergedOrdersUsed)
  const maxOrders = planLimits.maxOrders > 0 ? planLimits.maxOrders : 0; // 0 or -1 = unlimited
  const totalCustomers = subscriptionData?.usage?.totalCustomers || 0;
  const totalStaff = subscriptionData?.usage?.totalStaff || 0;

  const statusLabel = planStatus === 'trial' ? t('mobile.planStatusTrial') :
    planStatus === 'active' ? t('mobile.planStatusActive') :
    planStatus === 'grace_period' ? t('mobile.planStatusGrace') :
    planStatus === 'expired' ? t('mobile.planStatusExpired') :
    planStatus === 'cancelled' ? t('mobile.planStatusCancelled') :
    planStatus === 'free' ? t('mobile.planStatusFree') :
    planStatus.toUpperCase();

  const statusBadgeStyle = ['active', 'trial'].includes(planStatus)
    ? { backgroundColor: colors.mint }
    : planStatus === 'free'
      ? { backgroundColor: colors.border }
      : { backgroundColor: colors.errorBg };

  const statusTextColor = ['active', 'trial'].includes(planStatus) ? colors.darkBlue :
    planStatus === 'free' ? colors.textSecondary : colors.error;

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ width: 40 }} />
        <Text style={styles.headerTitle}>{t('mobile.settingsTitle', { defaultValue: 'Settings' })}</Text>
        <HelpButton pageId="mobile_settings" />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Shop Details Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileInfo}>
            <View style={styles.avatar}>
              {shopData?.logoUrl ? (
                <Image source={{ uri: shopData.logoUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{shopName.charAt(0).toUpperCase()}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.storeName} numberOfLines={1}>{shopName}</Text>
              <Text style={styles.ownerInfo} numberOfLines={1}>
                {shopData?.location?.city ? `Store: ${shopData.location.city}` : ownerDisplay || t('mobile.noContactInfo')}
              </Text>
              {shopData?.phone ? (
                <Text style={[styles.ownerInfo, { color: colors.textMuted }]} numberOfLines={1}>{shopData.phone}</Text>
              ) : null}
            </View>
          </View>
          <TouchableOpacity style={styles.editProfileBtn} onPress={onEditProfile}>
            <MaterialIcons name="edit" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Subscription Banner — Blue Gradient */}
        <TouchableOpacity activeOpacity={0.9} onPress={onOpenSubscription}>
          <LinearGradient
            colors={['#1B61E5', '#124BB8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.promoBanner}
          >
            {/* Header: Plan name + badge */}
            <View style={styles.promoHeader}>
              <View>
                <Text style={styles.promoOverline}>{t('mobile.currentPlan')}</Text>
                <Text style={styles.promoTitle}>{planDisplayName}</Text>
              </View>
              <View style={styles.promoBadge}>
                <Text style={styles.promoBadgeText}>{statusLabel}</Text>
              </View>
            </View>

            {/* Usage Stats: Orders / Customers / Staff */}
            <View style={styles.usageRow}>
              <View style={styles.usageStat}>
                <Text style={styles.usageValue}>{ordersUsed}{maxOrders > 0 ? `/${maxOrders}` : ''}</Text>
                <Text style={styles.usageLabel}>{t('mobile.ordersUsage')}</Text>
              </View>
              <View style={styles.usageDivider} />
              <View style={styles.usageStat}>
                <Text style={styles.usageValue}>{totalCustomers}{planLimits.maxCustomers > 0 ? `/${planLimits.maxCustomers}` : ''}</Text>
                <Text style={styles.usageLabel}>{t('mobile.customersUsage')}</Text>
              </View>
              <View style={styles.usageDivider} />
              <View style={styles.usageStat}>
                <Text style={styles.usageValue}>{totalStaff}{planLimits.maxStaff > 0 ? `/${planLimits.maxStaff}` : ''}</Text>
                <Text style={styles.usageLabel}>{t('mobile.staffUsage')}</Text>
              </View>
            </View>

            {/* Progress bar */}
            {maxOrders > 0 && (
              <View style={styles.usageBar}>
                <View style={[styles.usageBarFill, { width: `${Math.min(100, (ordersUsed / maxOrders) * 100)}%` }]} />
              </View>
            )}

            {/* Footer: billing + upgrade */}
            <View style={styles.promoFooter}>
              <View>
                {displayEndDate ? <Text style={styles.promoExpiry}>{t('mobile.expires')}: {displayEndDate}</Text> : null}
                {billingCycle ? <Text style={styles.promoExpiry}>{t('mobile.billing')}: {billingCycle}</Text> : null}
              </View>
              <TouchableOpacity style={styles.upgradeBtn} onPress={onOpenSubscription}>
                <Text style={styles.upgradeBtnText}>{t('common.upgradePlan')}</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Services & Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('mobile.servicesItems')}</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.listItem} onPress={onManageServices}>
              <View style={styles.listItemLeft}>
                <View style={[styles.listItemIcon, { backgroundColor: colors.primaryTint }]}>
                  <MaterialIcons name="category" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.listItemText}>{t('mobile.manageServices')}</Text>
                  <Text style={styles.listItemSubtext}>Add/edit service categories & pricing</Text>
                </View>
              </View>
              <View style={styles.listItemRight}>
                {serviceCount > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{serviceCount}</Text>
                  </View>
                )}
                <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={onServiceAreas ? styles.listItem : styles.listItemNoBorder} onPress={onManageItems}>
              <View style={styles.listItemLeft}>
                <View style={[styles.listItemIcon, { backgroundColor: colors.warningBg }]}>
                  <MaterialIcons name="checkroom" size={18} color={colors.warning} />
                </View>
                <View>
                  <Text style={styles.listItemText}>{t('mobile.manageItems')}</Text>
                  <Text style={styles.listItemSubtext}>Configure clothing items & prices</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            {onServiceAreas ? (
              <TouchableOpacity style={styles.listItemNoBorder} onPress={onServiceAreas}>
                <View style={styles.listItemLeft}>
                  <View style={[styles.listItemIcon, { backgroundColor: colors.successBg }]}>
                    <MaterialIcons name="place" size={18} color={colors.success} />
                  </View>
                  <View>
                    <Text style={styles.listItemText}>Service Areas</Text>
                    <Text style={styles.listItemSubtext}>Delivery areas & per-area agents</Text>
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Staff & Attendance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('mobile.staffSection', { defaultValue: 'Staff & Attendance' })}</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.listItem} onPress={onStaffList}>
              <View style={styles.listItemLeft}>
                <View style={[styles.listItemIcon, { backgroundColor: colors.primaryTint }]}>
                  <MaterialIcons name="groups" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.listItemText}>{t('mobile.manageStaff', { defaultValue: 'Manage Staff' })}</Text>
                  <Text style={styles.listItemSubtext}>{t('mobile.manageStaffDesc', { defaultValue: 'Add, edit & manage staff members' })}</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.listItem} onPress={onAttendance}>
              <View style={styles.listItemLeft}>
                <View style={[styles.listItemIcon, { backgroundColor: colors.successBg }]}>
                  <MaterialIcons name="event-available" size={18} color={colors.success} />
                </View>
                <View>
                  <Text style={styles.listItemText}>{t('mobile.markAttendance', { defaultValue: 'Mark Attendance' })}</Text>
                  <Text style={styles.listItemSubtext}>{t('mobile.markAttendanceDesc', { defaultValue: 'Daily attendance tracking for staff' })}</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            {/* Staff App / Agent / Plant logins are a Business-tier feature.
                Hidden until the Business plan + its IAP products go live. */}
            {onCreateStaffLogin && (
              <TouchableOpacity style={styles.listItemNoBorder} onPress={onCreateStaffLogin}>
                <View style={styles.listItemLeft}>
                  <View style={[styles.listItemIcon, { backgroundColor: colors.warningBg }]}>
                    <MaterialIcons name="vpn-key" size={18} color={colors.warning} />
                  </View>
                  <View>
                    <Text style={styles.listItemText}>{t('mobile.createStaffLogin', { defaultValue: 'Create Staff Login' })}</Text>
                    <Text style={styles.listItemSubtext}>{t('mobile.createStaffLoginDesc', { defaultValue: 'Staff App, Agent & Plant logins' })}</Text>
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Finance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('mobile.financeSection', { defaultValue: 'Finance' })}</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.listItemNoBorder} onPress={onExpenseList}>
              <View style={styles.listItemLeft}>
                <View style={[styles.listItemIcon, { backgroundColor: colors.errorBg }]}>
                  <MaterialIcons name="receipt-long" size={18} color={colors.error} />
                </View>
                <View>
                  <Text style={styles.listItemText}>{t('mobile.expensesList', { defaultValue: 'Manage Expenses' })}</Text>
                  <Text style={styles.listItemSubtext}>{t('mobile.expensesListDesc', { defaultValue: 'Track & manage all expenses' })}</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Business / Tax */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('mobile.businessSection')}</Text>
          <View style={styles.sectionCard}>
            <View style={styles.listItem}>
              <View style={styles.listItemLeft}>
                <View style={[styles.listItemIcon, { backgroundColor: colors.primaryTint }]}>
                  <MaterialIcons name="attach-money" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.listItemText}>{t('mobile.chargeTax', { tax: taxName || 'GST' })}</Text>
                  <Text style={styles.listItemSubtext}>Auto-apply taxes to new orders</Text>
                </View>
              </View>
              <Switch
                value={taxEnabled}
                onValueChange={(val) => { void saveTaxEnabled(val); }}
                trackColor={{ false: colors.border, true: colors.success }}
                thumbColor={colors.surface}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
            </View>
            <TouchableOpacity style={styles.listItemNoBorder} onPress={openTaxEditor}>
              <View style={styles.listItemLeft}>
                <View style={[styles.listItemIcon, { backgroundColor: colors.successBg }]}>
                  <MaterialIcons name="receipt" size={18} color={colors.success} />
                </View>
                <View>
                  <Text style={styles.listItemText}>{t('mobile.taxDetails')}</Text>
                  <Text style={styles.listItemSubtext}>{taxEnabled ? `${taxName} · ${taxRate}%` : 'Tax disabled'}</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Appearance & Language */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('mobile.appearance')}</Text>
          <View style={styles.sectionCard}>
            <View style={styles.listItem}>
              <View style={styles.listItemLeft}>
                <View style={[styles.listItemIcon, { backgroundColor: colors.surfaceMuted }]}>
                  <MaterialIcons name={darkMode ? 'dark-mode' : 'light-mode'} size={18} color={colors.textSecondary} />
                </View>
                <View>
                  <Text style={styles.listItemText}>{t('mobile.darkMode')}</Text>
                  <Text style={styles.listItemSubtext}>Switch between light & dark theme</Text>
                </View>
              </View>
              <Switch
                value={darkMode}
                onValueChange={(val) => {
                  setDarkMode(val);
                  saveSetting('darkMode', val);
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.surface}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
            </View>
            <TouchableOpacity style={styles.listItem} onPress={() => setShowCountryPicker(true)}>
              <View style={styles.listItemLeft}>
                <View style={[styles.listItemIcon, { backgroundColor: colors.warningBg }]}>
                  <MaterialIcons name="public" size={18} color={colors.warning} />
                </View>
                <View>
                  <Text style={styles.listItemText}>{getCountry(countrySettings.countryCode).name}</Text>
                  <Text style={styles.listItemSubtext}>{countrySettings.phoneCountryCode} · {countrySettings.currency}</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.listItemNoBorder} onPress={() => { if (isIndiaCountry) setShowLangPicker(true); }}>
              <View style={styles.listItemLeft}>
                <View style={[styles.listItemIcon, { backgroundColor: colors.primaryTint }]}>
                  <MaterialIcons name="translate" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.listItemText}>App Language</Text>
                  <Text style={styles.listItemSubtext}>{nativeLabelForCode(languageCode)}</Text>
                </View>
              </View>
              <MaterialIcons name={isIndiaCountry ? "chevron-right" : "lock"} size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* About & Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('mobile.about')}</Text>
          <View style={styles.sectionCard}>
            <View style={styles.listItem}>
              <View style={styles.listItemLeft}>
                <View style={[styles.listItemIcon, { backgroundColor: colors.surfaceMuted }]}>
                  <MaterialIcons name="info-outline" size={18} color={colors.textSecondary} />
                </View>
                <View>
                  <Text style={styles.listItemText}>{t('mobile.appVersion')}</Text>
                  <Text style={styles.listItemSubtext}>v{appJson.expo.version} ({appJson.expo.android?.versionCode ?? ''})</Text>
                </View>
              </View>
              <View style={{ backgroundColor: colors.primaryTint, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ fontSize: 11, fontFamily: fonts.bold, color: colors.primary }}>LATEST</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.listItem} onPress={() => Linking.openURL(platformSettings?.privacyPolicyUrl || 'https://laundrybill.com/privacy')}>
              <View style={styles.listItemLeft}>
                <View style={[styles.listItemIcon, { backgroundColor: colors.primaryTint }]}>
                  <MaterialIcons name="shield" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.listItemText}>{t('mobile.privacyPolicy')}</Text>
                  <Text style={styles.listItemSubtext}>Privacy policy & terms</Text>
                </View>
              </View>
              <MaterialIcons name="open-in-new" size={16} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.listItemNoBorder} onPress={() => {
              const email = platformSettings?.supportEmail || 'support@laundrybill.com';
              const whatsapp = platformSettings?.whatsappNumber;
              if (whatsapp) {
                const num = whatsapp.replace(/\D/g, '');
                Linking.openURL(`https://wa.me/${num}`).catch(() => Linking.openURL(`mailto:${email}`));
              } else {
                Linking.openURL(`mailto:${email}`);
              }
            }}>
              <View style={styles.listItemLeft}>
                <View style={[styles.listItemIcon, { backgroundColor: colors.successBg }]}>
                  <MaterialIcons name="support-agent" size={18} color={colors.success} />
                </View>
                <View>
                  <Text style={styles.listItemText}>{t('mobile.contactSupport')}</Text>
                  <Text style={styles.listItemSubtext}>WhatsApp chat & email support</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            {onFeedback ? (
              <TouchableOpacity style={styles.listItemNoBorder} onPress={onFeedback}>
                <View style={styles.listItemLeft}>
                  <View style={[styles.listItemIcon, { backgroundColor: colors.primaryTint }]}>
                    <MaterialIcons name="feedback" size={18} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.listItemText}>Send Feedback</Text>
                    <Text style={styles.listItemSubtext}>Report an issue or share a suggestion</Text>
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Tutorial Videos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('mobile.tutorialVideos', { defaultValue: 'Learn & Help' })}</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.listItemNoBorder} onPress={() => setShowTutorials(true)}>
              <View style={styles.listItemLeft}>
                <View style={[styles.listItemIcon, { backgroundColor: colors.errorBg }]}>
                  <MaterialIcons name="play-circle-filled" size={18} color={colors.error} />
                </View>
                <View>
                  <Text style={styles.listItemText}>{t('mobile.tutorialVideos', { defaultValue: 'Tutorial Videos' })}</Text>
                  <Text style={styles.listItemSubtext}>{t('mobile.tutorialVideosDesc', { defaultValue: 'Watch step-by-step guides in the app' })}</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('mobile.accountSection')}</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.logoutListItem} onPress={handleLogout}>
              <MaterialIcons name="logout" size={18} color={colors.error} />
              <Text style={styles.logoutText}>{t('mobile.logout')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteListItem} onPress={handleDeleteAccount} disabled={deleting}>
              <MaterialIcons name="delete-forever" size={18} color={colors.error} />
              {deleting
                ? <ActivityIndicator size="small" color={colors.error} />
                : <Text style={styles.deleteText}>{t('mobile.deleteAccount')}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Language Picker Modal */}
      <Modal visible={showLangPicker} transparent animationType="fade" onRequestClose={() => setShowLangPicker(false)}>
        <Pressable style={styles.modalDismiss} onPress={() => setShowLangPicker(false)} />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{t('mobile.selectLanguage')}</Text>
          <View style={{ gap: 2, marginTop: 8 }}>
            {languageOptionsForCountry.map((opt) => (
              <TouchableOpacity
                key={opt.code}
                style={[styles.langOption, languageCode === opt.code && styles.langOptionActive]}
                onPress={() => {
                  setLanguageCode(opt.code);
                  saveSetting('language', opt.code);
                  void setAppLanguageCode(opt.code);
                  setShowLangPicker(false);
                }}
              >
                <Text style={[styles.langOptionText, languageCode === opt.code && styles.langOptionTextActive]}>
                  {opt.native}
                </Text>
                {languageCode === opt.code && <MaterialIcons name="check" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Tax Editor Modal */}
      <Modal visible={showTaxEditor} transparent animationType="fade" onRequestClose={() => setShowTaxEditor(false)}>
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalDismiss} onPress={() => setShowTaxEditor(false)} />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{t('mobile.taxDetails')}</Text>

              <Text style={styles.taxFieldLabel}>{t('mobile.taxNameLabel')}</Text>
              <TextInput
                style={styles.taxInput}
                value={taxNameDraft}
                onChangeText={setTaxNameDraft}
                placeholder="GST"
                autoCapitalize="characters"
              />

              <Text style={styles.taxFieldLabel}>{t('mobile.taxRateLabel')}</Text>
              <TextInput
                style={styles.taxInput}
                value={taxRateDraft}
                onChangeText={setTaxRateDraft}
                placeholder="18"
                keyboardType="decimal-pad"
              />

              <Text style={styles.taxFieldLabel}>{t('mobile.gstNumberLabel')}</Text>
              <TextInput
                style={styles.taxInput}
                value={gstNumberDraft}
                onChangeText={setGstNumberDraft}
                placeholder="22AAAAA0000A1Z5"
                autoCapitalize="characters"
              />

              <TouchableOpacity
                style={[styles.taxSaveBtn, savingTax && { opacity: 0.6 }]}
                onPress={saveTaxDetails}
                disabled={savingTax}
              >
                {savingTax
                  ? <ActivityIndicator size="small" color={colors.surface} />
                  : <Text style={styles.taxSaveBtnText}>{t('common.save')}</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Country Picker Modal */}
      <Modal visible={showCountryPicker} transparent animationType="fade" onRequestClose={() => setShowCountryPicker(false)}>
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.modalDismiss} onPress={() => setShowCountryPicker(false)} />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Select country</Text>
          <TextInput
            style={styles.countrySearchInput}
            placeholder="Search country / code / dial code"
            value={countrySearch}
            onChangeText={setCountrySearch}
            autoCapitalize="none"
          />
          <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
            <View style={{ gap: 2, marginTop: 8 }}>
            {filteredCountries.map((country) => (
              <TouchableOpacity
                key={country.code}
                style={[styles.langOption, countrySettings.countryCode === country.code && styles.langOptionActive]}
                onPress={() => {
                  void saveCountrySettings(country.code);
                  setCountrySearch('');
                  setShowCountryPicker(false);
                }}
              >
                <Text style={[styles.langOptionText, countrySettings.countryCode === country.code && styles.langOptionTextActive]}>
                  {country.name} ({country.phoneCode}) · {country.currencyCode}
                </Text>
                {countrySettings.countryCode === country.code && <MaterialIcons name="check" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            </View>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Tutorial Videos — full in-app list */}
      <TutorialVideosSheet
        visible={showTutorials}
        onClose={() => setShowTutorials(false)}
        allMode
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 16,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.card,
    ...shadows.cardBorder,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.darkBlue,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarText: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.surface,
  },
  storeName: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 4,
  },
  ownerInfo: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  editProfileBtn: {
    padding: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 20,
  },
  promoBanner: {
    borderRadius: radii.card,
    padding: 16,
    gap: 12,
    overflow: 'hidden',
  },
  promoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  promoOverline: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  promoTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.surface,
    marginTop: 2,
  },
  promoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  promoBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.surface,
    letterSpacing: 0.5,
  },
  usageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingVertical: 8,
  },
  usageStat: {
    flex: 1,
    alignItems: 'center',
  },
  usageValue: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.surface,
  },
  usageLabel: {
    fontSize: 9,
    fontFamily: fonts.semibold,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  usageDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  usageBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  usageBarFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.mint,
  },
  promoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  promoExpiry: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
  upgradeBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.button,
  },
  upgradeBtnText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 8,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listItemNoBorder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  listItemIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  listItemText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.text,
    flex: 1,
  },
  listItemSubtext: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginTop: 1,
  },
  listItemTextNoIcon: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  listItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countBadge: {
    backgroundColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.badge,
  },
  countText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },
  versionText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  supportText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  logoutListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logoutText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.error,
  },
  deleteListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    height: 48,
  },
  deleteText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.error,
  },
  // Modal
  modalDismiss: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '88%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text, marginBottom: 4 },
  countrySearchInput: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radii.input,
  },
  langOptionActive: { backgroundColor: colors.primaryTint },
  langOptionText: { fontSize: 15, fontFamily: fonts.semibold, color: colors.textSecondary },
  langOptionTextActive: { color: colors.primary, fontFamily: fonts.bold },
  taxFieldLabel: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 6,
  },
  taxInput: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
  },
  taxSaveBtn: {
    marginTop: 20,
    height: 48,
    borderRadius: radii.button,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taxSaveBtnText: {
    color: colors.surface,
    fontSize: 15,
    fontFamily: fonts.bold,
  },
});
