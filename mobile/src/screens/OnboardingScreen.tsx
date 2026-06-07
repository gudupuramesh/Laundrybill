import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  ImageBackground,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, radii, shadows } from '../theme';

// Onboarding images from HTML mockup
const SLIDE_IMAGES = [
  require('../../assets/onboarding-1.jpg'),
  require('../../assets/onboarding-2.jpg'),
  require('../../assets/onboarding-3.jpg'),
];

const SLIDES = [
  {
    image: SLIDE_IMAGES[0],
    title: 'Smart Laundry\nManagement',
    desc: 'Create orders, choose wash services, edit item pricing, and track pickup timings seamlessly.',
  },
  {
    image: SLIDE_IMAGES[1],
    title: 'Outstanding Dues &\nFinances',
    desc: 'Log collections and expense tabs. Keep a real-time count of customer dues and pending payments.',
  },
  {
    image: SLIDE_IMAGES[2],
    title: 'Know Your\nCustomers',
    desc: 'Keep customer details, average order value, preferences, notes, and profile details at your fingertips.',
  },
];

type Props = {
  onDone: () => void;
};

export default function OnboardingScreen({ onDone }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const total = SLIDES.length;
  const isLast = page === total - 1;

  const goToPage = useCallback((idx: number) => {
    scrollRef.current?.scrollTo({ x: idx * screenW, animated: true });
    setPage(idx);
  }, [screenW]);

  const goNext = useCallback(() => {
    if (isLast) {
      onDone();
    } else {
      goToPage(page + 1);
    }
  }, [isLast, onDone, page, goToPage]);

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      setPage(Math.round(x / screenW));
    },
    [screenW],
  );

  return (
    <View style={s.root}>
      {/* ── Slides ─────────────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
        bounces={false}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={{ width: screenW, height: screenH }}>
            <ImageBackground
              source={slide.image}
              style={s.slideImage}
              resizeMode="cover"
            >
              {/* Dark gradient overlay — stronger at bottom for text readability */}
              <LinearGradient
                colors={['rgba(15,30,54,0.15)', 'rgba(15,30,54,0.55)', 'rgba(15,30,54,0.92)'] as const}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFillObject}
              />

              {/* Skip button top-right */}
              <View style={[s.skipRow, { paddingTop: insets.top + 12 }]}>
                <TouchableOpacity
                  style={s.skipBtn}
                  onPress={onDone}
                  activeOpacity={0.8}
                >
                  <Text style={s.skipText}>Skip</Text>
                </TouchableOpacity>
              </View>

              {/* Spacer to push text down */}
              <View style={{ flex: 1 }} />

              {/* Slide text at bottom */}
              <View style={s.slideTextWrap}>
                <Text style={s.slideTitle}>{slide.title}</Text>
                <Text style={s.slideDesc}>{slide.desc}</Text>
              </View>
            </ImageBackground>
          </View>
        ))}
      </ScrollView>

      {/* ── Bottom Action Panel ────────────────────────────────── */}
      <View style={[s.actionPanel, { paddingBottom: insets.bottom + 16 }]}>
        {/* Skip (left) */}
        <TouchableOpacity onPress={onDone} style={s.actionSkip} activeOpacity={0.8}>
          <Text style={s.actionSkipText}>Skip</Text>
        </TouchableOpacity>

        {/* Dots (center) */}
        <View style={s.dotsRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                s.dot,
                i === page ? s.dotActive : s.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* Next / Get Started (right) */}
        <TouchableOpacity
          style={s.nextBtn}
          onPress={goNext}
          activeOpacity={0.9}
        >
          <Text style={s.nextBtnText}>{isLast ? 'Get Started' : 'Next'}</Text>
          <MaterialIcons
            name={isLast ? 'check' : 'arrow-forward'}
            size={18}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F1E36',
  },

  // Slide
  slideImage: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  skipRow: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  skipBtn: {
    backgroundColor: 'rgba(15,30,54,0.4)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  skipText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontFamily: fonts.bold,
  },
  slideTextWrap: {
    paddingHorizontal: 32,
    paddingBottom: 120, // space for action panel
    alignItems: 'center',
  },
  slideTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontFamily: fonts.extrabold,
    lineHeight: 34,
    textAlign: 'center',
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  slideDesc: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 15,
    fontFamily: fonts.semibold,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 8,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Action panel
  actionPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    zIndex: 20,
  },
  actionSkip: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    minWidth: 50,
  },
  actionSkipText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: 'rgba(255,255,255,0.75)',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    transition: 'width 0.3s',
  },
  dotActive: {
    width: 20,
    backgroundColor: '#FFFFFF',
  },
  dotInactive: {
    width: 8,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: 'rgba(255,255,255,0.15)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  nextBtnText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
});
