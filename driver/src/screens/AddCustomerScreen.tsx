import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import { normalizePhoneForCountry, toE164 } from '../lib/currency-format';
import { useShopCountrySettings } from '../lib/use-shop-country-settings';
import { colors, fonts, radii, shadows, spacing } from '../theme';

function normalizePhone(phone: string, countryCode: string): string {
  return normalizePhoneForCountry(phone, { countryCode });
}

function isValidPhoneByCountry(phone: string, countryCode: string, digits: number): boolean {
  const local = normalizePhone(phone, countryCode);
  return local.length === Math.max(6, digits || 10);
}

export default function AddCustomerScreen({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated?: (customerId: string) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const shopId = getShopId();
  const countrySettings = useShopCountrySettings(shopId);
  const phoneDigits = Math.max(6, countrySettings.phoneDigits || 10);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // ─── Save Customer ──────────────────────────────────────────────────

  const handleSave = async () => {
    // Validate
    const trimmedName = name.trim();
    const trimmedPhone = normalizePhone(phone, countrySettings.countryCode);

    if (!trimmedName) { Alert.alert(t('mobile.nameRequiredTitle'), t('mobile.nameRequiredMsg')); return; }
    if (!isValidPhoneByCountry(trimmedPhone, countrySettings.countryCode, phoneDigits)) { Alert.alert(t('mobile.invalidPhoneTitle'), t('mobile.invalidPhoneMsg')); return; }

    if (!shopId || saving) return;
    setSaving(true);

    try {
      const custCollection = firestore().collection(`shops/${shopId}/customers`);

      // Check customer limit from plan
      const subSnap = await firestore().collection('subscriptions').doc(shopId).get();
      const planId = subSnap.data()?.planId || 'free';
      const planSnap = await firestore().collection('plans').doc(planId).get();
      const maxCustomers = planSnap.data()?.limits?.maxCustomers ?? 0;

      if (maxCustomers !== -1 && maxCustomers > 0) {
        const currentCount = (await custCollection.get()).size;
        if (currentCount >= maxCustomers) {
          Alert.alert(
            t('mobile.customerLimitTitle', 'Customer Limit Reached'),
            t('mobile.customerLimitMsg', `Your plan allows up to ${maxCustomers} customers. Upgrade to add more.`),
          );
          setSaving(false);
          return;
        }
      }

      // Check for duplicate phone (both local and E.164 for selected country)
      let dupSnap = await custCollection.where('phone', '==', trimmedPhone).limit(1).get();
      if (dupSnap.empty) {
        dupSnap = await custCollection.where('phone', '==', toE164(trimmedPhone, countrySettings)).limit(1).get();
      }

      if (!dupSnap.empty) {
        const dupData = dupSnap.docs[0].data();
        const dupId = dupSnap.docs[0].id;
        Alert.alert(
          'Customer Already Exists',
          `"${dupData.name || 'Unknown'}" is already registered with this phone number (${trimmedPhone}).`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Use Existing',
              onPress: () => {
                onCreated?.(dupId);
                onBack();
              },
            },
          ],
        );
        setSaving(false);
        return;
      }

      const customerData = {
        name: trimmedName,
        phone: toE164(trimmedPhone, countrySettings),
        email: email.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        totalOrders: 0,
        totalSpent: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const docRef = await firestore()
        .collection(`shops/${shopId}/customers`)
        .add(customerData);

      onCreated?.(docRef.id);
      onBack();
    } catch (e: any) {
      Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedCreateCustomer'));
    }
    setSaving(false);
  };

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
            <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('mobile.addCustomerTitle')}</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 30 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Form Fields */}
          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>{t('mobile.fieldName')} <Text style={{ color: colors.error }}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('mobile.phCustomerName')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>{t('mobile.fieldPhone')} <Text style={{ color: colors.error }}>*</Text></Text>
            <View style={styles.phoneRow}>
              <View style={styles.phonePrefix}><Text style={styles.phonePrefixText}>{countrySettings.phoneCountryCode || '+91'}</Text></View>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, phoneDigits))}
                placeholder={t('mobile.phPhone10Digit')}
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                maxLength={phoneDigits}
              />
            </View>

            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Optional"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>{t('mobile.fieldAddress')}</Text>
            <TextInput
              style={[styles.input, { minHeight: 60 }]}
              value={address}
              onChangeText={setAddress}
              placeholder={t('mobile.phOptional')}
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>{t('mobile.fieldNotes')}</Text>
            <TextInput
              style={[styles.input, { minHeight: 60 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('mobile.phCustomerNotes')}
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, (!name.trim() || !phone.trim()) && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving || !name.trim() || !phone.trim()}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <>
                <MaterialIcons name="person-add" size={20} color={colors.surface} />
                <Text style={styles.saveBtnText}>Add Customer</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.background, zIndex: 10 },
  headerInner: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 8, gap: 8 },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: fonts.bold, color: colors.primary },
  iconBtn: { padding: 8 },
  scrollContent: { padding: 16, gap: 16 },

  // Form
  formCard: {
    backgroundColor: colors.surface, borderRadius: radii.card, padding: 16, gap: 4,
    ...shadows.card, ...shadows.cardBorder,
  },
  fieldLabel: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary, marginTop: 10, marginBottom: 4 },
  input: {
    backgroundColor: colors.background, borderRadius: radii.input, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, fontFamily: fonts.medium, color: colors.text, borderWidth: 1, borderColor: colors.border,
  },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phonePrefix: {
    backgroundColor: colors.surfaceMuted, borderRadius: radii.input, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  phonePrefixText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textSecondary },

  // Save
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radii.button,
  },
  saveBtnText: { fontSize: 15, fontFamily: fonts.bold, color: colors.surface },
});
