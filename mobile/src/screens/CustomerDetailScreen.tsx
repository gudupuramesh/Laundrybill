import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Linking, Alert, KeyboardAvoidingView, Platform, Modal, Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import { formatCurrency } from '../lib/currency-format';
import { useShopCountrySettings } from '../lib/use-shop-country-settings';
import { normalizePhoneForCountry, toE164 } from '../lib/currency-format';

// ─── Helpers ──────────────────────────────────────────────────────────

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  if (val instanceof Date) return val;
  return new Date(val);
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatDateLocalized(d: Date | null, locale: string): string {
  if (!d) return '—';
  try {
    return d.toLocaleString(locale || 'en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return formatDate(d);
  }
}

function memberSinceText(d: Date | null, locale: string, t: TFunction): string {
  if (!d) return '';
  const month = d.toLocaleString(locale || 'en-IN', { month: 'long' });
  return t('mobile.memberSince', { month, year: d.getFullYear() });
}

function cdOrderStatus(status: string, t: TFunction): string {
  const tr = t(`mobile.odStatus_${status}` as any);
  return tr || status;
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#fff3e0', text: '#e65100' },
  confirmed: { bg: '#e3f2fd', text: '#1565c0' },
  processing: { bg: '#fff8e1', text: '#f9a825' },
  ready: { bg: '#e8f5e9', text: '#2e7d32' },
  out_for_delivery: { bg: '#e3f2fd', text: '#1565c0' },
  delivered: { bg: '#e8f5e9', text: '#2e7d32' },
  picked_up: { bg: '#e8f5e9', text: '#2e7d32' },
  cancelled: { bg: '#fce4ec', text: '#c62828' },
};

// ─── Component ────────────────────────────────────────────────────────

export default function CustomerDetailScreen({
  onBack,
  customerId,
  onViewOrder,
}: {
  onBack: () => void;
  customerId: string;
  onViewOrder?: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const shopId = getShopId();
  const countrySettings = useShopCountrySettings(shopId);
  const withCurrencySymbol = (text: string) => text.replace(/₹/g, countrySettings.currencySymbol || '₹');
  const phoneDigitsLimit = Math.max(6, countrySettings.phoneDigits || 10);
  const [customer, setCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notesText, setNotesText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Edit customer
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (!shopId || !customerId) { setLoading(false); return; }

    const unsubCustomer = firestore()
      .collection(`shops/${shopId}/customers`).doc(customerId)
      .onSnapshot(
        (snap: any) => {
          if (snap.exists) {
            const data = { id: snap.id, ...snap.data() };
            setCustomer(data);
            setNotesText(data.notes || '');
          }
          setLoading(false);
        },
        () => setLoading(false),
      );

    // Fetch orders for this customer
    const unsubOrders = firestore()
      .collection(`shops/${shopId}/orders`)
      .orderBy('createdAt', 'desc')
      .limit(200)
      .onSnapshot(
        (snap: any) => {
          const all = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          // Filter by customerId or matching phone
          const customerOrders = all.filter((o: any) =>
            o.customerId === customerId ||
            o.customer?.id === customerId
          );
          setOrders(customerOrders);
        },
        () => {},
      );

    return () => { unsubCustomer(); unsubOrders(); };
  }, [shopId, customerId]);

  // Stats
  const stats = useMemo(() => {
    let totalSpent = customer?.totalSpent || 0;
    let totalOrders = customer?.totalOrders || 0;
    let unpaid = 0;

    // Also compute from orders if available
    if (orders.length > 0) {
      totalOrders = Math.max(totalOrders, orders.length);
      orders.forEach((o) => {
        unpaid += o.financials?.balance || 0;
      });
    }

    const avgValue = totalOrders > 0 ? Math.round(totalSpent / totalOrders) : 0;
    return { totalOrders, totalSpent: Math.round(totalSpent), avgValue, unpaid: Math.round(unpaid) };
  }, [customer, orders]);

  const createdAt = toDate(customer?.createdAt);
  const phone = customer?.phone || '';
  const address = customer?.address || customer?.addresses?.[0]?.address || '';
  const email = customer?.email || '';
  const isActive = customer?.isActive !== false;

  const handleSaveNotes = async () => {
    if (savingNotes || !shopId || !customerId) return;
    setSavingNotes(true);
    try {
      await firestore()
        .collection(`shops/${shopId}/customers`).doc(customerId)
        .update({ notes: notesText, updatedAt: new Date() });
    } catch (e: any) {
      Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedSaveNotes'));
    }
    setSavingNotes(false);
  };

  const handleCall = () => {
    if (!phone) return;
    Linking.openURL(`tel:${phone.replace(/\D/g, '')}`).catch(() => {});
  };

  const handleWhatsApp = () => {
    if (!phone) return;
    const p = phone.replace(/\D/g, '');
    const wa = toE164(normalizePhoneForCountry(p, countrySettings), countrySettings).replace(/\D/g, '');
    Linking.openURL(`https://wa.me/${wa}`).catch(() => {});
  };

  const openEditModal = () => {
    if (!customer) return;
    setEditName(customer.name || '');
    setEditPhone(normalizePhoneForCountry(customer.phone || '', countrySettings));
    setEditEmail(customer.email || '');
    setEditAddress(customer.address || customer.addresses?.[0]?.address || '');
    setEditModal(true);
  };

  const handleUpdateCustomer = async () => {
    const trimmedName = editName.trim();
    const phoneDigits = normalizePhoneForCountry(editPhone, countrySettings);
    if (!trimmedName) { Alert.alert(t('mobile.nameRequiredTitle'), t('mobile.nameRequiredMsg')); return; }
    if (phoneDigits.length !== phoneDigitsLimit) {
      Alert.alert(t('mobile.invalidPhoneTitle'), t('mobile.invalidPhoneMsg'));
      return;
    }
    if (!shopId || editSaving) return;
    setEditSaving(true);
    try {
      await firestore()
        .collection(`shops/${shopId}/customers`).doc(customerId)
        .update({
          name: trimmedName,
          phone: toE164(phoneDigits, countrySettings),
          email: editEmail.trim() || null,
          address: editAddress.trim() || null,
          updatedAt: new Date(),
        });
      setEditModal(false);
    } catch (e: any) {
      Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedUpdateCustomer'));
    }
    setEditSaving(false);
  };

  // ─── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color="#00408f" /></View>;
  }

  if (!customer) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }]}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#191c1e', marginBottom: 12 }}>{t('mobile.customerNotFoundTitle')}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={onBack}><Text style={styles.primaryBtnText}>{t('mobile.goBack')}</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
            <MaterialIcons name="arrow-back" size={24} color="#00408f" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{customer.name || t('mobile.customerDefaultTitle')}</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={openEditModal}>
            <MaterialIcons name="edit" size={22} color="#00408f" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 30 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Profile Card ─────────────────────────────────────── */}
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={[styles.avatarLg, !isActive && { backgroundColor: '#737685' }]}>
              <Text style={styles.avatarLgText}>{getInitials(customer.name || '')}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameStatusRow}>
                <Text style={styles.profileName} numberOfLines={1}>{customer.name}</Text>
                {!isActive && (
                  <View style={styles.inactiveBadge}>
                    <Text style={styles.inactiveBadgeText}>{t('mobile.inactiveLabel')}</Text>
                  </View>
                )}
              </View>
              {createdAt && (
                <View style={styles.memberRow}>
                  <MaterialIcons name="calendar-today" size={12} color="#737685" />
                  <Text style={styles.memberText}>{memberSinceText(createdAt, i18n.language, t)}</Text>
                </View>
              )}
              {/* Contact buttons */}
              <View style={styles.contactBtns}>
                {phone ? (
                  <>
                    <TouchableOpacity style={styles.contactCircle} onPress={handleCall}>
                      <MaterialIcons name="call" size={16} color="#00408f" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.contactCircle, { backgroundColor: '#e6f7f2' }]} onPress={handleWhatsApp}>
                      <MaterialIcons name="chat" size={16} color="#25D366" />
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            </View>
          </View>

          {/* Contact info */}
          <View style={styles.contactSection}>
            {phone ? (
              <View style={styles.contactRow}>
                <MaterialIcons name="phone" size={14} color="#737685" />
                <Text style={styles.contactVal}>{phone}</Text>
              </View>
            ) : null}
            {email ? (
              <View style={styles.contactRow}>
                <MaterialIcons name="email" size={14} color="#737685" />
                <Text style={styles.contactVal}>{email}</Text>
              </View>
            ) : null}
            {address ? (
              <View style={[styles.contactRow, { alignItems: 'flex-start' }]}>
                <MaterialIcons name="location-on" size={14} color="#737685" style={{ marginTop: 2 }} />
                <Text style={[styles.contactVal, { flex: 1 }]}>{address}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── Stats Grid ───────────────────────────────────────── */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t('mobile.statTotalOrders')}</Text>
            <Text style={[styles.statValue, { color: '#00408f' }]}>{stats.totalOrders}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t('mobile.statTotalSpent')}</Text>
            <Text style={styles.statValue}>{formatCurrency(stats.totalSpent, countrySettings)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>AVG ORDER</Text>
            <Text style={styles.statValue}>{formatCurrency(stats.avgValue, countrySettings)}</Text>
          </View>
          <View style={[styles.statCard, stats.unpaid > 0 && { backgroundColor: '#ffdad6' }]}>
            <Text style={[styles.statLabel, stats.unpaid > 0 && { color: '#93000a' }]}>{t('mobile.statUnpaidLabel')}</Text>
            <Text style={[styles.statValue, { color: stats.unpaid > 0 ? '#93000a' : '#2e7d32' }]}>
              {formatCurrency(stats.unpaid, countrySettings)}
            </Text>
          </View>
        </View>

        {/* ─── Order History ─────────────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('mobile.orderHistoryTitle')}</Text>
          <Text style={styles.orderCount}>{t('mobile.ordersCountTitle', { count: orders.length })}</Text>
        </View>

        {orders.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="receipt-long" size={40} color="#c3c6d6" />
            <Text style={styles.emptyText}>{t('mobile.noOrdersYet')}</Text>
          </View>
        ) : (
          <View style={styles.orderList}>
            {orders.map((order) => {
              const cfg = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
              const label = order.status ? cdOrderStatus(order.status, t) : t('mobile.unknownStatus');
              const created = toDate(order.createdAt);
              const itemCount = (order.items || []).reduce((s: number, i: any) => s + (i.quantity || 1), 0);
              const total = Math.round(order.financials?.total || 0);
              const balance = Math.round(order.financials?.balance || 0);
              const publicId = order.publicId || order.orderNumber || order.id?.slice(-4) || '';

              // Gather unique service categories
              const categories: string[] = [...new Set((order.items || []).map((i: any) => i.categoryName).filter(Boolean))] as string[];

              return (
                <TouchableOpacity
                  key={order.id}
                  style={styles.orderCard}
                  activeOpacity={0.7}
                  onPress={() => onViewOrder?.(order.id)}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.orderTopRow}>
                      <Text style={styles.orderId}>#{publicId}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                        <Text style={[styles.statusText, { color: cfg.text }]}>{label}</Text>
                      </View>
                    </View>
                    <Text style={styles.orderDate}>{formatDateLocalized(created, i18n.language)}</Text>
                    <View style={styles.orderMeta}>
                      <Text style={styles.orderMetaText}>{t('mobile.itemsMetaCount', { count: itemCount })}</Text>
                      <View style={styles.dot} />
                      <Text style={styles.orderAmount}>{formatCurrency(total, countrySettings)}</Text>
                      {balance > 0 ? (
                        <>
                          <View style={styles.dot} />
                          <Text style={styles.unpaidLabel}>{withCurrencySymbol(t('mobile.orderDueLabel', { amount: balance }) as string)}</Text>
                        </>
                      ) : (
                        <>
                          <View style={styles.dot} />
                          <Text style={styles.paidLabel}>{t('mobile.paidLabel')}</Text>
                        </>
                      )}
                    </View>
                    {categories.length > 0 && (
                      <View style={styles.categoryTags}>
                        {categories.slice(0, 3).map((cat: string) => (
                          <View key={cat} style={styles.categoryTag}>
                            <Text style={styles.categoryTagText}>{cat.toUpperCase()}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ─── Financial Summary ─────────────────────────────────── */}
        {orders.length > 0 && (
          <View style={styles.finCard}>
            <Text style={styles.finTitle}>{t('mobile.finSummaryTitle')}</Text>
            <View style={styles.finRow}>
              <Text style={styles.finLabel}>{t('mobile.totalSpentLabel')}</Text>
              <Text style={styles.finValueGreen}>{formatCurrency(stats.totalSpent, countrySettings)}</Text>
            </View>
            <View style={styles.finRow}>
              <Text style={styles.finLabel}>{t('mobile.outstandingBalanceLabel')}</Text>
              <Text style={stats.unpaid > 0 ? styles.finValueRed : styles.finValueGreen}>
                {formatCurrency(stats.unpaid, countrySettings)}
              </Text>
            </View>
          </View>
        )}

        {/* ─── Notes ──────────────────────────────────────────────── */}
        <View style={styles.notesSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t('mobile.customerNotesTitle')}</Text>
            {notesText !== (customer.notes || '') && (
              <TouchableOpacity onPress={handleSaveNotes} disabled={savingNotes}>
                <Text style={styles.saveBtn}>{savingNotes ? t('mobile.saving') : t('common.save')}</Text>
              </TouchableOpacity>
            )}
          </View>
          <TextInput
            style={styles.notesInput}
            multiline
            placeholder={t('mobile.notesPlaceholderCustomer')}
            placeholderTextColor="#737685"
            value={notesText}
            onChangeText={setNotesText}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      {/* ═══ Edit Customer Modal ═══ */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalDismiss} onPress={() => setEditModal(false)} />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('mobile.editCustomerModalTitle')}</Text>

            <Text style={styles.fieldLabel}>{t('mobile.fieldName')} <Text style={{ color: '#c62828' }}>*</Text></Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder={t('mobile.phCustomerName')}
              placeholderTextColor="#c3c6d6"
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>{t('mobile.fieldPhone')} <Text style={{ color: '#c62828' }}>*</Text></Text>
            <View style={styles.editPhoneRow}>
              <View style={styles.editPhonePrefix}><Text style={styles.editPhonePrefixText}>{countrySettings.phoneCountryCode || '+91'}</Text></View>
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                value={editPhone}
                onChangeText={(t) => setEditPhone(t.replace(/\D/g, '').slice(0, phoneDigitsLimit))}
                placeholder={t('mobile.phPhone10Digit')}
                placeholderTextColor="#c3c6d6"
                keyboardType="phone-pad"
                maxLength={phoneDigitsLimit}
              />
            </View>

            <Text style={styles.fieldLabel}>{t('mobile.fieldEmail')}</Text>
            <TextInput
              style={styles.modalInput}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder={t('mobile.phOptional')}
              placeholderTextColor="#c3c6d6"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>{t('mobile.fieldAddress')}</Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 60 }]}
              value={editAddress}
              onChangeText={setEditAddress}
              placeholder={t('mobile.phOptional')}
              placeholderTextColor="#c3c6d6"
              multiline
              textAlignVertical="top"
            />

            <View style={styles.editActions}>
              <TouchableOpacity style={styles.editCancelBtn} onPress={() => setEditModal(false)}>
                <Text style={styles.editCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editSaveBtn, (!editName.trim() || !editPhone.trim()) && { opacity: 0.5 }]}
                onPress={handleUpdateCustomer}
                disabled={editSaving || !editName.trim() || !editPhone.trim()}
              >
                {editSaving ? <ActivityIndicator size="small" color="#fff" /> : (
                  <Text style={styles.editSaveBtnText}>{t('mobile.updateCustomerBtn')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fb' },
  header: { backgroundColor: '#f8f9fb', zIndex: 10 },
  headerInner: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 8, gap: 8 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#00408f' },
  iconBtn: { padding: 8 },
  scrollContent: { padding: 16, gap: 16 },

  // Profile card
  profileCard: {
    backgroundColor: '#ffffff', borderRadius: 14, padding: 16,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  profileTop: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  avatarLg: {
    width: 64, height: 64, borderRadius: 14, backgroundColor: '#00408f',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLgText: { fontSize: 24, fontWeight: '800', color: '#fff' },
  nameStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  profileName: { fontSize: 18, fontWeight: '700', color: '#191c1e', flexShrink: 1 },
  inactiveBadge: { backgroundColor: '#fff3e0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  inactiveBadgeText: { fontSize: 9, fontWeight: '700', color: '#e65100' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  memberText: { fontSize: 11, color: '#737685' },
  contactBtns: { flexDirection: 'row', gap: 8, marginTop: 10 },
  contactCircle: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#d8e2ff',
    alignItems: 'center', justifyContent: 'center',
  },
  contactSection: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#edeef0', gap: 8 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactVal: { fontSize: 13, color: '#191c1e', fontWeight: '500' },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    width: '48%', flexGrow: 1, backgroundColor: '#ffffff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  statLabel: { fontSize: 9, fontWeight: '700', color: '#737685', letterSpacing: 0.5, marginBottom: 2 },
  statValue: { fontSize: 20, fontWeight: '800', color: '#191c1e' },

  // Section
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#191c1e' },
  orderCount: { fontSize: 11, fontWeight: '600', color: '#737685' },

  // Orders
  orderList: { gap: 8 },
  orderCard: {
    backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  orderTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  orderId: { fontSize: 12, fontWeight: '700', color: '#00408f' },
  orderDate: { fontSize: 11, color: '#737685', marginBottom: 3 },
  orderMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderMetaText: { fontSize: 11, color: '#434654', fontWeight: '500' },
  orderAmount: { fontSize: 11, fontWeight: '700', color: '#191c1e' },
  unpaidLabel: { fontSize: 10, fontWeight: '700', color: '#93000a' },
  paidLabel: { fontSize: 10, fontWeight: '700', color: '#006b5f' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#c3c6d6' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  categoryTags: { flexDirection: 'row', gap: 6, marginTop: 6 },
  categoryTag: { backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  categoryTagText: { fontSize: 8, fontWeight: '600', color: '#434654', letterSpacing: 0.5 },

  // Financial
  finCard: {
    backgroundColor: '#f3f4f6', borderRadius: 12, padding: 16, gap: 12,
  },
  finTitle: { fontSize: 10, fontWeight: '700', color: '#434654', letterSpacing: 1 },
  finRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  finLabel: { fontSize: 13, color: '#434654' },
  finValueGreen: { fontSize: 13, fontWeight: '700', color: '#006b5f' },
  finValueRed: { fontSize: 13, fontWeight: '700', color: '#93000a' },

  // Notes
  notesSection: { gap: 8 },
  saveBtn: { fontSize: 13, fontWeight: '700', color: '#00408f' },
  notesInput: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 14, minHeight: 80,
    fontSize: 13, color: '#191c1e', borderWidth: 1, borderColor: '#edeef0',
  },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyText: { fontSize: 13, color: '#737685' },

  // Primary button
  primaryBtn: {
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: '#00408f',
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },

  // Edit modal
  modalDismiss: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd', alignSelf: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#191c1e', marginBottom: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#434654', letterSpacing: 0.3, marginTop: 12, marginBottom: 4 },
  modalInput: {
    backgroundColor: '#f8f9fb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: '#191c1e', borderWidth: 1, borderColor: '#edeef0',
  },
  editPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editPhonePrefix: {
    backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#edeef0',
  },
  editPhonePrefixText: { fontSize: 14, fontWeight: '600', color: '#434654' },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  editCancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', height: 48,
    borderRadius: 12, borderWidth: 1, borderColor: '#edeef0',
  },
  editCancelText: { fontSize: 14, fontWeight: '600', color: '#434654' },
  editSaveBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', height: 48,
    borderRadius: 12, backgroundColor: '#00408f',
  },
  editSaveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
