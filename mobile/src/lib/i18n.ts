/**
 * Mobile app i18n — same translation bundles as the web app (src/locales).
 * Settings → Language saves display names (English, Telugu, …); we map to ISO codes.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from '../locales/en.json';
import hi from '../locales/hi.json';
import te from '../locales/te.json';
import ta from '../locales/ta.json';
import mr from '../locales/mr.json';
import kn from '../locales/kn.json';
import bn from '../locales/bn.json';
import ml from '../locales/ml.json';
import gu from '../locales/gu.json';

export const MOBILE_LANG_CODES = ['en', 'hi', 'te', 'ta', 'mr', 'kn', 'bn', 'ml', 'gu'] as const;

/** UI order: native script in the picker; legacy = old English label saved in Firestore */
export const LANGUAGE_OPTIONS = [
  { code: 'en', native: 'English', legacy: 'English' },
  { code: 'te', native: 'తెలుగు', legacy: 'Telugu' },
  { code: 'hi', native: 'हिंदी', legacy: 'Hindi' },
  { code: 'ta', native: 'தமிழ்', legacy: 'Tamil' },
  { code: 'mr', native: 'मराठी', legacy: 'Marathi' },
  { code: 'kn', native: 'ಕನ್ನಡ', legacy: 'Kannada' },
  { code: 'ml', native: 'മലയാളം', legacy: 'Malayalam' },
  { code: 'bn', native: 'বাংলা', legacy: 'Bengali' },
  { code: 'gu', native: 'ગુજરાતી', legacy: 'Gujarati' },
] as const;

/** Maps native label, legacy English name, or ISO code → i18n code */
export const LANGUAGE_DISPLAY_TO_CODE: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const o of LANGUAGE_OPTIONS) {
    m[o.native] = o.code;
    m[o.legacy] = o.code;
    m[o.code] = o.code;
  }
  return m;
})();

export function resolveLanguageToCode(saved: string | undefined): string {
  if (!saved) return 'en';
  if ((MOBILE_LANG_CODES as readonly string[]).includes(saved)) return saved;
  return LANGUAGE_DISPLAY_TO_CODE[saved] ?? 'en';
}

export function nativeLabelForCode(code: string): string {
  const o = LANGUAGE_OPTIONS.find((x) => x.code === code);
  return o?.native ?? 'English';
}

const STORAGE_KEY = 'mobile_i18n_language';

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  te: { translation: te },
  ta: { translation: ta },
  mr: { translation: mr },
  kn: { translation: kn },
  bn: { translation: bn },
  ml: { translation: ml },
  gu: { translation: gu },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  // v4 needs Intl.PluralRules; RN/Hermes often lacks it and logs a red-box error.
  // Our bundles use v3-style keys (e.g. turnaroundDays / turnaroundDays_plural).
  compatibilityJSON: 'v3',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export async function initStoredLanguage(): Promise<void> {
  try {
    const code = await AsyncStorage.getItem(STORAGE_KEY);
    if (code && (MOBILE_LANG_CODES as readonly string[]).includes(code)) {
      await i18n.changeLanguage(code);
    }
  } catch {
    /* ignore */
  }
}

export async function setAppLanguageCode(code: string): Promise<void> {
  await i18n.changeLanguage(code);
  await AsyncStorage.setItem(STORAGE_KEY, code);
}

/** Accepts native name, legacy English name, or ISO code (from Firestore / picker). */
export async function setAppLanguageFromDisplayName(name: string): Promise<void> {
  const code = resolveLanguageToCode(name);
  await setAppLanguageCode(code);
}

export default i18n;
