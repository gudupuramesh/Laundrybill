import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../theme';
import { getShopId } from '../lib/auth';
import { useDeliverySettings } from '../lib/useDeliverySettings';

export default function ServiceAreasScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const shopId = getShopId();
  const { settings, loading, addServiceArea, removeServiceArea, toggleServiceArea, setEnableServiceAreas } =
    useDeliverySettings(shopId);
  const [input, setInput] = useState('');

  const areas = settings.serviceAreas || [];

  const add = async () => {
    const v = input.trim();
    if (!v) return;
    if (areas.some((a) => a.value.toLowerCase() === v.toLowerCase())) {
      Alert.alert('Already added', `"${v}" is already a service area.`);
      return;
    }
    setInput('');
    await addServiceArea(v);
  };

  const confirmRemove = (id: string, value: string) =>
    Alert.alert('Remove area', `Remove "${value}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeServiceArea(id) },
    ]);

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={10} style={styles.back}>
          <MaterialIcons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Service Areas</Text>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
          {/* Enable toggle */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.cardTitle}>Enable service areas</Text>
                <Text style={styles.cardSub}>
                  Limit delivery to selected areas and assign agents per area.
                </Text>
              </View>
              <Switch
                value={!!settings.enableServiceAreas}
                onValueChange={setEnableServiceAreas}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* Add area */}
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Add an area (e.g. SR Nagar)"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              onSubmitEditing={add}
            />
            <TouchableOpacity style={styles.addBtn} onPress={add} activeOpacity={0.85}>
              <MaterialIcons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Areas list */}
          <Text style={styles.sectionLabel}>Areas ({areas.length})</Text>
          {loading ? (
            <Text style={styles.muted}>Loading…</Text>
          ) : areas.length === 0 ? (
            <Text style={styles.muted}>No areas yet. Add one above.</Text>
          ) : (
            areas.map((a) => (
              <View key={a.id} style={styles.areaRow}>
                <Text style={[styles.areaName, !a.isActive && styles.areaNameOff]}>{a.value}</Text>
                <View style={styles.areaRight}>
                  <Switch
                    value={a.isActive}
                    onValueChange={(v) => toggleServiceArea(a.id, v)}
                    trackColor={{ true: colors.success, false: colors.border }}
                    thumbColor="#fff"
                  />
                  <TouchableOpacity onPress={() => confirmRemove(a.id, a.value)} hitSlop={8}>
                    <MaterialIcons name="delete-outline" size={22} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          <Text style={styles.syncNote}>
            Areas sync instantly with the web dashboard and the order screen.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { padding: 4 },
  title: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 16,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  cardSub: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
  addRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
  },
  addBtn: {
    width: 48,
    borderRadius: radii.input,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 10,
  },
  muted: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted, paddingVertical: 12 },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  areaName: { fontFamily: fonts.bold, fontSize: 14, color: colors.text, flex: 1 },
  areaNameOff: { color: colors.textMuted },
  areaRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  syncNote: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 8, textAlign: 'center' },
});
