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
    GoogleAuthProvider: WebGoogleAuthProvider,
    signOut: webSignOut,
  } = require('firebase/auth');
  const { httpsCallable } = require('firebase/functions');

  // Wrap web SDK auth to match @react-native-firebase/auth API
  const authInstance = {
    onAuthStateChanged: (cb: any) => webOnAuthStateChanged(webAuth, cb),
    signInWithCustomToken: (token: string) => webSignInWithCustomToken(webAuth, token),
    signInWithCredential: (credential: any) => webSignInWithCredential(webAuth, credential),
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

const MSG91_AUTH_KEY = process.env.EXPO_PUBLIC_MSG91_AUTH_KEY || '449167AV9OuzJhy68135dccP1';
const MSG91_TEMPLATE_ID = process.env.EXPO_PUBLIC_MSG91_TEMPLATE_ID || '69218ec0be240a7f4f6e2ba8';

function getRawPhone(phone: string) {
  return phone.replace(/\D/g, '').slice(-10);
}

export async function sendMsg91Otp(phoneNumber: string) {
  const rawNum = getRawPhone(phoneNumber);
  const mobile = `91${rawNum}`;

  try {
    const url = `https://control.msg91.com/api/v5/otp?template_id=${MSG91_TEMPLATE_ID}&mobile=${mobile}&authkey=${MSG91_AUTH_KEY}`;
    const response = await fetch(url, { method: 'POST' });
    const data = await response.json();

    if (data.type === 'error') {
      throw new Error(data.message || 'Failed to send OTP via MSG91');
    }

    return true;
  } catch (error) {
    console.error('MSG91 Send Error:', error);
    throw error;
  }
}

export async function verifyMsg91Otp(phoneNumber: string, otp: string) {
  // 1. Verify OTP via MSG91 REST API
  const rawNum = getRawPhone(phoneNumber);
  const mobile = `91${rawNum}`;

  try {
    const url = `https://control.msg91.com/api/v5/otp/verify?otp=${otp}&mobile=${mobile}&authkey=${MSG91_AUTH_KEY}`;
    const response = await fetch(url, { method: 'GET' });
    const data = await response.json();

    if (data.type === 'error' || data.message === "OTP not match") {
      throw new Error(data.message || 'Invalid OTP');
    }
  } catch (error) {
    console.error('MSG91 Verify Error:', error);
    throw error;
  }

  // 2. Get Firebase Custom Token via Cloud Function
  try {
    const rawNum2 = getRawPhone(phoneNumber);
    const e164Phone = `+91${rawNum2}`;

    const loginFn = functions().httpsCallable('loginWithMsg91');
    const result = await loginFn({ phone: e164Phone });
    const { token } = result.data as { token: string };

    if (!token) throw new Error("No custom token returned from Cloud Function");

    // 3. Sign in to Firebase (works with both native and web SDK)
    return await auth().signInWithCustomToken(token);
  } catch (error) {
    console.error('Cloud Function / Custom Token Error:', error);
    throw error;
  }
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

// Resolved shopId — set by App.tsx after matching, used by all screens
let _resolvedShopId: string | null = null;

export function setResolvedShopId(id: string | null) {
  _resolvedShopId = id;
}

export function getShopId(): string {
  return _resolvedShopId || auth().currentUser?.uid || '';
}

export { auth };
