import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Switch, ActivityIndicator, Alert, Modal, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { auth, getShopId } from '../lib/auth';
import { useMergedOrdersUsed } from '../lib/useBillingPeriodOrderCount';
import { setAppLanguageFromDisplayName } from '../lib/i18n';

const LANGUAGES = ['English', 'Telugu', 'Hindi', 'Tamil', 'Kannada', 'Malayalam'];

export default function SettingsScreen({
  onManageServices,
  onManageItems,
  onEditProfile,
  onOpenSubscription,
}: {
  onManageServices: () => void,
  onManageItems: () => void,
  onEditProfile: () => void,
  onOpenSubscription: () => void,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const shopId = getShopId();

  const [shopData, setShopData] = useState<any>(null);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [serviceCount, setServiceCount] = useState(0);

  // Settings state
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('English');
  const [showLangPicker, setShowLangPicker] = useState(false);

  const ordersUsed = useMergedOrdersUsed(subscriptionData, shopId);

  useEffect(() => {
    let unsubShop: (() => void) | undefined;
    let unsubSub: (() => void) | undefined;

    try {
      const shopId = getShopId();
      if (!shopId) { setLoading(false); return; }

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
                setLanguage(data.settings?.language || 'English');
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
        .catch((err: any) => console.error('Service count error:', err));

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

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
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

  // Display values
  const shopName = shopData?.name || 'My Shop';
  const shopPhone = shopData?.phone || auth().currentUser?.phoneNumber || '';
  const shopEmail = shopData?.email || '';
  const ownerDisplay = [shopEmail, shopPhone].filter(Boolean).join(' \u2022 ');

  // Subscription
  const planName = subscriptionData?.planId || subscriptionData?.planName || shopData?.plan || 'free';
  const planDisplayName = planName.charAt(0).toUpperCase() + planName.slice(1).replace('_', ' ');
  const planStatus = subscriptionData?.status || 'trial';
  const billingCycle = subscriptionData?.billingCycle || '';

  const formatSubDate = (val: any): string => {
    if (!val) return '';
    const d = val.toDate ? val.toDate() : val.seconds ? new Date(val.seconds * 1000) : new Date(val);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const endDate = formatSubDate(subscriptionData?.endDate);
  const trialEndDate = formatSubDate(subscriptionData?.trialEndDate);
  const startDate = formatSubDate(subscriptionData?.startDate);
  const displayEndDate = endDate || trialEndDate || '';

  // Usage (ordersUsed from live order count + subscription fallback — see useMergedOrdersUsed)
  const maxOrders = subscriptionData?.limits?.maxOrders || 30;
  const totalCustomers = subscriptionData?.usage?.totalCustomers || 0;
  const totalStaff = subscriptionData?.usage?.totalStaff || 0;

  const statusLabel = planStatus === 'trial' ? 'TRIAL' :
    planStatus === 'active' ? 'ACTIVE' :
    planStatus === 'grace_period' ? 'GRACE' :
    planStatus === 'expired' ? 'EXPIRED' :
    planStatus === 'cancelled' ? 'CANCELLED' :
    planStatus === 'free' ? 'FREE' :
    planStatus.toUpperCase();

  const statusBadgeStyle = ['active', 'trial'].includes(planStatus)
    ? { backgroundColor: '#76f4e0' }
    : planStatus === 'free'
      ? { backgroundColor: '#e7e8ea' }
      : { backgroundColor: '#ffdad6' };

  const statusTextColor = ['active', 'trial'].includes(planStatus) ? '#005047' :
    planStatus === 'free' ? '#434654' : '#ba1a1a';

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#00408f" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header — minimal top padding */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('mobile.settingsHeader')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{shopName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.storeName} numberOfLines={1}>{shopName}</Text>
              <Text style={styles.ownerInfo} numberOfLines={1}>{ownerDisplay || 'No contact info'}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.editProfileBtn} onPress={onEditProfile}>
            <MaterialIcons name="edit" size={20} color="#00408f" />
          </TouchableOpacity>
        </View>

        {/* Subscription Banner */}
        <TouchableOpacity style={styles.promoBanner} onPress={onOpenSubscription} activeOpacity={0.9}>
          <View style={styles.promoHeader}>
            <View>
              <Text style={styles.promoOverline}>{t('mobile.currentPlan')}</Text>
              <Text style={styles.promoTitle}>{planDisplayName}</Text>
            </View>
            <View style={[styles.promoBadge, statusBadgeStyle]}>
              <Text style={[styles.promoBadgeText, { color: statusTextColor }]}>{statusLabel}</Text>
            </View>
          </View>

          {/* Usage Stats */}
          <View style={styles.usageRow}>
            <View style={styles.usageStat}>
              <Text style={styles.usageValue}>{ordersUsed}{maxOrders > 0 ? `/${maxOrders}` : ''}</Text>
              <Text style={styles.usageLabel}>{t('mobile.ordersUsage')}</Text>
            </View>
            <View style={styles.usageDivider} />
            <View style={styles.usageStat}>
              <Text style={styles.usageValue}>{totalCustomers}</Text>
              <Text style={styles.usageLabel}>{t('mobile.customersUsage')}</Text>
            </View>
            <View style={styles.usageDivider} />
            <View style={styles.usageStat}>
              <Text style={styles.usageValue}>{totalStaff}</Text>
              <Text style={styles.usageLabel}>{t('mobile.staffUsage')}</Text>
            </View>
          </View>

          {maxOrders > 0 && (
            <View style={styles.usageBar}>
              <View style={[styles.usageBarFill, { width: `${Math.min(100, (ordersUsed / maxOrders) * 100)}%` }]} />
            </View>
          )}

          <View style={styles.promoFooter}>
            <View>
              {startDate ? <Text style={styles.promoExpiry}>{t('mobile.started')}: {startDate}</Text> : null}
              {displayEndDate ? <Text style={styles.promoExpiry}>{t('mobile.expires')}: {displayEndDate}</Text> : null}
              {billingCycle ? <Text style={styles.promoExpiry}>{t('mobile.billing')}: {billingCycle}</Text> : null}
            </View>
            <TouchableOpacity style={styles.upgradeBtn} onPress={onOpenSubscription}>
              <Text style={styles.upgradeBtnText}>{t('common.upgradePlan')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* Services & Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('mobile.servicesItems')}</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.listItem} onPress={onManageServices}>
              <View style={styles.listItemLeft}>
                <MaterialIcons name="category" size={20} color="#00408f" />
                <Text style={styles.listItemText}>{t('mobile.manageServices')}</Text>
              </View>
              <View style={styles.listItemRight}>
                {serviceCount > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{serviceCount}</Text>
                  </View>
                )}
                <MaterialIcons name="chevron-right" size={20} color="#737685" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.listItemNoBorder} onPress={onManageItems}>
              <View style={styles.listItemLeft}>
                <MaterialIcons name="checkroom" size={20} color="#00408f" />
                <Text style={styles.listItemText}>{t('mobile.manageItems')}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#737685" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('mobile.appearance')}</Text>
          <View style={styles.sectionCard}>
            <View style={styles.listItemNoBorder}>
              <View style={styles.listItemLeft}>
                <MaterialIcons name={darkMode ? 'dark-mode' : 'light-mode'} size={20} color="#00408f" />
                <Text style={styles.listItemText}>{t('mobile.darkMode')}</Text>
              </View>
              <Switch
                value={darkMode}
                onValueChange={(val) => {
                  setDarkMode(val);
                  saveSetting('darkMode', val);
                }}
                trackColor={{ false: '#e1e2e4', true: '#00408f' }}
                thumbColor={darkMode ? '#ffffff' : '#f8f9fb'}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
            </View>
          </View>
        </View>

        {/* Language */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('mobile.languageSection')}</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.listItemNoBorder} onPress={() => setShowLangPicker(true)}>
              <View style={styles.listItemLeft}>
                <MaterialIcons name="translate" size={20} color="#00408f" />
                <Text style={styles.listItemText}>{language}</Text>
              </View>
              <View style={styles.listItemRight}>
                <MaterialIcons name="expand-more" size={20} color="#737685" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* About & Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('mobile.about')}</Text>
          <View style={styles.sectionCard}>
            <View style={styles.listItem}>
              <Text style={styles.listItemTextNoIcon}>{t('mobile.appVersion')}</Text>
              <Text style={styles.versionText}>v1.0.0</Text>
            </View>
            <TouchableOpacity style={styles.listItem}>
              <Text style={styles.listItemTextNoIcon}>{t('mobile.privacyPolicy')}</Text>
              <MaterialIcons name="open-in-new" size={16} color="#737685" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.listItemNoBorder}>
              <Text style={styles.supportText}>{t('mobile.contactSupport')}</Text>
              <MaterialIcons name="support-agent" size={16} color="#00408f" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Log Out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>{t('mobile.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Language Picker Modal */}
      <Modal visible={showLangPicker} transparent animationType="fade" onRequestClose={() => setShowLangPicker(false)}>
        <Pressable style={styles.modalDismiss} onPress={() => setShowLangPicker(false)} />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{t('mobile.selectLanguage')}</Text>
          <View style={{ gap: 2, marginTop: 8 }}>
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[styles.langOption, language === lang && styles.langOptionActive]}
                onPress={() => {
                  setLanguage(lang);
                  saveSetting('language', lang);
                  void setAppLanguageFromDisplayName(lang);
                  setShowLangPicker(false);
                }}
              >
                <Text style={[styles.langOptionText, language === lang && styles.langOptionTextActive]}>{lang}</Text>
                {language === lang && <MaterialIcons name="check" size={20} color="#00408f" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fb',
  },
  header: {
    paddingHorizontal: 20,
    height: 48,
    justifyContent: 'center',
    backgroundColor: '#f8f9fb',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#191c1e',
  },
  scrollContent: {
    padding: 16,
    gap: 20,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
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
    backgroundColor: '#00408f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
  },
  storeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#191c1e',
    marginBottom: 4,
  },
  ownerInfo: {
    fontSize: 12,
    color: '#434654',
  },
  editProfileBtn: {
    padding: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
  },
  promoBanner: {
    backgroundColor: '#00408f',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    shadowColor: '#00408f',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  promoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  promoOverline: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  promoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 2,
  },
  promoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  promoBadgeText: {
    fontSize: 10,
    fontWeight: '700',
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
    fontWeight: '800',
    color: '#ffffff',
  },
  usageLabel: {
    fontSize: 9,
    fontWeight: '600',
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
    backgroundColor: '#76f4e0',
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
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  upgradeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00408f',
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#434654',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 8,
  },
  sectionCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.5)',
  },
  listItemNoBorder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 48,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  listItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#191c1e',
    flex: 1,
  },
  listItemTextNoIcon: {
    fontSize: 14,
    fontWeight: '500',
    color: '#191c1e',
  },
  listItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countBadge: {
    backgroundColor: '#e1e2e4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#434654',
  },
  versionText: {
    fontSize: 12,
    color: '#434654',
  },
  supportText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00408f',
  },
  logoutBtn: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ba1a1a',
    letterSpacing: 1,
  },
  // Modal
  modalDismiss: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd', alignSelf: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#191c1e', marginBottom: 4 },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
  },
  langOptionActive: { backgroundColor: '#d8e2ff' },
  langOptionText: { fontSize: 15, fontWeight: '600', color: '#434654' },
  langOptionTextActive: { color: '#00408f', fontWeight: '700' },
});
