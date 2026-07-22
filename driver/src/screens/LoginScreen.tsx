import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { useDriverAuth } from '../lib/DriverAuthContext';
import { sendPasswordReset } from '../lib/auth';

// Same logo the owner app uses on its login screen — keeps the two apps visually consistent.
const APP_LOGO = require('../../assets/login-logo.png');

type Mode = 'login' | 'signup';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp, loading, error } = useDriverAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [forgot, setForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const submit = async () => {
    setLocalError(null);
    if (!email.trim() || !password.trim()) {
      setLocalError('Please fill in all fields');
      return;
    }
    if (mode === 'signup' && !inviteCode.trim()) {
      setLocalError('Invite code is required');
      return;
    }
    try {
      if (mode === 'signup') await signUp(email, password, inviteCode);
      else await signIn(email, password);
    } catch {
      /* error surfaced via context */
    }
  };

  const submitReset = async () => {
    setResetError(null);
    const emailTrim = email.trim();
    if (!emailTrim) {
      setResetError('Please enter your email address');
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordReset(emailTrim);
      setResetSent(true);
    } catch (err: any) {
      if (err?.code === 'auth/user-not-found') setResetError('No account found with this email');
      else if (err?.code === 'auth/invalid-email') setResetError('Please enter a valid email address');
      else setResetError(err?.message || 'Could not send reset email');
    } finally {
      setResetLoading(false);
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
            <Text style={s.appTitle}>Laundrybill Team</Text>
            <Text style={s.appSubtitle}>
              {forgot
                ? 'Reset your password to get back in'
                : mode === 'signup'
                  ? 'Enter your invite code to join your shop team'
                  : 'Sign in to start your shift — staff, delivery & plant'}
            </Text>
          </View>

          {/* ── Form Card ─────────────────────────────────────── */}
          {forgot ? (
            <View style={s.formCard}>
              <Text style={s.cardTitle}>Forgot password?</Text>
              <Text style={s.hint}>Enter your email and we&apos;ll send you a link to reset your password.</Text>
              {resetSent ? (
                <>
                  <View style={s.okBox}>
                    <Text style={s.okText}>Check your email for a reset link. If you don&apos;t see it, check spam.</Text>
                  </View>
                  <TouchableOpacity
                    style={s.btnSubmit}
                    onPress={() => { setForgot(false); setResetSent(false); }}
                    activeOpacity={0.9}
                  >
                    <Text style={s.btnSubmitText}>Back to login</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {resetError ? <ErrorBox message={resetError} /> : null}
                  <View style={s.inputGroup}>
                    <Text style={s.inputLabel}>EMAIL ADDRESS</Text>
                    <View style={s.inputWrapper}>
                      <MaterialIcons name="mail-outline" size={18} color={colors.textSecondary} style={s.inputIcon} />
                      <TextInput
                        style={s.inputField}
                        placeholder="you@example.com"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        value={email}
                        onChangeText={setEmail}
                      />
                    </View>
                  </View>
                  <View style={s.rowGap}>
                    <TouchableOpacity
                      style={[s.btnSecondary, { flex: 1 }]}
                      onPress={() => { setForgot(false); setResetError(null); }}
                      activeOpacity={0.9}
                    >
                      <Text style={s.btnSecondaryText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.btnSubmit, { flex: 1 }]}
                      onPress={submitReset}
                      disabled={resetLoading}
                      activeOpacity={0.9}
                    >
                      {resetLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnSubmitText}>Send link</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          ) : (
            <View style={s.formCard}>
              {/* Login / Sign up switcher */}
              <View style={s.tabs}>
                <Tab label="Login" active={mode === 'login'} onPress={() => { setMode('login'); setLocalError(null); }} />
                <Tab label="Sign up" active={mode === 'signup'} onPress={() => { setMode('signup'); setLocalError(null); }} />
              </View>

              {mode === 'signup' && (
                <View style={s.inputGroup}>
                  <Text style={s.inputLabel}>INVITE CODE</Text>
                  <View style={s.inputWrapper}>
                    <MaterialIcons name="vpn-key" size={18} color={colors.textSecondary} style={s.inputIcon} />
                    <TextInput
                      style={s.inputField}
                      placeholder="XXXX-00000"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      value={inviteCode}
                      onChangeText={(v) => setInviteCode(v.toUpperCase())}
                    />
                  </View>
                </View>
              )}

              <View style={s.inputGroup}>
                <Text style={s.inputLabel}>EMAIL ADDRESS</Text>
                <View style={s.inputWrapper}>
                  <MaterialIcons name="mail-outline" size={18} color={colors.textSecondary} style={s.inputIcon} />
                  <TextInput
                    style={s.inputField}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
              </View>

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
                    <MaterialIcons name={showPassword ? 'visibility' : 'visibility-off'} size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              {localError || error ? <ErrorBox message={localError || error || ''} /> : null}

              <TouchableOpacity style={s.btnSubmit} onPress={submit} disabled={loading} activeOpacity={0.9}>
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.btnSubmitText}>{mode === 'login' ? 'Sign In' : 'Create account'}</Text>
                )}
              </TouchableOpacity>

              {mode === 'login' && (
                <TouchableOpacity onPress={() => setForgot(true)} style={s.forgotRow}>
                  <Text style={s.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              )}
              <Text style={s.help}>
                {mode === 'signup'
                  ? 'Enter the invite code given by your shop admin'
                  : 'Use the credentials you created during signup'}
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.tab, active && s.tabActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <View style={s.errBox}>
      <Text style={s.errText}>{message}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 24 },

  // Logo header (centered) — mirrors the owner app.
  headerLogo: { alignItems: 'center', marginBottom: 4 },
  logoBadge: {
    width: 76, height: 76, borderRadius: 22, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    shadowColor: '#0C2340', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  logoImage: { width: 48, height: 48 },
  appTitle: { fontSize: 26, fontFamily: fonts.extrabold, color: colors.text, letterSpacing: -0.5 },
  appSubtitle: {
    fontSize: 13, fontFamily: fonts.semibold, color: colors.textSecondary,
    textAlign: 'center', marginTop: 4, paddingHorizontal: 20, lineHeight: 18,
  },

  // Form card
  formCard: {
    backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    padding: 20, marginTop: 20, gap: 16,
    shadowColor: '#141E3C', shadowOpacity: 0.05, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  cardTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  hint: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: -8 },

  tabs: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9 },
  tabActive: { backgroundColor: colors.surface, shadowColor: '#141E3C', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tabText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textMuted },
  tabTextActive: { color: colors.primary },

  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 0.6, textTransform: 'uppercase' },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceMuted,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border, height: 50,
  },
  inputIcon: { marginLeft: 14 },
  inputField: { flex: 1, fontSize: 15, fontFamily: fonts.semibold, color: colors.text, paddingHorizontal: 12, height: '100%' },
  eyeToggle: { paddingHorizontal: 14, height: '100%', justifyContent: 'center' },

  btnSubmit: {
    height: 50, backgroundColor: colors.primary, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  btnSubmitText: { fontSize: 15, fontFamily: fonts.bold, color: '#fff' },
  btnSecondary: {
    height: 50, backgroundColor: colors.surface, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  btnSecondaryText: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },

  forgotRow: { alignSelf: 'center', marginTop: -6 },
  forgotText: { fontSize: 13, fontFamily: fonts.bold, color: colors.primary },
  help: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: -4 },
  rowGap: { flexDirection: 'row', gap: 10 },

  errBox: { backgroundColor: colors.errorBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  errText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.error },
  okBox: { backgroundColor: colors.successBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  okText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.success },
});
