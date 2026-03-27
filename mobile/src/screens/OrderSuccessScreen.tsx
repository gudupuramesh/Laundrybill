import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShopCountrySettings } from '../lib/use-shop-country-settings';
import { formatCurrency } from '../lib/currency-format';

interface PlacedOrder {
  id: string;
  publicId: string;
  orderNumber: string;
  customer: { id: string | null; name: string; phone: string; email?: string | null; address?: string | null; isGuest: boolean };
  items: Array<{ id: string; serviceName: string; categoryName: string; quantity: number; unitPrice: number; total: number; express: boolean }>;
  financials: {
    subtotal: number; discountAmount: number; taxAmount: number; taxRate: number; taxName: string;
    expressCharge: number; deliveryCharge: number; total: number; amountPaid: number; balance: number;
  };
  deliveryType: string;
  paymentStatus: string;
  expectedDelivery: Date;
  createdAt: Date;
  notes: string;
}

export default function OrderSuccessScreen({
  order,
  shopName,
  onViewOrder,
  onDone,
}: {
  order: PlacedOrder;
  shopName?: string;
  onViewOrder: () => void;
  onDone: () => void;
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const countrySettings = useShopCountrySettings();
  const withCurrencySymbol = (text: string) => text.replace(/₹/g, countrySettings.currencySymbol || '₹');

  const formatDate = (d: Date) =>
    d.toLocaleDateString(i18n.language || 'en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  const formatDateTime = (d: Date) =>
    d.toLocaleString(i18n.language || 'en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });

  const handleShareWhatsApp = () => {
    const phone = order.customer.phone.replace(/\D/g, '');
    if (!phone || phone.length < 10) {
      Alert.alert(t('mobile.noPhoneTitle'), t('mobile.noPhoneWhatsapp'));
      return;
    }
    const fullPhone = phone.startsWith('91') ? phone : `91${phone}`;
    const dt = order.deliveryType || 'pickup_store';
    const deliveryLabel =
      dt === 'pickup_store' ? t('mobile.delivery_pickup_store')
        : dt === 'delivery_home' ? t('mobile.delivery_delivery_home')
          : dt === 'pickup_home' ? t('mobile.delivery_pickup_home')
            : dt;
    const readyLabel = order.deliveryType === 'pickup_store' ? t('mobile.readyForPickupLabel') : t('mobile.expectedDeliveryLabel');

    const lines = [
      t('mobile.waOrderConfirmed', { shop: shopName || 'LaundryBoss' }),
      ``,
      t('mobile.waOrderId', { id: order.publicId }),
      t('mobile.waDate', { date: formatDateTime(order.createdAt) }),
      t('mobile.waType', { type: deliveryLabel }),
      ``,
      t('mobile.waItems'),
      ...order.items.map(i => `- ${i.serviceName} (${i.categoryName}) x${i.quantity}`),
      ``,
      t('mobile.waPayment'),
      withCurrencySymbol(t('mobile.waTotal', { amount: order.financials.total }) as string),
      order.paymentStatus === 'paid' ? t('mobile.waPaidFull') : withCurrencySymbol(t('mobile.waBalanceDue', { amount: order.financials.balance }) as string),
      ``,
      `*${readyLabel}:*`,
      formatDate(order.expectedDelivery),
      ``,
      t('mobile.waQuestions'),
    ];

    const message = lines.join('\n');
    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => Alert.alert(t('mobile.errorTitle'), t('mobile.couldNotOpenWhatsapp')));
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Icon */}
        <View style={styles.successIcon}>
          <MaterialIcons name="check" size={48} color="#ffffff" />
        </View>
        <Text style={styles.successTitle}>{t('mobile.orderPlacedTitle')}</Text>
        <Text style={styles.successSubtitle}>{t('mobile.orderCreatedSubtitle')}</Text>

        {/* Order ID Card */}
        <View style={styles.orderIdCard}>
          <Text style={styles.orderIdLabel}>{t('mobile.orderIdLabel')}</Text>
          <Text style={styles.orderIdValue}>#{order.publicId}</Text>
          <Text style={styles.orderIdDate}>{formatDateTime(order.createdAt)}</Text>
        </View>

        {/* Summary Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('mobile.orderSummaryTitle')}</Text>

          {/* Items */}
          {order.items.map((item, i) => (
            <View key={item.id || i} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.serviceName}</Text>
                <Text style={styles.itemMeta}>{item.categoryName} · x{item.quantity}</Text>
              </View>
              <Text style={styles.itemPrice}>{formatCurrency(Math.round(item.total), countrySettings)}</Text>
            </View>
          ))}

          <View style={styles.divider} />

          {/* Financials */}
          <View style={styles.finRow}>
            <Text style={styles.finLabel}>{t('mobile.subtotalLabel')}</Text>
            <Text style={styles.finValue}>{formatCurrency(order.financials.subtotal, countrySettings)}</Text>
          </View>
          {order.financials.discountAmount > 0 ? (
            <View style={styles.finRow}>
              <Text style={styles.finLabel}>{t('mobile.discountLabel')}</Text>
              <Text style={[styles.finValue, { color: '#006b5f' }]}>-{formatCurrency(order.financials.discountAmount, countrySettings)}</Text>
            </View>
          ) : null}
          {order.financials.taxAmount > 0 ? (
            <View style={styles.finRow}>
              <Text style={styles.finLabel}>{order.financials.taxName || t('mobile.taxFallback')} ({order.financials.taxRate}%)</Text>
              <Text style={styles.finValue}>+{formatCurrency(order.financials.taxAmount, countrySettings)}</Text>
            </View>
          ) : null}

          <View style={styles.divider} />

          <View style={styles.finRow}>
            <Text style={styles.totalLabel}>{t('mobile.totalLabel')}</Text>
            <Text style={styles.totalValue}>{formatCurrency(order.financials.total, countrySettings)}</Text>
          </View>

          {/* Payment Status */}
          <View style={[styles.paymentBadge, order.paymentStatus === 'paid' ? styles.paidBadge : styles.unpaidBadge]}>
            <MaterialIcons
              name={order.paymentStatus === 'paid' ? 'check-circle' : 'schedule'}
              size={16}
              color={order.paymentStatus === 'paid' ? '#006b5f' : '#93000a'}
            />
            <Text style={order.paymentStatus === 'paid' ? styles.paidText : styles.unpaidText}>
              {order.paymentStatus === 'paid' ? t('mobile.paidInFull') : t('mobile.unpaidBalance', { amount: order.financials.balance })}
            </Text>
          </View>
        </View>

        {/* Expected Delivery */}
        <View style={styles.deliveryCard}>
          <MaterialIcons name="event" size={22} color="#00408f" />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.deliveryLabel}>
              {order.deliveryType === 'pickup_store' ? t('mobile.expectedReadyUpper') : t('mobile.expectedDeliveryUpper')}
            </Text>
            <Text style={styles.deliveryDate}>{formatDate(order.expectedDelivery)}</Text>
          </View>
          <View style={styles.deliveryTypeBadge}>
            <MaterialIcons
              name={order.deliveryType === 'pickup_store' ? 'store' : 'delivery-dining'}
              size={14}
              color="#00408f"
            />
            <Text style={styles.deliveryTypeText}>
              {order.deliveryType === 'pickup_store' ? t('mobile.delivery_pickup_store')
                : order.deliveryType === 'delivery_home' ? t('mobile.delivery_delivery_home')
                  : order.deliveryType === 'pickup_home' ? t('mobile.delivery_pickup_home')
                    : t('mobile.pickupFallback')}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.whatsappBtn} onPress={handleShareWhatsApp}>
            <MaterialIcons name="chat" size={22} color="#ffffff" />
            <Text style={styles.whatsappBtnText}>{t('mobile.shareWhatsapp')}</Text>
          </TouchableOpacity>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={onViewOrder}>
              <MaterialIcons name="receipt-long" size={22} color="#00408f" />
              <Text style={styles.actionBtnText}>{t('mobile.viewOrderBtn')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={onDone}>
              <MaterialIcons name="home" size={22} color="#00408f" />
              <Text style={styles.actionBtnText}>{t('mobile.goHomeBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fb' },
  scrollContent: { paddingHorizontal: 20, alignItems: 'center' },
  successIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#006b5f',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#191c1e', marginBottom: 4 },
  successSubtitle: { fontSize: 14, color: '#434654', marginBottom: 24 },
  orderIdCard: {
    backgroundColor: '#00408f', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 16,
    alignItems: 'center', width: '100%', marginBottom: 16,
  },
  orderIdLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(216,226,255,0.6)', letterSpacing: 1 },
  orderIdValue: { fontSize: 24, fontWeight: '800', color: '#ffffff', marginTop: 4 },
  orderIdDate: { fontSize: 12, color: '#d8e2ff', marginTop: 4 },
  card: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 16, width: '100%', marginBottom: 12,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#191c1e', marginBottom: 12 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#191c1e' },
  itemMeta: { fontSize: 11, color: '#434654', marginTop: 1 },
  itemPrice: { fontSize: 14, fontWeight: '700', color: '#191c1e' },
  divider: { height: 1, backgroundColor: '#edeef0', marginVertical: 10 },
  finRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  finLabel: { fontSize: 13, color: '#434654' },
  finValue: { fontSize: 13, fontWeight: '600', color: '#191c1e' },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#191c1e' },
  totalValue: { fontSize: 16, fontWeight: '800', color: '#00408f' },
  paymentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  paidBadge: { backgroundColor: '#e6f7f2' },
  unpaidBadge: { backgroundColor: '#ffdad6' },
  paidText: { fontSize: 12, fontWeight: '700', color: '#006b5f' },
  unpaidText: { fontSize: 12, fontWeight: '700', color: '#93000a' },
  deliveryCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#d8e2ff',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, width: '100%', marginBottom: 20,
  },
  deliveryLabel: { fontSize: 10, fontWeight: '700', color: '#00408f', letterSpacing: 0.5 },
  deliveryDate: { fontSize: 15, fontWeight: '700', color: '#00408f', marginTop: 2 },
  deliveryTypeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,64,143,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  deliveryTypeText: { fontSize: 10, fontWeight: '700', color: '#00408f' },
  actionsContainer: { width: '100%', gap: 12 },
  whatsappBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#25D366', height: 52, borderRadius: 12,
    elevation: 2, shadowColor: '#25D366', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  whatsappBtnText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  actionRow: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#ffffff', height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#d8e2ff',
  },
  actionBtnText: { fontSize: 14, fontWeight: '600', color: '#00408f' },
});
