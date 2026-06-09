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

/**
 * Sign in with Apple (iOS only) → Firebase.
 *
 * Uses a SHA-256-hashed nonce: Apple embeds the hash in the identity token, and
 * Firebase verifies it against the raw nonce we pass to the credential. The Apple
 * provider must be enabled in the Firebase console for this to succeed.
 *
 * Throws 'APPLE_SIGNIN_CANCELLED' if the user dismisses the sheet, and
 * 'APPLE_SIGNIN_UNAVAILABLE' if the native module isn't present (e.g. Expo Go).
 */
export async function signInWithApple() {
  let AppleAuthentication: typeof import('expo-apple-authentication');
  let Crypto: typeof import('expo-crypto');
  try {
    AppleAuthentication = require('expo-apple-authentication');
    Crypto = require('expo-crypto');
  } catch {
    throw new Error('APPLE_SIGNIN_UNAVAILABLE');
  }

  if (!(await AppleAuthentication.isAvailableAsync())) {
    throw new Error('APPLE_SIGNIN_UNAVAILABLE');
  }

  // 1. Generate a raw nonce and its SHA-256 hash.
  const rawNonce = Crypto.randomUUID() + Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  // 2. Native Apple sign-in with the hashed nonce.
  let appleCredential: import('expo-apple-authentication').AppleAuthenticationCredential;
  try {
    appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e: any) {
    if (e?.code === 'ERR_REQUEST_CANCELED') throw new Error('APPLE_SIGNIN_CANCELLED');
    throw e;
  }

  const { identityToken } = appleCredential;
  if (!identityToken) throw new Error('No identity token returned from Apple');

  // 3. Exchange for a Firebase credential using the raw nonce.
  const firebaseCredential = auth.AppleAuthProvider.credential(identityToken, rawNonce);
  return auth().signInWithCredential(firebaseCredential);
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
