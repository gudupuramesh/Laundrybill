import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Pressable, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const APP_LOGO = require('../../assets/login-logo.png');

export default function OtpVerificationScreen({
  onVerify,
  onBack,
  phoneNumber = '98765 43210'
}: {
  onVerify: (otp: string) => void,
  onBack: () => void,
  phoneNumber?: string
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [otpCode, setOtpCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(45);
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const otpInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleVerify = async () => {
    if (otpCode.length < 4) return alert(t('mobile.otpEnterFourDigits'));
    setLoading(true);
    await onVerify(otpCode);
    setLoading(false);
  };

  const handleOtpChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 4);
    setOtpCode(digitsOnly);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <MaterialIcons name="arrow-back" size={24} color="#0056bd" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verify OTP</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Logo — matches login screen */}
        <View style={styles.logoContainer}>
          <View style={styles.logoIconBg}>
            {!logoError ? (
              <Image source={APP_LOGO} style={styles.logoImage} resizeMode="contain" onError={() => setLogoError(true)} />
            ) : (
              <MaterialIcons name="local-laundry-service" size={32} color="#ffffff" />
            )}
          </View>
          <Text style={styles.appName}>{t('common.appName')}</Text>
        </View>

        {/* Instructions */}
        <Text style={styles.headline}>{t('auth.verifyOtp')}</Text>
        <Text style={styles.instructionText}>
          {t('mobile.otpEnterFourDigitCode')}{'\n'}<Text style={styles.instructionPhone}>+91 {phoneNumber}</Text>
        </Text>

        {/* OTP Input Grid */}
        <Pressable style={styles.otpGrid} onPress={() => otpInputRef.current?.focus()}>
          <TextInput
            ref={otpInputRef}
            style={styles.hiddenInput}
            keyboardType="number-pad"
            maxLength={4}
            value={otpCode}
            onChangeText={handleOtpChange}
            autoFocus={true}
            caretHidden
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            returnKeyType="done"
            onSubmitEditing={handleVerify}
          />
          {[0, 1, 2, 3].map((index) => {
            const digit = otpCode[index] || '';
            const isFocused = otpCode.length === index || (otpCode.length === 4 && index === 3);
            return (
              <View
                key={index}
                style={[
                  styles.otpBox,
                  digit ? styles.otpBoxFilled : null,
                  isFocused ? styles.otpBoxFocused : null
                ]}
                pointerEvents="none"
              >
                <Text style={[styles.otpDigit, digit ? styles.otpDigitActive : null]}>{digit}</Text>
              </View>
            );
          })}
        </Pressable>

        {/* Timer */}
        <View style={styles.timerRow}>
          <MaterialIcons name="schedule" size={14} color="#434654" />
          <Text style={styles.timerText}>
            {t('mobile.resendCodeIn', { time: `0:${timeLeft < 10 ? `0${timeLeft}` : timeLeft}` })}
          </Text>
        </View>

        {/* Verify Button */}
        <TouchableOpacity
          style={[styles.primaryBtn, otpCode.length < 4 && { opacity: 0.6 }]}
          onPress={handleVerify}
          disabled={loading || otpCode.length < 4}
        >
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryBtnText}>{t('mobile.verifyProceed')}</Text>}
        </TouchableOpacity>

        {/* Resend */}
        <View style={styles.resendRow}>
          <Text style={styles.resendLabel}>{t('mobile.didntReceiveCode')}</Text>
          <TouchableOpacity disabled={timeLeft > 0}>
            <Text style={[styles.resendBtn, timeLeft > 0 && { opacity: 0.4 }]}>{t('mobile.resend')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fb' },
  header: { backgroundColor: '#f8f9fb' },
  headerInner: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 14, fontWeight: '600', color: '#0056bd', marginLeft: 8 },
  scrollContent: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 24, paddingBottom: 40 },
  logoContainer: { alignItems: 'center', marginBottom: 28 },
  logoIconBg: {
    width: 56, height: 56, backgroundColor: '#00408f', borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    shadowColor: '#00408f',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  logoImage: { width: 36, height: 36 },
  appName: { fontSize: 18, fontWeight: '800', color: '#00408f', letterSpacing: -0.2 },
  headline: { fontSize: 22, fontWeight: '700', color: '#191c1e', marginBottom: 8 },
  instructionText: { fontSize: 14, fontWeight: '500', color: '#434654', textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  instructionPhone: { fontWeight: '700', color: '#191c1e' },
  otpGrid: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 24, width: '100%', position: 'relative' },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  otpBox: {
    width: 58, height: 64, backgroundColor: '#f3f4f6', borderRadius: 10,
    borderWidth: 1.5, borderColor: 'rgba(195,198,214,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  otpBoxFilled: { backgroundColor: '#fff', borderColor: 'rgba(0,64,143,0.2)', elevation: 1, shadowColor: '#00408f', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  otpBoxFocused: { backgroundColor: '#fff', borderColor: '#00408f', borderWidth: 2 },
  otpDigit: { fontSize: 28, fontWeight: '800', color: 'rgba(67,70,84,0.15)', textAlign: 'center' },
  otpDigitActive: { color: '#00408f' },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 28 },
  timerText: { fontSize: 12, fontWeight: '500', color: '#434654', letterSpacing: 0.5 },
  primaryBtn: {
    width: '100%', paddingVertical: 14, backgroundColor: '#0056bd', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  resendRow: { alignItems: 'center', marginTop: 24 },
  resendLabel: { fontSize: 13, fontWeight: '500', color: '#434654', marginBottom: 4 },
  resendBtn: { fontSize: 14, fontWeight: '700', color: '#0056bd', paddingHorizontal: 16, paddingVertical: 8 },
});
