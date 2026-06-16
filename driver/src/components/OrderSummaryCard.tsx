import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radii } from '../theme';
import { StatusPill } from './ui/StatusPill';
import { useCurrency } from '../lib/currency';
import type { DriverTask } from '../hooks/use-driver-tasks';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(d?: Date): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const PAY: Record<string, { label: string; color: string; bg: string }> = {
  paid: { label: 'Paid', color: colors.success, bg: colors.successBg },
  partial: { label: 'Partial', color: colors.warning, bg: colors.warningBg },
  unpaid: { label: 'Unpaid', color: colors.error, bg: colors.errorBg },
};

function Row({
  label,
  value,
  bold,
  color,
}: {
  label: string;
  value: string;
  bold?: boolean;
  color?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.rowLabelBold]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.rowValueBold, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

/** Expected delivery date + tax/financial breakdown + payment status for the agent. */
export function OrderSummaryCard({ task }: { task: DriverTask }) {
  const { format: money } = useCurrency();
  const f = task.financials;
  const pay = PAY[task.paymentStatus || 'unpaid'] || PAY.unpaid;
  const expected = fmtDate(task.expectedDelivery);
  const balance = f.balance ?? Math.max(0, (f.total || 0) - (f.amountPaid || 0));

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Order summary</Text>

      {expected ? <Row label="Expected delivery" value={expected} /> : null}

      <Row label="Subtotal" value={money(f.subtotal)} />
      {(f.discountAmount || 0) > 0 ? <Row label="Discount" value={`- ${money(f.discountAmount)}`} /> : null}
      {(f.deliveryCharge || 0) > 0 ? <Row label="Delivery" value={money(f.deliveryCharge)} /> : null}
      {(f.taxAmount || 0) > 0 ? (
        <Row label={`${f.taxName || 'Tax'}${f.taxRate ? ` (${f.taxRate}%)` : ''}`} value={money(f.taxAmount)} />
      ) : null}

      <View style={styles.divider} />

      <Row label="Total" value={money(f.total)} bold />
      <Row label="Paid" value={money(f.amountPaid)} color={colors.success} />
      <Row label="Balance" value={money(balance)} color={balance > 0 ? colors.error : colors.textSecondary} />

      <View style={styles.payRow}>
        <StatusPill label={pay.label} color={pay.color} bgColor={pay.bg} size="md" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 11,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  rowLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  rowLabelBold: { fontFamily: fonts.bold, color: colors.text, fontSize: 14 },
  rowValue: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  rowValueBold: { fontFamily: fonts.bold, fontSize: 16 },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: 8 },
  payRow: { alignSelf: 'flex-start', marginTop: 10 },
});
