/**
 * Save customer location — the agent confirms the customer's exact spot on an
 * OpenStreetMap preview and saves the pin + address to the order and customer.
 * Opens centered on the agent's current GPS (or the order's existing pin).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TextInput, ActivityIndicator, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fonts, radii } from '../theme';
import { BottomSheet } from './BottomSheet';
import { Button } from './ui/Button';
import {
  getCurrentPosition,
  reverseGeocode,
  saveCustomerLocation,
  type LatLng,
} from '../lib/saveCustomerLocation';
import { TILE, tilesForView } from '../lib/osmTiles';

const MAP_H = 180;
const ZOOM = 16;

export function SaveLocationSheet({
  open,
  onClose,
  shopId,
  orderId,
  customerId,
  initialLat,
  initialLng,
  initialAddress,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  shopId: string;
  orderId: string;
  customerId?: string | null;
  initialLat?: number;
  initialLng?: number;
  initialAddress?: string;
  onSaved?: () => void;
}) {
  const [pos, setPos] = useState<LatLng | null>(
    typeof initialLat === 'number' && typeof initialLng === 'number' ? { lat: initialLat, lng: initialLng } : null,
  );
  const [address, setAddress] = useState(initialAddress || '');
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mapW, setMapW] = useState(320);
  const [error, setError] = useState<string | null>(null);

  // On first open with no pin, grab the agent's current location.
  useEffect(() => {
    if (open && !pos && !locating) void useCurrentLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const useCurrentLocation = async () => {
    setError(null);
    setLocating(true);
    try {
      const p = await getCurrentPosition();
      setPos(p);
      // Resolve an address from the new point (best-effort, keep the field editable).
      setGeocoding(true);
      const addr = await reverseGeocode(p.lat, p.lng);
      if (addr) setAddress(addr);
      setGeocoding(false);
    } catch (e: any) {
      setError(e?.message || 'Could not get your current location.');
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async () => {
    if (!pos || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveCustomerLocation(shopId, orderId, customerId, { lat: pos.lat, lng: pos.lng, address });
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not save the location.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Save customer location"
      footer={
        <Button
          label={saving ? 'Saving…' : 'Save location'}
          icon="check"
          loading={saving}
          onPress={handleSave}
          disabled={!pos || locating}
        />
      }
    >
      <Text style={s.hint}>
        Stand at the customer&apos;s door and capture the exact spot — it&apos;s saved for this order and every future
        pickup/delivery.
      </Text>

      {/* Map preview — OpenStreetMap raster tiles centered on the point */}
      <View style={s.mapBox} onLayout={(e) => setMapW(Math.round(e.nativeEvent.layout.width))}>
        {pos ? (
          <>
            {tilesForView(pos.lat, pos.lng, mapW, MAP_H, ZOOM).map((t) => (
              <Image
                key={`${t.left}_${t.top}`}
                source={{ uri: t.uri, headers: { 'User-Agent': 'LaundrybillTeam/1.0' } }}
                style={{ position: 'absolute', left: t.left, top: t.top, width: TILE, height: TILE }}
              />
            ))}
            {/* Center pin — the map is centered on the point, so this marks it. */}
            <View style={s.pinWrap} pointerEvents="none">
              <MaterialIcons name="place" size={38} color={colors.error} />
            </View>
          </>
        ) : (
          <View style={s.mapPlaceholder}>
            {locating ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <MaterialIcons name="map" size={28} color={colors.textMuted} />
                <Text style={s.placeholderText}>Getting your location…</Text>
              </>
            )}
          </View>
        )}
      </View>
      <Text style={s.attribution}>© OpenStreetMap contributors</Text>

      {pos ? (
        <Text style={s.coords}>
          {pos.lat.toFixed(6)}, {pos.lng.toFixed(6)}
        </Text>
      ) : null}

      <TouchableOpacity style={s.recenter} onPress={useCurrentLocation} disabled={locating} activeOpacity={0.7}>
        <MaterialIcons name="my-location" size={16} color={colors.primary} />
        <Text style={s.recenterText}>{locating ? 'Locating…' : 'Use my current location'}</Text>
      </TouchableOpacity>

      {/* Address (reverse-geocoded from OpenStreetMap, editable) */}
      <Text style={s.label}>ADDRESS {geocoding ? '· resolving…' : ''}</Text>
      <TextInput
        style={s.addressInput}
        value={address}
        onChangeText={setAddress}
        placeholder="Address from the map — edit if needed"
        placeholderTextColor={colors.textMuted}
        multiline
      />

      {error ? (
        <View style={s.errBox}>
          <Text style={s.errText}>{error}</Text>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  hint: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, lineHeight: 18, marginBottom: 12 },
  mapBox: {
    height: 180, borderRadius: radii.card, overflow: 'hidden',
    backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  attribution: { fontFamily: fonts.medium, fontSize: 9.5, color: colors.textMuted, textAlign: 'right', marginTop: 3 },
  pinWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingBottom: 30 },
  mapPlaceholder: { alignItems: 'center', gap: 8 },
  placeholderText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  coords: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 8 },
  recenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginTop: 2 },
  recenterText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  label: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary, letterSpacing: 0.5, marginTop: 6, marginBottom: 6 },
  addressInput: {
    backgroundColor: colors.surfaceMuted, borderRadius: radii.input, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: fonts.medium, color: colors.text,
    minHeight: 60, textAlignVertical: 'top',
  },
  errBox: { backgroundColor: colors.errorBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginTop: 12 },
  errText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.error },
});
