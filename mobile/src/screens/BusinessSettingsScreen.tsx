/**
 * Business settings (owner app) — parity with the web Settings → Operations + Offers.
 * Reads/writes the SAME `shops/{id}.settings.*` fields as the web, so changes made
 * here appear on the web dashboard and vice-versa. Five sections:
 *   1. Delivery fee (flat)      → settings.delivery.deliveryFee*
 *   2. Charge by distance       → settings.delivery.distanceFeeEnabled / distanceBands
 *   3. Receipt terms            → settings.receiptTerms
 *   4. WhatsApp message & track → settings.waShare / settings.trackingEnabled
 *   5. Coupons (offers feature) → settings.publicCoupons
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Switch,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, fonts, radii } from '../theme';
import { getShopId } from '../lib/auth';
import { firestore } from '../lib/db';
import { usePlanFeatures } from '../lib/usePlanLimits';

type Coupon = { code: string; type: 'percent' | 'flat'; value: number; minOrder?: number; active?: boolean };
type Band = { id: string; label: string; fee: number };

export default function BusinessSettingsScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const shopId = getShopId();

  const [loading, setLoading] = useState(true);
  const [subData, setSubData] = useState<any>(null);
  const features = usePlanFeatures(subData);
  const canOffers = !!features.offers;

  // Delivery fee (flat)
  const [feeEnabled, setFeeEnabled] = useState(true);
  const [feeMinOrder, setFeeMinOrder] = useState('300');
  const [feeAmount, setFeeAmount] = useState('50');
  // Distance
  const [distEnabled, setDistEnabled] = useState(false);
  const [bands, setBands] = useState<Band[]>([]);
  // Receipt terms
  const [receiptTerms, setReceiptTerms] = useState('');
  // WhatsApp + tracking
  const [waHeader, setWaHeader] = useState('');
  const [waFooter, setWaFooter] = useState('');
  const [waItems, setWaItems] = useState(true);
  const [waPayment, setWaPayment] = useState(true);
  const [waDate, setWaDate] = useState(true);
  const [waReceipt, setWaReceipt] = useState(true);
  const [tracking, setTracking] = useState(true);
  // Coupons
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [cCode, setCCode] = useState('');
  const [cType, setCType] = useState<'percent' | 'flat'>('percent');
  const [cValue, setCValue] = useState('');
  const [cMin, setCMin] = useState('');

  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) { setLoading(false); return; }
    firestore().collection('subscriptions').doc(shopId).get()
      .then((s: any) => { if (s.exists) setSubData(s.data()); }).catch(() => {});
    const unsub = firestore().collection('shops').doc(shopId).onSnapshot((snap: any) => {
      const s = snap.data()?.settings || {};
      const d = s.delivery || {};
      setFeeEnabled(d.deliveryFeeEnabled ?? true);
      setFeeMinOrder(String(d.deliveryFeeMinOrder ?? 300));
      setFeeAmount(String(d.deliveryFeeAmount ?? d.defaultCharge ?? 50));
      setDistEnabled(!!d.distanceFeeEnabled);
      setBands(Array.isArray(d.distanceBands) ? d.distanceBands : []);
      setReceiptTerms(s.receiptTerms || '');
      const ws = s.waShare || {};
      setWaHeader(ws.headerText || ''); setWaFooter(ws.footerText || '');
      setWaItems(ws.showItems !== false); setWaPayment(ws.showPayment !== false);
      setWaDate(ws.showExpectedDate !== false); setWaReceipt(ws.showReceiptLink !== false);
      setTracking(s.trackingEnabled !== false);
      setCoupons(Array.isArray(s.publicCoupons) ? s.publicCoupons : []);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [shopId]);

  const patch = async (key: string, fields: Record<string, any>, section: string) => {
    if (!shopId) return;
    setSaving(section);
    try {
      const upd: Record<string, any> = {};
      Object.entries(fields).forEach(([k, v]) => { upd[`settings.${key}${k ? '.' + k : ''}`] = v; });
      await firestore().collection('shops').doc(shopId).update(upd);
    } catch (e: any) {
      Alert.alert(t('mobile.errorTitle', 'Error'), e.message || 'Save failed');
    } finally {
      setSaving(null);
    }
  };

  // ── Save handlers ──
  const saveDeliveryFee = () => patch('delivery', {
    deliveryFeeEnabled: feeEnabled,
    deliveryFeeMinOrder: Math.max(0, Math.round(Number(feeMinOrder) || 0)),
    deliveryFeeAmount: Math.max(0, Math.round(Number(feeAmount) || 0)),
    defaultCharge: Math.max(0, Math.round(Number(feeAmount) || 0)),
  }, 'fee');

  const saveDistance = () => patch('delivery', {
    distanceFeeEnabled: distEnabled,
    distanceBands: bands.filter((b) => b.label.trim()).map((b) => ({ id: b.id, label: b.label.trim(), fee: Number(b.fee) || 0 })),
  }, 'dist');

  const saveReceipt = () => patch('', { receiptTerms: receiptTerms.trim() }, 'receipt');

  const saveWa = () => patch('', {
    waShare: { headerText: waHeader.trim(), footerText: waFooter.trim(), showItems: waItems, showPayment: waPayment, showExpectedDate: waDate, showReceiptLink: waReceipt },
    trackingEnabled: tracking,
  }, 'wa');

  const addCoupon = () => {
    const code = cCode.trim().toUpperCase();
    const val = Math.round(Number(cValue) || 0);
    if (!code) { Alert.alert(t('mobile.errorTitle', 'Error'), t('mobile.couponCodeRequired', 'Enter a coupon code')); return; }
    if (val <= 0) { Alert.alert(t('mobile.errorTitle', 'Error'), t('mobile.couponValueRequired', 'Enter a value above 0')); return; }
    if (cType === 'percent' && val > 100) { Alert.alert(t('mobile.errorTitle', 'Error'), t('mobile.couponPercentMax', 'Percentage cannot exceed 100')); return; }
    if (coupons.some((c) => c.code.toUpperCase() === code)) { Alert.alert(t('mobile.errorTitle', 'Error'), t('mobile.couponDuplicate', 'That code already exists')); return; }
    const next = [...coupons, { code, type: cType, value: val, minOrder: Math.max(0, Math.round(Number(cMin) || 0)), active: true }];
    setCCode(''); setCValue(''); setCMin('');
    patch('', { publicCoupons: next }, 'coupon');
  };
  const removeCoupon = (code: string) => patch('', { publicCoupons: coupons.filter((c) => c.code !== code) }, 'coupon');
  const toggleCoupon = (code: string, active: boolean) => patch('', { publicCoupons: coupons.map((c) => c.code === code ? { ...c, active } : c) }, 'coupon');

  const addBand = () => setBands([...bands, { id: `b-${Date.now()}`, label: '', fee: 0 }]);

  if (loading) {
    return (
      <View style={[styles.flex, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={10} style={styles.back}>
          <MaterialIcons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('mobile.businessSettingsTitle', 'Business settings')}</Text>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 16 }} keyboardShouldPersistTaps="handled">

          {/* ── Delivery fee ── */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={styles.cardHead}><MaterialIcons name="local-shipping" size={18} color={colors.primary} /><Text style={styles.cardTitle}>{t('mobile.deliveryFeeTitle', 'Delivery fee')}</Text></View>
              <Switch value={feeEnabled} onValueChange={setFeeEnabled} trackColor={{ true: colors.primary }} />
            </View>
            <Text style={styles.help}>{t('mobile.deliveryFeeHelp', 'Flat fee added to home delivery / pickup orders. Waived above the minimum order.')}</Text>
            {feeEnabled ? (
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{t('mobile.deliveryFeeAmount', 'Fee amount')}</Text>
                  <TextInput style={styles.input} value={feeAmount} onChangeText={setFeeAmount} keyboardType="number-pad" placeholder="50" placeholderTextColor={colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{t('mobile.deliveryFeeMinOrder', 'Free above')}</Text>
                  <TextInput style={styles.input} value={feeMinOrder} onChangeText={setFeeMinOrder} keyboardType="number-pad" placeholder="300" placeholderTextColor={colors.textMuted} />
                </View>
              </View>
            ) : null}
            <SaveBtn onPress={saveDeliveryFee} busy={saving === 'fee'} t={t} />
          </View>

          {/* ── Charge by distance ── */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={styles.cardHead}><MaterialIcons name="route" size={18} color={colors.primary} /><Text style={styles.cardTitle}>{t('mobile.distanceTitle', 'Charge by distance')}</Text></View>
              <Switch value={distEnabled} onValueChange={setDistEnabled} trackColor={{ true: colors.primary }} />
            </View>
            <Text style={styles.help}>{t('mobile.distanceHelp', 'Charge different delivery fees by distance band. Staff pick the band at checkout.')}</Text>
            {distEnabled ? (
              <View style={{ marginTop: 10, gap: 8 }}>
                {bands.map((b, i) => (
                  <View key={b.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TextInput style={[styles.input, { flex: 1 }]} value={b.label} placeholder="0–5 km" placeholderTextColor={colors.textMuted}
                      onChangeText={(v) => setBands(bands.map((x, j) => j === i ? { ...x, label: v } : x))} />
                    <TextInput style={[styles.input, { width: 90 }]} value={String(b.fee)} keyboardType="number-pad" placeholder="50" placeholderTextColor={colors.textMuted}
                      onChangeText={(v) => setBands(bands.map((x, j) => j === i ? { ...x, fee: Number(v) || 0 } : x))} />
                    <TouchableOpacity onPress={() => setBands(bands.filter((_, j) => j !== i))} hitSlop={8}><MaterialIcons name="delete-outline" size={22} color={colors.error} /></TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addRow} onPress={addBand}><MaterialIcons name="add" size={18} color={colors.primary} /><Text style={styles.addRowText}>{t('mobile.addBand', 'Add band')}</Text></TouchableOpacity>
              </View>
            ) : null}
            <SaveBtn onPress={saveDistance} busy={saving === 'dist'} t={t} />
          </View>

          {/* ── Receipt terms ── */}
          <View style={styles.card}>
            <View style={styles.cardHead}><MaterialIcons name="description" size={18} color={colors.primary} /><Text style={styles.cardTitle}>{t('mobile.receiptTermsTitle', 'Receipt terms & conditions')}</Text></View>
            <Text style={styles.help}>{t('mobile.receiptTermsHelp', 'Printed at the bottom of every receipt (PDF, print and app). Leave blank to hide.')}</Text>
            <TextInput style={[styles.input, { minHeight: 90, textAlignVertical: 'top', marginTop: 10 }]} value={receiptTerms} onChangeText={(v) => setReceiptTerms(v.slice(0, 1000))} multiline
              placeholder={t('mobile.receiptTermsPlaceholder', 'e.g. Goods not collected within 30 days are not our responsibility.')} placeholderTextColor={colors.textMuted} />
            <Text style={styles.counter}>{receiptTerms.length}/1000</Text>
            <SaveBtn onPress={saveReceipt} busy={saving === 'receipt'} t={t} />
          </View>

          {/* ── WhatsApp message & tracking ── */}
          <View style={styles.card}>
            <View style={styles.cardHead}><MaterialIcons name="chat" size={18} color={colors.success} /><Text style={styles.cardTitle}>{t('mobile.waShareTitle', 'WhatsApp message & tracking')}</Text></View>
            <Text style={styles.help}>{t('mobile.waShareHelp', 'Customize the WhatsApp message sent to customers. Applies on web and in the apps.')}</Text>
            <Text style={[styles.label, { marginTop: 10 }]}>{t('mobile.waHeader', 'Greeting (first line)')}</Text>
            <TextInput style={styles.input} value={waHeader} onChangeText={(v) => setWaHeader(v.slice(0, 120))} placeholder={t('mobile.waHeaderPh', 'Your Shop - Order Confirmed!')} placeholderTextColor={colors.textMuted} />
            <Text style={[styles.label, { marginTop: 10 }]}>{t('mobile.waFooter', 'Closing line')}</Text>
            <TextInput style={styles.input} value={waFooter} onChangeText={(v) => setWaFooter(v.slice(0, 160))} placeholder={t('mobile.waFooterPh', 'Any questions? Reply to this message!')} placeholderTextColor={colors.textMuted} />
            <ToggleRow label={t('mobile.waShowItems', 'Items list')} value={waItems} onChange={setWaItems} />
            <ToggleRow label={t('mobile.waShowPayment', 'Payment details')} value={waPayment} onChange={setWaPayment} />
            <ToggleRow label={t('mobile.waShowDate', 'Expected date')} value={waDate} onChange={setWaDate} />
            <ToggleRow label={t('mobile.waShowReceipt', 'Receipt link')} value={waReceipt} onChange={setWaReceipt} />
            <ToggleRow label={t('mobile.trackingEnabled', 'Customer order tracking')} desc={t('mobile.trackingEnabledDesc', 'Off = no tracking links or QR codes anywhere')} value={tracking} onChange={setTracking} />
            <SaveBtn onPress={saveWa} busy={saving === 'wa'} t={t} />
          </View>

          {/* ── Coupons (offers feature: Pro+/Business) ── */}
          {canOffers ? (
            <View style={styles.card}>
              <View style={styles.cardHead}><MaterialIcons name="confirmation-number" size={18} color={colors.primary} /><Text style={styles.cardTitle}>{t('mobile.couponsTitle', 'Coupons')}</Text></View>
              <Text style={styles.help}>{t('mobile.couponsHelp', 'Discount codes customers enter at checkout and on your public booking page.')}</Text>
              {coupons.map((c) => (
                <View key={c.code} style={styles.couponRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.couponCode}>{c.code}</Text>
                    <Text style={styles.couponMeta}>{c.type === 'percent' ? `${c.value}%` : `₹${c.value}`}{c.minOrder ? ` · min ₹${c.minOrder}` : ''}</Text>
                  </View>
                  <Switch value={c.active !== false} onValueChange={(v) => toggleCoupon(c.code, v)} trackColor={{ true: colors.primary }} />
                  <TouchableOpacity onPress={() => removeCoupon(c.code)} hitSlop={8} style={{ marginLeft: 6 }}><MaterialIcons name="delete-outline" size={22} color={colors.error} /></TouchableOpacity>
                </View>
              ))}
              <View style={styles.divider} />
              <Text style={styles.label}>{t('mobile.addCoupon', 'Add a coupon')}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <TextInput style={[styles.input, { flex: 1 }]} value={cCode} onChangeText={(v) => setCCode(v.toUpperCase())} autoCapitalize="characters" placeholder={t('mobile.couponCodePh', 'CODE')} placeholderTextColor={colors.textMuted} />
                <TouchableOpacity style={styles.typeToggle} onPress={() => setCType(cType === 'percent' ? 'flat' : 'percent')}>
                  <Text style={styles.typeToggleText}>{cType === 'percent' ? '%' : '₹'}</Text>
                </TouchableOpacity>
                <TextInput style={[styles.input, { width: 80 }]} value={cValue} onChangeText={setCValue} keyboardType="number-pad" placeholder={cType === 'percent' ? '10' : '50'} placeholderTextColor={colors.textMuted} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' }}>
                <Text style={[styles.label, { marginBottom: 0 }]}>{t('mobile.couponMinOrder', 'Min order (optional)')}</Text>
                <TextInput style={[styles.input, { width: 90 }]} value={cMin} onChangeText={setCMin} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textMuted} />
              </View>
              <TouchableOpacity style={[styles.saveBtn, { marginTop: 12 }, saving === 'coupon' && { opacity: 0.6 }]} onPress={addCoupon} disabled={saving === 'coupon'}>
                <Text style={styles.saveBtnText}>{t('mobile.addCouponBtn', 'Add coupon')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={[styles.rowBetween, { marginTop: 12 }]}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {desc ? <Text style={styles.toggleDesc}>{desc}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
    </View>
  );
}

function SaveBtn({ onPress, busy, t }: { onPress: () => void; busy: boolean; t: any }) {
  return (
    <TouchableOpacity style={[styles.saveBtn, busy && { opacity: 0.6 }]} onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>{t('common.save', 'Save')}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, padding: 16, borderWidth: 1, borderColor: colors.border },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  help: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 8, lineHeight: 18 },
  label: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radii.input, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: fonts.medium, color: colors.text },
  counter: { textAlign: 'right', fontSize: 11, color: colors.textMuted, marginTop: 4 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  saveBtnText: { fontSize: 14, fontFamily: fonts.bold, color: '#fff' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  addRowText: { fontSize: 13, fontFamily: fonts.bold, color: colors.primary },
  toggleLabel: { fontSize: 13.5, fontFamily: fonts.semibold, color: colors.text },
  toggleDesc: { fontSize: 11.5, fontFamily: fonts.medium, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  couponRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  couponCode: { fontSize: 14, fontFamily: fonts.bold, color: colors.text, letterSpacing: 0.5 },
  couponMeta: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  typeToggle: { width: 44, borderRadius: radii.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  typeToggleText: { fontSize: 16, fontFamily: fonts.bold, color: colors.primary },
});
