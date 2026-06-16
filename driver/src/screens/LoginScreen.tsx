import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { BrandLogo } from '../components/BrandLogo';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { useDriverAuth } from '../lib/DriverAuthContext';
import { sendPasswordReset } from '../lib/auth';

type Mode = 'login' | 'signup';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp, loading, error } = useDriverAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
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
      // Team app serves all roles (agent/staff/manager/plant) — send the reset
      // directly; Firebase only delivers it to a registered account.
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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <BrandLogo size={64} radius={18} />
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to start your shift</Text>
        </View>

        {forgot ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Forgot password?</Text>
            <Text style={styles.hint}>
              Enter your email and we&apos;ll send you a link to reset your password.
            </Text>
            {resetSent ? (
              <>
                <View style={styles.okBox}>
                  <Text style={styles.okText}>
                    Check your email for a reset link. If you don&apos;t see it, check spam.
                  </Text>
                </View>
                <Button
                  label="Back to login"
                  variant="tint"
                  icon="arrow-back"
                  onPress={() => {
                    setForgot(false);
                    setResetSent(false);
                  }}
                />
              </>
            ) : (
              <>
                {resetError ? <ErrorBox message={resetError} /> : null}
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  style={{ marginBottom: 14 }}
                />
                <View style={styles.rowGap}>
                  <Button
                    label="Cancel"
                    variant="tint"
                    style={{ flex: 1 }}
                    onPress={() => {
                      setForgot(false);
                      setResetError(null);
                    }}
                  />
                  <Button
                    label="Send link"
                    style={{ flex: 1 }}
                    loading={resetLoading}
                    onPress={submitReset}
                  />
                </View>
              </>
            )}
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.tabs}>
              <Tab label="Login" active={mode === 'login'} onPress={() => setMode('login')} />
              <Tab label="Sign up" active={mode === 'signup'} onPress={() => setMode('signup')} />
            </View>

            {mode === 'signup' && (
              <Field
                label="Invite code"
                value={inviteCode}
                onChangeText={(v) => setInviteCode(v.toUpperCase())}
                autoCapitalize="characters"
                placeholder="XXXX-00000"
                style={{ marginBottom: 13 }}
              />
            )}
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              style={{ marginBottom: 13 }}
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              style={{ marginBottom: 13 }}
            />

            {localError || error ? <ErrorBox message={localError || error || ''} /> : null}

            <Button
              label={mode === 'login' ? 'Sign in' : 'Create account'}
              icon={mode === 'login' ? 'login' : 'person-add'}
              loading={loading}
              onPress={submit}
              style={{ marginTop: 4 }}
            />

            {mode === 'login' && (
              <TouchableOpacity onPress={() => setForgot(true)} style={{ marginTop: 14 }}>
                <Text style={styles.forgot}>Forgot password?</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.help}>
              {mode === 'signup'
                ? 'Enter the invite code given by your admin'
                : 'Use the credentials you created during signup'}
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <View style={styles.errBox}>
      <Text style={styles.errText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.darkBlue },
  content: { paddingHorizontal: 22 },
  brand: { alignItems: 'flex-start', marginBottom: 24 },
  title: { fontFamily: fonts.bold, fontSize: 24, color: '#fff', marginTop: 18 },
  subtitle: { fontFamily: fonts.semibold, fontSize: 13, color: '#9fb0c9', marginTop: 2 },
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: 20 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  hint: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 4, marginBottom: 16 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 18 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textMuted },
  tabTextActive: { color: colors.primary },
  forgot: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary, textAlign: 'center' },
  help: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 16 },
  rowGap: { flexDirection: 'row', gap: 10 },
  errBox: { backgroundColor: colors.errorBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 12 },
  errText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.error },
  okBox: { backgroundColor: colors.successBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 14 },
  okText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.success },
});
