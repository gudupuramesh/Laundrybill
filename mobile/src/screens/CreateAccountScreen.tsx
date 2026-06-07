import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii, shadows, spacing } from '../theme';

const APP_LOGO = require('../../assets/login-logo.png');

export default function CreateAccountScreen({
  onBack,
  onCreate,
}: {
  onBack: () => void;
  onCreate: (payload: { email: string; password: string }) => Promise<void> | void;
}) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const handleCreate = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) return alert('Please enter a valid email address.');
    if (!password || password.length < 6) return alert('Password must be at least 6 characters.');
    if (password !== confirmPassword) return alert('Passwords do not match.');
    setLoading(true);
    try {
      await onCreate({ email: normalizedEmail, password });
    } finally {
      setLoading(false);
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
            <Text style={s.appTitle}>Create Account</Text>
            <Text style={s.appSubtitle}>
              Set up your laundry shop account in seconds
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
                  placeholder="Min. 6 characters"
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

            {/* Confirm Password */}
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>CONFIRM PASSWORD</Text>
              <View style={s.inputWrapper}>
                <MaterialIcons name="lock-outline" size={18} color={colors.textSecondary} style={s.inputIcon} />
                <TextInput
                  style={s.inputField}
                  placeholder="Re-enter password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showConfirm}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity
                  style={s.eyeToggle}
                  onPress={() => setShowConfirm((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons
                    name={showConfirm ? 'visibility' : 'visibility-off'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Create Account Button */}
            <TouchableOpacity
              style={s.btnSubmit}
              onPress={handleCreate}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.btnSubmitText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Footer ────────────────────────────────────────── */}
          <View style={s.footer}>
            <Text style={s.footerPrompt}>
              Already have an account?{' '}
              <Text style={s.footerLink} onPress={onBack}>
                Sign In
              </Text>
            </Text>
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
  btnSubmit: {
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
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

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: 24,
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
});
