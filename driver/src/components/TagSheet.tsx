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

// The "service" is the category (Wash & Fold / Iron / Dry Clean), not the garment name.
function svcOf(it: { categoryName?: string }): string {
  return (it.categoryName || '').trim() || 'Other';
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
  const [sharing, setSharing] = useState(false);
  const width = Dimensions.get('window').width;

  // The "service" is the category (Wash & Fold / Iron / Dry Clean); serviceName is the garment.
  const serviceGroups = useMemo(() => {
    if (!order) return [] as { name: string; qty: number }[];
    const m = new Map<string, number>();
    (order.items || []).forEach((it) => m.set(svcOf(it), (m.get(svcOf(it)) || 0) + Math.max(1, Math.floor(it.quantity || 1))));
    return Array.from(m).map(([name, qty]) => ({ name, qty }));
  }, [order]);

  // Flatten items × quantity into garments, numbered WITHIN each service (Wash & Fold 1/3, Iron 1/2 …).
  const garments = useMemo(() => {
    if (!order) return [] as { index: number; service: string; idxInService: number; serviceTotal: number }[];
    const totals = new Map<string, number>();
    (order.items || []).forEach((it) => totals.set(svcOf(it), (totals.get(svcOf(it)) || 0) + Math.max(1, Math.floor(it.quantity || 1))));
    const out: { index: number; service: string; idxInService: number; serviceTotal: number }[] = [];
    const per = new Map<string, number>();
    let idx = 1;
    (order.items || []).forEach((it) => {
      const svc = svcOf(it);
      const qty = Math.max(1, Math.floor(it.quantity || 1));
      for (let i = 0; i < qty; i++) {
        const c = (per.get(svc) || 0) + 1;
        per.set(svc, c);
        out.push({ index: idx++, service: svc, idxInService: c, serviceTotal: totals.get(svc) || qty });
      }
    });
    return out;
  }, [order]);

  const serviceSummary = serviceGroups.map((g) => `${g.name} ×${g.qty}`).join('  ·  ');

  // One tag per page, page = exactly 50mm × 60mm (matches the web TagGeneratorModal).
  const buildHtml = async (): Promise<string> => {
    if (!order) return '';
    const orderNo = order.orderNumber || order.publicId;
    const customer = order.customerName || '';
    const meta = `#${orderNo}${customer ? ` · ${customer}` : ''}`;
    // basket = one tag per service (service name + qty); items = one tag per garment (per-service #).
    const tags =
      mode === 'basket'
        ? serviceGroups.map((g) => ({ value: order.id, service: g.name, line2: `${g.qty} ${g.qty === 1 ? 'item' : 'items'}` }))
        : garments.map((g) => ({ value: `${order.id}:${g.index}`, service: g.service, line2: `${g.idxInService}/${g.serviceTotal}` }));
    const blocks = await Promise.all(
      tags.map(async (t) => {
        const svg = await QRCodeGen.toString(t.value, { type: 'svg', margin: 1, width: 300 });
        return `<div class="tag">${shopName ? `<div class="shop">${esc(shopName)}</div>` : ''}<div class="qr">${svg}</div><div class="title">${esc(t.service)}</div><div class="sub">${esc(t.line2)}</div><div class="meta">${esc(meta)}</div></div>`;
      }),
    );
    return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"/><style>
      @page { size: 50mm 60mm; margin: 0; }
      *{box-sizing:border-box;font-family:-apple-system,Helvetica,Arial,sans-serif;}
      html,body{margin:0;padding:0;}
      .tag{width:50mm;height:60mm;padding:3mm;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;text-align:center;overflow:hidden;page-break-after:always;}
      .tag:last-child{page-break-after:auto;}
      .shop{font-size:7.5pt;color:#000;font-weight:700;line-height:1.1;}
      .qr{margin-top:1.5mm;line-height:0;}
      .qr svg{width:32mm;height:32mm;}
      .title{font-size:11pt;font-weight:700;margin-top:1.5mm;line-height:1.1;}
      .sub{font-size:10pt;font-weight:700;color:#000;margin-top:0.5mm;line-height:1.1;}
      .meta{font-size:7.5pt;color:#555;margin-top:1mm;line-height:1.2;}
    </style></head><body>${blocks.join('')}</body></html>`;
  };

  // Build a PDF whose pages are exactly 50mm × 60mm (in PDF points) — 1:1, never A4.
  // Lazy-load the native print module so the bundle still runs in a dev client that
  // wasn't built with expo-print yet (printing needs a rebuild).
  const generatePdf = async (): Promise<{ Print: typeof import('expo-print'); uri: string }> => {
    const html = await buildHtml();
    const Print = await import('expo-print');
    const MM_TO_PT = 72 / 25.4;
    const { uri } = await Print.printToFileAsync({
      html,
      width: Math.round(50 * MM_TO_PT),
      height: Math.round(60 * MM_TO_PT),
    });
    return { Print, uri };
  };

  // Print → native print dialog (send to a connected printer).
  const handlePrint = async () => {
    setPrinting(true);
    try {
      const { Print, uri } = await generatePdf();
      await Print.printAsync({ uri });
    } catch (e) {
      Alert.alert('Printing unavailable', 'Tag printing needs the latest app build. The on-screen QR still works for scanning.');
    } finally {
      setPrinting(false);
    }
  };

  // Share → hand the PDF to another app (e.g. your label-printer app, Files, WhatsApp).
  const handleSharePdf = async () => {
    setSharing(true);
    try {
      const { Print, uri } = await generatePdf();
      const Sharing = await import('expo-sharing');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Order tags' });
      } else {
        await Print.printAsync({ uri });
      }
    } catch (e) {
      Alert.alert('Sharing unavailable', 'Sharing needs the latest app build. The on-screen QR still works for scanning.');
    } finally {
      setSharing(false);
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
              <Text style={[styles.segText, mode === 'basket' && styles.segTextActive]}>Service tags ({serviceGroups.length})</Text>
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
              {!!serviceSummary && (
                <Text style={styles.tagSvc} numberOfLines={3}>{serviceSummary}</Text>
              )}
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
                  <Text style={styles.tagLabel}>{g.service}</Text>
                  <Text style={styles.tagSub}>
                    {g.idxInService} of {g.serviceTotal}
                  </Text>
                  <Text style={styles.tagOrder}>{order.orderNumber || order.publicId} · {order.customerName || 'Customer'}</Text>
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

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Button label="Print" icon="print" loading={printing} onPress={handlePrint} style={{ flex: 1 }} />
            <Button label="Share PDF" icon="ios-share" loading={sharing} onPress={handleSharePdf} style={{ flex: 1 }} />
          </View>
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
  tagSvc: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 6, textAlign: 'center', paddingHorizontal: 8, lineHeight: 17 },
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
