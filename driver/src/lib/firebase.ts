/**
 * Firebase client — plain JavaScript Firebase SDK (NO native modules).
 *
 * The app previously used `@react-native-firebase` (native). That required
 * static frameworks on iOS, which is incompatible with the toolchain.
 * This module uses the JS SDK and exposes a thin compatibility facade that
 * mirrors the `@react-native-firebase` chained API (`firestore().collection()
 * .doc().get()`, `auth().currentUser`), so the ~60 call sites don't change.
 *
 * Auth uses AsyncStorage persistence so the user stays signed in across launches.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  // getReactNativePersistence is a runtime export missing from the TS types.
  // @ts-expect-error - runtime-only export
  getReactNativePersistence,
  onAuthStateChanged as mOnAuthStateChanged,
  signOut as mSignOut,
  signInWithCustomToken as mSignInWithCustomToken,
  signInWithCredential as mSignInWithCredential,
  signInWithEmailAndPassword as mSignInWithEmailAndPassword,
  createUserWithEmailAndPassword as mCreateUserWithEmailAndPassword,
  sendPasswordResetEmail as mSendPasswordResetEmail,
  GoogleAuthProvider as MGoogleAuthProvider,
  OAuthProvider as MOAuthProvider,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  initializeFirestore,
  type Firestore,
  type DocumentData,
  type DocumentReference as MDocumentReference,
  type CollectionReference as MCollectionReference,
  type Query as MQuery,
  type DocumentSnapshot as MDocumentSnapshot,
  type QuerySnapshot as MQuerySnapshot,
  type QueryDocumentSnapshot as MQueryDocumentSnapshot,
  type WriteBatch,
  type SetOptions,
  type WhereFilterOp,
  type OrderByDirection,
  collection as mCollection,
  collectionGroup as mCollectionGroup,
  doc as mDoc,
  getDoc as mGetDoc,
  getDocs as mGetDocs,
  setDoc as mSetDoc,
  updateDoc as mUpdateDoc,
  deleteDoc as mDeleteDoc,
  addDoc as mAddDoc,
  query as mQueryFn,
  where as mWhere,
  orderBy as mOrderBy,
  limit as mLimit,
  startAfter as mStartAfter,
  onSnapshot as mOnSnapshot,
  serverTimestamp as mServerTimestamp,
  arrayUnion as mArrayUnion,
  arrayRemove as mArrayRemove,
  increment as mIncrement,
  deleteField as mDeleteField,
  Timestamp as MTimestamp,
  writeBatch as mWriteBatch,
} from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';

// ── Bootstrap ────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// React Native auth persistence (stay signed in across launches).
let _auth: Auth;
try {
  _auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  // initializeAuth throws if already initialized (e.g. Fast Refresh) — reuse it.
  _auth = getAuth(app);
}

// React Native's network stack does not reliably support Firestore's default
// WebChannel streaming transport — reads intermittently fail with "client is
// offline" even on a healthy connection. Long-polling is the documented,
// required transport for the Firebase JS SDK on React Native.
const _firestore: Firestore = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  // Order items / financials carry optional fields (categoryId, taxRate, …) that
  // are often undefined; Firestore rejects undefined unless we ignore it here.
  ignoreUndefinedProperties: true,
});
const _functions: Functions = getFunctions(app);

// Legacy exports (kept for any direct consumers)
export const webAuth = _auth;
export const webDb = _firestore;
export const webFunctions = _functions;
export default app;

// ── Firestore chained-API facade ─────────────────────────────────────
class DocSnap<T = DocumentData> {
  constructor(protected _snap: MDocumentSnapshot<T>) {}
  get id(): string { return this._snap.id; }
  get exists(): boolean { return this._snap.exists(); }
  data(): T | undefined { return this._snap.data(); }
  get ref(): DocRef<T> { return new DocRef<T>(this._snap.ref); }
}

class QueryDocSnap<T = DocumentData> extends DocSnap<T> {
  constructor(snap: MQueryDocumentSnapshot<T>) { super(snap); }
  override data(): T { return (this._snap as MQueryDocumentSnapshot<T>).data(); }
}

class QuerySnap<T = DocumentData> {
  constructor(private _snap: MQuerySnapshot<T>) {}
  get size(): number { return this._snap.size; }
  get empty(): boolean { return this._snap.empty; }
  get docs(): QueryDocSnap<T>[] { return this._snap.docs.map((d) => new QueryDocSnap<T>(d)); }
  forEach(cb: (d: QueryDocSnap<T>) => void): void {
    this._snap.docs.forEach((d) => cb(new QueryDocSnap<T>(d)));
  }
}

class QueryRef<T = DocumentData> {
  constructor(protected _q: MQuery<T>) {}
  where(field: string, op: WhereFilterOp, value: unknown): QueryRef<T> {
    return new QueryRef<T>(mQueryFn(this._q, mWhere(field, op, value)));
  }
  orderBy(field: string, dir?: OrderByDirection): QueryRef<T> {
    return new QueryRef<T>(mQueryFn(this._q, mOrderBy(field, dir)));
  }
  limit(n: number): QueryRef<T> {
    return new QueryRef<T>(mQueryFn(this._q, mLimit(n)));
  }
  startAfter(...values: unknown[]): QueryRef<T> {
    return new QueryRef<T>(mQueryFn(this._q, mStartAfter(...values)));
  }
  async get(): Promise<QuerySnap<T>> {
    return new QuerySnap<T>(await mGetDocs(this._q));
  }
  onSnapshot(onNext: (s: QuerySnap<T>) => void, onError?: (e: Error) => void): () => void {
    return mOnSnapshot(this._q, (s) => onNext(new QuerySnap<T>(s)),
      onError || ((err) => console.error('Firestore query snapshot error:', err)));
  }
}

class CollectionRef<T = DocumentData> extends QueryRef<T> {
  constructor(private _col: MCollectionReference<T>) { super(_col); }
  get id(): string { return this._col.id; }
  get path(): string { return this._col.path; }
  doc(id?: string): DocRef<T> {
    return new DocRef<T>(id ? mDoc(this._col, id) : mDoc(this._col));
  }
  async add(data: T): Promise<DocRef<T>> {
    return new DocRef<T>(await mAddDoc(this._col, data));
  }
}

class DocRef<T = DocumentData> {
  constructor(private _ref: MDocumentReference<T>) {}
  get id(): string { return this._ref.id; }
  get path(): string { return this._ref.path; }
  collection(name: string): CollectionRef {
    return new CollectionRef(mCollection(this._ref, name) as MCollectionReference);
  }
  async get(): Promise<DocSnap<T>> {
    return new DocSnap<T>(await mGetDoc(this._ref));
  }
  async set(data: Partial<T>, options?: SetOptions): Promise<void> {
    if (options) await mSetDoc(this._ref, data as T, options);
    else await mSetDoc(this._ref, data as T);
  }
  async update(data: Record<string, unknown>): Promise<void> {
    await mUpdateDoc(this._ref as MDocumentReference, data);
  }
  async delete(): Promise<void> { await mDeleteDoc(this._ref); }
  onSnapshot(onNext: (s: DocSnap<T>) => void, onError?: (e: Error) => void): () => void {
    return mOnSnapshot(this._ref, (s) => onNext(new DocSnap<T>(s)),
      onError || ((err) => console.error('Firestore doc snapshot error:', err)));
  }
  /** Internal: underlying modular DocumentReference (used by batch/transaction). */
  _modular(): MDocumentReference<T> { return this._ref; }
}

/** Resolve either a facade DocRef or a raw modular ref to the modular ref. */
function toModularRef(ref: any): MDocumentReference {
  return (ref && typeof ref._modular === 'function' ? ref._modular() : ref) as MDocumentReference;
}

class BatchFacade {
  constructor(private _b: WriteBatch) {}
  set(ref: any, data: any, options?: SetOptions): BatchFacade {
    if (options) this._b.set(toModularRef(ref), data, options);
    else this._b.set(toModularRef(ref), data);
    return this;
  }
  update(ref: any, data: Record<string, unknown>): BatchFacade {
    this._b.update(toModularRef(ref), data);
    return this;
  }
  delete(ref: any): BatchFacade {
    this._b.delete(toModularRef(ref));
    return this;
  }
  async commit(): Promise<void> { await this._b.commit(); }
}

class FirestoreFacade {
  collection(path: string): CollectionRef {
    return new CollectionRef(mCollection(_firestore, path) as MCollectionReference);
  }
  collectionGroup(name: string): QueryRef {
    return new QueryRef(mCollectionGroup(_firestore, name));
  }
  doc(path: string): DocRef {
    return new DocRef(mDoc(_firestore, path) as MDocumentReference);
  }
  batch(): BatchFacade {
    return new BatchFacade(mWriteBatch(_firestore));
  }
}

const _firestoreFacade = new FirestoreFacade();

/**
 * `firestore()` — returns the chained-API facade (mirrors @react-native-firebase).
 * Also carries the static `FieldValue` / `Timestamp` helpers as properties.
 */
type FirestoreFn = (() => FirestoreFacade) & {
  FieldValue: {
    serverTimestamp: () => unknown;
    arrayUnion: (...e: unknown[]) => unknown;
    arrayRemove: (...e: unknown[]) => unknown;
    increment: (n: number) => unknown;
    delete: () => unknown;
  };
  Timestamp: typeof MTimestamp;
};

const firestore = (() => _firestoreFacade) as FirestoreFn;
firestore.FieldValue = {
  serverTimestamp: () => mServerTimestamp(),
  arrayUnion: (...e: unknown[]) => mArrayUnion(...e),
  arrayRemove: (...e: unknown[]) => mArrayRemove(...e),
  increment: (n: number) => mIncrement(n),
  delete: () => mDeleteField(),
};
firestore.Timestamp = MTimestamp;

export { firestore };

// ── Auth facade ──────────────────────────────────────────────────────
const _authFacade = {
  get currentUser(): User | null { return _auth.currentUser; },
  onAuthStateChanged(cb: (u: User | null) => void): () => void {
    return mOnAuthStateChanged(_auth, cb);
  },
  signOut(): Promise<void> { return mSignOut(_auth); },
  signInWithCustomToken(token: string) { return mSignInWithCustomToken(_auth, token); },
  signInWithCredential(credential: any) { return mSignInWithCredential(_auth, credential); },
  signInWithEmailAndPassword(email: string, password: string) {
    return mSignInWithEmailAndPassword(_auth, email, password);
  },
  createUserWithEmailAndPassword(email: string, password: string) {
    return mCreateUserWithEmailAndPassword(_auth, email, password);
  },
  sendPasswordResetEmail(email: string) { return mSendPasswordResetEmail(_auth, email); },
};

type AuthFn = (() => typeof _authFacade) & {
  GoogleAuthProvider: { credential: (idToken: string | null, accessToken?: string) => any };
  AppleAuthProvider: { credential: (idToken: string, rawNonce?: string) => any };
};

const auth = (() => _authFacade) as AuthFn;
auth.GoogleAuthProvider = {
  credential: (idToken: string | null, accessToken?: string) =>
    MGoogleAuthProvider.credential(idToken, accessToken),
};
auth.AppleAuthProvider = {
  // Sign in with Apple → Firebase. The identity token is verified against the
  // rawNonce (its SHA-256 must match the token's `nonce` claim).
  credential: (idToken: string, rawNonce?: string) =>
    new MOAuthProvider('apple.com').credential({ idToken, rawNonce }),
};

export { auth };
export type AuthUser = User;

// ── Cloud Functions instance (region-aware) ──────────────────────────
export function getFunctionsInstance(region?: string): Functions {
  return region ? getFunctions(app, region) : _functions;
}
