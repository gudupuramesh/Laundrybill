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
import { useDriverAuth } from '../lib/DriverAuthContext';
import { deleteOrderPermanently } from '../lib/deleteOrder';
import { getShopId, getAgentId, getAgentName } from '../lib/auth';
import { formatCurrency, buildWhatsAppNumber } from '../lib/currency-format';
import { useShopCountrySettings } from '../lib/use-shop-country-settings';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { colors, fonts, radii, shadows } from '../theme';
import { HelpButton } from '../components/HelpButton';
import { TagSheet } from '../components/TagSheet';

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
  partially_delivered: { bg: colors.warningBg, text: colors.warning },
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

// Code 128 barcode as a PNG image (compact 1D code for smaller tags). Shows the
// human-readable value beneath the bars.
function getBarcodeImageUrl(data: string): string {
  return `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(data)}&scale=3&height=10&includetext&textsize=11&paddingwidth=6&paddingheight=4&backgroundcolor=ffffff`;
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
    partially_delivered: ['ready'], // some pieces handed over — sits at the "ready" step
  };
  for (const eq of (aliases[currentStatus] || [])) {
    const i = flow.indexOf(eq);
    if (i !== -1) return i;
  }
  return -1;
}

// ─── Receipt HTML Generator ──────────────────────────────────────────

function generateReceiptHtml(order: any, shopData: any, t: TFunction, locale: string, currencySymbol: string, thermal = false): string {
  const fin = order.financials || {};
  const shopName = shopData?.name || 'LaundryBill';
  const shopPhone = shopData?.phone || '';
  const shopAddress = shopData?.address || '';
  const gstNumber = shopData?.gstNumber || '';
  // Country-aware tax-registration label: India → GSTIN (i18n), UAE → TRN (the FTA
  // requires exactly this), elsewhere → "<taxName> No." (e.g. "VAT No.").
  const shopCountry = String(shopData?.settings?.countryCode || 'IN').toUpperCase();
  const taxIdLabel = shopCountry === 'IN'
    ? t('mobile.receiptHtmlGstin')
    : shopCountry === 'AE'
      ? 'TRN:'
      : `${shopData?.settings?.tax?.name || 'Tax'} No.:`;
  // UAE FTA: a VAT-registered shop's invoice must be titled "Tax Invoice".
  const isTaxInvoice = shopCountry === 'AE' && !!gstNumber;
  const publicId = order.publicId || order.orderNumber || '';
  const createdAt = toDate(order.createdAt);
  const expectedDelivery = toDate(order.expectedDelivery);
  const deliveryType = order.deliveryType || 'pickup_store';
  const deliveryLabel = t(deliveryLabelKey(deliveryType));
  const qrUrl = getQRImageUrl(getTrackingUrl(publicId), 150);
  // Scan-to-pay QR — UPI deep link (or the shop's payment link) with the balance
  // pre-filled. Owner-toggleable via settings.receiptPaymentQr; only prints when
  // something is still due, and takes the QR slot in place of the tracking QR.
  const payUpi = String(shopData?.bankDetails?.upiId || '').trim();
  const payLink = String(shopData?.bankDetails?.paymentLink || '').trim();
  const payBalance = Number(fin.balance || 0);
  const showPayQr = shopData?.settings?.receiptPaymentQr !== false && payBalance > 0 && !!(payUpi || payLink);
  const payTarget = payUpi
    ? `upi://pay?pa=${encodeURIComponent(payUpi)}&pn=${encodeURIComponent(shopData?.name || 'Shop')}&am=${payBalance.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Order ${publicId}`)}`
    : payLink;
  const payQrUrl = showPayQr ? getQRImageUrl(payTarget, 150) : '';
  const taxName = fin.taxName || t('mobile.taxFallback');
  const fmt = (v: number) => `${currencySymbol}${Math.round(v || 0).toLocaleString(locale || 'en-US')}`;

  const itemRows = (order.items || []).map((item: any) => `
    <tr>
      <td style="padding:6px 0;font-size:13px;">
        <strong>${escHtml(item.serviceName)}</strong>${item.express ? ` <span style="color:#e65100;font-size:10px;">${escHtml(t('mobile.receiptHtmlExpressBadge'))}</span>` : ''}
        <br/><span style="color:#666;font-size:11px;">${escHtml(item.categoryName || '')} · x${item.quantity}${item.pieceCount ? ` (${item.pieceCount} pcs)` : ''} · ${fmt(item.unitPrice)}${escHtml(t('mobile.receiptHtmlItemEa'))}</span>
      </td>
      <td style="padding:6px 0;text-align:right;font-weight:600;font-size:13px;">${fmt(item.total || 0)}</td>
    </tr>
  `).join('');

  const finRows: string[] = [];
  finRows.push(`<tr><td>${escHtml(t('mobile.receiptHtmlSubtotal'))}</td><td style="text-align:right">${fmt(fin.subtotal || 0)}</td></tr>`);
  if (fin.discountAmount > 0) finRows.push(`<tr><td>${escHtml(t('mobile.receiptHtmlDiscount'))}</td><td style="text-align:right;color:#006b5f">-${fmt(fin.discountAmount)}</td></tr>`);
  if (fin.expressCharge > 0) finRows.push(`<tr><td>${escHtml(t('mobile.receiptHtmlExpressCharge'))}</td><td style="text-align:right">+${fmt(fin.expressCharge)}</td></tr>`);
  // Rate suffix only when a rate was stored (legacy orders show the bare name, not "(0%)");
  // a TAX INVOICE always shows the line. When NO tax was charged, the compliance line is
  // always "VAT (0%)" — never a stale stored name like GST (UAE's tax is VAT, not GST).
  const receiptTaxLabel = fin.taxRate
    ? t('mobile.receiptHtmlTaxRow', { name: taxName, rate: fin.taxRate })
    : (fin.taxAmount || 0) > 0
      ? taxName
      : isTaxInvoice
        ? t('mobile.receiptHtmlTaxRow', { name: 'VAT', rate: 0 })
        : taxName;
  if (fin.taxAmount > 0 || isTaxInvoice) finRows.push(`<tr><td>${escHtml(receiptTaxLabel)}</td><td style="text-align:right">+${fmt(fin.taxAmount || 0)}</td></tr>`);
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
  ${thermal ? `
  body { max-width:none; padding:10px 8px; }
  .shop-name { font-size:15px; } .shop-info { font-size:10px; }
  .order-id { font-size:14px; }
  .divider { border-top:1px dashed #999; }
  .section-title { margin:10px 0 6px; }
  .customer { font-size:12px; } .fin-table td { font-size:12px; }
  .total-row td { font-size:14px; }
  .qr-section img { width:100px; height:100px; }
  ` : ''}
</style></head>
<body>
  <div class="header">
    ${shopData?.logo && shopData?.settings?.receiptShowLogo !== false ? `<img src="${shopData.logo}" alt="" style="max-height:60px;max-width:150px;object-fit:contain;display:block;margin:0 auto 8px;"/>` : ''}
    <div class="shop-name">${escHtml(shopName)}</div>
    ${shopPhone ? `<div class="shop-info">${escHtml(t('mobile.receiptHtmlTel'))} ${escHtml(shopPhone)}</div>` : ''}
    ${shopAddress ? `<div class="shop-info">${escHtml(shopAddress)}</div>` : ''}
    ${gstNumber ? `<div class="shop-info">${escHtml(taxIdLabel)} ${escHtml(gstNumber)}</div>` : ''}
    ${isTaxInvoice ? `<div style="font-size:13px;font-weight:800;letter-spacing:2px;margin-top:8px;">TAX INVOICE</div>` : ''}
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
    ${(fin.balance || 0) > 0 ? escHtml(t('mobile.receiptHtmlBalanceDueBanner', { amount: fmt(fin.balance || 0) })) : escHtml(t('mobile.receiptHtmlPaidInFull'))}
  </div>

  ${expectedDelivery ? `
    <div style="text-align:center;background:#d8e2ff;border-radius:8px;padding:10px;margin:12px 0;">
      <div style="font-size:10px;font-weight:700;color:#00408f;letter-spacing:0.5px;">${escHtml(deliveryType === 'pickup_store' ? t('mobile.expectedReadyUpper') : t('mobile.expectedDeliveryUpper'))}</div>
      <div style="font-size:14px;font-weight:700;color:#00408f;margin-top:4px;">${escHtml(formatDateShortLocalized(expectedDelivery, locale))}</div>
    </div>
  ` : ''}

  ${showPayQr ? `
  <div class="qr-section">
    <div style="font-size:12px;font-weight:800;letter-spacing:1px;">${escHtml(t('mobile.receiptScanToPay', 'SCAN TO PAY'))}</div>
    <img src="${payQrUrl}" alt="Pay QR"/>
    <div style="font-size:12px;font-weight:700;margin-top:2px;">${escHtml(t('mobile.receiptPayBalance', 'Pay balance:'))} ${fmt(payBalance)}</div>
    ${payUpi ? `<div style="font-size:10px;color:#666;">UPI: ${escHtml(payUpi)}</div>` : ''}
  </div>` : `
  <div class="qr-section"><img src="${qrUrl}" alt="QR"/></div>`}
  <div class="track-link">${getTrackingUrl(publicId)}</div>

  ${(shopData?.settings?.receiptTerms || '').trim() ? `
    <hr class="divider"/>
    <div style="margin-top:4px;">
      <div style="font-size:10px;font-weight:700;color:#444;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:3px;">${escHtml(t('mobile.receiptHtmlTermsTitle', { defaultValue: 'Terms & Conditions' }))}</div>
      <div style="font-size:10px;color:#666;line-height:1.4;white-space:pre-line;">${escHtml(String(shopData.settings.receiptTerms).trim())}</div>
    </div>
  ` : ''}

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
  // Deleting an order is a manager power — plain staff, agents and plant
  // operators never see the button (Firestore rules enforce the same).
  const { agent } = useDriverAuth();
  const isManager = agent?.role === 'manager';
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
  const [tagOpen, setTagOpen] = useState(false);
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
  // Tag code style — QR (default) or Code128 barcode. Remembered per shop in settings.tagStyle.
  const [tagStyleOverride, setTagStyleOverride] = useState<'qr' | 'barcode' | null>(null);
  // Timeline starts collapsed to the latest few events.
  const [showAllTimeline, setShowAllTimeline] = useState(false);

  // ─── Data fetching ────────────────────────────────────────────────

  useEffect(() => {
    if (!shopId || !orderId) { setLoading(false); return; }
    const ordersRef = firestore().collection(`shops/${shopId}/orders`);
    let unsub = () => {};
    let resolved = false;
    unsub = ordersRef.doc(orderId).onSnapshot(
      (snap: any) => {
        if (snap.exists) { resolved = true; setOrder({ id: snap.id, ...snap.data() }); setLoading(false); return; }
        // Not a doc id → resolve by order number (scanned barcode / short code / tracking publicId).
        if (resolved) { setLoading(false); return; }
        resolved = true;
        ordersRef.where('orderNumber', '==', orderId).limit(1).get()
          .then((qs: any) => {
            if (!qs.empty) {
              unsub();
              const d = qs.docs[0];
              unsub = ordersRef.doc(d.id).onSnapshot(
                (s: any) => { if (s.exists) setOrder({ id: s.id, ...s.data() }); setLoading(false); },
                () => setLoading(false)
              );
            } else { setLoading(false); }
          })
          .catch(() => setLoading(false));
      },
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
  // Tag code style: the user's in-modal choice overrides the saved shop setting.
  const tagStyle: 'qr' | 'barcode' = tagStyleOverride ?? (shopData?.settings?.tagStyle === 'barcode' ? 'barcode' : 'qr');
  const isBarcodeTag = tagStyle === 'barcode';
  const setTagStyle = (style: 'qr' | 'barcode') => {
    setTagStyleOverride(style);
    if (shopId) firestore().collection('shops').doc(shopId).set({ settings: { tagStyle: style } }, { merge: true }).catch(() => {});
  };
  // Image URL + encoded value for a tag, honoring the selected style.
  // Barcode encodes the short order number (publicId); QR keeps the doc id.
  const tagImageUrl = (qrValue: string, barcodeValue: string, qrSize: number) =>
    isBarcodeTag ? getBarcodeImageUrl(barcodeValue) : getQRImageUrl(qrValue, qrSize);
  const trackingUrl = getTrackingUrl(publicId);
  const isTerminal = ['delivered', 'picked_up', 'cancelled'].includes(status);
  const deliveryType = order?.deliveryType || 'pickup_store';
  const flow = STATUS_FLOW[deliveryType] || STATUS_FLOW.pickup_store;
  const currentFlowIndex = findStatusIndex(status, flow);
  const nextStatus = !isTerminal && status !== 'cancelled' && currentFlowIndex >= 0 && currentFlowIndex < flow.length - 1 ? flow[currentFlowIndex + 1] : null;
  const isOverdue = !!expectedDelivery && !isTerminal && expectedDelivery.getTime() < Date.now();
  const payments = order?.payments || [];
  const shownTimeline = showAllTimeline ? timeline.slice().reverse() : timeline.slice().reverse().slice(0, 3);

  // ─── Actions ──────────────────────────────────────────────────────

  const orderDocRef = useCallback(() => {
    return firestore().collection(`shops/${shopId}/orders`).doc(orderId);
  }, [shopId, orderId]);

  // ─── Per-item status (partial delivery / mark processed) ─────────
  const [deliverMode, setDeliverMode] = useState(false);
  const [deliverDraft, setDeliverDraft] = useState<Record<number, number>>({});
  const [procOpen, setProcOpen] = useState<number | null>(null);
  const [procQty, setProcQty] = useState(1);
  const [itemBusy, setItemBusy] = useState(false);
  const orderItems: any[] = order?.items || [];
  const orderDone = status === 'delivered' || status === 'picked_up';
  const isCountable = (it: any): boolean => {
    const q = it.quantity;
    if (!Number.isInteger(q) || q <= 1) return false;
    const u = String(it.pricingType || it.unit || '').toLowerCase();
    return !['kg', 'lb', 'sqft', 'sqm', 'load', 'bag'].includes(u);
  };
  const progressOf = (it: any): { qty: number; processed: number; delivered: number } => {
    const qty = isCountable(it) ? it.quantity : 1;
    if (it.processedQty === undefined && it.deliveredQty === undefined) {
      const st = it.itemStatus || (orderDone ? 'delivered' : 'pending');
      const all = st === 'delivered' ? qty : 0;
      const proc = st === 'delivered' || st === 'processed' ? qty : 0;
      return { qty, processed: proc, delivered: all };
    }
    const delivered = Math.max(0, Math.min(qty, it.deliveredQty ?? 0));
    const processed = Math.max(delivered, Math.min(qty, it.processedQty ?? 0));
    return { qty, processed, delivered };
  };
  const lineProg = orderItems.map(progressOf);
  // Per-item piece tracking is a Pro+/Business feature. Pro/free shops use the
  // standard order-level status update (which cascades to items) instead.
  const [itemTracking, setItemTracking] = useState(false);
  useEffect(() => {
    if (!shopId) return;
    firestore().collection('subscriptions').doc(shopId).get()
      .then((snap: any) => {
        const d = snap.data() || {};
        const n = String(d.planId || d.planName || '').toLowerCase().replace(/[_\s-]/g, '');
        setItemTracking(n === 'proplus' || n === 'pro+' || n === 'business' || n === 'enterprise' || n === 'premium' || n === 'franchise' || n === 'multishop');
      })
      .catch(() => {});
  }, [shopId]);
  // Items stay editable on delivered orders (matches web) so leftover pieces can
  // always be reconciled; only a cancelled order locks the item list.
  const itemsEditable = itemTracking && status !== 'cancelled';
  const anyProcessable = itemsEditable && lineProg.some((p) => p.processed < p.qty);
  // Only PROCESSED pieces can be handed over — deliverable = processed − delivered.
  const anyDeliverable = itemsEditable && lineProg.some((p) => p.delivered < p.processed);
  const totalPieces = lineProg.reduce((a, p) => a + p.qty, 0);
  const deliveredPieces = lineProg.reduce((a, p) => a + p.delivered, 0);
  const draftPieces = Object.values(deliverDraft).reduce((a: number, n) => a + (n || 0), 0);
  const setDraft = (i: number, n: number) =>
    setDeliverDraft((d) => ({ ...d, [i]: Math.max(0, Math.min(lineProg[i].processed - lineProg[i].delivered, n)) }));

  const runProgress = async (updates: { index: number; processed?: number; delivered?: number }[]) => {
    if (!updates.length || itemBusy) return;
    setItemBusy(true);
    try {
      const byIndex = new Map(updates.map((u) => [u.index, u]));
      const touched: { name: string; verb: string; n: number; qty: number }[] = [];
      const items = orderItems.map((it, i) => {
        const u = byIndex.get(i);
        if (!u) return it;
        const cur = progressOf(it);
        let delivered = u.delivered !== undefined ? u.delivered : cur.delivered;
        let processed = u.processed !== undefined ? u.processed : cur.processed;
        delivered = Math.max(0, Math.min(cur.qty, Math.round(delivered)));
        processed = Math.max(delivered, Math.min(cur.qty, Math.round(processed)));
        const st = delivered >= cur.qty ? 'delivered' : processed >= cur.qty ? 'processed' : 'pending';
        if (u.delivered !== undefined && delivered !== cur.delivered) touched.push({ name: it.serviceName, verb: 'Delivered', n: delivered, qty: cur.qty });
        else if (u.processed !== undefined && processed !== cur.processed) touched.push({ name: it.serviceName, verb: 'Processed', n: processed, qty: cur.qty });
        return { ...it, processedQty: processed, deliveredQty: delivered, itemStatus: st };
      });
      const prog = items.map(progressOf);
      const allDelivered = prog.every((p) => p.delivered >= p.qty);
      const anyDeliveredNow = prog.some((p) => p.delivered > 0);
      const allProcessed = prog.every((p) => p.processed >= p.qty);
      let derived: string | null = null;
      if (allDelivered) derived = deliveryType === 'pickup_store' ? 'picked_up' : 'delivered';
      else if (anyDeliveredNow) derived = 'partially_delivered';
      else if (allProcessed) derived = deliveryType === 'pickup_store' ? 'ready_for_pickup' : 'ready';
      const notes = touched.length
        ? touched.slice(0, 4).map((tt) => `${tt.verb} ${tt.n}${tt.qty > 1 ? `/${tt.qty}` : ''} × ${tt.name}`).join(', ') + (touched.length > 4 ? '…' : '')
        : 'Updated items';
      const newEvent = {
        id: `t-${Date.now()}`,
        status: derived && derived !== status ? derived : status,
        timestamp: new Date(),
        staffId: getAgentId() || 'staff',
        staffName: getAgentName() || 'Staff',
        notes,
        notifiedCustomer: false,
      };
      const updateData: any = { items, updatedAt: new Date(), timeline: [...(order?.timeline || []), newEvent] };
      if (derived && derived !== status) {
        updateData.status = derived;
        if (derived === 'delivered' || derived === 'picked_up') updateData.deliveredAt = new Date();
      }
      await orderDocRef().update(updateData);
      setDeliverMode(false); setDeliverDraft({}); setProcOpen(null);
    } catch (e: any) {
      Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedUpdateStatus'));
    }
    setItemBusy(false);
  };
  const processMore = (i: number, n: number) => runProgress([{ index: i, processed: Math.min(lineProg[i].qty, lineProg[i].processed + n) }]);
  const processAll = () => runProgress(orderItems.map((_, i) => ({ index: i, processed: lineProg[i].qty })).filter((_, i) => lineProg[i].processed < lineProg[i].qty));
  const enterDeliver = () => {
    const draft: Record<number, number> = {};
    // Prefill each line with PROCESSED-but-undelivered pieces; unprocessed can't be handed over.
    lineProg.forEach((p, i) => { const rem = p.processed - p.delivered; if (rem > 0) draft[i] = rem; });
    setDeliverDraft(draft); setDeliverMode(true); setProcOpen(null);
  };
  const confirmDeliver = () => runProgress(
    Object.entries(deliverDraft).filter(([, n]) => (n || 0) > 0)
      .map(([i, n]) => ({ index: Number(i), delivered: Math.min(lineProg[Number(i)].processed, lineProg[Number(i)].delivered + (n || 0)) }))
  );
  const pillFor = (p: { qty: number; processed: number; delivered: number }): { label: string; fg: string; bg: string } => {
    if (p.delivered >= p.qty && p.qty > 0) return { label: t('mobile.itemDelivered', 'DELIVERED'), fg: '#0E9F6E', bg: '#E8F8EE' };
    if (p.delivered > 0) return { label: `${p.delivered}/${p.qty} ${t('mobile.itemDelivered', 'DELIVERED')}`, fg: '#B45309', bg: '#FFF4E5' };
    if (p.processed >= p.qty && p.qty > 0) return { label: t('mobile.itemProcessed', 'PROCESSED'), fg: '#00408f', bg: '#E6F0FF' };
    if (p.processed > 0) return { label: `${p.processed}/${p.qty} ${t('mobile.itemProcessed', 'PROCESSED')}`, fg: '#B45309', bg: '#FFF4E5' };
    return { label: t('mobile.itemPending', 'PENDING'), fg: '#6B7280', bg: '#F1F3F5' };
  };
  const stepBtnStyle = { width: 26, height: 26, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: 6, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#F8FAFC' };
  const stepTxtStyle = { fontSize: 16, fontWeight: '700' as const, color: '#374151', lineHeight: 20 };

  const applyStatusUpdate = async (target: string) => {
    if (!target || saving) return;
    setSaving(true);
    try {
      const currentTimeline = order?.timeline || [];
      const newEvent = {
        id: `t-${Date.now()}`,
        status: target,
        timestamp: new Date(),
        staffId: getAgentId() || 'staff',
        staffName: getAgentName() || 'Staff',
        notes: statusNotes || null,
        notifiedCustomer: false,
      };
      const updateData: any = {
        status: target,
        updatedAt: new Date(),
        timeline: [...currentTimeline, newEvent],
      };
      // Top-level status is the coarse control: cascade it down to the item piece
      // counters so the item list can never contradict the order status. The item
      // list stays the fine-grained path (it derives the order status upward).
      if (target === 'delivered' || target === 'picked_up') {
        updateData.deliveredAt = new Date();
        if (orderItems.length) {
          updateData.items = orderItems.map((it) => {
            const p = progressOf(it);
            return { ...it, processedQty: p.qty, deliveredQty: p.qty, itemStatus: 'delivered' };
          });
        }
      } else if (target === 'ready' || target === 'ready_for_pickup') {
        if (orderItems.length) {
          updateData.items = orderItems.map((it) => {
            const p = progressOf(it);
            return { ...it, processedQty: p.qty, deliveredQty: p.delivered, itemStatus: p.delivered >= p.qty ? 'delivered' : 'processed' };
          });
        }
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

  const handleUpdateStatus = () => {
    if (!selectedStatus || saving) return;
    // Confirm only when partial delivery has actually started (some pieces delivered,
    // some not) — a fresh order marked Delivered cascades silently, as expected.
    if ((selectedStatus === 'delivered' || selectedStatus === 'picked_up') && deliveredPieces > 0 && deliveredPieces < totalPieces) {
      Alert.alert(
        t('mobile.confirmDeliverAllTitle', 'Deliver all items?'),
        t('mobile.confirmDeliverAllMsg', '{{left}} of {{total}} pieces are not marked delivered yet. This will mark every item as delivered.', { left: totalPieces - deliveredPieces, total: totalPieces }) as string,
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          { text: t('mobile.confirmDeliverAllBtn', 'Deliver all'), onPress: () => applyStatusUpdate(selectedStatus) },
        ]
      );
      return;
    }
    applyStatusUpdate(selectedStatus);
  };

  const handleCollectPayment = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0 || saving) return;
    if (order?.status === 'cancelled') { Alert.alert(t('mobile.errorTitle'), t('mobile.failedCollectPayment')); return; }
    setSaving(true);
    try {
      const currentPayments = order?.payments || [];
      const newPayment = {
        id: `p-${Date.now()}`,
        amount,
        method: payMethod,
        reference: payRef || null,
        collectedBy: getAgentName() || 'Staff',
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
      // Loyalty earn: credit points once the order becomes fully paid (same rule
      // as web) — guarded by the order.loyalty stamp so it can't credit twice.
      if (newBalance <= 0 && order?.customerId && !order?.isGuest && !order?.loyalty?.earnedPoints) {
        try {
          const loyalty = shopData?.settings?.loyalty;
          if (loyalty?.enabled) {
            const earn = loyalty.mode === 'fixed'
              ? Math.max(0, Math.round(loyalty.earnFixed || 0))
              : Math.max(0, Math.round(((fin.total || 0) * (loyalty.earnPercent || 0)) / 100));
            if (earn > 0) {
              await orderDocRef().update({ loyalty: { earnedPoints: earn, earnedAt: new Date() } });
              const custRef = firestore().collection(`shops/${shopId}/customers`).doc(order.customerId);
              const custDoc = await custRef.get();
              if (custDoc.exists) {
                const cd = custDoc.data() || {};
                await custRef.update({
                  loyaltyPoints: (cd.loyaltyPoints || 0) + earn,
                  loyaltyEarned: (cd.loyaltyEarned || 0) + earn,
                  updatedAt: new Date(),
                });
              }
            }
          }
        } catch (loyErr) {
          console.error('Loyalty credit error (non-fatal):', loyErr);
        }
      }
      setPaymentModal(false);
      setPayAmount('');
      setPayMethod('cash');
      setPayRef('');
    } catch (e: any) {
      Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedCollectPayment'));
    }
    setSaving(false);
  };


  // ── Permanent delete (owner / manager) ───────────────────────────────
  // Confirmation is mandatory: this wipes the order from orders, reports and
  // the customer's history, and kills its tracking link. Rules also gate it.
  const [deleting, setDeleting] = useState(false);
  const runDeleteOrder = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteOrderPermanently(shopId, orderId);
      Alert.alert(
        t('mobile.deleteOrderDone', { defaultValue: 'Order deleted' }),
        `#${publicId} ${t('mobile.deleteOrderDoneMsg', { defaultValue: 'was permanently removed.' })}`,
      );
      onBack();
    } catch (e: any) {
      const denied = e?.code === 'firestore/permission-denied' || /permission/i.test(String(e?.message || ''));
      Alert.alert(
        t('mobile.errorTitle'),
        denied
          ? t('mobile.deleteOrderDenied', { defaultValue: 'Only the shop owner or a manager can delete an order.' })
          : e?.message || t('mobile.deleteOrderFailed', { defaultValue: 'Could not delete the order.' }),
      );
    } finally {
      setDeleting(false);
    }
  };
  const confirmDeleteOrder = () => {
    if (deleting) return;
    Alert.alert(
      `${t('mobile.deleteOrderTitle', { defaultValue: 'Delete order' })} #${publicId}?`,
      t('mobile.deleteOrderMsg', {
        defaultValue:
          'This permanently removes the order from orders, reports and the customer history, and its tracking link stops working. This cannot be undone.',
      }),
      [
        { text: t('mobile.cancelBtn', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('mobile.deleteOrderConfirm', { defaultValue: 'Delete permanently' }),
          style: 'destructive',
          onPress: () => { void runDeleteOrder(); },
        },
      ],
    );
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
        staffId: getAgentId() || 'staff',
        staffName: getAgentName() || 'Staff',
        notes: cancelReason || 'Cancelled from staff app',
        notifiedCustomer: false,
      };
      // Cancel → auto-refund any collected cash (audit-logged) and void the balance,
      // so the order contributes nothing to sales / collected / dues anywhere.
      const priorPaid = fin.amountPaid || 0;
      const cancelUpdate: any = {
        status: 'cancelled',
        updatedAt: new Date(),
        timeline: [...currentTimeline, cancelEvent],
        'financials.balance': 0,
      };
      if (priorPaid > 0) {
        cancelUpdate['financials.amountPaid'] = 0;
        cancelUpdate['financials.refundedAmount'] = (fin.refundedAmount || 0) + priorPaid;
        cancelUpdate.refunds = [...(order?.refunds || []), {
          id: `r-${Date.now()}`,
          amount: priorPaid,
          reason: 'order_cancelled',
          refundedBy: getAgentName() || 'Staff',
          refundedAt: new Date(),
        }];
      }
      await orderDocRef().update(cancelUpdate);
      // Loyalty reversal: return redeemed points to the customer and revoke any
      // points this order earned (mirrors the web cancel path).
      try {
        const redeemedBack = fin.pointsRedeemed || 0;
        const earnedRevoke = order?.loyalty?.earnedPoints || 0;
        if (order?.customerId && (redeemedBack > 0 || earnedRevoke > 0)) {
          const custRef = firestore().collection(`shops/${shopId}/customers`).doc(order.customerId);
          const custDoc = await custRef.get();
          if (custDoc.exists) {
            const cd = custDoc.data() || {};
            const custUpdate: any = {
              loyaltyPoints: Math.max(0, (cd.loyaltyPoints || 0) + redeemedBack - earnedRevoke),
              updatedAt: new Date(),
            };
            if (earnedRevoke > 0) custUpdate.loyaltyEarned = Math.max(0, (cd.loyaltyEarned || 0) - earnedRevoke);
            await custRef.update(custUpdate);
          }
        }
      } catch (loyErr) {
        console.error('Loyalty reversal error (non-fatal):', loyErr);
      }
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

  // A4 bill or 80mm till-roll — the same choice the web print buttons offer.
  const printReceipt = async (thermal: boolean) => {
    try {
      const html = generateReceiptHtml(order, shopData, t, countrySettings.locale || i18n.language, countrySettings.currencySymbol || '₹', thermal);
      // 80mm ≈ 227pt page width; the print dialog fits it to the roll.
      await Print.printAsync(thermal ? { html, width: 227 } : { html });
    } catch (e: any) {
      Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedPrintReceipt'));
    }
  };

  const handlePrintReceipt = () => {
    Alert.alert(
      t('mobile.printSizeTitle', 'Print receipt'),
      t('mobile.printSizeMsg', 'Choose the paper size'),
      [
        { text: t('mobile.printA4', 'A4 bill'), onPress: () => { void printReceipt(false); } },
        { text: t('mobile.print80mm', '80mm thermal'), onPress: () => { void printReceipt(true); } },
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      ],
    );
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
    // Owner customization (web Settings → WhatsApp message & tracking); shared with web.
    const ws = shopData?.settings?.waShare || {};
    const trackingOn = shopData?.settings?.trackingEnabled !== false;
    const headerLine = ws.headerText?.trim()
      ? `${ws.headerText.trim()} — #${publicId}`
      : `${shopName} — Order #${publicId}`;

    const lines = [
      headerLine,
      ``,
      `${t('mobile.waOrderStatusLine', { status: odStatusLabel(status, t) })}`,
    ];
    if (ws.showItems !== false) {
      lines.push(
        ``,
        t('mobile.waItems'),
        ...(order?.items || []).map((i: any) => `- ${i.serviceName} x${i.quantity} — ${formatCurrency(Math.round(i.total || (i.unitPrice * i.quantity)), countrySettings)}`),
      );
    }
    if (ws.showPayment !== false) {
      lines.push(``, `${t('mobile.subtotalLabel')}: ${formatCurrency(Math.round(fin.subtotal || 0), countrySettings)}`);
      if (fin.discountAmount > 0) lines.push(`${t('mobile.discountLabel')}: -${formatCurrency(Math.round(fin.discountAmount), countrySettings)}`);
      if (fin.taxAmount > 0) lines.push(`${fin.taxName || t('mobile.taxFallback')}${fin.taxRate ? ` (${fin.taxRate}%)` : ''}: +${formatCurrency(Math.round(fin.taxAmount), countrySettings)}`);
      lines.push(`${t('mobile.totalLabel')}: ${formatCurrency(Math.round(fin.total || 0), countrySettings)}`);
      if (fin.balance > 0) {
        lines.push(withCurrencySymbol(t('mobile.waBalanceDue', { amount: Math.round(fin.balance) }) as string));
      } else {
        lines.push(t('mobile.waPaidFull'));
      }
    }
    if (ws.showExpectedDate !== false && expectedDelivery) lines.push(``, `${dateLabel}: ${formatDateShortLocalized(expectedDelivery, i18n.language)}`);
    if (trackingOn) lines.push(``, `${t('mobile.waTrackOrder')}:`, trackingUrl);
    if (ws.showReceiptLink !== false) lines.push(``, `${t('mobile.waViewReceipt')}:`, getReceiptUrl(publicId));
    if (ws.footerText?.trim()) lines.push(``, ws.footerText.trim());

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
        const qrUrl = tagImageUrl(orderId, publicId, qrSize);
        bodyContent = `
          <div style="text-align:center;padding:${isThermal ? '4mm 2mm' : '20px'};">
            <img src="${qrUrl}" style="${isBarcodeTag ? `width:${isThermal ? 150 : 240}px;height:${isThermal ? 46 : 80}px;object-fit:contain;` : `width:${qrSize}px;height:${qrSize}px;`}" />
            <div style="font-size:${fontSize};font-weight:800;margin-top:6px;">#${escHtml(publicId)}</div>
            <div style="font-size:${smallFont};color:#666;margin-top:2px;">${escHtml(order?.customerName || t('mobile.guestLabel'))} · ${escHtml(t('mobile.itemsCountShort', { count: (order?.items || []).reduce((s: number, i: any) => s + (i.quantity || 1), 0) }))}</div>
          </div>`;
      } else {
        bodyContent = itemTags.map((tag) => `
          <div style="text-align:center;padding:${isThermal ? '3mm 2mm' : '16px'};${isThermal ? '' : 'display:inline-block;width:48%;margin:1%;'}border:1px dashed #ccc;border-radius:4px;page-break-inside:avoid;margin-bottom:${isThermal ? '2mm' : '8px'};">
            <img src="${tagImageUrl(tag.qrData, tag.qrData.replace(orderId, publicId), qrSize)}" style="${isBarcodeTag ? `width:${isThermal ? 120 : 150}px;height:${isThermal ? 46 : 52}px;object-fit:contain;` : `width:${isThermal ? 100 : 150}px;height:${isThermal ? 100 : 150}px;`}" />
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
            {order.orderSource === 'online' ? (
              <View style={styles.onlineTag}>
                <MaterialIcons name="public" size={12} color="#0369a1" />
                <Text style={styles.onlineTagText}>{t('orders.onlineOrders', 'Online')}</Text>
              </View>
            ) : null}
          </View>
          <HelpButton pageId="mobile_orderDetails" />
          {!isTerminal && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => onEditOrder ? onEditOrder(order) : (() => { setEditNotes(order.deliveryNotes || ''); setEditDeliveryType(deliveryType); setEditModal(true); })()}>
              <MaterialIcons name="edit" size={22} color="#00408f" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 30 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        {/* ─── Status hero: where the order is + what to do next ──── */}
        <View style={styles.heroCard}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>{t('mobile.orderPlacedLabel', 'Order placed')}</Text>
              <Text style={styles.heroValue}>{formatDateLocalized(createdAt, i18n.language)}</Text>
            </View>
            <View style={styles.deliveryTypeBadge}>
              <Text style={styles.deliveryTypeText}>{t(deliveryLabelKey(deliveryType))}</Text>
            </View>
          </View>

          {status === 'cancelled' ? (
            <View style={[styles.expectStrip, { backgroundColor: colors.errorBg }]}>
              <MaterialIcons name="cancel" size={17} color={colors.error} />
              <Text style={[styles.expectValue, { color: colors.error, marginLeft: 8 }]}>{odStatusLabel('cancelled', t)}</Text>
            </View>
          ) : (
            <>
              {currentFlowIndex >= 0 ? (
                <View>
                  <View style={styles.trackRow}>
                    {flow.map((s, i) => (
                      <React.Fragment key={s}>
                        {i > 0 ? <View style={[styles.trackSeg, i <= currentFlowIndex && styles.trackSegDone]} /> : null}
                        <View style={[styles.trackDot, i < currentFlowIndex ? styles.trackDotDone : null, i === currentFlowIndex ? { borderColor: statusColor.text } : null]}>
                          {i < currentFlowIndex ? (
                            <MaterialIcons name="check" size={10} color="#fff" />
                          ) : i === currentFlowIndex ? (
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor.text }} />
                          ) : null}
                        </View>
                      </React.Fragment>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Text style={[styles.trackNow, { color: statusColor.text }]}>{odStatusLabel(status, t)}</Text>
                    <Text style={styles.trackStep}>  ·  {t('mobile.stepOf', 'Step {{current}} of {{total}}', { current: currentFlowIndex + 1, total: flow.length })}</Text>
                  </View>
                </View>
              ) : null}

              {deliveredPieces > 0 && deliveredPieces < totalPieces ? (
                <View>
                  <View style={styles.piecesBarTrack}>
                    <View style={[styles.piecesBarFill, { width: `${Math.min(100, Math.round((deliveredPieces / Math.max(1, totalPieces)) * 100))}%` }]} />
                  </View>
                  <Text style={styles.piecesBarText}>{t('mobile.piecesDelivered', '{{done}}/{{total}} pieces delivered', { done: deliveredPieces, total: totalPieces })}</Text>
                </View>
              ) : null}

              {isTerminal ? (
                <View style={[styles.expectStrip, { backgroundColor: colors.successBg }]}>
                  <MaterialIcons name="check-circle" size={17} color={colors.success} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.expectLabel, { color: colors.success }]}>{odStatusLabel(status, t)}</Text>
                    <Text style={[styles.expectValue, { color: colors.success }]}>{formatDateLocalized(toDate(order.deliveredAt) || expectedDelivery, i18n.language)}</Text>
                  </View>
                </View>
              ) : expectedDelivery ? (
                <View style={[styles.expectStrip, isOverdue && { backgroundColor: colors.errorBg }]}>
                  <MaterialIcons name={isOverdue ? 'warning-amber' : 'event'} size={17} color={isOverdue ? colors.error : colors.primary} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.expectLabel, isOverdue && { color: colors.error }]}>{deliveryType === 'pickup_store' ? t('mobile.expectedReadyUpper') : t('mobile.expectedDeliveryUpper')}</Text>
                    <Text style={[styles.expectValue, isOverdue && { color: colors.error }]}>{formatDateShortLocalized(expectedDelivery, i18n.language)}</Text>
                  </View>
                  {isOverdue ? (
                    <View style={styles.overdueTag}><Text style={styles.overdueTagText}>{t('orders.overdue', 'Overdue')}</Text></View>
                  ) : null}
                </View>
              ) : null}

              {nextStatus ? (
                <TouchableOpacity style={styles.heroCta} onPress={() => { setSelectedStatus(nextStatus); setStatusModal(true); }}>
                  <Text style={styles.heroCtaText}>{t('mobile.markAsBtn', 'Mark as {{status}}', { status: odStatusLabel(nextStatus, t) })}</Text>
                  <MaterialIcons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
              ) : null}
              {!isTerminal ? (
                <TouchableOpacity style={styles.heroLink} onPress={() => { setSelectedStatus(''); setStatusModal(true); }}>
                  <Text style={styles.heroLinkText}>{t('mobile.allStatusesLink', 'View all statuses')}</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>

        {/* ─── Quick actions: receipt / pdf / tags / share ────────── */}
        <View style={styles.qaRow}>
          <TouchableOpacity style={styles.qaTile} onPress={handlePrintReceipt}>
            <View style={styles.qaIconWrap}><MaterialIcons name="print" size={18} color="#5e3c00" /></View>
            <Text style={styles.qaLabel}>{t('mobile.printChip')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.qaTile} onPress={handleShareReceiptPdf}>
            <View style={[styles.qaIconWrap, { backgroundColor: '#fde8e8' }]}><MaterialIcons name="picture-as-pdf" size={18} color="#c62828" /></View>
            <Text style={styles.qaLabel}>{t('mobile.pdfChip')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.qaTile} onPress={() => setTagOpen(true)}>
            <View style={[styles.qaIconWrap, { backgroundColor: colors.primaryTint }]}><MaterialIcons name="qr-code-2" size={18} color={colors.primary} /></View>
            <Text style={styles.qaLabel}>{t('mobile.qrCodeChip')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.qaTile} onPress={handleShare}>
            <View style={[styles.qaIconWrap, { backgroundColor: '#e6f7f2' }]}><MaterialIcons name="share" size={18} color="#006b5f" /></View>
            <Text style={styles.qaLabel}>{t('mobile.shareChip')}</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Online booking estimate (public page) ──────────────── */}
        {order.orderSource === 'online' ? (
          <View style={styles.onlineCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialIcons name="public" size={18} color="#0369a1" />
              <Text style={styles.onlineCardTitle}>{t('mobile.onlineBookingTitle', 'Online booking')}</Text>
              <Text style={styles.onlineCardHint}>{t('orders.pricedAtPickup', 'Priced at pickup')}</Text>
            </View>
            {(order.estimatedWeight || order.estimatedPieces) ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {order.estimatedWeight ? (
                  <View style={styles.estChip}>
                    <MaterialIcons name="scale" size={13} color="#0c4a6e" />
                    <Text style={styles.estChipText}>{order.estimatedWeight}</Text>
                  </View>
                ) : null}
                {order.estimatedPieces ? (
                  <View style={styles.estChip}>
                    <MaterialIcons name="checkroom" size={13} color="#0c4a6e" />
                    <Text style={styles.estChipText}>{order.estimatedPieces}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ─── Customer ───────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.customerRow}>
            <View style={styles.customerAvatar}><MaterialIcons name="person" size={20} color="#00408f" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.customerName}>{order.customerName || t('mobile.guestLabel')}</Text>
              {/* Fall back to email when the customer has no phone (email-only customers). */}
              <Text style={styles.customerPhone}>{order.customerPhone || order.customerEmail || t('mobile.noPhoneLabel')}</Text>
            </View>
            {order.customerPhone ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.smallCircleBtn} onPress={() => Linking.openURL(`tel:${(order.customerPhone || '').replace(/\D/g, '')}`).catch(() => {})}>
                  <MaterialIcons name="call" size={16} color="#00408f" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.smallCircleBtn, { backgroundColor: '#e6f7f2' }]} onPress={() => {
                  const wa = buildWhatsAppNumber(order.customerPhone || '', countrySettings);
                  Linking.openURL(`https://wa.me/${wa}`).catch(() => {});
                }}>
                  <MaterialIcons name="chat" size={16} color="#25D366" />
                </TouchableOpacity>
              </View>
            ) : order.customerEmail ? (
              <TouchableOpacity style={styles.smallCircleBtn} onPress={() => Linking.openURL(`mailto:${order.customerEmail}`).catch(() => {})}>
                <MaterialIcons name="mail-outline" size={16} color="#00408f" />
              </TouchableOpacity>
            ) : null}
          </View>
          {(order.deliveryAddress || order.pickupAddress) ? (
            <TouchableOpacity style={styles.addressRow} onPress={() => {
              const q = order.deliveryLat && order.deliveryLng
                ? `${order.deliveryLat},${order.deliveryLng}`
                : encodeURIComponent(order.deliveryAddress || order.pickupAddress || '');
              Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() => {});
            }}>
              <MaterialIcons name="location-on" size={15} color={colors.textSecondary} />
              <Text style={styles.addressText} numberOfLines={2}>{order.deliveryAddress || order.pickupAddress}</Text>
              <MaterialIcons name="directions" size={18} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ─── Delivery details: schedule / area / agent / notes ──── */}
        {(order.deliveryArea || order.assignedAgentName || order.deliveryNotes || order.scheduledPickupDate || order.scheduledPickupTime || order.deliverySlot) ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('mobile.deliverySectionTitle', 'Delivery details')}</Text>
            {order.scheduledPickupDate || order.scheduledPickupTime ? (
              <View style={styles.dRow}>
                <MaterialIcons name="event" size={16} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.dLabel}>{t('mobile.pickupDateLabel', 'Pickup date')}</Text>
                  <Text style={styles.dValue}>
                    {[
                      order.scheduledPickupDate ? formatDateShortLocalized(toDate(order.scheduledPickupDate), i18n.language) : null,
                      order.scheduledPickupTime || null,
                    ].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </View>
            ) : null}
            {order.deliverySlot ? (
              <View style={styles.dRow}>
                <MaterialIcons name="schedule" size={16} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.dLabel}>{t('mobile.deliverySlotLabel', 'Delivery slot')}</Text>
                  <Text style={styles.dValue}>{order.deliverySlot}</Text>
                </View>
              </View>
            ) : null}
            {order.deliveryArea ? (
              <View style={styles.dRow}>
                <MaterialIcons name="map" size={16} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.dLabel}>{t('mobile.serviceAreaLabel', 'Service area')}</Text>
                  <Text style={styles.dValue}>{order.deliveryArea}</Text>
                </View>
              </View>
            ) : null}
            {order.assignedAgentName ? (
              <View style={styles.dRow}>
                <MaterialIcons name="local-shipping" size={16} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.dLabel}>{t('mobile.deliveryAgentLabel', 'Delivery agent')}</Text>
                  <Text style={styles.dValue}>{order.assignedAgentName}</Text>
                </View>
              </View>
            ) : null}
            {order.deliveryNotes ? (
              <View style={styles.dRow}>
                <MaterialIcons name="sticky-note-2" size={16} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.dLabel}>{t('mobile.fieldNotes')}</Text>
                  <Text style={styles.dValue}>{order.deliveryNotes}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ─── Order photos: damage/pickup/delivery/plant, captioned who + when ── */}
        {(() => {
          const photos: { url: string; label: string }[] = [
            ...((order.damagePhotoUrls || []) as string[]).map((url: string) => ({ url, label: t('mobile.photoDamage', 'Damage / stain') })),
            ...(order.pickupPhoto ? [{ url: order.pickupPhoto, label: t('mobile.photoPickup', 'Pickup proof') }] : []),
            ...(order.deliveryPhoto ? [{ url: order.deliveryPhoto, label: t('mobile.photoDelivery', 'Delivery proof') }] : []),
            ...(order.plantPhoto && order.plantPhoto !== (order.damagePhotoUrls || []).slice(-1)[0] ? [{ url: order.plantPhoto, label: t('mobile.photoPlant', 'Plant processing') }] : []),
          ];
          if (!photos.length) return null;
          const roleLabel = (r: string) => ({ owner: t('mobile.roleOwner', 'Owner'), manager: t('mobile.roleManager', 'Manager'), staff: t('mobile.roleStaff', 'Staff'), agent: t('mobile.roleAgent', 'Agent'), plant: t('mobile.rolePlant', 'Plant') } as Record<string, string>)[r] || r;
          const metaFor = (url: string) => (order.photoMeta || []).find((m: any) => m?.url === url) || null;
          return (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('mobile.orderPhotosTitle', 'Order photos')} · {photos.length}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {photos.map((p, i) => {
                    const m: any = metaFor(p.url);
                    const when = m?.at ? formatDateShortLocalized(toDate(m.at), i18n.language) : null;
                    return (
                      <TouchableOpacity key={p.url + i} activeOpacity={0.8} onPress={() => Linking.openURL(p.url).catch(() => {})} style={{ width: 96 }}>
                        <Image source={{ uri: p.url }} style={{ width: 96, height: 96, borderRadius: 10, backgroundColor: colors.surfaceMuted }} />
                        <Text style={{ fontSize: 10.5, fontFamily: fonts.bold, color: colors.textSecondary, marginTop: 5 }} numberOfLines={1}>{p.label}</Text>
                        {m ? (
                          <Text style={{ fontSize: 10, fontFamily: fonts.medium, color: colors.textMuted, lineHeight: 13 }} numberOfLines={2}>
                            {m.byName} ({roleLabel(m.byRole)}){when ? `\n${when}` : ''}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          );
        })()}

        {/* ─── Items ──────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={[styles.cardTitle, { marginBottom: 0, flex: 1 }]}>{t('mobile.itemsSectionTitle', 'Items')} · {totalPieces}</Text>
            {deliveredPieces > 0 && deliveredPieces < totalPieces ? (
              <View style={styles.piecesChip}>
                <Text style={styles.piecesChipText}>{t('mobile.piecesDelivered', '{{done}}/{{total}} pieces delivered', { done: deliveredPieces, total: totalPieces })}</Text>
              </View>
            ) : null}
          </View>
          {orderItems.length > 0 && (anyProcessable || anyDeliverable) ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {anyProcessable && !deliverMode ? (
                <TouchableOpacity disabled={itemBusy} onPress={processAll} style={[styles.itemActionBtn, { opacity: itemBusy ? 0.6 : 1 }]}>
                  <MaterialIcons name="done-all" size={15} color="#00408f" />
                  <Text style={styles.itemActionText}>{t('mobile.markAllProcessed', 'All processed')}</Text>
                </TouchableOpacity>
              ) : null}
              {anyDeliverable ? (
                <TouchableOpacity disabled={itemBusy} onPress={() => (deliverMode ? (setDeliverMode(false), setDeliverDraft({})) : enterDeliver())}
                  style={[styles.itemActionBtn, !deliverMode && styles.itemActionBtnPrimary, { opacity: itemBusy ? 0.6 : 1 }]}>
                  {!deliverMode ? <MaterialIcons name="shopping-bag" size={15} color="#fff" /> : null}
                  <Text style={[styles.itemActionText, !deliverMode && { color: '#fff' }]}>
                    {deliverMode ? t('mobile.cancelBtn', 'Cancel') : t('mobile.deliverItems', 'Deliver items')}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          {deliverMode ? (
            <View style={styles.deliverBar}>
              <Text style={styles.deliverBarText}>{t('mobile.setDeliverQty', 'Set how many pieces the customer is taking')}</Text>
              <TouchableOpacity disabled={!draftPieces || itemBusy} onPress={confirmDeliver}
                style={[styles.deliverBarBtn, { backgroundColor: draftPieces ? '#00408f' : '#C9D4E4', opacity: itemBusy ? 0.6 : 1 }]}>
                <Text style={styles.deliverBarBtnText}>
                  {t('mobile.deliverSelected', 'Deliver selected')}{draftPieces ? ` (${draftPieces})` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
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
              {group.items.map((item: any, idx: number) => {
                const fi = orderItems.indexOf(item);
                const p = lineProg[fi];
                const pill = pillFor(p);
                const deliverRem = p.processed - p.delivered;   // only PROCESSED pieces can be handed over
                const procRem = p.qty - p.processed;
                const awaitingProcess = deliverMode && deliverRem === 0 && p.delivered < p.qty;
                const draft = deliverDraft[fi] ?? 0;
                const stepOpen = procOpen === fi;
                return (
                <View key={item.id || idx}>
                  <View style={[styles.serviceItem, deliverMode && draft > 0 ? { backgroundColor: '#EBF2FF', borderRadius: 8 } : null]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{item.serviceName}</Text>
                      <Text style={styles.itemMeta}>x{item.quantity}{item.pieceCount ? ` · ${item.pieceCount} pcs` : ''} · {formatCurrency(Math.round(item.unitPrice), countrySettings)} ea.{item.express ? t('mobile.expressSuffixShort') : ''}</Text>
                      {(itemTracking || p.processed > 0 || p.delivered > 0) ? (
                        <View style={{ flexDirection: 'row', marginTop: 3 }}>
                          <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: pill.bg }}>
                            <Text style={{ fontSize: 9.5, fontWeight: '700', color: pill.fg }}>{pill.label}</Text>
                          </View>
                        </View>
                      ) : null}
                    </View>

                    {awaitingProcess ? (
                      <Text style={{ fontSize: 11, fontStyle: 'italic', color: '#9CA3AF', marginRight: 8 }}>{t('mobile.processFirst', 'Not processed yet')}</Text>
                    ) : null}

                    {deliverMode && deliverRem > 0 ? (
                      p.qty > 1 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 }}>
                          <TouchableOpacity onPress={() => setDraft(fi, draft - 1)} style={stepBtnStyle}><Text style={stepTxtStyle}>−</Text></TouchableOpacity>
                          <Text style={{ minWidth: 32, textAlign: 'center', fontWeight: '700', fontSize: 12.5 }}>{draft}<Text style={{ color: '#9CA3AF', fontWeight: '400' }}>/{deliverRem}</Text></Text>
                          <TouchableOpacity onPress={() => setDraft(fi, draft + 1)} style={stepBtnStyle}><Text style={stepTxtStyle}>＋</Text></TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity onPress={() => setDraft(fi, draft > 0 ? 0 : 1)} style={{ marginRight: 8 }}>
                          <MaterialIcons name={draft > 0 ? 'check-box' : 'check-box-outline-blank'} size={22} color="#00408f" />
                        </TouchableOpacity>
                      )
                    ) : null}

                    {!deliverMode && itemsEditable && procRem > 0 ? (
                      p.qty > 1 && stepOpen ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 }}>
                          <TouchableOpacity onPress={() => setProcQty(Math.max(1, procQty - 1))} style={stepBtnStyle}><Text style={stepTxtStyle}>−</Text></TouchableOpacity>
                          <Text style={{ minWidth: 32, textAlign: 'center', fontWeight: '700', fontSize: 12.5 }}>{Math.min(procQty, procRem)}<Text style={{ color: '#9CA3AF', fontWeight: '400' }}>/{procRem}</Text></Text>
                          <TouchableOpacity onPress={() => setProcQty(Math.min(procRem, procQty + 1))} style={stepBtnStyle}><Text style={stepTxtStyle}>＋</Text></TouchableOpacity>
                          <TouchableOpacity disabled={itemBusy} onPress={() => processMore(fi, Math.min(procQty, procRem))} style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, backgroundColor: '#E6F0FF', opacity: itemBusy ? 0.6 : 1 }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#00408f' }}>{t('mobile.process', 'Process')}</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity disabled={itemBusy} onPress={() => { if (p.qty > 1) { setProcOpen(fi); setProcQty(procRem); } else { processMore(fi, procRem); } }}
                          style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, backgroundColor: '#E6F0FF', marginRight: 8, opacity: itemBusy ? 0.6 : 1 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#00408f' }}>{t('mobile.itemMarkProcessed', '✓ Done')}</Text>
                        </TouchableOpacity>
                      )
                    ) : null}
                    <Text style={styles.itemTotal}>{formatCurrency(Math.round(item.total), countrySettings)}</Text>
                  </View>
                  {idx < group.items.length - 1 ? <View style={styles.separator} /> : null}
                </View>
                );
              })}
            </View>
          </View>
        ))}
        </View>

        {/* ─── Payment ────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('mobile.paymentSummaryTitle')}</Text>
          <View style={[styles.payBanner, fin.balance > 0 ? styles.unpaidBg : styles.paidBg]}>
            <MaterialIcons name={fin.balance > 0 ? 'schedule' : 'check-circle'} size={16} color={fin.balance > 0 ? '#93000a' : '#006b5f'} />
            <Text style={[styles.payBannerText, { color: fin.balance > 0 ? '#93000a' : '#006b5f' }]} numberOfLines={1}>
              {fin.balance > 0 ? withCurrencySymbol(t('mobile.waBalanceDue', { amount: Math.round(fin.balance) }) as string) : t('mobile.paidInFull')}
            </Text>
            {fin.balance > 0 && status !== 'cancelled' ? (
              <TouchableOpacity style={styles.collectBtn} onPress={() => { setPayAmount(String(Math.round(fin.balance))); setPaymentModal(true); }}>
                <Text style={styles.collectBtnText}>{t('mobile.collectBtnShort', 'Collect')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.finRow}><Text style={styles.finLabel}>{t('mobile.subtotalLabel')}</Text><Text style={styles.finValue}>{formatCurrency(Math.round(fin.subtotal || 0), countrySettings)}</Text></View>
          {fin.discountAmount > 0 && <View style={styles.finRow}><Text style={styles.finLabel}>{fin.couponCode ? `${t('mobile.couponRowLabel', 'Coupon')} ${fin.couponCode}` : t('mobile.discountLabel')}</Text><Text style={[styles.finValue, { color: '#006b5f' }]}>-{formatCurrency(Math.round(fin.discountAmount), countrySettings)}</Text></View>}
          {(fin.pointsRedeemed || 0) > 0 && <View style={styles.finRow}><Text style={styles.finLabel}>{t('mobile.pointsRedeemedLabel', 'Points redeemed')}</Text><Text style={[styles.finValue, { color: '#006b5f' }]}>-{formatCurrency(Math.round(fin.pointsRedeemed), countrySettings)}</Text></View>}
          {(order?.loyalty?.earnedPoints || 0) > 0 && <View style={styles.finRow}><Text style={styles.finLabel}>{t('mobile.pointsEarnedLabel', 'Cashback earned')}</Text><Text style={[styles.finValue, { color: '#b8860b' }]}>+{order.loyalty.earnedPoints} {t('mobile.ptsSuffix', 'pts')}</Text></View>}
          {fin.expressCharge > 0 && <View style={styles.finRow}><Text style={styles.finLabel}>{t('mobile.expressChargeLabel')}</Text><Text style={styles.finValue}>+{formatCurrency(Math.round(fin.expressCharge), countrySettings)}</Text></View>}
          {fin.taxAmount > 0 && <View style={styles.finRow}><Text style={styles.finLabel}>{fin.taxName || t('mobile.taxFallback')}{fin.taxRate ? ` (${fin.taxRate}%)` : ''}</Text><Text style={styles.finValue}>+{formatCurrency(Math.round(fin.taxAmount), countrySettings)}</Text></View>}
          {fin.deliveryCharge > 0 && <View style={styles.finRow}><Text style={styles.finLabel}>{t('mobile.deliveryChargeLabel')}</Text><Text style={styles.finValue}>+{formatCurrency(Math.round(fin.deliveryCharge), countrySettings)}</Text></View>}
          <View style={styles.divider} />
          <View style={styles.finRow}><Text style={styles.totalLabel}>{t('mobile.totalLabel')}</Text><Text style={styles.totalValue}>{formatCurrency(Math.round(fin.total || 0), countrySettings)}</Text></View>
          <View style={styles.finRow}><Text style={styles.finLabel}>{t('mobile.paidLabelFin')}</Text><Text style={styles.finValue}>{formatCurrency(Math.round(fin.amountPaid || 0), countrySettings)}</Text></View>
          {(fin.refundedAmount || 0) > 0 ? (
            <View style={styles.finRow}><Text style={styles.finLabel}>{t('mobile.refundedLabel', 'Refunded')}</Text><Text style={[styles.finValue, { color: '#93000a' }]}>{formatCurrency(Math.round(fin.refundedAmount), countrySettings)}</Text></View>
          ) : null}
          {payments.length > 0 ? (
            <View style={{ marginTop: 2 }}>
              <Text style={styles.payHistTitle}>{t('mobile.paymentsHistoryTitle', 'Payments')}</Text>
              {payments.map((p: any, i: number) => (
                <View key={p.id || i} style={styles.payHistRow}>
                  <MaterialIcons name={p.method === 'upi' ? 'phone-android' : p.method === 'card' ? 'credit-card' : 'payments'} size={14} color={colors.textSecondary} />
                  <Text style={styles.payHistAmt}>{formatCurrency(Math.round(p.amount || 0), countrySettings)}</Text>
                  <Text style={styles.payHistMeta} numberOfLines={1}>{formatDateLocalized(toDate(p.collectedAt), i18n.language)}{p.collectedBy ? ` · ${p.collectedBy}` : ''}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* ─── Activity (collapsed to the latest 3) ───────────────── */}
        {timeline.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('mobile.timelineTitle')}</Text>
            {shownTimeline.map((entry: any, i: number) => {
              const entryDate = toDate(entry.timestamp);
              const ec = STATUS_COLORS[entry.status] || STATUS_COLORS.pending;
              return (
                <View key={entry.id || i} style={styles.timelineEntry}>
                  <View style={[styles.timelineDot, { backgroundColor: i === 0 ? ec.text : '#c3c6d6' }]} />
                  {i < shownTimeline.length - 1 && <View style={styles.timelineLine} />}
                  <View style={styles.timelineContent}>
                    <Text style={[styles.timelineStatus, i === 0 && { color: ec.text, fontWeight: '700' }]}>{odStatusLabel(entry.status, t)}</Text>
                    <Text style={styles.timelineTime}>{formatDateLocalized(entryDate, i18n.language)}</Text>
                    {entry.staffName ? <Text style={styles.timelineStaff}>{t('mobile.timelineBy', { name: entry.staffName })}</Text> : null}
                    {entry.notes ? <Text style={styles.timelineNotes}>{entry.notes}</Text> : null}
                  </View>
                </View>
              );
            })}
            {timeline.length > 3 ? (
              <TouchableOpacity style={styles.timelineToggle} onPress={() => setShowAllTimeline(!showAllTimeline)}>
                <Text style={styles.heroLinkText}>
                  {showAllTimeline ? t('mobile.showLessTimeline', 'Show less') : t('mobile.viewAllTimeline', 'View all ({{count}})', { count: timeline.length })}
                </Text>
                <MaterialIcons name={showAllTimeline ? 'expand-less' : 'expand-more'} size={16} color={colors.primary} />
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* ─── Cancel order (kept out of the way, still reachable) ── */}
        {!isTerminal && ['pending', 'processing', 'confirmed', 'pickup_scheduled'].includes(status) ? (
          <TouchableOpacity style={styles.cancelOrderBtn} onPress={() => setCancelModal(true)}>
            <MaterialIcons name="cancel" size={16} color="#c62828" />
            <Text style={styles.cancelOrderText}>{t('mobile.cancelOrderChip')}</Text>
          </TouchableOpacity>
        ) : null}

        {/* ─── Delete order — permanent, managers only; staff/agents never see it ─────────────── */}
        {isManager ? <TouchableOpacity style={[styles.cancelOrderBtn, { marginTop: 10 }]} onPress={confirmDeleteOrder} disabled={deleting}>
          {deleting
            ? <ActivityIndicator size="small" color="#c62828" />
            : <MaterialIcons name="delete-forever" size={16} color="#c62828" />}
          <Text style={styles.cancelOrderText}>{t('mobile.deleteOrderChip', { defaultValue: 'Delete order' })}</Text>
        </TouchableOpacity> : null}
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

            {/* Code style: QR or Code128 barcode */}
            <View style={styles.qrTabRow}>
              <TouchableOpacity style={[styles.qrTabBtn, !isBarcodeTag && styles.qrTabBtnActive]} onPress={() => setTagStyle('qr')}>
                <MaterialIcons name="qr-code-2" size={16} color={!isBarcodeTag ? '#fff' : '#434654'} />
                <Text style={[styles.qrTabText, !isBarcodeTag && styles.qrTabTextActive]}>{t('mobile.tagStyleQr', 'QR code')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.qrTabBtn, isBarcodeTag && styles.qrTabBtnActive]} onPress={() => setTagStyle('barcode')}>
                <MaterialIcons name="view-week" size={16} color={isBarcodeTag ? '#fff' : '#434654'} />
                <Text style={[styles.qrTabText, isBarcodeTag && styles.qrTabTextActive]}>{t('mobile.tagStyleBarcode', 'Barcode')}</Text>
              </TouchableOpacity>
            </View>

            {qrTab === 'order' ? (
              /* ── Order / Basket QR ──── */
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <View style={styles.qrContainer}>
                  <Image source={{ uri: tagImageUrl(orderId, publicId, 220) }} style={isBarcodeTag ? { width: 240, height: 86 } : { width: 200, height: 200 }} resizeMode="contain" />
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
                      <Image source={{ uri: tagImageUrl(tag.qrData, tag.qrData.replace(orderId, publicId), 150) }} style={isBarcodeTag ? { width: 120, height: 52 } : styles.itemTagQr} resizeMode="contain" />
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

      {/* Owner-parity tag sheet (QR / Code128 barcode, Print + Share PDF, size hint) —
          the same TagSheet the plant screen uses, so staff/manager match plant & owner. */}
      <TagSheet order={order} open={tagOpen} onClose={() => setTagOpen(false)} />
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

  // Online order
  onlineTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#e0f2fe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  onlineTagText: { fontSize: 11, fontFamily: fonts.bold, color: '#0369a1' },
  onlineCard: { backgroundColor: '#f0f9ff', borderRadius: radii.card, padding: 14, borderWidth: 1, borderColor: '#bae6fd' },
  onlineCardTitle: { fontSize: 13.5, fontFamily: fonts.bold, color: '#0c4a6e', flex: 1 },
  onlineCardHint: { fontSize: 11, fontFamily: fonts.medium, color: '#0369a1' },
  estChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#bae6fd', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  estChipText: { fontSize: 12.5, fontFamily: fonts.bold, color: '#0c4a6e' },

  // Status hero
  heroCard: { backgroundColor: colors.surface, borderRadius: radii.card, padding: 16, gap: 12, ...shadows.card, ...shadows.cardBorder },
  heroLabel: { fontSize: 9.5, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase' },
  heroValue: { fontSize: 13.5, fontFamily: fonts.bold, color: colors.text, marginTop: 2 },
  trackRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  trackDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  trackDotDone: { backgroundColor: colors.success, borderColor: colors.success },
  trackSeg: { flex: 1, height: 2.5, backgroundColor: colors.border, marginHorizontal: 2, borderRadius: 2 },
  trackSegDone: { backgroundColor: colors.success },
  trackNow: { fontSize: 15, fontFamily: fonts.bold },
  trackStep: { fontSize: 11.5, fontFamily: fonts.medium, color: colors.textMuted },
  piecesBarTrack: { height: 6, borderRadius: 3, backgroundColor: '#F1F3F5', overflow: 'hidden' },
  piecesBarFill: { height: 6, borderRadius: 3, backgroundColor: '#F59E0B' },
  piecesBarText: { fontSize: 11, fontFamily: fonts.bold, color: '#B45309', marginTop: 4 },
  expectStrip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF4FB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  expectLabel: { fontSize: 9, fontFamily: fonts.bold, color: colors.primary, letterSpacing: 0.5, textTransform: 'uppercase' },
  expectValue: { fontSize: 13.5, fontFamily: fonts.bold, color: colors.text, marginTop: 1 },
  overdueTag: { backgroundColor: colors.error, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  overdueTagText: { fontSize: 9.5, fontFamily: fonts.bold, color: '#fff', letterSpacing: 0.5, textTransform: 'uppercase' },
  heroCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: radii.button, backgroundColor: colors.primary },
  heroCtaText: { fontSize: 14.5, fontFamily: fonts.bold, color: '#fff' },
  heroLink: { alignSelf: 'center', paddingVertical: 2, paddingHorizontal: 8, marginTop: -4 },
  heroLinkText: { fontSize: 12, fontFamily: fonts.semibold, color: colors.primary },

  // Quick actions
  qaRow: { flexDirection: 'row', gap: 8 },
  qaTile: { flex: 1, alignItems: 'center', gap: 5, backgroundColor: colors.surface, borderRadius: radii.card, paddingVertical: 10, borderWidth: 1, borderColor: colors.border },
  qaIconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.warningBg, alignItems: 'center', justifyContent: 'center' },
  qaLabel: { fontSize: 10.5, fontFamily: fonts.semibold, color: colors.textSecondary },

  // Customer address + delivery rows
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceMuted, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  addressText: { flex: 1, fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary },
  dRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 3 },
  dLabel: { fontSize: 9, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase' },
  dValue: { fontSize: 13, fontFamily: fonts.semibold, color: colors.text, marginTop: 1 },

  // Items card
  piecesChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: '#FFF4E5' },
  piecesChipText: { fontSize: 11, fontFamily: fonts.bold, color: '#B45309' },
  itemActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: radii.button, backgroundColor: '#E6F0FF' },
  itemActionBtnPrimary: { backgroundColor: colors.primary },
  itemActionText: { fontSize: 12.5, fontFamily: fonts.bold, color: colors.primary },
  deliverBar: { backgroundColor: '#EFF4FB', borderRadius: 10, padding: 10, gap: 8 },
  deliverBarText: { fontSize: 12, fontFamily: fonts.semibold, color: colors.primary },
  deliverBarBtn: { borderRadius: radii.button, alignItems: 'center', paddingVertical: 10 },
  deliverBarBtnText: { fontSize: 13, fontFamily: fonts.bold, color: '#fff' },

  // Payment
  payBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4 },
  payBannerText: { flex: 1, fontSize: 13.5, fontFamily: fonts.bold },
  collectBtn: { backgroundColor: '#006b5f', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  collectBtnText: { fontSize: 12.5, fontFamily: fonts.bold, color: '#fff' },
  payHistTitle: { fontSize: 10, fontFamily: fonts.bold, color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4, marginTop: 4 },
  payHistRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  payHistAmt: { fontSize: 12.5, fontFamily: fonts.bold, color: colors.text },
  payHistMeta: { flex: 1, fontSize: 11, fontFamily: fonts.medium, color: colors.textSecondary },

  // Timeline toggle + cancel
  timelineToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 4 },
  cancelOrderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radii.button, borderWidth: 1, borderColor: '#f5c6cb', backgroundColor: colors.surface },
  cancelOrderText: { fontSize: 13, fontFamily: fonts.bold, color: '#c62828' },

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

  // Items (grouped inside the items card — kept light so the card reads as one block)
  serviceSection: { backgroundColor: colors.surface, borderRadius: radii.input, overflow: 'hidden', borderWidth: 1, borderColor: '#EEF1F5' },
  serviceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  serviceHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  serviceTitle: { fontSize: 10, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase' },
  serviceSub: { fontSize: 10.5, fontFamily: fonts.bold, color: colors.textSecondary },
  serviceItems: { backgroundColor: colors.surface },
  serviceItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
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
