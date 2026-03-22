/**
 * i18n Configuration for LaundryBoss
 * 
 * Multi-language support using react-i18next
 * Supports 8 Indian languages + English
 * Language preference is synced to Firebase when logged in
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

// Import translation files
import en from '../locales/en.json';
import hi from '../locales/hi.json';
import te from '../locales/te.json';
import ta from '../locales/ta.json';
import mr from '../locales/mr.json';
import kn from '../locales/kn.json';
import bn from '../locales/bn.json';
import ml from '../locales/ml.json';

// Language metadata for UI display
export const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳' },
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳' },
    { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳' },
    { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳' },
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇮🇳' },
    { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

// Default namespace
const defaultNS = 'translation';

// Resources object with translations
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

// Initialize i18n
i18n
    // Detect user language
    .use(LanguageDetector)
    // Pass the i18n instance to react-i18next
    .use(initReactI18next)
    // Initialize configuration
    .init({
        resources,
        fallbackLng: 'en',
        defaultNS,

        // Language detection options
        detection: {
            // Order of language detection sources
            order: ['localStorage', 'navigator', 'htmlTag'],
            // Cache the detected language in localStorage
            caches: ['localStorage'],
            // localStorage key name
            lookupLocalStorage: 'i18nextLng',
        },

        interpolation: {
            // React already handles escaping
            escapeValue: false,
            // Currency formatting – symbol/locale are injected at runtime by components
            format: (value, format) => {
                if (format === 'currency') {
                    // Fallback for i18n interpolation: use basic number formatting
                    // Actual currency symbol is added by the calling component / useCurrency()
                    return Number(value).toLocaleString();
                }
                return value;
            },
        },

        // React suspense support
        react: {
            useSuspense: false, // Set to false to avoid loading states
        },

        // Debugging in development
        debug: false, // Disable debug to reduce console noise
    });

/**
 * Get current language code
 */
export function getCurrentLanguage(): LanguageCode {
    return i18n.language as LanguageCode || 'en';
}

/**
 * Change the current language (also saves to localStorage)
 */
export async function changeLanguage(lng: LanguageCode): Promise<void> {
    await i18n.changeLanguage(lng);
}

/**
 * Change language and sync to Firebase user profile
 * Call this when user is logged in to persist across devices
 */
export async function changeLanguageWithSync(lng: LanguageCode, userId?: string): Promise<void> {
    // Change locally first
    await i18n.changeLanguage(lng);

    // Save to Firebase if logged in
    if (userId) {
        try {
            await updateDoc(doc(db, 'users', userId), {
                preferredLanguage: lng,
            });
        } catch (error) {
            console.error('Failed to save language preference to Firebase:', error);
        }
    }
}

/**
 * Load language preference from Firebase and apply it
 * Call this when user logs in
 */
export async function loadLanguageFromFirebase(userId: string): Promise<void> {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.preferredLanguage && SUPPORTED_LANGUAGES.some(l => l.code === data.preferredLanguage)) {
                await i18n.changeLanguage(data.preferredLanguage);
            }
        }
    } catch (error) {
        console.error('Failed to load language preference from Firebase:', error);
    }
}

/**
 * Get language details by code
 */
export function getLanguageByCode(code: LanguageCode) {
    return SUPPORTED_LANGUAGES.find(lang => lang.code === code);
}

/**
 * Check if a translation key exists
 */
export function hasTranslation(key: string): boolean {
    return i18n.exists(key);
}

/**
 * Translate function for non-component usage
 * Use useTranslation() hook in components instead
 * 
 * @param key Translation key
 * @param optionsOrDefault Either a default string value or an options object
 */
export function t(key: string, optionsOrDefault?: string | Record<string, unknown>): string {
    if (typeof optionsOrDefault === "string") {
        return i18n.t(key, { defaultValue: optionsOrDefault });
    }
    return i18n.t(key, optionsOrDefault);
}

export default i18n;
