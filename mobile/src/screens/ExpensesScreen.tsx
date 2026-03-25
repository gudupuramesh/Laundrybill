import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// ─── Constants ────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES: { key: string; label: string; icon: string; group: string }[] = [
  // Utilities
  { key: 'rent', label: 'Rent', icon: 'home', group: 'Utilities' },
  { key: 'electricity', label: 'Electricity', icon: 'bolt', group: 'Utilities' },
  { key: 'water', label: 'Water', icon: 'water-drop', group: 'Utilities' },
  // Laundry Supplies
  { key: 'detergents', label: 'Detergents', icon: 'local-laundry-service', group: 'Supplies' },
  { key: 'fabric_softener', label: 'Fabric Softener', icon: 'spa', group: 'Supplies' },
  { key: 'stain_remover', label: 'Stain Remover', icon: 'cleaning-services', group: 'Supplies' },
  { key: 'hangers', label: 'Hangers', icon: 'checkroom', group: 'Supplies' },
  { key: 'plastic_covers', label: 'Plastic Covers', icon: 'inventory-2', group: 'Supplies' },
  { key: 'tags_ribbons', label: 'Tags & Ribbons', icon: 'label', group: 'Supplies' },
  // Equipment
  { key: 'equipment', label: 'Equipment', icon: 'precision-manufacturing', group: 'Equipment' },
  { key: 'maintenance', label: 'Maintenance', icon: 'build', group: 'Equipment' },
  { key: 'washing_machine', label: 'Washing Machine', icon: 'local-laundry-service', group: 'Equipment' },
  // Operations
  { key: 'transport', label: 'Transport', icon: 'local-shipping', group: 'Operations' },
  { key: 'delivery', label: 'Delivery', icon: 'delivery-dining', group: 'Operations' },
  { key: 'packaging', label: 'Packaging', icon: 'inventory', group: 'Operations' },
  // Business
  { key: 'salary', label: 'Salary', icon: 'people', group: 'Business' },
  { key: 'marketing', label: 'Marketing', icon: 'campaign', group: 'Business' },
  { key: 'insurance', label: 'Insurance', icon: 'health-and-safety', group: 'Business' },
  { key: 'licenses', label: 'Licenses', icon: 'description', group: 'Business' },
  // Other
  { key: 'miscellaneous', label: 'Other', icon: 'more-horiz', group: 'Other' },
];

const CATEGORY_MAP: Record<string, { label: string; icon: string; group: string }> = {};
EXPENSE_CATEGORIES.forEach((c) => { CATEGORY_MAP[c.key] = c; });

const CATEGORY_COLORS: Record<string, string> = {
  Utilities: '#e65100',
  Supplies: '#006b5f',
  Equipment: '#1565c0',
  Operations: '#5e3c00',
  Business: '#7b1fa2',
  Other: '#434654',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type TimePeriod = 'day' | 'week' | 'month' | 'year' | 'custom';

// ─── Helpers ──────────────────────────────────────────────────────────

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  if (val instanceof Date) return val;
  return new Date(val);
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function formatFullDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function getDateRange(period: TimePeriod, refDate: Date, customStart?: Date, customEnd?: Date): { start: Date; end: Date; label: string } {
  const now = refDate;
  switch (period) {
    case 'day': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start, end, label: formatFullDate(now) };
    }
    case 'week': {
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset, 0, 0, 0, 0);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
      return { start, end, label: `${formatDate(start)} – ${formatDate(end)}` };
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end, label: `${MONTHS[now.getMonth()]} ${now.getFullYear()}` };
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
      return { start, end, label: `${formatFullDate(start)} – ${formatFullDate(end)}` };
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

// ─── Component ────────────────────────────────────────────────────────

export default function ExpensesScreen() {
  const insets = useSafeAreaInsets();
  const shopId = getShopId();

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

  const { start, end, label: periodLabel } = getDateRange(timePeriod, refDate, customStartDate, customEndDate);

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
      const group = CATEGORY_MAP[cat]?.group || 'Other';
      expByGroup[group] = (expByGroup[group] || 0) + amt;
    });

    const netProfit = totalRevenue - totalExpenses;

    return { totalRevenue, collected, pending, cancelled, totalExpenses, netProfit, revenueByType, expByCategory, expByGroup };
  }, [orders, expenses]);

  // ─── Actions ────────────────────────────────────────────────────────

  const handleAddExpense = async () => {
    const amount = parseFloat(expAmount);
    if (!amount || amount <= 0) { Alert.alert('Invalid Amount', 'Enter a valid amount.'); return; }
    if (!expCategory) { Alert.alert('Select Category', 'Please select a category.'); return; }
    if (!shopId || saving) return;

    setSaving(true);
    try {
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      await firestore().collection(`shops/${shopId}/expenses`).add({
        category: expCategory,
        description: expDescription.trim() || CATEGORY_MAP[expCategory]?.label || '',
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
      Alert.alert('Error', e.message || 'Failed to add expense');
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
    Alert.alert('Delete Expense', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await firestore().collection(`shops/${shopId}/expenses`).doc(expenseId).delete();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to delete');
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
      Alert.alert('Invalid Date', 'Enter dates in DD/MM/YYYY format.');
      return;
    }
    if (e < s) {
      Alert.alert('Invalid Range', 'End date must be after start date.');
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
      const f = financials;
      const typeLabels: Record<string, string> = { pickup_store: 'Shop Pickup', delivery_home: 'Home Delivery', pickup_home: 'Pickup from Home' };

      // Build expense rows
      const expenseRows = Object.entries(f.expByCategory)
        .sort(([, a], [, b]) => b - a)
        .map(([cat, amt]) => {
          const catInfo = CATEGORY_MAP[cat] || { label: cat, group: 'Other' };
          return `<tr><td>${catInfo.label}</td><td>${catInfo.group}</td><td style="text-align:right">₹${Math.round(amt).toLocaleString()}</td></tr>`;
        }).join('');

      // Build revenue rows
      const revenueRows = Object.entries(f.revenueByType)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([type, amt]) => {
          const pct = f.totalRevenue > 0 ? Math.round((amt / f.totalRevenue) * 100) : 0;
          return `<tr><td>${typeLabels[type] || type}</td><td style="text-align:right">₹${Math.round(amt).toLocaleString()}</td><td style="text-align:right">${pct}%</td></tr>`;
        }).join('');

      // Individual expense details
      const expenseDetailRows = expenses
        .sort((a, b) => {
          const da = toDate(a.date);
          const db = toDate(b.date);
          return (db?.getTime() || 0) - (da?.getTime() || 0);
        })
        .map((exp) => {
          const cat = CATEGORY_MAP[exp.category] || { label: exp.category || 'Other', group: 'Other' };
          const created = toDate(exp.date);
          return `<tr><td>${formatFullDate(created || new Date())}</td><td>${cat.label}</td><td>${exp.description || '—'}</td><td>${exp.vendor || '—'}</td><td style="text-align:right">₹${Math.round(exp.amount).toLocaleString()}</td></tr>`;
        }).join('');

      // Individual order details
      const orderDetailRows = orders
        .filter(o => o.status !== 'cancelled')
        .map((order) => {
          const total = Math.round(order.financials?.total || 0);
          const paid = Math.round(order.financials?.amountPaid || 0);
          const balance = Math.round(order.financials?.balance || 0);
          const created = toDate(order.createdAt);
          const publicId = order.publicId || order.orderNumber || order.id?.slice(-4) || '';
          return `<tr><td>${formatFullDate(created || new Date())}</td><td>#${publicId}</td><td>${order.customerName || 'Guest'}</td><td style="text-align:right">₹${total.toLocaleString()}</td><td style="text-align:right">₹${paid.toLocaleString()}</td><td style="text-align:right;color:${balance > 0 ? '#c62828' : '#2e7d32'}">₹${balance.toLocaleString()}</td></tr>`;
        }).join('');

      const html = `<!DOCTYPE html>
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
    <h1>Financial Report</h1>
    <div class="period">${periodLabel}</div>
    <div class="generated">Generated on ${formatFullDate(new Date())}</div>
  </div>

  <div class="summary-grid">
    <div class="summary-box green"><div class="label">Total Income</div><div class="value">₹${Math.round(f.totalRevenue).toLocaleString()}</div></div>
    <div class="summary-box red"><div class="label">Total Expenses</div><div class="value">₹${Math.round(f.totalExpenses).toLocaleString()}</div></div>
    <div class="summary-box orange"><div class="label">Pending Dues</div><div class="value">₹${Math.round(f.pending).toLocaleString()}</div></div>
    <div class="summary-box ${f.netProfit >= 0 ? 'blue' : 'loss'}"><div class="label">Net Profit</div><div class="value">${f.netProfit < 0 ? '-' : ''}₹${Math.abs(Math.round(f.netProfit)).toLocaleString()}</div></div>
  </div>

  <div class="section">
    <h2>Revenue by Order Type</h2>
    <table>
      <tr><th>Type</th><th style="text-align:right">Amount</th><th style="text-align:right">%</th></tr>
      ${revenueRows || '<tr><td colspan="3" style="text-align:center;color:#737685">No revenue</td></tr>'}
      <tr class="total-row"><td>Total</td><td style="text-align:right">₹${Math.round(f.totalRevenue).toLocaleString()}</td><td></td></tr>
    </table>
  </div>

  <div class="section">
    <h2>Expense Summary</h2>
    <table>
      <tr><th>Category</th><th>Group</th><th style="text-align:right">Amount</th></tr>
      ${expenseRows || '<tr><td colspan="3" style="text-align:center;color:#737685">No expenses</td></tr>'}
      <tr class="total-row"><td colspan="2">Total</td><td style="text-align:right">₹${Math.round(f.totalExpenses).toLocaleString()}</td></tr>
    </table>
  </div>

  ${orderDetailRows ? `<div class="section">
    <h2>Order Details (${orders.filter(o => o.status !== 'cancelled').length} orders)</h2>
    <table>
      <tr><th>Date</th><th>Order</th><th>Customer</th><th style="text-align:right">Total</th><th style="text-align:right">Paid</th><th style="text-align:right">Due</th></tr>
      ${orderDetailRows}
    </table>
  </div>` : ''}

  ${expenseDetailRows ? `<div class="section">
    <h2>Expense Details (${expenses.length} entries)</h2>
    <table>
      <tr><th>Date</th><th>Category</th><th>Description</th><th>Vendor</th><th style="text-align:right">Amount</th></tr>
      ${expenseDetailRows}
    </table>
  </div>` : ''}

  <div class="profit-section ${f.netProfit >= 0 ? 'blue' : 'loss'}">
    <div class="label">NET PROFIT / LOSS</div>
    <div class="value">${f.netProfit < 0 ? '-' : ''}₹${Math.abs(Math.round(f.netProfit)).toLocaleString()}</div>
  </div>

  <div class="footer">
    Laundrybill &middot; Financial Report &middot; ${periodLabel}
  </div>
</body>
</html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Financial Report' });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to generate report');
    }
    setGeneratingReport(false);
  }, [financials, expenses, orders, periodLabel]);

  // ─── Render ─────────────────────────────────────────────────────────

  const PERIOD_OPTIONS: { key: TimePeriod; label: string; icon: string }[] = [
    { key: 'day', label: 'Today', icon: 'today' },
    { key: 'week', label: 'This Week', icon: 'date-range' },
    { key: 'month', label: 'This Month', icon: 'calendar-month' },
    { key: 'year', label: 'This Year', icon: 'calendar-today' },
    { key: 'custom', label: 'Custom Range', icon: 'tune' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Finance</Text>
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
                  <Text style={styles.toolbarReportText}>Report</Text>
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
                {PERIOD_OPTIONS.find((p) => p.key === timePeriod)?.label || 'Month'}
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
              <Text style={styles.summaryLabel}>INCOME</Text>
              <Text style={[styles.summaryValue, { color: '#2e7d32' }]}>₹{Math.round(financials.totalRevenue).toLocaleString()}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: '#fce4ec' }]}>
              <Text style={styles.summaryLabel}>EXPENSES</Text>
              <Text style={[styles.summaryValue, { color: '#c62828' }]}>₹{Math.round(financials.totalExpenses).toLocaleString()}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: '#fff3e0' }]}>
              <Text style={styles.summaryLabel}>PENDING</Text>
              <Text style={[styles.summaryValue, { color: '#e65100' }]}>₹{Math.round(financials.pending).toLocaleString()}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: financials.netProfit >= 0 ? '#e3f2fd' : '#ffdad6' }]}>
              <Text style={styles.summaryLabel}>NET PROFIT</Text>
              <Text style={[styles.summaryValue, { color: financials.netProfit >= 0 ? '#00408f' : '#93000a' }]}>
                {financials.netProfit < 0 ? '-' : ''}₹{Math.abs(Math.round(financials.netProfit)).toLocaleString()}
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
                  {mode === 'overview' ? 'Overview' : mode === 'revenue' ? 'Revenue' : 'Expenses'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ─── OVERVIEW TAB ───────────────────────────────────── */}
          {viewMode === 'overview' && (
            <>
              {/* Revenue by Order Type */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Revenue by Order Type</Text>
                {Object.entries(financials.revenueByType)
                  .filter(([, v]) => v > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, amount]) => {
                    const labels: Record<string, string> = { pickup_store: 'Shop Pickup', delivery_home: 'Home Delivery', pickup_home: 'Pickup from Home' };
                    const pct = financials.totalRevenue > 0 ? Math.round((amount / financials.totalRevenue) * 100) : 0;
                    return (
                      <View key={type} style={styles.breakdownRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.breakdownLabel}>{labels[type] || type}</Text>
                          <View style={styles.barBg}>
                            <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: '#00408f' }]} />
                          </View>
                        </View>
                        <Text style={styles.breakdownValue}>₹{Math.round(amount).toLocaleString()}</Text>
                        <Text style={styles.breakdownPct}>{pct}%</Text>
                      </View>
                    );
                  })}
                {financials.totalRevenue === 0 && <Text style={styles.emptySmall}>No revenue in this period</Text>}
              </View>

              {/* Expenses by Group */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Expenses by Category</Text>
                {Object.entries(financials.expByGroup)
                  .sort(([, a], [, b]) => b - a)
                  .map(([group, amount]) => {
                    const pct = financials.totalExpenses > 0 ? Math.round((amount / financials.totalExpenses) * 100) : 0;
                    const color = CATEGORY_COLORS[group] || '#434654';
                    return (
                      <View key={group} style={styles.breakdownRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.breakdownLabel}>{group}</Text>
                          <View style={styles.barBg}>
                            <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
                          </View>
                        </View>
                        <Text style={styles.breakdownValue}>₹{Math.round(amount).toLocaleString()}</Text>
                        <Text style={styles.breakdownPct}>{pct}%</Text>
                      </View>
                    );
                  })}
                {financials.totalExpenses === 0 && <Text style={styles.emptySmall}>No expenses in this period</Text>}
              </View>

              {/* Collection Status */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Collection Status</Text>
                <View style={styles.collectionRow}>
                  <View style={styles.collectionItem}>
                    <Text style={styles.collectionLabel}>Collected</Text>
                    <Text style={[styles.collectionValue, { color: '#2e7d32' }]}>₹{Math.round(financials.collected).toLocaleString()}</Text>
                  </View>
                  <View style={styles.collectionDivider} />
                  <View style={styles.collectionItem}>
                    <Text style={styles.collectionLabel}>Pending</Text>
                    <Text style={[styles.collectionValue, { color: '#e65100' }]}>₹{Math.round(financials.pending).toLocaleString()}</Text>
                  </View>
                  <View style={styles.collectionDivider} />
                  <View style={styles.collectionItem}>
                    <Text style={styles.collectionLabel}>Orders</Text>
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
                  <Text style={styles.emptyText}>No orders in this period</Text>
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
                    const typeLabels: Record<string, string> = { pickup_store: 'Pickup', delivery_home: 'Delivery', pickup_home: 'Home Pickup' };
                    return (
                      <View key={order.id} style={styles.revenueCard}>
                        <View style={{ flex: 1 }}>
                          <View style={styles.revenueTopRow}>
                            <Text style={styles.revenueOrderId}>#{publicId}</Text>
                            <Text style={styles.revenueDate}>{formatDate(created)}</Text>
                          </View>
                          <Text style={styles.revenueName}>{order.customerName || 'Guest'}</Text>
                          <View style={styles.revenueMeta}>
                            <Text style={styles.revenueType}>{typeLabels[dType] || dType}</Text>
                            {balance > 0 ? (
                              <Text style={styles.revenueDue}>Due ₹{balance}</Text>
                            ) : (
                              <Text style={styles.revenuePaid}>Paid</Text>
                            )}
                          </View>
                        </View>
                        <Text style={styles.revenueAmount}>₹{total}</Text>
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
                  <Text style={styles.emptyText}>No expenses recorded in this period</Text>
                  <TouchableOpacity style={styles.addBtnInline} onPress={() => setAddModal(true)}>
                    <MaterialIcons name="add" size={18} color="#fff" />
                    <Text style={styles.addBtnInlineText}>Add Expense</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.listGap}>
                  {expenses.map((exp) => {
                    const cat = CATEGORY_MAP[exp.category] || { label: exp.category || 'Other', icon: 'more-horiz', group: 'Other' };
                    const color = CATEGORY_COLORS[cat.group] || '#434654';
                    const created = toDate(exp.date);
                    return (
                      <View key={exp.id} style={styles.expenseCard}>
                        <View style={[styles.expenseIcon, { backgroundColor: color + '18' }]}>
                          <MaterialIcons name={cat.icon as any} size={18} color={color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.expenseName}>{exp.description || cat.label}</Text>
                          <View style={styles.expenseMeta}>
                            <Text style={styles.expenseMetaText}>{cat.label}</Text>
                            <View style={styles.dot} />
                            <Text style={styles.expenseMetaText}>{formatDate(created)}</Text>
                            {exp.vendor ? (
                              <>
                                <View style={styles.dot} />
                                <Text style={styles.expenseMetaText}>{exp.vendor}</Text>
                              </>
                            ) : null}
                          </View>
                        </View>
                        <Text style={styles.expenseAmount}>-₹{Math.round(exp.amount)}</Text>
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
          <Text style={styles.modalTitle}>Select Time Period</Text>
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
            <Text style={styles.modalTitle}>Custom Date Range</Text>
            <Text style={styles.fieldLabel}>Start Date (DD/MM/YYYY)</Text>
            <TextInput
              style={styles.modalInput}
              value={customStartText}
              onChangeText={setCustomStartText}
              placeholder="01/01/2026"
              placeholderTextColor="#c3c6d6"
              keyboardType="numbers-and-punctuation"
              autoFocus
            />
            <Text style={styles.fieldLabel}>End Date (DD/MM/YYYY)</Text>
            <TextInput
              style={styles.modalInput}
              value={customEndText}
              onChangeText={setCustomEndText}
              placeholder="31/01/2026"
              placeholderTextColor="#c3c6d6"
              keyboardType="numbers-and-punctuation"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCustomDateModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={applyCustomDates}>
                <Text style={styles.primaryBtnText}>Apply</Text>
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
            <Text style={styles.modalTitle}>Add Expense</Text>

            {/* Amount */}
            <Text style={styles.fieldLabel}>Amount <Text style={{ color: '#c62828' }}>*</Text></Text>
            <View style={styles.amountRow}>
              <Text style={styles.currencySign}>₹</Text>
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
            <Text style={styles.fieldLabel}>Category <Text style={{ color: '#c62828' }}>*</Text></Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
              {EXPENSE_CATEGORIES.map((cat) => {
                const isSelected = expCategory === cat.key;
                const color = CATEGORY_COLORS[cat.group] || '#434654';
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[styles.catChip, isSelected && { backgroundColor: color, borderColor: color }]}
                    onPress={() => setExpCategory(cat.key)}
                  >
                    <MaterialIcons name={cat.icon as any} size={14} color={isSelected ? '#fff' : color} />
                    <Text style={[styles.catChipText, isSelected && { color: '#fff' }]}>{cat.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Description */}
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={styles.modalInput}
              value={expDescription}
              onChangeText={setExpDescription}
              placeholder="What was this expense for?"
              placeholderTextColor="#c3c6d6"
            />

            {/* Vendor */}
            <Text style={styles.fieldLabel}>Vendor / Shop</Text>
            <TextInput
              style={styles.modalInput}
              value={expVendor}
              onChangeText={setExpVendor}
              placeholder="Optional"
              placeholderTextColor="#c3c6d6"
            />

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setAddModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, (!expAmount || !expCategory) && { opacity: 0.5 }]}
                onPress={handleAddExpense}
                disabled={saving || !expAmount || !expCategory}
              >
                {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                  <Text style={styles.primaryBtnText}>Add Expense</Text>
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
