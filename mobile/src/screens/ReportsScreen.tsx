import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, Pressable, Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import { useShopCountrySettings } from '../lib/use-shop-country-settings';
import { formatCurrency, getDisplaySymbol } from '../lib/currency-format';
import { colors, fonts, radii, shadows } from '../theme';

// ─── Types ────────────────────────────────────────────────────────────

type TimePeriod = 'today' | 'week' | 'month' | 'last_month' | 'custom';

interface ReportData {
  revenue: number;
  collections: number;
  outstanding: number;
  expensesOnly: number; // expenses docs only (no salaries)
  salariesPaid: number;
  totalExpenses: number; // expensesOnly + salariesPaid — matches web use-finance.ts
  netProfit: number; // collections − totalExpenses (cash basis — matches web)
  orderCount: number; // non-cancelled — matches web
  cancelledCount: number;
  avgOrderValue: number;
  statusCounts: Record<string, number>;
  deliveryTypeCounts: Record<string, number>;
  sourceCounts: { online: number; direct: number };
  topServices: { name: string; orders: number; revenue: number }[];
  paymentsByMethod: [string, number][];
  expensesByCategory: Record<string, number>;
  attendance: { present: number; absent: number; half: number; leave: number };
  staffDays: { staffId: string; staffName: string; presentDays: number }[];
  newCustomers: number;
  totalCustomers: number;
}

const EMPTY_REPORT: ReportData = {
  revenue: 0, collections: 0, outstanding: 0,
  expensesOnly: 0, salariesPaid: 0, totalExpenses: 0, netProfit: 0,
  orderCount: 0, cancelledCount: 0, avgOrderValue: 0,
  statusCounts: {}, deliveryTypeCounts: {}, sourceCounts: { online: 0, direct: 0 },
  topServices: [],
  paymentsByMethod: [], expensesByCategory: {},
  attendance: { present: 0, absent: 0, half: 0, leave: 0 },
  staffDays: [], newCustomers: 0, totalCustomers: 0,
};

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

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Period → [start, end]. Week starts Sunday to match OrdersScreen's filter. */
function getPeriodRange(
  period: TimePeriod,
  customStart: Date | null,
  customEnd: Date | null,
): { start: Date; end: Date } {
  const now = new Date();
  switch (period) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start, end };
    }
    case 'week': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay(), 0, 0, 0, 0);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
      return { start, end };
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start, end };
    }
    case 'custom': {
      const s = customStart || now;
      const e = customEnd || customStart || now;
      const start = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0);
      const end = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59, 999);
      return { start, end };
    }
  }
}

function statusLabelT(status: string, t: TFunction): string {
  const map: Record<string, [string, string]> = {
    pending: ['mobile.orderStatusPending', 'Pending'],
    confirmed: ['mobile.orderStatusConfirmed', 'Confirmed'],
    picked_up_from_customer: ['mobile.orderStatusPickedUp', 'Picked Up'],
    processing: ['mobile.orderStatusInProgress', 'Processing'],
    ready: ['mobile.orderStatusReady', 'Ready'],
    ready_for_pickup: ['mobile.orderStatusReady', 'Ready'],
    ready_for_delivery: ['mobile.orderStatusReady', 'Ready'],
    out_for_delivery: ['mobile.orderStatusOutForDelivery', 'Out for Delivery'],
    delivered: ['mobile.orderStatusCompleted', 'Delivered'],
    picked_up: ['mobile.orderStatusCompleted', 'Completed'],
    partially_delivered: ['mobile.orderStatusPartial', 'Partially Delivered'],
    cancelled: ['mobile.orderStatusCancelled', 'Cancelled'],
  };
  const m = map[status];
  return m ? t(m[0], { defaultValue: m[1] }) : status;
}

function deliveryTypeLabelT(type: string, t: TFunction): string {
  const map: Record<string, [string, string]> = {
    pickup_store: ['mobile.expDType_pickup_store', 'Store Pickup'],
    pickup_home: ['mobile.expDType_pickup_home', 'Home Pickup'],
    delivery_home: ['mobile.expDType_delivery_home', 'Home Delivery'],
  };
  const m = map[type];
  return m ? t(m[0], { defaultValue: m[1] }) : type;
}

function expCategoryLabelT(catKey: string, t: TFunction): string {
  const k = `mobile.expCat_${catKey}`;
  const tr = t(k, { defaultValue: '' });
  if (tr) return tr;
  // Fall back to a readable form of the key
  return catKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── PDF Report HTML (Latin-1 safe: no emoji) ─────────────────────────

function buildReportHtml(opts: {
  shopName: string;
  periodLabel: string;
  data: ReportData;
  t: TFunction;
  locale: string;
  currencySymbol: string;
}): string {
  const { shopName, periodLabel, data, t, locale, currencySymbol } = opts;
  const loc = locale || 'en-IN';
  const fmt = (v: number) => {
    const sign = v < 0 ? '-' : '';
    return `${sign}${currencySymbol}${Math.round(Math.abs(v || 0)).toLocaleString(loc)}`;
  };
  const genDate = new Date().toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' });

  const kpis: { label: string; value: string; cls: string }[] = [
    { label: t('mobile.repKpiRevenue', { defaultValue: 'Revenue' }), value: fmt(data.revenue), cls: 'blue' },
    { label: t('mobile.repKpiCollections', { defaultValue: 'Collections' }), value: fmt(data.collections), cls: 'green' },
    { label: t('mobile.repKpiOutstanding', { defaultValue: 'Outstanding' }), value: fmt(data.outstanding), cls: 'orange' },
    { label: t('mobile.repKpiExpenses', { defaultValue: 'Expenses' }), value: fmt(data.totalExpenses), cls: 'red' },
    { label: t('mobile.repKpiNetProfit', { defaultValue: 'Net Profit' }), value: fmt(data.netProfit), cls: data.netProfit >= 0 ? 'blue' : 'loss' },
    { label: t('mobile.repKpiOrders', { defaultValue: 'Orders' }), value: String(data.orderCount), cls: 'plain' },
    { label: t('mobile.repKpiAvgOrder', { defaultValue: 'Avg Order Value' }), value: fmt(data.avgOrderValue), cls: 'plain' },
    { label: t('mobile.repKpiNewCustomers', { defaultValue: 'New Customers' }), value: String(data.newCustomers), cls: 'plain' },
  ];
  const kpiBoxes = kpis.map((k) =>
    `<div class="summary-box ${k.cls}"><div class="label">${escHtml(k.label)}</div><div class="value">${escHtml(k.value)}</div></div>`
  ).join('');

  const statusRows = Object.entries(data.statusCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([st, n]) => `<tr><td>${escHtml(statusLabelT(st, t))}</td><td style="text-align:right">${n}</td></tr>`)
    .join('');
  const dtypeRows = Object.entries(data.deliveryTypeCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([dt, n]) => `<tr><td>${escHtml(deliveryTypeLabelT(dt, t))}</td><td style="text-align:right">${n}</td></tr>`)
    .join('');
  const sourceRows = [
    `<tr><td>${escHtml(t('mobile.repSourceOnline', { defaultValue: 'Online' }))}</td><td style="text-align:right">${data.sourceCounts.online}</td></tr>`,
    `<tr><td>${escHtml(t('mobile.repSourceDirect', { defaultValue: 'In-store / Direct' }))}</td><td style="text-align:right">${data.sourceCounts.direct}</td></tr>`,
  ].join('');

  const noData = escHtml(t('mobile.repNoData', { defaultValue: 'No data for this period' }));
  const serviceRows = data.topServices.map((sv) =>
    `<tr><td>${escHtml(sv.name)}</td><td style="text-align:right">${sv.orders}</td><td style="text-align:right">${fmt(sv.revenue)}</td></tr>`
  ).join('');
  const expenseRows = Object.entries(data.expensesByCategory)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, amt]) => `<tr><td>${escHtml(expCategoryLabelT(cat, t))}</td><td style="text-align:right">${fmt(amt)}</td></tr>`)
    .join('');
  const staffRows = data.staffDays.map((sm) =>
    `<tr><td>${escHtml(sm.staffName)}</td><td style="text-align:right">${sm.presentDays}</td></tr>`
  ).join('');

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
    .summary-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
    .summary-box { flex: 1; min-width: 110px; border-radius: 8px; padding: 12px; background: #f8f9fb; }
    .summary-box .label { font-size: 9px; font-weight: 700; letter-spacing: 0.5px; color: #434654; text-transform: uppercase; }
    .summary-box .value { font-size: 18px; font-weight: 800; margin-top: 2px; }
    .green { background: #e8f5e9; } .green .value { color: #2e7d32; }
    .red { background: #fce4ec; } .red .value { color: #c62828; }
    .orange { background: #fff3e0; } .orange .value { color: #e65100; }
    .blue { background: #e3f2fd; } .blue .value { color: #00408f; }
    .loss { background: #ffdad6; } .loss .value { color: #93000a; }
    .section { margin-bottom: 20px; }
    .section h2 { font-size: 14px; font-weight: 700; color: #00408f; margin-bottom: 8px; border-bottom: 1px solid #edeef0; padding-bottom: 4px; }
    .cols { display: flex; gap: 16px; }
    .cols > div { flex: 1; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #f3f4f6; }
    th { font-size: 10px; font-weight: 700; color: #434654; text-transform: uppercase; letter-spacing: 0.3px; background: #f8f9fb; }
    tr:last-child td { border-bottom: none; }
    .empty { text-align: center; color: #737685; padding: 8px; }
    .footer { text-align: center; margin-top: 24px; padding-top: 12px; border-top: 1px solid #edeef0; font-size: 10px; color: #737685; }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>${escHtml(shopName)}</h1>
    <div class="period">${escHtml(t('mobile.repReportTitle', { defaultValue: 'Business Report' }))} — ${escHtml(periodLabel)}</div>
    <div class="generated">${escHtml(t('mobile.finReportGeneratedOn', { date: genDate, defaultValue: `Generated on ${genDate}` }))}</div>
  </div>

  <div class="summary-grid">${kpiBoxes}</div>

  <div class="section">
    <h2>${escHtml(t('mobile.repOrdersBreakdown', { defaultValue: 'Orders Breakdown' }))}</h2>
    <div class="cols">
      <div>
        <table>
          <tr><th>${escHtml(t('mobile.repColStatus', { defaultValue: 'Status' }))}</th><th style="text-align:right">${escHtml(t('mobile.repColOrders', { defaultValue: 'Orders' }))}</th></tr>
          ${statusRows || `<tr><td colspan="2" class="empty">${noData}</td></tr>`}
        </table>
      </div>
      <div>
        <table>
          <tr><th>${escHtml(t('mobile.repColDeliveryType', { defaultValue: 'Delivery Type' }))}</th><th style="text-align:right">${escHtml(t('mobile.repColOrders', { defaultValue: 'Orders' }))}</th></tr>
          ${dtypeRows || `<tr><td colspan="2" class="empty">${noData}</td></tr>`}
        </table>
        <table style="margin-top:12px">
          <tr><th>${escHtml(t('mobile.repColSource', { defaultValue: 'Source' }))}</th><th style="text-align:right">${escHtml(t('mobile.repColOrders', { defaultValue: 'Orders' }))}</th></tr>
          ${sourceRows}
        </table>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>${escHtml(t('mobile.repTopServices', { defaultValue: 'Top Services' }))}</h2>
    <table>
      <tr><th>${escHtml(t('mobile.repColService', { defaultValue: 'Service' }))}</th><th style="text-align:right">${escHtml(t('mobile.repColOrders', { defaultValue: 'Orders' }))}</th><th style="text-align:right">${escHtml(t('mobile.repColRevenue', { defaultValue: 'Revenue' }))}</th></tr>
      ${serviceRows || `<tr><td colspan="3" class="empty">${noData}</td></tr>`}
    </table>
  </div>

  <div class="section">
    <h2>${escHtml(t('mobile.repExpensesByCategory', { defaultValue: 'Expenses by Category' }))}</h2>
    <table>
      <tr><th>${escHtml(t('mobile.finRepColCategory', { defaultValue: 'Category' }))}</th><th style="text-align:right">${escHtml(t('mobile.finRepColAmount', { defaultValue: 'Amount' }))}</th></tr>
      ${expenseRows || `<tr><td colspan="2" class="empty">${noData}</td></tr>`}
      ${expenseRows ? `<tr><td style="font-weight:800">${escHtml(t('mobile.finRepTotal', { defaultValue: 'Total' }))}</td><td style="text-align:right;font-weight:800">${fmt(data.totalExpenses)}</td></tr>` : ''}
    </table>
  </div>

  <div class="section">
    <h2>${escHtml(t('mobile.repStaffAttendance', { defaultValue: 'Staff & Attendance' }))}</h2>
    <div class="cols">
      <div>
        <table>
          <tr><th>${escHtml(t('mobile.repColStatus', { defaultValue: 'Status' }))}</th><th style="text-align:right">${escHtml(t('mobile.repColDays', { defaultValue: 'Days' }))}</th></tr>
          <tr><td>${escHtml(t('mobile.attPresent', { defaultValue: 'Present' }))}</td><td style="text-align:right">${data.attendance.present}</td></tr>
          <tr><td>${escHtml(t('mobile.attHalf', { defaultValue: 'Half Day' }))}</td><td style="text-align:right">${data.attendance.half}</td></tr>
          <tr><td>${escHtml(t('mobile.attLeave', { defaultValue: 'Leave' }))}</td><td style="text-align:right">${data.attendance.leave}</td></tr>
          <tr><td>${escHtml(t('mobile.attAbsent', { defaultValue: 'Absent' }))}</td><td style="text-align:right">${data.attendance.absent}</td></tr>
        </table>
      </div>
      <div>
        <table>
          <tr><th>${escHtml(t('mobile.repColStaff', { defaultValue: 'Staff' }))}</th><th style="text-align:right">${escHtml(t('mobile.repColPresentDays', { defaultValue: 'Present Days' }))}</th></tr>
          ${staffRows || `<tr><td colspan="2" class="empty">${noData}</td></tr>`}
        </table>
      </div>
    </div>
    ${data.salariesPaid > 0 ? `<p style="margin-top:8px;font-weight:700">${escHtml(t('mobile.repSalariesPaid', { defaultValue: 'Salaries paid' }))}: ${fmt(data.salariesPaid)}</p>` : ''}
  </div>

  <div class="section">
    <h2>${escHtml(t('mobile.repCustomers', { defaultValue: 'Customers' }))}</h2>
    <table>
      <tr><td>${escHtml(t('mobile.repKpiNewCustomers', { defaultValue: 'New Customers' }))}</td><td style="text-align:right">${data.newCustomers}</td></tr>
      <tr><td>${escHtml(t('mobile.repTotalCustomers', { defaultValue: 'Total Customers' }))}</td><td style="text-align:right">${data.totalCustomers}</td></tr>
    </table>
  </div>

  <div class="footer">${escHtml(shopName)} — ${escHtml(periodLabel)}</div>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────

export default function ReportsScreen({ onBack }: { onBack?: () => void }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const shopId = getShopId();
  const countrySettings = useShopCountrySettings(shopId);

  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);
  const [calMonth, setCalMonth] = useState<Date>(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportData>(EMPTY_REPORT);
  const [shopName, setShopName] = useState('');
  const [exporting, setExporting] = useState(false);

  const { start, end } = useMemo(
    () => getPeriodRange(timePeriod, customStart, customEnd),
    [timePeriod, customStart, customEnd],
  );

  const periodLabel = useMemo(() => {
    const loc = i18n.language || 'en-IN';
    const fmtD = (d: Date) => d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' });
    switch (timePeriod) {
      case 'today': return t('mobile.timeFilterToday', { defaultValue: 'Today' });
      case 'week': return t('mobile.timeFilterWeek', { defaultValue: 'This Week' });
      case 'month': return t('mobile.timeFilterMonth', { defaultValue: 'This Month' });
      case 'last_month': return t('mobile.timeFilterLastMonth', { defaultValue: 'Last Month' });
      case 'custom': return `${fmtD(start)} – ${fmtD(end)}`;
    }
  }, [timePeriod, start, end, t, i18n.language]);

  // Fetch shop name once (for the PDF header)
  useEffect(() => {
    if (!shopId) return;
    firestore().collection('shops').doc(shopId).get()
      .then((doc: any) => { if (doc.exists) setShopName(doc.data()?.name || ''); })
      .catch(() => {});
  }, [shopId]);

  // ─── One-time report fetch (mirrors web src/hooks/use-finance.ts useFinancialReports) ──
  useEffect(() => {
    if (!shopId) { setLoading(false); return; }
    let aborted = false;
    setLoading(true);

    (async () => {
      try {
        const fs = firestore();

        // 1. Orders in period (createdAt within range)
        const ordersSnap = await fs
          .collection(`shops/${shopId}/orders`)
          .where('createdAt', '>=', start)
          .where('createdAt', '<=', end)
          .get();

        let revenue = 0;
        let collections = 0;
        let outstanding = 0;
        let cancelledCount = 0;
        const statusCounts: Record<string, number> = {};
        const deliveryTypeCounts: Record<string, number> = {};
        const sourceCounts = { online: 0, direct: 0 };
        const serviceMap = new Map<string, { orders: number; revenue: number }>();
        const payMethodMap: Record<string, number> = {};

        ordersSnap.forEach((docSnap: any) => {
          const o = docSnap.data();
          const total = o.financials?.total || 0;
          const paid = o.financials?.amountPaid || 0;
          const balance = o.financials?.balance ?? (total - paid);
          const status = o.status || 'pending';
          const dType = o.deliveryType || 'pickup_store';

          statusCounts[status] = (statusCounts[status] || 0) + 1;
          deliveryTypeCounts[dType] = (deliveryTypeCounts[dType] || 0) + 1;
          if (o.orderSource === 'online') sourceCounts.online += 1;
          else sourceCounts.direct += 1;

          if (status === 'cancelled') {
            cancelledCount += 1;
            return;
          }
          // Non-cancelled: revenue / collections / outstanding — same as web
          revenue += total;
          collections += paid;
          // Collected by method, from the payments array (mirrors the web card)
          (o.payments || []).forEach((pmt: any) => {
            const m = pmt.method || 'cash';
            payMethodMap[m] = (payMethodMap[m] || 0) + (pmt.amount || 0);
          });
          outstanding += balance > 0 ? balance : 0;

          (o.items || []).forEach((it: any) => {
            const name = it.serviceName || it.name || 'Other';
            const rev = it.total ?? (it.unitPrice || 0) * (it.quantity || 0);
            const m = serviceMap.get(name) || { orders: 0, revenue: 0 };
            m.revenue += rev;
            m.orders += 1;
            serviceMap.set(name, m);
          });
        });

        const topServices = Array.from(serviceMap.entries())
          .map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5);
        const paymentsByMethod = Object.entries(payMethodMap).sort((a, b) => b[1] - a[1]) as [string, number][];

        // 2. Expenses in period (by `date` field — same as web)
        const expSnap = await fs
          .collection(`shops/${shopId}/expenses`)
          .where('date', '>=', start)
          .where('date', '<=', end)
          .get();
        let expensesOnly = 0;
        const expensesByCategory: Record<string, number> = {};
        expSnap.forEach((d: any) => {
          const e = d.data();
          const amt = e.amount || 0;
          const cat = e.category || 'miscellaneous';
          expensesOnly += amt;
          expensesByCategory[cat] = (expensesByCategory[cat] || 0) + amt;
        });

        // 3. Payroll (salaries actually paid, by month — same as web: status paid/partial → totalPaid)
        const monthsInRange: string[] = [];
        { const cur = new Date(start); cur.setDate(1); while (cur <= end) { monthsInRange.push(monthKey(cur)); cur.setMonth(cur.getMonth() + 1); } }
        let salariesPaid = 0;
        const staffMap = new Map<string, { staffId: string; staffName: string; presentDays: number }>();
        for (let i = 0; i < monthsInRange.length; i += 10) {
          const chunk = monthsInRange.slice(i, i + 10);
          if (!chunk.length) continue;
          const pSnap = await fs.collection(`shops/${shopId}/payroll`).where('month', 'in', chunk).get();
          pSnap.forEach((d: any) => {
            const p = d.data();
            if (p.status === 'paid' || p.status === 'partial') salariesPaid += p.totalPaid || 0;
            if (p.staffId) {
              const ex = staffMap.get(p.staffId) || { staffId: p.staffId, staffName: p.staffName || '', presentDays: 0 };
              if (!ex.staffName && p.staffName) ex.staffName = p.staffName;
              staffMap.set(p.staffId, ex);
            }
          });
        }

        // 4. Attendance in period (docs keyed by 'yyyy-MM-dd' date strings)
        const attSnap = await fs
          .collection(`shops/${shopId}/attendance`)
          .where('date', '>=', dayKey(start))
          .where('date', '<=', dayKey(end))
          .get();
        const attendance = { present: 0, absent: 0, half: 0, leave: 0 };
        attSnap.forEach((d: any) => {
          const a = d.data();
          if (a.status === 'present') attendance.present += 1;
          else if (a.status === 'absent') attendance.absent += 1;
          else if (a.status === 'half') attendance.half += 1;
          else if (a.status === 'leave') attendance.leave += 1;
          // Present days per staff — half counts 0.5 (matches web)
          if ((a.status === 'present' || a.status === 'half') && a.staffId) {
            const ex = staffMap.get(a.staffId) || { staffId: a.staffId, staffName: '', presentDays: 0 };
            ex.presentDays += a.status === 'half' ? 0.5 : 1;
            staffMap.set(a.staffId, ex);
          }
        });

        // 4b. Backfill missing staff names
        const needNames = Array.from(staffMap.values()).filter((sm) => !sm.staffName).map((sm) => sm.staffId);
        if (needNames.length) {
          const sSnap = await fs.collection(`shops/${shopId}/staff`).get();
          const nameMap = new Map<string, string>();
          sSnap.forEach((d: any) => nameMap.set(d.id, d.data().name));
          needNames.forEach((id) => { const m = staffMap.get(id); if (m) m.staffName = nameMap.get(id) || 'Staff'; });
        }

        // 5. Customers — new in period + total (same as web: fetch all, filter by createdAt)
        const custSnap = await fs.collection(`shops/${shopId}/customers`).get();
        let newCustomers = 0;
        custSnap.forEach((d: any) => {
          const created = toDate(d.data().createdAt);
          if (created && created >= start && created <= end) newCustomers += 1;
        });

        const orderCount = ordersSnap.size - cancelledCount;
        const totalExpenses = expensesOnly + salariesPaid;
        // Cash-basis profit (collections − expenses incl. salaries) — matches web use-finance.ts
        const netProfit = collections - totalExpenses;
        if (salariesPaid > 0) expensesByCategory['salary'] = (expensesByCategory['salary'] || 0) + salariesPaid;

        if (aborted) return;
        setData({
          revenue, collections, outstanding,
          expensesOnly, salariesPaid, totalExpenses, netProfit,
          orderCount, cancelledCount,
          avgOrderValue: orderCount > 0 ? revenue / orderCount : 0,
          statusCounts, deliveryTypeCounts, sourceCounts,
          topServices,
          paymentsByMethod, expensesByCategory,
          attendance,
          staffDays: Array.from(staffMap.values())
            .filter((sm) => sm.presentDays > 0)
            .sort((a, b) => b.presentDays - a.presentDays),
          newCustomers,
          totalCustomers: custSnap.size,
        });
        setLoading(false);
      } catch (e: any) {
        if (aborted) return;
        setData(EMPTY_REPORT);
        setLoading(false);
        Alert.alert(t('mobile.errorTitle', { defaultValue: 'Error' }), e?.message || 'Failed to load report');
      }
    })();

    return () => { aborted = true; };
  }, [shopId, start.getTime(), end.getTime()]);

  // ─── PDF export ─────────────────────────────────────────────────────
  const handleExportPdf = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const html = buildReportHtml({
        shopName: shopName || 'LaundryBill',
        periodLabel: periodLabel || '',
        data,
        t,
        locale: countrySettings.locale || i18n.language,
        currencySymbol: getDisplaySymbol(countrySettings),
      });
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: t('mobile.repShareTitle', { defaultValue: 'Share Business Report' }),
      });
    } catch (e: any) {
      Alert.alert(t('mobile.errorTitle', { defaultValue: 'Error' }), e?.message || 'Failed to export report');
    }
    setExporting(false);
  }, [exporting, shopName, periodLabel, data, t, countrySettings, i18n.language]);

  // ─── Period picker (same UX as OrdersScreen) ───────────────────────
  const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const calendarCells = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [calMonth]);

  const sameDay = (a: Date | null, b: Date | null) =>
    !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const inRange = (d: Date) =>
    customStart && customEnd && d >= new Date(customStart.getFullYear(), customStart.getMonth(), customStart.getDate()) &&
    d <= new Date(customEnd.getFullYear(), customEnd.getMonth(), customEnd.getDate());

  const handleDayPress = (d: Date) => {
    if (!customStart || (customStart && customEnd)) {
      setCustomStart(d);
      setCustomEnd(null);
    } else if (d < customStart) {
      setCustomEnd(customStart);
      setCustomStart(d);
    } else {
      setCustomEnd(d);
    }
  };

  const applyQuickPeriod = (key: TimePeriod) => {
    setTimePeriod(key);
    setCustomStart(null);
    setCustomEnd(null);
    setShowTimePicker(false);
  };

  const monthTitle = calMonth.toLocaleDateString(i18n.language || 'en-IN', { month: 'long', year: 'numeric' });

  const QUICK_PERIODS: { key: TimePeriod; label: string }[] = [
    { key: 'today', label: t('mobile.timeFilterToday', { defaultValue: 'Today' }) },
    { key: 'week', label: t('mobile.timeFilterWeek', { defaultValue: 'This Week' }) },
    { key: 'month', label: t('mobile.timeFilterMonth', { defaultValue: 'This Month' }) },
    { key: 'last_month', label: t('mobile.timeFilterLastMonth', { defaultValue: 'Last Month' }) },
  ];

  const fmtMoney = (n: number) => formatCurrency(Math.round(n), countrySettings);
  const noData = data.orderCount === 0 && data.cancelledCount === 0;

  // ─── Render helpers ─────────────────────────────────────────────────
  const renderBreakdownRow = (label: string, count: number, total: number, color: string, key: string) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
      <View key={key} style={s.breakRow}>
        <View style={s.breakLabelRow}>
          <Text style={s.breakLabel} numberOfLines={1}>{label}</Text>
          <Text style={s.breakCount}>{count} · {pct}%</Text>
        </View>
        <View style={s.breakBarTrack}>
          <View style={[s.breakBarFill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>
      </View>
    );
  };

  const totalOrdersAll = data.orderCount + data.cancelledCount;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={onBack} activeOpacity={0.7}>
          <MaterialIcons name="chevron-left" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('mobile.reportsTitle', { defaultValue: 'Reports' })}</Text>
        <TouchableOpacity style={s.iconBtn} onPress={handleExportPdf} activeOpacity={0.7} disabled={exporting || loading}>
          {exporting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <MaterialIcons name="ios-share" size={20} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[s.scrollContent, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Period chip */}
        <TouchableOpacity style={s.dateChip} onPress={() => setShowTimePicker(true)} activeOpacity={0.7}>
          <MaterialIcons name="event" size={15} color={colors.primary} />
          <Text style={s.dateChipText} numberOfLines={1}>{periodLabel}</Text>
          <MaterialIcons name="expand-more" size={16} color={colors.primary} />
        </TouchableOpacity>

        {loading ? (
          <View style={{ paddingVertical: 64, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {/* ── KPI grid ── */}
            <View style={s.kpiGrid}>
              <View style={s.kpiCard}>
                <Text style={s.kpiLabel}>{t('mobile.repKpiRevenue', { defaultValue: 'Revenue' })}</Text>
                <Text style={[s.kpiValue, { color: colors.primary }]}>{fmtMoney(data.revenue)}</Text>
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiLabel}>{t('mobile.repKpiCollections', { defaultValue: 'Collections' })}</Text>
                <Text style={[s.kpiValue, { color: colors.success }]}>{fmtMoney(data.collections)}</Text>
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiLabel}>{t('mobile.repKpiOutstanding', { defaultValue: 'Outstanding' })}</Text>
                <Text style={[s.kpiValue, { color: colors.warning }]}>{fmtMoney(data.outstanding)}</Text>
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiLabel}>{t('mobile.repKpiExpenses', { defaultValue: 'Expenses' })}</Text>
                <Text style={[s.kpiValue, { color: colors.error }]}>{fmtMoney(data.totalExpenses)}</Text>
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiLabel}>{t('mobile.repKpiNetProfit', { defaultValue: 'Net Profit' })}</Text>
                <Text style={[s.kpiValue, { color: data.netProfit >= 0 ? colors.success : colors.error }]}>
                  {data.netProfit < 0 ? '-' : ''}{fmtMoney(Math.abs(data.netProfit))}
                </Text>
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiLabel}>{t('mobile.repKpiOrders', { defaultValue: 'Orders' })}</Text>
                <Text style={s.kpiValue}>{data.orderCount}</Text>
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiLabel}>{t('mobile.repKpiAvgOrder', { defaultValue: 'Avg Order Value' })}</Text>
                <Text style={s.kpiValue}>{fmtMoney(data.avgOrderValue)}</Text>
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiLabel}>{t('mobile.repKpiNewCustomers', { defaultValue: 'New Customers' })}</Text>
                <Text style={s.kpiValue}>{data.newCustomers}</Text>
              </View>
            </View>

            {/* ── Orders breakdown ── */}
            <Text style={s.sectionTitle}>{t('mobile.repOrdersBreakdown', { defaultValue: 'ORDERS BREAKDOWN' })}</Text>
            <View style={s.card}>
              {noData ? (
                <View style={s.emptyBox}>
                  <MaterialIcons name="receipt-long" size={32} color={colors.textMuted} />
                  <Text style={s.emptyText}>{t('mobile.repNoOrders', { defaultValue: 'No orders in this period' })}</Text>
                </View>
              ) : (
                <>
                  <Text style={s.cardSubTitle}>{t('mobile.repByStatus', { defaultValue: 'By Status' })}</Text>
                  {Object.entries(data.statusCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([st, n]) => renderBreakdownRow(
                      statusLabelT(st, t), n, totalOrdersAll,
                      st === 'cancelled' ? colors.error : st === 'delivered' || st === 'picked_up' ? colors.success : colors.primary,
                      `st-${st}`,
                    ))}
                  <View style={s.cardDivider} />
                  <Text style={s.cardSubTitle}>{t('mobile.repByDeliveryType', { defaultValue: 'By Delivery Type' })}</Text>
                  {Object.entries(data.deliveryTypeCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([dt, n]) => renderBreakdownRow(deliveryTypeLabelT(dt, t), n, totalOrdersAll, colors.inProgress, `dt-${dt}`))}
                  <View style={s.cardDivider} />
                  <Text style={s.cardSubTitle}>{t('mobile.repBySource', { defaultValue: 'By Source' })}</Text>
                  {renderBreakdownRow(t('mobile.repSourceOnline', { defaultValue: 'Online' }), data.sourceCounts.online, totalOrdersAll, '#0369a1', 'src-online')}
                  {renderBreakdownRow(t('mobile.repSourceDirect', { defaultValue: 'In-store / Direct' }), data.sourceCounts.direct, totalOrdersAll, colors.textSecondary, 'src-direct')}
                </>
              )}
            </View>

            {/* ── Top services ── */}
            <Text style={s.sectionTitle}>{t('mobile.repTopServices', { defaultValue: 'TOP SERVICES' })}</Text>
            <View style={s.card}>
              {data.topServices.length === 0 ? (
                <View style={s.emptyBox}>
                  <MaterialIcons name="local-laundry-service" size={32} color={colors.textMuted} />
                  <Text style={s.emptyText}>{t('mobile.repNoServices', { defaultValue: 'No service data in this period' })}</Text>
                </View>
              ) : (
                data.topServices.map((sv, i) => (
                  <View key={sv.name} style={[s.listRow, i === data.topServices.length - 1 && s.listRowLast]}>
                    <View style={s.rankBadge}><Text style={s.rankBadgeText}>{i + 1}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.listRowTitle} numberOfLines={1}>{sv.name}</Text>
                      <Text style={s.listRowSub}>{sv.orders} {t('mobile.repOrdersLower', { defaultValue: 'orders' })}</Text>
                    </View>
                    <Text style={s.listRowValue}>{fmtMoney(sv.revenue)}</Text>
                  </View>
                ))
              )}
            </View>

            {/* ── Collected by payment method ── */}
            <Text style={s.sectionTitle}>{t('mobile.repPaymentsMix', { defaultValue: 'COLLECTED BY PAYMENT METHOD' })}</Text>
            <View style={s.card}>
              {data.paymentsByMethod.length === 0 ? (
                <View style={s.emptyBox}>
                  <MaterialIcons name="payments" size={32} color={colors.textMuted} />
                  <Text style={s.emptyText}>{t('mobile.repNoPayments', { defaultValue: 'No payments recorded in this period' })}</Text>
                </View>
              ) : (
                data.paymentsByMethod.map(([m, amt], i) => (
                  <View key={m} style={[s.listRow, i === data.paymentsByMethod.length - 1 && s.listRowLast]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.listRowTitle, { textTransform: 'capitalize' }]} numberOfLines={1}>{m.replace(/_/g, ' ')}</Text>
                    </View>
                    <Text style={s.listRowValue}>{fmtMoney(Math.round(amt))}</Text>
                  </View>
                ))
              )}
            </View>

            {/* ── Expenses by category ── */}
            <Text style={s.sectionTitle}>{t('mobile.repExpensesByCategory', { defaultValue: 'EXPENSES BY CATEGORY' })}</Text>
            <View style={s.card}>
              {Object.keys(data.expensesByCategory).filter((k) => data.expensesByCategory[k] > 0).length === 0 ? (
                <View style={s.emptyBox}>
                  <MaterialIcons name="account-balance-wallet" size={32} color={colors.textMuted} />
                  <Text style={s.emptyText}>{t('mobile.repNoExpenses', { defaultValue: 'No expenses in this period' })}</Text>
                </View>
              ) : (
                <>
                  {Object.entries(data.expensesByCategory)
                    .filter(([, v]) => v > 0)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cat, amt], i, arr) => (
                      <View key={cat} style={[s.listRow, i === arr.length - 1 && s.listRowLast]}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.listRowTitle} numberOfLines={1}>{expCategoryLabelT(cat, t)}</Text>
                        </View>
                        <Text style={[s.listRowValue, { color: colors.error }]}>{fmtMoney(amt)}</Text>
                      </View>
                    ))}
                  <View style={s.cardDivider} />
                  <View style={[s.listRow, s.listRowLast]}>
                    <Text style={[s.listRowTitle, { fontFamily: fonts.bold }]}>{t('mobile.finRepTotal', { defaultValue: 'Total' })}</Text>
                    <Text style={[s.listRowValue, { color: colors.error }]}>{fmtMoney(data.totalExpenses)}</Text>
                  </View>
                </>
              )}
            </View>

            {/* ── Staff & attendance ── */}
            <Text style={s.sectionTitle}>{t('mobile.repStaffAttendance', { defaultValue: 'STAFF & ATTENDANCE' })}</Text>
            <View style={s.card}>
              <View style={s.attRow}>
                <View style={s.attCol}>
                  <Text style={[s.attValue, { color: colors.success }]}>{data.attendance.present}</Text>
                  <Text style={s.attLabel}>{t('mobile.attPresent', { defaultValue: 'Present' })}</Text>
                </View>
                <View style={s.attCol}>
                  <Text style={[s.attValue, { color: colors.warning }]}>{data.attendance.half}</Text>
                  <Text style={s.attLabel}>{t('mobile.attHalf', { defaultValue: 'Half Day' })}</Text>
                </View>
                <View style={s.attCol}>
                  <Text style={[s.attValue, { color: colors.inProgress }]}>{data.attendance.leave}</Text>
                  <Text style={s.attLabel}>{t('mobile.attLeave', { defaultValue: 'Leave' })}</Text>
                </View>
                <View style={s.attCol}>
                  <Text style={[s.attValue, { color: colors.error }]}>{data.attendance.absent}</Text>
                  <Text style={s.attLabel}>{t('mobile.attAbsent', { defaultValue: 'Absent' })}</Text>
                </View>
              </View>
              {data.staffDays.length > 0 && (
                <>
                  <View style={s.cardDivider} />
                  {data.staffDays.map((sm, i) => (
                    <View key={sm.staffId} style={[s.listRow, i === data.staffDays.length - 1 && s.listRowLast]}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.listRowTitle} numberOfLines={1}>{sm.staffName}</Text>
                      </View>
                      <Text style={s.listRowSub}>
                        {sm.presentDays} {t('mobile.repDaysLower', { defaultValue: 'days' })}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {data.salariesPaid > 0 && (
                <>
                  <View style={s.cardDivider} />
                  <View style={[s.listRow, s.listRowLast]}>
                    <Text style={s.listRowTitle}>{t('mobile.repSalariesPaid', { defaultValue: 'Salaries paid' })}</Text>
                    <Text style={[s.listRowValue, { color: colors.error }]}>{fmtMoney(data.salariesPaid)}</Text>
                  </View>
                </>
              )}
              {data.staffDays.length === 0 && data.salariesPaid === 0 &&
                data.attendance.present + data.attendance.absent + data.attendance.half + data.attendance.leave === 0 && (
                <View style={s.emptyBox}>
                  <MaterialIcons name="groups" size={32} color={colors.textMuted} />
                  <Text style={s.emptyText}>{t('mobile.repNoAttendance', { defaultValue: 'No attendance records in this period' })}</Text>
                </View>
              )}
            </View>

            {/* ── Customers ── */}
            <Text style={s.sectionTitle}>{t('mobile.repCustomers', { defaultValue: 'CUSTOMERS' })}</Text>
            <View style={s.card}>
              <View style={s.attRow}>
                <View style={s.attCol}>
                  <Text style={[s.attValue, { color: colors.primary }]}>{data.newCustomers}</Text>
                  <Text style={s.attLabel}>{t('mobile.repKpiNewCustomers', { defaultValue: 'New Customers' })}</Text>
                </View>
                <View style={s.attCol}>
                  <Text style={s.attValue}>{data.totalCustomers}</Text>
                  <Text style={s.attLabel}>{t('mobile.repTotalCustomers', { defaultValue: 'Total Customers' })}</Text>
                </View>
              </View>
            </View>

            {/* ── Export button ── */}
            <TouchableOpacity style={s.exportBtn} onPress={handleExportPdf} disabled={exporting} activeOpacity={0.85}>
              {exporting ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <>
                  <MaterialIcons name="picture-as-pdf" size={18} color={colors.surface} />
                  <Text style={s.exportBtnText}>{t('mobile.repExportPdf', { defaultValue: 'Export PDF Report' })}</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Period picker bottom sheet (same UX as OrdersScreen) */}
      <Modal visible={showTimePicker} transparent animationType="slide" onRequestClose={() => setShowTimePicker(false)}>
        <Pressable style={s.sheetOverlay} onPress={() => setShowTimePicker(false)} />
        <View style={[s.filterSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.sheetHandle} />
          <View style={s.sheetHeaderRow}>
            <Text style={s.sheetTitle}>{t('mobile.filterByDate', { defaultValue: 'Filter by Date' })}</Text>
            <TouchableOpacity onPress={() => setShowTimePicker(false)} hitSlop={8}>
              <MaterialIcons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
            <View style={s.quickGrid}>
              {QUICK_PERIODS.map((opt) => {
                const active = timePeriod === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[s.quickChip, active && s.quickChipActive]}
                    onPress={() => applyQuickPeriod(opt.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.quickChipText, active && s.quickChipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.sheetSectionLabel}>{t('mobile.customDateRange', { defaultValue: 'CUSTOM DATE RANGE' })}</Text>

            <View style={s.rangeSummary}>
              <View style={[s.rangeBox, timePeriod === 'custom' && customStart && s.rangeBoxActive]}>
                <Text style={s.rangeBoxLabel}>{t('mobile.repFrom', { defaultValue: 'From' })}</Text>
                <Text style={s.rangeBoxValue}>{customStart ? customStart.toLocaleDateString(i18n.language || 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</Text>
              </View>
              <MaterialIcons name="arrow-forward" size={18} color={colors.textMuted} />
              <View style={[s.rangeBox, timePeriod === 'custom' && customEnd && s.rangeBoxActive]}>
                <Text style={s.rangeBoxLabel}>{t('mobile.repTo', { defaultValue: 'To' })}</Text>
                <Text style={s.rangeBoxValue}>{customEnd ? customEnd.toLocaleDateString(i18n.language || 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</Text>
              </View>
            </View>

            <View style={s.calCard}>
              <View style={s.calHeader}>
                <TouchableOpacity onPress={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))} style={s.calNavBtn} hitSlop={8}>
                  <MaterialIcons name="chevron-left" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={s.calTitle}>{monthTitle}</Text>
                <TouchableOpacity onPress={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))} style={s.calNavBtn} hitSlop={8}>
                  <MaterialIcons name="chevron-right" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>
              <View style={s.calWeekRow}>
                {WEEKDAYS.map((w, i) => (
                  <Text key={i} style={s.calWeekday}>{w}</Text>
                ))}
              </View>
              <View style={s.calGrid}>
                {calendarCells.map((d, i) => {
                  if (!d) return <View key={`e-${i}`} style={s.calCell} />;
                  const isStart = sameDay(d, customStart);
                  const isEnd = sameDay(d, customEnd);
                  const isMid = !!inRange(d) && !isStart && !isEnd;
                  const isFuture = d > new Date();
                  return (
                    <TouchableOpacity
                      key={d.toISOString()}
                      style={[s.calCell, isMid && s.calCellMid]}
                      disabled={isFuture}
                      onPress={() => handleDayPress(d)}
                      activeOpacity={0.7}
                    >
                      <View style={[s.calDay, (isStart || isEnd) && s.calDaySelected]}>
                        <Text style={[s.calDayText, (isStart || isEnd) && s.calDayTextSelected, isFuture && s.calDayTextDisabled]}>
                          {d.getDate()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={s.sheetActions}>
              <TouchableOpacity style={s.clearBtn} onPress={() => { setCustomStart(null); setCustomEnd(null); applyQuickPeriod('month'); }} activeOpacity={0.8}>
                <Text style={s.clearBtnText}>{t('common.clear', { defaultValue: 'Clear' })}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.applyBtn, !customStart && { opacity: 0.5 }]}
                disabled={!customStart}
                onPress={() => { if (customStart && !customEnd) setCustomEnd(customStart); setTimePeriod('custom'); setShowTimePicker(false); }}
                activeOpacity={0.85}
              >
                <Text style={s.applyBtnText}>{t('common.apply', { defaultValue: 'Apply Range' })}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    paddingHorizontal: 12, paddingTop: 0, paddingBottom: 6,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },

  scrollContent: { padding: 16, gap: 12 },

  dateChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
    backgroundColor: colors.primaryTint,
  },
  dateChipText: { fontSize: 13, fontFamily: fonts.bold, color: colors.primary, flexShrink: 1 },

  // KPI grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: {
    width: '48%', flexGrow: 1,
    backgroundColor: colors.surface, borderRadius: radii.card,
    ...shadows.card, ...shadows.cardBorder,
    paddingVertical: 14, paddingHorizontal: 14, gap: 4,
  },
  kpiLabel: { fontSize: 10, fontFamily: fonts.bold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  kpiValue: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },

  // Sections
  sectionTitle: {
    fontSize: 11, fontFamily: fonts.bold, color: colors.textMuted,
    letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 8,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radii.card,
    ...shadows.card, ...shadows.cardBorder,
    padding: 14,
  },
  cardSubTitle: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary, marginBottom: 8 },
  cardDivider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },

  // Breakdown bars
  breakRow: { marginBottom: 10 },
  breakLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  breakLabel: { fontSize: 13, fontFamily: fonts.semibold, color: colors.text, flexShrink: 1 },
  breakCount: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary },
  breakBarTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  breakBarFill: { height: 6, borderRadius: 3 },

  // List rows
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  listRowLast: { borderBottomWidth: 0 },
  listRowTitle: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text },
  listRowSub: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary },
  listRowValue: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  rankBadge: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center',
  },
  rankBadgeText: { fontSize: 12, fontFamily: fonts.bold, color: colors.primary },

  // Attendance / customers stat columns
  attRow: { flexDirection: 'row' },
  attCol: { flex: 1, alignItems: 'center', gap: 2 },
  attValue: { fontSize: 20, fontFamily: fonts.bold, color: colors.text },
  attLabel: { fontSize: 10, fontFamily: fonts.bold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },

  // Empty
  emptyBox: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyText: { fontSize: 13, fontFamily: fonts.medium, color: colors.textMuted, textAlign: 'center' },

  // Export
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 50, borderRadius: radii.button, backgroundColor: colors.primary, marginTop: 4,
  },
  exportBtnText: { fontSize: 15, fontFamily: fonts.bold, color: colors.surface },

  // Bottom sheet (copied from OrdersScreen)
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(26,29,46,0.45)' },
  filterSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 16, paddingTop: 10,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 12 },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sheetTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted,
  },
  quickChipActive: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  quickChipText: { fontSize: 14, fontFamily: fonts.bold, color: colors.textSecondary },
  quickChipTextActive: { color: colors.primary },
  sheetSectionLabel: {
    fontSize: 11, fontFamily: fonts.bold, color: colors.textMuted, letterSpacing: 0.8,
    textTransform: 'uppercase', marginTop: 20, marginBottom: 10,
  },
  rangeSummary: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  rangeBox: {
    flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  rangeBoxActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  rangeBoxLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.textMuted, textTransform: 'uppercase' },
  rangeBoxValue: { fontSize: 14, fontFamily: fonts.bold, color: colors.text, marginTop: 2 },

  calCard: { backgroundColor: colors.surfaceMuted, borderRadius: 16, padding: 10, borderWidth: 1, borderColor: colors.border },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  calNavBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  calTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  calWeekRow: { flexDirection: 'row' },
  calWeekday: { flex: 1, textAlign: 'center', fontSize: 11, fontFamily: fonts.bold, color: colors.textMuted, paddingVertical: 4 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 1 },
  calCellMid: { backgroundColor: colors.primaryTint },
  calDay: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  calDaySelected: { backgroundColor: colors.primary },
  calDayText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text },
  calDayTextSelected: { color: colors.surface, fontFamily: fonts.bold },
  calDayTextDisabled: { color: colors.border },

  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  clearBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  clearBtnText: { fontSize: 15, fontFamily: fonts.bold, color: colors.textSecondary },
  applyBtn: { flex: 2, height: 48, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  applyBtnText: { fontSize: 15, fontFamily: fonts.bold, color: colors.surface },
});
