import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const APP_LOGO = require('../../assets/login-logo.png');
const SPLASH_HERO = require('../../assets/splash-hero.png');

const { height: SCREEN_H } = Dimensions.get('window');

type LoadingScreenProps = {
  /** When true, tighter layout for onboarding carousel (slide 1 of 4). */
  embedded?: boolean;
};

/** Stitch LaundryFlow Dashboard — Initial Splash Screen (Alternative); brand from i18n + app logo */
export default function LoadingScreen({ embedded = false }: LoadingScreenProps) {
  const { t } = useTranslation();
  const progressAnim = useRef(new Animated.Value(0.4)).current;

  const brandParts = useMemo(() => {
    const raw = t('mobile.loadingBrand');
    const parts = raw.trim().split(/\s+/);
    if (parts.length >= 2) {
      return { first: parts[0], rest: parts.slice(1).join(' ') };
    }
    return { first: raw, rest: '' };
  }, [t]);

  useEffect(() => {
    const progressLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: false,
        }),
        Animated.timing(progressAnim, {
          toValue: 0.32,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );
    progressLoop.start();
    return () => progressLoop.stop();
  }, [progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['26%', '78%'],
  });

  const heroH = embedded ? Math.min(SCREEN_H * 0.34, 280) : HERO_H;

  return (
    <View style={[styles.root, embedded && styles.rootEmbedded]}>
      <View style={[styles.heroWrap, { height: heroH }]}>
        <ImageBackground source={SPLASH_HERO} style={styles.heroImage} resizeMode="cover">
          <LinearGradient
            colors={['rgba(0, 64, 143, 0.12)', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.45 }}
          />
          <LinearGradient
            colors={['transparent', 'rgba(248, 249, 251, 0.92)', '#f8f9fb']}
            style={[styles.heroBottomFade, { height: heroH * 0.55 }]}
            start={{ x: 0.5, y: 0.35 }}
            end={{ x: 0.5, y: 1 }}
          />
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>{t('mobile.splashSystemOptimized')}</Text>
          </View>
        </ImageBackground>
      </View>

      <View style={[styles.lower, embedded && styles.lowerEmbedded]}>
        <View style={[styles.brandBlock, embedded && styles.brandBlockEmbedded]}>
          <View style={styles.brandRow}>
            <View style={styles.logoShell}>
              <Image source={APP_LOGO} style={styles.logo} resizeMode="contain" />
            </View>
            <View>
              <Text style={styles.brandTitle}>
                <Text style={[styles.brandLaundry, embedded && styles.brandTextEmbedded]}>{brandParts.first}</Text>
                {brandParts.rest ? (
                  <Text style={[styles.brandBill, embedded && styles.brandTextEmbedded]}> {brandParts.rest}</Text>
                ) : null}
              </Text>
              <Text style={[styles.tagline, embedded && styles.taglineEmbedded]}>{t('mobile.loadingTagline')}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.progressWrap, embedded && styles.progressWrapEmbedded]}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
          <View style={styles.progressMeta}>
            <Text style={styles.initLabel}>{t('mobile.splashInitializing')}</Text>
            <View style={styles.dots}>
              <View style={[styles.dot, styles.dotA]} />
              <View style={[styles.dot, styles.dotB]} />
              <View style={[styles.dot, styles.dotC]} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const HERO_H = Math.min(SCREEN_H * 0.46, 420);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8f9fb',
  },
  rootEmbedded: {
    minHeight: 0,
  },
  heroWrap: {
    width: '100%',
    backgroundColor: '#e8eef5',
  },
  heroImage: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-start',
  },
  heroBottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  badge: {
    position: 'absolute',
    top: 48,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#006b5f',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#434654',
    textTransform: 'uppercase',
  },
  lower: {
    flex: 1,
    backgroundColor: '#f8f9fb',
    paddingHorizontal: 36,
    paddingTop: 8,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  lowerEmbedded: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 12,
    flexGrow: 1,
  },
  brandBlock: {
    marginBottom: 36,
  },
  brandBlockEmbedded: {
    marginBottom: 16,
  },
  brandTextEmbedded: {
    fontSize: 24,
  },
  taglineEmbedded: {
    letterSpacing: 1.6,
    marginTop: 4,
  },
  progressWrapEmbedded: {
    marginTop: 8,
    gap: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  /** Match LoginScreen logo tile (blue field + same asset as login) */
  logoShell: {
    width: 48,
    height: 48,
    marginRight: 12,
    borderRadius: 12,
    backgroundColor: '#00408f',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00408f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  logo: {
    width: 32,
    height: 32,
  },
  brandTitle: {
    flexShrink: 1,
  },
  brandLaundry: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#00408f',
  },
  brandBill: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#191c1e',
  },
  tagline: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.4,
    color: '#737685',
    textTransform: 'uppercase',
  },
  progressWrap: {
    width: '100%',
    maxWidth: 300,
    alignSelf: 'center',
    gap: 14,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e1e2e4',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#00408f',
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  initLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: 'rgba(67, 70, 84, 0.65)',
    textTransform: 'uppercase',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 6,
  },
  dotA: {
    backgroundColor: 'rgba(0, 64, 143, 0.45)',
  },
  dotB: {
    backgroundColor: 'rgba(0, 64, 143, 0.25)',
  },
  dotC: {
    backgroundColor: 'rgba(0, 64, 143, 0.12)',
  },
});
