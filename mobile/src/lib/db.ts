let firestore: any;

try {
  firestore = require('@react-native-firebase/firestore').default;
} catch (e) {
  console.warn("Native Firestore not available. Using Firebase Web SDK for Firestore.");

  // Real fallback using Firebase Web SDK — data actually persists!
  const { webDb } = require('./firebase');
  const {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy: fsOrderBy,
    limit: fsLimit,
    where: fsWhere,
    writeBatch,
  } = require('firebase/firestore');

  // Wrapper that mimics the @react-native-firebase/firestore chaining API
  const createDocRef = (docRef: any): any => ({
    set: async (data: any, options?: any) => {
      await setDoc(docRef, data, options || {});
    },
    update: async (data: any) => {
      await updateDoc(docRef, data);
    },
    delete: async () => {
      await deleteDoc(docRef);
    },
    get: async () => {
      const snap = await getDoc(docRef);
      return { exists: snap.exists(), data: () => snap.data(), id: snap.id };
    },
    onSnapshot: (callback: any, errorCb?: any) => {
      return onSnapshot(
        docRef,
        (snap: any) => {
          callback({ exists: snap.exists(), data: () => snap.data(), id: snap.id });
        },
        errorCb || ((err: any) => console.error('Firestore doc snapshot error:', err))
      );
    },
    collection: (subPath: string) => createCollectionRef(collection(docRef, subPath)),
  });

  const createCollectionRef = (collRef: any, constraints: any[] = []): any => ({
    doc: (id?: string) => id ? createDocRef(doc(collRef, id)) : createDocRef(doc(collRef)),
    add: async (data: any) => {
      const docRef = await addDoc(collRef, data);
      return { id: docRef.id };
    },
    where: (field: string, op: string, value: any) =>
      createCollectionRef(collRef, [...constraints, fsWhere(field, op, value)]),
    orderBy: (field: string, direction?: string) =>
      createCollectionRef(collRef, [...constraints, fsOrderBy(field, direction || 'asc')]),
    limit: (n: number) =>
      createCollectionRef(collRef, [...constraints, fsLimit(n)]),
    onSnapshot: (callback: any, errorCb?: any) => {
      const q = constraints.length > 0 ? query(collRef, ...constraints) : collRef;
      return onSnapshot(
        q,
        (snap: any) => {
          callback({
            docs: snap.docs.map((d: any) => ({ id: d.id, data: () => d.data() })),
            size: snap.size,
            empty: snap.empty,
          });
        },
        errorCb || ((err: any) => console.error('Firestore query snapshot error:', err))
      );
    },
    get: async () => {
      const q = constraints.length > 0 ? query(collRef, ...constraints) : collRef;
      const snap = await getDocs(q);
      return {
        docs: snap.docs.map((d: any) => ({ id: d.id, data: () => d.data() })),
        size: snap.size,
        empty: snap.empty,
      };
    },
  });

  firestore = () => ({
    collection: (path: string) => createCollectionRef(collection(webDb, path)),
    batch: () => {
      const b = writeBatch(webDb);
      return {
        set: (ref: any, data: any) => b.set(ref._docRef || ref, data),
        update: (ref: any, data: any) => b.update(ref._docRef || ref, data),
        delete: (ref: any) => b.delete(ref._docRef || ref),
        commit: () => b.commit(),
      };
    },
  });
}

export { firestore };
