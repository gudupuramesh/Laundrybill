import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { auth, getShopId } from '../lib/auth';
import appJson from '../../app.json';
import { colors, fonts, radii, shadows } from '../theme';

type FeedbackType = 'issue' | 'suggestion' | 'other';

const TYPES: { key: FeedbackType; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'issue', label: 'Report an issue', icon: 'bug-report' },
  { key: 'suggestion', label: 'Suggestion', icon: 'lightbulb-outline' },
  { key: 'other', label: 'Other', icon: 'chat-bubble-outline' },
];

const MAX_LEN = 1000;

export default function FeedbackScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const shopId = getShopId();
  const user = auth().currentUser;

  const [type, setType] = useState<FeedbackType>('issue');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [shopName, setShopName] = useState('');

  // Best-effort shop name for the admin view (non-blocking).
  useEffect(() => {
    if (!shopId) return;
    let active = true;
    firestore()
      .collection('shops')
      .doc(shopId)
      .get()
      .then((doc: any) => {
        if (active) setShopName(doc?.data?.()?.name || '');
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [shopId]);

  const submit = async () => {
    const text = message.trim();
    if (!text) {
      Alert.alert('Please write a message', 'Tell us what happened or what you would like to see.');
      return;
    }
    if (!user) {
      Alert.alert('Please sign in', 'You need to be signed in to send feedback.');
      return;
    }
    setSubmitting(true);
    try {
      await firestore()
        .collection('feedback')
        .add({
          type,
          message: text,
          shopId: shopId || null,
          shopName: shopName || null,
          userId: user.uid,
          userEmail: user.email || null,
          platform: Platform.OS,
          appVersion: appJson.expo.version,
          status: 'new',
          createdAt: new Date(),
        });
      Alert.alert('Thank you!', 'Your feedback has been sent. Our team reviews every message.', [
        { text: 'OK', onPress: onBack },
      ]);
    } catch (e: any) {
      Alert.alert('Could not send', e?.message || 'Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={s.container}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7}>
          <MaterialIcons name="chevron-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Send Feedback</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: 24 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.intro}>
            Found a problem or have an idea? Tell us — our team reads every message and uses it to
            improve the app.
          </Text>

          {/* Type selector */}
          <Text style={s.label}>What is this about?</Text>
          <View style={s.typeRow}>
            {TYPES.map((tt) => {
              const active = type === tt.key;
              return (
                <TouchableOpacity
                  key={tt.key}
                  style={[s.typeChip, active && s.typeChipActive]}
                  onPress={() => setType(tt.key)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name={tt.icon}
                    size={18}
                    color={active ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[s.typeChipText, active && s.typeChipTextActive]}>{tt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Message */}
          <Text style={s.label}>Your message</Text>
          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              placeholder="Describe the issue or share your suggestion…"
              placeholderTextColor={colors.textMuted}
              value={message}
              onChangeText={(t) => t.length <= MAX_LEN && setMessage(t)}
              multiline
              textAlignVertical="top"
            />
          </View>
          <Text style={s.counter}>
            {message.length}/{MAX_LEN}
          </Text>

          {/* Submit */}
          <TouchableOpacity
            style={[s.submitBtn, submitting && { opacity: 0.7 }]}
            onPress={submit}
            disabled={submitting}
            activeOpacity={0.9}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="send" size={18} color="#fff" />
                <Text style={s.submitText}>Send Feedback</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={s.note}>
            We may include your shop name and email so we can follow up. Sent on{' '}
            {Platform.OS === 'ios' ? 'iOS' : 'Android'} · v{appJson.expo.version}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 16,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },
  scroll: { padding: 16 },
  intro: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  typeChipText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textSecondary },
  typeChipTextActive: { color: colors.primary },
  inputWrap: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
    padding: 4,
  },
  input: {
    minHeight: 140,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.text,
    padding: 12,
  },
  counter: {
    alignSelf: 'flex-end',
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginTop: 6,
    marginBottom: 20,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: radii.button,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  submitText: { fontSize: 16, fontFamily: fonts.bold, color: '#fff' },
  note: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});
