import React, { useEffect, useImperativeHandle, useMemo, useState, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import { useShopCountrySettings } from '../lib/use-shop-country-settings';
import { formatCurrency } from '../lib/currency-format';
import i18n from '../lib/i18n';
import { DraftOrderPayload } from '../types/orderDraft';
import { HelpButton } from '../components/HelpButton';
import { colors, fonts, radii, shadows, spacing } from '../theme';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  isActive?: boolean;
}

interface Category {
  id: string;
  name: string;
  order?: number;
  color?: string;
  icon?: string;
  isActive?: boolean;
}

interface InventoryItem {
  id: string;
  name: string;
  basePrice: number;
  pricingType?: string;
  subCategory?: string;
  turnaroundDays?: number;
  expressMultiplier?: number;
  imageUrl?: string;
  imageKey?: string;
  categoryId: string;
  categoryName: string;
  order?: number;
  isActive?: boolean;
}

interface CartState {
  quantity: number;
  express: boolean;
  unitPriceOverride?: number;
}

import { getUnitLabel, getUnitsForCountry } from '../lib/country-config';

const pricingTypeToUnit = (pricingType?: string) => getUnitLabel(pricingType || 'piece');

// Units that need decimal/weight input (not integer stepper)
const DECIMAL_UNITS = ['kg', 'lb', 'sqft', 'sqm', 'load', 'bag'];

const normalizePhone = (raw: string) => raw.replace(/\D/g, '').slice(-10);
const R2_WORKER_URL = process.env.EXPO_PUBLIC_R2_WORKER_URL || 'https://laundryboss-r2.gudupuramesh.workers.dev';

async function uploadImageToR2(shopId: string, uri: string, fileName: string): Promise<{ key: string; publicUrl: string }> {
  const formData = new FormData();
  formData.append('file', {
    uri,
    name: fileName,
    type: 'image/jpeg',
  } as any);
  formData.append('shopId', shopId);
  formData.append('folder', 'service-images');

  const res = await fetch(`${R2_WORKER_URL}/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || i18n.t('mobile.failedUploadUrl'));
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

const PRICING_UNIT_TKEY = {
  piece: 'mobile.pricingUnitPiece',
  kg: 'mobile.pricingUnitKg',
  sqft: 'mobile.pricingUnitSqft',
  set: 'mobile.pricingUnitSet',
} as const;

export interface CreateOrderScreenRef {
  goToCustomerStep: () => void;
}

const CreateOrderScreen = forwardRef<CreateOrderScreenRef, {
  onBack: () => void,
  onReviewOrder: (draft: DraftOrderPayload) => void,
  editOrder?: any,
  onAddCustomer?: () => void,
  onEditCustomerDetail?: (customerId: string) => void,
}>(({ onBack, onReviewOrder, editOrder, onAddCustomer, onEditCustomerDetail }, ref) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const shopId = getShopId();
  const countrySettings = useShopCountrySettings(shopId);

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const [step, setStep] = useState<'customer' | 'items'>('customer');
  const [search, setSearch] = useState('');
  const [customerModalSearch, setCustomerModalSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [cart, setCart] = useState<Record<string, CartState>>({});
  const [weightText, setWeightText] = useState<Record<string, string>>({});

  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [editPriceValue, setEditPriceValue] = useState('');
  const [editUnitValue, setEditUnitValue] = useState<string>('piece');
  const [editSubCategoryValue, setEditSubCategoryValue] = useState('');
  const [editExpressMultiplierValue, setEditExpressMultiplierValue] = useState('1.5');
  const [editTurnaroundDaysValue, setEditTurnaroundDaysValue] = useState('2');
  const [editImageUri, setEditImageUri] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customSaving, setCustomSaving] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customUnit, setCustomUnit] = useState<string>('piece');
  const [customExpressMultiplier, setCustomExpressMultiplier] = useState('1.5');
  const [customImageUri, setCustomImageUri] = useState<string | null>(null);
  const [customCategoryId, setCustomCategoryId] = useState('');
  const [showCustomCategoryList, setShowCustomCategoryList] = useState(false);

  useImperativeHandle(ref, () => ({
    goToCustomerStep: () => setStep('customer'),
  }));

  useEffect(() => {
    if (!shopId) return;
    let loadedCount = 0;
    const markLoaded = () => {
      loadedCount += 1;
      if (loadedCount >= 3) setLoading(false);
    };

    const unsubCustomers = firestore()
      .collection(`shops/${shopId}/customers`)
      .onSnapshot(
        (snap: any) => {
          const list: Customer[] = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          list.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
          setCustomers(list.filter((c) => c.isActive !== false));
          markLoaded();
        },
        () => markLoaded()
      );

    const unsubCategories = firestore()
      .collection(`shops/${shopId}/categories`)
      .onSnapshot(
        (snap: any) => {
          const list: Category[] = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          const active = list.filter((c) => c.isActive !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
          setCategories(active);
          setSelectedCategoryId((prev) => prev || active[0]?.id || '');
          markLoaded();
        },
        () => markLoaded()
      );

    const unsubInventory = firestore()
      .collection(`shops/${shopId}/inventory`)
      .onSnapshot(
        (snap: any) => {
          const list: InventoryItem[] = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          const active = list.filter((i) => i.isActive !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
          setInventory(active);
          markLoaded();
        },
        () => markLoaded()
      );

    return () => {
      unsubCustomers?.();
      unsubCategories?.();
      unsubInventory?.();
    };
  }, [shopId]);

  useEffect(() => {
    if (!customCategoryId && selectedCategoryId) {
      setCustomCategoryId(selectedCategoryId);
    }
  }, [selectedCategoryId, customCategoryId]);

  // Pre-fill when editing an existing order
  useEffect(() => {
    if (!editOrder || loading) return;
    // Set customer (locked in edit mode)
    const cust = editOrder.customer || {};
    const custId = cust.id || editOrder.customerId || '';
    const custName = cust.name || editOrder.customerName || '';
    const custPhone = cust.phone || editOrder.customerPhone || '';
    if (custId || custName || custPhone) {
      setSelectedCustomer({
        id: custId,
        name: custName,
        phone: custPhone,
        email: cust.email || editOrder.customerEmail || null,
        address: cust.address || editOrder.customerAddress || null,
      });
      setSearch(`${custName} • ${custPhone}`);
    }
    // Pre-fill cart from order items
    const newCart: Record<string, CartState> = {};
    (editOrder.items || []).forEach((item: any) => {
      const invMatch = inventory.find((i) => i.id === item.serviceId || i.name === item.serviceName);
      if (invMatch) {
        newCart[invMatch.id] = {
          quantity: item.quantity || 1,
          express: item.express || false,
          unitPriceOverride: item.unitPrice !== invMatch.basePrice ? item.unitPrice : undefined,
        };
      }
    });
    if (Object.keys(newCart).length > 0) setCart(newCart);
    setStep('items');
  }, [editOrder, loading, inventory]);

  const filteredCustomers = useMemo(() => {
    const q = customerModalSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 10);
    return customers.filter((c) => {
      const fields = [c.name, c.phone, c.email, c.address].filter(Boolean).join(' ').toLowerCase();
      return fields.includes(q);
    }).slice(0, 20);
  }, [customers, customerModalSearch]);

  const currentCategoryItems = useMemo(
    () => inventory.filter((i) => i.categoryId === selectedCategoryId),
    [inventory, selectedCategoryId]
  );

  const mostUsedItems = useMemo(() => inventory.slice(0, 8), [inventory]);

  const totals = useMemo(() => {
    let itemCount = 0;
    let subtotal = 0;
    let expressCharge = 0;
    currentCategoryItems.forEach(() => {});
    Object.entries(cart).forEach(([itemId, state]) => {
      if (!state || state.quantity <= 0) return;
      const item = inventory.find((i) => i.id === itemId);
      if (!item) return;
      const multiplier = state.express ? (item.expressMultiplier || 1.5) : 1;
      const base = item.basePrice || 0;
      const unitPrice = state.unitPriceOverride ?? base * multiplier;
      subtotal += unitPrice * state.quantity;
      expressCharge += state.express ? (base * ((item.expressMultiplier || 1.5) - 1) * state.quantity) : 0;
      itemCount += state.quantity;
    });
    return {
      itemCount,
      subtotal: Math.round(subtotal),
      expressCharge: Math.round(expressCharge),
      total: Math.round(subtotal),
    };
  }, [cart, inventory, currentCategoryItems]);

  const setQty = (itemId: string, nextQty: number) => {
    setCart((prev) => {
      const current = prev[itemId] || { quantity: 0, express: false };
      const qty = Math.max(0, nextQty);
      if (qty === 0) {
        const clone = { ...prev };
        delete clone[itemId];
        return clone;
      }
      return { ...prev, [itemId]: { ...current, quantity: qty } };
    });
  };

  const setQtyFromText = (itemId: string, value: string) => {
    const normalizedValue = value.replace(',', '.').trim();
    // Allow intermediate values like "2." or "2.0" while typing
    if (!/^\d*\.?\d*$/.test(normalizedValue) && normalizedValue !== '') return;
    setWeightText((prev) => ({ ...prev, [itemId]: normalizedValue }));
    if (normalizedValue === '' || normalizedValue === '.') {
      setCart((prev) => {
        const clone = { ...prev };
        delete clone[itemId];
        return clone;
      });
      return;
    }
    const parsed = parseFloat(normalizedValue);
    if (Number.isNaN(parsed) || parsed < 0) return;
    setCart((prev) => {
      const current = prev[itemId] || { quantity: 0, express: false };
      return { ...prev, [itemId]: { ...current, quantity: parsed } };
    });
  };

  const toggleExpress = (itemId: string) => {
    setCart((prev) => {
      const current = prev[itemId] || { quantity: 1, express: false };
      return { ...prev, [itemId]: { ...current, express: !current.express } };
    });
  };

  const openEditItem = (item: InventoryItem) => {
    setEditItem(item);
    setEditNameValue(item.name || '');
    setEditPriceValue(String(item.basePrice || 0));
    setEditUnitValue(item.pricingType || 'piece');
    setEditSubCategoryValue(item.subCategory || '');
    setEditExpressMultiplierValue(String(item.expressMultiplier || 1.5));
    setEditTurnaroundDaysValue(String(item.turnaroundDays || 2));
    setEditImageUri(item.imageUrl || null);
    setShowEditItemModal(true);
  };

  const pickEditImage = async () => {
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

  const pickCustomImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      setCustomImageUri(result.assets[0].uri);
    }
  };

  const saveEditItem = async () => {
    if (!editItem) return;
    const trimmedName = editNameValue.trim();
    const numeric = parseFloat(editPriceValue);
    if (!trimmedName) return alert(t('mobile.enterItemName'));
    if (Number.isNaN(numeric) || numeric < 0) return alert(t('mobile.enterValidPrice'));
    setEditSaving(true);
    try {
      const updateData: Record<string, any> = {
        name: trimmedName,
        basePrice: numeric,
        pricingType: editUnitValue,
        subCategory: editSubCategoryValue.trim(),
        expressMultiplier: parseFloat(editExpressMultiplierValue) || 1.5,
        turnaroundDays: parseInt(editTurnaroundDaysValue, 10) || 2,
        updatedAt: new Date(),
      };

      if (editImageUri && editImageUri !== editItem.imageUrl) {
        if (editItem.imageKey) {
          try { await deleteImageFromR2(editItem.imageKey); } catch (_) {}
        }
        const fileName = `${Date.now()}.jpg`;
        const { key, publicUrl } = await uploadImageToR2(shopId, editImageUri, fileName);
        updateData.imageUrl = publicUrl;
        updateData.imageKey = key;
      }

      await firestore()
        .collection(`shops/${shopId}/inventory`)
        .doc(editItem.id)
        .update(updateData);
      // Clear per-order override so master price reflects immediately.
      setCart((prev) => {
        const current = prev[editItem.id];
        if (!current) return prev;
        return {
          ...prev,
          [editItem.id]: {
            ...current,
            unitPriceOverride: undefined,
          },
        };
      });
      setShowEditItemModal(false);
      setEditItem(null);
    } catch (e: any) {
      alert(e.message || t('mobile.failedUpdateItem'));
    } finally {
      setEditSaving(false);
    }
  };

  const selectMostUsed = (item: InventoryItem) => {
    setSelectedCategoryId(item.categoryId);
    setQty(item.id, (cart[item.id]?.quantity || 0) + 1);
  };


  const handleAddCustomItem = async () => {
    const chosenCategoryId = customCategoryId || selectedCategoryId;
    if (!chosenCategoryId) return alert(t('mobile.selectCategoryFirst'));
    const name = customName.trim();
    const price = parseFloat(customPrice);
    if (!name) return alert(t('mobile.itemNameRequired'));
    if (Number.isNaN(price) || price < 0) return alert(t('mobile.enterValidItemPrice'));
    setCustomSaving(true);
    try {
      const category = categories.find((c) => c.id === chosenCategoryId);
      const existingInCategory = inventory.filter((i) => i.categoryId === chosenCategoryId);
      const maxOrder = existingInCategory.reduce((m, i) => Math.max(m, i.order || 0), 0);
      const payload = {
        name,
        basePrice: price,
        pricingType: customUnit,
        expressMultiplier: parseFloat(customExpressMultiplier) || 1.5,
        turnaroundDays: 2,
        categoryId: chosenCategoryId,
        categoryName: category?.name || t('mobile.customCategoryFallback'),
        isActive: true,
        order: maxOrder + 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Record<string, any>;
      if (customImageUri) {
        const fileName = `${Date.now()}-custom.jpg`;
        const { key, publicUrl } = await uploadImageToR2(shopId, customImageUri, fileName);
        payload.imageUrl = publicUrl;
        payload.imageKey = key;
      }
      const created = await firestore().collection(`shops/${shopId}/inventory`).add(payload);
      setCart((prev) => ({
        ...prev,
        [created.id]: { quantity: 1, express: false, unitPriceOverride: price },
      }));
      setShowCustomModal(false);
      setCustomName('');
      setCustomPrice('');
      setCustomUnit('piece');
      setCustomExpressMultiplier('1.5');
      setCustomImageUri(null);
      setCustomCategoryId(selectedCategoryId);
      setShowCustomCategoryList(false);
    } catch (e: any) {
      alert(e.message || t('mobile.failedAddCustomItem'));
    } finally {
      setCustomSaving(false);
    }
  };

  const handleReviewOrder = () => {
    if (!selectedCustomer) {
      alert(t('mobile.selectOrCreateCustomer'));
      return;
    }
    const selectedItems = Object.entries(cart)
      .filter(([, c]) => c.quantity > 0)
      .map(([itemId, c]) => {
        const item = inventory.find((i) => i.id === itemId);
        if (!item) return null;
        const multiplier = c.express ? (item.expressMultiplier || 1.5) : 1;
        const unitPrice = c.unitPriceOverride ?? (item.basePrice || 0) * multiplier;
        return {
          id: item.id,
          serviceId: item.id,
          serviceName: item.name,
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          quantity: c.quantity,
          unit: pricingTypeToUnit(item.pricingType),
          unitPrice,
          basePrice: item.basePrice || 0,
          total: unitPrice * c.quantity,
          express: c.express,
          expressMultiplier: item.expressMultiplier || 1.5,
          imageUrl: item.imageUrl,
        };
      })
      .filter(Boolean) as DraftOrderPayload['items'];

    if (selectedItems.length === 0) {
      alert(t('mobile.addAtLeastOneItem'));
      return;
    }

    const subtotal = selectedItems.reduce((sum, i) => sum + i.total, 0);
    const expressCharge = selectedItems.reduce(
      (sum, i) => sum + (i.express ? Math.max(0, (i.unitPrice - i.basePrice) * i.quantity) : 0),
      0
    );
    const draft: DraftOrderPayload = {
      customer: {
        id: selectedCustomer.id,
        name: selectedCustomer.name,
        phone: selectedCustomer.phone,
        email: selectedCustomer.email || null,
        address: selectedCustomer.address || null,
        isGuest: false,
      },
      items: selectedItems,
      financials: {
        subtotal,
        discountType: 'flat',
        discountValue: 0,
        discountAmount: 0,
        expressCharge,
        deliveryCharge: 0,
        taxAmount: 0,
        taxRate: 0,
        taxName: 'GST',
        total: subtotal,
        amountPaid: 0,
        balance: subtotal,
      },
    };
    onReviewOrder(draft);
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
              <MaterialIcons name={step === 'customer' ? 'close' : 'arrow-back'} size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{editOrder ? t('mobile.editOrderTitle') : t('mobile.newOrderTitle')}</Text>
          </View>
          <View style={styles.headerRight}>
            {step === 'items' && Object.keys(cart).length > 0 ? (
              <TouchableOpacity style={styles.iconBtn} onPress={() => {
                setCart({});
              }}>
                <MaterialIcons name="refresh" size={24} color={colors.primary} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.iconBtn}>
              <MaterialIcons name="history" size={24} color={colors.primary} />
            </TouchableOpacity>
            <HelpButton pageId="mobile_newOrder" />
          </View>
        </View>
      </View>
      <View style={styles.headerDivider} />

      {step === 'customer' ? (
        <View style={{ flex: 1, padding: 16 }}>
          {/* Add New Customer button */}
          <TouchableOpacity style={styles.addNewCustomerBtn} onPress={onAddCustomer} activeOpacity={0.7}>
            <MaterialIcons name="person-add" size={20} color={colors.primary} />
            <Text style={styles.addNewCustomerBtnText}>{t('mobile.addNewCustomer')}</Text>
          </TouchableOpacity>

          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('mobile.searchCustomerPlaceholder')}
              value={customerModalSearch}
              onChangeText={setCustomerModalSearch}
            />
          </View>
          <ScrollView style={{ marginTop: 10 }}>
            {filteredCustomers.length === 0 ? (
              <View style={styles.searchResultItem}><Text style={styles.resultPhone}>{t('mobile.noCustomersFound')}</Text></View>
            ) : (
              filteredCustomers.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.searchResultItem}
                  onPress={() => {
                    setSelectedCustomer(c);
                    setSearch(`${c.name} • ${c.phone}`);
                    setStep('items');
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName}>{c.name}</Text>
                    <Text style={styles.resultPhone}>{c.phone}{c.address ? ` • ${c.address}` : ''}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.customerEditBtn}
                    onPress={() => onEditCustomerDetail?.(c.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialIcons name="edit" size={16} color={colors.primary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      ) : (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.selectedCustomerCard}>
          <View style={styles.selectedCustomerLeft}>
            <View style={styles.selectedCustomerAvatar}>
              <MaterialIcons name="person" size={18} color={colors.surface} />
            </View>
            <View>
              <Text style={styles.selectedCustomerName}>{selectedCustomer?.name || t('mobile.noCustomerSelected')}</Text>
              <Text style={styles.selectedCustomerPhone}>{selectedCustomer?.phone || ''}</Text>
            </View>
          </View>
          {!editOrder && (
            <TouchableOpacity onPress={() => setStep('customer')}>
              <Text style={styles.selectedCustomerEditBtn}>{t('mobile.editCaps')}</Text>
            </TouchableOpacity>
          )}
          {editOrder && (
            <View style={{ backgroundColor: colors.surfaceMuted, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
              <Text style={{ fontSize: 9, fontFamily: fonts.bold, color: colors.textMuted }}>{t('mobile.locked')}</Text>
            </View>
          )}
        </View>
        {/* Customer Toggle & Input */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('mobile.mostUsedItems')}</Text>
          <TouchableOpacity onPress={() => {}}>
            <Text style={styles.seeAllText}>{t('mobile.seeAll')}</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
          {mostUsedItems.map((item) => (
            <TouchableOpacity key={item.id} style={styles.itemChip} onPress={() => selectMostUsed(item)}>
              <Text style={styles.itemChipText}>{item.name}</Text>
              <Text style={styles.itemChipMeta}>{item.categoryName}</Text>
              <Text style={styles.itemChipPrice}>{formatCurrency(item.basePrice || 0, countrySettings)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Category Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={selectedCategoryId === cat.id ? styles.categoryTabActive : styles.categoryTab}
              onPress={() => setSelectedCategoryId(cat.id)}
            >
              <Text style={selectedCategoryId === cat.id ? styles.categoryTabTextActive : styles.categoryTabText}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Items List */}
        <View style={styles.itemsListContainer}>
          {currentCategoryItems.map((item, idx) => {
            const state = cart[item.id] || { quantity: 0, express: false };
            const multiplier = state.express ? (item.expressMultiplier || 1.5) : 1;
            const unitPrice = state.unitPriceOverride ?? Math.round((item.basePrice || 0) * multiplier);
            const selected = state.quantity > 0;
            return (
              <React.Fragment key={item.id}>
              {idx > 0 && <View style={styles.itemDivider} />}
              <View style={[styles.itemRow, selected && styles.itemRowSelected]}>
                <View style={styles.itemMain}>
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={{ width: 32, height: 32, borderRadius: 6, marginRight: 10 }} />
                  ) : (
                    <View style={styles.itemThumbPlaceholder}>
                      <MaterialIcons name="image" size={14} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.itemInfoCol}>
                    <Text numberOfLines={1} style={selected ? styles.itemName : styles.itemNameUnselected}>{item.name}</Text>
                    <View style={styles.unitRow}>
                      <Text style={styles.itemPriceUnselected}>{formatCurrency(unitPrice, countrySettings)}/{pricingTypeToUnit(item.pricingType)}</Text>
                      <TouchableOpacity onPress={() => openEditItem(item)} style={{ padding: 2 }}>
                        <MaterialIcons name="edit" size={13} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.expressRow}>
                      <Switch
                        value={state.express}
                        onValueChange={() => toggleExpress(item.id)}
                        trackColor={{ false: colors.border, true: colors.primaryTint }}
                        thumbColor={state.express ? colors.primary : colors.background}
                        style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
                      />
                      <Text style={{ fontSize: 10, color: colors.textSecondary }}>{t('mobile.expressLabel')}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.itemActions}>
                  {DECIMAL_UNITS.includes(item.pricingType || '') ? (
                    <View style={styles.weightInputWrap}>
                      <TextInput
                        style={styles.weightInput}
                        keyboardType="decimal-pad"
                        placeholder={`Enter ${pricingTypeToUnit(item.pricingType)}`}
                        value={weightText[item.id] !== undefined ? weightText[item.id] : (state.quantity > 0 ? String(state.quantity) : '')}
                        onChangeText={(val) => setQtyFromText(item.id, val)}
                      />
                    </View>
                  ) : (
                    <View style={selected ? styles.stepperCompact : styles.stepperUnselectedCompact}>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => setQty(item.id, state.quantity - 1)}>
                        <MaterialIcons name="remove" size={18} color={colors.text} />
                      </TouchableOpacity>
                      <Text style={selected ? styles.stepperValue : styles.stepperValueUnselected}>{state.quantity}</Text>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => setQty(item.id, state.quantity + 1)}>
                        <MaterialIcons name="add" size={18} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                  )}
                  <View style={styles.priceColCompact}>
                    <Text style={selected ? styles.itemPriceSelected : styles.itemPriceUnselected}>{formatCurrency(Math.round(unitPrice * (state.quantity || 0)), countrySettings)}</Text>
                  </View>
                </View>
              </View>
              </React.Fragment>
            );
          })}

          {/* Add Custom Item Row */}
          <TouchableOpacity
            style={styles.addCustomItem}
            onPress={() => {
              setCustomExpressMultiplier('1.5');
              setShowCustomModal(true);
            }}
          >
            <MaterialIcons name="add-box" size={20} color={colors.primary} />
            <Text style={styles.addCustomText}>{t('mobile.addCustomItem')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
      )}

      {/* Sticky Bottom Summary Bar */}
      <View style={[styles.bottomSummary, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryTotal}>
            <Text style={styles.summaryCount}>{t('mobile.itemsCount', { count: totals.itemCount })}</Text>
            <Text style={styles.summaryPrice}>{formatCurrency(totals.total, countrySettings)}</Text>
          </View>
          <TouchableOpacity style={styles.reviewBtn} onPress={handleReviewOrder}>
            <Text style={styles.reviewBtnText}>{t('mobile.reviewOrder')}</Text>
            <MaterialIcons name="arrow-forward" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showEditItemModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ justifyContent: 'center' }}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('mobile.editItem')}</Text>
            <TouchableOpacity style={styles.imagePicker} onPress={pickEditImage}>
              {editImageUri ? (
                <View style={styles.editImageWrap}>
                  <Image source={{ uri: editImageUri }} style={styles.imagePreview} />
                  <View style={styles.imageEditIconBadge}>
                    <MaterialIcons name="edit" size={12} color={colors.surface} />
                  </View>
                </View>
              ) : (
                <View style={styles.imagePlaceholder}>
                  <MaterialIcons name="add-photo-alternate" size={28} color={colors.textMuted} />
                </View>
              )}
            </TouchableOpacity>
            <TextInput
              style={styles.modalInput}
              value={editNameValue}
              onChangeText={setEditNameValue}
              placeholder={t('mobile.placeholderItemName')}
            />
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={editPriceValue}
              onChangeText={setEditPriceValue}
              placeholder={t('mobile.placeholderPrice')}
            />
            <Text style={styles.modalLabel}>{t('mobile.pricingTypeLabel')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {getUnitsForCountry(countrySettings.countryCode).units.map((u) => (
                <TouchableOpacity
                  key={u}
                  onPress={() => setEditUnitValue(u)}
                  style={editUnitValue === u ? styles.categoryTabActive : styles.categoryTab}
                >
                  <Text style={editUnitValue === u ? styles.categoryTabTextActive : styles.categoryTabText}>{getUnitLabel(u)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalTwoCols}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>{t('mobile.expressMultiplierLabel')}</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="decimal-pad"
                  value={editExpressMultiplierValue}
                  onChangeText={setEditExpressMultiplierValue}
                  placeholder={t('mobile.placeholderMult')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>{t('mobile.turnaroundDaysLabel')}</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={editTurnaroundDaysValue}
                  onChangeText={setEditTurnaroundDaysValue}
                  placeholder={t('mobile.placeholderDays')}
                />
              </View>
            </View>
            <Text style={styles.modalLabel}>{t('mobile.subCategoryLabel')}</Text>
            <TextInput
              style={styles.modalInput}
              value={editSubCategoryValue}
              onChangeText={setEditSubCategoryValue}
              placeholder={t('mobile.placeholderMensWear')}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowEditItemModal(false)}><Text style={styles.modalCancel}>{t('common.cancel')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveEditItem} disabled={editSaving}>
                {editSaving ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.modalSave}>{t('common.save')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={showCustomModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ justifyContent: 'center' }}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('mobile.addCustomItemTitle')}</Text>
            <TouchableOpacity style={styles.imagePicker} onPress={pickCustomImage}>
              {customImageUri ? (
                <View style={styles.editImageWrap}>
                  <Image source={{ uri: customImageUri }} style={styles.imagePreview} />
                  <View style={styles.imageEditIconBadge}>
                    <MaterialIcons name="edit" size={12} color={colors.surface} />
                  </View>
                </View>
              ) : (
                <View style={styles.imagePlaceholder}>
                  <MaterialIcons name="add-photo-alternate" size={24} color={colors.textMuted} />
                </View>
              )}
            </TouchableOpacity>
            <TextInput style={styles.modalInput} placeholder={t('mobile.placeholderItemName')} value={customName} onChangeText={setCustomName} />
            <TextInput style={styles.modalInput} placeholder={t('mobile.placeholderPrice')} keyboardType="numeric" value={customPrice} onChangeText={setCustomPrice} />
            <TextInput
              style={styles.modalInput}
              placeholder={t('mobile.placeholderExpressMult')}
              keyboardType="decimal-pad"
              value={customExpressMultiplier}
              onChangeText={setCustomExpressMultiplier}
            />
            <Text style={styles.sectionTitle}>{t('mobile.categorySection')}</Text>
            <TouchableOpacity
              style={styles.searchContainer}
              onPress={() => setShowCustomCategoryList((p) => !p)}
              activeOpacity={0.8}
            >
              <Text style={styles.searchInput}>
                {categories.find((c) => c.id === customCategoryId)?.name || t('mobile.selectCategory')}
              </Text>
              <MaterialIcons name={showCustomCategoryList ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={20} color={colors.textMuted} />
            </TouchableOpacity>
            {showCustomCategoryList ? (
              <ScrollView style={{ maxHeight: 160 }}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={styles.searchResultItem}
                    onPress={() => {
                      setCustomCategoryId(cat.id);
                      setShowCustomCategoryList(false);
                    }}
                  >
                    <Text style={styles.resultName}>{cat.name}</Text>
                    {customCategoryId === cat.id ? <MaterialIcons name="check" size={16} color={colors.primary} /> : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {getUnitsForCountry(countrySettings.countryCode).units.map((u) => (
                <TouchableOpacity
                  key={u}
                  onPress={() => setCustomUnit(u)}
                  style={customUnit === u ? styles.categoryTabActive : styles.categoryTab}
                >
                  <Text style={customUnit === u ? styles.categoryTabTextActive : styles.categoryTabText}>{getUnitLabel(u)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowCustomModal(false)}><Text style={styles.modalCancel}>{t('common.cancel')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleAddCustomItem} disabled={customSaving}>
                {customSaving ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.modalSave}>{t('common.add')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
});

export default CreateOrderScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    backgroundColor: colors.surface,
  },
  headerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    padding: 8,
  },
  headerDivider: {
    height: 1,
    backgroundColor: colors.surfaceMuted,
  },
  scrollContent: {
    paddingTop: 0,
  },
  customerSection: {
    padding: 16,
    backgroundColor: colors.surface,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  selectedCustomerCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: colors.primary,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedCustomerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectedCustomerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(216, 226, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCustomerName: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.surface,
  },
  selectedCustomerPhone: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.primaryTint,
    marginTop: 1,
  },
  selectedCustomerEditBtn: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.primaryTint,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  searchIcon: {
    marginRight: 8,
  },
  clearIcon: {
    marginLeft: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  searchResults: {
    marginTop: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#d8e2ff33',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resultName: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  resultPhone: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  customerEditBtn: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  addNewCustomerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primaryTint, borderRadius: radii.input, paddingVertical: 12, paddingHorizontal: 14,
    marginBottom: 12, borderWidth: 1, borderColor: colors.primaryTint, borderStyle: 'dashed',
  },
  addNewCustomerBtnText: { fontSize: 14, fontFamily: fonts.bold, color: colors.primary },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  seeAllText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  horizontalScroll: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 20,
  },
  itemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.chip,
    ...shadows.card, ...shadows.cardBorder,
  },
  itemChipText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  itemChipMeta: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: 2,
  },
  itemChipPrice: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  categoryTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: radii.chip,
    backgroundColor: colors.border,
  },
  categoryTabActive: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: radii.chip,
    backgroundColor: colors.primary,
    elevation: 2,
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  categoryTabText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
  },
  categoryTabTextActive: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.surface,
  },
  itemsListContainer: {
    backgroundColor: colors.surface,
  },
  itemDivider: {
    height: 1,
    backgroundColor: 'rgba(195, 198, 214, 0.15)',
    marginHorizontal: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 72,
    paddingVertical: 10,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  itemMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  itemThumbPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  itemInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  expressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  itemRowSelected: {
    backgroundColor: 'rgba(0, 64, 143, 0.05)',
    borderLeftColor: colors.primary,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  itemNameUnselected: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.border,
    borderRadius: 8,
    height: 32,
    overflow: 'hidden',
  },
  stepperUnselected: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.border,
    borderRadius: 8,
    height: 32,
    overflow: 'hidden',
  },
  stepperCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.border,
    borderRadius: 8,
    height: 34,
    width: 104,
    overflow: 'hidden',
  },
  stepperUnselectedCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.border,
    borderRadius: 8,
    height: 34,
    width: 104,
    overflow: 'hidden',
  },
  stepperBtn: {
    height: '100%',
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    width: 32,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  stepperValueUnselected: {
    width: 32,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  priceCol: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 64,
    gap: 4,
  },
  priceColCompact: {
    width: 52,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  weightInputWrap: {
    width: 104,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  weightInput: {
    fontSize: 13,
    color: colors.text,
    fontFamily: fonts.semibold,
    paddingVertical: 0,
  },
  itemPriceSelected: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  itemPriceUnselected: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  addCustomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 16,
    gap: 8,
  },
  addCustomText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 16,
    gap: 12,
  },
  modalCardLarge: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 16,
    gap: 12,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  modalLabel: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  modalInput: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    alignItems: 'center',
  },
  modalTwoCols: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancel: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: fonts.semibold,
  },
  modalSave: {
    fontSize: 14,
    color: colors.primary,
    fontFamily: fonts.bold,
  },
  imagePicker: { alignItems: 'center', marginVertical: 4 },
  imagePreview: { width: 80, height: 80, borderRadius: radii.button, backgroundColor: colors.surfaceMuted },
  editImageWrap: {
    width: 80,
    height: 80,
  },
  imageEditIconBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  imagePlaceholder: {
    width: 80, height: 80, borderRadius: radii.button, backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
    borderColor: colors.border, borderStyle: 'dashed',
  },
  bottomSummary: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'transparent',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
  },
  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 8,
    height: 64,
    elevation: 8,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  summaryTotal: {
    flexDirection: 'column',
  },
  summaryCount: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: 'rgba(216, 226, 255, 0.6)',
    letterSpacing: 1,
    marginBottom: 2,
  },
  summaryPrice: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.surface,
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    height: 44,
    borderRadius: radii.button,
  },
  reviewBtnText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
});
