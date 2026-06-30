import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal, Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Contacts from 'expo-contacts';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import { normalizePhoneForCountry, toE164 } from '../lib/currency-format';
import { useShopCountrySettings } from '../lib/use-shop-country-settings';
import { getCountry, COUNTRIES, getCountryCodeFromPhone } from '../lib/country-config';
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
  onCreated?: (customer: { id: string; name: string; phone: string; email: string | null; address: string | null }) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const shopId = getShopId();
  const countrySettings = useShopCountrySettings(shopId);
  // Phone country: defaults to the shop's country, but the owner can pick another
  // (e.g. a US/UK customer) so the number is stored with the right country code.
  const [pickedCountry, setPickedCountry] = useState<string | null>(null);
  const phoneCountryCode = pickedCountry || countrySettings.countryCode || 'IN';
  const selectedCountry = getCountry(phoneCountryCode);
  const phoneDigits = Math.max(6, selectedCountry.phoneDigits || 10);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const filteredCountries = COUNTRIES.filter((c) => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.phoneCode.toLowerCase().includes(q);
  });

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Contact picker
  const [contactModal, setContactModal] = useState(false);
  const [contactPermission, setContactPermission] = useState<boolean | null>(null);
  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);

  // ─── Contact Picker ─────────────────────────────────────────────────

  const handleOpenContacts = async () => {
    setContactModal(true);
    setContactSearch('');

    if (contactPermission === true) {
      loadContacts();
      return;
    }

    const { status } = await Contacts.requestPermissionsAsync();
    const granted = status === 'granted';
    setContactPermission(granted);
    if (granted) {
      loadContacts();
    }
  };

  const loadContacts = async () => {
    setLoadingContacts(true);
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
        sort: Contacts.SortTypes.FirstName,
      });
      setContacts(data || []);
    } catch {
      setContacts([]);
    }
    setLoadingContacts(false);
  };

  const handleSelectContact = (contact: Contacts.Contact) => {
    const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.name || '';
    const contactPhone = contact.phoneNumbers?.[0]?.number || '';
    const contactEmail = contact.emails?.[0]?.email || '';

    setName(contactName);
    // Detect the country from the imported number (e.g. a +1 US contact) so the
    // picker + stored code match it; fall back to the current selection.
    const detected = getCountryCodeFromPhone(contactPhone);
    const cc = detected || phoneCountryCode;
    if (detected) setPickedCountry(detected);
    setPhone(normalizePhone(contactPhone, cc));
    if (contactEmail) setEmail(contactEmail);
    setContactModal(false);
  };

  const filteredContacts = contactSearch.trim()
    ? contacts.filter((c) => {
        const q = contactSearch.toLowerCase();
        const cName = (c.name || '').toLowerCase();
        const cPhone = (c.phoneNumbers?.[0]?.number || '');
        return cName.includes(q) || cPhone.includes(q);
      })
    : contacts;

  // ─── Save Customer ──────────────────────────────────────────────────

  const handleSave = async () => {
    // Validate
    const trimmedName = name.trim();
    const trimmedPhone = normalizePhone(phone, phoneCountryCode);

    if (!trimmedName) { Alert.alert(t('mobile.nameRequiredTitle'), t('mobile.nameRequiredMsg')); return; }
    if (!isValidPhoneByCountry(trimmedPhone, phoneCountryCode, phoneDigits)) { Alert.alert(t('mobile.invalidPhoneTitle'), t('mobile.invalidPhoneMsg')); return; }

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
        const countSnap = await custCollection.count().get();
        const currentCount = countSnap.data().count;
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
        dupSnap = await custCollection.where('phone', '==', toE164(trimmedPhone, { countryCode: phoneCountryCode })).limit(1).get();
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
                onCreated?.({
                  id: dupId,
                  name: dupData.name || trimmedName,
                  phone: dupData.phone || toE164(trimmedPhone, { countryCode: phoneCountryCode }),
                  email: dupData.email ?? null,
                  address: dupData.address ?? null,
                });
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
        phone: toE164(trimmedPhone, { countryCode: phoneCountryCode }),
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

      onCreated?.({
        id: docRef.id,
        name: customerData.name,
        phone: customerData.phone,
        email: customerData.email,
        address: customerData.address,
      });
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
          {/* Import from Contacts */}
          <TouchableOpacity style={styles.contactBtn} onPress={handleOpenContacts} activeOpacity={0.7}>
            <View style={styles.contactBtnIcon}>
              <MaterialIcons name="contacts" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactBtnTitle}>{t('mobile.importFromContacts')}</Text>
              <Text style={styles.contactBtnSubtitle}>{t('mobile.importFromContactsSubtitle')}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('mobile.orEnterManually')}</Text>
            <View style={styles.dividerLine} />
          </View>

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
              <TouchableOpacity style={styles.phonePrefix} onPress={() => setShowCountryPicker(true)} activeOpacity={0.7}>
                <Text style={styles.phonePrefixText}>{selectedCountry.phoneCode}</Text>
                <MaterialIcons name="expand-more" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
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

      {/* ═══ Contact Picker Modal ═══ */}
      <Modal visible={contactModal} transparent animationType="slide" onRequestClose={() => setContactModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalDismiss} onPress={() => setContactModal(false)} />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16, maxHeight: '85%' }]}>
            <View style={styles.modalHandle} />

            {contactPermission === false ? (
              /* Permission denied — explain clearly */
              <View style={styles.permContainer}>
                <View style={styles.permIconBg}>
                  <MaterialIcons name="contacts" size={32} color={colors.primary} />
                </View>
                <Text style={styles.permTitle}>{t('mobile.permAccessContactsTitle')}</Text>
                <Text style={styles.permBody}>
                  {t('mobile.permAccessContactsBody')}
                </Text>
                <View style={styles.permPrivacy}>
                  <MaterialIcons name="shield" size={18} color={colors.success} />
                  <Text style={styles.permPrivacyText}>
                    {t('mobile.permPrivacyContacts')}
                  </Text>
                </View>
                <TouchableOpacity style={styles.permBtn} onPress={async () => {
                  const { status } = await Contacts.requestPermissionsAsync();
                  const granted = status === 'granted';
                  setContactPermission(granted);
                  if (granted) loadContacts();
                }}>
                  <Text style={styles.permBtnText}>{t('mobile.allowContactAccess')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ paddingVertical: 10 }} onPress={() => setContactModal(false)}>
                  <Text style={styles.permNotNow}>{t('mobile.enterManuallyInstead')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Contact list */
              <>
                <Text style={styles.modalTitle}>{t('mobile.selectContact')}</Text>
                <View style={styles.contactSearchRow}>
                  <MaterialIcons name="search" size={20} color={colors.textMuted} />
                  <TextInput
                    style={styles.contactSearchInput}
                    placeholder={t('mobile.searchContactsPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={contactSearch}
                    onChangeText={setContactSearch}
                    autoFocus
                  />
                  {contactSearch ? (
                    <TouchableOpacity onPress={() => setContactSearch('')}>
                      <MaterialIcons name="close" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {loadingContacts ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                ) : filteredContacts.length === 0 ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <MaterialIcons name="person-off" size={40} color={colors.textMuted} />
                    <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 8, fontFamily: fonts.medium }}>{t('mobile.noContactsFound')}</Text>
                  </View>
                ) : (
                  <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {filteredContacts.slice(0, 100).map((contact, idx) => {
                      const cName = contact.name || 'No Name';
                      const cPhone = contact.phoneNumbers?.[0]?.number || '';
                      const initials = cName.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
                      return (
                        <TouchableOpacity
                          key={(contact as any).id || idx}
                          style={styles.contactItem}
                          onPress={() => handleSelectContact(contact)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.contactAvatar}>
                            <Text style={styles.contactAvatarText}>{initials}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.contactName} numberOfLines={1}>{cName}</Text>
                            {cPhone ? <Text style={styles.contactPhone}>{cPhone}</Text> : null}
                          </View>
                          <MaterialIcons name="add-circle-outline" size={20} color={colors.primary} />
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Country code picker */}
      <Modal visible={showCountryPicker} transparent animationType="fade" onRequestClose={() => setShowCountryPicker(false)}>
        <Pressable style={styles.modalDismiss} onPress={() => setShowCountryPicker(false)} />
        <View style={[styles.countryPickerSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{t('mobile.selectCountry', 'Select country')}</Text>
          <TextInput
            style={styles.countrySearchInput}
            placeholder={t('mobile.searchCountry', 'Search country / dial code')}
            placeholderTextColor={colors.textMuted}
            value={countrySearch}
            onChangeText={setCountrySearch}
            autoCapitalize="none"
          />
          <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
            {filteredCountries.map((c) => (
              <TouchableOpacity
                key={c.code}
                style={[styles.countryOption, c.code === phoneCountryCode && styles.countryOptionActive]}
                onPress={() => {
                  setPickedCountry(c.code);
                  setPhone((prev) => normalizePhone(prev, c.code));
                  setCountrySearch('');
                  setShowCountryPicker(false);
                }}
              >
                <Text style={styles.countryOptionText}>{c.name}</Text>
                <Text style={styles.countryOptionCode}>{c.phoneCode}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
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

  // Contact import button
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: radii.card, padding: 14,
    ...shadows.card, ...shadows.cardBorder,
  },
  contactBtnIcon: {
    width: 44, height: 44, borderRadius: radii.button, backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center',
  },
  contactBtnTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  contactBtnSubtitle: { fontSize: 12, fontFamily: fonts.medium, color: colors.textMuted, marginTop: 1 },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 12, fontFamily: fonts.medium, color: colors.textMuted },

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
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: colors.surfaceMuted, borderRadius: radii.input, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  phonePrefixText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textSecondary },

  // Save
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radii.button,
  },
  saveBtnText: { fontSize: 15, fontFamily: fonts.bold, color: colors.surface },

  // Modal
  modalDismiss: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text, marginBottom: 12 },
  // Country code picker
  countryPickerSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  countrySearchInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.input, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: fonts.medium, color: colors.text, marginBottom: 10 },
  countryOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12, borderRadius: radii.input },
  countryOptionActive: { backgroundColor: colors.primaryTint },
  countryOptionText: { fontSize: 14, fontFamily: fonts.medium, color: colors.text, flex: 1 },
  countryOptionCode: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textSecondary, marginLeft: 12 },

  // Contact search
  contactSearchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.background, borderRadius: radii.input, paddingHorizontal: 12, height: 40,
    marginBottom: 12, borderWidth: 1, borderColor: colors.border,
  },
  contactSearchInput: { flex: 1, fontSize: 13, fontFamily: fonts.medium, color: colors.text },

  // Contact list items
  contactItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: colors.surfaceMuted,
  },
  contactAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center',
  },
  contactAvatarText: { fontSize: 13, fontFamily: fonts.bold, color: colors.primary },
  contactName: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text },
  contactPhone: { fontSize: 12, fontFamily: fonts.medium, color: colors.textMuted, marginTop: 1 },

  // Permission screen inside modal
  permContainer: { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8, gap: 12 },
  permIconBg: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  permTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  permBody: { fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  permPrivacy: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: colors.successBg, borderRadius: radii.input, padding: 12, marginTop: 4,
  },
  permPrivacyText: { flex: 1, fontSize: 12, fontFamily: fonts.medium, color: colors.success, lineHeight: 18 },
  permBtn: {
    width: '100%', paddingVertical: 14, borderRadius: radii.button, backgroundColor: colors.primary,
    alignItems: 'center', marginTop: 4,
  },
  permBtnText: { fontSize: 15, fontFamily: fonts.bold, color: colors.surface },
  permNotNow: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textMuted },
});
