let auth: any;
let GoogleSignin: any;
let functions: any;

export let isMockEnv = false;

try {
  auth = require('@react-native-firebase/auth').default;
  functions = require('@react-native-firebase/functions').default;

  try {
    GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '285945951840-91cmr666jkghgdd234p0h2607gphr2g7.apps.googleusercontent.com',
      offlineAccess: false,
    });
  } catch (gErr) {
    console.warn("Google Sign-In not available in this build.");
  }
} catch (e) {
  console.warn("Native Firebase not available. Using Firebase Web SDK fallback.");

  // REAL fallback using Firebase Web SDK — not a mock!
  const { webAuth, webFunctions } = require('./firebase');
  const {
    onAuthStateChanged: webOnAuthStateChanged,
    signInWithCustomToken: webSignInWithCustomToken,
    signInWithCredential: webSignInWithCredential,
    signInWithEmailAndPassword: webSignInWithEmailAndPassword,
    createUserWithEmailAndPassword: webCreateUserWithEmailAndPassword,
    sendPasswordResetEmail: webSendPasswordResetEmail,
    GoogleAuthProvider: WebGoogleAuthProvider,
    signOut: webSignOut,
  } = require('firebase/auth');
  const { httpsCallable } = require('firebase/functions');

  // Wrap web SDK auth to match @react-native-firebase/auth API
  const authInstance = {
    onAuthStateChanged: (cb: any) => webOnAuthStateChanged(webAuth, cb),
    signInWithCustomToken: (token: string) => webSignInWithCustomToken(webAuth, token),
    signInWithCredential: (credential: any) => webSignInWithCredential(webAuth, credential),
    signInWithEmailAndPassword: (email: string, password: string) => webSignInWithEmailAndPassword(webAuth, email, password),
    createUserWithEmailAndPassword: (email: string, password: string) => webCreateUserWithEmailAndPassword(webAuth, email, password),
    sendPasswordResetEmail: (email: string) => webSendPasswordResetEmail(webAuth, email),
    signOut: () => webSignOut(webAuth),
    get currentUser() { return webAuth.currentUser; },
  };

  auth = () => authInstance;
  auth.GoogleAuthProvider = { credential: (idToken: string) => WebGoogleAuthProvider.credential(idToken) };

  // Wrap web SDK functions to match @react-native-firebase/functions API
  functions = () => ({
    httpsCallable: (name: string) => (data: any) => httpsCallable(webFunctions, name)(data),
  });

  // isMockEnv stays FALSE — this is a real Firebase connection, not a mock!
}

export async function signInWithGoogle() {
  // 1. Try native Google Sign-In (dev build only)
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
