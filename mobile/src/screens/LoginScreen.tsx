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
import { sendPasswordReset, signInWithApple, signInWithEmailPassword, signInWithGoogle, signInWithGoogleIdToken } from '../lib/auth';
import * as Google from 'expo-auth-session/providers/google';
import { colors, fonts, radii, shadows, spacing } from '../theme';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '285945951840-91cmr666jkghgdd234p0h2607gphr2g7.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID;
const APP_LOGO = require('../../assets/login-logo.png');

const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://laundrybill.com/terms';
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://laundrybill.com/privacy-policy';

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
  const [showPassword, setShowPassword] = useState(false);
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
            alert('Google sign-in failed. Please try again.');
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
      alert('Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    try {
      setLoading(true);
      await signInWithApple();
      // Auth state listener in App.tsx handles navigation on success.
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg === 'APPLE_SIGNIN_CANCELLED') return; // user dismissed — silent
      if (msg === 'APPLE_SIGNIN_UNAVAILABLE') {
        alert('Apple sign-in is not available on this device.');
        return;
      }
      console.error('Apple sign-in error:', e);
      alert('Apple sign-in failed. Please try again.');
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
      alert('Enter your email first, then tap Forgot Password.');
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
    <View style={[s.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Logo & Title ──────────────────────────────────── */}
          <View style={s.headerLogo}>
            <View style={s.logoBadge}>
              {!logoError ? (
                <Image source={APP_LOGO} style={s.logoImage} resizeMode="contain" onError={() => setLogoError(true)} />
              ) : (
                <MaterialIcons name="local-laundry-service" size={38} color="#fff" />
              )}
            </View>
            <Text style={s.appTitle}>Laundry Bill</Text>
            <Text style={s.appSubtitle}>
              Log in to manage your laundry shop orders, finances & customers
            </Text>
          </View>

          {/* ── Form Card ─────────────────────────────────────── */}
          <View style={s.formCard}>
            {/* Email */}
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>EMAIL ADDRESS</Text>
              <View style={s.inputWrapper}>
                <MaterialIcons name="mail-outline" size={18} color={colors.textSecondary} style={s.inputIcon} />
                <TextInput
                  style={s.inputField}
                  placeholder="name@laundryshop.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            {/* Password */}
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>PASSWORD</Text>
              <View style={s.inputWrapper}>
                <MaterialIcons name="lock-outline" size={18} color={colors.textSecondary} style={s.inputIcon} />
                <TextInput
                  style={s.inputField}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  style={s.eyeToggle}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons
                    name={showPassword ? 'visibility' : 'visibility-off'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity onPress={handleForgotPassword} disabled={loading} style={s.forgotRow}>
              <Text style={s.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Sign In Button */}
            <TouchableOpacity
              style={s.btnSubmit}
              onPress={handleEmailLogin}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.btnSubmitText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* OR Divider */}
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>OR</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Social Buttons */}
            <View style={s.socialGrid}>
              <TouchableOpacity
                style={s.btnGoogle}
                onPress={handleGoogleLogin}
                disabled={loading}
                activeOpacity={0.9}
              >
                <Ionicons name="logo-google" size={18} color="#4285F4" />
                <Text style={s.btnGoogleText}>Google</Text>
              </TouchableOpacity>

              {Platform.OS === 'ios' ? (
                <TouchableOpacity
                  style={s.btnApple}
                  onPress={handleAppleLogin}
                  disabled={loading}
                  activeOpacity={0.9}
                >
                  <MaterialIcons name="apple" size={18} color="#fff" />
                  <Text style={s.btnAppleText}>Apple</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={s.btnGoogle}
                  onPress={onOpenCreateAccount}
                  disabled={loading}
                  activeOpacity={0.9}
                >
                  <MaterialIcons name="person-add" size={18} color={colors.primary} />
                  <Text style={s.btnGoogleText}>Sign Up</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── Footer ────────────────────────────────────────── */}
          <View style={s.footer}>
            <Text style={s.footerPrompt}>
              Don't have an account?{' '}
              <Text style={s.footerLink} onPress={onOpenCreateAccount}>
                Sign Up
              </Text>
            </Text>
            <View style={s.footerLegalRow}>
              <TouchableOpacity onPress={() => openLegal(TERMS_URL)} hitSlop={8}>
                <Text style={s.legalLink}>Terms</Text>
              </TouchableOpacity>
              <Text style={s.legalDot}>·</Text>
              <TouchableOpacity onPress={() => openLegal(PRIVACY_URL)} hitSlop={8}>
                <Text style={s.legalLink}>Privacy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },

  // Logo header
  headerLogo: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 0,
  },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#0C2340',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  logoImage: {
    width: 48,
    height: 48,
  },
  appTitle: {
    fontSize: 26,
    fontFamily: fonts.extrabold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 24,
    lineHeight: 18,
  },

  // Form card
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginTop: -10,
    gap: 16,
    shadowColor: '#141E3C',
    shadowOpacity: 0.05,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    height: 50,
  },
  inputIcon: {
    marginLeft: 14,
  },
  inputField: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.text,
    paddingHorizontal: 12,
    height: '100%',
  },
  eyeToggle: {
    paddingHorizontal: 14,
    height: '100%',
    justifyContent: 'center',
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: -8,
  },
  forgotText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  btnSubmit: {
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  btnSubmitText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: '#fff',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: 12,
  },
  socialGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  btnGoogle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnGoogleText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  btnApple: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    backgroundColor: '#000',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#000',
  },
  btnAppleText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: '#fff',
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: 24,
    gap: 12,
  },
  footerPrompt: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
  },
  footerLink: {
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  footerLegalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legalLink: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
  },
  legalDot: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
