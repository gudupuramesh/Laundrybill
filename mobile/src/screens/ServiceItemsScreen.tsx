import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput,
  Switch, ActivityIndicator, Alert, Image, Modal, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { firestore } from '../lib/db';
import { auth, getShopId } from '../lib/auth';
import { useShopCountrySettings } from '../lib/use-shop-country-settings';
import { formatCurrency } from '../lib/currency-format';

const R2_WORKER_URL = process.env.EXPO_PUBLIC_R2_WORKER_URL || 'https://laundryboss-r2.gudupuramesh.workers.dev';

function unitSuffix(pricingType: string, t: TFunction): string {
  if (pricingType === 'kg') return t('mobile.unitKg');
  if (pricingType === 'sqft') return t('mobile.unitSqft');
  if (pricingType === 'set') return t('mobile.unitSet');
  return t('mobile.unitPc');
}

interface Item {
  id: string;
  name: string;
  basePrice: number;
  pricingType: string;
  categoryId: string;
  categoryName: string;
  subCategory?: string;
  turnaroundDays: number;
  expressMultiplier: number;
  imageUrl?: string;
  imageKey?: string;
  order: number;
  isActive: boolean;
}

async function uploadImageToR2(shopId: string, uri: string, fileName: string): Promise<{ key: string; publicUrl: string }> {
  // Worker expects multipart/form-data: file, shopId, folder (see doc/R2-WORKER-CODE.js)
  const formData = new FormData();
  formData.append('file', { uri, name: fileName, type: 'image/jpeg' } as any);
  formData.append('shopId', shopId);
  formData.append('folder', 'service-images');

  const res = await fetch(`${R2_WORKER_URL}/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to upload image');
  }
  const data = await res.json();
  return { key: data.key, publicUrl: data.publicUrl };
}

async function deleteImageFromR2(key: string) {
  await fetch(`${R2_WORKER_URL}/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });
}

export default function ServiceItemsScreen({
  onBack,
  categoryId,
  categoryName,
}: {
  onBack: () => void;
  categoryId: string;
  categoryName: string;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const pricingTypes = useMemo(
    () => [
      { value: 'piece', label: t('mobile.pricingPerPiece') },
      { value: 'kg', label: t('mobile.pricingPerKg') },
      { value: 'sqft', label: t('mobile.pricingPerSqft') },
      { value: 'set', label: t('mobile.pricingPerSet') },
    ],
    [t],
  );
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);

  // Bulk add
  const [bulkText, setBulkText] = useState('');
  const [bulkAdding, setBulkAdding] = useState(false);

  // Item form modal (create + edit)
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editPricingType, setEditPricingType] = useState('piece');
  const [editSubCategory, setEditSubCategory] = useState('');
  const [editExpressMultiplier, setEditExpressMultiplier] = useState('1.5');
  const [editTurnaroundDays, setEditTurnaroundDays] = useState('2');
  const [editImageUri, setEditImageUri] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const shopId = getShopId();
  const countrySettings = useShopCountrySettings(shopId);
  const withCurrencySymbol = (text: string) => text.replace(/₹/g, countrySettings.currencySymbol || '₹');

  // Load items for this category from Firestore
  useEffect(() => {
    if (!shopId || !categoryId) return;
    const unsubscribe = firestore()
      .collection(`shops/${shopId}/inventory`)
      .where('categoryId', '==', categoryId)
      .onSnapshot(
        (snap: any) => {
          const list: Item[] = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          // Sort in-memory to avoid index requirement
          list.sort((a, b) => (a.order || 0) - (b.order || 0));
          setItems(list);
          setLoading(false);
        },
        (err: any) => {
          console.error('Error loading items:', err);
          setLoading(false);
        }
      );
    return () => unsubscribe?.();
  }, [shopId, categoryId]);

  // Bulk Add
  const handleBulkAdd = async () => {
    const lines = bulkText.split('\n').filter(l => l.trim());
    if (lines.length === 0) return;

    setBulkAdding(true);
    try {
      const maxOrder = items.reduce((m, i) => Math.max(m, i.order || 0), 0);
      let order = maxOrder;
      for (const line of lines) {
        const parts = line.split(',');
        const name = parts[0]?.trim();
        const price = parseFloat(parts[1]?.trim()) || 0;
        if (!name) continue;
        order++;
        await firestore().collection(`shops/${shopId}/inventory`).add({
          categoryId,
          categoryName,
          name,
          basePrice: price,
          pricingType: 'piece',
          turnaroundDays: 2,
          expressMultiplier: 1.5,
          order,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      setBulkText('');
    } catch (e: any) {
      Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedBulkAdd'));
    } finally {
      setBulkAdding(false);
    }
  };

  // Toggle active
  const toggleItemActive = async (item: Item) => {
    try {
      await firestore()
        .collection(`shops/${shopId}/inventory`)
        .doc(item.id)
        .update({ isActive: !item.isActive, updatedAt: new Date() });
    } catch (e: any) {
      Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedUpdateStatusService'));
    }
  };

  // Delete item (soft delete)
  const handleDeleteItem = (item: Item) => {
    Alert.alert(t('mobile.deleteItemTitle'), t('mobile.deleteItemConfirm', { name: item.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => {
          try {
            await firestore()
              .collection(`shops/${shopId}/inventory`)
              .doc(item.id)
              .update({ isActive: false, updatedAt: new Date() });
          } catch (e: any) {
            Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedDeleteItem'));
          }
        },
      },
    ]);
  };

  // Open item form in edit mode
  const openEdit = (item: Item) => {
    setEditItem(item);
    setEditName(item.name);
    setEditPrice(String(item.basePrice));
    setEditPricingType(item.pricingType || 'piece');
    setEditSubCategory(item.subCategory || '');
    setEditExpressMultiplier(String(item.expressMultiplier || 1.5));
    setEditTurnaroundDays(String(item.turnaroundDays || 2));
    setEditImageUri(item.imageUrl || null);
    setIsItemFormOpen(true);
  };

  // Open item form in add mode
  const openAdd = () => {
    setEditItem(null);
    setEditName('');
    setEditPrice('');
    setEditPricingType('piece');
    setEditSubCategory('');
    setEditExpressMultiplier('1.5');
    setEditTurnaroundDays('2');
    setEditImageUri(null);
    setIsItemFormOpen(true);
  };

  // Pick image
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      setEditImageUri(result.assets[0].uri);
    }
  };

  // Save item (create or edit)
  const handleSaveItem = async () => {
    if (!editName.trim()) return;
    setEditSaving(true);

    try {
      const itemData: Record<string, any> = {
        categoryId,
        categoryName,
        name: editName.trim(),
        basePrice: parseFloat(editPrice) || 0,
        pricingType: editPricingType,
        subCategory: editSubCategory.trim(),
        expressMultiplier: parseFloat(editExpressMultiplier) || 1.5,
        turnaroundDays: parseInt(editTurnaroundDays) || 2,
        updatedAt: new Date(),
      };

      // Upload image if selected and changed
      if (editImageUri && editImageUri !== editItem?.imageUrl) {
        // Delete old image from R2 in edit mode
        if (editItem?.imageKey) {
          try {
            await deleteImageFromR2(editItem.imageKey);
          } catch (_) {}
        }
        const fileName = `${Date.now()}.jpg`;
        const { key, publicUrl } = await uploadImageToR2(shopId, editImageUri, fileName);
        itemData.imageUrl = publicUrl;
        itemData.imageKey = key;
      }

      if (editItem) {
        await firestore()
          .collection(`shops/${shopId}/inventory`)
          .doc(editItem.id)
          .update(itemData);
      } else {
        const maxOrder = items.reduce((m, i) => Math.max(m, i.order || 0), 0);
        await firestore().collection(`shops/${shopId}/inventory`).add({
          ...itemData,
          order: maxOrder + 1,
          isActive: true,
          createdAt: new Date(),
        });
      }

      setIsItemFormOpen(false);
      setEditItem(null);
    } catch (e: any) {
      console.error('Save edit error:', e);
      Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedSaveItem'));
    } finally {
      setEditSaving(false);
    }
  };

  const activeItems = items.filter(i => i.isActive);
  const inactiveItems = items.filter(i => !i.isActive);

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
            <Text style={styles.headerTitle}>{t('mobile.serviceItemsTitle', { category: categoryName })}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Inventory List */}
        <View style={styles.listSection}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionLabel}>{t('mobile.inventoryCurrentSection', { count: activeItems.length })}</Text>
            <TouchableOpacity style={styles.addItemBtn} onPress={openAdd}>
              <MaterialIcons name="add" size={16} color="#ffffff" />
              <Text style={styles.addItemBtnText}>{t('mobile.addItemBtn')}</Text>
            </TouchableOpacity>
          </View>

          {activeItems.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialIcons name="inventory-2" size={40} color="#c3c6d6" />
              <Text style={styles.emptyText}>{t('mobile.noItemsYet')}</Text>
              <Text style={styles.emptySubtext}>{t('mobile.noItemsHint')}</Text>
            </View>
          )}

          <View style={styles.listContainer}>
            {activeItems.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.listItem,
                  index !== activeItems.length - 1 && styles.borderBottom,
                ]}
              >
                {/* Item thumbnail */}
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.itemThumb} />
                ) : (
                  <View style={styles.itemThumbPlaceholder}>
                    <MaterialIcons name="image" size={16} color="#c3c6d6" />
                  </View>
                )}

                <View style={styles.itemInfo}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
                      {item.subCategory ? (
                        <Text style={styles.itemSubCat}>{item.subCategory}</Text>
                      ) : null}
                      <View style={styles.unitBadge}>
                        <Text style={styles.unitBadgeText}>
                          {unitSuffix(item.pricingType || 'piece', t)}
                        </Text>
                      </View>
                      {item.expressMultiplier > 1 && (
                        <View style={[styles.unitBadge, { backgroundColor: '#fff3e0' }]}>
                          <Text style={[styles.unitBadgeText, { color: '#e65100' }]}>
                            {t('mobile.expressBadgeX', { multiplier: item.expressMultiplier })}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.itemPrice}>{formatCurrency(item.basePrice, countrySettings)}</Text>
                </View>

                <View style={styles.itemActions}>
                  <TouchableOpacity onPress={() => openEdit(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <MaterialIcons name="edit" size={16} color="#737685" />
                  </TouchableOpacity>
                  <Switch
                    value={item.isActive}
                    onValueChange={() => toggleItemActive(item)}
                    trackColor={{ false: '#e1e2e4', true: '#006b5f' }}
                    thumbColor={item.isActive ? '#ffffff' : '#f8f9fb'}
                    style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
                  />
                  <TouchableOpacity onPress={() => handleDeleteItem(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <MaterialIcons name="delete" size={18} color="#ba1a1a" style={{ opacity: 0.5 }} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Inactive items */}
        {inactiveItems.length > 0 && (
          <View style={styles.listSection}>
            <Text style={styles.sectionLabel}>{t('mobile.inactiveSection', { count: inactiveItems.length })}</Text>
            <View style={[styles.listContainer, { opacity: 0.5 }]}>
              {inactiveItems.map((item, index) => (
                <View
                  key={item.id}
                  style={[styles.listItem, index !== inactiveItems.length - 1 && styles.borderBottom]}
                >
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.itemThumb} />
                  ) : (
                    <View style={styles.itemThumbPlaceholder}>
                      <MaterialIcons name="image" size={16} color="#c3c6d6" />
                    </View>
                  )}
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemPrice}>{formatCurrency(item.basePrice, countrySettings)}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.restoreBtn}
                    onPress={() => toggleItemActive(item)}
                  >
                    <Text style={styles.restoreBtnText}>{t('mobile.restoreBtn')}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Bulk Add */}
        <View style={styles.bulkAddCard}>
          <View style={styles.bulkHeaderRow}>
            <MaterialIcons name="layers" size={20} color="#00408f" />
            <Text style={styles.bulkTitle}>{t('mobile.bulkAddTitle')}</Text>
          </View>
          <TextInput
            style={styles.bulkTextArea}
            placeholder={t('mobile.bulkAddPlaceholder')}
            placeholderTextColor="#737685"
            multiline
            numberOfLines={4}
            value={bulkText}
            onChangeText={setBulkText}
            textAlignVertical="top"
          />
          <View style={styles.bulkFooter}>
            <TouchableOpacity
              style={[styles.parseBtn, bulkAdding && { opacity: 0.6 }]}
              onPress={handleBulkAdd}
              disabled={bulkAdding}
            >
              {bulkAdding ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.parseBtnText}>{t('mobile.parseAndAdd')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Add/Edit Item Modal */}
      <Modal visible={isItemFormOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editItem ? t('mobile.editItemModalTitle') : t('mobile.addItemModalTitle')}</Text>
              <TouchableOpacity onPress={() => setIsItemFormOpen(false)}>
                <MaterialIcons name="close" size={24} color="#434654" />
              </TouchableOpacity>
            </View>

            {/* Image picker */}
            <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
              {editImageUri ? (
                <Image source={{ uri: editImageUri }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <MaterialIcons name="add-photo-alternate" size={32} color="#737685" />
                  <Text style={styles.imagePickerText}>{t('mobile.addImageBtn')}</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.modalLabel}>{t('mobile.itemNameField')}</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder={t('mobile.phItemName')}
            />

            <Text style={styles.modalLabel}>{t('mobile.pricingTypeField')}</Text>
            <View style={styles.pricingRow}>
              {pricingTypes.map((pt) => (
                <TouchableOpacity
                  key={pt.value}
                  style={[styles.pricingChip, editPricingType === pt.value && styles.pricingChipActive]}
                  onPress={() => setEditPricingType(pt.value)}
                >
                  <Text style={[styles.pricingChipText, editPricingType === pt.value && styles.pricingChipTextActive]}>
                    {pt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>{withCurrencySymbol(t('mobile.basePriceField') as string)}</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editPrice}
                  onChangeText={setEditPrice}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>{t('mobile.expressMultField')}</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editExpressMultiplier}
                  onChangeText={setEditExpressMultiplier}
                  keyboardType="decimal-pad"
                  placeholder="1.5"
                />
                <Text style={styles.expressHint}>
                  {withCurrencySymbol(t('mobile.expressPricePreview', { amount: Math.round((parseFloat(editPrice) || 0) * (parseFloat(editExpressMultiplier) || 1.5)) }) as string)}
                </Text>
              </View>
            </View>

            <View style={styles.modalRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>{t('mobile.subCategoryField')}</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editSubCategory}
                  onChangeText={setEditSubCategory}
                  placeholder={t('mobile.phSubCategory')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>{t('mobile.turnaroundDaysField')}</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editTurnaroundDays}
                  onChangeText={setEditTurnaroundDays}
                  keyboardType="numeric"
                  placeholder="2"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.modalSaveBtn, editSaving && { opacity: 0.6 }]}
              onPress={handleSaveItem}
              disabled={editSaving}
            >
              {editSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalSaveBtnText}>{editItem ? t('mobile.saveItemChanges') : t('mobile.addItemModalTitle')}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
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
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#191c1e' },
  iconBtn: { padding: 8 },
  scrollContent: { padding: 16, gap: 20 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: '#434654',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  // List
  listSection: { gap: 8 },
  listHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4,
  },
  addItemBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#00408f', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
  },
  addItemBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  listContainer: {
    backgroundColor: '#ffffff', borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(195, 198, 214, 0.1)',
  },
  listItem: {
    flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 12, paddingVertical: 8,
  },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: 'rgba(195, 198, 214, 0.2)' },
  // Item thumbnail
  itemThumb: { width: 36, height: 36, borderRadius: 8, marginRight: 10, backgroundColor: '#f3f4f6' },
  itemThumbPlaceholder: {
    width: 36, height: 36, borderRadius: 8, marginRight: 10,
    backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center',
  },
  itemInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemName: { fontSize: 13, fontWeight: '700', color: '#191c1e' },
  itemSubCat: { fontSize: 10, color: '#737685' },
  unitBadge: {
    backgroundColor: '#e8eaf6', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
  },
  unitBadgeText: { fontSize: 9, fontWeight: '700', color: '#3949ab' },
  itemPrice: { fontSize: 13, fontWeight: '700', color: '#00408f', marginRight: 8 },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  restoreBtn: { backgroundColor: '#00408f', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  restoreBtnText: { fontSize: 10, fontWeight: '700', color: '#ffffff' },
  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 6 },
  emptyText: { fontSize: 14, fontWeight: '700', color: '#434654' },
  emptySubtext: { fontSize: 11, color: '#737685' },
  // Bulk add
  bulkAddCard: { backgroundColor: '#edeef0', borderRadius: 12, padding: 16 },
  bulkHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  bulkTitle: { fontSize: 14, fontWeight: '700', color: '#191c1e' },
  bulkTextArea: {
    backgroundColor: '#ffffff', borderRadius: 8, padding: 12,
    fontSize: 14, fontWeight: '500', color: '#191c1e', minHeight: 100,
  },
  bulkFooter: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  parseBtn: {
    backgroundColor: '#00408f', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8,
  },
  parseBtnText: { fontSize: 12, fontWeight: '700', color: '#ffffff', letterSpacing: 1 },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#191c1e' },
  modalLabel: {
    fontSize: 10, fontWeight: '700', color: '#434654',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: 12,
  },
  modalInput: {
    backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 14, fontWeight: '500', color: '#191c1e',
  },
  modalRow: { flexDirection: 'row', gap: 12 },
  pricingRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pricingChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  pricingChipActive: { backgroundColor: '#00408f' },
  pricingChipText: { fontSize: 11, fontWeight: '700', color: '#434654' },
  pricingChipTextActive: { color: '#ffffff' },
  expressHint: { fontSize: 10, color: '#e65100', marginTop: 4, fontWeight: '600' },
  // Image picker
  imagePicker: { alignItems: 'center', marginVertical: 8 },
  imagePreview: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#f3f4f6' },
  imagePlaceholder: {
    width: 80, height: 80, borderRadius: 12, backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
    borderColor: '#e1e2e4', borderStyle: 'dashed',
  },
  imagePickerText: { fontSize: 10, color: '#737685', marginTop: 4 },
  modalSaveBtn: {
    backgroundColor: '#00408f', borderRadius: 8, paddingVertical: 14,
    alignItems: 'center', marginTop: 20,
  },
  modalSaveBtnText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
});
