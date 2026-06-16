import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { colors, radii } from '../theme';

/**
 * Laundrybill brand mark — white folded shirt + mint-green check/arrow on a
 * deep-navy squircle. Inline SVG (per design.md §3) so there's no image latency.
 */
export function BrandLogo({ size = 44, radius }: { size?: number; radius?: number }) {
  const inner = Math.round(size * 0.66);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? radii.button,
        backgroundColor: colors.darkBlue,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Svg viewBox="0 0 100 100" width={inner} height={inner}>
        <Path
          d="M30,36 L30,76 C30,79 32,82 36,82 L64,82 C68,82 70,79 70,76 L70,36 C70,34 68,32 66,32 L60,32 C58,32 50,30 50,30 C50,30 42,32 40,32 L34,32 C32,32 30,34 30,36 Z"
          fill="none"
          stroke="#ffffff"
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M40,32 L44,46 L50,42 L40,32"
          fill="none"
          stroke="#ffffff"
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M60,32 L56,46 L50,42 L60,32"
          fill="none"
          stroke="#ffffff"
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Line x1={50} y1={46} x2={50} y2={82} stroke="#ffffff" strokeWidth={4.5} strokeLinecap="round" />
        <Path
          d="M26,62 L46,74 L74,40"
          fill="none"
          stroke={colors.mint}
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M58,42 L74,40 L72,56"
          fill="none"
          stroke={colors.mint}
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
