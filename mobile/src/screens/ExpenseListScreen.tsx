import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import { useShopCountrySettings } from '../lib/use-shop-country-settings';
import { formatCurrency } from '../lib/currency-format';
import { colors, fonts, radii, shadows } from '../theme';

// Category config matching web
const CATEGORIES = [
  { key: 'rent', label: 'Rent', icon: 'home', group: 'Utilities' },
  { key: 'electricity', label: 'Electricity', icon: 'bolt', group: 'Utilities' },
  { key: 'water', label: 'Water', icon: 'water-drop', group: 'Utilities' },
  { key: 'detergents', label: 'Detergents', icon: 'science', group: 'Supplies' },
  { key: 'fabric_softener', label: 'Fabric Softener', icon: 'local-laundry-service', group: 'Supplies' },
  { key: 'hangers', label: 'Hangers', icon: 'checkroom', group: 'Supplies' },
  { key: 'equipment', label: 'Equipment', icon: 'build', group: 'Equipment' },
  { key: 'maintenance', label: 'Maintenance', icon: 'handyman', group: 'Equipment' },
  { key: 'transport', label: 'Transport', icon: 'local-shipping', group: 'Operations' },
  { key: 'delivery', label: 'Delivery', icon: 'delivery-dining', group: 'Operations' },
  { key: 'salary', label: 'Salary', icon: 'payments', group: 'Business' },
  { key: 'marketing', label: 'Marketing', icon: 'campaign', group: 'Business' },
  { key: 'miscellaneous', label: 'Miscellaneous', icon: 'more-horiz', group: 'Other' },
];

const GROUP_COLORS: Record<string, string> = {
  Utilities: colors.warning,
  Supplies: colors.success,
  Equipment: colors.primary,
  Operations: '#8B5CF6',
  Business: colors.inProgress,
  Other: colors.textSecondary,
};

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  if (val instanceof Date) return val;
  return new Date(val);
}

function formatDateShort(d: Date | null, locale: string): string {
  if (!d) return '—';
  return d.toLocaleDateString(locale || 'en-IN', { day: 'numeric', month: 'short' });
}

function getMonthKey(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

function getMonthLabel(d: Date): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function ExpenseListScreen({
  onBack,
}: {
  onBack: () => void;
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const shopId = getShopId();
  const countrySettings = useShopCountrySettings(shopId);

  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('miscellaneous');
  const [formDesc, setFormDesc] = useState('');
  const [formVendor, setFormVendor] = useState('');
  const [saving, setSaving] = useState(false);

  const monthKey = getMonthKey(selectedMonth);

  useEffect(() => {
    if (!shopId) { setLoading(false); return; }
    const startOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
    const endOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 23, 59, 59);

    const unsub = firestore()
      .collection(`shops/${shopId}/expenses`)
      .where('date', '>=', startOfMonth)
      .where('date', '<=', endOfMonth)
      .orderBy('date', 'desc')
      .onSnapshot(
        (snap: any) => {
          setExpenses(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        () => setLoading(false),
      );
    return unsub;
  }, [shopId, monthKey]);

  const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + (e.amount || 0), 0), [expenses]);

  const navigateMonth = (dir: number) => {
    const d = new Date(selectedMonth);
    d.setMonth(d.getMonth() + dir);
    const today = new Date();
    if (d.getFullYear() > today.getFullYear() || (d.getFullYear() === today.getFullYear() && d.getMonth() > today.getMonth())) return;
    setSelectedMonth(d);
  };

  const resetForm = () => { setFormAmount(''); setFormCategory('miscellaneous'); setFormDesc(''); setFormVendor(''); };

  const handleAdd = async () => {
    const amount = parseFloat(formAmount);
    if (!amount || amount <= 0) { Alert.alert('Required', 'Enter a valid amount'); return; }
    if (!shopId || saving) return;
    setSaving(true);
    try {
      const now = new Date();
      await firestore().collection(`shops/${shopId}/expenses`).add({
        category: formCategory,
        description: formDesc.trim(),
        amount,
        date: now,
        month: getMonthKey(now),
        vendor: formVendor.trim() || null,
        isRecurring: false,
        createdBy: 'mobile',
        createdAt: now,
      });
      resetForm();
      setShowAdd(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add expense');
    }
    setSaving(false);
  };

  const handleDelete = (id: string, desc: string) => {
    Alert.alert('Delete Expense', `Delete "${desc || 'this expense'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await firestore().collection(`shops/${shopId}/expenses`).doc(id).delete(); }
          catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const getCategoryInfo = (key: string) => {
    const cat = CATEGORIES.find(c => c.key === key) || { label: key, icon: 'more-horiz', group: 'Other' };
    const color = GROUP_COLORS[cat.group] || colors.textSecondary;
    return { ...cat, color };
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={onBack}><MaterialIcons name="chevron-left" size={24} color={colors.textSecondary} /></TouchableOpacity>
        <Text style={s.headerTitle}>Expenses</Text>
        <TouchableOpacity style={[s.iconBtn, { backgroundColor: colors.primaryTint }]} onPress={() => { resetForm(); setShowAdd(true); }}>
          <MaterialIcons name="add" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Month Nav */}
      <View style={s.monthNav}>
        <TouchableOpacity style={s.navBtn} onPress={() => navigateMonth(-1)}>
          <MaterialIcons name="chevron-left" size={22} color={colors.primary} />
        </TouchableOpacity>
        <View style={s.monthTextRow}>
          <MaterialIcons name="calendar-today" size={16} color={colors.primary} />
          <Text style={s.monthText}>{getMonthLabel(selectedMonth)}</Text>
        </View>
        <TouchableOpacity style={s.navBtn} onPress={() => navigateMonth(1)}>
          <MaterialIcons name="chevron-right" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Total */}
      <View style={s.totalCard}>
        <Text style={s.totalLabel}>TOTAL EXPENSES</Text>
        <Text style={s.totalValue}>{formatCurrency(Math.round(totalExpenses), countrySettings)}</Text>
        <Text style={s.totalCount}>{expenses.length} transactions</Text>
      </View>

      <ScrollView contentContainerStyle={[s.scrollContent, { paddingBottom: 100 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />
        ) : expenses.length === 0 ? (
          <View style={s.emptyState}>
            <MaterialIcons name="account-balance-wallet" size={48} color={colors.textMuted} />
            <Text style={s.emptyTitle}>No expenses this month</Text>
            <Text style={s.emptySubtitle}>Tap + to add an expense</Text>
          </View>
        ) : (
          <View style={s.listCard}>
            {expenses.map((exp, index) => {
              const cat = getCategoryInfo(exp.category);
              const date = toDate(exp.date);
              return (
                <TouchableOpacity
                  key={exp.id}
                  style={[s.listRow, index < expenses.length - 1 && s.listRowBorder]}
                  activeOpacity={0.7}
                  onLongPress={() => handleDelete(exp.id, exp.description)}
                >
                  <View style={[s.catIcon, { backgroundColor: cat.color + '18' }]}>
                    <MaterialIcons name={cat.icon as any} size={18} color={cat.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.expName} numberOfLines={1}>{exp.description || cat.label}</Text>
                    <Text style={s.expMeta} numberOfLines={1}>
                      {cat.label}{exp.vendor ? ` · ${exp.vendor}` : ''} · {formatDateShort(date, i18n.language)}
                    </Text>
                  </View>
                  <Text style={s.expAmount}>-{formatCurrency(Math.round(exp.amount), countrySettings)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={[s.fab, { bottom: 24 + insets.bottom }]} activeOpacity={0.85} onPress={() => { resetForm(); setShowAdd(true); }}>
        <MaterialIcons name="add" size={28} color={colors.surface} />
      </TouchableOpacity>

      {/* Add Expense Modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={s.modalDismiss} onPress={() => setShowAdd(false)} />
          <View style={[s.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Add Expense</Text>

            <Text style={s.fieldLabel}>AMOUNT *</Text>
            <TextInput style={s.modalInput} placeholder="e.g. 500" placeholderTextColor={colors.textMuted} value={formAmount} onChangeText={setFormAmount} keyboardType="numeric" autoFocus />

            <Text style={s.fieldLabel}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }} contentContainerStyle={{ gap: 6 }}>
              {CATEGORIES.map((cat) => {
                const color = GROUP_COLORS[cat.group] || colors.textSecondary;
                const isActive = formCategory === cat.key;
                return (
                  <TouchableOpacity key={cat.key} style={[s.catChip, isActive && { backgroundColor: color + '18', borderColor: color }]} onPress={() => setFormCategory(cat.key)}>
                    <MaterialIcons name={cat.icon as any} size={14} color={isActive ? color : colors.textMuted} />
                    <Text style={[s.catChipText, isActive && { color }]}>{cat.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={s.fieldLabel}>DESCRIPTION</Text>
            <TextInput style={s.modalInput} placeholder="What was this for?" placeholderTextColor={colors.textMuted} value={formDesc} onChangeText={setFormDesc} />

            <Text style={s.fieldLabel}>VENDOR</Text>
            <TextInput style={s.modalInput} placeholder="Shop/vendor name (optional)" placeholderTextColor={colors.textMuted} value={formVendor} onChangeText={setFormVendor} />

            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowAdd(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, !formAmount && { opacity: 0.5 }]} onPress={handleAdd} disabled={saving || !formAmount}>
                {saving ? <ActivityIndicator size="small" color={colors.surface} /> : <Text style={s.saveBtnText}>Add Expense</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },

  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  monthTextRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthText: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },

  totalCard: {
    backgroundColor: colors.errorBg, margin: 16, borderRadius: radii.card, padding: 16, alignItems: 'center',
  },
  totalLabel: { fontSize: 10, fontFamily: fonts.bold, color: colors.error, letterSpacing: 0.8 },
  totalValue: { fontSize: 28, fontFamily: fonts.bold, color: colors.error, marginTop: 2 },
  totalCount: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 4 },

  scrollContent: { paddingHorizontal: 16 },

  listCard: {
    backgroundColor: colors.surface, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.border, ...shadows.card, overflow: 'hidden',
  },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  catIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  expName: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  expMeta: { fontSize: 11, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 1 },
  expAmount: { fontSize: 14, fontFamily: fonts.bold, color: colors.error },

  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textSecondary, marginTop: 8 },
  emptySubtitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },

  fab: {
    position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', ...shadows.fab,
  },

  // Modal
  modalDismiss: { flex: 1, backgroundColor: 'rgba(26,29,46,0.4)' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontFamily: fonts.bold, color: colors.text, marginBottom: 12 },
  fieldLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 12, marginBottom: 4 },
  modalInput: {
    backgroundColor: colors.surfaceMuted, borderRadius: radii.input, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: fonts.medium, color: colors.text, borderWidth: 1, borderColor: colors.border,
  },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radii.button, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  catChipText: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: radii.button, borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textSecondary },
  saveBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: radii.button, backgroundColor: colors.primary },
  saveBtnText: { fontSize: 14, fontFamily: fonts.bold, color: colors.surface },
});
