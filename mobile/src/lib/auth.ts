/**
 * Auth helpers — JS Firebase SDK via the compatibility facade in `./firebase`.
 * Google Sign-In uses the native @react-native-google-signin module (not Firebase)
 * to obtain an ID token, then signs into Firebase with that credential.
 */
import { auth } from './firebase';

export let isMockEnv = false;

let GoogleSignin: any;
try {
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
  GoogleSignin.configure({
    webClientId:
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
      '285945951840-91cmr666jkghgdd234p0h2607gphr2g7.apps.googleusercontent.com',
    offlineAccess: false,
  });
} catch (gErr) {
  console.warn('Google Sign-In not available in this build.');
}

export async function signInWithGoogle() {
  // 1. Native Google Sign-In (dev build) → Firebase credential
  if (GoogleSignin) {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const { data } = await GoogleSignin.signIn();
      const idToken = data?.idToken;
      if (!idToken) throw new Error('No ID token found from Google Sign-In');

      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      return auth().signInWithCredential(googleCredential);
    } catch (error) {
      console.error('Native Google Sign-In Error:', error);
      throw error;
    }
  }

  // 2. Expo Go fallback — handled by LoginScreen using expo-auth-session hooks
  throw new Error('EXPO_GO_GOOGLE_SIGNIN');
}

// Called from LoginScreen when expo-auth-session returns an id_token
export async function signInWithGoogleIdToken(idToken: string) {
  const googleCredential = auth.GoogleAuthProvider.credential(idToken);
  return auth().signInWithCredential(googleCredential);
}

export async function signInWithEmailPassword(email: string, password: string) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return auth().signInWithEmailAndPassword(normalizedEmail, password);
}

export async function registerWithEmailPassword(email: string, password: string) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return auth().createUserWithEmailAndPassword(normalizedEmail, password);
}

export async function sendPasswordReset(email: string) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return auth().sendPasswordResetEmail(normalizedEmail);
}

// Resolved shopId — set by App.tsx after matching, used by all screens
let _resolvedShopId: string | null = null;

export function setResolvedShopId(id: string | null) {
  _resolvedShopId = id;
}

export function getShopId(): string {
  return _resolvedShopId || auth().currentUser?.uid || '';
}

export { auth };
