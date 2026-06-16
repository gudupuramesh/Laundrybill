import React, { useState, useMemo } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import QRCodeGen from 'qrcode';
import { colors, fonts, radii } from '../theme';
import { Button } from './ui/Button';
import { useDriverAuth } from '../lib/DriverAuthContext';
import type { Order } from '../types/order';

function esc(s: string): string {
  return (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));
}

type Mode = 'basket' | 'items';

/**
 * Generates scannable tags for an order — a single Basket tag (QR = order id)
 * or one tag per garment (QR = `orderId:index`). Mirrors the web
 * TagGeneratorModal's QR payloads so the same Scan screen resolves them.
 * On-screen for now; print/PDF is a follow-up (needs expo-print + a rebuild).
 */
export function TagSheet({ order, open, onClose }: { order: Order | null; open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { shopName } = useDriverAuth();
  const [mode, setMode] = useState<Mode>('basket');
  const [printing, setPrinting] = useState(false);
  const width = Dimensions.get('window').width;

  // Flatten items × quantity into individual garments for per-item tags.
  const garments = useMemo(() => {
    if (!order) return [] as { index: number; serviceName: string; categoryName?: string }[];
    const out: { index: number; serviceName: string; categoryName?: string }[] = [];
    let idx = 1;
    (order.items || []).forEach((it) => {
      const qty = Math.max(1, Math.floor(it.quantity || 1));
      for (let i = 0; i < qty; i++) {
        out.push({ index: idx++, serviceName: it.serviceName, categoryName: it.categoryName });
      }
    });
    return out;
  }, [order]);

  const buildHtml = async (): Promise<string> => {
    if (!order) return '';
    const tags =
      mode === 'basket'
        ? [{ value: order.id, title: order.orderNumber || order.publicId, sub: `${order.customerName || 'Customer'} · ${garments.length} item(s)` }]
        : garments.map((g) => ({
            value: `${order.id}:${g.index}`,
            title: g.serviceName,
            sub: `${order.orderNumber || order.publicId} · Item ${g.index}/${garments.length}`,
          }));
    const blocks = await Promise.all(
      tags.map(async (t) => {
        const svg = await QRCodeGen.toString(t.value, { type: 'svg', margin: 1, width: 200 });
        return `<div class="tag">${shopName ? `<div class="shop">${esc(shopName)}</div>` : ''}<div class="qr">${svg}</div><div class="title">${esc(t.title)}</div><div class="sub">${esc(t.sub)}</div></div>`;
      }),
    );
    return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"/><style>
      *{box-sizing:border-box;font-family:-apple-system,Helvetica,Arial,sans-serif;}
      body{margin:0;padding:12px;}
      .tag{page-break-inside:avoid;border:1px solid #ddd;border-radius:10px;padding:16px;margin:0 0 12px;text-align:center;}
      .shop{font-size:12px;color:#666;margin-bottom:8px;font-weight:600;}
      .qr{display:flex;justify-content:center;}
      .qr svg{width:200px;height:200px;}
      .title{font-size:18px;font-weight:700;margin-top:10px;}
      .sub{font-size:12px;color:#666;margin-top:4px;}
    </style></head><body>${blocks.join('')}</body></html>`;
  };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const html = await buildHtml();
      // Lazy-load the native print module so the bundle still runs in a dev
      // client that wasn't built with expo-print yet (printing needs a rebuild).
      const Print = await import('expo-print');
      await Print.printAsync({ html });
    } catch (e) {
      Alert.alert('Printing unavailable', 'Tag printing needs the latest app build. The on-screen QR still works for scanning.');
    } finally {
      setPrinting(false);
    }
  };

  if (!order) return null;
  const totalItems = garments.length;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Order Tag</Text>
              <Text style={styles.subtitle}>
                {order.orderNumber || order.publicId} · {order.customerName || 'Customer'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <MaterialIcons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Mode toggle */}
          <View style={styles.segment}>
            <TouchableOpacity
              style={[styles.segBtn, mode === 'basket' && styles.segBtnActive]}
              onPress={() => setMode('basket')}
            >
              <Text style={[styles.segText, mode === 'basket' && styles.segTextActive]}>Basket tag</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segBtn, mode === 'items' && styles.segBtnActive]}
              onPress={() => setMode('items')}
              disabled={totalItems === 0}
            >
              <Text style={[styles.segText, mode === 'items' && styles.segTextActive, totalItems === 0 && styles.segDisabled]}>
                Item tags ({totalItems})
              </Text>
            </TouchableOpacity>
          </View>

          {mode === 'basket' ? (
            <View style={styles.basketWrap}>
              <View style={styles.qrCard}>
                <QRCode value={order.id} size={196} backgroundColor="#fff" color={colors.text} />
              </View>
              <Text style={styles.tagLabel}>{order.orderNumber || order.publicId}</Text>
              <Text style={styles.tagSub}>
                {order.customerName || 'Customer'} · {totalItems} {totalItems === 1 ? 'item' : 'items'}
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 8 }}
            >
              {garments.map((g) => (
                <View key={g.index} style={[styles.itemPage, { width: width - 32 }]}>
                  <View style={styles.qrCard}>
                    <QRCode value={`${order.id}:${g.index}`} size={170} backgroundColor="#fff" color={colors.text} />
                  </View>
                  <Text style={styles.tagLabel}>{g.serviceName}</Text>
                  <Text style={styles.tagSub}>
                    {g.categoryName ? `${g.categoryName} · ` : ''}Item {g.index} of {totalItems}
                  </Text>
                  <Text style={styles.tagOrder}>{order.orderNumber || order.publicId}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.note}>
            <MaterialIcons name="qr-code-scanner" size={15} color={colors.textMuted} />
            <Text style={styles.noteText}>
              {mode === 'items' ? 'Swipe to see each garment tag. ' : ''}Scan a tag from the Scan tab to open this order.
            </Text>
          </View>

          <Button
            label={mode === 'items' ? `Print ${totalItems} tags` : 'Print / Save PDF'}
            icon="print"
            loading={printing}
            onPress={handlePrint}
            style={{ marginTop: 12 }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,30,54,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  handle: { width: 40, height: 4, borderRadius: 99, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  subtitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  closeBtn: { padding: 4 },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.button,
    padding: 3,
    marginTop: 16,
    marginBottom: 8,
  },
  segBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: radii.button - 2 },
  segBtnActive: { backgroundColor: colors.surface, ...({ elevation: 1 } as object) },
  segText: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary },
  segTextActive: { color: colors.primary },
  segDisabled: { color: colors.textMuted, opacity: 0.5 },
  basketWrap: { alignItems: 'center', paddingVertical: 18 },
  qrCard: {
    backgroundColor: '#fff',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  itemPage: { alignItems: 'center', paddingVertical: 10 },
  tagLabel: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, marginTop: 14 },
  tagSub: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary, marginTop: 3 },
  tagOrder: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.input,
    padding: 10,
    marginTop: 12,
  },
  noteText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
});
