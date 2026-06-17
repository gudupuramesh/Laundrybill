import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Switch, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import { colors, fonts, radii } from '../theme';

/**
 * Manager Tax & GST settings — the "Charge Tax" toggle + the "Tax Detail"
 * (name / rate / GST number) editor. Writes shops/{shopId}.settings.tax and
 * gstNumber, which is a shop-document update allowed for any shop member.
 * Mirrors the owner SettingsScreen tax controls (saveTaxEnabled/saveTaxDetails).
 */
export default function TaxSettingsScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const shopId = getShopId();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [name, setName] = useState('GST');
  const [rate, setRate] = useState('0');
  const [gstNumber, setGstNumber] = useState('');

  useEffect(() => {
    if (!shopId) { setLoading(false); return; }
    const unsub = firestore().collection('shops').doc(shopId).onSnapshot((doc: any) => {
      const d = doc.data() || {};
      const tax = d.settings?.tax || {};
      setEnabled(!!tax.enabled);
      setName(tax.name || 'GST');
      setRate(String(tax.rate ?? 0));
      setGstNumber(d.gstNumber || '');
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub?.();
  }, [shopId]);

  const saveEnabled = async (val: boolean) => {
    setEnabled(val);
    try {
      await firestore().collection('shops').doc(shopId).set(
        { settings: { tax: { enabled: val, name: name || 'GST', rate: Number(rate) || 0 } }, updatedAt: new Date() },
        { merge: true },
      );
    } catch (e: any) {
      setEnabled(!val);
      Alert.alert('Error', e?.message || 'Failed to update tax setting');
    }
  };

  const saveDetails = async () => {
    const r = parseFloat(rate);
    if (isNaN(r) || r < 0 || r > 100) { Alert.alert('Invalid rate', 'Tax rate must be between 0 and 100.'); return; }
    const nm = (name || 'GST').trim();
    if (!nm) { Alert.alert('Invalid name', 'Tax name is required.'); return; }
    setSaving(true);
    try {
      await firestore().collection('shops').doc(shopId).set(
        { settings: { tax: { enabled, name: nm, rate: r } }, gstNumber: gstNumber.trim(), updatedAt: new Date() },
        { merge: true },
      );
      Alert.alert('Saved', 'Tax details updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save tax details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onBack} style={s.iconBtn} activeOpacity={0.7}>
          <MaterialIcons name="chevron-left" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Tax & GST</Text>
        <View style={{ width: 40 }} />
      </View>
      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom }}>
          <View style={s.card}>
            <View style={s.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>Charge Tax</Text>
                <Text style={s.rowSub}>Apply {name || 'tax'} to new orders</Text>
              </View>
              <Switch value={enabled} onValueChange={saveEnabled} trackColor={{ true: colors.primary }} />
            </View>
          </View>

          <Text style={s.sectionLabel}>TAX DETAIL</Text>
          <View style={s.card}>
            <Text style={s.fieldLabel}>Tax name</Text>
            <TextInput style={s.input} value={name} onChangeText={setName} placeholder="GST" placeholderTextColor={colors.textMuted} />
            <Text style={s.fieldLabel}>Tax rate (%)</Text>
            <TextInput style={s.input} value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textMuted} />
            <Text style={s.fieldLabel}>GST / Tax number (optional)</Text>
            <TextInput style={s.input} value={gstNumber} onChangeText={setGstNumber} placeholder="—" placeholderTextColor={colors.textMuted} autoCapitalize="characters" />
          </View>

          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={saveDetails} disabled={saving} activeOpacity={0.85}>
            <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save Tax Detail'}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 12, paddingBottom: 10, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontFamily: fonts.bold, color: colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  rowSub: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 2 },
  sectionLabel: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary, marginBottom: 8, marginLeft: 4, letterSpacing: 0.5 },
  fieldLabel: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textSecondary, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: colors.surfaceMuted, borderRadius: radii.input, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: fonts.medium, color: colors.text, borderWidth: 1, borderColor: colors.border,
  },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 15, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontFamily: fonts.bold, color: '#fff' },
});
