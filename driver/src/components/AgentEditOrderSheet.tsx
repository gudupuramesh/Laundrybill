import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fonts, radii } from '../theme';
import { BottomSheet } from './BottomSheet';
import { Button } from './ui/Button';
import { firestore } from '../lib/firebase';
import { useDriverAuth } from '../lib/DriverAuthContext';
import { useCurrency } from '../lib/currency';
import { getUnitLabel, isWeightUnit } from '../lib/country-config';
import type { DriverTask } from '../hooks/use-driver-tasks';
import type { OrderItem, OrderFinancials } from '../types/order';

interface Line {
  id: string;
  serviceId: string;
  serviceName: string;
  categoryId?: string;
  categoryName?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  basePrice: number;
  expressMultiplier: number;
  express: boolean;
}

interface InvItem {
  id: string;
  name: string;
  basePrice: number;
  pricingType?: string;
  categoryId?: string;
  categoryName?: string;
  expressMultiplier?: number;
}

interface Category {
  id: string;
  name: string;
  order?: number;
}

function seedLines(task: DriverTask): Line[] {
  return (task.items || []).map((it, i) => {
    const mult = it.expressMultiplier || 1.5;
    // unitPrice already reflects express; recover basePrice so the toggle is reversible.
    const basePrice = it.express ? Math.round((it.unitPrice || 0) / mult) : it.unitPrice;
    return {
      id: it.id || `item-${it.serviceId}-${i}`,
      serviceId: it.serviceId,
      serviceName: it.serviceName,
      categoryId: it.categoryId,
      categoryName: it.categoryName,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: it.unitPrice,
      basePrice,
      expressMultiplier: mult,
      express: !!it.express,
    };
  });
}

export function AgentEditOrderSheet({
  open,
  onClose,
  task,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  task: DriverTask;
  onSaved: () => void;
}) {
  const { shopId } = useDriverAuth();
  const { format: money } = useCurrency();
  const [lines, setLines] = useState<Line[]>(() => seedLines(task));
  const [adding, setAdding] = useState(false);
  const [inventory, setInventory] = useState<InvItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [invLoading, setInvLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [weightText, setWeightText] = useState<Record<string, string>>({});

  // Re-seed whenever the sheet (re)opens for a task.
  React.useEffect(() => {
    if (open) setLines(seedLines(task));
  }, [open, task.orderId]);

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  const loadInventory = async () => {
    if (!shopId || inventory.length > 0) {
      setAdding(true);
      return;
    }
    setInvLoading(true);
    setAdding(true);
    try {
      const [invSnap, catSnap] = await Promise.all([
        firestore().collection(`shops/${shopId}/inventory`).get(),
        firestore().collection(`shops/${shopId}/categories`).get(),
      ]);
      const cats = catSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Category[];
      cats.sort((a, b) => (a.order || 0) - (b.order || 0));
      const catName = (id?: string) => cats.find((c) => c.id === id)?.name;

      const list = invSnap.docs.map((d) => {
        const data = d.data() as InvItem;
        return { ...data, id: d.id, categoryName: data.categoryName || catName(data.categoryId) };
      }) as InvItem[];
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      setCategories(cats);
      setInventory(list);
    } catch (e) {
      console.error('Inventory load failed:', e);
    } finally {
      setInvLoading(false);
    }
  };

  const setQty = (id: string, delta: number) =>
    setLines((ls) =>
      ls
        .map((l) => (l.id === id ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l))
        .filter((l) => l.quantity > 0),
    );

  // Decimal weight entry for kg/lb/sqft/… lines (mirrors the shop app's setQtyFromText).
  const setWeight = (id: string, value: string) => {
    const normalized = value.replace(',', '.').trim();
    if (normalized !== '' && !/^\d*\.?\d*$/.test(normalized)) return;
    setWeightText((prev) => ({ ...prev, [id]: normalized }));
    const parsed = parseFloat(normalized);
    if (Number.isNaN(parsed) || parsed < 0) return; // keep the line while mid-typing ("2.")
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, quantity: parsed } : l)));
  };

  const addInv = (it: InvItem) => {
    setLines((ls) => {
      const existing = ls.find((l) => l.serviceId === it.id);
      if (existing) return ls.map((l) => (l.serviceId === it.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [
        ...ls,
        {
          id: `item-${it.id}-${ls.length}`,
          serviceId: it.id,
          serviceName: it.name,
          categoryId: it.categoryId,
          categoryName: it.categoryName,
          quantity: 1,
          unit: it.pricingType || 'piece',
          unitPrice: it.basePrice || 0,
          basePrice: it.basePrice || 0,
          expressMultiplier: it.expressMultiplier || 1.5,
          express: false,
        },
      ];
    });
    setAdding(false);
  };

  // Toggle express on a line → unitPrice = basePrice × expressMultiplier (shop-app rule).
  const toggleExpress = (id: string) =>
    setLines((ls) =>
      ls.map((l) =>
        l.id === id
          ? {
              ...l,
              express: !l.express,
              unitPrice: !l.express ? Math.round(l.basePrice * l.expressMultiplier) : l.basePrice,
            }
          : l,
      ),
    );

  const save = async () => {
    if (!shopId) return;
    setSaving(true);
    try {
      const f = task.financials;
      const discountAmount = f.discountAmount || 0;
      const deliveryCharge = f.deliveryCharge || 0;
      // Express uplift is already baked into each line's unitPrice (and thus subtotal);
      // expressCharge is the reporting figure, NOT added to total again (shop-app rule).
      const expressCharge = lines.reduce(
        (s, l) => s + (l.express ? Math.max(0, (l.unitPrice - l.basePrice) * l.quantity) : 0),
        0,
      );
      const taxBase = Math.max(0, subtotal - discountAmount);
      const taxAmount = f.taxRate ? Math.round(taxBase * (f.taxRate / 100)) : f.taxAmount || 0;
      const total = Math.max(0, subtotal - discountAmount + deliveryCharge + taxAmount);
      const amountPaid = f.amountPaid || 0;

      const items: OrderItem[] = lines.map((l) => ({
        id: l.id,
        serviceId: l.serviceId,
        serviceName: l.serviceName,
        categoryId: l.categoryId,
        categoryName: l.categoryName,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unitPrice,
        total: l.unitPrice * l.quantity,
        express: l.express,
        expressMultiplier: l.expressMultiplier,
        expressCharge: l.express ? Math.round((l.unitPrice - l.basePrice) * l.quantity) : 0,
      }));

      const financials: OrderFinancials = {
        ...f,
        subtotal,
        discountAmount,
        deliveryCharge,
        expressCharge,
        taxAmount,
        total,
        amountPaid,
        balance: Math.max(0, total - amountPaid),
      };

      await firestore().doc(`shops/${shopId}/orders/${task.orderId}`).update({
        items,
        financials,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      onSaved();
      onClose();
    } catch (e) {
      console.error('Save order edit failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const filteredInv = inventory.filter(
    (i) =>
      (selectedCat === 'all' || i.categoryId === selectedCat) &&
      i.name?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={adding ? 'Add item' : 'Edit order'}
      footer={
        adding ? (
          <Button label="Done" variant="tint" onPress={() => setAdding(false)} />
        ) : (
          <Button label="Save changes" icon="check" onPress={save} loading={saving} />
        )
      }
    >
      {adding ? (
        <View style={{ minHeight: 320 }}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search services…"
            placeholderTextColor={colors.textMuted}
            style={styles.search}
          />

          {categories.length > 0 && (
            <View style={styles.catWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.catRow}
                keyboardShouldPersistTaps="handled"
              >
                <CatChip label="All" active={selectedCat === 'all'} onPress={() => setSelectedCat('all')} />
                {categories.map((c) => (
                  <CatChip
                    key={c.id}
                    label={c.name}
                    active={selectedCat === c.id}
                    onPress={() => setSelectedCat(c.id)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {invLoading ? (
            <Text style={styles.muted}>Loading services…</Text>
          ) : filteredInv.length === 0 ? (
            <Text style={styles.muted}>No services found.</Text>
          ) : (
            filteredInv.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.invRow}
                onPress={() => addInv(item)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.invName}>{item.name}</Text>
                  {item.categoryName ? <Text style={styles.invCat}>{item.categoryName}</Text> : null}
                </View>
                <View style={styles.invRight}>
                  <Text style={styles.invPrice}>
                    {money(item.basePrice)}/{getUnitLabel(item.pricingType || 'piece')}
                  </Text>
                  <MaterialIcons name="add-circle" size={22} color={colors.primary} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : (
        <View>
          {lines.map((l) => (
            <View key={l.id} style={styles.line}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineName}>{l.serviceName}</Text>
                <Text style={styles.lineSub}>
                  {l.categoryName ? `${l.categoryName} · ` : ''}
                  {money(l.unitPrice)}/{getUnitLabel(l.unit)} · {money(l.unitPrice * l.quantity)}
                </Text>
                <TouchableOpacity
                  style={[styles.expressChip, l.express && styles.expressChipOn]}
                  onPress={() => toggleExpress(l.id)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="bolt"
                    size={13}
                    color={l.express ? colors.warning : colors.textMuted}
                  />
                  <Text style={[styles.expressText, l.express && { color: colors.warning }]}>Express</Text>
                </TouchableOpacity>
              </View>
              {isWeightUnit(l.unit) ? (
                <View style={styles.weightWrap}>
                  <TextInput
                    style={styles.weightInput}
                    keyboardType="decimal-pad"
                    value={weightText[l.id] !== undefined ? weightText[l.id] : String(l.quantity)}
                    onChangeText={(v) => setWeight(l.id, v)}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                  />
                  <Text style={styles.weightUnit}>{getUnitLabel(l.unit)}</Text>
                </View>
              ) : (
                <View style={styles.stepper}>
                  <TouchableOpacity onPress={() => setQty(l.id, -1)} style={styles.stepBtn}>
                    <MaterialIcons name="remove" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.qty}>{l.quantity}</Text>
                  <TouchableOpacity onPress={() => setQty(l.id, 1)} style={styles.stepBtn}>
                    <MaterialIcons name="add" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
          {lines.length === 0 && <Text style={styles.muted}>No items. Add some below.</Text>}

          <Button
            label="Add item"
            icon="add"
            variant="tint"
            onPress={loadInventory}
            style={{ marginTop: 10 }}
          />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{money(subtotal)}</Text>
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

function CatChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.catChip, active && styles.catChipActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.catChipText, active && styles.catChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  catWrap: { height: 40, marginBottom: 12 },
  catRow: { gap: 8, alignItems: 'center' },
  catChip: {
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radii.chip,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipActive: { backgroundColor: colors.primaryTint, borderColor: 'transparent' },
  catChipText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  catChipTextActive: { color: colors.primary },
  invCat: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  lineName: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  lineSub: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, minWidth: 26, textAlign: 'center' },
  weightWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weightInput: {
    minWidth: 64,
    backgroundColor: colors.primaryTint,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
    textAlign: 'center',
  },
  weightUnit: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary },
  expressChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  expressChipOn: { backgroundColor: colors.warningBg, borderColor: 'transparent' },
  expressText: { fontFamily: fonts.bold, fontSize: 11, color: colors.textMuted },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  totalLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary },
  totalValue: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  muted: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted, paddingVertical: 14, textAlign: 'center' },
  search: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
    marginBottom: 12,
  },
  invRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  invName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text, flex: 1 },
  invRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  invPrice: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary },
});
