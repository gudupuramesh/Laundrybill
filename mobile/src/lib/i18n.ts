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

export const MOBILE_LANG_CODES = ['en', 'hi', 'te', 'ta', 'mr', 'kn', 'bn', 'ml'] as const;

/** Matches SettingsScreen LANGUAGES and Super Admin language list */
export const LANGUAGE_DISPLAY_TO_CODE: Record<string, string> = {
  English: 'en',
  Telugu: 'te',
  Hindi: 'hi',
  Tamil: 'ta',
  Kannada: 'kn',
  Malayalam: 'ml',
};

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
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  compatibilityJSON: 'v4',
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

export async function setAppLanguageFromDisplayName(name: string): Promise<void> {
  const code = LANGUAGE_DISPLAY_TO_CODE[name] || 'en';
  await setAppLanguageCode(code);
}

export default i18n;
