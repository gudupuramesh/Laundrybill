import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const DELIVERY_LABELS: Record<string, string> = {
  pickup_store: 'Shop Pickup',
  delivery_home: 'Home Delivery',
  pickup_home: 'Pickup from Home',
};

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
  const insets = useSafeAreaInsets();

  const formatDate = (d: Date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const formatDateTime = (d: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 || 12;
    const mm = m.toString().padStart(2, '0');
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm} ${ampm}`;
  };

  const handleShareWhatsApp = () => {
    const phone = order.customer.phone.replace(/\D/g, '');
    if (!phone || phone.length < 10) {
      Alert.alert('No Phone', 'Customer phone number is required for WhatsApp sharing.');
      return;
    }
    const fullPhone = phone.startsWith('91') ? phone : `91${phone}`;
    const deliveryLabel = DELIVERY_LABELS[order.deliveryType] || order.deliveryType;
    const readyLabel = order.deliveryType === 'pickup_store' ? 'Ready for Pickup' : 'Expected Delivery';

    const lines = [
      `*${shopName || 'LaundryBoss'} - Order Confirmed!*`,
      ``,
      `*Order ID:* #${order.publicId}`,
      `*Date:* ${formatDateTime(order.createdAt)}`,
      `*Type:* ${deliveryLabel}`,
      ``,
      `*Items:*`,
      ...order.items.map(i => `- ${i.serviceName} (${i.categoryName}) x${i.quantity}`),
      ``,
      `*Payment:*`,
      `Total: ₹${order.financials.total}`,
      order.paymentStatus === 'paid' ? `Paid in Full` : `Balance Due: ₹${order.financials.balance}`,
      ``,
      `*${readyLabel}:*`,
      formatDate(order.expectedDelivery),
      ``,
      `Any questions? Reply to this message!`,
    ];

    const message = lines.join('\n');
    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open WhatsApp'));
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
        <Text style={styles.successTitle}>Order Placed!</Text>
        <Text style={styles.successSubtitle}>Order has been created successfully</Text>

        {/* Order ID Card */}
        <View style={styles.orderIdCard}>
          <Text style={styles.orderIdLabel}>ORDER ID</Text>
          <Text style={styles.orderIdValue}>#{order.publicId}</Text>
          <Text style={styles.orderIdDate}>{formatDateTime(order.createdAt)}</Text>
        </View>

        {/* Summary Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Summary</Text>

          {/* Items */}
          {order.items.map((item, i) => (
            <View key={item.id || i} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.serviceName}</Text>
                <Text style={styles.itemMeta}>{item.categoryName} · x{item.quantity}</Text>
              </View>
              <Text style={styles.itemPrice}>₹{Math.round(item.total)}</Text>
            </View>
          ))}

          <View style={styles.divider} />

          {/* Financials */}
          <View style={styles.finRow}>
            <Text style={styles.finLabel}>Subtotal</Text>
            <Text style={styles.finValue}>₹{order.financials.subtotal}</Text>
          </View>
          {order.financials.discountAmount > 0 ? (
            <View style={styles.finRow}>
              <Text style={styles.finLabel}>Discount</Text>
              <Text style={[styles.finValue, { color: '#006b5f' }]}>-₹{order.financials.discountAmount}</Text>
            </View>
          ) : null}
          {order.financials.taxAmount > 0 ? (
            <View style={styles.finRow}>
              <Text style={styles.finLabel}>{order.financials.taxName || 'Tax'} ({order.financials.taxRate}%)</Text>
              <Text style={styles.finValue}>+₹{order.financials.taxAmount}</Text>
            </View>
          ) : null}

          <View style={styles.divider} />

          <View style={styles.finRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{order.financials.total}</Text>
          </View>

          {/* Payment Status */}
          <View style={[styles.paymentBadge, order.paymentStatus === 'paid' ? styles.paidBadge : styles.unpaidBadge]}>
            <MaterialIcons
              name={order.paymentStatus === 'paid' ? 'check-circle' : 'schedule'}
              size={16}
              color={order.paymentStatus === 'paid' ? '#006b5f' : '#93000a'}
            />
            <Text style={order.paymentStatus === 'paid' ? styles.paidText : styles.unpaidText}>
              {order.paymentStatus === 'paid' ? 'Paid in Full' : `Unpaid · Balance ₹${order.financials.balance}`}
            </Text>
          </View>
        </View>

        {/* Expected Delivery */}
        <View style={styles.deliveryCard}>
          <MaterialIcons name="event" size={22} color="#00408f" />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.deliveryLabel}>
              {order.deliveryType === 'pickup_store' ? 'EXPECTED READY' : 'EXPECTED DELIVERY'}
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
              {DELIVERY_LABELS[order.deliveryType] || 'Pickup'}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.whatsappBtn} onPress={handleShareWhatsApp}>
            <MaterialIcons name="chat" size={22} color="#ffffff" />
            <Text style={styles.whatsappBtnText}>Share on WhatsApp</Text>
          </TouchableOpacity>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={onViewOrder}>
              <MaterialIcons name="receipt-long" size={22} color="#00408f" />
              <Text style={styles.actionBtnText}>View Order</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={onDone}>
              <MaterialIcons name="home" size={22} color="#00408f" />
              <Text style={styles.actionBtnText}>Go Home</Text>
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
