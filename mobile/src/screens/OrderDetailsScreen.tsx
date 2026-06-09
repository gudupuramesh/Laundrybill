import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator,
  Linking, Alert, Modal, TextInput, Image, Share, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import { formatCurrency, normalizePhoneForCountry, toE164 } from '../lib/currency-format';
import { useShopCountrySettings } from '../lib/use-shop-country-settings';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { colors, fonts, radii, shadows } from '../theme';

// ─── Constants ────────────────────────────────────────────────────────

const WEB_APP_URL = 'https://app.laundrybill.com';

const CANCEL_REASON_EN = [
  'Customer requested cancellation',
  'Items/services unavailable',
  'Payment issue',
  'Duplicate order',
  'Shop closed / Cannot process',
  'Other',
] as const;

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: colors.warningBg, text: colors.warning },
  confirmed: { bg: colors.primaryTint, text: colors.primary },
  picked_up: { bg: colors.successBg, text: colors.success },
  pickup_scheduled: { bg: colors.primaryTint, text: colors.primary },
  pickup_completed: { bg: colors.primaryTint, text: colors.primary },
  processing: { bg: colors.inProgressBg, text: colors.inProgress },
  ready: { bg: '#F1FBE7', text: '#84CC16' },
  ready_for_pickup: { bg: '#F1FBE7', text: '#84CC16' },
  out_for_delivery: { bg: colors.primaryTint, text: colors.primary },
  delivered: { bg: colors.successBg, text: colors.success },
  cancelled: { bg: colors.errorBg, text: colors.error },
};

const STATUS_FLOW: Record<string, string[]> = {
  pickup_store: ['pending', 'processing', 'ready', 'picked_up'],
  delivery_home: ['pending', 'processing', 'ready', 'out_for_delivery', 'delivered'],
  pickup_home: ['pending', 'pickup_scheduled', 'pickup_completed', 'processing', 'ready', 'out_for_delivery', 'delivered'],
};

// ─── Helpers ──────────────────────────────────────────────────────────

function deliveryLabelKey(dt: string): string {
  if (dt === 'pickup_store') return 'mobile.delivery_pickup_store';
  if (dt === 'delivery_home') return 'mobile.delivery_delivery_home';
  if (dt === 'pickup_home') return 'mobile.delivery_pickup_home';
  return 'mobile.pickupFallback';
}

function odStatusLabel(status: string, t: TFunction): string {
  return t(`mobile.odStatus_${status}` as any);
}

function formatDateLocalized(d: Date | null, locale: string): string {
  if (!d) return '—';
  try {
    return d.toLocaleString(locale || 'en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return formatDate(d);
  }
}

function formatDateShortLocalized(d: Date | null, locale: string): string {
  if (!d) return '—';
  try {
    return d.toLocaleDateString(locale || 'en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return formatDateShort(d);
  }
}

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  if (val instanceof Date) return val;
  return new Date(val);
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatDateShort(d: Date | null): string {
  if (!d) return '—';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function getTrackingUrl(publicId: string): string {
  return `${WEB_APP_URL}/track/${publicId}`;
}

function getReceiptUrl(publicId: string): string {
  return `${WEB_APP_URL}/receipt/${publicId}`;
}

function getQRImageUrl(data: string, size: number = 200): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Returns the index of `currentStatus` in the flow (handles cross-flow aliases). */
function findStatusIndex(currentStatus: string, flow: string[]): number {
  let idx = flow.indexOf(currentStatus);
  if (idx !== -1) return idx;
  const aliases: Record<string, string[]> = {
    confirmed: ['pending'],
    ready_for_pickup: ['ready'],
    picked_up: ['picked_up'], // terminal
  };
  for (const eq of (aliases[currentStatus] || [])) {
    const i = flow.indexOf(eq);
    if (i !== -1) return i;
  }
  return -1;
}

// ─── Receipt HTML Generator ──────────────────────────────────────────

function generateReceiptHtml(order: any, shopData: any, t: TFunction, locale: string, currencySymbol: string): string {
  const fin = order.financials || {};
  const shopName = shopData?.name || 'LaundryBill';
  const shopPhone = shopData?.phone || '';
  const shopAddress = shopData?.address || '';
  const gstNumber = shopData?.gstNumber || '';
  const publicId = order.publicId || order.orderNumber || '';
  const createdAt = toDate(order.createdAt);
  const expectedDelivery = toDate(order.expectedDelivery);
  const deliveryType = order.deliveryType || 'pickup_store';
  const deliveryLabel = t(deliveryLabelKey(deliveryType));
  const qrUrl = getQRImageUrl(getTrackingUrl(publicId), 150);
  const taxName = fin.taxName || t('mobile.taxFallback');
  const fmt = (v: number) => `${currencySymbol}${Math.round(v || 0).toLocaleString(locale || 'en-US')}`;

  const itemRows = (order.items || []).map((item: any) => `
    <tr>
      <td style="padding:6px 0;font-size:13px;">
        <strong>${escHtml(item.serviceName)}</strong>${item.express ? ` <span style="color:#e65100;font-size:10px;">${escHtml(t('mobile.receiptHtmlExpressBadge'))}</span>` : ''}
        <br/><span style="color:#666;font-size:11px;">${escHtml(item.categoryName || '')} · x${item.quantity} · ${fmt(item.unitPrice)}${escHtml(t('mobile.receiptHtmlItemEa'))}</span>
      </td>
      <td style="padding:6px 0;text-align:right;font-weight:600;font-size:13px;">${fmt(item.total || 0)}</td>
    </tr>
  `).join('');

  const finRows: string[] = [];
  finRows.push(`<tr><td>${escHtml(t('mobile.receiptHtmlSubtotal'))}</td><td style="text-align:right">${fmt(fin.subtotal || 0)}</td></tr>`);
  if (fin.discountAmount > 0) finRows.push(`<tr><td>${escHtml(t('mobile.receiptHtmlDiscount'))}</td><td style="text-align:right;color:#006b5f">-${fmt(fin.discountAmount)}</td></tr>`);
  if (fin.expressCharge > 0) finRows.push(`<tr><td>${escHtml(t('mobile.receiptHtmlExpressCharge'))}</td><td style="text-align:right">+${fmt(fin.expressCharge)}</td></tr>`);
  if (fin.taxAmount > 0) finRows.push(`<tr><td>${escHtml(t('mobile.receiptHtmlTaxRow', { name: taxName, rate: fin.taxRate || 0 }))}</td><td style="text-align:right">+${fmt(fin.taxAmount)}</td></tr>`);
  if (fin.deliveryCharge > 0) finRows.push(`<tr><td>${escHtml(t('mobile.deliveryChargeLabel'))}</td><td style="text-align:right">+${fmt(fin.deliveryCharge)}</td></tr>`);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; padding:24px 20px; color:#191c1e; max-width:420px; margin:0 auto; }
  .header { text-align:center; margin-bottom:20px; }
  .shop-name { font-size:20px; font-weight:800; text-transform:uppercase; letter-spacing:1px; }
  .shop-info { font-size:11px; color:#666; margin-top:4px; }
  .divider { border:none; border-top:1px solid #eee; margin:14px 0; }
  .order-id { text-align:center; font-size:18px; font-weight:800; margin:8px 0 4px; }
  .order-meta { text-align:center; font-size:11px; color:#666; }
  .section-title { font-size:11px; font-weight:700; color:#434654; text-transform:uppercase; letter-spacing:1px; margin:16px 0 8px; }
  .customer { font-size:13px; margin:4px 0; }
  table { width:100%; border-collapse:collapse; }
  .fin-table td { padding:3px 0; font-size:13px; color:#434654; }
  .total-row td { font-size:16px; font-weight:800; color:#191c1e; padding:8px 0; border-top:2px solid #191c1e; }
  .total-row td:last-child { color:#00408f; }
  .payment-status { text-align:center; padding:8px 16px; border-radius:8px; font-size:12px; font-weight:700; margin:12px 0; }
  .paid { background:#e6f7f2; color:#006b5f; }
  .unpaid { background:#ffdad6; color:#93000a; }
  .qr-section { text-align:center; margin:20px 0 8px; }
  .qr-section img { width:120px; height:120px; }
  .track-link { text-align:center; font-size:11px; color:#00408f; word-break:break-all; }
  .footer { text-align:center; font-size:10px; color:#999; margin-top:20px; }
</style></head>
<body>
  <div class="header">
    <div class="shop-name">${escHtml(shopName)}</div>
    ${shopPhone ? `<div class="shop-info">${escHtml(t('mobile.receiptHtmlTel'))} ${escHtml(shopPhone)}</div>` : ''}
    ${shopAddress ? `<div class="shop-info">${escHtml(shopAddress)}</div>` : ''}
    ${gstNumber ? `<div class="shop-info">${escHtml(t('mobile.receiptHtmlGstin'))} ${escHtml(gstNumber)}</div>` : ''}
  </div>

  <hr class="divider"/>
  <div class="order-id">${escHtml(t('mobile.receiptHtmlOrder', { id: publicId }))}</div>
  <div class="order-meta">${escHtml(formatDateLocalized(createdAt, locale))}</div>
  <div class="order-meta" style="margin-top:4px;font-weight:600;">[ ${escHtml(deliveryLabel.toUpperCase())} ]</div>
  <hr class="divider"/>

  <div class="section-title">${escHtml(t('mobile.receiptHtmlCustomer'))}</div>
  <div class="customer"><strong>${escHtml(order.customerName || t('mobile.receiptHtmlGuest'))}</strong></div>
  <div class="customer">${escHtml(order.customerPhone || '')}</div>
  ${order.deliveryAddress ? `<div class="customer" style="color:#666">${escHtml(order.deliveryAddress)}</div>` : ''}

  <div class="section-title">${escHtml(t('mobile.receiptHtmlItems'))}</div>
  <table>${itemRows}</table>
  <hr class="divider"/>

  <table class="fin-table">${finRows.join('')}</table>
  <table><tr class="total-row"><td>${escHtml(t('mobile.receiptHtmlTotal'))}</td><td style="text-align:right">${fmt(fin.total || 0)}</td></tr></table>

  <table class="fin-table" style="margin-top:8px">
    <tr><td>${escHtml(t('mobile.receiptHtmlAmountPaid'))}</td><td style="text-align:right;font-weight:600">${fmt(fin.amountPaid || 0)}</td></tr>
    <tr><td>${escHtml(t('mobile.receiptHtmlBalanceDue'))}</td><td style="text-align:right;font-weight:700;color:${(fin.balance || 0) > 0 ? '#93000a' : '#006b5f'}">${fmt(fin.balance || 0)}</td></tr>
  </table>

  <div class="payment-status ${(fin.balance || 0) > 0 ? 'unpaid' : 'paid'}">
    ${(fin.balance || 0) > 0 ? escHtml(t('mobile.receiptHtmlBalanceDueBanner', { amount: Math.round(fin.balance) })) : escHtml(t('mobile.receiptHtmlPaidInFull'))}
  </div>

  ${expectedDelivery ? `
    <div style="text-align:center;background:#d8e2ff;border-radius:8px;padding:10px;margin:12px 0;">
      <div style="font-size:10px;font-weight:700;color:#00408f;letter-spacing:0.5px;">${escHtml(deliveryType === 'pickup_store' ? t('mobile.expectedReadyUpper') : t('mobile.expectedDeliveryUpper'))}</div>
      <div style="font-size:14px;font-weight:700;color:#00408f;margin-top:4px;">${escHtml(formatDateShortLocalized(expectedDelivery, locale))}</div>
    </div>
  ` : ''}

  <div class="qr-section"><img src="${qrUrl}" alt="QR"/></div>
  <div class="track-link">${getTrackingUrl(publicId)}</div>

  <hr class="divider"/>
  <div class="footer">${escHtml(t('mobile.receiptHtmlFooterThanks'))}<br/>${escHtml(t('mobile.receiptHtmlFooterPowered'))}</div>
</body></html>`;
}

// ─── Main Component ───────────────────────────────────────────────────

export default function OrderDetailsScreen({
  onBack,
  orderId,
  onEditOrder,
}: {
  onBack: () => void;
  orderId: string;
  onEditOrder?: (order: any) => void;
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const shopId = getShopId();
  const countrySettings = useShopCountrySettings(shopId);
  const withCurrencySymbol = (text: string) => text.replace(/₹/g, countrySettings.currencySymbol || '₹');
  const [order, setOrder] = useState<any>(null);
  const [shopData, setShopData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal states
  const [statusModal, setStatusModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [qrModal, setQrModal] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [editModal, setEditModal] = useState(false);

  // Status update
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');

  // Payment
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payRef, setPayRef] = useState('');

  // Cancel
  const [cancelReason, setCancelReason] = useState('');

  // Edit
  const [editNotes, setEditNotes] = useState('');
  const [editDeliveryType, setEditDeliveryType] = useState('');

  // QR tabs
  const [qrTab, setQrTab] = useState<'order' | 'items'>('order');

  // ─── Data fetching ────────────────────────────────────────────────

  useEffect(() => {
    if (!shopId || !orderId) { setLoading(false); return; }
    const unsub = firestore()
      .collection(`shops/${shopId}/orders`).doc(orderId)
      .onSnapshot(
        (snap: any) => { if (snap.exists) setOrder({ id: snap.id, ...snap.data() }); setLoading(false); },
        () => setLoading(false)
      );
    const unsubShop = firestore()
      .collection('shops').doc(shopId)
      .onSnapshot((snap: any) => { if (snap.exists) setShopData(snap.data()); }, () => {});
    return () => { unsub(); unsubShop(); };
  }, [shopId, orderId]);

  // ─── Computed ─────────────────────────────────────────────────────

  const categoryGroups = useMemo(() => {
    if (!order?.items) return [];
    const map: Record<string, { name: string; subtotal: number; items: any[] }> = {};
    order.items.forEach((item: any) => {
      const key = item.categoryId || 'other';
      if (!map[key]) map[key] = { name: item.categoryName || t('mobile.categoryOther'), subtotal: 0, items: [] };
      map[key].items.push(item);
      map[key].subtotal += item.total || 0;
    });
    return Object.values(map);
  }, [order, t]);

  const paymentMethods = useMemo(
    () => [
      { key: 'cash', label: t('mobile.payMethod_cash'), icon: 'payments' },
      { key: 'upi', label: t('mobile.payMethod_upi'), icon: 'phone-android' },
      { key: 'card', label: t('mobile.payMethod_card'), icon: 'credit-card' },
    ],
    [t],
  );

  /** Expand items by quantity for individual QR tags */
  const itemTags = useMemo(() => {
    if (!order?.items) return [];
    const tags: { index: number; total: number; serviceName: string; categoryName: string; quantity: number; unitPrice: number; qrData: string }[] = [];
    let totalQty = 0;
    (order.items || []).forEach((item: any) => { totalQty += (item.quantity || 1); });
    let idx = 0;
    (order.items || []).forEach((item: any) => {
      for (let q = 0; q < (item.quantity || 1); q++) {
        idx++;
        tags.push({
          index: idx,
          total: totalQty,
          serviceName: item.serviceName || '',
          categoryName: item.categoryName || '',
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          qrData: `${orderId}:${idx}`,
        });
      }
    });
    return tags;
  }, [order, orderId]);

  const fin = order?.financials || {};
  const status = order?.status || 'pending';
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.pending;
  const createdAt = toDate(order?.createdAt);
  const expectedDelivery = toDate(order?.expectedDelivery);
  const timeline = order?.timeline || [];
  const publicId = order?.publicId || order?.orderNumber || '';
  const trackingUrl = getTrackingUrl(publicId);
  const isTerminal = ['delivered', 'picked_up', 'cancelled'].includes(status);
  const deliveryType = order?.deliveryType || 'pickup_store';
  const flow = STATUS_FLOW[deliveryType] || STATUS_FLOW.pickup_store;
  const currentFlowIndex = findStatusIndex(status, flow);

  // ─── Actions ──────────────────────────────────────────────────────

  const orderDocRef = useCallback(() => {
    return firestore().collection(`shops/${shopId}/orders`).doc(orderId);
  }, [shopId, orderId]);

  const handleUpdateStatus = async () => {
    if (!selectedStatus || saving) return;
    setSaving(true);
    try {
      const currentTimeline = order?.timeline || [];
      const newEvent = {
        id: `t-${Date.now()}`,
        status: selectedStatus,
        timestamp: new Date(),
        staffId: 'mobile',
        staffName: 'Shop Owner',
        notes: statusNotes || null,
        notifiedCustomer: false,
      };
      const updateData: any = {
        status: selectedStatus,
        updatedAt: new Date(),
        timeline: [...currentTimeline, newEvent],
      };
      if (selectedStatus === 'delivered' || selectedStatus === 'picked_up') {
        updateData.deliveredAt = new Date();
      }
      await orderDocRef().update(updateData);
      setStatusModal(false);
      setSelectedStatus('');
      setStatusNotes('');
    } catch (e: any) {
      Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedUpdateStatus'));
    }
    setSaving(false);
  };

  const handleCollectPayment = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0 || saving) return;
    setSaving(true);
    try {
      const currentPayments = order?.payments || [];
      const newPayment = {
        id: `p-${Date.now()}`,
        amount,
        method: payMethod,
        reference: payRef || null,
        collectedBy: 'Shop Owner',
        collectedAt: new Date(),
      };
      const newAmountPaid = (fin.amountPaid || 0) + amount;
      const newBalance = (fin.total || 0) - newAmountPaid;
      const paymentStatus = newBalance <= 0 ? 'paid' : newAmountPaid > 0 ? 'partial' : 'unpaid';
      await orderDocRef().update({
        'financials.amountPaid': newAmountPaid,
        'financials.balance': Math.max(0, newBalance),
        paymentStatus,
        payments: [...currentPayments, newPayment],
        updatedAt: new Date(),
      });
      setPaymentModal(false);
      setPayAmount('');
      setPayMethod('cash');
      setPayRef('');
    } catch (e: any) {
      Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedCollectPayment'));
    }
    setSaving(false);
  };

  const handleCancelOrder = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const currentTimeline = order?.timeline || [];
      const cancelEvent = {
        id: `t-${Date.now()}`,
        status: 'cancelled',
        timestamp: new Date(),
        staffId: 'mobile',
        staffName: 'Shop Owner',
        notes: cancelReason || 'Cancelled from mobile',
        notifiedCustomer: false,
      };
      await orderDocRef().update({
        status: 'cancelled',
        updatedAt: new Date(),
        timeline: [...currentTimeline, cancelEvent],
      });
      setCancelModal(false);
      setCancelReason('');
    } catch (e: any) {
      Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedCancelOrder'));
    }
    setSaving(false);
  };

  const handleSaveEdit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const updateData: any = { updatedAt: new Date() };
      if (editDeliveryType) updateData.deliveryType = editDeliveryType;
      if (editNotes !== (order?.deliveryNotes || '')) updateData.deliveryNotes = editNotes;
      await orderDocRef().update(updateData);
      setEditModal(false);
    } catch (e: any) {
      Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedUpdateOrder'));
    }
    setSaving(false);
  };

  const handlePrintReceipt = async () => {
    try {
      const html = generateReceiptHtml(order, shopData, t, countrySettings.locale || i18n.language, countrySettings.currencySymbol || '₹');
      await Print.printAsync({ html });
    } catch (e: any) {
      Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedPrintReceipt'));
    }
  };

  const handleShareReceiptPdf = async () => {
    try {
      const html = generateReceiptHtml(order, shopData, t, countrySettings.locale || i18n.language, countrySettings.currencySymbol || '₹');
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: t('mobile.receiptShareTitle', { id: publicId }),
        UTI: 'com.adobe.pdf',
      });
    } catch (e: any) {
      Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedShareReceipt'));
    }
  };

  const handleShare = async () => {
    const shopName = shopData?.name || 'LaundryBill';
    const dateLabel = deliveryType === 'pickup_store' ? t('mobile.readyForPickupLabel') : t('mobile.expectedDeliveryLabel');

    const lines = [
      `${shopName} — Order #${publicId}`,
      ``,
      `${t('mobile.waOrderStatusLine', { status: odStatusLabel(status, t) })}`,
      ``,
      t('mobile.waItems'),
      ...(order?.items || []).map((i: any) => `- ${i.serviceName} x${i.quantity} — ${formatCurrency(Math.round(i.total || (i.unitPrice * i.quantity)), countrySettings)}`),
      ``,
      `${t('mobile.subtotalLabel')}: ${formatCurrency(Math.round(fin.subtotal || 0), countrySettings)}`,
    ];
    if (fin.discountAmount > 0) lines.push(`${t('mobile.discountLabel')}: -${formatCurrency(Math.round(fin.discountAmount), countrySettings)}`);
    if (fin.taxAmount > 0) lines.push(`${fin.taxName || t('mobile.taxFallback')}: +${formatCurrency(Math.round(fin.taxAmount), countrySettings)}`);
    lines.push(`${t('mobile.totalLabel')}: ${formatCurrency(Math.round(fin.total || 0), countrySettings)}`);
    if (fin.balance > 0) {
      lines.push(withCurrencySymbol(t('mobile.waBalanceDue', { amount: Math.round(fin.balance) }) as string));
    } else {
      lines.push(t('mobile.waPaidFull'));
    }
    if (expectedDelivery) lines.push(``, `${dateLabel}: ${formatDateShortLocalized(expectedDelivery, i18n.language)}`);
    lines.push(``, `${t('mobile.waTrackOrder')}:`, trackingUrl, ``, `${t('mobile.waViewReceipt')}:`, getReceiptUrl(publicId));

    try {
      await Share.share({ message: lines.join('\n') });
    } catch (e) {}
  };

  /** Print QR codes — thermal (2-inch / 48mm) or standard (A4/Letter) */
  const handlePrintQR = async (mode: 'thermal' | 'standard') => {
    try {
      const isThermal = mode === 'thermal';
      const pageWidth = isThermal ? '48mm' : '210mm';
      const qrSize = isThermal ? 120 : 200;
      const fontSize = isThermal ? '10px' : '14px';
      const smallFont = isThermal ? '8px' : '11px';

      let bodyContent = '';

      if (qrTab === 'order') {
        const qrUrl = getQRImageUrl(orderId, qrSize);
        bodyContent = `
          <div style="text-align:center;padding:${isThermal ? '4mm 2mm' : '20px'};">
            <img src="${qrUrl}" style="width:${qrSize}px;height:${qrSize}px;" />
            <div style="font-size:${fontSize};font-weight:800;margin-top:6px;">#${escHtml(publicId)}</div>
            <div style="font-size:${smallFont};color:#666;margin-top:2px;">${escHtml(order?.customerName || t('mobile.guestLabel'))} · ${escHtml(t('mobile.itemsCountShort', { count: (order?.items || []).reduce((s: number, i: any) => s + (i.quantity || 1), 0) }))}</div>
          </div>`;
      } else {
        bodyContent = itemTags.map((tag) => `
          <div style="text-align:center;padding:${isThermal ? '3mm 2mm' : '16px'};${isThermal ? '' : 'display:inline-block;width:48%;margin:1%;'}border:1px dashed #ccc;border-radius:4px;page-break-inside:avoid;margin-bottom:${isThermal ? '2mm' : '8px'};">
            <img src="${getQRImageUrl(tag.qrData, qrSize)}" style="width:${isThermal ? 100 : 150}px;height:${isThermal ? 100 : 150}px;" />
            <div style="font-size:${smallFont};font-weight:700;color:#666;margin-top:4px;">${escHtml(t('mobile.tagIndex', { index: tag.index, total: tag.total }))}</div>
            <div style="font-size:${fontSize};font-weight:700;margin-top:2px;">${escHtml(tag.serviceName)}</div>
            <div style="font-size:${smallFont};color:#666;">${escHtml(tag.categoryName)} · #${escHtml(publicId)}</div>
          </div>`).join('');
      }

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
        <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:sans-serif;width:${pageWidth};${isThermal ? 'margin:0;' : 'margin:0 auto;padding:12px;'}}</style>
        </head><body>${bodyContent}</body></html>`;

      await Print.printAsync({ html, ...(isThermal ? { width: 48 * 2.835 } : {}) });
    } catch (e: any) {
      Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedPrintQr'));
    }
  };

  // ─── Render ───────────────────────────────────────────────────────

  if (loading) {
    return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color="#00408f" /></View>;
  }

  if (!order) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }]}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#191c1e', marginBottom: 12 }}>{t('mobile.orderNotFound')}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={onBack}><Text style={styles.primaryBtnText}>{t('mobile.goBack')}</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
            <MaterialIcons name="arrow-back" size={24} color="#00408f" />
          </TouchableOpacity>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>#{publicId}</Text>
            <View style={[styles.statusBadgeLg, { backgroundColor: statusColor.bg }]}>
              <Text style={[styles.statusTextLg, { color: statusColor.text }]}>{odStatusLabel(status, t)}</Text>
            </View>
          </View>
          {!isTerminal && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => onEditOrder ? onEditOrder(order) : (() => { setEditNotes(order.deliveryNotes || ''); setEditDeliveryType(deliveryType); setEditModal(true); })()}>
              <MaterialIcons name="edit" size={22} color="#00408f" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 30 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        {/* Date */}
        <Text style={[styles.dateText, { marginBottom: 4 }]}>{formatDateLocalized(createdAt, i18n.language)}</Text>

        {/* ─── Action Buttons ─────────────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actionsScroll} contentContainerStyle={styles.actionsContent}>
          {!isTerminal && (
            <TouchableOpacity style={styles.actionChip} onPress={() => { setSelectedStatus(''); setStatusModal(true); }}>
              <MaterialIcons name="sync" size={18} color="#00408f" />
              <Text style={styles.actionChipText}>{t('mobile.updateStatusChip')}</Text>
            </TouchableOpacity>
          )}
          {fin.balance > 0 && (
            <TouchableOpacity style={styles.actionChip} onPress={() => { setPayAmount(String(Math.round(fin.balance))); setPaymentModal(true); }}>
              <MaterialIcons name="payments" size={18} color="#006b5f" />
              <Text style={[styles.actionChipText, { color: '#006b5f' }]}>{withCurrencySymbol(t('mobile.collectAmount', { amount: Math.round(fin.balance) }) as string)}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.actionChip} onPress={handleShare}>
            <MaterialIcons name="share" size={18} color="#00408f" />
            <Text style={styles.actionChipText}>{t('mobile.shareChip')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionChip} onPress={() => { setQrTab('order'); setQrModal(true); }}>
            <MaterialIcons name="qr-code-2" size={18} color="#00408f" />
            <Text style={styles.actionChipText}>{t('mobile.qrCodeChip')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionChip} onPress={handlePrintReceipt}>
            <MaterialIcons name="print" size={18} color="#5e3c00" />
            <Text style={[styles.actionChipText, { color: '#5e3c00' }]}>{t('mobile.printChip')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionChip} onPress={handleShareReceiptPdf}>
            <MaterialIcons name="picture-as-pdf" size={18} color="#c62828" />
            <Text style={[styles.actionChipText, { color: '#c62828' }]}>{t('mobile.pdfChip')}</Text>
          </TouchableOpacity>
          {!isTerminal && (
            <TouchableOpacity style={[styles.actionChip, { borderColor: '#bbdefb' }]} onPress={() => onEditOrder ? onEditOrder(order) : (() => { setEditNotes(order.deliveryNotes || ''); setEditDeliveryType(deliveryType); setEditModal(true); })()}>
              <MaterialIcons name="edit" size={18} color="#00408f" />
              <Text style={[styles.actionChipText, { color: '#00408f' }]}>{t('mobile.editChip')}</Text>
            </TouchableOpacity>
          )}
          {!isTerminal && ['pending', 'processing', 'confirmed', 'pickup_scheduled'].includes(status) && (
            <TouchableOpacity style={[styles.actionChip, { borderColor: '#fce4ec' }]} onPress={() => setCancelModal(true)}>
              <MaterialIcons name="cancel" size={18} color="#c62828" />
              <Text style={[styles.actionChipText, { color: '#c62828' }]}>{t('mobile.cancelOrderChip')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* ─── Customer ───────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.customerRow}>
            <View style={styles.customerAvatar}><MaterialIcons name="person" size={20} color="#00408f" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.customerName}>{order.customerName || t('mobile.guestLabel')}</Text>
              <Text style={styles.customerPhone}>{order.customerPhone || t('mobile.noPhoneLabel')}</Text>
            </View>
            {order.customerPhone ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.smallCircleBtn} onPress={() => Linking.openURL(`tel:${(order.customerPhone || '').replace(/\D/g, '')}`).catch(() => {})}>
                  <MaterialIcons name="call" size={16} color="#00408f" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.smallCircleBtn, { backgroundColor: '#e6f7f2' }]} onPress={() => {
                  const p = (order.customerPhone || '').replace(/\D/g, '');
                  const wa = toE164(normalizePhoneForCountry(p, countrySettings), countrySettings).replace(/\D/g, '');
                  Linking.openURL(`https://wa.me/${wa}`).catch(() => {});
                }}>
                  <MaterialIcons name="chat" size={16} color="#25D366" />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── Expected Delivery ──────────────────────────────────── */}
        {expectedDelivery ? (
          <View style={styles.deliveryCard}>
            <MaterialIcons name="event" size={20} color="#00408f" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.deliveryLabel}>{deliveryType === 'pickup_store' ? t('mobile.expectedReadyUpper') : t('mobile.expectedDeliveryUpper')}</Text>
              <Text style={styles.deliveryDate}>{formatDateShortLocalized(expectedDelivery, i18n.language)}</Text>
            </View>
            <View style={styles.deliveryTypeBadge}>
              <Text style={styles.deliveryTypeText}>{t(deliveryLabelKey(deliveryType))}</Text>
            </View>
          </View>
        ) : null}

        {/* ─── Items ──────────────────────────────────────────────── */}
        {categoryGroups.map((group, gi) => (
          <View key={`${group.name}-${gi}`} style={styles.serviceSection}>
            <View style={styles.serviceHeader}>
              <View style={styles.serviceHeaderLeft}>
                <MaterialIcons name="local-laundry-service" size={16} color="#00408f" />
                <Text style={styles.serviceTitle}>{group.name.toUpperCase()}</Text>
              </View>
              <Text style={styles.serviceSub}>{formatCurrency(Math.round(group.subtotal), countrySettings)}</Text>
            </View>
            <View style={styles.serviceItems}>
              {group.items.map((item: any, idx: number) => (
                <View key={item.id || idx}>
                  <View style={styles.serviceItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{item.serviceName}</Text>
                      <Text style={styles.itemMeta}>x{item.quantity} · {formatCurrency(Math.round(item.unitPrice), countrySettings)} ea.{item.express ? t('mobile.expressSuffixShort') : ''}</Text>
                    </View>
                    <Text style={styles.itemTotal}>{formatCurrency(Math.round(item.total), countrySettings)}</Text>
                  </View>
                  {idx < group.items.length - 1 ? <View style={styles.separator} /> : null}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* ─── Financials ─────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('mobile.paymentSummaryTitle')}</Text>
          <View style={styles.finRow}><Text style={styles.finLabel}>{t('mobile.subtotalLabel')}</Text><Text style={styles.finValue}>{formatCurrency(Math.round(fin.subtotal || 0), countrySettings)}</Text></View>
          {fin.discountAmount > 0 && <View style={styles.finRow}><Text style={styles.finLabel}>{t('mobile.discountLabel')}</Text><Text style={[styles.finValue, { color: '#006b5f' }]}>-{formatCurrency(Math.round(fin.discountAmount), countrySettings)}</Text></View>}
          {fin.expressCharge > 0 && <View style={styles.finRow}><Text style={styles.finLabel}>{t('mobile.expressChargeLabel')}</Text><Text style={styles.finValue}>+{formatCurrency(Math.round(fin.expressCharge), countrySettings)}</Text></View>}
          {fin.taxAmount > 0 && <View style={styles.finRow}><Text style={styles.finLabel}>{fin.taxName || t('mobile.taxFallback')} ({fin.taxRate}%)</Text><Text style={styles.finValue}>+{formatCurrency(Math.round(fin.taxAmount), countrySettings)}</Text></View>}
          {fin.deliveryCharge > 0 && <View style={styles.finRow}><Text style={styles.finLabel}>{t('mobile.deliveryChargeLabel')}</Text><Text style={styles.finValue}>+{formatCurrency(Math.round(fin.deliveryCharge), countrySettings)}</Text></View>}
          <View style={styles.divider} />
          <View style={styles.finRow}><Text style={styles.totalLabel}>{t('mobile.totalLabel')}</Text><Text style={styles.totalValue}>{formatCurrency(Math.round(fin.total || 0), countrySettings)}</Text></View>
          <View style={styles.finRow}><Text style={styles.finLabel}>{t('mobile.paidLabelFin')}</Text><Text style={styles.finValue}>{formatCurrency(Math.round(fin.amountPaid || 0), countrySettings)}</Text></View>
          <View style={[styles.paymentBadge, fin.balance > 0 ? styles.unpaidBg : styles.paidBg]}>
            <MaterialIcons name={fin.balance > 0 ? 'schedule' : 'check-circle'} size={14} color={fin.balance > 0 ? '#93000a' : '#006b5f'} />
            <Text style={fin.balance > 0 ? styles.unpaidText : styles.paidText}>
              {fin.balance > 0 ? withCurrencySymbol(t('mobile.waBalanceDue', { amount: Math.round(fin.balance) }) as string) : t('mobile.paidInFull')}
            </Text>
          </View>
        </View>

        {/* ─── Timeline ───────────────────────────────────────────── */}
        {timeline.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('mobile.timelineTitle')}</Text>
            {timeline.slice().reverse().map((entry: any, i: number) => {
              const entryDate = toDate(entry.timestamp);
              const ec = STATUS_COLORS[entry.status] || STATUS_COLORS.pending;
              return (
                <View key={entry.id || i} style={styles.timelineEntry}>
                  <View style={[styles.timelineDot, { backgroundColor: i === 0 ? ec.text : '#c3c6d6' }]} />
                  {i < timeline.length - 1 && <View style={styles.timelineLine} />}
                  <View style={styles.timelineContent}>
                    <Text style={[styles.timelineStatus, i === 0 && { color: ec.text, fontWeight: '700' }]}>{odStatusLabel(entry.status, t)}</Text>
                    <Text style={styles.timelineTime}>{formatDateLocalized(entryDate, i18n.language)}</Text>
                    {entry.staffName ? <Text style={styles.timelineStaff}>{t('mobile.timelineBy', { name: entry.staffName })}</Text> : null}
                    {entry.notes ? <Text style={styles.timelineNotes}>{entry.notes}</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Notes */}
        {order.deliveryNotes ? (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialIcons name="sticky-note-2" size={16} color="#434654" />
              <Text style={{ fontSize: 13, color: '#434654', flex: 1 }}>{order.deliveryNotes}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* ═══════════════════════ MODALS ═══════════════════════════════ */}

      {/* ─── STATUS UPDATE — shows ALL statuses ──────────────────── */}
      <Modal visible={statusModal} transparent animationType="slide" onRequestClose={() => setStatusModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalDismiss} onPress={() => { setStatusModal(false); setSelectedStatus(''); setStatusNotes(''); }} />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('mobile.updateStatusModalTitle')}</Text>
            <Text style={styles.modalSubtitle}>{t('mobile.deliveryFlowSubtitle', { type: t(deliveryLabelKey(deliveryType)) })}</Text>

            <ScrollView style={{ maxHeight: 340, marginTop: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {flow.map((s, i) => {
                const sc = STATUS_COLORS[s] || STATUS_COLORS.pending;
                const isCompleted = currentFlowIndex >= 0 && i < currentFlowIndex;
                const isCurrent = currentFlowIndex >= 0 && i === currentFlowIndex;
                const isFuture = currentFlowIndex >= 0 && i > currentFlowIndex;
                const isSelected = selectedStatus === s;
                const isLast = i === flow.length - 1;

                return (
                  <View key={s}>
                    <TouchableOpacity
                      style={[
                        styles.statusFlowRow,
                        isSelected && { backgroundColor: sc.bg, borderColor: sc.text },
                        isCurrent && !isSelected && { backgroundColor: sc.bg, borderColor: sc.bg },
                      ]}
                      onPress={() => isFuture ? setSelectedStatus(s) : null}
                      disabled={!isFuture}
                      activeOpacity={isFuture ? 0.7 : 1}
                    >
                      {/* Step indicator */}
                      <View style={[
                        styles.stepCircle,
                        isCompleted && { backgroundColor: '#2e7d32', borderColor: '#2e7d32' },
                        isCurrent && { backgroundColor: sc.text, borderColor: sc.text },
                        isSelected && { backgroundColor: sc.text, borderColor: sc.text },
                      ]}>
                        {isCompleted ? (
                          <MaterialIcons name="check" size={14} color="#fff" />
                        ) : isCurrent ? (
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
                        ) : isSelected ? (
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
                        ) : (
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#737685' }}>{i + 1}</Text>
                        )}
                      </View>

                      {/* Connecting line */}
                      {!isLast && (
                        <View style={[styles.stepLine, isCompleted && { backgroundColor: '#2e7d32' }]} />
                      )}

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[
                          styles.statusFlowLabel,
                          isCompleted && { color: '#2e7d32' },
                          isCurrent && { color: sc.text, fontWeight: '800' },
                          isSelected && { color: sc.text, fontWeight: '800' },
                          !isFuture && !isCurrent && !isCompleted && { color: '#c3c6d6' },
                        ]}>
                          {odStatusLabel(s, t)}
                          {isCurrent ? t('mobile.statusCurrentSuffix') : ''}
                        </Text>
                      </View>

                      {isFuture && (
                        <View style={[styles.radioOuter, isSelected && { borderColor: sc.text }]}>
                          {isSelected && <View style={[styles.radioInner, { backgroundColor: sc.text }]} />}
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* Cancel option */}
              {['pending', 'processing', 'confirmed', 'pickup_scheduled', 'pickup_completed'].includes(status) && (
                <TouchableOpacity
                  style={[styles.statusFlowRow, { marginTop: 8, borderColor: '#fce4ec' }, selectedStatus === 'cancelled' && { backgroundColor: '#fce4ec', borderColor: '#c62828' }]}
                  onPress={() => setSelectedStatus('cancelled')}
                >
                  <View style={[styles.stepCircle, { borderColor: '#c62828' }, selectedStatus === 'cancelled' && { backgroundColor: '#c62828' }]}>
                    <MaterialIcons name="close" size={14} color={selectedStatus === 'cancelled' ? '#fff' : '#c62828'} />
                  </View>
                  <Text style={[styles.statusFlowLabel, { marginLeft: 12, color: '#c62828' }]}>{t('mobile.cancelOrderStatusOption')}</Text>
                  <View style={[styles.radioOuter, { borderColor: '#c62828' }]}>
                    {selectedStatus === 'cancelled' && <View style={[styles.radioInner, { backgroundColor: '#c62828' }]} />}
                  </View>
                </TouchableOpacity>
              )}
            </ScrollView>

            <TextInput style={styles.modalInput} placeholder={t('mobile.statusNotesPlaceholder')} placeholderTextColor="#737685" value={statusNotes} onChangeText={setStatusNotes} multiline />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setStatusModal(false); setSelectedStatus(''); setStatusNotes(''); }}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, !selectedStatus && { opacity: 0.5 }, selectedStatus === 'cancelled' && { backgroundColor: '#c62828' }]}
                onPress={handleUpdateStatus}
                disabled={!selectedStatus || saving}
              >
                {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                  <Text style={styles.primaryBtnText}>{selectedStatus === 'cancelled' ? t('mobile.cancelOrderModalTitle') : t('mobile.updateStatusPrimaryBtn')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── PAYMENT ─────────────────────────────────────────────── */}
      <Modal visible={paymentModal} transparent animationType="slide" onRequestClose={() => setPaymentModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalDismiss} onPress={() => { setPaymentModal(false); setPayAmount(''); setPayRef(''); }} />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{t('mobile.collectPaymentTitle')}</Text>
            <Text style={styles.modalSubtitle}>{withCurrencySymbol(t('mobile.balanceSubtitle', { amount: Math.round(fin.balance || 0) }) as string)}</Text>
            <Text style={styles.fieldLabel}>{t('mobile.amountField')}</Text>
            <TextInput style={styles.modalInputSingle} keyboardType="numeric" value={payAmount} onChangeText={setPayAmount} placeholder="0" placeholderTextColor="#c3c6d6" />
            <Text style={styles.fieldLabel}>{t('mobile.paymentMethodField')}</Text>
            <View style={styles.methodRow}>
              {paymentMethods.map((m) => (
                <TouchableOpacity key={m.key} style={[styles.methodChip, payMethod === m.key && styles.methodChipActive]} onPress={() => setPayMethod(m.key)}>
                  <MaterialIcons name={m.icon as any} size={18} color={payMethod === m.key ? '#fff' : '#434654'} />
                  <Text style={[styles.methodChipText, payMethod === m.key && { color: '#fff' }]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {payMethod !== 'cash' && (
              <>
                <Text style={styles.fieldLabel}>{t('mobile.referencePlaceholder')}</Text>
                <TextInput style={styles.modalInputSingle} value={payRef} onChangeText={setPayRef} placeholder={t('mobile.phOptional')} placeholderTextColor="#c3c6d6" />
              </>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setPaymentModal(false); setPayAmount(''); setPayRef(''); }}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#006b5f' }, (!payAmount || parseFloat(payAmount) <= 0) && { opacity: 0.5 }]}
                onPress={handleCollectPayment}
                disabled={!payAmount || parseFloat(payAmount) <= 0 || saving}
              >
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>{withCurrencySymbol(t('mobile.collectBtn', { amount: payAmount || '0' }) as string)}</Text>}
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── QR CODE — Two tabs: Order / Items ───────────────────── */}
      <Modal visible={qrModal} transparent animationType="fade" onRequestClose={() => setQrModal(false)}>
        <View style={{ flex: 1 }}>
          <Pressable style={styles.modalDismiss} onPress={() => setQrModal(false)} />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16, maxHeight: '90%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('mobile.qrCodeModalTitle')}</Text>

            {/* Tab Switcher */}
            <View style={styles.qrTabRow}>
              <TouchableOpacity style={[styles.qrTabBtn, qrTab === 'order' && styles.qrTabBtnActive]} onPress={() => setQrTab('order')}>
                <MaterialIcons name="shopping-bag" size={16} color={qrTab === 'order' ? '#fff' : '#434654'} />
                <Text style={[styles.qrTabText, qrTab === 'order' && styles.qrTabTextActive]}>{t('mobile.qrTabOrder')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.qrTabBtn, qrTab === 'items' && styles.qrTabBtnActive]} onPress={() => setQrTab('items')}>
                <MaterialIcons name="style" size={16} color={qrTab === 'items' ? '#fff' : '#434654'} />
                <Text style={[styles.qrTabText, qrTab === 'items' && styles.qrTabTextActive]}>{t('mobile.qrTabItems', { count: itemTags.length })}</Text>
              </TouchableOpacity>
            </View>

            {qrTab === 'order' ? (
              /* ── Order / Basket QR ──── */
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <View style={styles.qrContainer}>
                  <Image source={{ uri: getQRImageUrl(orderId, 220) }} style={{ width: 200, height: 200 }} resizeMode="contain" />
                </View>
                <Text style={styles.qrOrderId}>#{publicId}</Text>
                <Text style={styles.qrSubInfo}>{order.customerName || t('mobile.guestLabel')} · {t('mobile.itemsCountShort', { count: (order.items || []).reduce((s: number, i: any) => s + (i.quantity || 1), 0) })}</Text>
                <Text style={styles.qrHint}>{t('mobile.qrScanHint')}</Text>
                <TouchableOpacity style={[styles.primaryBtn, { marginTop: 16, alignSelf: 'stretch' }]} onPress={handleShare}>
                  <MaterialIcons name="share" size={18} color="#fff" />
                  <Text style={[styles.primaryBtnText, { marginLeft: 6 }]}>{t('mobile.shareTrackingLink')}</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity style={[styles.printBtn, { flex: 1 }]} onPress={() => handlePrintQR('thermal')}>
                    <MaterialIcons name="print" size={16} color="#5e3c00" />
                    <Text style={styles.printBtnText}>{t('mobile.thermal2')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.printBtn, { flex: 1 }]} onPress={() => handlePrintQR('standard')}>
                    <MaterialIcons name="print" size={16} color="#5e3c00" />
                    <Text style={styles.printBtnText}>{t('mobile.printStandard')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* ── Item Tags QR ──── */
              <>
                <ScrollView style={{ maxHeight: 340, marginTop: 12 }} showsVerticalScrollIndicator={false}>
                  {itemTags.map((tag) => (
                    <View key={tag.index} style={styles.itemTagCard}>
                      <Image source={{ uri: getQRImageUrl(tag.qrData, 150) }} style={styles.itemTagQr} resizeMode="contain" />
                      <View style={styles.itemTagInfo}>
                        <Text style={styles.itemTagIndex}>{t('mobile.tagIndex', { index: tag.index, total: tag.total })}</Text>
                        <Text style={styles.itemTagName}>{tag.serviceName}</Text>
                        <Text style={styles.itemTagMeta}>{tag.categoryName}</Text>
                        <Text style={styles.itemTagMeta}>{formatCurrency(Math.round(tag.unitPrice), countrySettings)} · Order #{publicId}</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity style={[styles.printBtn, { flex: 1 }]} onPress={() => handlePrintQR('thermal')}>
                    <MaterialIcons name="print" size={16} color="#5e3c00" />
                    <Text style={styles.printBtnText}>{t('mobile.printThermal2Long')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.printBtn, { flex: 1 }]} onPress={() => handlePrintQR('standard')}>
                    <MaterialIcons name="print" size={16} color="#5e3c00" />
                    <Text style={styles.printBtnText}>{t('mobile.printStandard')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <TouchableOpacity style={[styles.modalCancelBtn, { marginTop: 12 }]} onPress={() => setQrModal(false)}>
              <Text style={styles.modalCancelText}>{t('mobile.closeBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── CANCEL ──────────────────────────────────────────────── */}
      <Modal visible={cancelModal} transparent animationType="slide" onRequestClose={() => setCancelModal(false)}>
        <View style={{ flex: 1 }}>
          <Pressable style={styles.modalDismiss} onPress={() => { setCancelModal(false); setCancelReason(''); }} />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: '#c62828' }]}>{t('mobile.cancelOrderModalTitle')}</Text>
            <Text style={styles.modalSubtitle}>{t('mobile.cannotUndo')}</Text>
            {fin.amountPaid > 0 && (
              <View style={[styles.paymentBadge, styles.unpaidBg, { marginTop: 12 }]}>
                <MaterialIcons name="info" size={14} color="#93000a" />
                <Text style={styles.unpaidText}>{t('mobile.paidRefundHint', { amount: Math.round(fin.amountPaid) })}</Text>
              </View>
            )}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>{t('mobile.reasonLabel')}</Text>
            <View style={{ gap: 6 }}>
              {CANCEL_REASON_EN.map((reason, ri) => (
                <TouchableOpacity key={reason} style={[styles.statusOption, cancelReason === reason && { borderColor: '#c62828', backgroundColor: '#fce4ec' }]} onPress={() => setCancelReason(reason)}>
                  <View style={[styles.radioOuter, cancelReason === reason && { borderColor: '#c62828' }]}>
                    {cancelReason === reason && <View style={[styles.radioInner, { backgroundColor: '#c62828' }]} />}
                  </View>
                  <Text style={[styles.statusOptionText, cancelReason === reason && { color: '#c62828' }]}>{t(`mobile.cancelReason_${ri + 1}` as any)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setCancelModal(false); setCancelReason(''); }}>
                <Text style={styles.modalCancelText}>{t('mobile.goBack')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#c62828' }, !cancelReason && { opacity: 0.5 }]} onPress={handleCancelOrder} disabled={!cancelReason || saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>{t('mobile.cancelOrderModalTitle')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── EDIT ────────────────────────────────────────────────── */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalDismiss} onPress={() => setEditModal(false)} />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{t('mobile.editOrderModalTitle')}</Text>
            <Text style={styles.fieldLabel}>{t('mobile.deliveryTypeField')}</Text>
            <View style={styles.methodRow}>
              {(['pickup_store', 'delivery_home', 'pickup_home'] as const).map((key) => (
                <TouchableOpacity key={key} style={[styles.methodChip, editDeliveryType === key && styles.methodChipActive]} onPress={() => setEditDeliveryType(key)}>
                  <Text style={[styles.methodChipText, editDeliveryType === key && { color: '#fff' }]}>{t(deliveryLabelKey(key))}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>{t('mobile.fieldNotes')}</Text>
            <TextInput style={[styles.modalInput, { minHeight: 70 }]} placeholder={t('mobile.deliveryNotesPlaceholder')} placeholderTextColor="#737685" value={editNotes} onChangeText={setEditNotes} multiline />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditModal(false)}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveEdit} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>{t('common.save')}</Text>}
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface, zIndex: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerInner: { flexDirection: 'row', alignItems: 'center', height: 48, paddingHorizontal: 8, gap: 8 },
  headerTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.primary },
  iconBtn: { padding: 8 },
  scrollContent: { padding: 16, gap: 16 },
  statusBadgeLg: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  statusTextLg: { fontSize: 13, fontFamily: fonts.bold },
  dateText: { fontSize: 11, fontFamily: fonts.medium, color: colors.textSecondary },

  // Actions
  actionsScroll: { marginHorizontal: -16, marginBottom: 4 },
  actionsContent: { paddingHorizontal: 16, gap: 8 },
  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surface, borderRadius: radii.button, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  actionChipText: { fontSize: 12, fontFamily: fonts.semibold, color: colors.primary },

  // Card
  card: {
    backgroundColor: colors.surface, borderRadius: radii.card, padding: 14, gap: 8,
    ...shadows.card, ...shadows.cardBorder,
  },
  cardTitle: { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  customerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  customerName: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  customerPhone: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 1 },
  smallCircleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  deliveryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radii.input, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.border },
  deliveryLabel: { fontSize: 9, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase' },
  deliveryDate: { fontSize: 14, fontFamily: fonts.bold, color: colors.text, marginTop: 1 },
  deliveryTypeBadge: { backgroundColor: colors.primaryTint, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  deliveryTypeText: { fontSize: 10, fontFamily: fonts.bold, color: colors.primary },

  // Items
  serviceSection: { backgroundColor: colors.surfaceMuted, borderRadius: radii.input, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  serviceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.primaryTint, borderBottomWidth: 1, borderBottomColor: colors.border },
  serviceHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  serviceTitle: { fontSize: 10, fontFamily: fonts.bold, color: colors.primary, letterSpacing: 1, textTransform: 'uppercase' },
  serviceSub: { fontSize: 10, fontFamily: fonts.bold, color: colors.primary },
  serviceItems: { backgroundColor: colors.surface },
  serviceItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  separator: { height: 1, backgroundColor: colors.border },
  itemName: { fontSize: 13, fontFamily: fonts.semibold, color: colors.text },
  itemMeta: { fontSize: 11, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 1 },
  itemTotal: { fontSize: 13, fontFamily: fonts.bold, color: colors.text },

  // Financials
  finRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  finLabel: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textSecondary },
  finValue: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  totalLabel: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  totalValue: { fontSize: 18, fontFamily: fonts.bold, color: colors.primary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  paymentBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 2 },
  paidBg: { backgroundColor: colors.successBg },
  unpaidBg: { backgroundColor: colors.errorBg },
  paidText: { fontSize: 12, fontFamily: fonts.bold, color: colors.success },
  unpaidText: { fontSize: 12, fontFamily: fonts.bold, color: colors.error },

  // Timeline
  timelineEntry: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3, marginRight: 10 },
  timelineLine: { position: 'absolute', left: 4, top: 15, width: 2, height: 28, backgroundColor: colors.border },
  timelineContent: {},
  timelineStatus: { fontSize: 13, fontFamily: fonts.semibold, color: colors.text },
  timelineTime: { fontSize: 10, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 1 },
  timelineStaff: { fontSize: 10, fontFamily: fonts.medium, color: colors.textMuted },
  timelineNotes: { fontSize: 11, fontFamily: fonts.medium, color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 },

  // Modal
  modalDismiss: { flex: 1, backgroundColor: 'rgba(26,29,46,0.4)' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary },
  modalInput: { backgroundColor: colors.surfaceMuted, borderRadius: radii.input, padding: 12, fontSize: 14, fontFamily: fonts.medium, color: colors.text, marginTop: 12, borderWidth: 1, borderColor: colors.border, textAlignVertical: 'top' },
  modalInputSingle: { backgroundColor: colors.surfaceMuted, borderRadius: radii.input, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, fontFamily: fonts.bold, color: colors.text, marginTop: 4, borderWidth: 1, borderColor: colors.border },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: radii.button, borderWidth: 1, borderColor: colors.border },
  modalCancelText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textSecondary },

  // Status flow
  statusFlowRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: radii.button, borderWidth: 1, borderColor: colors.border, marginBottom: 6 },
  statusFlowLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text, flex: 1 },
  stepCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.textMuted, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  stepLine: { position: 'absolute', left: 25, top: 36, width: 2, height: 18, backgroundColor: colors.border, zIndex: -1 },

  // Status option
  statusOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radii.button, borderWidth: 1, borderColor: colors.border },
  statusOptionText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },

  // Payment method
  fieldLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 0.3, textTransform: 'uppercase', marginTop: 14, marginBottom: 4 },
  methodRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  methodChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.button, backgroundColor: colors.surfaceMuted },
  methodChipActive: { backgroundColor: colors.primary },
  methodChipText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textSecondary },

  // QR tabs
  qrTabRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  qrTabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radii.button, backgroundColor: colors.surfaceMuted },
  qrTabBtnActive: { backgroundColor: colors.primary },
  qrTabText: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textSecondary },
  qrTabTextActive: { color: colors.surface },
  qrContainer: { backgroundColor: colors.surface, borderRadius: radii.card, padding: 16, borderWidth: 1, borderColor: colors.border },
  qrOrderId: { fontSize: 18, fontFamily: fonts.bold, color: colors.primary, marginTop: 12 },
  qrSubInfo: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 4 },
  qrHint: { fontSize: 11, fontFamily: fonts.medium, color: colors.textMuted, marginTop: 8, fontStyle: 'italic' },

  // Item tag QR
  itemTagCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.background, borderRadius: radii.card, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  itemTagQr: { width: 80, height: 80, borderRadius: 8 },
  itemTagInfo: { flex: 1 },
  itemTagIndex: { fontSize: 10, fontFamily: fonts.bold, color: colors.textMuted, letterSpacing: 0.5 },
  itemTagName: { fontSize: 14, fontFamily: fonts.bold, color: colors.text, marginTop: 2 },
  itemTagMeta: { fontSize: 11, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 1 },

  // Print button
  printBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: radii.button, backgroundColor: colors.warningBg, borderWidth: 1, borderColor: colors.warning + '30' },
  printBtnText: { fontSize: 12, fontFamily: fonts.semibold, color: colors.warning },

  // Primary button
  primaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: radii.button, backgroundColor: colors.primary },
  primaryBtnText: { fontSize: 14, fontFamily: fonts.bold, color: colors.surface },
});
