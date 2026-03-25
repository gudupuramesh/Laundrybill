import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DraftOrderPayload } from '../types/orderDraft';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';

// Same logic as web: first 2 letters of shop name + 2 random chars
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateShopCode(shopName: string): string {
  const clean = (shopName || 'SH').toUpperCase().replace(/[^A-Z]/g, '');
  const prefix = clean.length >= 2 ? clean.slice(0, 2) : clean.padEnd(2, 'X');
  const s1 = CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  const s2 = CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  return prefix + s1 + s2;
}

function formatOrderId(shopCode: string, orderNumber: number): string {
  return `${shopCode}-${orderNumber.toString().padStart(5, '0')}`;
}

interface PlacedOrder {
  id: string;
  publicId: string;
  orderNumber: string;
  customer: DraftOrderPayload['customer'];
  items: DraftOrderPayload['items'];
  financials: DraftOrderPayload['financials'];
  deliveryType: string;
  paymentStatus: string;
  expectedDelivery: Date;
  createdAt: Date;
  notes: string;
}

export default function OrderReviewScreen({
  onBack,
  onPlaceOrder,
  onEditCustomer,
  draftOrder,
  editOrderId,
}: {
  onBack: () => void,
  onPlaceOrder: (order: PlacedOrder) => void,
  onEditCustomer?: () => void,
  draftOrder: DraftOrderPayload | null,
  editOrderId?: string | null
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const shopId = getShopId();

  // Shop tax settings
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(0);
  const [taxName, setTaxName] = useState('GST');
  const [shopName, setShopName] = useState('');
  const [shopPhone, setShopPhone] = useState('');

  // User inputs
  const [discountText, setDiscountText] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryType, setDeliveryType] = useState<'pickup_store' | 'delivery_home'>('pickup_store');
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'paid'>('unpaid');
  const [placing, setPlacing] = useState(false);

  // Fetch shop settings for tax
  useEffect(() => {
    if (!shopId) return;
    const unsub = firestore()
      .collection('shops')
      .doc(shopId)
      .onSnapshot(
        (snap: any) => {
          if (!snap.exists) return;
          const data = snap.data();
          const tax = data?.settings?.tax;
          if (tax) {
            setTaxEnabled(!!tax.enabled);
            setTaxRate(tax.rate || 0);
            setTaxName(tax.name || 'GST');
          }
          setShopName(data?.name || '');
          setShopPhone(data?.phone || '');
        },
        () => {}
      );
    return unsub;
  }, [shopId]);

  const categoryGroups = useMemo(() => {
    const map: Record<string, { name: string; subtotal: number; items: DraftOrderPayload['items'] }> = {};
    (draftOrder?.items || []).forEach((item) => {
      const key = item.categoryId || 'other';
      if (!map[key]) map[key] = { name: item.categoryName || t('mobile.categoryOther'), subtotal: 0, items: [] };
      map[key].items.push(item);
      map[key].subtotal += item.total;
    });
    return Object.values(map);
  }, [draftOrder, t]);

  // Calculate financials with discount and tax
  const computed = useMemo(() => {
    if (!draftOrder) return { subtotal: 0, discountAmount: 0, taxAmount: 0, total: 0, expressCharge: 0 };
    const subtotal = draftOrder.financials.subtotal;
    const expressCharge = draftOrder.financials.expressCharge;

    // Parse discount
    const discountVal = parseFloat(discountText) || 0;
    // If ends with %, treat as percentage, otherwise flat
    const isPercent = discountText.trim().endsWith('%');
    const discountAmount = isPercent
      ? Math.round(subtotal * (discountVal / 100))
      : Math.round(discountVal);

    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const taxAmount = taxEnabled ? Math.round(afterDiscount * (taxRate / 100)) : 0;
    const total = afterDiscount + taxAmount;

    return { subtotal, discountAmount, taxAmount, total, expressCharge };
  }, [draftOrder, discountText, taxEnabled, taxRate]);

  // Expected delivery: today + max turnaround days (editable)
  const [expectedDelivery, setExpectedDelivery] = useState<Date>(() => {
    if (!draftOrder) return new Date();
    let maxDays = 2;
    draftOrder.items.forEach((item: any) => {
      const days = item.turnaroundDays || 2;
      if (days > maxDays) maxDays = days;
    });
    const date = new Date();
    date.setDate(date.getDate() + maxDays);
    return date;
  });

  const handlePlaceOrder = async () => {
    if (!draftOrder || !shopId) {
      Alert.alert(t('mobile.errorTitle'), t('mobile.missingOrderData'));
      return;
    }
    setPlacing(true);
    try {
      // Get shop doc for shopCode and nextOrderNumber (skip for edits)
      let orderNumber = '';
      const shopDoc = await firestore().collection('shops').doc(shopId).get();
      if (!shopDoc.exists) throw new Error('Shop not found');
      const shopData = shopDoc.data() || {};

      if (!editOrderId) {
        const settings = shopData.settings || {};
        let shopCode = shopData.shopCode;
        const nextOrderNumber = settings.nextOrderNumber || 1;

        if (!shopCode) {
          shopCode = generateShopCode(shopData.name || 'Shop');
          await firestore().collection('shops').doc(shopId).update({ shopCode });
        }

        orderNumber = formatOrderId(shopCode, nextOrderNumber);

        await firestore().collection('shops').doc(shopId).update({
          'settings.nextOrderNumber': nextOrderNumber + 1,
        });
      }

      // Build financials
      const discountVal = parseFloat(discountText) || 0;
      const isPercent = discountText.trim().endsWith('%');
      const financials = {
        subtotal: computed.subtotal,
        discountType: (isPercent ? 'percent' : 'flat') as 'flat' | 'percent',
        discountValue: discountVal,
        discountAmount: computed.discountAmount,
        expressCharge: computed.expressCharge,
        deliveryCharge: 0,
        taxAmount: computed.taxAmount,
        taxRate: taxEnabled ? taxRate : 0,
        taxName: taxName,
        total: computed.total,
        amountPaid: paymentStatus === 'paid' ? computed.total : 0,
        balance: paymentStatus === 'paid' ? 0 : computed.total,
      };

      // Convert expectedDelivery to a plain date to avoid Firestore serialization issues
      const deliveryDate = new Date(expectedDelivery.getTime());

      const orderData: Record<string, any> = {
        orderNumber,
        publicId: orderNumber,
        customerId: draftOrder.customer.id || null,
        customerName: draftOrder.customer.name || 'Guest',
        customerPhone: draftOrder.customer.phone || '',
        isGuest: draftOrder.customer.isGuest || false,
        items: draftOrder.items.map((item, idx) => ({
          id: item.id || `i-${Date.now()}-${idx}`,
          serviceId: item.serviceId || '',
          serviceName: item.serviceName || '',
          categoryName: item.categoryName || '',
          categoryId: item.categoryId || '',
          quantity: item.quantity || 1,
          unit: item.unit || 'piece',
          unitPrice: item.unitPrice || 0,
          total: item.total || 0,
          express: item.express ?? false,
          notes: null,
          damages: null,
        })),
        financials,
        status: 'pending',
        paymentMethod: 'cash',
        paymentStatus: paymentStatus,
        deliveryType,
        deliveryAddress: null,
        deliveryNotes: notes.trim() || null,
        expectedDelivery: deliveryDate,
        staffId: 'mobile',
        staffName: 'Mobile App',
        orderSource: 'pos',
        shopId,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeline: [{
          id: `t-${Date.now()}`,
          status: 'pending',
          timestamp: new Date(),
          staffId: 'mobile',
          staffName: 'Mobile App',
          notifiedCustomer: false,
        }],
      };

      if (editOrderId) {
        // UPDATE existing order
        const orderRef = firestore().collection(`shops/${shopId}/orders`).doc(editOrderId);
        const existingDoc = await orderRef.get();
        const existingData = existingDoc.data() || {};

        await orderRef.update({
          items: orderData.items,
          financials,
          deliveryType,
          deliveryNotes: notes.trim() || null,
          expectedDelivery: deliveryDate,
          paymentStatus,
          updatedAt: new Date(),
          timeline: [...(existingData.timeline || []), {
            id: `t-${Date.now()}`,
            status: existingData.status || 'pending',
            timestamp: new Date(),
            staffId: 'mobile',
            staffName: 'Mobile App',
            note: 'Order items edited',
            notifiedCustomer: false,
          }],
        });

        try {
          onPlaceOrder({
            id: editOrderId,
            publicId: existingData.publicId || existingData.orderNumber || '',
            orderNumber: existingData.orderNumber || '',
            customer: draftOrder.customer,
            items: draftOrder.items,
            financials: { ...draftOrder.financials, ...financials },
            deliveryType,
            paymentStatus,
            expectedDelivery: deliveryDate,
            createdAt: existingData.createdAt ? (existingData.createdAt.toDate ? existingData.createdAt.toDate() : new Date(existingData.createdAt)) : new Date(),
            notes: notes.trim(),
          });
        } catch (cbErr) {
          console.error('onPlaceOrder callback error:', cbErr);
        }
      } else {
        // CREATE new order
        const created = await firestore().collection(`shops/${shopId}/orders`).add(orderData);

        // Update customer stats
        if (draftOrder.customer.id) {
          try {
            const custRef = firestore().collection(`shops/${shopId}/customers`).doc(draftOrder.customer.id);
            const custDoc = await custRef.get();
            if (custDoc.exists) {
              const custData = custDoc.data() || {};
              await custRef.update({
                totalOrders: (custData.totalOrders || 0) + 1,
                totalSpent: (custData.totalSpent || 0) + computed.total,
                lastOrderAt: new Date(),
                updatedAt: new Date(),
              });
            }
          } catch (custErr) {
            console.error('Customer stats update error (non-fatal):', custErr);
          }
        }

        try {
          onPlaceOrder({
            id: created.id,
            publicId: orderNumber,
            orderNumber,
            customer: draftOrder.customer,
            items: draftOrder.items,
            financials: { ...draftOrder.financials, ...financials },
            deliveryType,
            paymentStatus,
            expectedDelivery: deliveryDate,
            createdAt: new Date(),
            notes: notes.trim(),
          });
        } catch (cbErr) {
          console.error('onPlaceOrder callback error:', cbErr);
        }
      }
    } catch (e: any) {
      console.error('Place order error:', e);
      Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedPlaceOrder'));
    } finally {
      setPlacing(false);
    }
  };

  if (!draftOrder) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }]}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#191c1e', marginBottom: 12 }}>{t('mobile.noDraftOrder')}</Text>
        <TouchableOpacity style={styles.placeOrderBtn} onPress={onBack}>
          <Text style={styles.placeOrderText}>{t('mobile.backToCreateOrder')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const formatDate = (d: Date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  return (
    <View style={styles.container}>
      {/* TopAppBar */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerInner}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
              <MaterialIcons name="arrow-back" size={24} color="#00408f" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{editOrderId ? t('mobile.updateOrderTitle') : t('mobile.orderReviewTitle')}</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn}>
            <MaterialIcons name="more-vert" size={24} color="#00408f" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Customer Info Card */}
        <View style={styles.customerCard}>
          <View style={styles.customerLeft}>
            <View style={styles.customerAvatar}>
              <MaterialIcons name="person" size={24} color="#00408f" />
            </View>
            <View>
              <Text style={styles.customerName}>{draftOrder.customer.name}</Text>
              <Text style={styles.customerPhone}>{draftOrder.customer.phone}</Text>
            </View>
          </View>
          {!editOrderId && (
            <TouchableOpacity onPress={onEditCustomer}>
              <Text style={styles.editBtnText}>{t('mobile.editCaps')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Service Groups */}
        <View style={styles.servicesContainer}>
          {categoryGroups.map((group, groupIndex) => (
            <View key={`${group.name}-${groupIndex}`} style={styles.serviceSection}>
              <View style={groupIndex % 2 === 0 ? styles.serviceHeaderWash : styles.serviceHeaderIron}>
                <View style={styles.serviceHeaderLeft}>
                  <MaterialIcons
                    name={groupIndex % 2 === 0 ? 'local-laundry-service' : 'iron'}
                    size={20}
                    color={groupIndex % 2 === 0 ? '#00408f' : '#5e3c00'}
                  />
                  <Text style={groupIndex % 2 === 0 ? styles.serviceTitleWash : styles.serviceTitleIron}>
                    {group.name.toUpperCase()}
                  </Text>
                </View>
                <Text style={groupIndex % 2 === 0 ? styles.serviceSubtotalWash : styles.serviceSubtotalIron}>
                  {t('mobile.subtotalLine', { amount: Math.round(group.subtotal) })}
                </Text>
              </View>
              <View style={styles.serviceItems}>
                {group.items.map((item, index) => (
                  <View key={item.id}>
                    <View style={styles.serviceItem}>
                      <View>
                        <Text style={styles.itemName}>{item.serviceName}</Text>
                        <Text style={styles.itemMeta}>
                          {`x${item.quantity} · ₹${Math.round(item.unitPrice)} ea.`}
                          {item.express ? t('mobile.expressSuffixShort') : ''}
                        </Text>
                      </View>
                      <Text style={styles.itemTotal}>₹{Math.round(item.total)}</Text>
                    </View>
                    {index !== group.items.length - 1 ? <View style={styles.separator} /> : null}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Tax, Discount & Notes */}
        <View style={styles.summaryCard}>
          {/* Subtotal */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('mobile.subtotalLabel')}</Text>
            <Text style={styles.summaryValue}>₹{computed.subtotal}</Text>
          </View>

          {/* Discount */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryRowLabel}>
              <MaterialIcons name="local-offer" size={18} color="#006b5f" />
              <Text style={styles.discountLabel}>{t('mobile.discountLabel')}</Text>
            </View>
            <TextInput
              style={styles.discountInput}
              placeholder={t('mobile.discountPlaceholder')}
              placeholderTextColor="#c3c6d6"
              textAlign="right"
              value={discountText}
              onChangeText={setDiscountText}
              keyboardType="default"
            />
          </View>
          {computed.discountAmount > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelSmall}>{t('mobile.discountApplied')}</Text>
              <Text style={styles.discountApplied}>-₹{computed.discountAmount}</Text>
            </View>
          ) : null}

          {/* Tax */}
          {taxEnabled ? (
            <View style={styles.summaryRow}>
              <View style={styles.summaryRowLabel}>
                <MaterialIcons name="receipt" size={18} color="#434654" />
                <Text style={styles.summaryLabel}>{taxName} ({taxRate}%)</Text>
              </View>
              <Text style={styles.summaryValue}>+₹{computed.taxAmount}</Text>
            </View>
          ) : null}

          {/* Notes */}
          <View style={styles.notesContainer}>
            <MaterialIcons name="sticky-note-2" size={20} color="#434654" />
            <TextInput
              style={styles.notesInput}
              placeholder={t('mobile.addNotePlaceholder')}
              placeholderTextColor="rgba(67, 70, 84, 0.5)"
              value={notes}
              onChangeText={setNotes}
            />
          </View>
        </View>

        {/* Grand Total */}
        <View style={styles.finalTotalContainer}>
          <View>
            <Text style={styles.grandTotalLabel}>{t('mobile.grandTotalLabel')}</Text>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalValue}>₹{computed.total}</Text>
              {taxEnabled ? <Text style={styles.taxLabel}>{t('mobile.inclTax', { tax: taxName })}</Text> : null}
            </View>
          </View>
          {computed.expressCharge > 0 ? (
            <View style={styles.expressBadge}>
              <MaterialIcons name="bolt" size={14} color="#006f63" />
              <Text style={styles.expressText}>{t('mobile.expressLabel')}</Text>
            </View>
          ) : null}
        </View>

        {/* Expected Delivery — editable */}
        <View style={styles.deliveryDateCard}>
          <MaterialIcons name="event" size={20} color="#00408f" />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.deliveryDateLabel}>{deliveryType === 'pickup_store' ? t('mobile.expectedReadyUpper') : t('mobile.expectedDeliveryUpper')}</Text>
            <Text style={styles.deliveryDateValue}>{formatDate(expectedDelivery)}</Text>
          </View>
          <View style={styles.dateAdjustRow}>
            <TouchableOpacity
              style={styles.dateAdjustBtn}
              onPress={() => {
                const d = new Date(expectedDelivery);
                d.setDate(d.getDate() - 1);
                // Don't allow past dates
                if (d >= new Date(new Date().toDateString())) setExpectedDelivery(d);
              }}
            >
              <MaterialIcons name="remove" size={18} color="#00408f" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dateAdjustBtn}
              onPress={() => {
                const d = new Date(expectedDelivery);
                d.setDate(d.getDate() + 1);
                setExpectedDelivery(d);
              }}
            >
              <MaterialIcons name="add" size={18} color="#00408f" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Delivery & Payment */}
        <View style={styles.summaryCard}>
          <View style={styles.toggleGroup}>
            <Text style={styles.toggleLabel}>{t('mobile.deliveryTypeLabel')}</Text>
            <View style={styles.segmentControl}>
              <TouchableOpacity
                style={deliveryType === 'pickup_store' ? styles.segmentActive : styles.segmentInactive}
                onPress={() => setDeliveryType('pickup_store')}
              >
                <Text style={deliveryType === 'pickup_store' ? styles.segmentTextActive : styles.segmentTextInactive}>{t('mobile.delivery_pickup_store')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={deliveryType === 'delivery_home' ? styles.segmentActive : styles.segmentInactive}
                onPress={() => setDeliveryType('delivery_home')}
              >
                <Text style={deliveryType === 'delivery_home' ? styles.segmentTextActive : styles.segmentTextInactive}>{t('mobile.delivery_delivery_home')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.toggleGroup}>
            <Text style={styles.toggleLabel}>{t('mobile.paymentStatusLabel')}</Text>
            <View style={styles.segmentControl}>
              <TouchableOpacity
                style={paymentStatus === 'unpaid' ? styles.segmentError : styles.segmentInactive}
                onPress={() => setPaymentStatus('unpaid')}
              >
                <Text style={paymentStatus === 'unpaid' ? styles.segmentTextError : styles.segmentTextInactive}>{t('mobile.unpaidLabel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={paymentStatus === 'paid' ? styles.segmentActive : styles.segmentInactive}
                onPress={() => setPaymentStatus('paid')}
              >
                <Text style={paymentStatus === 'paid' ? styles.segmentTextActive : styles.segmentTextInactive}>{t('mobile.paidLabel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Fixed Bottom Action */}
      <View style={[styles.bottomAction, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.placeOrderBtn, placing && { opacity: 0.6 }]}
          activeOpacity={0.8}
          onPress={handlePlaceOrder}
          disabled={placing}
        >
          {placing ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Text style={styles.placeOrderText}>{editOrderId ? t('mobile.updateOrderTitle') : t('mobile.placeOrderBtn')}</Text>
              <MaterialIcons name="chevron-right" size={24} color="#ffffff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fb' },
  header: { backgroundColor: '#f8f9fb', zIndex: 10 },
  headerInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 56, paddingHorizontal: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#00408f' },
  iconBtn: { padding: 8 },
  scrollContent: { padding: 16, gap: 12 },
  customerCard: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  customerLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  customerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#d8e2ff', alignItems: 'center', justifyContent: 'center' },
  customerName: { fontSize: 16, fontWeight: '700', color: '#191c1e', marginBottom: 2 },
  customerPhone: { fontSize: 12, fontWeight: '500', color: '#434654' },
  editBtnText: { fontSize: 12, fontWeight: '700', color: '#00408f', paddingHorizontal: 12, paddingVertical: 4 },
  servicesContainer: { gap: 12 },
  serviceSection: { backgroundColor: '#f3f4f6', borderRadius: 12, overflow: 'hidden' },
  serviceHeaderWash: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(0, 64, 143, 0.05)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(195, 198, 214, 0.1)',
  },
  serviceHeaderIron: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(125, 82, 0, 0.1)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(195, 198, 214, 0.1)',
  },
  serviceHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  serviceTitleWash: { fontSize: 10, fontWeight: '700', color: '#00408f', letterSpacing: 1 },
  serviceSubtotalWash: { fontSize: 10, fontWeight: '700', color: '#00408f' },
  serviceTitleIron: { fontSize: 10, fontWeight: '700', color: '#5e3c00', letterSpacing: 1 },
  serviceSubtotalIron: { fontSize: 10, fontWeight: '700', color: '#5e3c00' },
  serviceItems: { backgroundColor: '#ffffff' },
  serviceItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  separator: { height: 1, backgroundColor: 'rgba(195, 198, 214, 0.1)' },
  itemName: { fontSize: 14, fontWeight: '600', color: '#191c1e', marginBottom: 2 },
  itemMeta: { fontSize: 11, color: '#434654' },
  itemTotal: { fontSize: 14, fontWeight: '700', color: '#191c1e' },
  summaryCard: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 16, gap: 14,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryRowLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryLabel: { fontSize: 14, fontWeight: '600', color: '#434654' },
  summaryLabelSmall: { fontSize: 12, color: '#737685', marginLeft: 26 },
  summaryValue: { fontSize: 14, fontWeight: '700', color: '#191c1e' },
  discountLabel: { fontSize: 14, fontWeight: '600', color: '#191c1e' },
  discountInput: { fontSize: 14, fontWeight: '700', color: '#006b5f', padding: 0, minWidth: 100 },
  discountApplied: { fontSize: 13, fontWeight: '700', color: '#006b5f' },
  notesContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#edeef0',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, gap: 12,
  },
  notesInput: { flex: 1, fontSize: 14, color: '#191c1e', padding: 0 },
  finalTotalContainer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingTop: 16, paddingBottom: 8, paddingHorizontal: 8,
  },
  grandTotalLabel: { fontSize: 11, fontWeight: '700', color: '#434654', letterSpacing: 0.5 },
  grandTotalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  grandTotalValue: { fontSize: 32, fontWeight: '800', color: '#00408f' },
  taxLabel: { fontSize: 10, fontWeight: '500', color: '#434654' },
  expressBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#76f4e0',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 4,
  },
  expressText: { fontSize: 10, fontWeight: '700', color: '#006f63' },
  deliveryDateCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#d8e2ff',
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12,
  },
  deliveryDateLabel: { fontSize: 10, fontWeight: '700', color: '#00408f', letterSpacing: 0.5 },
  deliveryDateValue: { fontSize: 14, fontWeight: '700', color: '#00408f', marginTop: 2 },
  dateAdjustRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateAdjustBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0, 64, 143, 0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  toggleGroup: { gap: 8 },
  toggleLabel: { fontSize: 10, fontWeight: '700', color: '#434654', letterSpacing: 1, paddingHorizontal: 4 },
  segmentControl: { flexDirection: 'row', backgroundColor: '#edeef0', borderRadius: 12, padding: 4 },
  segmentActive: {
    flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 8,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  segmentInactive: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segmentError: {
    flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: '#ffdad6', borderRadius: 8,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  segmentTextActive: { fontSize: 12, fontWeight: '700', color: '#00408f' },
  segmentTextInactive: { fontSize: 12, fontWeight: '700', color: '#434654' },
  segmentTextError: { fontSize: 12, fontWeight: '700', color: '#93000a' },
  bottomAction: {
    position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)', borderTopWidth: 1, borderTopColor: 'rgba(195, 198, 214, 0.2)',
  },
  placeOrderBtn: {
    height: 56, backgroundColor: '#00408f', borderRadius: 12, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 12,
    elevation: 4, shadowColor: '#00408f', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  placeOrderText: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
});
