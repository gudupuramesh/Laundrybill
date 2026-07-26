import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DraftOrderPayload } from '../types/orderDraft';
import { firestore } from '../lib/db';
import { getShopId, getAgentId, getAgentName } from '../lib/auth';
import { useShopCountrySettings } from '../lib/use-shop-country-settings';
import { useAgents } from '../lib/useAgents';
import { getDeliveryCharge, getDistanceBands, type DeliveryChargeSettings } from '../lib/delivery-charge';
import { uploadImageToR2 } from '../lib/uploadR2';
import { DamagePhotos } from '../components/DamagePhotos';
import { Dropdown } from '../components/Dropdown';
import { formatCurrency } from '../lib/currency-format';
import { usePlanLimits, usePlanFeatures } from '../lib/usePlanLimits';
import { useMergedOrdersUsed } from '../lib/useBillingPeriodOrderCount';
import { colors, fonts, radii, shadows, spacing } from '../theme';

// Same logic as web: first 2 letters of shop name + 2 random chars
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateShopCode(shopName: string): string {
  const clean = (shopName || 'SH').toUpperCase().replace(/[^A-Z]/g, '');
  const prefix = clean.length >= 2 ? clean.slice(0, 2) : clean.padEnd(2, 'X');
  const s1 = CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  const s2 = CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  return prefix + s1 + s2;
}

function formatOrderId(shopCode: string, orderNumber: number): string {
  return `${shopCode}-${orderNumber.toString().padStart(5, '0')}`;
}

interface PlacedOrder {
  id: string;
  publicId: string;
  orderNumber: string;
  customer: DraftOrderPayload['customer'];
  items: DraftOrderPayload['items'];
  financials: DraftOrderPayload['financials'];
  deliveryType: string;
  paymentStatus: string;
  expectedDelivery: Date;
  createdAt: Date;
  notes: string;
}

export default function OrderReviewScreen({
  onBack,
  onPlaceOrder,
  onEditCustomer,
  draftOrder,
  editOrderId,
  editOrder,
  selfAssignAsAgent = false,
}: {
  onBack: () => void,
  onPlaceOrder: (order: PlacedOrder) => void,
  onEditCustomer?: () => void,
  draftOrder: DraftOrderPayload | null,
  editOrderId?: string | null,
  editOrder?: any,
  selfAssignAsAgent?: boolean, // agent portal: a new order is auto-assigned to the creating agent
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const shopId = getShopId();
  const countrySettings = useShopCountrySettings(shopId);

  // Shop tax settings
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(0);
  const [taxName, setTaxName] = useState('GST');
  const [shopName, setShopName] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [deliverySettings, setDeliverySettings] = useState<DeliveryChargeSettings | undefined>(undefined);

  // Offers & loyalty (Pro+/Business): coupons + points config come from the shop doc.
  const [publicCoupons, setPublicCoupons] = useState<any[]>([]);
  const [loyaltyCfg, setLoyaltyCfg] = useState<any>(null);
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; type: 'percent' | 'flat'; value: number } | null>(null);
  const [pointsText, setPointsText] = useState('');
  const [pointsBalance, setPointsBalance] = useState(0);

  // Pickup/delivery scheduling — date + time slots for home orders (required).
  const [pickupDate, setPickupDate] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [pickupSlot, setPickupSlot] = useState('');
  const [deliverySlot, setDeliverySlot] = useState('');

  // User inputs
  const [discountText, setDiscountText] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryType, setDeliveryType] = useState<'pickup_store' | 'delivery_home' | 'pickup_home'>('pickup_store');
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'paid'>('unpaid');
  const [assignedAgentId, setAssignedAgentId] = useState<string | null>(null);
  const [damagePhotos, setDamagePhotos] = useState<string[]>([]);
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [deliveryBandId, setDeliveryBandId] = useState<string>('');
  const [placing, setPlacing] = useState(false);

  // Delivery agents for assignment (shown for home delivery / pickup).
  const { agents } = useAgents(shopId);
  const isHomeType = deliveryType === 'delivery_home' || deliveryType === 'pickup_home';
  // Master switch (shop owner's Service Areas toggle). When OFF, the area picker
  // and agent assignment are hidden — store orders never need them either.
  const serviceAreasEnabled = !!(deliverySettings as any)?.enableServiceAreas;

  // Active pickup/delivery time slots (shop-configured; ids match the web's).
  const pickupSlotOptions: { id: string; value: string }[] =
    ((deliverySettings as any)?.pickupTimeSlots || []).filter((sl: any) => sl?.isActive !== false && sl?.value);
  const deliverySlotOptions: { id: string; value: string }[] =
    ((deliverySettings as any)?.deliveryTimeSlots || []).filter((sl: any) => sl?.isActive !== false && sl?.value);

  // Agents serving the selected area (agents with no areas serve everywhere).
  const areaAgents = useMemo(() => {
    if (!selectedArea) return agents;
    const na = selectedArea.toLowerCase().trim();
    return agents.filter((a) => {
      if (!a.serviceAreas || a.serviceAreas.length === 0) return true;
      return a.serviceAreas.some((sa) => {
        const n = (sa || '').toLowerCase().trim();
        return n === na || (n.length > 3 && na.includes(n));
      });
    });
  }, [agents, selectedArea]);
  // If agents serve the area show those; otherwise fall back to all available agents.
  const displayAgents = areaAgents.length > 0 ? areaAgents : agents;

  // Auto-select the first configured service area (only when the feature is on).
  useEffect(() => {
    if (serviceAreasEnabled && serviceAreas.length > 0 && !selectedArea) setSelectedArea(serviceAreas[0]);
  }, [serviceAreasEnabled, serviceAreas, selectedArea]);

  // When the area changes, auto-assign an agent explicitly serving that area (if any).
  useEffect(() => {
    if (!serviceAreasEnabled || !isHomeType || !selectedArea) return;
    const na = selectedArea.toLowerCase().trim();
    const explicit = agents.filter(
      (a) =>
        a.serviceAreas &&
        a.serviceAreas.length > 0 &&
        a.serviceAreas.some((sa) => {
          const n = (sa || '').toLowerCase().trim();
          return n === na || (n.length > 3 && na.includes(n));
        }),
    );
    if (explicit.length > 0) {
      setAssignedAgentId((prev) => (prev && explicit.some((a) => a.id === prev) ? prev : explicit[0].id));
    }
  }, [serviceAreasEnabled, selectedArea, agents, isHomeType]);

  // Fetch shop settings for tax
  useEffect(() => {
    if (!shopId) return;
    const unsub = firestore()
      .collection('shops')
      .doc(shopId)
      .onSnapshot(
        (snap: any) => {
          if (!snap.exists) return;
          const data = snap.data();
          const tax = data?.settings?.tax;
          if (tax) {
            setTaxEnabled(!!tax.enabled);
            setTaxRate(tax.rate || 0);
            setTaxName(tax.name || 'GST');
          }
          setShopName(data?.name || '');
          setShopPhone(data?.phone || '');
          setDeliverySettings(data?.settings?.delivery);
          setPublicCoupons(data?.settings?.publicCoupons || []);
          setLoyaltyCfg(data?.settings?.loyalty || null);
          const areas = (data?.settings?.delivery?.serviceAreas || [])
            .filter((a: any) => a && a.isActive !== false && a.value)
            .map((a: any) => a.value as string);
          setServiceAreas(areas);
        },
        () => {}
      );
    return unsub;
  }, [shopId]);

  const categoryGroups = useMemo(() => {
    const map: Record<string, { name: string; subtotal: number; items: DraftOrderPayload['items'] }> = {};
    (draftOrder?.items || []).forEach((item) => {
      const key = item.categoryId || 'other';
      if (!map[key]) map[key] = { name: item.categoryName || t('mobile.categoryOther'), subtotal: 0, items: [] };
      map[key].items.push(item);
      map[key].subtotal += item.total;
    });
    return Object.values(map);
  }, [draftOrder, t]);

  // Customer's redeemable points balance (registered customers only).
  const draftCustomerId = draftOrder?.customer?.id || null;
  useEffect(() => {
    if (!shopId || !draftCustomerId) { setPointsBalance(0); return; }
    firestore().collection(`shops/${shopId}/customers`).doc(draftCustomerId).get()
      .then((snap: any) => setPointsBalance(Math.max(0, Math.round(snap.data()?.loyaltyPoints || 0))))
      .catch(() => {});
  }, [shopId, draftCustomerId]);

  // Calculate financials with discount and tax
  const computed = useMemo(() => {
    if (!draftOrder) return { subtotal: 0, discountAmount: 0, taxAmount: 0, deliveryCharge: 0, total: 0, expressCharge: 0, pointsRedeemed: 0, redeemCap: 0 };
    const subtotal = draftOrder.financials.subtotal;
    const expressCharge = draftOrder.financials.expressCharge;

    // Coupon overrides the manual discount; otherwise parse text ("%" suffix = percent)
    const discountVal = parseFloat(discountText) || 0;
    const isPercent = discountText.trim().endsWith('%');
    let discountAmount = appliedCoupon
      ? (appliedCoupon.type === 'percent'
          ? Math.round(subtotal * (appliedCoupon.value / 100))
          : Math.round(appliedCoupon.value))
      : (isPercent ? Math.round(subtotal * (discountVal / 100)) : Math.round(discountVal));
    discountAmount = Math.max(0, Math.min(discountAmount, subtotal));

    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const taxAmount = taxEnabled ? Math.round(afterDiscount * (taxRate / 100)) : 0;
    const deliveryCharge = getDeliveryCharge(deliverySettings, afterDiscount, deliveryType, deliveryBandId);
    const prePointsTotal = afterDiscount + taxAmount + deliveryCharge;

    // Redeem cap: customer balance, limited to maxRedeemPercent of the payable amount (1 point = 1 currency unit)
    const maxRedeemPct = Math.min(100, Math.max(1, loyaltyCfg?.maxRedeemPercent || 100));
    const redeemCap = Math.min(pointsBalance, Math.floor((prePointsTotal * maxRedeemPct) / 100));
    const pointsEntered = Math.max(0, Math.floor(parseFloat(pointsText) || 0));
    const pointsRedeemed = Math.min(redeemCap, pointsEntered);
    const total = prePointsTotal - pointsRedeemed;

    return { subtotal, discountAmount, taxAmount, deliveryCharge, total, expressCharge, pointsRedeemed, redeemCap };
  }, [draftOrder, discountText, appliedCoupon, pointsText, pointsBalance, loyaltyCfg, taxEnabled, taxRate, deliverySettings, deliveryType, deliveryBandId]);

  const distanceBands = getDistanceBands(deliverySettings);

  // Expected delivery: today + max turnaround days (editable)
  const [expectedDelivery, setExpectedDelivery] = useState<Date>(() => {
    // Prefill from existing order when editing
    if (editOrder?.expectedDelivery) {
      const ed = editOrder.expectedDelivery;
      if (ed?.toDate) return ed.toDate();
      if (ed?.seconds) return new Date(ed.seconds * 1000);
      if (ed instanceof Date) return ed;
      return new Date(ed);
    }
    if (!draftOrder) return new Date();
    let maxDays = 2;
    draftOrder.items.forEach((item: any) => {
      const days = item.turnaroundDays || 2;
      if (days > maxDays) maxDays = days;
    });
    const date = new Date();
    date.setDate(date.getDate() + maxDays);
    return date;
  });

  // Prefill discount, notes, and delivery type from existing order when editing
  useEffect(() => {
    if (!editOrder) return;
    const fin = editOrder.financials || {};
    if (fin.couponCode) {
      setAppliedCoupon({
        code: fin.couponCode,
        type: fin.discountType === 'percent' ? 'percent' : 'flat',
        value: fin.discountValue || fin.discountAmount || 0,
      });
    } else if (fin.discountAmount > 0) {
      if (fin.discountType === 'percent' && fin.discountValue) {
        setDiscountText(`${fin.discountValue}%`);
      } else {
        setDiscountText(String(fin.discountAmount));
      }
    }
    if (fin.pointsRedeemed > 0) setPointsText(String(fin.pointsRedeemed));
    if (editOrder.deliveryNotes) setNotes(editOrder.deliveryNotes);
    if (
      editOrder.deliveryType === 'delivery_home' ||
      editOrder.deliveryType === 'pickup_store' ||
      editOrder.deliveryType === 'pickup_home'
    ) {
      setDeliveryType(editOrder.deliveryType);
    }
    if (editOrder.assignedAgentId) setAssignedAgentId(editOrder.assignedAgentId);
    if (Array.isArray(editOrder.damagePhotoUrls)) setDamagePhotos(editOrder.damagePhotoUrls);
    const spd = editOrder.scheduledPickupDate;
    if (spd) {
      const d = spd?.toDate ? spd.toDate() : spd?.seconds ? new Date(spd.seconds * 1000) : new Date(spd);
      if (d && !isNaN(d.getTime())) setPickupDate(d);
    }
    if (editOrder.scheduledPickupTime) setPickupSlot(editOrder.scheduledPickupTime);
    if (editOrder.deliverySlot) setDeliverySlot(editOrder.deliverySlot);
    if (editOrder.paymentStatus === 'paid' || (fin.amountPaid > 0 && fin.balance <= 0)) {
      setPaymentStatus('paid');
    }
  }, [editOrder]);

  // ─── Plan limit enforcement ───────────────────────────────────
  const [subData, setSubData] = useState<any>(null);
  useEffect(() => {
    if (!shopId) return;
    const unsub = firestore().collection('subscriptions').doc(shopId).onSnapshot(
      (snap: any) => { if (snap.exists) setSubData(snap.data()); },
      () => {}
    );
    return unsub;
  }, [shopId]);
  const planLimits = usePlanLimits(subData);
  const ordersUsed = useMergedOrdersUsed(subData, shopId);
  const planKey = (subData?.planId || subData?.planName || 'free').toString().toLowerCase();
  const isPaidPlan = subData?.status === 'active' && !['free', 'trial'].includes(planKey);
  const orderLimitReached = !editOrderId && !isPaidPlan && planLimits.maxOrders > 0 && ordersUsed >= planLimits.maxOrders;
  // Offers & loyalty are Pro+/Business features (same normalization as item tracking).
  const planNorm = planKey.replace(/[_\s-]/g, '');
  const offersPlan = ['proplus', 'pro+', 'business', 'enterprise', 'premium', 'franchise', 'multishop'].includes(planNorm);
  // Damage/stain photos are a BUSINESS-only feature (Firestore plans doc authoritative).
  const planFeatures = usePlanFeatures(subData);
  const canDamagePhotos = !!planFeatures.damagePhotos;

  const handleApplyCoupon = () => {
    setCouponError(null);
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    const c = (publicCoupons || []).find((x: any) => (x.code || '').trim().toUpperCase() === code);
    if (!c) { setCouponError(t('mobile.couponInvalid', 'Invalid coupon code')); return; }
    if (c.active === false) { setCouponError(t('mobile.couponInactive', 'This coupon is not active')); return; }
    if (c.expiresAt && new Date(c.expiresAt + 'T23:59:59') < new Date()) {
      setCouponError(t('mobile.couponExpired', 'This coupon has expired'));
      return;
    }
    const subtotal = draftOrder?.financials.subtotal || 0;
    if (c.minOrder != null && c.minOrder > 0 && subtotal < c.minOrder) {
      setCouponError(t('mobile.couponMinOrder', 'Minimum order {{amount}} required', { amount: formatCurrency(c.minOrder, countrySettings) }));
      return;
    }
    setAppliedCoupon({ code, type: c.type === 'percent' ? 'percent' : 'flat', value: c.value || 0 });
    setDiscountText('');
    setCouponInput('');
  };

  const handlePlaceOrder = async () => {
    if (!draftOrder || !shopId) {
      Alert.alert(t('mobile.errorTitle'), t('mobile.missingOrderData'));
      return;
    }
    // Hard block: prevent placing order if limit reached (new orders only)
    if (orderLimitReached) {
      Alert.alert(t('mobile.orderLimitTitle'), t('mobile.orderLimitMessage', { limit: planLimits.maxOrders }));
      return;
    }
    // Home orders must carry their scheduling info (same rule as web POS).
    if (deliveryType === 'pickup_home' && pickupSlotOptions.length > 0 && !pickupSlot) {
      Alert.alert(t('mobile.slotRequiredTitle', 'Time slot required'), t('mobile.pickupSlotRequired', 'Please select a pickup time slot'));
      return;
    }
    if (isHomeType && deliverySlotOptions.length > 0 && !deliverySlot) {
      Alert.alert(t('mobile.slotRequiredTitle', 'Time slot required'), t('mobile.deliverySlotRequired', 'Please select a delivery time slot'));
      return;
    }
    setPlacing(true);
    try {
      // Upload any new damage photos (keep already-uploaded https URLs as-is).
      let damagePhotoUrls: string[] = [];
      if (damagePhotos.length > 0) {
        const remote = damagePhotos.filter((u) => /^https?:/.test(u));
        const local = damagePhotos.filter((u) => !/^https?:/.test(u));
        const uploaded = await Promise.all(
          local.map((uri) =>
            uploadImageToR2(shopId, uri, 'damage-photos')
              .then((r) => r.publicUrl)
              .catch(() => null),
          ),
        );
        damagePhotoUrls = [...remote, ...(uploaded.filter(Boolean) as string[])];
      }

      // Get shop doc for shopCode and nextOrderNumber (skip for edits)
      let orderNumber = '';
      const shopDoc = await firestore().collection('shops').doc(shopId).get();
      if (!shopDoc.exists) throw new Error('Shop not found');
      const shopData = shopDoc.data() || {};

      if (!editOrderId) {
        const settings = shopData.settings || {};
        let shopCode = shopData.shopCode;
        const nextOrderNumber = settings.nextOrderNumber || 1;

        if (!shopCode) {
          shopCode = generateShopCode(shopData.name || 'Shop');
          await firestore().collection('shops').doc(shopId).update({ shopCode });
        }

        orderNumber = formatOrderId(shopCode, nextOrderNumber);

        await firestore().collection('shops').doc(shopId).update({
          'settings.nextOrderNumber': nextOrderNumber + 1,
        });
      }

      // Build financials
      const discountVal = parseFloat(discountText) || 0;
      const isPercent = discountText.trim().endsWith('%');
      const financials = {
        subtotal: computed.subtotal,
        discountType: (appliedCoupon ? appliedCoupon.type : isPercent ? 'percent' : 'flat') as 'flat' | 'percent',
        discountValue: appliedCoupon ? appliedCoupon.value : discountVal,
        discountAmount: computed.discountAmount,
        couponCode: appliedCoupon?.code || null,
        pointsRedeemed: computed.pointsRedeemed || 0,
        expressCharge: computed.expressCharge,
        deliveryCharge: computed.deliveryCharge,
        taxAmount: computed.taxAmount,
        taxRate: taxEnabled ? taxRate : 0,
        taxName: taxName,
        total: computed.total,
        amountPaid: paymentStatus === 'paid' ? computed.total : 0,
        balance: paymentStatus === 'paid' ? 0 : computed.total,
      };

      // Convert expectedDelivery to a plain date to avoid Firestore serialization issues
      const deliveryDate = new Date(expectedDelivery.getTime());

      // Customer's saved GPS pin (captured by an agent at their door) — copied
      // onto new orders so navigation stays precise for any future agent.
      let custGeo: { lat: number; lng: number } | null = null;
      if (draftOrder.customer.id) {
        try {
          const custSnap = await firestore().collection(`shops/${shopId}/customers`).doc(draftOrder.customer.id).get();
          const c = custSnap.data() as { lat?: number; lng?: number } | undefined;
          if (typeof c?.lat === 'number' && typeof c?.lng === 'number') custGeo = { lat: c.lat, lng: c.lng };
        } catch { /* non-fatal */ }
      }

      const orderData: Record<string, any> = {
        ...(custGeo ? { deliveryLat: custGeo.lat, deliveryLng: custGeo.lng } : {}),
        orderNumber,
        publicId: orderNumber,
        customerId: draftOrder.customer.id || null,
        customerName: draftOrder.customer.name || 'Guest',
        customerPhone: draftOrder.customer.phone || '',
        customerEmail: draftOrder.customer.email || null,
        customerAddress: draftOrder.customer.address || null,
        isGuest: draftOrder.customer.isGuest || false,
        items: draftOrder.items.map((item, idx) => ({
          id: item.id || `i-${Date.now()}-${idx}`,
          serviceId: item.serviceId || '',
          serviceName: item.serviceName || '',
          categoryName: item.categoryName || '',
          categoryId: item.categoryId || '',
          quantity: item.quantity || 1,
          unit: item.unit || 'piece',
          unitPrice: item.unitPrice || 0,
          total: item.total || 0,
          express: item.express ?? false,
          notes: null,
          damages: null,
        })),
        financials,
        status: 'pending',
        paymentMethod: 'cash',
        paymentStatus: paymentStatus,
        deliveryType,
        deliveryAddress: deliveryType === 'pickup_store' ? null : draftOrder.customer.address || null,
        deliveryNotes: notes.trim() || null,
        expectedDelivery: deliveryDate,
        scheduledPickupDate: deliveryType === 'pickup_home' ? pickupDate : null,
        scheduledPickupTime: deliveryType === 'pickup_home' ? (pickupSlot || null) : null,
        deliverySlot: isHomeType ? (deliverySlot || null) : null,
        // Agent portal: a new order is auto-assigned to the agent who created it; otherwise use the picker (home types only).
        assignedAgentId: selfAssignAsAgent ? (getAgentId() || null) : (isHomeType ? assignedAgentId : null),
        assignedAgentName: selfAssignAsAgent ? (getAgentName() || null) : (isHomeType ? agents.find((a) => a.id === assignedAgentId)?.name || null : null),
        assignedAt: selfAssignAsAgent ? new Date() : (isHomeType && assignedAgentId ? new Date() : null),
        deliveryArea: isHomeType ? (selectedArea || null) : null,
        damagePhotoUrls: damagePhotoUrls.length ? damagePhotoUrls : null,
        // Caption metadata: who added each photo + when (shown on detail screens & tracking).
        photoMeta: damagePhotoUrls.length
          ? damagePhotoUrls.map((url) => ({ url, byName: getAgentName() || 'Staff', byRole: selfAssignAsAgent ? 'agent' : 'staff', at: new Date() }))
          : null,
        staffId: getAgentId() || 'staff',
        staffName: getAgentName() || 'Staff',
        orderSource: 'pos',
        shopId,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeline: [{
          id: `t-${Date.now()}`,
          status: 'pending',
          timestamp: new Date(),
          staffId: getAgentId() || 'staff',
          staffName: getAgentName() || 'Staff',
          notifiedCustomer: false,
        }],
      };

      if (editOrderId) {
        // UPDATE existing order
        const orderRef = firestore().collection(`shops/${shopId}/orders`).doc(editOrderId);
        const existingDoc = await orderRef.get();
        const existingData = existingDoc.data() || {};

        await orderRef.update({
          items: orderData.items,
          financials,
          deliveryType,
          deliveryNotes: notes.trim() || null,
          expectedDelivery: deliveryDate,
          scheduledPickupDate: deliveryType === 'pickup_home' ? pickupDate : null,
          scheduledPickupTime: deliveryType === 'pickup_home' ? (pickupSlot || null) : null,
          deliverySlot: isHomeType ? (deliverySlot || null) : null,
          paymentStatus,
          assignedAgentId: isHomeType ? assignedAgentId : null,
          assignedAgentName: isHomeType ? agents.find((a) => a.id === assignedAgentId)?.name || null : null,
          // Keep the original assignment time when the agent is unchanged; only
          // stamp a new one when the agent actually changes (avoids refreshing
          // assignedAt on unrelated edits like item/price changes).
          assignedAt: isHomeType && assignedAgentId
            ? (existingData.assignedAgentId === assignedAgentId && existingData.assignedAt
                ? existingData.assignedAt
                : new Date())
            : null,
          deliveryArea: isHomeType ? (selectedArea || null) : null,
          damagePhotoUrls: damagePhotoUrls.length ? damagePhotoUrls : null,
          // Merge captions: keep meta for photos that remain, stamp new ones as ours.
          photoMeta: (() => {
            const prev: any[] = Array.isArray(existingData.photoMeta) ? existingData.photoMeta : [];
            const kept = prev.filter((m) => m?.url && (damagePhotoUrls.includes(m.url) || m.url === existingData.pickupPhoto || m.url === existingData.deliveryPhoto || m.url === existingData.plantPhoto));
            const known = new Set(kept.map((m) => m.url));
            const added = damagePhotoUrls.filter((u) => !known.has(u))
              .map((url) => ({ url, byName: getAgentName() || 'Staff', byRole: selfAssignAsAgent ? 'agent' : 'staff', at: new Date() }));
            const merged = [...kept, ...added];
            return merged.length ? merged : null;
          })(),
          updatedAt: new Date(),
          timeline: [...(existingData.timeline || []), {
            id: `t-${Date.now()}`,
            status: existingData.status || 'pending',
            timestamp: new Date(),
            staffId: getAgentId() || 'staff',
            staffName: getAgentName() || 'Staff',
            note: 'Order items edited',
            notifiedCustomer: false,
          }],
        });

        try {
          onPlaceOrder({
            id: editOrderId,
            publicId: existingData.publicId || existingData.orderNumber || '',
            orderNumber: existingData.orderNumber || '',
            customer: draftOrder.customer,
            items: draftOrder.items,
            financials: { ...draftOrder.financials, ...financials },
            deliveryType,
            paymentStatus,
            expectedDelivery: deliveryDate,
            createdAt: existingData.createdAt ? (existingData.createdAt.toDate ? existingData.createdAt.toDate() : new Date(existingData.createdAt)) : new Date(),
            notes: notes.trim(),
          });
        } catch (cbErr) {
          console.error('onPlaceOrder callback error:', cbErr);
        }
      } else {
        // CREATE new order
        // Loyalty earn (fully paid at creation, registered customers only) —
        // stamped on the order so it can never be credited twice.
        const canEarn = !!(loyaltyCfg?.enabled && draftOrder.customer.id && !draftOrder.customer.isGuest && paymentStatus === 'paid');
        const earn = canEarn
          ? (loyaltyCfg.mode === 'fixed'
              ? Math.max(0, Math.round(loyaltyCfg.earnFixed || 0))
              : Math.max(0, Math.round((computed.total * (loyaltyCfg.earnPercent || 0)) / 100)))
          : 0;
        if (earn > 0) orderData.loyalty = { earnedPoints: earn, earnedAt: new Date() };

        const created = await firestore().collection(`shops/${shopId}/orders`).add(orderData);

        // Update customer stats
        if (draftOrder.customer.id) {
          try {
            const custRef = firestore().collection(`shops/${shopId}/customers`).doc(draftOrder.customer.id);
            const custDoc = await custRef.get();
            if (custDoc.exists) {
              const custData = custDoc.data() || {};
              const redeemed = computed.pointsRedeemed || 0;
              const custUpdate: Record<string, any> = {
                totalOrders: (custData.totalOrders || 0) + 1,
                totalSpent: (custData.totalSpent || 0) + computed.total,
                lastOrderAt: new Date(),
                updatedAt: new Date(),
              };
              if (redeemed > 0 || earn > 0) {
                custUpdate.loyaltyPoints = Math.max(0, (custData.loyaltyPoints || 0) - redeemed + earn);
                if (earn > 0) custUpdate.loyaltyEarned = (custData.loyaltyEarned || 0) + earn;
              }
              await custRef.update(custUpdate);
            }
          } catch (custErr) {
            console.error('Customer stats update error (non-fatal):', custErr);
          }
        }

        try {
          onPlaceOrder({
            id: created.id,
            publicId: orderNumber,
            orderNumber,
            customer: draftOrder.customer,
            items: draftOrder.items,
            financials: { ...draftOrder.financials, ...financials },
            deliveryType,
            paymentStatus,
            expectedDelivery: deliveryDate,
            createdAt: new Date(),
            notes: notes.trim(),
          });
        } catch (cbErr) {
          console.error('onPlaceOrder callback error:', cbErr);
        }
      }
    } catch (e: any) {
      console.error('Place order error:', e);
      Alert.alert(t('mobile.errorTitle'), e.message || t('mobile.failedPlaceOrder'));
    } finally {
      setPlacing(false);
    }
  };

  if (!draftOrder) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }]}>
        <Text style={{ fontSize: 16, fontFamily: fonts.bold, color: colors.text, marginBottom: 12 }}>{t('mobile.noDraftOrder')}</Text>
        <TouchableOpacity style={styles.placeOrderBtn} onPress={onBack}>
          <Text style={styles.placeOrderText}>{t('mobile.backToCreateOrder')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const formatDate = (d: Date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  return (
    <View style={styles.container}>
      {/* TopAppBar */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerInner}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
              <MaterialIcons name="chevron-left" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{editOrderId ? t('mobile.updateOrderTitle') : t('mobile.orderReviewTitle')}</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn}>
            <MaterialIcons name="more-vert" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Customer Info Card */}
        <View style={styles.customerCard}>
          <View style={styles.customerLeft}>
            <View style={styles.customerAvatar}>
              <MaterialIcons name="person" size={24} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.customerName}>{draftOrder.customer.name}</Text>
              <Text style={styles.customerPhone}>{draftOrder.customer.phone}</Text>
            </View>
          </View>
          {!editOrderId && (
            <TouchableOpacity onPress={onEditCustomer}>
              <Text style={styles.editBtnText}>{t('mobile.editCaps')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Service Groups */}
        <View style={styles.servicesContainer}>
          {categoryGroups.map((group, groupIndex) => (
            <View key={`${group.name}-${groupIndex}`} style={styles.serviceSection}>
              <View style={groupIndex % 2 === 0 ? styles.serviceHeaderWash : styles.serviceHeaderIron}>
                <View style={styles.serviceHeaderLeft}>
                  <MaterialIcons
                    name={groupIndex % 2 === 0 ? 'local-laundry-service' : 'iron'}
                    size={20}
                    color={groupIndex % 2 === 0 ? colors.primary : '#5e3c00'}
                  />
                  <Text style={groupIndex % 2 === 0 ? styles.serviceTitleWash : styles.serviceTitleIron}>
                    {group.name.toUpperCase()} · {group.items.length} {group.items.length === 1 ? 'ITEM' : 'ITEMS'}
                  </Text>
                </View>
                <Text style={groupIndex % 2 === 0 ? styles.serviceSubtotalWash : styles.serviceSubtotalIron}>
                  {formatCurrency(Math.round(group.subtotal), countrySettings)}
                </Text>
              </View>
              <View style={styles.serviceItems}>
                {group.items.map((item, index) => (
                  <View key={item.id}>
                    <View style={styles.serviceItem}>
                      <View>
                        <Text style={styles.itemName}>{item.serviceName}</Text>
                        <Text style={styles.itemMeta}>
                          {`x${item.quantity} · ${formatCurrency(Math.round(item.unitPrice), countrySettings)} ea.`}
                          {item.express ? t('mobile.expressSuffixShort') : ''}
                        </Text>
                      </View>
                      <Text style={styles.itemTotal}>{formatCurrency(Math.round(item.total), countrySettings)}</Text>
                    </View>
                    {index !== group.items.length - 1 ? <View style={styles.separator} /> : null}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Tax, Discount & Notes */}
        <View style={styles.summaryCard}>
          {/* Subtotal */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('mobile.subtotalLabel')}</Text>
            <Text style={styles.summaryValue}>{formatCurrency(computed.subtotal, countrySettings)}</Text>
          </View>

          {/* Discount (hidden while a coupon is applied — coupon sets the discount) */}
          {!appliedCoupon ? (
            <View style={styles.summaryRow}>
              <View style={styles.summaryRowLabel}>
                <MaterialIcons name="local-offer" size={18} color={colors.success} />
                <Text style={styles.discountLabel}>{t('mobile.discountLabel')}</Text>
              </View>
              <TextInput
                style={styles.discountInput}
                placeholder={t('mobile.discountPlaceholder')}
                placeholderTextColor="#c3c6d6"
                textAlign="right"
                value={discountText}
                onChangeText={setDiscountText}
                keyboardType="default"
              />
            </View>
          ) : null}

          {/* Coupon (Pro+/Business) */}
          {appliedCoupon ? (
            <View style={styles.summaryRow}>
              <View style={styles.summaryRowLabel}>
                <MaterialIcons name="confirmation-number" size={18} color={colors.success} />
                <Text style={styles.couponCodeText}>{appliedCoupon.code}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={styles.discountApplied}>-{formatCurrency(computed.discountAmount, countrySettings)}</Text>
                <TouchableOpacity onPress={() => setAppliedCoupon(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialIcons name="close" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          ) : offersPlan && publicCoupons.length > 0 ? (
            <>
              <View style={styles.summaryRow}>
                <View style={[styles.summaryRowLabel, { flex: 1 }]}>
                  <MaterialIcons name="confirmation-number" size={18} color={colors.textSecondary} />
                  <TextInput
                    style={styles.couponInput}
                    placeholder={t('mobile.couponPlaceholder', 'Coupon code')}
                    placeholderTextColor="#c3c6d6"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    value={couponInput}
                    onChangeText={(v) => { setCouponInput(v.toUpperCase()); setCouponError(null); }}
                  />
                </View>
                <TouchableOpacity onPress={handleApplyCoupon} disabled={!couponInput.trim()}>
                  <Text style={[styles.couponApplyText, !couponInput.trim() && { opacity: 0.4 }]}>{t('mobile.couponApply', 'Apply')}</Text>
                </TouchableOpacity>
              </View>
              {couponError ? <Text style={styles.couponError}>{couponError}</Text> : null}
            </>
          ) : null}
          {!appliedCoupon && computed.discountAmount > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelSmall}>{t('mobile.discountApplied')}</Text>
              <Text style={styles.discountApplied}>-{formatCurrency(computed.discountAmount, countrySettings)}</Text>
            </View>
          ) : null}

          {/* Tax */}
          {taxEnabled ? (
            <View style={styles.summaryRow}>
              <View style={styles.summaryRowLabel}>
                <MaterialIcons name="receipt" size={18} color={colors.textSecondary} />
                <Text style={styles.summaryLabel}>{taxName} ({taxRate}%)</Text>
              </View>
              <Text style={styles.summaryValue}>+{formatCurrency(computed.taxAmount, countrySettings)}</Text>
            </View>
          ) : null}

          {/* Delivery charge */}
          {computed.deliveryCharge > 0 ? (
            <View style={styles.summaryRow}>
              <View style={styles.summaryRowLabel}>
                <MaterialIcons name="local-shipping" size={18} color={colors.textSecondary} />
                <Text style={styles.summaryLabel}>{t('mobile.deliveryChargeLabel', 'Delivery')}</Text>
              </View>
              <Text style={styles.summaryValue}>+{formatCurrency(computed.deliveryCharge, countrySettings)}</Text>
            </View>
          ) : null}

          {/* Cashback visibility: what this order will EARN (even before any balance exists) */}
          {offersPlan && loyaltyCfg?.enabled && !editOrderId && draftOrder.customer.id && !draftOrder.customer.isGuest ? (() => {
            const willEarn = loyaltyCfg.mode === 'fixed'
              ? Math.max(0, Math.round(loyaltyCfg.earnFixed || 0))
              : Math.max(0, Math.round((computed.total * (loyaltyCfg.earnPercent || 0)) / 100));
            if (willEarn <= 0) return null;
            return (
              <View style={styles.summaryRow}>
                <Text style={styles.willEarnText}>🪙 {t('mobile.willEarnPoints', 'Earns {{n}} points when fully paid', { n: willEarn })}</Text>
              </View>
            );
          })() : null}

          {/* Redeem loyalty points (Pro+/Business, registered customers with a balance) */}
          {offersPlan && loyaltyCfg?.enabled && !editOrderId && draftOrder.customer.id && !draftOrder.customer.isGuest && pointsBalance > 0 ? (
            <>
              <View style={styles.summaryRow}>
                <View style={styles.summaryRowLabel}>
                  <MaterialIcons name="stars" size={18} color="#b8860b" />
                  <View>
                    <Text style={styles.discountLabel}>{t('mobile.redeemPoints', 'Redeem points')}</Text>
                    <Text style={styles.pointsHint}>{t('mobile.pointsAvailable', '{{n}} available', { n: pointsBalance })}</Text>
                  </View>
                </View>
                <TextInput
                  style={styles.discountInput}
                  placeholder="0"
                  placeholderTextColor="#c3c6d6"
                  textAlign="right"
                  keyboardType="number-pad"
                  value={pointsText}
                  onChangeText={setPointsText}
                />
              </View>
              {computed.pointsRedeemed > 0 ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabelSmall}>{t('mobile.pointsApplied', 'Points applied')}</Text>
                  <Text style={styles.discountApplied}>-{formatCurrency(computed.pointsRedeemed, countrySettings)}</Text>
                </View>
              ) : null}
            </>
          ) : null}

          {/* Divider before Grand Total */}
          <View style={styles.summaryDivider} />

          {/* Grand Total — inside summary card */}
          <View style={styles.summaryRow}>
            <Text style={styles.grandTotalLabel}>{t('mobile.grandTotalLabel')}</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(computed.total, countrySettings)}</Text>
          </View>
        </View>

        {/* Notes — outside summary card */}
        <View style={styles.notesCard}>
          <MaterialIcons name="sticky-note-2" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.notesInput}
            placeholder={t('mobile.addNotePlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {/* Damage / stain photos — optional (Business plan only) */}
        {canDamagePhotos ? (
          <View style={styles.damageCard}>
            <Text style={styles.damageLabel}>{t('mobile.damagePhotosLabel', 'Damage / stain photos (optional)')}</Text>
            <DamagePhotos value={damagePhotos} onChange={setDamagePhotos} />
          </View>
        ) : null}

        {/* Expected Delivery — editable */}
        <View style={styles.deliveryDateCard}>
          <MaterialIcons name="event" size={20} color={colors.primary} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.deliveryDateLabel}>{deliveryType === 'pickup_store' ? t('mobile.expectedReadyUpper') : t('mobile.expectedDeliveryUpper')}</Text>
            <Text style={styles.deliveryDateValue}>{formatDate(expectedDelivery)}</Text>
          </View>
          <View style={styles.dateAdjustRow}>
            <TouchableOpacity
              style={styles.dateAdjustBtn}
              onPress={() => {
                const d = new Date(expectedDelivery);
                d.setDate(d.getDate() - 1);
                // Don't allow past dates
                if (d >= new Date(new Date().toDateString())) setExpectedDelivery(d);
              }}
            >
              <MaterialIcons name="remove" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dateAdjustBtn}
              onPress={() => {
                const d = new Date(expectedDelivery);
                d.setDate(d.getDate() + 1);
                setExpectedDelivery(d);
              }}
            >
              <MaterialIcons name="add" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Delivery & Payment */}
        <View style={styles.summaryCard}>
          <View style={styles.toggleGroup}>
            <Text style={styles.toggleLabel}>{t('mobile.deliveryTypeLabel')}</Text>
            <View style={styles.segmentControl}>
              <TouchableOpacity
                style={deliveryType === 'pickup_store' ? styles.segmentActive : styles.segmentInactive}
                onPress={() => setDeliveryType('pickup_store')}
              >
                <Text style={deliveryType === 'pickup_store' ? styles.segmentTextActive : styles.segmentTextInactive}>{t('mobile.delivery_pickup_store')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={deliveryType === 'delivery_home' ? styles.segmentActive : styles.segmentInactive}
                onPress={() => setDeliveryType('delivery_home')}
              >
                <Text style={deliveryType === 'delivery_home' ? styles.segmentTextActive : styles.segmentTextInactive}>{t('mobile.delivery_delivery_home')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={deliveryType === 'pickup_home' ? styles.segmentActive : styles.segmentInactive}
                onPress={() => setDeliveryType('pickup_home')}
              >
                <Text style={deliveryType === 'pickup_home' ? styles.segmentTextActive : styles.segmentTextInactive}>{t('mobile.delivery_pickup_home', 'Pickup & Delivery')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Pickup date (Pickup & Delivery orders) */}
          {deliveryType === 'pickup_home' && (
            <View style={styles.toggleGroup}>
              <Text style={styles.toggleLabel}>{t('mobile.pickupDateLabel', 'Pickup date')}</Text>
              <View style={styles.slotDateRow}>
                <MaterialIcons name="event" size={18} color={colors.primary} />
                <Text style={styles.slotDateValue}>{formatDate(pickupDate)}</Text>
                <TouchableOpacity
                  style={styles.slotDateBtn}
                  onPress={() => {
                    const d = new Date(pickupDate);
                    d.setDate(d.getDate() - 1);
                    if (d >= new Date(new Date().toDateString())) setPickupDate(d);
                  }}
                >
                  <MaterialIcons name="remove" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.slotDateBtn}
                  onPress={() => { const d = new Date(pickupDate); d.setDate(d.getDate() + 1); setPickupDate(d); }}
                >
                  <MaterialIcons name="add" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Pickup slot (required for Pickup & Delivery) */}
          {deliveryType === 'pickup_home' && pickupSlotOptions.length > 0 && (
            <View style={styles.toggleGroup}>
              <Text style={styles.toggleLabel}>{t('mobile.pickupSlotLabel', 'Pickup slot')} *</Text>
              <Dropdown
                title={t('mobile.pickupSlotLabel', 'Pickup slot')}
                value={pickupSlot}
                placeholder={t('mobile.selectSlot', 'Select time slot')}
                options={pickupSlotOptions.map((sl) => ({ key: sl.value, label: sl.value }))}
                onSelect={setPickupSlot}
              />
            </View>
          )}

          {/* Delivery slot (required for all home orders) */}
          {isHomeType && deliverySlotOptions.length > 0 && (
            <View style={styles.toggleGroup}>
              <Text style={styles.toggleLabel}>{t('mobile.deliverySlotLabel', 'Delivery slot')} *</Text>
              <Dropdown
                title={t('mobile.deliverySlotLabel', 'Delivery slot')}
                value={deliverySlot}
                placeholder={t('mobile.selectSlot', 'Select time slot')}
                options={deliverySlotOptions.map((sl) => ({ key: sl.value, label: sl.value }))}
                onSelect={setDeliverySlot}
              />
            </View>
          )}

          {isHomeType && distanceBands.length > 0 && (
            <View style={styles.toggleGroup}>
              <Text style={styles.toggleLabel}>{t('mobile.deliveryDistance', 'Delivery distance')}</Text>
              <Dropdown
                title={t('mobile.deliveryDistance', 'Delivery distance')}
                value={deliveryBandId || distanceBands[0].id}
                placeholder={t('mobile.selectDistance', 'Select distance')}
                options={distanceBands.map((b) => ({ key: b.id, label: `${b.label} · ${formatCurrency(b.fee, countrySettings)}` }))}
                onSelect={setDeliveryBandId}
              />
            </View>
          )}

          {serviceAreasEnabled && isHomeType && serviceAreas.length > 0 && (
            <View style={styles.toggleGroup}>
              <Text style={styles.toggleLabel}>{t('mobile.serviceAreaLabel', 'Service area')}</Text>
              <Dropdown
                title={t('mobile.serviceAreaLabel', 'Service area')}
                value={selectedArea}
                placeholder={t('mobile.selectArea', 'Select area')}
                options={serviceAreas.map((a) => ({ key: a, label: a }))}
                onSelect={setSelectedArea}
              />
            </View>
          )}

          {serviceAreasEnabled && isHomeType && (
            <View style={styles.toggleGroup}>
              <Text style={styles.toggleLabel}>{t('mobile.assignAgentLabel', 'Assign delivery agent')}</Text>
              {agents.length === 0 ? (
                <Text style={styles.agentEmpty}>
                  {t('mobile.noAgents', 'No delivery agents yet. Create one in Settings → Team.')}
                </Text>
              ) : (
                <Dropdown
                  title={t('mobile.assignAgentLabel', 'Assign delivery agent')}
                  value={assignedAgentId || ''}
                  placeholder={t('mobile.noAgent', 'No agent')}
                  options={[
                    { key: '', label: t('mobile.noAgent', 'No agent') },
                    ...displayAgents.map((a) => ({ key: a.id, label: a.name, online: !!a.isOnline })),
                  ]}
                  onSelect={(k) => setAssignedAgentId(k || null)}
                />
              )}
            </View>
          )}

          <View style={styles.toggleGroup}>
            <Text style={styles.toggleLabel}>{t('mobile.paymentStatusLabel')}</Text>
            <View style={styles.segmentControl}>
              <TouchableOpacity
                style={paymentStatus === 'unpaid' ? styles.segmentError : styles.segmentInactive}
                onPress={() => setPaymentStatus('unpaid')}
              >
                <Text style={paymentStatus === 'unpaid' ? styles.segmentTextError : styles.segmentTextInactive}>{t('mobile.unpaidLabel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={paymentStatus === 'paid' ? styles.segmentActive : styles.segmentInactive}
                onPress={() => setPaymentStatus('paid')}
              >
                <Text style={paymentStatus === 'paid' ? styles.segmentTextActive : styles.segmentTextInactive}>{t('mobile.paidLabel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Fixed Bottom Action — Split layout like HTML */}
      <View style={[styles.bottomAction, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.placeOrderBtn, placing && { opacity: 0.6 }]}
          activeOpacity={0.8}
          onPress={handlePlaceOrder}
          disabled={placing}
        >
          {placing ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <>
              <View>
                <Text style={styles.placeOrderItemCount}>
                  {draftOrder?.items?.length || 0} {t('mobile.items', { defaultValue: 'ITEMS' }).toUpperCase()}
                </Text>
                <Text style={styles.placeOrderTotal}>{formatCurrency(computed.total, countrySettings)}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.placeOrderText}>{editOrderId ? t('mobile.updateOrderTitle') : t('mobile.placeOrderBtn')}</Text>
                <MaterialIcons name="arrow-forward" size={20} color={colors.surface} />
              </View>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface, zIndex: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 48, paddingHorizontal: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  scrollContent: { padding: 16, gap: 16 },
  customerCard: {
    backgroundColor: colors.surface, borderRadius: radii.card, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    ...shadows.card, ...shadows.cardBorder,
  },
  customerLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  customerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  customerName: { fontSize: 16, fontFamily: fonts.bold, color: colors.text, marginBottom: 2 },
  customerPhone: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary },
  editBtnText: { fontSize: 12, fontFamily: fonts.bold, color: colors.primary, paddingHorizontal: 12, paddingVertical: 4 },
  servicesContainer: { gap: 12 },
  serviceSection: { backgroundColor: colors.surface, borderRadius: radii.card, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  serviceHeaderWash: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.primaryTint,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  serviceHeaderIron: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.warningBg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  serviceHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  serviceTitleWash: { fontSize: 10, fontFamily: fonts.bold, color: colors.primary, letterSpacing: 1 },
  serviceSubtotalWash: { fontSize: 10, fontFamily: fonts.bold, color: colors.primary },
  serviceTitleIron: { fontSize: 10, fontFamily: fonts.bold, color: '#5e3c00', letterSpacing: 1 },
  serviceSubtotalIron: { fontSize: 10, fontFamily: fonts.bold, color: '#5e3c00' },
  serviceItems: { backgroundColor: colors.surface },
  serviceItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  separator: { height: 1, backgroundColor: colors.border },
  itemName: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text, marginBottom: 2 },
  itemMeta: { fontSize: 11, color: colors.textSecondary },
  itemTotal: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  summaryCard: {
    backgroundColor: colors.surface, borderRadius: radii.card, padding: 16, gap: 14,
    ...shadows.card, ...shadows.cardBorder,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryRowLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textSecondary },
  summaryLabelSmall: { fontSize: 12, color: colors.textMuted, marginLeft: 26 },
  summaryValue: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  discountLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text },
  discountInput: { fontSize: 14, fontFamily: fonts.bold, color: colors.success, padding: 0, minWidth: 100 },
  discountApplied: { fontSize: 13, fontFamily: fonts.bold, color: colors.success },
  couponCodeText: { fontSize: 14, fontFamily: fonts.bold, color: colors.success, letterSpacing: 0.5 },
  couponInput: { flex: 1, fontSize: 14, fontFamily: fonts.semibold, color: colors.text, padding: 0 },
  couponApplyText: { fontSize: 13, fontFamily: fonts.bold, color: colors.primary, paddingHorizontal: 8, paddingVertical: 4 },
  couponError: { fontSize: 12, fontFamily: fonts.medium, color: colors.error, marginLeft: 26, marginTop: -8 },
  pointsHint: { fontSize: 11, fontFamily: fonts.medium, color: colors.textMuted, marginTop: 1 },
  willEarnText: { fontSize: 12, fontFamily: fonts.semibold, color: '#b8860b' },
  slotDateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.primaryTint, borderRadius: radii.input, paddingHorizontal: 14, paddingVertical: 10,
  },
  slotDateValue: { flex: 1, fontSize: 14, fontFamily: fonts.bold, color: colors.primary },
  slotDateBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  summaryDivider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  grandTotalLabel: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  grandTotalValue: { fontSize: 18, fontFamily: fonts.bold, color: colors.primary },
  notesCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radii.card, paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  notesInput: { flex: 1, fontSize: 14, fontFamily: fonts.medium, color: colors.text, padding: 0 },
  damageCard: {
    backgroundColor: colors.surface, borderRadius: radii.card, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: colors.border, gap: 10,
  },
  damageLabel: { fontSize: 10, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase' },
  expressBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.successBg,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.button, marginBottom: 4,
  },
  expressText: { fontSize: 10, fontFamily: fonts.bold, color: colors.primary },
  deliveryDateCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryTint,
    borderRadius: radii.input, paddingHorizontal: 16, paddingVertical: 12,
  },
  deliveryDateLabel: { fontSize: 10, fontFamily: fonts.bold, color: colors.primary, letterSpacing: 0.5 },
  deliveryDateValue: { fontSize: 14, fontFamily: fonts.bold, color: colors.primary, marginTop: 2 },
  dateAdjustRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateAdjustBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  toggleGroup: { gap: 8 },
  toggleLabel: { fontSize: 10, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 1, paddingHorizontal: 4 },
  segmentControl: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: radii.button, padding: 4 },
  segmentActive: {
    flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  segmentInactive: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segmentError: {
    flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: colors.errorBg, borderRadius: 8,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  segmentTextActive: { fontSize: 12, fontFamily: fonts.bold, color: colors.primary },
  segmentTextInactive: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary },
  segmentTextError: { fontSize: 12, fontFamily: fonts.bold, color: colors.error },
  agentWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  agentChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.chip,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  agentChipActive: { backgroundColor: colors.primaryTint, borderColor: 'transparent' },
  agentChipText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textSecondary },
  agentChipTextActive: { color: colors.primary },
  agentEmpty: { fontSize: 12, fontFamily: fonts.medium, color: colors.textMuted, paddingHorizontal: 4, lineHeight: 18 },
  bottomAction: {
    position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 16,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
  },
  placeOrderBtn: {
    height: 56, backgroundColor: colors.primary, borderRadius: radii.input, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20,
    elevation: 4, shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  placeOrderItemCount: { fontSize: 11, fontFamily: fonts.bold, color: colors.surface, letterSpacing: 0.5, opacity: 0.8 },
  placeOrderTotal: { fontSize: 18, fontFamily: fonts.bold, color: colors.surface },
  placeOrderText: { fontSize: 16, fontFamily: fonts.bold, color: colors.surface },
});
