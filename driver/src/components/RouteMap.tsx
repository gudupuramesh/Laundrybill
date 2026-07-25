/**
 * Route map — an OpenStreetMap raster-tile view auto-zoomed to fit all stops,
 * with the agent's start point, a route polyline through the optimised order,
 * and numbered pins. Keyless (OSM tile CDN) and draws the overlay with
 * react-native-svg, so no native rebuild is needed.
 */
import React, { useState } from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import Svg, { Polyline, Circle, Text as SvgText, G } from 'react-native-svg';
import { colors, fonts, radii } from '../theme';
import { TILE, type LatLng, tilesForView, projectToBox, boundsCenter, fitZoom } from '../lib/osmTiles';

export function RouteMap({
  start,
  stops,
  height = 200,
}: {
  start?: LatLng | null;
  stops: LatLng[];
  height?: number;
}) {
  const [w, setW] = useState(320);

  const all = start ? [start, ...stops] : stops;
  if (!all.length) {
    return (
      <View style={[s.box, { height }]}>
        <Text style={s.empty}>No mapped stops yet</Text>
      </View>
    );
  }

  const center = boundsCenter(all);
  const z = fitZoom(all, w, height);
  const px = (p: LatLng) => projectToBox(p.lat, p.lng, center.lat, center.lng, w, height, z);

  const stopPts = stops.map(px);
  const startPt = start ? px(start) : null;
  const linePts = (startPt ? [startPt, ...stopPts] : stopPts).map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <View style={[s.box, { height }]} onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}>
      {tilesForView(center.lat, center.lng, w, height, z).map((t) => (
        <Image
          key={`${t.left}_${t.top}`}
          source={{ uri: t.uri, headers: { 'User-Agent': 'LaundrybillTeam/1.0' } }}
          style={{ position: 'absolute', left: t.left, top: t.top, width: TILE, height: TILE }}
        />
      ))}

      <Svg width={w} height={height} style={StyleSheet.absoluteFill}>
        {/* Route line: start → stops in optimised order */}
        {stopPts.length > 0 && (
          <Polyline points={linePts} fill="none" stroke={colors.primary} strokeWidth={3} strokeOpacity={0.85} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {/* Agent start marker */}
        {startPt && (
          <G>
            <Circle cx={startPt.x} cy={startPt.y} r={8} fill="#fff" stroke={colors.success} strokeWidth={3} />
            <Circle cx={startPt.x} cy={startPt.y} r={3} fill={colors.success} />
          </G>
        )}
        {/* Numbered stop pins */}
        {stopPts.map((p, i) => (
          <G key={i}>
            <Circle cx={p.x} cy={p.y} r={11} fill={colors.primary} stroke="#fff" strokeWidth={2} />
            <SvgText x={p.x} y={p.y + 4} fontSize={11} fontWeight="bold" fill="#fff" textAnchor="middle">
              {String(i + 1)}
            </SvgText>
          </G>
        ))}
      </Svg>

      <Text style={s.attribution}>© OpenStreetMap</Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted },
  attribution: {
    position: 'absolute',
    right: 6,
    bottom: 4,
    fontFamily: fonts.medium,
    fontSize: 9,
    color: colors.textMuted,
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
});
