import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Animated, Easing } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signInWithGoogle, signInWithGoogleIdToken } from '../lib/auth';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '285945951840-91cmr666jkghgdd234p0h2607gphr2g7.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID;
const APP_LOGO = require('../../assets/login-logo.png');

export default function LoginScreen({
  onGetOtp
}: {
  onGetOtp: (phone: string) => Promise<void> | void
}) {
  const insets = useSafeAreaInsets();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const logoFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(logoFloat, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [logoFloat]);

  // Expo Go Google Sign-In via expo-auth-session
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    // Android client ID (from google-services.json type 1)
    androidClientId: GOOGLE_WEB_CLIENT_ID,
    // iOS is required by expo-auth-session on iOS
    iosClientId: GOOGLE_IOS_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params?.id_token || response.authentication?.idToken;
      if (idToken) {
        setLoading(true);
        signInWithGoogleIdToken(idToken)
          .catch((e) => {
            console.error('Google credential sign-in error:', e);
            alert('Failed to sign in with Google');
          })
          .finally(() => setLoading(false));
      }
    }
  }, [response]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch (e: any) {
      if (e?.message === 'EXPO_GO_GOOGLE_SIGNIN') {
        // Fallback: use expo-auth-session hook
        setLoading(false);
        promptAsync();
        return;
      }
      console.error(e);
      alert('Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    try {
      setLoading(true);
      // Apple sign-in logic will go here
      alert('Apple Sign-In coming soon!');
    } catch (e) {
      console.error(e);
      alert('Failed to sign in with Apple');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneLogin = async () => {
    if (!phoneNumber || phoneNumber.length < 10) return alert('Enter a valid 10-digit number');
    setLoading(true);
    await onGetOtp(phoneNumber);
    setLoading(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Decorative Background Blobs - Spread out for full width */}
      <View style={styles.bgBlobTopRight} />
      <View style={styles.bgBlobBottomLeft} />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={styles.innerContainer}>
            {/* Top Visual Section */}
            <View style={styles.headerSection}>
              <Animated.View
                style={[
                  styles.logoWrapper,
                  {
                    transform: [
                      {
                        translateY: logoFloat.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -6],
                        }),
                      },
                      {
                        rotate: logoFloat.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '1.5deg'],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.logoContainer}>
                  {!logoError ? (
                    <Image
                      source={APP_LOGO}
                      style={styles.logoImage}
                      resizeMode="contain"
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <MaterialIcons name="local-laundry-service" size={34} color="#ffffff" />
                  )}
                </View>
                {/* Decorative rings around logo */}
                <View style={styles.logoRing1} />
                <View style={styles.logoRing2} />
              </Animated.View>
              <Text style={styles.title}>Laundrybill</Text>
              <Text style={styles.subtitle}>Smart operations made simple</Text>
            </View>

            {/* Form Section */}
            <View style={styles.formSection}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>MOBILE NUMBER</Text>
                <View style={styles.inputContainer}>
                  <View style={styles.countryCode}>
                    <Text style={styles.countryCodeText}>+91</Text>
                  </View>
                  <TextInput 
                    style={styles.input}
                    placeholder="10-digit number"
                    placeholderTextColor="rgba(67, 70, 84, 0.5)"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                  />
                </View>
              </View>

              <TouchableOpacity 
                style={styles.primaryBtn}
                onPress={handlePhoneLogin}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryBtnText}>Get OTP</Text>}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Social Login */}
              <TouchableOpacity style={styles.socialBtn} onPress={handleGoogleLogin} disabled={loading}>
                <Image 
                  source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA8vu4Be9KgVGkh6tONtT79olHMwLVauHnCicaG5VoD8PZc1R1px38GE5az31uJ_Vt_6pdDNooMg0QTplxF753G1E9BzVbQOXptRaT6KLu8KbqxJDHApj1rpDh3o-co7xtb2Y68iCcMCYGt_AXjSjfykF8SGZ_7wuhbYz3ayC-fb349iG-DXVF46CmZSyHYJEnhL4J5AjBN1AJzssK90D9plpW9ptCwPTCN_b7e52tsAT-zhYXoxF-OdZmo19xh-RTJWFbqWqv1DtQ' }} 
                  style={styles.socialIcon}
                />
                <Text style={styles.socialBtnText}>Continue with Google</Text>
              </TouchableOpacity>

              {/* Apple Login (iOS Only) */}
              {Platform.OS === 'ios' && (
                <TouchableOpacity style={styles.socialBtn} onPress={handleAppleLogin} disabled={loading}>
                  <MaterialIcons name="apple" size={24} color="#000000" />
                  <Text style={styles.socialBtnText}>Continue with Apple</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Legal Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By continuing, you agree to our <Text style={styles.footerLink}>Terms</Text> and <Text style={styles.footerLink}>Privacy Policy</Text>
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  bgBlobTopRight: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(0, 86, 189, 0.04)', // primary-container dim
  },
  bgBlobBottomLeft: {
    position: 'absolute',
    bottom: -150,
    left: -150,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(118, 244, 224, 0.08)', // secondary-container dim
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  innerContainer: {
    flex: 1,
  },
  headerSection: {
    paddingTop: 24,
    paddingBottom: 8,
    alignItems: 'center',
    zIndex: 10,
  },
  logoWrapper: {
    position: 'relative',
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  logoRing1: {
    position: 'absolute',
    width: 82,
    height: 82,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(0, 64, 143, 0.1)',
  },
  logoRing2: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: 'rgba(0, 64, 143, 0.05)',
  },
  logoContainer: {
    width: 68,
    height: 68,
    backgroundColor: '#00408f',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00408f',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    zIndex: 2,
  },
  logoImage: {
    width: 46,
    height: 46,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#00408f',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 4,
  },
  formSection: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#191c1e',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    height: 52,
    backgroundColor: '#f8f9fb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(195, 198, 214, 0.4)',
    overflow: 'hidden',
  },
  countryCode: {
    paddingHorizontal: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(195, 198, 214, 0.3)',
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#191c1e',
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#191c1e',
    paddingHorizontal: 16,
    letterSpacing: 1,
  },
  primaryBtn: {
    height: 50,
    backgroundColor: '#00408f',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00408f',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(195, 198, 214, 0.4)',
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#737685',
    letterSpacing: 1,
  },
  socialBtn: {
    height: 50,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(195, 198, 214, 0.5)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  socialIcon: {
    width: 24,
    height: 24,
  },
  socialBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#191c1e',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 14,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    color: '#737685',
    textAlign: 'center',
    lineHeight: 16,
  },
  footerLink: {
    fontWeight: '700',
    color: '#00408f',
  },
});
