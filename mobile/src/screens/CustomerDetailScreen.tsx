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
import { colors, fonts, radii, shadows } from '../theme';

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
  pending: { bg: colors.warningBg, text: colors.warning },
  confirmed: { bg: colors.primaryTint, text: colors.primary },
  processing: { bg: colors.inProgressBg, text: colors.inProgress },
  ready: { bg: '#F1FBE7', text: '#84CC16' },
  out_for_delivery: { bg: colors.primaryTint, text: colors.primary },
  delivered: { bg: colors.successBg, text: colors.success },
  picked_up: { bg: colors.successBg, text: colors.success },
  cancelled: { bg: colors.errorBg, text: colors.error },
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
    return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  if (!customer) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }]}>
        <Text style={{ fontSize: 16, fontFamily: fonts.bold, color: colors.text, marginBottom: 12 }}>{t('mobile.customerNotFoundTitle')}</Text>
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
            <MaterialIcons name="chevron-left" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{t('mobile.customerProfileTitle', { defaultValue: 'Customer Profile' })}</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={openEditModal}>
            <MaterialIcons name="edit" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 30 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Profile Card ─────────────────────────────────────── */}
        <View style={styles.profileCard}>
          {/* Avatar */}
          <View style={[styles.avatarLg, !isActive && { backgroundColor: colors.textMuted }]}>
            <Text style={styles.avatarLgText}>{getInitials(customer.name || '')}</Text>
          </View>

          {/* Name + Member since */}
          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <Text style={styles.profileName} numberOfLines={1}>{customer.name}</Text>
            {!isActive && (
              <View style={[styles.inactiveBadge, { marginTop: 4 }]}>
                <Text style={styles.inactiveBadgeText}>{t('mobile.inactiveLabel')}</Text>
              </View>
            )}
            {phone ? <Text style={styles.memberText}>{phone}</Text> : null}
            {createdAt && (
              <View style={styles.memberRow}>
                <MaterialIcons name="calendar-today" size={12} color={colors.textMuted} />
                <Text style={styles.memberText}>{memberSinceText(createdAt, i18n.language, t)}</Text>
              </View>
            )}
          </View>

          {/* Action buttons row — Call, WhatsApp, New Order */}
          <View style={styles.actionBtnsRow}>
            {phone ? (
              <>
                <TouchableOpacity style={styles.actionBtnSecondary} onPress={handleCall}>
                  <MaterialIcons name="call" size={16} color={colors.textSecondary} />
                  <Text style={styles.actionBtnSecondaryText}>{t('mobile.callBtn', { defaultValue: 'Call' })}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtnSecondary} onPress={handleWhatsApp}>
                  <MaterialIcons name="chat" size={16} color="#25D366" />
                  <Text style={styles.actionBtnSecondaryText}>{t('mobile.whatsappBtn', { defaultValue: 'WhatsApp' })}</Text>
                </TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity style={styles.actionBtnPrimary}>
              <MaterialIcons name="note-add" size={16} color={colors.surface} />
              <Text style={styles.actionBtnPrimaryText}>{t('dashboard.newOrder')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Stats Grid ───────────────────────────────────────── */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t('mobile.statTotalOrders')}</Text>
            <Text style={[styles.statValue, { color: colors.primary }]}>{stats.totalOrders}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t('mobile.statTotalSpent')}</Text>
            <Text style={styles.statValue}>{formatCurrency(stats.totalSpent, countrySettings)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>AVG ORDER</Text>
            <Text style={styles.statValue}>{formatCurrency(stats.avgValue, countrySettings)}</Text>
          </View>
          <View style={[styles.statCard, stats.unpaid > 0 && { backgroundColor: colors.errorBg }]}>
            <Text style={[styles.statLabel, stats.unpaid > 0 && { color: colors.error }]}>{t('mobile.statUnpaidLabel')}</Text>
            <Text style={[styles.statValue, { color: stats.unpaid > 0 ? colors.error : colors.success }]}>
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
            <MaterialIcons name="receipt-long" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t('mobile.noOrdersYet')}</Text>
          </View>
        ) : (
          <View style={styles.orderListCard}>
            {orders.map((order, index) => {
              const cfg = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
              const label = order.status ? cdOrderStatus(order.status, t) : t('mobile.unknownStatus');
              const created = toDate(order.createdAt);
              const itemCount = (order.items || []).reduce((s: number, i: any) => s + (i.quantity || 1), 0);
              const total = Math.round(order.financials?.total || 0);
              const balance = Math.round(order.financials?.balance || 0);
              const isPaid = balance <= 0;
              const publicId = order.publicId || order.orderNumber || order.id?.slice(-4) || '';

              return (
                <TouchableOpacity
                  key={order.id}
                  style={[styles.historyRow, index < orders.length - 1 && styles.historyRowBorder]}
                  activeOpacity={0.7}
                  onPress={() => onViewOrder?.(order.id)}
                >
                  {/* Left accent bar */}
                  <View style={[styles.accentBar, { backgroundColor: cfg.text }]} />

                  <View style={{ flex: 1, paddingLeft: 12 }}>
                    {/* Row 1: Order ID + Status badge */}
                    <View style={styles.orderTopRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.orderId}>{publicId}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                          <Text style={[styles.statusText, { color: cfg.text }]}>{label.toUpperCase()}</Text>
                        </View>
                      </View>
                      <Text style={styles.orderAmount}>{formatCurrency(total, countrySettings)}</Text>
                    </View>
                    {/* Row 2: Item count + date */}
                    <Text style={styles.orderDate}>
                      {itemCount} {t('mobile.items', { defaultValue: 'items' })} · {formatDateLocalized(created, i18n.language)}
                    </Text>
                  </View>

                  {/* Right: Amount + paid/unpaid + chevron */}
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[styles.payBadge, isPaid ? styles.payBadgePaid : styles.payBadgeUnpaid]}>
                      <Text style={[styles.payBadgeText, { color: isPaid ? colors.success : colors.error }]}>
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
            placeholderTextColor={colors.textMuted}
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
              placeholderTextColor={colors.textMuted}
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
                placeholderTextColor={colors.textMuted}
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
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>{t('mobile.fieldAddress')}</Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 60 }]}
              value={editAddress}
              onChangeText={setEditAddress}
              placeholder={t('mobile.phOptional')}
              placeholderTextColor={colors.textMuted}
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
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface, zIndex: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerInner: { flexDirection: 'row', alignItems: 'center', height: 48, paddingHorizontal: 8, gap: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  scrollContent: { padding: 16, gap: 16 },

  // Profile card
  profileCard: {
    backgroundColor: colors.surface, borderRadius: radii.card, padding: 16,
    ...shadows.card, ...shadows.cardBorder,
    alignItems: 'center', gap: 4,
  },
  avatarLg: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLgText: { fontSize: 22, fontFamily: fonts.bold, color: colors.primary },
  profileName: { fontSize: 20, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  inactiveBadge: { backgroundColor: colors.warningBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  inactiveBadgeText: { fontSize: 9, fontFamily: fonts.bold, color: colors.warning },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  memberText: { fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 2 },
  actionBtnsRow: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 12 },
  actionBtnSecondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: radii.button,
    backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border,
  },
  actionBtnSecondaryText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  actionBtnPrimary: {
    flex: 1.2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: radii.button,
    backgroundColor: colors.primary,
  },
  actionBtnPrimaryText: { fontSize: 13, fontFamily: fonts.bold, color: colors.surface },

  // Stats — 2x2 grid matching HTML metrics-grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    width: '47%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  statLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  statValue: { fontSize: 20, fontFamily: fonts.bold, color: colors.text },

  // Section
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase' },
  orderCount: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted },

  // Orders — card-flush with accent bars (matching HTML)
  orderListCard: {
    backgroundColor: colors.surface, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.border, ...shadows.card,
    overflow: 'hidden',
  },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingRight: 16, paddingLeft: 0,
    position: 'relative',
  },
  historyRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  accentBar: {
    position: 'absolute', left: 0, top: 12, bottom: 12, width: 4,
    borderTopRightRadius: 4, borderBottomRightRadius: 4,
  },
  orderTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  orderId: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  orderDate: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 2 },
  orderAmount: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontFamily: fonts.bold },
  payBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  payBadgePaid: { backgroundColor: colors.successBg },
  payBadgeUnpaid: { backgroundColor: colors.errorBg },
  payBadgeText: { fontSize: 10, fontFamily: fonts.bold },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textMuted },

  // Financial
  finCard: {
    backgroundColor: colors.surfaceMuted, borderRadius: radii.card, padding: 16, gap: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  finTitle: { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase' },
  finRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  finLabel: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textSecondary },
  finValueGreen: { fontSize: 13, fontFamily: fonts.bold, color: colors.success },
  finValueRed: { fontSize: 13, fontFamily: fonts.bold, color: colors.error },

  // Notes
  notesSection: { gap: 8 },
  saveBtn: { fontSize: 13, fontFamily: fonts.bold, color: colors.primary },
  notesInput: {
    backgroundColor: colors.surface, borderRadius: radii.card, padding: 14, minHeight: 80,
    fontSize: 13, fontFamily: fonts.medium, color: colors.text, borderWidth: 1, borderColor: colors.border,
  },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyText: { fontSize: 13, fontFamily: fonts.medium, color: colors.textMuted },

  // Primary button
  primaryBtn: {
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: radii.button, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 14, fontFamily: fonts.bold, color: colors.surface },

  // Edit modal
  modalDismiss: { flex: 1, backgroundColor: 'rgba(26,29,46,0.4)' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text, marginBottom: 8 },
  fieldLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 0.3, textTransform: 'uppercase', marginTop: 12, marginBottom: 4 },
  modalInput: {
    backgroundColor: colors.surfaceMuted, borderRadius: radii.input, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, fontFamily: fonts.medium, color: colors.text, borderWidth: 1, borderColor: colors.border,
  },
  editPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editPhonePrefix: {
    backgroundColor: colors.surfaceMuted, borderRadius: radii.input, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  editPhonePrefixText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textSecondary },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  editCancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', height: 48,
    borderRadius: radii.button, borderWidth: 1, borderColor: colors.border,
  },
  editCancelText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textSecondary },
  editSaveBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', height: 48,
    borderRadius: radii.button, backgroundColor: colors.primary,
  },
  editSaveBtnText: { fontSize: 14, fontFamily: fonts.bold, color: colors.surface },
});
