/**
 * Add a branch (multi-shop / Franchise) from the owner app.
 * Creates a shop with a GENERATED id + ownerId = uid, copies the main shop's
 * catalog, then switches the app into the new branch.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../theme';
import { firestore } from '../lib/firebase';
import { auth } from '../lib/auth';
import { getPrimaryShopId, switchActiveShop } from '../lib/activeShop';
import { buildNewShopData, seedBranchCatalog } from '../lib/newShop';

export default function AddShopScreen({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  /** Called after the branch is created and the app switched into it. */
  onCreated: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState('');

  const handleCreate = async () => {
    const uid = auth().currentUser?.uid;
    if (!uid || saving) return;
    if (!name.trim()) {
      Alert.alert('Shop name required', 'Give the new branch a name.');
      return;
    }
    setSaving(true);
    try {
      const primaryId = getPrimaryShopId() || uid;

      setStep('Creating branch…');
      const primarySnap = await firestore().collection('shops').doc(primaryId).get();
      const settingsSource = (primarySnap.exists ? primarySnap.data()?.settings : null) || null;

      const ref = firestore().collection('shops').doc(); // generated id ≠ uid
      await ref.set(
        buildNewShopData(name.trim(), uid, {
          phone: phone.trim() || null,
          email: email.trim().toLowerCase() || null,
          location: city.trim() || null,
          settingsSource,
        }),
      );

      setStep('Copying your services & prices…');
      await seedBranchCatalog(ref.id, primaryId);

      setStep('Opening the branch…');
      await switchActiveShop(ref.id);
      onCreated();
    } catch (e: any) {
      console.error('Add branch failed:', e);
      Alert.alert('Could not create the branch', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
      setStep('');
    }
  };

  return (
    <View style={s.flex}>
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={10} style={s.back} disabled={saving}>
          <MaterialIcons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.title}>Add a branch</Text>
      </View>

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
          <View style={s.introRow}>
            <View style={s.introIcon}>
              <MaterialIcons name="storefront" size={20} color={colors.primary} />
            </View>
            <Text style={s.introText}>
              A new branch under your account, covered by your Franchise plan. It starts with your main
              shop&apos;s services and prices — change them any time in the branch&apos;s Services page.
            </Text>
          </View>

          <View style={s.card}>
            <Field label="Branch name" value={name} onChange={setName} placeholder="e.g. Laundrybill Indiranagar" required />
            <Field label="Branch phone (optional)" value={phone} onChange={setPhone} placeholder="Customer-facing number" keyboardType="phone-pad" />
            <Field label="Branch email (optional)" value={email} onChange={setEmail} placeholder="branch@example.com" keyboardType="email-address" />
            <Field label="City / area (optional)" value={city} onChange={setCity} placeholder="e.g. Indiranagar, Bengaluru" last />
          </View>

          <Text style={s.note}>
            Staff logins, orders and customers stay separate per branch. Set the branch&apos;s service areas in its
            Delivery Settings so online bookings route to it.
          </Text>

          <TouchableOpacity style={[s.cta, saving && { opacity: 0.7 }]} onPress={handleCreate} disabled={saving} activeOpacity={0.85}>
            {saving ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text style={s.ctaText}>{step || 'Creating…'}</Text>
              </>
            ) : (
              <>
                <MaterialIcons name="add-business" size={19} color="#fff" />
                <Text style={s.ctaText}>Create branch</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  label, value, onChange, placeholder, required, last, keyboardType,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  required?: boolean; last?: boolean; keyboardType?: 'default' | 'phone-pad' | 'email-address';
}) {
  return (
    <View style={[s.field, !last && s.fieldBorder]}>
      <Text style={s.label}>
        {label}
        {required ? <Text style={{ color: colors.error }}> *</Text> : null}
      </Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType || 'default'}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
      />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 10,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { padding: 4 },
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },

  introRow: { flexDirection: 'row', gap: 11, marginBottom: 16 },
  introIcon: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center',
  },
  introText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 },

  card: {
    backgroundColor: colors.surface, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14,
  },
  field: { paddingVertical: 12 },
  fieldBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.textSecondary },
  input: { marginTop: 5, fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text, padding: 0 },

  note: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, lineHeight: 17, marginTop: 14 },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: radii.input, paddingVertical: 15, marginTop: 18,
  },
  ctaText: { fontFamily: fonts.bold, fontSize: 15, color: '#fff' },
});
