import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, Image } from 'react-native';

const APP_LOGO = require('../../assets/login-logo.png');

export default function LoadingScreen() {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const arrowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );

    const arrowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(arrowAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(arrowAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(arrowAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );

    floatLoop.start();
    pulseLoop.start();
    arrowLoop.start();

    return () => {
      floatLoop.stop();
      pulseLoop.stop();
      arrowLoop.stop();
    };
  }, [arrowAnim, floatAnim, pulseAnim]);

  const floatingStyle = {
    transform: [
      {
        translateY: floatAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -10],
        }),
      },
    ],
  };

  const pulseStyle = {
    opacity: pulseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.8, 0],
    }),
    transform: [
      {
        scale: pulseAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1.4],
        }),
      },
    ],
  };

  const arrowStyle = {
    opacity: arrowAnim.interpolate({
      inputRange: [0, 0.2, 0.8, 1],
      outputRange: [0, 0.9, 0.9, 0],
    }),
    transform: [
      {
        translateX: arrowAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-6, 6],
        }),
      },
    ],
  };

  return (
    <View style={styles.container}>
      <View style={styles.loaderContainer}>
        <Animated.View style={[styles.iconWrapper, floatingStyle]}>
          <Animated.View style={[styles.pulseRing, pulseStyle]} />
          <View style={styles.iconCard}>
            <Image source={APP_LOGO} style={styles.logo} resizeMode="contain" />
          </View>
          <Animated.View style={[styles.arrowOverlay, arrowStyle]}>
            <Text style={styles.arrowText}>↗</Text>
          </Animated.View>
        </Animated.View>

        <Text style={styles.brandName}>Laundry Bill</Text>
        <Text style={styles.tagline}>OPTIMIZING YOUR BUSINESS</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderContainer: {
    alignItems: 'center',
  },
  iconWrapper: {
    width: 100,
    height: 100,
    marginBottom: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderWidth: 2,
    borderColor: '#5eead4',
    borderRadius: 20,
  },
  iconCard: {
    width: 78,
    height: 78,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  logo: {
    width: 54,
    height: 54,
    tintColor: '#ffffff',
  },
  arrowOverlay: {
    position: 'absolute',
    right: -2,
    top: 2,
  },
  arrowText: {
    color: '#5eead4',
    fontSize: 24,
    fontWeight: '800',
  },
  brandName: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tagline: {
    color: '#5eead4',
    fontSize: 12,
    marginTop: 8,
    letterSpacing: 2,
    opacity: 0.85,
  },
});
