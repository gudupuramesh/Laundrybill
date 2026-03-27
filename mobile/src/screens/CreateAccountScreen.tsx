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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

  const handleCreate = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) return alert('Please enter valid email.');
    if (!password || password.length < 6) return alert('Password must be at least 6 characters.');
    if (password !== confirmPassword) return alert('Password and confirm password do not match.');
    setLoading(true);
    try {
      await onCreate({ email: normalizedEmail, password });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <MaterialIcons name="arrow-back" size={22} color="#00408f" />
          </TouchableOpacity>
          <Text style={styles.title}>Create Account</Text>

          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>PASSWORD</Text>
          <View style={styles.inputWithIcon}>
            <TextInput
              style={styles.inputFlex}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
              <MaterialIcons name={showPassword ? 'visibility' : 'visibility-off'} size={20} color="#737685" />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>CONFIRM PASSWORD</Text>
          <View style={styles.inputWithIcon}>
            <TextInput
              style={styles.inputFlex}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm password"
              secureTextEntry={!showConfirm}
            />
            <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} style={styles.eyeBtn}>
              <MaterialIcons name={showConfirm ? 'visibility' : 'visibility-off'} size={20} color="#737685" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleCreate} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create Account</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fb' },
  content: { paddingHorizontal: 24, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  title: { fontSize: 26, fontWeight: '800', color: '#191c1e', marginBottom: 18 },
  label: { fontSize: 11, fontWeight: '700', color: '#737685', marginBottom: 6, marginTop: 8, letterSpacing: 1 },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9dce3',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#191c1e',
  },
  inputWithIcon: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9dce3',
    backgroundColor: '#fff',
    paddingLeft: 14,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputFlex: { flex: 1, fontSize: 16, color: '#191c1e' },
  eyeBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  primaryBtn: {
    marginTop: 20,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#00408f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

