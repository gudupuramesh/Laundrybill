import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, radii, shadows, spacing } from '../theme';
import { firestore } from '../lib/db';
import { getShopId, getAgentId, getAgentName } from '../lib/auth';
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
  Utilities: colors.warning,
  Supplies: colors.success,
  Equipment: colors.primary,
  Operations: '#5e3c00',
  Business: '#7b1fa2',
  Other: colors.textSecondary,
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

export default function ExpensesScreen({
  onBack,
  onStaffAttendance,
  onStaffList,
}: {
  onBack?: () => void;
  onStaffAttendance?: () => void;
  onStaffList?: () => void;
} = {}) {
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
        createdBy: getAgentId() || 'staff',
        createdByName: getAgentName() || 'Staff',
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

  // Expense hard-delete intentionally omitted in the Team app — a manager can
  // view and add expenses but must not delete financial records.

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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={{ paddingRight: 8, marginLeft: -4 }}>
              <MaterialIcons name="chevron-left" size={26} color={colors.text} />
            </TouchableOpacity>
          ) : null}
          <Text style={styles.headerTitle}>{t('mobile.tabFinance')}</Text>
        </View>
        <HelpButton pageId="mobile_expenses" />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
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
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <MaterialIcons name="description" size={14} color={colors.primary} />
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
                color={colors.primary}
              />
              <Text style={styles.toolbarPeriodText} numberOfLines={1}>
                {PERIOD_OPTIONS.find((p) => p.key === timePeriod)?.label || t('mobile.periodMonthFallback')}
              </Text>
              <MaterialIcons name="expand-more" size={16} color={colors.primary} />
            </TouchableOpacity>

            {timePeriod !== 'custom' ? (
              <View style={styles.toolbarDateNav}>
                <TouchableOpacity
                  onPress={() => setRefDate(navigateDate(timePeriod, refDate, -1))}
                  style={styles.toolbarNavBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="chevron-left" size={22} color={colors.primary} />
                </TouchableOpacity>
                <Text style={styles.toolbarDateLabel} numberOfLines={1}>
                  {periodLabel}
                </Text>
                <TouchableOpacity
                  onPress={() => setRefDate(navigateDate(timePeriod, refDate, 1))}
                  style={styles.toolbarNavBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="chevron-right" size={22} color={colors.primary} />
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
                <MaterialIcons name="edit" size={14} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {/* ─── Blue Gradient Net Profit Card ──────────────────── */}
          <LinearGradient
            colors={['#1B61E5', '#124BB8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profitCard}
          >
            <Text style={styles.profitLabel}>{t('mobile.estimatedNetProfit', { defaultValue: 'ESTIMATED NET PROFIT' })}</Text>
            <Text style={styles.profitValue}>
              {financials.netProfit < 0 ? '-' : ''}{formatCurrency(Math.abs(Math.round(financials.netProfit)), countrySettings)}
            </Text>
            <View style={styles.profitRow}>
              <View style={styles.profitCol}>
                <Text style={styles.profitColLabel}>{t('mobile.monthlyIncome', { defaultValue: 'Monthly Income' })}</Text>
                <Text style={styles.profitColValue}>{formatCurrency(Math.round(financials.totalRevenue), countrySettings)}</Text>
              </View>
              <View style={styles.profitDivider} />
              <View style={styles.profitCol}>
                <Text style={styles.profitColLabel}>{t('mobile.monthlyExpenses', { defaultValue: 'Monthly Expenses' })}</Text>
                <Text style={styles.profitColValue}>{formatCurrency(Math.round(financials.totalExpenses), countrySettings)}</Text>
              </View>
            </View>
          </LinearGradient>

          {/* ─── Quick Action Buttons ──────────────────────────── */}
          <View style={styles.quickActionRow}>
            <TouchableOpacity style={styles.qaSecondary} activeOpacity={0.7} onPress={onStaffAttendance}>
              <MaterialIcons name="groups" size={18} color={colors.primary} />
              <Text style={styles.qaSecondaryText}>{t('mobile.staffAttendance', { defaultValue: 'Staff Attendance' })}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.qaPrimary} activeOpacity={0.8} onPress={() => { resetForm(); setAddModal(true); }}>
              <MaterialIcons name="add" size={18} color={colors.surface} />
              <Text style={styles.qaPrimaryText}>{t('mobile.quickExpense', { defaultValue: 'Quick Expense' })}</Text>
            </TouchableOpacity>
          </View>

          {/* ─── All sections in single scroll (no tabs) ────────── */}
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
                            <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: colors.primary }]} />
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
                    const color = CATEGORY_COLORS[group] || colors.textSecondary;
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
                    <Text style={[styles.collectionValue, { color: colors.success }]}>{formatCurrency(Math.round(financials.collected), countrySettings)}</Text>
                  </View>
                  <View style={styles.collectionDivider} />
                  <View style={styles.collectionItem}>
                    <Text style={styles.collectionLabel}>{t('mobile.finPending')}</Text>
                    <Text style={[styles.collectionValue, { color: colors.warning }]}>{formatCurrency(Math.round(financials.pending), countrySettings)}</Text>
                  </View>
                  <View style={styles.collectionDivider} />
                  <View style={styles.collectionItem}>
                    <Text style={styles.collectionLabel}>{t('mobile.finOrdersCount')}</Text>
                    <Text style={styles.collectionValue}>{orders.length}</Text>
                  </View>
                </View>
              </View>
            </>

          {/* Individual order/expense lists removed — use dedicated screens */}
        </ScrollView>
      )}

      {/* FAB — Add Expense */}
      <TouchableOpacity
        style={[styles.fab, { bottom: 56 + insets.bottom }]}
        activeOpacity={0.8}
        onPress={() => { resetForm(); setAddModal(true); }}
      >
        <MaterialIcons name="add" size={28} color={colors.surface} />
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
                <MaterialIcons name={opt.icon as any} size={20} color={timePeriod === opt.key ? colors.primary : colors.textSecondary} />
                <Text style={[styles.periodOptionText, timePeriod === opt.key && styles.periodOptionTextActive]}>{opt.label}</Text>
                {timePeriod === opt.key && <MaterialIcons name="check" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ═══ Custom Date Range Modal ═══ */}
      <Modal visible={showCustomDateModal} transparent animationType="slide" onRequestClose={() => setShowCustomDateModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalDismiss} onPress={() => setShowCustomDateModal(false)} />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{t('mobile.finCustomRangeTitle')}</Text>
            <Text style={styles.fieldLabel}>{t('mobile.finStartDateLabel')}</Text>
            <TextInput
              style={styles.modalInput}
              value={customStartText}
              onChangeText={setCustomStartText}
              placeholder={t('mobile.finPlaceholderStart')}
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
              autoFocus
            />
            <Text style={styles.fieldLabel}>{t('mobile.finEndDateLabel')}</Text>
            <TextInput
              style={styles.modalInput}
              value={customEndText}
              onChangeText={setCustomEndText}
              placeholder={t('mobile.finPlaceholderEnd')}
              placeholderTextColor={colors.textMuted}
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
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══ Add Expense Modal ═══ */}
      <Modal visible={addModal} transparent animationType="slide" onRequestClose={() => setAddModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalDismiss} onPress={() => setAddModal(false)} />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{t('mobile.finAddExpenseTitle')}</Text>

            {/* Amount */}
            <Text style={styles.fieldLabel}>{t('mobile.finAmountLabel')} <Text style={{ color: colors.error }}>*</Text></Text>
            <View style={styles.amountRow}>
              <Text style={styles.currencySign}>{countrySettings.currencySymbol || '$'}</Text>
              <TextInput
                style={styles.amountInput}
                value={expAmount}
                onChangeText={setExpAmount}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                autoFocus
              />
            </View>

            {/* Category */}
            <Text style={styles.fieldLabel}>{t('mobile.finCategoryLabel')} <Text style={{ color: colors.error }}>*</Text></Text>
            <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
              {EXPENSE_CATEGORY_DEFS.map((cat) => {
                const isSelected = expCategory === cat.key;
                const color = CATEGORY_COLORS[cat.group] || colors.textSecondary;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[styles.catChip, isSelected && { backgroundColor: color, borderColor: color }]}
                    onPress={() => setExpCategory(cat.key)}
                  >
                    <MaterialIcons name={cat.icon as any} size={14} color={isSelected ? colors.surface : color} />
                    <Text style={[styles.catChipText, isSelected && { color: colors.surface }]}>{catLabelT(cat.key, t)}</Text>
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
              placeholderTextColor={colors.textMuted}
            />

            {/* Vendor */}
            <Text style={styles.fieldLabel}>{t('mobile.finVendorLabel')}</Text>
            <TextInput
              style={styles.modalInput}
              value={expVendor}
              onChangeText={setExpVendor}
              placeholder={t('mobile.phOptional')}
              placeholderTextColor={colors.textMuted}
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
                {saving ? <ActivityIndicator size="small" color={colors.surface} /> : (
                  <Text style={styles.primaryBtnText}>{t('mobile.finAddExpense')}</Text>
                )}
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
  header: {
    paddingHorizontal: 20, height: 48,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 20, fontFamily: fonts.bold, color: colors.text },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },

  // Toolbar: Report + period preset + month navigation (single row)
  toolbarRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md,
  },
  toolbarReportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radii.badge,
    borderWidth: 1, borderColor: colors.primary, flexShrink: 0,
  },
  toolbarReportText: { fontSize: 11, fontFamily: fonts.bold, color: colors.primary },
  toolbarPeriodChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    maxWidth: 118,
    paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radii.chip,
    backgroundColor: colors.primaryTint, flexShrink: 0,
  },
  toolbarPeriodText: { fontSize: 11, fontFamily: fonts.bold, color: colors.primary, flexShrink: 1 },
  toolbarDateNav: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    minWidth: 0, gap: 2,
  },
  toolbarNavBtn: { padding: 2 },
  toolbarDateLabel: {
    flex: 1, fontSize: 12, fontFamily: fonts.bold, color: colors.text, textAlign: 'center',
    minWidth: 0,
  },
  toolbarCustomSummary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    gap: spacing.xs, minWidth: 0, paddingVertical: spacing.xs, paddingHorizontal: 6,
  },

  // Blue Gradient Profit Card
  profitCard: {
    borderRadius: radii.card, paddingHorizontal: 16, paddingVertical: 14, marginBottom: spacing.sm,
    gap: 8, overflow: 'hidden',
  },
  profitLabel: { fontSize: 10, fontFamily: fonts.bold, color: 'rgba(255,255,255,0.8)', letterSpacing: 0.8, textTransform: 'uppercase' },
  profitValue: { fontSize: 26, fontFamily: fonts.bold, color: colors.surface },
  profitRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 10 },
  profitCol: { flex: 1 },
  profitColLabel: { fontSize: 10, fontFamily: fonts.semibold, color: 'rgba(255,255,255,0.7)' },
  profitColValue: { fontSize: 14, fontFamily: fonts.bold, color: colors.surface, marginTop: 1 },
  profitDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 12 },

  // Quick Action Buttons
  quickActionRow: { flexDirection: 'row', gap: 12, marginBottom: spacing.lg },
  qaSecondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: radii.input,
    backgroundColor: colors.primaryTint,
  },
  qaSecondaryText: { fontSize: 14, fontFamily: fonts.bold, color: colors.primary },
  qaPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: radii.input,
    backgroundColor: colors.primary,
  },
  qaPrimaryText: { fontSize: 14, fontFamily: fonts.bold, color: colors.surface },

  // Card
  card: {
    backgroundColor: colors.surface, borderRadius: radii.card, padding: 14, marginBottom: spacing.md, gap: 10,
    ...shadows.card, ...shadows.cardBorder,
  },
  cardTitle: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 0.5 },

  // Breakdown rows
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  breakdownLabel: { fontSize: 13, fontFamily: fonts.semibold, color: colors.text, marginBottom: 4 },
  breakdownValue: { fontSize: 13, fontFamily: fonts.bold, color: colors.text, width: 70, textAlign: 'right' },
  breakdownPct: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted, width: 32, textAlign: 'right' },
  barBg: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },

  // Collection
  collectionRow: { flexDirection: 'row', alignItems: 'center' },
  collectionItem: { flex: 1, alignItems: 'center' },
  collectionDivider: { width: 1, height: 32, backgroundColor: colors.border },
  collectionLabel: { fontSize: 10, fontFamily: fonts.semibold, color: colors.textMuted, marginBottom: 2 },
  collectionValue: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },

  // Revenue list
  listGap: { gap: spacing.sm },
  revenueCard: {
    backgroundColor: colors.surface, borderRadius: radii.card, paddingHorizontal: 14, paddingVertical: spacing.md,
    flexDirection: 'row', alignItems: 'center',
    ...shadows.card, ...shadows.cardBorder,
  },
  revenueTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  revenueOrderId: { fontSize: 12, fontFamily: fonts.bold, color: colors.primary },
  revenueDate: { fontSize: 11, fontFamily: fonts.medium, color: colors.textMuted },
  revenueName: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text, marginBottom: 2 },
  revenueMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  revenueType: { fontSize: 11, fontFamily: fonts.medium, color: colors.textSecondary },
  revenueDue: { fontSize: 10, fontFamily: fonts.bold, color: colors.error },
  revenuePaid: { fontSize: 10, fontFamily: fonts.bold, color: colors.success },
  revenueAmount: { fontSize: 15, fontFamily: fonts.bold, color: colors.success, marginLeft: spacing.md },

  // Expense list
  expenseCard: {
    backgroundColor: colors.surface, borderRadius: radii.card, paddingHorizontal: 14, paddingVertical: spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    ...shadows.card, ...shadows.cardBorder,
  },
  expenseIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  expenseName: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text, marginBottom: 2 },
  expenseMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  expenseMetaText: { fontSize: 11, fontFamily: fonts.medium, color: colors.textMuted },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textMuted },
  expenseAmount: { fontSize: 14, fontFamily: fonts.bold, color: colors.error },
  deleteBtn: { padding: 6, marginLeft: spacing.xs },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: spacing.sm },
  emptyText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textMuted },
  emptySmall: { fontSize: 12, fontFamily: fonts.medium, color: colors.textMuted, textAlign: 'center' },
  addBtnInline: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radii.button, backgroundColor: colors.primary,
  },
  addBtnInlineText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.surface },

  // FAB
  fab: {
    position: 'absolute', right: 20, width: 54, height: 54, borderRadius: radii.button,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    ...shadows.fab,
  },

  // Period picker
  periodOption: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: 14, borderRadius: 10,
  },
  periodOptionActive: { backgroundColor: colors.primaryTint },
  periodOptionText: { fontSize: 15, fontFamily: fonts.semibold, color: colors.textSecondary, flex: 1 },
  periodOptionTextActive: { color: colors.primary, fontFamily: fonts.bold },

  // Modal
  modalDismiss: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl, maxHeight: '88%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text, marginBottom: spacing.sm },
  fieldLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 0.3, marginTop: spacing.md, marginBottom: spacing.xs },
  modalInput: {
    backgroundColor: colors.background, borderRadius: radii.input, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, fontFamily: fonts.semibold, color: colors.text, borderWidth: 1, borderColor: colors.border,
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: radii.input, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 },
  currencySign: { fontSize: 20, fontFamily: fonts.bold, color: colors.textSecondary, marginRight: spacing.xs },
  amountInput: { flex: 1, fontSize: 24, fontFamily: fonts.bold, color: colors.text, paddingVertical: 10 },

  // Category chips
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.badge,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  catChipText: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textSecondary },

  // Modal actions
  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
  modalCancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: radii.button, borderWidth: 1, borderColor: colors.border },
  modalCancelText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textSecondary },
  primaryBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: radii.button, backgroundColor: colors.primary },
  primaryBtnText: { fontSize: 14, fontFamily: fonts.bold, color: colors.surface },
});
