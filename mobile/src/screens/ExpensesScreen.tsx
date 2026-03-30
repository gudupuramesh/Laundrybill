import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import { formatCurrency } from '../lib/currency-format';
import { useShopCountrySettings } from '../lib/use-shop-country-settings';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { HelpButton } from '../components/HelpButton';

// ─── Constants ────────────────────────────────────────────────────────

const EXPENSE_CATEGORY_DEFS: { key: string; labelEn: string; icon: string; group: string }[] = [
  { key: 'rent', labelEn: 'Rent', icon: 'home', group: 'Utilities' },
  { key: 'electricity', labelEn: 'Electricity', icon: 'bolt', group: 'Utilities' },
  { key: 'water', labelEn: 'Water', icon: 'water-drop', group: 'Utilities' },
  { key: 'detergents', labelEn: 'Detergents', icon: 'local-laundry-service', group: 'Supplies' },
  { key: 'fabric_softener', labelEn: 'Fabric Softener', icon: 'spa', group: 'Supplies' },
  { key: 'stain_remover', labelEn: 'Stain Remover', icon: 'cleaning-services', group: 'Supplies' },
  { key: 'hangers', labelEn: 'Hangers', icon: 'checkroom', group: 'Supplies' },
  { key: 'plastic_covers', labelEn: 'Plastic Covers', icon: 'inventory-2', group: 'Supplies' },
  { key: 'tags_ribbons', labelEn: 'Tags & Ribbons', icon: 'label', group: 'Supplies' },
  { key: 'equipment', labelEn: 'Equipment', icon: 'precision-manufacturing', group: 'Equipment' },
  { key: 'maintenance', labelEn: 'Maintenance', icon: 'build', group: 'Equipment' },
  { key: 'washing_machine', labelEn: 'Washing Machine', icon: 'local-laundry-service', group: 'Equipment' },
  { key: 'transport', labelEn: 'Transport', icon: 'local-shipping', group: 'Operations' },
  { key: 'delivery', labelEn: 'Delivery', icon: 'delivery-dining', group: 'Operations' },
  { key: 'packaging', labelEn: 'Packaging', icon: 'inventory', group: 'Operations' },
  { key: 'salary', labelEn: 'Salary', icon: 'people', group: 'Business' },
  { key: 'marketing', labelEn: 'Marketing', icon: 'campaign', group: 'Business' },
  { key: 'insurance', labelEn: 'Insurance', icon: 'health-and-safety', group: 'Business' },
  { key: 'licenses', labelEn: 'Licenses', icon: 'description', group: 'Business' },
  { key: 'miscellaneous', labelEn: 'Other', icon: 'more-horiz', group: 'Other' },
];

const CAT_DEF_MAP: Record<string, { labelEn: string; icon: string; group: string }> = {};
EXPENSE_CATEGORY_DEFS.forEach((c) => { CAT_DEF_MAP[c.key] = { labelEn: c.labelEn, icon: c.icon, group: c.group }; });

const CATEGORY_COLORS: Record<string, string> = {
  Utilities: '#e65100',
  Supplies: '#006b5f',
  Equipment: '#1565c0',
  Operations: '#5e3c00',
  Business: '#7b1fa2',
  Other: '#434654',
};

type TimePeriod = 'day' | 'week' | 'month' | 'year' | 'custom';

// ─── Helpers ──────────────────────────────────────────────────────────

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  if (val instanceof Date) return val;
  return new Date(val);
}

function escHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function catLabelT(catKey: string, t: TFunction): string {
  const k = `mobile.expCat_${catKey}`;
  const tr = t(k as any);
  return tr === k ? catKey : tr;
}

function groupLabelT(group: string, t: TFunction): string {
  const map: Record<string, string> = {
    Utilities: 'mobile.expGroupUtilities',
    Supplies: 'mobile.expGroupSupplies',
    Equipment: 'mobile.expGroupEquipment',
    Operations: 'mobile.expGroupOperations',
    Business: 'mobile.expGroupBusiness',
    Other: 'mobile.expGroupOther',
  };
  const m = map[group];
  return m ? t(m as any) : group;
}

function deliveryTypeLabelT(type: string, t: TFunction): string {
  const k = `mobile.expDType_${type}`;
  const tr = t(k as any);
  return tr === k ? type : tr;
}

function formatDateLocale(d: Date | null, locale: string): string {
  if (!d) return '—';
  return d.toLocaleDateString(locale || 'en-IN', { day: 'numeric', month: 'short' });
}

function formatFullDateLocale(d: Date, locale: string): string {
  return d.toLocaleDateString(locale || 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getDateRangeLocalized(
  period: TimePeriod,
  refDate: Date,
  customStart: Date | undefined,
  customEnd: Date | undefined,
  locale: string,
): { start: Date; end: Date; label: string } {
  const now = refDate;
  const loc = locale || 'en-IN';
  const fmtD = (d: Date) => formatFullDateLocale(d, loc);
  const fmtShort = (d: Date) => d.toLocaleDateString(loc, { day: 'numeric', month: 'short' });
  switch (period) {
    case 'day': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start, end, label: fmtD(now) };
    }
    case 'week': {
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset, 0, 0, 0, 0);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
      return { start, end, label: `${fmtShort(start)} – ${fmtShort(end)}` };
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end, label: now.toLocaleDateString(loc, { month: 'short', year: 'numeric' }) };
    }
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { start, end, label: `${now.getFullYear()}` };
    }
    case 'custom': {
      const s = customStart || now;
      const e = customEnd || now;
      const start = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0);
      const end = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59, 999);
      return { start, end, label: `${fmtD(start)} – ${fmtD(end)}` };
    }
  }
}

function navigateDate(period: TimePeriod, refDate: Date, direction: number): Date {
  const d = new Date(refDate);
  switch (period) {
    case 'day': d.setDate(d.getDate() + direction); break;
    case 'week': d.setDate(d.getDate() + 7 * direction); break;
    case 'month': d.setMonth(d.getMonth() + direction); break;
    case 'year': d.setFullYear(d.getFullYear() + direction); break;
    default: break;
  }
  return d;
}

function buildFinancialReportHtml(
  f: {
    totalRevenue: number;
    totalExpenses: number;
    pending: number;
    netProfit: number;
    revenueByType: Record<string, number>;
    expByCategory: Record<string, number>;
  },
  expenses: any[],
  orders: any[],
  periodLabel: string,
  t: TFunction,
  locale: string,
  currencySymbol: string,
): string {
  const fmt = (v: number) => `${currencySymbol}${Math.round(v || 0).toLocaleString(locale || 'en-US')}`;
  const guest = t('mobile.guestLabel');
  const dash = '—';

  const expenseRows = Object.entries(f.expByCategory)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, amt]) => {
      const catInfo = CAT_DEF_MAP[cat] || { labelEn: cat, group: 'Other' };
      const cLab = escHtml(catLabelT(cat, t));
      const gLab = escHtml(groupLabelT(catInfo.group, t));
      return `<tr><td>${cLab}</td><td>${gLab}</td><td style="text-align:right">${fmt(amt)}</td></tr>`;
    }).join('');

  const revenueRows = Object.entries(f.revenueByType)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([type, amt]) => {
      const pct = f.totalRevenue > 0 ? Math.round((amt / f.totalRevenue) * 100) : 0;
      const lab = escHtml(deliveryTypeLabelT(type, t));
      return `<tr><td>${lab}</td><td style="text-align:right">${fmt(amt)}</td><td style="text-align:right">${pct}%</td></tr>`;
    }).join('');

  const expenseDetailRows = expenses
    .sort((a, b) => {
      const da = toDate(a.date);
      const db = toDate(b.date);
      return (db?.getTime() || 0) - (da?.getTime() || 0);
    })
    .map((exp) => {
      const created = toDate(exp.date);
      const cLab = escHtml(catLabelT(exp.category || 'miscellaneous', t));
      const desc = escHtml(exp.description || dash);
      const vend = escHtml(exp.vendor || dash);
      return `<tr><td>${formatFullDateLocale(created || new Date(), locale)}</td><td>${cLab}</td><td>${desc}</td><td>${vend}</td><td style="text-align:right">${fmt(exp.amount)}</td></tr>`;
    }).join('');

  const orderDetailRows = orders
    .filter((o) => o.status !== 'cancelled')
    .map((order) => {
      const total = Math.round(order.financials?.total || 0);
      const paid = Math.round(order.financials?.amountPaid || 0);
      const balance = Math.round(order.financials?.balance || 0);
      const created = toDate(order.createdAt);
      const publicId = order.publicId || order.orderNumber || order.id?.slice(-4) || '';
      const name = escHtml(order.customerName || guest);
      return `<tr><td>${formatFullDateLocale(created || new Date(), locale)}</td><td>#${escHtml(publicId)}</td><td>${name}</td><td style="text-align:right">${fmt(total)}</td><td style="text-align:right">${fmt(paid)}</td><td style="text-align:right;color:${balance > 0 ? '#c62828' : '#2e7d32'}">${fmt(balance)}</td></tr>`;
    }).join('');

  const genDate = formatFullDateLocale(new Date(), locale);
  const ordCount = orders.filter((o) => o.status !== 'cancelled').length;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #191c1e; font-size: 12px; }
    .report-header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #00408f; padding-bottom: 16px; }
    .report-header h1 { font-size: 22px; color: #00408f; margin-bottom: 4px; }
    .report-header .period { font-size: 14px; color: #434654; }
    .report-header .generated { font-size: 10px; color: #737685; margin-top: 4px; }
    .summary-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
    .summary-box { flex: 1; min-width: 120px; border-radius: 8px; padding: 12px; }
    .summary-box .label { font-size: 9px; font-weight: 700; letter-spacing: 0.5px; color: #434654; text-transform: uppercase; }
    .summary-box .value { font-size: 20px; font-weight: 800; margin-top: 2px; }
    .green { background: #e8f5e9; } .green .value { color: #2e7d32; }
    .red { background: #fce4ec; } .red .value { color: #c62828; }
    .orange { background: #fff3e0; } .orange .value { color: #e65100; }
    .blue { background: #e3f2fd; } .blue .value { color: #00408f; }
    .loss { background: #ffdad6; } .loss .value { color: #93000a; }
    .section { margin-bottom: 20px; }
    .section h2 { font-size: 14px; font-weight: 700; color: #00408f; margin-bottom: 8px; border-bottom: 1px solid #edeef0; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #f3f4f6; }
    th { font-size: 10px; font-weight: 700; color: #434654; text-transform: uppercase; letter-spacing: 0.3px; background: #f8f9fb; }
    tr:last-child td { border-bottom: none; }
    .total-row td { font-weight: 800; border-top: 2px solid #00408f; background: #f8f9fb; }
    .profit-section { text-align: center; padding: 16px; border-radius: 10px; margin-top: 16px; }
    .profit-section .label { font-size: 11px; font-weight: 700; color: #434654; }
    .profit-section .value { font-size: 28px; font-weight: 800; }
    .footer { text-align: center; margin-top: 24px; padding-top: 12px; border-top: 1px solid #edeef0; font-size: 10px; color: #737685; }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>${escHtml(t('mobile.finReportHeading'))}</h1>
    <div class="period">${escHtml(periodLabel)}</div>
    <div class="generated">${escHtml(t('mobile.finReportGeneratedOn', { date: genDate }))}</div>
  </div>

  <div class="summary-grid">
    <div class="summary-box green"><div class="label">${escHtml(t('mobile.finRepTotalIncome'))}</div><div class="value">${fmt(f.totalRevenue)}</div></div>
    <div class="summary-box red"><div class="label">${escHtml(t('mobile.finRepTotalExpenses'))}</div><div class="value">${fmt(f.totalExpenses)}</div></div>
    <div class="summary-box orange"><div class="label">${escHtml(t('mobile.finRepPendingDues'))}</div><div class="value">${fmt(f.pending)}</div></div>
    <div class="summary-box ${f.netProfit >= 0 ? 'blue' : 'loss'}"><div class="label">${escHtml(t('mobile.finRepNetProfit'))}</div><div class="value">${f.netProfit < 0 ? '-' : ''}${fmt(Math.abs(f.netProfit))}</div></div>
  </div>

  <div class="section">
    <h2>${escHtml(t('mobile.finRepSectionRevByType'))}</h2>
    <table>
      <tr><th>${escHtml(t('mobile.finRepColType'))}</th><th style="text-align:right">${escHtml(t('mobile.finRepColAmount'))}</th><th style="text-align:right">${escHtml(t('mobile.finRepColPercent'))}</th></tr>
      ${revenueRows || `<tr><td colspan="3" style="text-align:center;color:#737685">${escHtml(t('mobile.finRepNoRevenue'))}</td></tr>`}
      <tr class="total-row"><td>${escHtml(t('mobile.finRepTotal'))}</td><td style="text-align:right">${fmt(f.totalRevenue)}</td><td></td></tr>
    </table>
  </div>

  <div class="section">
    <h2>${escHtml(t('mobile.finRepExpenseSummary'))}</h2>
    <table>
      <tr><th>${escHtml(t('mobile.finRepColCategory'))}</th><th>${escHtml(t('mobile.finRepColGroup'))}</th><th style="text-align:right">${escHtml(t('mobile.finRepColAmount'))}</th></tr>
      ${expenseRows || `<tr><td colspan="3" style="text-align:center;color:#737685">${escHtml(t('mobile.finRepNoExpenses'))}</td></tr>`}
      <tr class="total-row"><td colspan="2">${escHtml(t('mobile.finRepTotal'))}</td><td style="text-align:right">${fmt(f.totalExpenses)}</td></tr>
    </table>
  </div>

  ${orderDetailRows ? `<div class="section">
    <h2>${escHtml(t('mobile.finRepOrderDetails', { count: ordCount }))}</h2>
    <table>
      <tr><th>${escHtml(t('mobile.finRepColDate'))}</th><th>${escHtml(t('mobile.finRepColOrder'))}</th><th>${escHtml(t('mobile.finRepColCustomer'))}</th><th style="text-align:right">${escHtml(t('mobile.finRepColTotal'))}</th><th style="text-align:right">${escHtml(t('mobile.finRepColPaid'))}</th><th style="text-align:right">${escHtml(t('mobile.finRepColDue'))}</th></tr>
      ${orderDetailRows}
    </table>
  </div>` : ''}

  ${expenseDetailRows ? `<div class="section">
    <h2>${escHtml(t('mobile.finRepExpenseDetails', { count: expenses.length }))}</h2>
    <table>
      <tr><th>${escHtml(t('mobile.finRepColDate'))}</th><th>${escHtml(t('mobile.finRepColCategory'))}</th><th>${escHtml(t('mobile.finRepColDescription'))}</th><th>${escHtml(t('mobile.finRepColVendor'))}</th><th style="text-align:right">${escHtml(t('mobile.finRepColAmount'))}</th></tr>
      ${expenseDetailRows}
    </table>
  </div>` : ''}

  <div class="profit-section ${f.netProfit >= 0 ? 'blue' : 'loss'}">
    <div class="label">${escHtml(t('mobile.finRepNetProfitLoss'))}</div>
    <div class="value">${f.netProfit < 0 ? '-' : ''}${fmt(Math.abs(f.netProfit))}</div>
  </div>

  <div class="footer">
    ${escHtml(t('mobile.finRepFooter', { period: periodLabel }))}
  </div>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────

export default function ExpensesScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const shopId = getShopId();
  const countrySettings = useShopCountrySettings(shopId);
  const withCurrencySymbol = (text: string) => text.replace(/₹/g, countrySettings.currencySymbol || '₹');

  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  const [refDate, setRefDate] = useState(new Date());
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [customStartText, setCustomStartText] = useState('');
  const [customEndText, setCustomEndText] = useState('');

  const [expenses, setExpenses] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Expense modal
  const [addModal, setAddModal] = useState(false);
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('');
  const [expDescription, setExpDescription] = useState('');
  const [expVendor, setExpVendor] = useState('');
  const [saving, setSaving] = useState(false);

  // Detail view toggle
  const [viewMode, setViewMode] = useState<'overview' | 'expenses' | 'revenue'>('overview');

  // Report generation
  const [generatingReport, setGeneratingReport] = useState(false);

  const { start, end, label: periodLabel } = useMemo(
    () => getDateRangeLocalized(timePeriod, refDate, customStartDate, customEndDate, i18n.language),
    [timePeriod, refDate, customStartDate, customEndDate, i18n.language],
  );

  // ─── Data fetching ──────────────────────────────────────────────────

  useEffect(() => {
    if (!shopId) { setLoading(false); return; }

    setLoading(true);

    // Fetch expenses for current period
    const unsubExpenses = firestore()
      .collection(`shops/${shopId}/expenses`)
      .where('date', '>=', start)
      .where('date', '<=', end)
      .orderBy('date', 'desc')
      .onSnapshot(
        (snap: any) => {
          setExpenses(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        () => setLoading(false),
      );

    // Fetch orders for current period
    const unsubOrders = firestore()
      .collection(`shops/${shopId}/orders`)
      .where('createdAt', '>=', start)
      .where('createdAt', '<=', end)
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        (snap: any) => {
          setOrders(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
        },
        () => {},
      );

    return () => { unsubExpenses(); unsubOrders(); };
  }, [shopId, timePeriod, refDate, customStartDate, customEndDate]);

  // ─── Computed ───────────────────────────────────────────────────────

  const financials = useMemo(() => {
    let totalRevenue = 0;
    let collected = 0;
    let pending = 0;
    let cancelled = 0;
    const revenueByType: Record<string, number> = { pickup_store: 0, delivery_home: 0, pickup_home: 0 };

    orders.forEach((o) => {
      const total = o.financials?.total || 0;
      const paid = o.financials?.amountPaid || 0;
      const balance = o.financials?.balance ?? (total - paid);
      const status = o.status || 'pending';
      const dType = o.deliveryType || 'pickup_store';

      if (status === 'cancelled') {
        cancelled += total;
      } else {
        totalRevenue += paid;
        collected += paid;
        pending += Math.max(0, balance);
        revenueByType[dType] = (revenueByType[dType] || 0) + paid;
      }
    });

    let totalExpenses = 0;
    const expByCategory: Record<string, number> = {};
    const expByGroup: Record<string, number> = {};

    expenses.forEach((e) => {
      const amt = e.amount || 0;
      totalExpenses += amt;
      const cat = e.category || 'miscellaneous';
      expByCategory[cat] = (expByCategory[cat] || 0) + amt;
      const group = CAT_DEF_MAP[cat]?.group || 'Other';
      expByGroup[group] = (expByGroup[group] || 0) + amt;
    });

    const netProfit = totalRevenue - totalExpenses;

    return { totalRevenue, collected, pending, cancelled, totalExpenses, netProfit, revenueByType, expByCategory, expByGroup };
  }, [orders, expenses]);

  // ─── Actions ────────────────────────────────────────────────────────

  const handleAddExpense = async () => {
    const amount = parseFloat(expAmount);
    if (!amount || amount <= 0) { Alert.alert(t('mobile.invalidAmountTitle'), t('mobile.invalidAmountMsg')); return; }
    if (!expCategory) { Alert.alert(t('mobile.selectCategoryTitle'), t('mobile.selectCategoryMsg')); return; }
    if (!shopId || saving) return;

    setSaving(true);
    try {
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      await firestore().collection(`shops/${shopId}/expenses`).add({
        category: expCategory,
        description: expDescription.trim() || CAT_DEF_MAP[expCategory]?.labelEn || '',
        amount,
        date: now,
        month: monthStr,
        vendor: expVendor.trim() || null,
        isRecurring: false,
        createdBy: 'mobile',
        createdAt: now,
      });
      setAddModal(false);
      resetForm();
    } catch (e: any) {
      Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedAddExpense'));
    }
    setSaving(false);
  };

  const resetForm = () => {
    setExpAmount('');
    setExpCategory('');
    setExpDescription('');
    setExpVendor('');
  };

  const handleDeleteExpense = (expenseId: string) => {
    Alert.alert(t('mobile.deleteExpenseTitle'), t('mobile.deleteExpenseConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive', onPress: async () => {
          try {
            await firestore().collection(`shops/${shopId}/expenses`).doc(expenseId).delete();
          } catch (e: any) {
            Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedDeleteExpense'));
          }
        },
      },
    ]);
  };

  const parseCustomDate = (text: string): Date | null => {
    // Accept DD/MM/YYYY or DD-MM-YYYY
    const cleaned = text.replace(/[-\/]/g, '/');
    const parts = cleaned.split('/');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (day < 1 || day > 31 || month < 0 || month > 11 || year < 2000) return null;
    return new Date(year, month, day);
  };

  const applyCustomDates = () => {
    const s = parseCustomDate(customStartText);
    const e = parseCustomDate(customEndText);
    if (!s || !e) {
      Alert.alert(t('mobile.invalidDateTitle'), t('mobile.invalidDateMsg'));
      return;
    }
    if (e < s) {
      Alert.alert(t('mobile.invalidRangeTitle'), t('mobile.invalidRangeMsg'));
      return;
    }
    setCustomStartDate(s);
    setCustomEndDate(e);
    setTimePeriod('custom');
    setShowCustomDateModal(false);
  };

  // ─── Report Generation ─────────────────────────────────────────────

  const generateReport = useCallback(async () => {
    setGeneratingReport(true);
    try {
      const html = buildFinancialReportHtml(
        financials,
        expenses,
        orders,
        periodLabel,
        t,
        countrySettings.locale || i18n.language,
        countrySettings.currencySymbol || '₹'
      );
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('mobile.finShareReportTitle') });
    } catch (e: any) {
      Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedReport'));
    }
    setGeneratingReport(false);
  }, [financials, expenses, orders, periodLabel, t, i18n.language, countrySettings.locale, countrySettings.currencySymbol]);

  const PERIOD_OPTIONS = useMemo(
    () => [
      { key: 'day' as const, label: t('mobile.periodToday'), icon: 'today' },
      { key: 'week' as const, label: t('mobile.periodThisWeek'), icon: 'date-range' },
      { key: 'month' as const, label: t('mobile.periodThisMonth'), icon: 'calendar-month' },
      { key: 'year' as const, label: t('mobile.periodThisYear'), icon: 'calendar-today' },
      { key: 'custom' as const, label: t('mobile.periodCustomRange'), icon: 'tune' },
    ],
    [t],
  );

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('mobile.tabFinance')}</Text>
        <HelpButton pageId="mobile_expenses" />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#00408f" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 70 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Report + period preset + month / range — one row */}
          <View style={styles.toolbarRow}>
            <TouchableOpacity
              style={styles.toolbarReportBtn}
              onPress={generateReport}
              disabled={generatingReport}
              activeOpacity={0.7}
            >
              {generatingReport ? (
                <ActivityIndicator size="small" color="#00408f" />
              ) : (
                <>
                  <MaterialIcons name="description" size={14} color="#00408f" />
                  <Text style={styles.toolbarReportText}>{t('mobile.financeToolbarReport')}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolbarPeriodChip}
              onPress={() => setShowPeriodPicker(true)}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name={(PERIOD_OPTIONS.find((p) => p.key === timePeriod)?.icon as any) || 'calendar-month'}
                size={14}
                color="#00408f"
              />
              <Text style={styles.toolbarPeriodText} numberOfLines={1}>
                {PERIOD_OPTIONS.find((p) => p.key === timePeriod)?.label || t('mobile.periodMonthFallback')}
              </Text>
              <MaterialIcons name="expand-more" size={16} color="#00408f" />
            </TouchableOpacity>

            {timePeriod !== 'custom' ? (
              <View style={styles.toolbarDateNav}>
                <TouchableOpacity
                  onPress={() => setRefDate(navigateDate(timePeriod, refDate, -1))}
                  style={styles.toolbarNavBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="chevron-left" size={22} color="#00408f" />
                </TouchableOpacity>
                <Text style={styles.toolbarDateLabel} numberOfLines={1}>
                  {periodLabel}
                </Text>
                <TouchableOpacity
                  onPress={() => setRefDate(navigateDate(timePeriod, refDate, 1))}
                  style={styles.toolbarNavBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="chevron-right" size={22} color="#00408f" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.toolbarCustomSummary}
                onPress={() => {
                  setCustomStartText(`${customStartDate.getDate().toString().padStart(2, '0')}/${(customStartDate.getMonth() + 1).toString().padStart(2, '0')}/${customStartDate.getFullYear()}`);
                  setCustomEndText(`${customEndDate.getDate().toString().padStart(2, '0')}/${(customEndDate.getMonth() + 1).toString().padStart(2, '0')}/${customEndDate.getFullYear()}`);
                  setShowCustomDateModal(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.toolbarDateLabel} numberOfLines={1}>
                  {periodLabel}
                </Text>
                <MaterialIcons name="edit" size={14} color="#00408f" />
              </TouchableOpacity>
            )}
          </View>

          {/* ─── Summary Cards ──────────────────────────────────── */}
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, { backgroundColor: '#e8f5e9' }]}>
              <Text style={styles.summaryLabel}>{t('mobile.finSummaryIncome')}</Text>
              <Text style={[styles.summaryValue, { color: '#2e7d32' }]}>{formatCurrency(Math.round(financials.totalRevenue), countrySettings)}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: '#fce4ec' }]}>
              <Text style={styles.summaryLabel}>{t('mobile.finSummaryExpenses')}</Text>
              <Text style={[styles.summaryValue, { color: '#c62828' }]}>{formatCurrency(Math.round(financials.totalExpenses), countrySettings)}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: '#fff3e0' }]}>
              <Text style={styles.summaryLabel}>{t('mobile.finSummaryPending')}</Text>
              <Text style={[styles.summaryValue, { color: '#e65100' }]}>{formatCurrency(Math.round(financials.pending), countrySettings)}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: financials.netProfit >= 0 ? '#e3f2fd' : '#ffdad6' }]}>
              <Text style={styles.summaryLabel}>{t('mobile.finSummaryNetProfit')}</Text>
              <Text style={[styles.summaryValue, { color: financials.netProfit >= 0 ? '#00408f' : '#93000a' }]}>
                {financials.netProfit < 0 ? '-' : ''}{formatCurrency(Math.abs(Math.round(financials.netProfit)), countrySettings)}
              </Text>
            </View>
          </View>

          {/* ─── View Mode Tabs ─────────────────────────────────── */}
          <View style={styles.tabRow}>
            {(['overview', 'revenue', 'expenses'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.tab, viewMode === mode && styles.tabActive]}
                onPress={() => setViewMode(mode)}
              >
                <Text style={[styles.tabText, viewMode === mode && styles.tabTextActive]}>
                  {mode === 'overview' ? t('mobile.finTabOverview') : mode === 'revenue' ? t('mobile.finTabRevenue') : t('mobile.finTabExpenses')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ─── OVERVIEW TAB ───────────────────────────────────── */}
          {viewMode === 'overview' && (
            <>
              {/* Revenue by Order Type */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('mobile.finCardRevenueByType')}</Text>
                {Object.entries(financials.revenueByType)
                  .filter(([, v]) => v > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, amount]) => {
                    const pct = financials.totalRevenue > 0 ? Math.round((amount / financials.totalRevenue) * 100) : 0;
                    return (
                      <View key={type} style={styles.breakdownRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.breakdownLabel}>{deliveryTypeLabelT(type, t)}</Text>
                          <View style={styles.barBg}>
                            <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: '#00408f' }]} />
                          </View>
                        </View>
                        <Text style={styles.breakdownValue}>{formatCurrency(Math.round(amount), countrySettings)}</Text>
                        <Text style={styles.breakdownPct}>{pct}%</Text>
                      </View>
                    );
                  })}
                {financials.totalRevenue === 0 && <Text style={styles.emptySmall}>{t('mobile.finNoRevenuePeriod')}</Text>}
              </View>

              {/* Expenses by Group */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('mobile.finCardExpensesByCategory')}</Text>
                {Object.entries(financials.expByGroup)
                  .sort(([, a], [, b]) => b - a)
                  .map(([group, amount]) => {
                    const pct = financials.totalExpenses > 0 ? Math.round((amount / financials.totalExpenses) * 100) : 0;
                    const color = CATEGORY_COLORS[group] || '#434654';
                    return (
                      <View key={group} style={styles.breakdownRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.breakdownLabel}>{groupLabelT(group, t)}</Text>
                          <View style={styles.barBg}>
                            <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
                          </View>
                        </View>
                        <Text style={styles.breakdownValue}>{formatCurrency(Math.round(amount), countrySettings)}</Text>
                        <Text style={styles.breakdownPct}>{pct}%</Text>
                      </View>
                    );
                  })}
                {financials.totalExpenses === 0 && <Text style={styles.emptySmall}>{t('mobile.finNoExpensesPeriod')}</Text>}
              </View>

              {/* Collection Status */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('mobile.finCollectionStatus')}</Text>
                <View style={styles.collectionRow}>
                  <View style={styles.collectionItem}>
                    <Text style={styles.collectionLabel}>{t('mobile.finCollected')}</Text>
                    <Text style={[styles.collectionValue, { color: '#2e7d32' }]}>{formatCurrency(Math.round(financials.collected), countrySettings)}</Text>
                  </View>
                  <View style={styles.collectionDivider} />
                  <View style={styles.collectionItem}>
                    <Text style={styles.collectionLabel}>{t('mobile.finPending')}</Text>
                    <Text style={[styles.collectionValue, { color: '#e65100' }]}>{formatCurrency(Math.round(financials.pending), countrySettings)}</Text>
                  </View>
                  <View style={styles.collectionDivider} />
                  <View style={styles.collectionItem}>
                    <Text style={styles.collectionLabel}>{t('mobile.finOrdersCount')}</Text>
                    <Text style={styles.collectionValue}>{orders.length}</Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* ─── REVENUE TAB ────────────────────────────────────── */}
          {viewMode === 'revenue' && (
            <>
              {orders.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialIcons name="receipt-long" size={44} color="#c3c6d6" />
                  <Text style={styles.emptyText}>{t('mobile.finNoOrdersPeriod')}</Text>
                </View>
              ) : (
                <View style={styles.listGap}>
                  {orders.filter((o) => o.status !== 'cancelled').map((order) => {
                    const total = Math.round(order.financials?.total || 0);
                    const paid = Math.round(order.financials?.amountPaid || 0);
                    const balance = Math.round(order.financials?.balance || 0);
                    const created = toDate(order.createdAt);
                    const publicId = order.publicId || order.orderNumber || order.id?.slice(-4) || '';
                    const dType = order.deliveryType || 'pickup_store';
                    return (
                      <View key={order.id} style={styles.revenueCard}>
                        <View style={{ flex: 1 }}>
                          <View style={styles.revenueTopRow}>
                            <Text style={styles.revenueOrderId}>#{publicId}</Text>
                            <Text style={styles.revenueDate}>{formatDateLocale(created, i18n.language)}</Text>
                          </View>
                          <Text style={styles.revenueName}>{order.customerName || t('mobile.guestLabel')}</Text>
                          <View style={styles.revenueMeta}>
                            <Text style={styles.revenueType}>{deliveryTypeLabelT(dType, t)}</Text>
                            {balance > 0 ? (
                              <Text style={styles.revenueDue}>{withCurrencySymbol(t('mobile.orderDueLabel', { amount: balance }) as string)}</Text>
                            ) : (
                              <Text style={styles.revenuePaid}>{t('mobile.paidLabel')}</Text>
                            )}
                          </View>
                        </View>
                        <Text style={styles.revenueAmount}>{formatCurrency(total, countrySettings)}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {/* ─── EXPENSES TAB ───────────────────────────────────── */}
          {viewMode === 'expenses' && (
            <>
              {expenses.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialIcons name="account-balance-wallet" size={44} color="#c3c6d6" />
                  <Text style={styles.emptyText}>{t('mobile.finNoExpensesEmpty')}</Text>
                  <TouchableOpacity style={styles.addBtnInline} onPress={() => setAddModal(true)}>
                    <MaterialIcons name="add" size={18} color="#fff" />
                    <Text style={styles.addBtnInlineText}>{t('mobile.finAddExpense')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.listGap}>
                  {expenses.map((exp) => {
                    const cat = CAT_DEF_MAP[exp.category] || { labelEn: exp.category || 'Other', icon: 'more-horiz', group: 'Other' };
                    const color = CATEGORY_COLORS[cat.group] || '#434654';
                    const created = toDate(exp.date);
                    return (
                      <View key={exp.id} style={styles.expenseCard}>
                        <View style={[styles.expenseIcon, { backgroundColor: color + '18' }]}>
                          <MaterialIcons name={cat.icon as any} size={18} color={color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.expenseName}>{exp.description || catLabelT(exp.category || 'miscellaneous', t)}</Text>
                          <View style={styles.expenseMeta}>
                            <Text style={styles.expenseMetaText}>{catLabelT(exp.category || 'miscellaneous', t)}</Text>
                            <View style={styles.dot} />
                            <Text style={styles.expenseMetaText}>{formatDateLocale(created, i18n.language)}</Text>
                            {exp.vendor ? (
                              <>
                                <View style={styles.dot} />
                                <Text style={styles.expenseMetaText}>{exp.vendor}</Text>
                              </>
                            ) : null}
                          </View>
                        </View>
                        <Text style={styles.expenseAmount}>-{formatCurrency(Math.round(exp.amount), countrySettings)}</Text>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteExpense(exp.id)}>
                          <MaterialIcons name="delete-outline" size={18} color="#c62828" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* FAB — Add Expense */}
      <TouchableOpacity
        style={[styles.fab, { bottom: 56 + insets.bottom }]}
        activeOpacity={0.8}
        onPress={() => { resetForm(); setAddModal(true); }}
      >
        <MaterialIcons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ═══ Time Period Picker Modal ═══ */}
      <Modal visible={showPeriodPicker} transparent animationType="fade" onRequestClose={() => setShowPeriodPicker(false)}>
        <Pressable style={styles.modalDismiss} onPress={() => setShowPeriodPicker(false)} />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{t('mobile.finSelectTimePeriod')}</Text>
          <View style={{ gap: 4, marginTop: 8 }}>
            {PERIOD_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.periodOption, timePeriod === opt.key && styles.periodOptionActive]}
                onPress={() => {
                  if (opt.key === 'custom') {
                    setShowPeriodPicker(false);
                    const today = new Date();
                    setCustomStartText(`${today.getDate().toString().padStart(2,'0')}/${(today.getMonth()+1).toString().padStart(2,'0')}/${today.getFullYear()}`);
                    setCustomEndText(`${today.getDate().toString().padStart(2,'0')}/${(today.getMonth()+1).toString().padStart(2,'0')}/${today.getFullYear()}`);
                    setTimeout(() => setShowCustomDateModal(true), 300);
                  } else {
                    setTimePeriod(opt.key);
                    setRefDate(new Date());
                    setShowPeriodPicker(false);
                  }
                }}
              >
                <MaterialIcons name={opt.icon as any} size={20} color={timePeriod === opt.key ? '#00408f' : '#434654'} />
                <Text style={[styles.periodOptionText, timePeriod === opt.key && styles.periodOptionTextActive]}>{opt.label}</Text>
                {timePeriod === opt.key && <MaterialIcons name="check" size={20} color="#00408f" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ═══ Custom Date Range Modal ═══ */}
      <Modal visible={showCustomDateModal} transparent animationType="slide" onRequestClose={() => setShowCustomDateModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalDismiss} onPress={() => setShowCustomDateModal(false)} />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('mobile.finCustomRangeTitle')}</Text>
            <Text style={styles.fieldLabel}>{t('mobile.finStartDateLabel')}</Text>
            <TextInput
              style={styles.modalInput}
              value={customStartText}
              onChangeText={setCustomStartText}
              placeholder={t('mobile.finPlaceholderStart')}
              placeholderTextColor="#c3c6d6"
              keyboardType="numbers-and-punctuation"
              autoFocus
            />
            <Text style={styles.fieldLabel}>{t('mobile.finEndDateLabel')}</Text>
            <TextInput
              style={styles.modalInput}
              value={customEndText}
              onChangeText={setCustomEndText}
              placeholder={t('mobile.finPlaceholderEnd')}
              placeholderTextColor="#c3c6d6"
              keyboardType="numbers-and-punctuation"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCustomDateModal(false)}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={applyCustomDates}>
                <Text style={styles.primaryBtnText}>{t('mobile.finApply')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══ Add Expense Modal ═══ */}
      <Modal visible={addModal} transparent animationType="slide" onRequestClose={() => setAddModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalDismiss} onPress={() => setAddModal(false)} />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('mobile.finAddExpenseTitle')}</Text>

            {/* Amount */}
            <Text style={styles.fieldLabel}>{t('mobile.finAmountLabel')} <Text style={{ color: '#c62828' }}>*</Text></Text>
            <View style={styles.amountRow}>
              <Text style={styles.currencySign}>{countrySettings.currencySymbol || '$'}</Text>
              <TextInput
                style={styles.amountInput}
                value={expAmount}
                onChangeText={setExpAmount}
                placeholder="0"
                placeholderTextColor="#c3c6d6"
                keyboardType="numeric"
                autoFocus
              />
            </View>

            {/* Category */}
            <Text style={styles.fieldLabel}>{t('mobile.finCategoryLabel')} <Text style={{ color: '#c62828' }}>*</Text></Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
              {EXPENSE_CATEGORY_DEFS.map((cat) => {
                const isSelected = expCategory === cat.key;
                const color = CATEGORY_COLORS[cat.group] || '#434654';
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[styles.catChip, isSelected && { backgroundColor: color, borderColor: color }]}
                    onPress={() => setExpCategory(cat.key)}
                  >
                    <MaterialIcons name={cat.icon as any} size={14} color={isSelected ? '#fff' : color} />
                    <Text style={[styles.catChipText, isSelected && { color: '#fff' }]}>{catLabelT(cat.key, t)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Description */}
            <Text style={styles.fieldLabel}>{t('mobile.finDescriptionLabel')}</Text>
            <TextInput
              style={styles.modalInput}
              value={expDescription}
              onChangeText={setExpDescription}
              placeholder={t('mobile.expenseWhatPlaceholder')}
              placeholderTextColor="#c3c6d6"
            />

            {/* Vendor */}
            <Text style={styles.fieldLabel}>{t('mobile.finVendorLabel')}</Text>
            <TextInput
              style={styles.modalInput}
              value={expVendor}
              onChangeText={setExpVendor}
              placeholder={t('mobile.phOptional')}
              placeholderTextColor="#c3c6d6"
            />

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setAddModal(false)}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, (!expAmount || !expCategory) && { opacity: 0.5 }]}
                onPress={handleAddExpense}
                disabled={saving || !expAmount || !expCategory}
              >
                {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                  <Text style={styles.primaryBtnText}>{t('mobile.finAddExpense')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fb' },
  header: {
    paddingHorizontal: 20, height: 48,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#f8f9fb',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#00408f' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },

  // Toolbar: Report + period preset + month navigation (single row)
  toolbarRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
  },
  toolbarReportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: '#00408f', flexShrink: 0,
  },
  toolbarReportText: { fontSize: 11, fontWeight: '700', color: '#00408f' },
  toolbarPeriodChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    maxWidth: 118,
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#d8e2ff', flexShrink: 0,
  },
  toolbarPeriodText: { fontSize: 11, fontWeight: '700', color: '#00408f', flexShrink: 1 },
  toolbarDateNav: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    minWidth: 0, gap: 2,
  },
  toolbarNavBtn: { padding: 2 },
  toolbarDateLabel: {
    flex: 1, fontSize: 12, fontWeight: '700', color: '#191c1e', textAlign: 'center',
    minWidth: 0,
  },
  toolbarCustomSummary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    gap: 4, minWidth: 0, paddingVertical: 4, paddingHorizontal: 6,
  },

  // Summary
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  summaryCard: {
    width: '48%' as any, flexGrow: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
  },
  summaryLabel: { fontSize: 8, fontWeight: '700', color: '#434654', letterSpacing: 0.5, marginBottom: 2 },
  summaryValue: { fontSize: 18, fontWeight: '800' },

  // Tabs
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#e7e8ea', alignItems: 'center' },
  tabActive: { backgroundColor: '#00408f' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#434654' },
  tabTextActive: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // Card
  card: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 14, marginBottom: 12, gap: 10,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#434654', letterSpacing: 0.5 },

  // Breakdown rows
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  breakdownLabel: { fontSize: 13, fontWeight: '600', color: '#191c1e', marginBottom: 4 },
  breakdownValue: { fontSize: 13, fontWeight: '700', color: '#191c1e', width: 70, textAlign: 'right' },
  breakdownPct: { fontSize: 11, fontWeight: '600', color: '#737685', width: 32, textAlign: 'right' },
  barBg: { height: 6, borderRadius: 3, backgroundColor: '#f3f4f6', overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },

  // Collection
  collectionRow: { flexDirection: 'row', alignItems: 'center' },
  collectionItem: { flex: 1, alignItems: 'center' },
  collectionDivider: { width: 1, height: 32, backgroundColor: '#edeef0' },
  collectionLabel: { fontSize: 10, fontWeight: '600', color: '#737685', marginBottom: 2 },
  collectionValue: { fontSize: 16, fontWeight: '800', color: '#191c1e' },

  // Revenue list
  listGap: { gap: 8 },
  revenueCard: {
    backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  revenueTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  revenueOrderId: { fontSize: 12, fontWeight: '700', color: '#00408f' },
  revenueDate: { fontSize: 11, color: '#737685' },
  revenueName: { fontSize: 14, fontWeight: '600', color: '#191c1e', marginBottom: 2 },
  revenueMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  revenueType: { fontSize: 11, fontWeight: '500', color: '#434654' },
  revenueDue: { fontSize: 10, fontWeight: '700', color: '#93000a' },
  revenuePaid: { fontSize: 10, fontWeight: '700', color: '#006b5f' },
  revenueAmount: { fontSize: 15, fontWeight: '800', color: '#2e7d32', marginLeft: 12 },

  // Expense list
  expenseCard: {
    backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  expenseIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  expenseName: { fontSize: 14, fontWeight: '600', color: '#191c1e', marginBottom: 2 },
  expenseMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  expenseMetaText: { fontSize: 11, color: '#737685' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#c3c6d6' },
  expenseAmount: { fontSize: 14, fontWeight: '700', color: '#c62828' },
  deleteBtn: { padding: 6, marginLeft: 4 },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: '#737685' },
  emptySmall: { fontSize: 12, color: '#737685', textAlign: 'center' },
  addBtnInline: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#00408f',
  },
  addBtnInlineText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  // FAB
  fab: {
    position: 'absolute', right: 20, width: 54, height: 54, borderRadius: 16,
    backgroundColor: '#00408f', justifyContent: 'center', alignItems: 'center',
    elevation: 8, shadowColor: '#00408f', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 8 },
  },

  // Period picker
  periodOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 10,
  },
  periodOptionActive: { backgroundColor: '#d8e2ff' },
  periodOptionText: { fontSize: 15, fontWeight: '600', color: '#434654', flex: 1 },
  periodOptionTextActive: { color: '#00408f', fontWeight: '700' },

  // Modal
  modalDismiss: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd', alignSelf: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#191c1e', marginBottom: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#434654', letterSpacing: 0.3, marginTop: 12, marginBottom: 4 },
  modalInput: {
    backgroundColor: '#f8f9fb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: '#191c1e', borderWidth: 1, borderColor: '#edeef0',
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fb', borderRadius: 10, borderWidth: 1, borderColor: '#edeef0', paddingHorizontal: 14 },
  currencySign: { fontSize: 20, fontWeight: '800', color: '#434654', marginRight: 4 },
  amountInput: { flex: 1, fontSize: 24, fontWeight: '800', color: '#191c1e', paddingVertical: 10 },

  // Category chips
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: '#edeef0', backgroundColor: '#fff',
  },
  catChipText: { fontSize: 11, fontWeight: '600', color: '#434654' },

  // Modal actions
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#edeef0' },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: '#434654' },
  primaryBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 12, backgroundColor: '#00408f' },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
