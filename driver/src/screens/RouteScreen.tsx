/**
 * Route optimizer — orders the agent's pending pickups & deliveries into the
 * shortest round of stops from their current GPS, shows them on an OpenStreetMap
 * map, and hands the whole route to Google Maps for turn-by-turn navigation.
 * Stops use the GPS pin saved at the door; older address-only orders are
 * forward-geocoded (OSM Nominatim) so they still route.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../theme';
import { DetailHeader } from '../components/DetailHeader';
import { Button } from '../components/ui/Button';
import { FilterChips } from '../components/ui/FilterChips';
import { RouteMap } from '../components/RouteMap';
import { useDriverTasks, type DriverTask } from '../hooks/use-driver-tasks';
import { useNav } from '../lib/nav';
import { useCurrency } from '../lib/currency';
import { getCurrentPosition } from '../lib/saveCustomerLocation';
import { forwardGeocode, sleep } from '../lib/geocode';
import { optimizeRoute, totalDistanceKm, multiStopMapsUrl, openSingleStop, haversineKm } from '../lib/routeOptimize';
import type { LatLng } from '../lib/osmTiles';

type TypeFilter = 'all' | 'pickup' | 'delivery';
type Stop = LatLng & { task: DriverTask; approx: boolean };

const MAX_GEOCODE = 12; // respect Nominatim's ~1 req/s policy — cap network lookups per run

function endOfToday(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export default function RouteScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNav();
  const { format: money } = useCurrency();
  const { pickupTasks, deliveryTasks } = useDriverTasks();

  const [filter, setFilter] = useState<TypeFilter>('all');
  const [start, setStart] = useState<LatLng | null>(null);
  const [gpsDenied, setGpsDenied] = useState(false);
  const [located, setLocated] = useState<Stop[]>([]);
  const [unlocated, setUnlocated] = useState<DriverTask[]>([]);
  const [resolving, setResolving] = useState(true);
  const runId = useRef(0);

  // Actionable set: pending pickups + deliveries due today or overdue.
  const candidates = useMemo(() => {
    const cutoff = endOfToday();
    const base = [
      ...(filter !== 'delivery' ? pickupTasks : []),
      ...(filter !== 'pickup' ? deliveryTasks : []),
    ];
    return base.filter((t) => t.status === 'pending' && t.scheduledDate.getTime() <= cutoff);
  }, [pickupTasks, deliveryTasks, filter]);

  const candidateSig = candidates.map((t) => t.orderId).join(',');

  // Agent's current location — the route's start point (best-effort).
  useEffect(() => {
    let alive = true;
    getCurrentPosition()
      .then((p) => alive && setStart(p))
      .catch(() => alive && setGpsDenied(true));
    return () => {
      alive = false;
    };
  }, []);

  // Resolve a coordinate for every candidate: saved pin first, else geocode the
  // address. Fills the map progressively; cancels cleanly if the set changes.
  useEffect(() => {
    const id = ++runId.current;
    const loc: Stop[] = [];
    const unloc: DriverTask[] = [];
    const toGeocode: DriverTask[] = [];

    candidates.forEach((t) => {
      const lat = (t.raw as any).deliveryLat;
      const lng = (t.raw as any).deliveryLng;
      if (typeof lat === 'number' && typeof lng === 'number') loc.push({ lat, lng, task: t, approx: false });
      else if ((t.customer.address || '').trim()) toGeocode.push(t);
      else unloc.push(t);
    });

    setLocated([...loc]);
    setUnlocated([...unloc]);
    setResolving(toGeocode.length > 0);

    (async () => {
      for (let i = 0; i < toGeocode.length && i < MAX_GEOCODE; i++) {
        if (runId.current !== id) return; // superseded — stop
        const t = toGeocode[i];
        const hit = await forwardGeocode(t.customer.address);
        if (runId.current !== id) return;
        if (hit) {
          loc.push({ ...hit, task: t, approx: true });
          setLocated([...loc]);
        } else {
          unloc.push(t);
          setUnlocated([...unloc]);
        }
        if (i < toGeocode.length - 1) await sleep(1100);
      }
      // Anything past the per-run geocode cap → treat as unlocated.
      if (runId.current === id && toGeocode.length > MAX_GEOCODE) {
        setUnlocated([...unloc, ...toGeocode.slice(MAX_GEOCODE)]);
      }
      if (runId.current === id) setResolving(false);
    })();

    return () => {
      runId.current++; // invalidate this run on cleanup
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateSig]);

  const ordered = useMemo(() => optimizeRoute(start, located), [start, located]);
  const totalKm = useMemo(() => totalDistanceKm(start, ordered), [start, ordered]);
  const navUrl = useMemo(() => multiStopMapsUrl(start, ordered), [start, ordered]);

  const openStop = (t: DriverTask) =>
    nav.navigate(t.type === 'pickup' ? { name: 'pickupDetail', orderId: t.orderId } : { name: 'deliveryDetail', orderId: t.orderId });

  const startNavigation = () => {
    if (!navUrl) return;
    if (navUrl.dropped > 0) {
      Alert.alert(
        'Long route',
        `Google Maps can navigate the first ${ordered.length - navUrl.dropped} stops in one go. Finish those, then re-open the route for the rest.`,
        [{ text: 'Navigate', onPress: () => Linking.openURL(navUrl.url).catch(() => {}) }, { text: 'Cancel', style: 'cancel' }],
      );
    } else {
      Linking.openURL(navUrl.url).catch(() => {});
    }
  };

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'pickup', label: 'Pickups' },
    { key: 'delivery', label: 'Deliveries' },
  ];

  return (
    <View style={s.flex}>
      <DetailHeader title="Plan route" />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ marginHorizontal: -14, marginBottom: 10 }}>
          <FilterChips filters={filters} active={filter} onChange={(k) => setFilter(k as TypeFilter)} />
        </View>

        {gpsDenied ? (
          <View style={s.banner}>
            <MaterialIcons name="location-off" size={16} color={colors.warning} />
            <Text style={s.bannerText}>Turn on location to start the route from where you are.</Text>
          </View>
        ) : null}

        <RouteMap start={start} stops={ordered} />

        {/* Summary + start navigation */}
        <View style={s.summary}>
          <View style={{ flex: 1 }}>
            <Text style={s.summaryValue}>
              {ordered.length} stop{ordered.length === 1 ? '' : 's'}
              {ordered.length > 0 ? ` · ${totalKm.toFixed(1)} km` : ''}
            </Text>
            <Text style={s.summaryMeta}>
              {resolving ? 'Locating stops…' : start ? 'Optimised from your location' : 'Optimised order'}
            </Text>
          </View>
          {resolving ? <ActivityIndicator color={colors.primary} style={{ marginRight: 8 }} /> : null}
        </View>

        {ordered.length > 0 ? (
          <Button label="Start navigation" icon="navigation" onPress={startNavigation} style={{ marginBottom: 14 }} />
        ) : null}

        {/* Ordered stop list */}
        {ordered.map((stop, i) => {
          const prev: LatLng | null = i === 0 ? start : ordered[i - 1];
          const legKm = prev ? haversineKm(prev, stop) : null;
          const t = stop.task;
          const isPickup = t.type === 'pickup';
          const due = t.amountToCollect || 0;
          return (
            <TouchableOpacity key={t.id} style={s.row} activeOpacity={0.7} onPress={() => openStop(t)}>
              <View style={s.numBadge}>
                <Text style={s.numText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.rowTop}>
                  <View style={[s.typeChip, { backgroundColor: isPickup ? colors.primaryTint : colors.inProgressBg }]}>
                    <Text style={[s.typeChipText, { color: isPickup ? colors.primary : colors.inProgress }]}>
                      {isPickup ? 'PICKUP' : 'DELIVER'}
                    </Text>
                  </View>
                  <Text style={s.rowName} numberOfLines={1}>{t.customer.name}</Text>
                  {stop.approx ? <Text style={s.approx}>~approx</Text> : null}
                </View>
                <Text style={s.rowAddr} numberOfLines={1}>{t.customer.address || 'No address'}</Text>
                <View style={s.rowMeta}>
                  {legKm != null ? <Text style={s.metaText}>{legKm.toFixed(1)} km</Text> : null}
                  {t.timeSlot?.start ? <Text style={s.metaText}>· {t.timeSlot.start}</Text> : null}
                  {due > 0 ? <Text style={[s.metaText, { color: colors.error }]}>· {money(due)} due</Text> : null}
                </View>
              </View>
              <TouchableOpacity
                style={s.navBtn}
                hitSlop={8}
                onPress={() => openSingleStop(stop.lat, stop.lng)}
                activeOpacity={0.7}
              >
                <MaterialIcons name="navigation" size={18} color={colors.primary} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}

        {!resolving && ordered.length === 0 ? (
          <View style={s.empty}>
            <MaterialIcons name="route" size={30} color={colors.textMuted} />
            <Text style={s.emptyText}>No stops to route right now. Pending pickups & deliveries for today show up here.</Text>
          </View>
        ) : null}

        {/* Stops we couldn't place on the map */}
        {unlocated.length > 0 ? (
          <View style={{ marginTop: 18 }}>
            <Text style={s.sectionLabel}>Needs a location ({unlocated.length})</Text>
            <Text style={s.sectionHint}>Open the order and tap “Save customer location” at the door to add it to the route.</Text>
            {unlocated.map((t) => (
              <TouchableOpacity key={t.id} style={s.unlocRow} activeOpacity={0.7} onPress={() => openStop(t)}>
                <MaterialIcons name="location-searching" size={16} color={colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={s.rowName} numberOfLines={1}>{t.customer.name}</Text>
                  <Text style={s.rowAddr} numberOfLines={1}>{t.customer.address || 'No address on file'}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.warningBg, borderRadius: radii.input, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10,
  },
  bannerText: { flex: 1, fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  summary: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 12 },
  summaryValue: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  summaryMeta: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border,
    padding: 12, marginBottom: 9,
  },
  numBadge: { width: 26, height: 26, borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  numText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  typeChipText: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.5 },
  rowName: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  approx: { fontFamily: fonts.semibold, fontSize: 10, color: colors.textMuted },
  rowAddr: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, flexWrap: 'wrap' },
  metaText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textMuted },
  navBtn: { width: 36, height: 36, borderRadius: 999, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 10, padding: 30 },
  emptyText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  sectionLabel: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 4 },
  sectionHint: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginBottom: 10, lineHeight: 17 },
  unlocRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surfaceMuted, borderRadius: radii.input, borderWidth: 1, borderColor: colors.border,
    padding: 11, marginBottom: 8,
  },
});
