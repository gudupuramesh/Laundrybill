import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { sendPasswordReset, signInWithEmailPassword, signInWithGoogle, signInWithGoogleIdToken } from '../lib/auth';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '285945951840-91cmr666jkghgdd234p0h2607gphr2g7.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID;
const APP_LOGO = require('../../assets/login-logo.png');

/** Login UI is fixed English regardless of app language (product requirement). */
const L = {
  brandName: 'LaundryBill',
  headline: 'Empowering your laundry business',
  subheadline: 'Sign in to orchestrate your operations.',
  mobileLabel: 'MOBILE NUMBER',
  placeholder: '00000 00000',
  getOtp: 'Get OTP',
  orContinue: 'OR CONTINUE WITH',
  continueGoogle: 'Continue with Google',
  continueApple: 'Continue with Apple',
  forgotPassword: 'Forgot password?',
  trustedTitle: 'TRUSTED BY 2,400+ SHOPS',
  trustedSubtitle: 'Processing 50k+ orders daily.',
  trustedPlus: '+2k',
  terms: 'TERMS OF SERVICE',
  privacy: 'PRIVACY POLICY',
  copyright: '© 2024 LaundryBill Technologies. All rights reserved.',
  version: 'High-Density Operational Interface v2.4.0',
  invalidPhone: 'Please enter a valid 10-digit mobile number.',
  googleFailed: 'Google sign-in failed. Please try again.',
  appleSoon: 'Apple sign-in is coming soon.',
  appleFailed: 'Apple sign-in failed. Please try again.',
} as const;

/** Each link opens only its document (not the homepage). Override via env if your site uses different paths. */
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://laundrybill.com/terms';
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://laundrybill.com/privacy-policy';

/** Georgia reads reliably on iOS; Android `serif` can be missing on some OEM builds and break Text layout. */
const labelSerif = Platform.OS === 'ios' ? { fontFamily: 'Georgia' as const } : {};

export default function LoginScreen({
  onEmailSignIn,
  onOpenCreateAccount,
}: {
  onEmailSignIn?: (email: string) => Promise<void> | void;
  onOpenCreateAccount?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const [googleAuthRequest, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_WEB_CLIENT_ID,
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
            alert(L.googleFailed);
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
        setLoading(false);
        if (!googleAuthRequest) {
          alert('Google sign-in is still loading. Please try again in a moment.');
          return;
        }
        void promptAsync();
        return;
      }
      console.error(e);
      alert(L.googleFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    try {
      setLoading(true);
      alert(L.appleSoon);
    } catch (e) {
      console.error(e);
      alert(L.appleFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailPassword(normalizedEmail, password);
      await onEmailSignIn?.(normalizedEmail);
    } catch (e: any) {
      alert(e?.message || 'Email sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      alert('Enter your email first, then tap Forgot password.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordReset(normalizedEmail);
      alert('Password reset link sent to your email.');
    } catch (e: any) {
      alert(e?.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const openLegal = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      void Linking.openURL(url);
    }
  };

  return (
    <View style={[styles.screenRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.gradientTopWash} pointerEvents="none" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex1}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.pad}>
            <View style={styles.brandRow}>
              <View style={styles.logoContainer}>
                {!logoError ? (
                  <Image source={APP_LOGO} style={styles.logoImage} resizeMode="contain" onError={() => setLogoError(true)} />
                ) : (
                  <MaterialIcons name="local-laundry-service" size={30} color="#ffffff" />
                )}
              </View>
              <Text style={[styles.brandName, styles.brandNameSpaced]}>{L.brandName}</Text>
            </View>

            <Text style={styles.headline}>{L.headline}</Text>
            <Text style={styles.subheadline}>{L.subheadline}</Text>

            <View style={styles.formBlock}>
              <Text style={[labelSerif, styles.inputLabel]}>EMAIL</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  placeholderTextColor="rgba(67, 70, 84, 0.38)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="rgba(67, 70, 84, 0.38)"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
              <TouchableOpacity onPress={handleForgotPassword} disabled={loading} style={styles.forgotBtn} hitSlop={8}>
                <Text style={styles.forgotText}>{L.forgotPassword}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleEmailLogin} disabled={loading} activeOpacity={0.9}>
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <View style={styles.primaryBtnInner}>
                    <Text style={styles.primaryBtnText}>Sign In</Text>
                    <MaterialIcons name="arrow-forward" size={20} color="#ffffff" />
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.socialBtn, styles.socialBtnGap]} onPress={onOpenCreateAccount} disabled={loading} activeOpacity={0.92}>
                <MaterialIcons name="mail" size={20} color="#00408f" style={styles.socialIconPad} />
                <Text style={[labelSerif, styles.socialBtnText]}>Create account</Text>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={[labelSerif, styles.dividerText]}>{L.orContinue}</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity style={[styles.socialBtn, styles.socialBtnGap]} onPress={handleGoogleLogin} disabled={loading} activeOpacity={0.92}>
                <Ionicons name="logo-google" size={22} color="#4285F4" style={styles.socialIconPad} />
                <Text style={[labelSerif, styles.socialBtnText]}>{L.continueGoogle}</Text>
              </TouchableOpacity>

              {Platform.OS === 'ios' && (
                <TouchableOpacity style={styles.socialBtn} onPress={handleAppleLogin} disabled={loading} activeOpacity={0.92}>
                  <MaterialIcons name="apple" size={24} color="#000000" style={styles.socialIconPad} />
                  <Text style={[labelSerif, styles.socialBtnText]}>{L.continueApple}</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.trustBanner}>
              <View style={styles.avatarRow}>
                {['#f59e0b', '#3b82f6', '#a855f7'].map((bg, i) => (
                  <View key={bg} style={[styles.avatar, { backgroundColor: bg, marginLeft: i === 0 ? 0 : -10 }]} />
                ))}
                <View style={[styles.avatar, styles.plusAvatar, { marginLeft: -10 }]}>
                  <Text style={styles.plusAvatarText}>{L.trustedPlus}</Text>
                </View>
              </View>
              <View style={styles.trustCopy}>
                <Text style={styles.trustTitle}>{L.trustedTitle}</Text>
                <Text style={styles.trustSub}>{L.trustedSubtitle}</Text>
              </View>
            </View>

            <View style={styles.footer}>
              <View style={styles.footerLinks}>
                <TouchableOpacity onPress={() => openLegal(TERMS_URL)} hitSlop={8}>
                  <Text style={[labelSerif, styles.footerLink]}>{L.terms}</Text>
                </TouchableOpacity>
                <Text style={[styles.footerDot, styles.footerDotPad]}>·</Text>
                <TouchableOpacity onPress={() => openLegal(PRIVACY_URL)} hitSlop={8}>
                  <Text style={[labelSerif, styles.footerLink]}>{L.privacy}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.footerMeta}>{L.copyright}</Text>
              <Text style={styles.footerVersion}>{L.version}</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: '#f8faff',
    overflow: 'hidden',
  },
  flex1: {
    flex: 1,
  },
  gradientTopWash: {
    ...StyleSheet.absoluteFillObject,
    height: '55%',
    backgroundColor: '#dbe8ff',
    opacity: 0.55,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  pad: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    width: 48,
    height: 48,
    backgroundColor: '#00408f',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00408f',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  logoImage: {
    width: 32,
    height: 32,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#00408f',
    letterSpacing: -0.3,
  },
  brandNameSpaced: {
    marginLeft: 12,
  },
  headline: {
    fontSize: 26,
    fontWeight: '800',
    color: '#191c1e',
    letterSpacing: -0.6,
    lineHeight: 32,
    marginBottom: 8,
  },
  subheadline: {
    fontSize: 15,
    fontWeight: '500',
    color: '#434654',
    lineHeight: 22,
    marginBottom: 28,
  },
  formBlock: {
    marginTop: 0,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#737685',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginLeft: 2,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    height: 54,
    marginBottom: 14,
    backgroundColor: 'rgba(241, 245, 249, 0.95)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(195, 198, 214, 0.45)',
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#191c1e',
    paddingHorizontal: 14,
    letterSpacing: 0.5,
  },
  primaryBtn: {
    height: 52,
    marginBottom: 14,
    backgroundColor: '#00408f',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00408f',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: 12,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00408f',
  },
  primaryBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.8,
    marginRight: 10,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148, 163, 184, 0.55)',
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#737685',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    paddingHorizontal: 12,
  },
  socialBtn: {
    minHeight: 52,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(195, 198, 214, 0.55)',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  socialBtnGap: {
    marginBottom: 14,
  },
  socialIconPad: {
    marginRight: 12,
  },
  socialBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#191c1e',
  },
  trustBanner: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(241, 245, 249, 0.9)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 14,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  plusAvatar: {
    backgroundColor: '#14532d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusAvatarText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  trustCopy: {
    flex: 1,
    minWidth: 0,
  },
  trustTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#191c1e',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  trustSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 4,
  },
  footer: {
    marginTop: 28,
    alignItems: 'center',
    paddingBottom: 8,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  footerLink: {
    fontSize: 10,
    fontWeight: '600',
    color: '#737685',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  footerDot: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '700',
  },
  footerDotPad: {
    marginHorizontal: 8,
  },
  footerMeta: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 16,
  },
  footerVersion: {
    fontSize: 10,
    color: '#cbd5e1',
    marginTop: 6,
    textAlign: 'center',
  },
});
