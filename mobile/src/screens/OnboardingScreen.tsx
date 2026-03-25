import React, { useCallback, useRef, useState } from 'react';
import {
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
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';

type Props = {
  onDone: () => void;
};

/** Onboarding slides (billing, tracking, QR). */
export default function OnboardingScreen({ onDone }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowW, height: windowH } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const total = 3;
  const topBarsH = 3 + 52;
  const footerH = 210;
  const slideMinH = Math.max(400, windowH - insets.top - insets.bottom - topBarsH - footerH);

  const goNext = useCallback(() => {
    if (page < total - 1) {
      const next = page + 1;
      scrollRef.current?.scrollTo({ x: next * windowW, animated: true });
      setPage(next);
    } else {
      onDone();
    }
  }, [onDone, page, windowW]);

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      setPage(Math.round(x / windowW));
    },
    [windowW],
  );

  const progressPct = ((page + 1) / total) * 100;

  return (
    <View style={[styles.root, { paddingTop: insets.top, flex: 1 }]}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
      </View>

      <View style={styles.header}>
        <TouchableOpacity onPress={onDone} hitSlop={12} accessibilityRole="button">
          <Text style={styles.skip}>{t('mobile.onboardSkip')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
        bounces={false}
        style={styles.hScroll}
        contentContainerStyle={styles.hScrollContent}
      >
        <SlideBilling windowW={windowW} slideMinH={slideMinH} />
        <SlideTracking windowW={windowW} slideMinH={slideMinH} />
        <SlideQr windowW={windowW} slideMinH={slideMinH} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.dot, i === page ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>

        {page === 0 ? (
          <TouchableOpacity onPress={goNext} activeOpacity={0.9} accessibilityRole="button">
            <View style={styles.ctaPrimary}>
              <Text style={styles.ctaPrimaryText}>{t('mobile.onboardNext')}</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={goNext}
            activeOpacity={0.92}
            style={page === total - 1 ? styles.ctaLastWrap : undefined}
            accessibilityRole="button"
          >
            {page === total - 1 ? (
              <View style={styles.ctaLast}>
                <Text style={styles.ctaLastText}>{t('mobile.onboardGetStarted')}</Text>
                <MaterialIcons name="arrow-forward" size={22} color="#fff" />
              </View>
            ) : (
              <View style={styles.ctaMid}>
                <Text style={styles.ctaMidText}>{t('mobile.onboardNext')}</Text>
                <MaterialIcons name="arrow-forward" size={22} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        )}

        {page === 0 ? (
          <View style={styles.trustRow}>
            <MaterialIcons name="verified-user" size={16} color="#00408f" style={styles.trustIcon} />
            <Text style={styles.trustText}>{t('mobile.onboardEnterpriseSecurity')}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function SlideBilling({ windowW, slideMinH }: { windowW: number; slideMinH: number }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.slide, { width: windowW, minHeight: slideMinH }]}>
      <View style={styles.slideCenter}>
      <View style={styles.illusWrap}>
        <View style={styles.illusGlow} />
        <View style={styles.mockCard}>
          <View style={styles.mockRow}>
            <View style={styles.mockBar} />
            <MaterialIcons name="receipt-long" size={28} color="#0056bd" />
          </View>
          <View style={styles.mockLines}>
            <View style={[styles.mockLine, { width: '100%' }]} />
            <View style={[styles.mockLine, { width: '72%' }]} />
            <View style={styles.mockHighlight}>
              <View style={[styles.mockTiny, { width: 32 }]} />
              <View style={[styles.mockTiny, { width: 48 }]} />
            </View>
          </View>
          <View style={styles.mockSplit}>
            <View style={[styles.mockSplitBox, styles.mockSplitBoxLeft]}>
              <MaterialIcons name="analytics" size={22} color="#006f63" />
            </View>
            <View style={[styles.mockSplitBox, { backgroundColor: 'rgba(125, 82, 0, 0.12)' }]}>
              <MaterialIcons name="account-balance-wallet" size={22} color="#7d5200" />
            </View>
          </View>
        </View>
        <View style={styles.floatingTotal}>
          <Text style={styles.floatingTotalLabel}>Total</Text>
          <Text style={styles.floatingTotalAmt}>₹25000</Text>
        </View>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{t('mobile.onboardBillingTitle')}</Text>
        <Text style={styles.body}>{t('mobile.onboardBillingBody')}</Text>
      </View>
      </View>
    </View>
  );
}

function SlideTracking({ windowW, slideMinH }: { windowW: number; slideMinH: number }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.slide, { width: windowW, minHeight: slideMinH }]}>
      <View style={styles.slideCenter}>
      <View style={[styles.phoneMock, { width: Math.min(windowW - 48, 300) }]}>
        <View style={styles.phoneBar}>
          <Text style={styles.phoneTime}>9:41</Text>
          <View style={styles.phoneIcons}>
            <MaterialIcons name="signal-cellular-alt" size={14} color="rgba(255,255,255,0.9)" />
            <MaterialIcons name="wifi" size={14} color="rgba(255,255,255,0.9)" style={styles.phoneIconSecond} />
          </View>
        </View>
        <View style={styles.phoneHeader}>
          <Text style={styles.phoneOrderId}>ORDER #LB-8821</Text>
          <Text style={styles.phoneSub}>Estimated pickup · Today, 4:30 PM</Text>
        </View>
        <View style={styles.timeline}>
          <View style={styles.tlLine} />
          <TimelineStep done label="Order placed" time="10:45 AM" />
          <TimelineStep done label="Pickup scheduled" time="11:00 AM" />
          <TimelineStep active label="Out for pickup" sub="In progress" />
          <TimelineStep dim label="Processing" time="Pending" />
        </View>
        <View style={styles.waCard}>
          <MaterialIcons name="chat" size={18} color="#25D366" style={styles.waIcon} />
          <Text style={styles.waText} numberOfLines={3}>
            {t('mobile.onboardTrackingBody').split('.')[0]}.
          </Text>
        </View>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{t('mobile.onboardTrackingTitle')}</Text>
        <Text style={styles.body}>{t('mobile.onboardTrackingBody')}</Text>
      </View>
      </View>
    </View>
  );
}

function TimelineStep({
  done,
  active,
  dim,
  label,
  time,
  sub,
}: {
  done?: boolean;
  active?: boolean;
  dim?: boolean;
  label: string;
  time?: string;
  sub?: string;
}) {
  return (
    <View style={[styles.tlRow, dim && styles.tlDim]}>
      <View
        style={[
          styles.tlDot,
          done && styles.tlDotDone,
          active && styles.tlDotActive,
          dim && styles.tlDotDim,
        ]}
      >
        {done ? (
          <MaterialIcons name="check" size={14} color="#fff" />
        ) : active ? (
          <MaterialIcons name="local-laundry-service" size={14} color="#fff" />
        ) : (
          <MaterialIcons name="schedule" size={14} color="#737685" />
        )}
      </View>
      <View style={styles.tlTextCol}>
        <Text style={[styles.tlLabel, active && styles.tlLabelActive]}>{label}</Text>
        {sub ? (
          <Text style={styles.tlSub}>{sub}</Text>
        ) : (
          <Text style={styles.tlTime}>{time}</Text>
        )}
      </View>
    </View>
  );
}

function SlideQr({ windowW, slideMinH }: { windowW: number; slideMinH: number }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.slide, { width: windowW, minHeight: slideMinH }]}>
      <View style={styles.slideCenter}>
      <View style={styles.qrWrap}>
        <View style={styles.qrBack} />
        <View style={styles.qrCard}>
          <View style={styles.qrFrame}>
            <View style={[styles.qrCorner, styles.qrTL]} />
            <View style={[styles.qrCorner, styles.qrTR]} />
            <View style={[styles.qrCorner, styles.qrBL]} />
            <View style={[styles.qrCorner, styles.qrBR]} />
            <MaterialIcons name="qr-code-2" size={88} color="rgba(0, 64, 143, 0.75)" />
          </View>
          <View style={styles.tagPill}>
            <MaterialIcons name="check-circle" size={18} color="#14532d" style={styles.tagPillIcon} />
            <Text style={styles.tagPillText}>Item tagged</Text>
          </View>
        </View>
        <View style={styles.unitCard}>
          <View style={[styles.unitIcon, styles.unitIconSpaced]}>
            <MaterialIcons name="local-laundry-service" size={22} color="#00408f" />
          </View>
          <View>
            <Text style={styles.unitMeta}>Unit ID</Text>
            <Text style={styles.unitId}>WASH-X402</Text>
          </View>
        </View>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{t('mobile.onboardQrTitle')}</Text>
        <Text style={styles.body}>{t('mobile.onboardQrBody')}</Text>
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8f9fb',
  },
  hScroll: {
    flex: 1,
  },
  hScrollContent: {
    flexGrow: 1,
    alignItems: 'stretch',
  },
  progressTrack: {
    height: 3,
    backgroundColor: '#e1e2e4',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00408f',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  skip: {
    fontSize: 15,
    fontWeight: '700',
    color: '#434654',
  },
  slide: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    justifyContent: 'center',
  },
  slideCenter: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  illusWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
    marginBottom: 8,
  },
  illusGlow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 64, 143, 0.08)',
    transform: [{ rotate: '-8deg' }, { scale: 1.05 }],
  },
  mockCard: {
    width: '88%',
    maxWidth: 300,
    backgroundColor: '#fff',
    borderRadius: 4,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(195, 198, 214, 0.35)',
    shadowColor: '#00408f',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
  },
  mockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mockBar: {
    height: 8,
    width: 48,
    backgroundColor: 'rgba(0, 86, 189, 0.2)',
    borderRadius: 2,
  },
  mockLines: {},
  mockLine: {
    height: 14,
    backgroundColor: '#e1e2e4',
    borderRadius: 2,
    marginBottom: 10,
  },
  mockHighlight: {
    height: 36,
    backgroundColor: 'rgba(0, 64, 143, 0.06)',
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginTop: 4,
  },
  mockTiny: {
    height: 8,
    backgroundColor: 'rgba(0, 64, 143, 0.35)',
    borderRadius: 2,
  },
  mockSplit: {
    flexDirection: 'row',
    marginTop: 12,
  },
  mockSplitBox: {
    flex: 1,
    height: 48,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 111, 99, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockSplitBoxLeft: {
    marginRight: 8,
  },
  floatingTotal: {
    position: 'absolute',
    bottom: 4,
    right: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(195, 198, 214, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    alignItems: 'center',
  },
  floatingTotalLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#434654',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  floatingTotalAmt: {
    fontSize: 18,
    fontWeight: '900',
    color: '#00408f',
    letterSpacing: -0.5,
  },
  copy: {
    marginTop: 16,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#191c1e',
    letterSpacing: -0.6,
    lineHeight: 32,
    marginBottom: 10,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#434654',
    textAlign: 'center',
  },
  phoneMock: {
    alignSelf: 'center',
    maxWidth: 300,
    borderRadius: 28,
    borderWidth: 7,
    borderColor: 'rgba(25, 28, 30, 0.06)',
    backgroundColor: '#fff',
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 8,
  },
  phoneBar: {
    backgroundColor: '#0052cc',
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phoneTime: { color: 'rgba(255,255,255,0.95)', fontSize: 10, fontWeight: '800' },
  phoneIcons: { flexDirection: 'row', alignItems: 'center' },
  phoneIconSecond: { marginLeft: 6 },
  phoneHeader: {
    backgroundColor: '#0052cc',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  phoneOrderId: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 8,
  },
  phoneSub: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  timeline: {
    padding: 16,
    paddingBottom: 8,
    position: 'relative',
  },
  tlLine: {
    position: 'absolute',
    left: 27,
    top: 18,
    bottom: 48,
    width: 2,
    backgroundColor: '#c3c6d6',
  },
  tlRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  tlDim: { opacity: 0.45 },
  tlDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    marginRight: 12,
  },
  tlDotDone: { backgroundColor: '#36b37e' },
  tlDotActive: {
    backgroundColor: '#0052cc',
    shadowColor: '#0052cc',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  tlDotDim: {
    backgroundColor: '#edeef0',
    borderWidth: 1,
    borderColor: '#c3c6d6',
  },
  tlTextCol: { flex: 1, paddingTop: 2 },
  tlLabel: { fontSize: 12, fontWeight: '800', color: '#191c1e' },
  tlLabelActive: { color: '#0052cc' },
  tlTime: { fontSize: 10, color: '#737685', marginTop: 2 },
  tlSub: { fontSize: 10, color: '#0052cc', fontWeight: '700', marginTop: 2 },
  waCard: {
    marginHorizontal: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(195, 198, 214, 0.45)',
    borderRadius: 10,
    padding: 10,
  },
  waIcon: { marginRight: 8 },
  waText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 14,
    color: '#434654',
    fontWeight: '600',
  },
  qrWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
    marginBottom: 8,
  },
  qrBack: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 82, 204, 0.06)',
    transform: [{ rotate: '-2deg' }],
  },
  qrCard: {
    width: 280,
    height: 280,
    backgroundColor: '#fff',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
  },
  qrFrame: {
    width: 200,
    height: 200,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(0, 82, 204, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCorner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: '#0052cc',
  },
  qrTL: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  qrTR: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  qrBL: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  qrBR: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },
  tagPill: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  tagPillIcon: { marginRight: 8 },
  tagPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#14532d',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  unitCard: {
    position: 'absolute',
    bottom: -8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  unitIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 64, 143, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitIconSpaced: { marginRight: 10 },
  unitMeta: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  unitId: { fontSize: 13, fontWeight: '800', color: '#1e293b' },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#f8f9fb',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    marginHorizontal: 4,
  },
  dotActive: {
    width: 28,
    backgroundColor: '#00408f',
  },
  dotInactive: {
    width: 6,
    backgroundColor: '#c3c6d6',
  },
  ctaPrimary: {
    backgroundColor: '#00408f',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    shadowColor: '#00408f',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
  },
  ctaPrimaryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  ctaMid: {
    backgroundColor: '#00408f',
    paddingVertical: 16,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00408f',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
  },
  ctaMidText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    marginRight: 8,
  },
  ctaLastWrap: {
    width: '100%',
  },
  ctaLast: {
    backgroundColor: '#00408f',
    paddingVertical: 16,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00408f',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
  },
  ctaLastText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginRight: 8,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  trustIcon: { marginRight: 8 },
  trustText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#434654',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
