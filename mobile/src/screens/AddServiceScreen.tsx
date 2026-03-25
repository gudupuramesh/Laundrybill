import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Switch, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';

const ICONS = ['iron', 'local-laundry-service', 'dry-cleaning', 'air', 'brush', 'checkroom', 'home', 'star'];
const COLORS = [
  '#00408f', '#006b5f', '#ffb950', '#ba1a1a',
  '#10b981', '#6366f1', '#fb7185', '#94a3b8'
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
        <ActivityIndicator size="large" color="#00408f" />
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
              <MaterialIcons name="arrow-back" size={24} color="#00408f" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('mobile.manageServicesTitle')}</Text>
          </View>
          <TouchableOpacity onPress={() => { resetForm(); setShowForm(true); }}>
            <MaterialIcons name="add-circle" size={28} color="#00408f" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Add/Edit Form */}
        {showForm && (
          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>{editingId ? t('mobile.editServiceTitle') : t('mobile.newServiceTitle')}</Text>
              <TouchableOpacity onPress={resetForm}>
                <MaterialIcons name="close" size={22} color="#737685" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{t('mobile.serviceNameLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('mobile.phServiceName')}
              placeholderTextColor="#737685"
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
                    selectedIcon === icon && { backgroundColor: '#00408f' }
                  ]}
                  onPress={() => setSelectedIcon(icon)}
                >
                  <MaterialIcons
                    name={icon as any}
                    size={22}
                    color={selectedIcon === icon ? '#ffffff' : '#434654'}
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
                    <MaterialIcons name="check" size={14} color="#fff" />
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
                  trackColor={{ false: '#e1e2e4', true: '#d8e2ff' }}
                  thumbColor={isActive ? '#00408f' : '#f8f9fb'}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
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
            <MaterialIcons name="local-laundry-service" size={48} color="#c3c6d6" />
            <Text style={styles.emptyText}>{t('mobile.noServicesYet')}</Text>
            <Text style={styles.emptySubtext}>{t('mobile.noServicesHint')}</Text>
          </View>
        )}

        {categories.filter(c => c.isActive).map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.serviceCard, { borderLeftColor: cat.color || COLORS[0] }]}
            onPress={() => onViewItems?.(cat.id, cat.name)}
            activeOpacity={0.7}
          >
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
                <MaterialIcons name="edit" size={18} color="#737685" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(cat)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialIcons name="delete" size={18} color="#ba1a1a" style={{ opacity: 0.6 }} />
              </TouchableOpacity>
              <MaterialIcons name="chevron-right" size={22} color="#c3c6d6" />
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
              <View key={cat.id} style={[styles.serviceCard, { opacity: 0.5, borderLeftColor: '#94a3b8' }]}>
                <View style={styles.serviceCardLeft}>
                  <View style={[styles.serviceIconWrap, { backgroundColor: '#f3f4f6' }]}>
                    <MaterialIcons name={iconForCategory(cat.icon)} size={24} color="#94a3b8" />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fb' },
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1, borderBottomColor: 'rgba(195, 198, 214, 0.2)', zIndex: 10,
  },
  headerInner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    height: 56, paddingHorizontal: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#00408f' },
  iconBtn: { padding: 8 },
  scrollContent: { padding: 16, gap: 12 },
  sectionHeader: { marginTop: 4, marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#191c1e' },
  sectionSubtitle: { fontSize: 12, color: '#434654', marginTop: 2 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: '#434654',
    textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 4, marginBottom: 8,
  },
  // Form
  formCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 12,
    borderWidth: 1, borderColor: 'rgba(0, 64, 143, 0.15)',
    shadowColor: '#00408f', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  formTitle: { fontSize: 14, fontWeight: '700', color: '#00408f' },
  formRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  label: {
    fontSize: 10, fontWeight: '700', color: '#434654',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
  },
  input: {
    backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 14, fontWeight: '500', color: '#191c1e',
  },
  iconRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    backgroundColor: '#f3f4f6', borderRadius: 12, padding: 6,
  },
  iconOption: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorOption: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  colorOptionSelected: {
    borderWidth: 2, borderColor: '#ffffff',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  saveBtn: {
    backgroundColor: '#00408f', borderRadius: 8, paddingVertical: 12,
    alignItems: 'center', marginTop: 4,
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  // Service Cards
  serviceCard: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderLeftWidth: 4, borderWidth: 1, borderColor: 'rgba(195, 198, 214, 0.1)',
  },
  serviceCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  serviceIconWrap: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  serviceName: { fontSize: 14, fontWeight: '700', color: '#191c1e' },
  serviceMeta: { fontSize: 11, color: '#737685', marginTop: 2 },
  serviceActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  restoreBtn: {
    backgroundColor: '#00408f', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6,
  },
  restoreBtnText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },
  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#434654' },
  emptySubtext: { fontSize: 12, color: '#737685' },
});
