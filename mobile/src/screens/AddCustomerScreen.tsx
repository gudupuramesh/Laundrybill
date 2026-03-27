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
    setPhone(normalizePhone(contactPhone, countrySettings.countryCode));
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
    const trimmedPhone = normalizePhone(phone, countrySettings.countryCode);

    if (!trimmedName) { Alert.alert(t('mobile.nameRequiredTitle'), t('mobile.nameRequiredMsg')); return; }
    if (!isValidPhoneByCountry(trimmedPhone, countrySettings.countryCode, phoneDigits)) { Alert.alert(t('mobile.invalidPhoneTitle'), t('mobile.invalidPhoneMsg')); return; }

    if (!shopId || saving) return;
    setSaving(true);

    try {
      // Check for duplicate phone (both local and E.164 for selected country)
      const custCollection = firestore().collection(`shops/${shopId}/customers`);
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
            <MaterialIcons name="arrow-back" size={24} color="#00408f" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('mobile.addCustomerTitle')}</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 30 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Import from Contacts */}
          <TouchableOpacity style={styles.contactBtn} onPress={handleOpenContacts} activeOpacity={0.7}>
            <View style={styles.contactBtnIcon}>
              <MaterialIcons name="contacts" size={22} color="#00408f" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactBtnTitle}>{t('mobile.importFromContacts')}</Text>
              <Text style={styles.contactBtnSubtitle}>{t('mobile.importFromContactsSubtitle')}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#c3c6d6" />
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('mobile.orEnterManually')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Form Fields */}
          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>{t('mobile.fieldName')} <Text style={{ color: '#c62828' }}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('mobile.phCustomerName')}
              placeholderTextColor="#c3c6d6"
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>{t('mobile.fieldPhone')} <Text style={{ color: '#c62828' }}>*</Text></Text>
            <View style={styles.phoneRow}>
              <View style={styles.phonePrefix}><Text style={styles.phonePrefixText}>{countrySettings.phoneCountryCode || '+91'}</Text></View>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, phoneDigits))}
                placeholder={t('mobile.phPhone10Digit')}
                placeholderTextColor="#c3c6d6"
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
              placeholderTextColor="#c3c6d6"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>{t('mobile.fieldAddress')}</Text>
            <TextInput
              style={[styles.input, { minHeight: 60 }]}
              value={address}
              onChangeText={setAddress}
              placeholder={t('mobile.phOptional')}
              placeholderTextColor="#c3c6d6"
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>{t('mobile.fieldNotes')}</Text>
            <TextInput
              style={[styles.input, { minHeight: 60 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('mobile.phCustomerNotes')}
              placeholderTextColor="#c3c6d6"
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
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="person-add" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Add Customer</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ═══ Contact Picker Modal ═══ */}
      <Modal visible={contactModal} transparent animationType="slide" onRequestClose={() => setContactModal(false)}>
        <View style={{ flex: 1 }}>
          <Pressable style={styles.modalDismiss} onPress={() => setContactModal(false)} />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16, maxHeight: '85%' }]}>
            <View style={styles.modalHandle} />

            {contactPermission === false ? (
              /* Permission denied — explain clearly */
              <View style={styles.permContainer}>
                <View style={styles.permIconBg}>
                  <MaterialIcons name="contacts" size={32} color="#00408f" />
                </View>
                <Text style={styles.permTitle}>{t('mobile.permAccessContactsTitle')}</Text>
                <Text style={styles.permBody}>
                  {t('mobile.permAccessContactsBody')}
                </Text>
                <View style={styles.permPrivacy}>
                  <MaterialIcons name="shield" size={18} color="#006b5f" />
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
                  <MaterialIcons name="search" size={20} color="#737685" />
                  <TextInput
                    style={styles.contactSearchInput}
                    placeholder={t('mobile.searchContactsPlaceholder')}
                    placeholderTextColor="#737685"
                    value={contactSearch}
                    onChangeText={setContactSearch}
                    autoFocus
                  />
                  {contactSearch ? (
                    <TouchableOpacity onPress={() => setContactSearch('')}>
                      <MaterialIcons name="close" size={18} color="#737685" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {loadingContacts ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#00408f" />
                  </View>
                ) : filteredContacts.length === 0 ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <MaterialIcons name="person-off" size={40} color="#c3c6d6" />
                    <Text style={{ fontSize: 13, color: '#737685', marginTop: 8 }}>{t('mobile.noContactsFound')}</Text>
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
                          <MaterialIcons name="add-circle-outline" size={20} color="#00408f" />
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fb' },
  header: { backgroundColor: '#f8f9fb', zIndex: 10 },
  headerInner: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 8, gap: 8 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#00408f' },
  iconBtn: { padding: 8 },
  scrollContent: { padding: 16, gap: 16 },

  // Contact import button
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#ffffff', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#edeef0',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  contactBtnIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#d8e2ff',
    alignItems: 'center', justifyContent: 'center',
  },
  contactBtnTitle: { fontSize: 14, fontWeight: '700', color: '#191c1e' },
  contactBtnSubtitle: { fontSize: 12, color: '#737685', marginTop: 1 },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#edeef0' },
  dividerText: { fontSize: 12, fontWeight: '500', color: '#737685' },

  // Form
  formCard: {
    backgroundColor: '#ffffff', borderRadius: 14, padding: 16, gap: 4,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#434654', marginTop: 10, marginBottom: 4 },
  input: {
    backgroundColor: '#f8f9fb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: '#191c1e', borderWidth: 1, borderColor: '#edeef0',
  },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phonePrefix: {
    backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#edeef0',
  },
  phonePrefixText: { fontSize: 14, fontWeight: '600', color: '#434654' },

  // Save
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#00408f', paddingVertical: 14, borderRadius: 12,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Modal
  modalDismiss: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd', alignSelf: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#191c1e', marginBottom: 12 },

  // Contact search
  contactSearchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f8f9fb', borderRadius: 10, paddingHorizontal: 12, height: 40,
    marginBottom: 12, borderWidth: 1, borderColor: '#edeef0',
  },
  contactSearchInput: { flex: 1, fontSize: 13, color: '#191c1e' },

  // Contact list items
  contactItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  contactAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#d8e2ff',
    alignItems: 'center', justifyContent: 'center',
  },
  contactAvatarText: { fontSize: 13, fontWeight: '700', color: '#00408f' },
  contactName: { fontSize: 14, fontWeight: '600', color: '#191c1e' },
  contactPhone: { fontSize: 12, color: '#737685', marginTop: 1 },

  // Permission screen inside modal
  permContainer: { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8, gap: 12 },
  permIconBg: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: '#d8e2ff',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  permTitle: { fontSize: 18, fontWeight: '800', color: '#191c1e', textAlign: 'center' },
  permBody: { fontSize: 14, color: '#434654', textAlign: 'center', lineHeight: 20 },
  permPrivacy: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#e6f7f2', borderRadius: 10, padding: 12, marginTop: 4,
  },
  permPrivacyText: { flex: 1, fontSize: 12, color: '#006b5f', lineHeight: 18 },
  permBtn: {
    width: '100%', paddingVertical: 14, borderRadius: 12, backgroundColor: '#00408f',
    alignItems: 'center', marginTop: 4,
  },
  permBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  permNotNow: { fontSize: 14, fontWeight: '600', color: '#737685' },
});
