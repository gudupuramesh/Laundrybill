import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Switch, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import { colors, fonts, radii, shadows, spacing } from '../theme';

const ICONS = ['iron', 'local-laundry-service', 'dry-cleaning', 'air', 'brush', 'checkroom', 'home', 'star'];
const COLORS = [
  colors.primary, '#006b5f', '#ffb950', colors.error,
  '#10b981', '#6366f1', '#fb7185', colors.textMuted
];

interface Category {
  id: string;
  name: string;
  icon: string;
  color?: string;
  order: number;
  turnaroundDays: number;
  isActive: boolean;
  itemCount?: number;
}

export default function AddServiceScreen({
  onBack,
  onSave,
  onViewItems,
}: {
  onBack: () => void,
  onSave?: () => void,
  onViewItems?: (categoryId: string, categoryName: string) => void,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  // Form state for add/edit
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [serviceName, setServiceName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [turnaroundDays, setTurnaroundDays] = useState('2');
  const [isActive, setIsActive] = useState(true);

  const shopId = getShopId();

  // Load categories from Firestore
  useEffect(() => {
    if (!shopId) return;
    const unsubscribe = firestore()
      .collection(`shops/${shopId}/categories`)
      .orderBy('order', 'asc')
      .onSnapshot(
        (snap: any) => {
          const cats: Category[] = snap.docs.map((d: any) => ({
            id: d.id,
            ...d.data(),
          }));
          setCategories(cats);
          setLoading(false);
        },
        (err: any) => {
          console.error('Error loading categories:', err);
          setLoading(false);
        }
      );
    return () => unsubscribe?.();
  }, [shopId]);

  const resetForm = () => {
    setServiceName('');
    setSelectedIcon(ICONS[0]);
    setSelectedColor(COLORS[0]);
    setTurnaroundDays('2');
    setIsActive(true);
    setEditingId(null);
    setShowForm(false);
  };

  const openEditForm = (cat: Category) => {
    setEditingId(cat.id);
    setServiceName(cat.name);
    setSelectedIcon(cat.icon || ICONS[0]);
    setSelectedColor(cat.color || COLORS[0]);
    setTurnaroundDays(String(cat.turnaroundDays || 2));
    setIsActive(cat.isActive);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!serviceName.trim()) {
      Alert.alert(t('mobile.errorTitle'), t('mobile.serviceNameRequired'));
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        // Update existing category
        await firestore()
          .collection(`shops/${shopId}/categories`)
          .doc(editingId)
          .update({
            name: serviceName.trim(),
            icon: selectedIcon,
            color: selectedColor,
            turnaroundDays: parseInt(turnaroundDays) || 2,
            isActive,
            updatedAt: new Date(),
          });
      } else {
        // Create new category
        const maxOrder = categories.reduce((max, c) => Math.max(max, c.order || 0), 0);
        await firestore()
          .collection(`shops/${shopId}/categories`)
          .add({
            name: serviceName.trim(),
            icon: selectedIcon,
            color: selectedColor,
            order: maxOrder + 1,
            turnaroundDays: parseInt(turnaroundDays) || 2,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
      }
      resetForm();
    } catch (e: any) {
      console.error('Save category error:', e);
      Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedSaveService'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (cat: Category) => {
    Alert.alert(
      t('mobile.deleteServiceTitle'),
      t('mobile.deleteServiceConfirm', { name: cat.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await firestore()
                .collection(`shops/${shopId}/categories`)
                .doc(cat.id)
                .update({ isActive: false, updatedAt: new Date() });
            } catch (e: any) {
              Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedDeleteService'));
            }
          },
        },
      ]
    );
  };

  const toggleActive = async (cat: Category) => {
    try {
      await firestore()
        .collection(`shops/${shopId}/categories`)
        .doc(cat.id)
        .update({ isActive: !cat.isActive, updatedAt: new Date() });
    } catch (e: any) {
      Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedUpdateStatusService'));
    }
  };

  const iconForCategory = (icon: string) => {
    const mapping: Record<string, string> = {
      'wind': 'iron',
      'droplets': 'local-laundry-service',
      'sparkles': 'auto-awesome',
      'shirt': 'dry-cleaning',
      'home': 'home',
      'footprints': 'directions-walk',
      'star': 'star',
    };
    return (mapping[icon] || icon || 'local-laundry-service') as any;
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* TopAppBar */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerInner}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
              <MaterialIcons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('mobile.manageServicesTitle')}</Text>
          </View>
          <TouchableOpacity onPress={() => { resetForm(); setShowForm(true); }}>
            <MaterialIcons name="add-circle" size={28} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Add/Edit Form */}
        {showForm && (
          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>{editingId ? t('mobile.editServiceTitle') : t('mobile.newServiceTitle')}</Text>
              <TouchableOpacity onPress={resetForm}>
                <MaterialIcons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{t('mobile.serviceNameLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('mobile.phServiceName')}
              placeholderTextColor={colors.textMuted}
              value={serviceName}
              onChangeText={setServiceName}
            />

            <Text style={styles.label}>{t('mobile.serviceIconLabel')}</Text>
            <View style={styles.iconRow}>
              {ICONS.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconOption,
                    selectedIcon === icon && { backgroundColor: colors.primary }
                  ]}
                  onPress={() => setSelectedIcon(icon)}
                >
                  <MaterialIcons
                    name={icon as any}
                    size={22}
                    color={selectedIcon === icon ? colors.surface : colors.textSecondary}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>{t('mobile.accentColorLabel')}</Text>
            <View style={styles.colorRow}>
              {COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorOptionSelected,
                  ]}
                  onPress={() => setSelectedColor(color)}
                >
                  {selectedColor === color && (
                    <MaterialIcons name="check" size={14} color={colors.surface} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{t('mobile.turnaroundDaysField')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2"
                  keyboardType="numeric"
                  value={turnaroundDays}
                  onChangeText={setTurnaroundDays}
                />
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.label}>{t('mobile.activeLabel')}</Text>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: colors.border, true: colors.primaryTint }}
                  thumbColor={isActive ? colors.primary : colors.background}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.surface} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>{editingId ? t('mobile.updateServiceBtn') : t('mobile.addServiceBtn')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Category Cards */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('mobile.yourServicesSection', { count: categories.filter(c => c.isActive).length })}</Text>
          <Text style={styles.sectionSubtitle}>{t('mobile.tapServiceHint')}</Text>
        </View>

        {categories.filter(c => c.isActive).length === 0 && (
          <View style={styles.emptyState}>
            <MaterialIcons name="local-laundry-service" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t('mobile.noServicesYet')}</Text>
            <Text style={styles.emptySubtext}>{t('mobile.noServicesHint')}</Text>
          </View>
        )}

        {categories.filter(c => c.isActive).map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={styles.serviceCard}
            onPress={() => onViewItems?.(cat.id, cat.name)}
            activeOpacity={0.7}
          >
            <View style={[styles.serviceAccentBar, { backgroundColor: cat.color || COLORS[0] }]} />
            <View style={styles.serviceCardLeft}>
              <View style={[styles.serviceIconWrap, { backgroundColor: (cat.color || COLORS[0]) + '18' }]}>
                <MaterialIcons
                  name={iconForCategory(cat.icon)}
                  size={24}
                  color={cat.color || COLORS[0]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceName}>{cat.name}</Text>
                <Text style={styles.serviceMeta}>
                  {t('mobile.turnaroundDays', { count: cat.turnaroundDays || 2 })}
                </Text>
              </View>
            </View>
            <View style={styles.serviceActions}>
              <TouchableOpacity onPress={() => openEditForm(cat)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialIcons name="edit" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(cat)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialIcons name="delete" size={18} color={colors.error} style={{ opacity: 0.6 }} />
              </TouchableOpacity>
              <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        ))}

        {/* Inactive categories section */}
        {categories.filter(c => !c.isActive).length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>
              {t('mobile.inactiveSection', { count: categories.filter(c => !c.isActive).length })}
            </Text>
            {categories.filter(c => !c.isActive).map((cat) => (
              <View key={cat.id} style={[styles.serviceCard, { opacity: 0.5 }]}>
                <View style={[styles.serviceAccentBar, { backgroundColor: colors.textMuted }]} />
                <View style={styles.serviceCardLeft}>
                  <View style={[styles.serviceIconWrap, { backgroundColor: colors.surfaceMuted }]}>
                    <MaterialIcons name={iconForCategory(cat.icon)} size={24} color={colors.textMuted} />
                  </View>
                  <Text style={styles.serviceName}>{cat.name}</Text>
                </View>
                <TouchableOpacity
                  style={styles.restoreBtn}
                  onPress={() => toggleActive(cat)}
                >
                  <Text style={styles.restoreBtnText}>{t('mobile.restoreBtn')}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border, zIndex: 10,
  },
  headerInner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    height: 56, paddingHorizontal: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  iconBtn: {
    padding: 8, backgroundColor: colors.surfaceMuted, borderRadius: 20,
  },
  scrollContent: { padding: 16, gap: 12 },
  sectionHeader: { marginTop: 4, marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  sectionSubtitle: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 2 },
  sectionLabel: {
    fontSize: 10, fontFamily: fonts.bold, color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 4, marginBottom: 8,
  },
  // Form
  formCard: {
    backgroundColor: colors.surface, borderRadius: radii.card, padding: 16, gap: 12,
    ...shadows.card, ...shadows.cardBorder,
  },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  formTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.primary },
  formRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  label: {
    fontSize: 10, fontFamily: fonts.bold, color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surfaceMuted, borderRadius: radii.input, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 14, fontFamily: fonts.medium, color: colors.text,
  },
  iconRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    backgroundColor: colors.surfaceMuted, borderRadius: radii.button, padding: 6,
  },
  iconOption: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorOption: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  colorOptionSelected: {
    borderWidth: 2, borderColor: colors.surface,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 12,
    alignItems: 'center', marginTop: 4,
  },
  saveBtnText: { fontSize: 14, fontFamily: fonts.bold, color: colors.surface },
  // Service Cards
  serviceCard: {
    backgroundColor: colors.surface, borderRadius: radii.card, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    ...shadows.card, ...shadows.cardBorder,
    overflow: 'hidden', position: 'relative',
  },
  serviceAccentBar: {
    position: 'absolute', left: 0, top: 12, bottom: 12, width: 4,
    borderTopRightRadius: 4, borderBottomRightRadius: 4,
  },
  serviceCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  serviceIconWrap: {
    width: 44, height: 44, borderRadius: radii.button, alignItems: 'center', justifyContent: 'center',
  },
  serviceName: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  serviceMeta: { fontSize: 11, fontFamily: fonts.medium, color: colors.textMuted, marginTop: 2 },
  serviceActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  restoreBtn: {
    backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6,
  },
  restoreBtnText: { fontSize: 11, fontFamily: fonts.bold, color: colors.surface },
  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontSize: 16, fontFamily: fonts.bold, color: colors.textSecondary },
  emptySubtext: { fontSize: 12, fontFamily: fonts.medium, color: colors.textMuted },
});
