/**
 * Driver app auth — Firebase email/password + invite-code signup for delivery agents.
 * Ported from the web `src/features/driver-app/DriverAuthContext.tsx` to the RN
 * chained-API facade (`firestore()` / `auth()`).
 *
 * Agents live at shops/{shopId}/teamMembers/{id} with memberType:'agent'
 * (legacy fallback: shops/{shopId}/staff/{id}). The shop is derived from the
 * doc path (the facade DocRef has no `.parent`, so we parse `ref.path`).
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firestore, auth } from './firebase';
import { Alert } from 'react-native';
import { claimMobileSession, teardownMobileSession } from './sessionGuard';
import { setResolvedShopId, setResolvedAgentId, setResolvedAgentName } from './auth';
import { evaluateTeamAccess, type TeamAccess } from './planAccess';
import type { Staff, TeamMember } from '../types/staff';

/**
 * The subset of the shops/{shopId} doc a team member needs to see on their
 * profile — the company they work for. Picked explicitly (not spread) so the
 * shop's settings/bank details never land in the login cache.
 */
export interface ShopInfo {
  name: string;
  logoUrl?: string | null;
  logo?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsappNumber?: string | null;
  shopCode?: string | null;
  location?: { address?: string; city?: string; state?: string; pincode?: string } | null;
}

/** Pick the profile-relevant shop fields from a raw shops/{id} doc. */
function pickShop(data: any): ShopInfo | null {
  if (!data) return null;
  return {
    name: data.name || 'Shop',
    logoUrl: data.logoUrl ?? null,
    logo: data.logo ?? null,
    phone: data.phone ?? null,
    email: data.email ?? null,
    whatsappNumber: data.whatsappNumber ?? null,
    shopCode: data.shopCode ?? null,
    location: data.location ?? null,
  };
}

interface DriverAuthContextType {
  agent: Staff | null;
  shopId: string | null;
  shopName: string | null;
  /** The shop (company) the logged-in member works for. */
  shop: ShopInfo | null;
  /**
   * Whether this login is still covered by the shop's plan. null while
   * evaluating (treated as OK so a slow read never blocks paint); 'expired' /
   * 'over_cap' render the PlanBlockedScreen instead of the app shells.
   */
  teamAccess: TeamAccess | null;
  loading: boolean;
  error: string | null;
  isOnline: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, inviteCode: string) => Promise<void>;
  signOutAgent: () => void;
  goOnline: () => Promise<void>;
  goOffline: () => Promise<void>;
}

const DriverAuthContext = createContext<DriverAuthContextType | null>(null);

const CACHE_KEY = 'driver_agent_cache';
/** Last known plan-access verdict, so a blocked login stays blocked across cold
 *  starts (no flash of the app before the async re-check lands). */
const ACCESS_CACHE_KEY = 'driver_team_access_cache';

/** shopId is segment 1 of `shops/{shopId}/teamMembers|staff/{id}`. */
function shopIdFromPath(path: string): string | null {
  const parts = path.split('/');
  return parts[0] === 'shops' && parts[1] ? parts[1] : null;
}

/**
 * Resolve a team member's role for routing. `memberType` picks the app surface
 * (agent / plant / staff); within the staff surface, the optional `role` on the
 * teamMember doc separates a manager from plain staff. Falls back gracefully.
 */
function resolveTeamRole(tm: { memberType?: string; role?: string }): string {
  if (tm.memberType === 'plant') return 'plant_operator';
  if (tm.memberType === 'agent') return 'agent';
  return tm.role === 'manager' ? 'manager' : 'staff';
}

export function DriverAuthProvider({ children }: { children: React.ReactNode }) {
  const [agent, setAgent] = useState<Staff | null>(null);
  const [shopId, setShopId] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string | null>(null);
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [teamAccess, setTeamAccess] = useState<TeamAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [agentDocPath, setAgentDocPath] = useState<string | null>(null);

  const applyResolved = useCallback(
    (a: Staff, sId: string, shopInfo: ShopInfo | null, docPath: string, online: boolean) => {
      const sName = shopInfo?.name || 'Shop';
      setAgent(a);
      setShopId(sId);
      setShopName(sName);
      setShop(shopInfo);
      setIsOnline(online);
      setAgentDocPath(docPath);
      setResolvedShopId(sId);
      setResolvedAgentId(a.id);
      setResolvedAgentName(a.name || (a as any).email || null);
      void AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ agent: a, shopId: sId, shopName: sName, shop: shopInfo, docPath, online }),
      );
    },
    [],
  );

  const clearResolved = useCallback(() => {
    setAgent(null);
    setShopId(null);
    setShopName(null);
    setShop(null);
    setTeamAccess(null);
    setIsOnline(false);
    setAgentDocPath(null);
    setResolvedShopId(null);
    setResolvedAgentId(null);
    setResolvedAgentName(null);
    void AsyncStorage.removeItem(CACHE_KEY);
    void AsyncStorage.removeItem(ACCESS_CACHE_KEY);
  }, []);

  // Hydrate from cache for an instant first paint (verified by the auth listener).
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY)
      .then((raw) => {
        if (!raw) return;
        const c = JSON.parse(raw);
        if (c?.agent && c?.shopId) {
          setAgent(c.agent);
          setShopId(c.shopId);
          setShopName(c.shopName);
          setShop(c.shop ?? null);
          setIsOnline(!!c.online);
          setAgentDocPath(c.docPath);
          setResolvedShopId(c.shopId);
          setResolvedAgentId(c.agent.id);
          setResolvedAgentName(c.agent.name || c.agent.email || null);
          // Restore the last plan-access verdict for THIS member so a blocked
          // login stays blocked from the first frame (re-checked live below).
          AsyncStorage.getItem(ACCESS_CACHE_KEY)
            .then((rawAccess) => {
              if (!rawAccess) return;
              const cached = JSON.parse(rawAccess);
              if (cached?.memberId === c.agent.id && cached?.access) setTeamAccess(cached.access);
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  // Plan gate for EXISTING logins: expired plan (→ free/Pro) blocks every team
  // login; a plan over its total login cap (e.g. Business 15 → Pro+ 4) blocks
  // the logins beyond the cap (oldest keep working). Re-evaluated on sign-in
  // and live whenever the shop's subscription doc changes.
  useEffect(() => {
    if (!shopId || !agent?.id) return;
    const memberId = agent.id;
    const memberType = (agent as any).memberType as string | undefined;
    let cancelled = false;
    const run = () => {
      evaluateTeamAccess(shopId, memberId, memberType)
        .then((access) => {
          if (cancelled) return;
          setTeamAccess(access);
          void AsyncStorage.setItem(ACCESS_CACHE_KEY, JSON.stringify({ memberId, access }));
        })
        .catch(() => {});
    };
    run();
    const unsub = firestore()
      .collection('subscriptions')
      .doc(shopId)
      .onSnapshot(() => run(), () => {});
    return () => {
      cancelled = true;
      unsub();
    };
  }, [shopId, agent?.id]);

  // Auth state → resolve the agent record + shop.
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (user) => {
      if (!user) {
        teardownMobileSession();
        clearResolved();
        setLoading(false);
        return;
      }
      // One active mobile session per account — sign out if used on another phone.
      claimMobileSession(user.uid, () => {
        Alert.alert('Signed out', 'Your account was signed in on another device.');
        void auth().signOut();
      }).catch(() => {});
      try {
        const lookup = async () =>
          firestore()
            .collectionGroup('teamMembers')
            .where('authUid', '==', user.uid)
            .where('memberType', 'in', ['agent', 'plant', 'staff'])
            .get();

        let tmSnap = await lookup();
        if (tmSnap.empty) {
          await new Promise((r) => setTimeout(r, 500));
          tmSnap = await lookup();
        }

        if (!tmSnap.empty) {
          const tmDoc = tmSnap.docs[0];
          const tmData = { id: tmDoc.id, ...tmDoc.data() } as TeamMember;
          const sId = shopIdFromPath(tmDoc.ref.path);
          if (sId) {
            const shopDoc = await firestore().doc(`shops/${sId}`).get();
            const staffLike = teamMemberToStaff(tmData);
            applyResolved(
              staffLike,
              sId,
              pickShop(shopDoc.data()),
              tmDoc.ref.path,
              tmData.isOnline ?? false,
            );
          }
        } else {
          // Legacy fallback: staff collection.
          const staffSnap = await firestore()
            .collectionGroup('staff')
            .where('authUid', '==', user.uid)
            .where('memberType', 'in', ['agent', 'plant', 'staff'])
            .get();
          if (!staffSnap.empty) {
            const staffDoc = staffSnap.docs[0];
            const staffData = { id: staffDoc.id, ...staffDoc.data() } as Staff;
            const sId = shopIdFromPath(staffDoc.ref.path);
            if (sId) {
              const shopDoc = await firestore().doc(`shops/${sId}`).get();
              applyResolved(
                staffData,
                sId,
                pickShop(shopDoc.data()),
                staffDoc.ref.path,
                staffData.isOnline ?? false,
              );
            }
          } else {
            clearResolved();
          }
        }
      } catch (err) {
        console.error('Error fetching agent data:', err);
        setError('Failed to load agent data');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [applyResolved, clearResolved]);

  // Realtime isOnline (owner can toggle from the admin app).
  useEffect(() => {
    if (!agentDocPath) return;
    const unsub = firestore()
      .doc(agentDocPath)
      .onSnapshot((snap) => {
        const data = snap.data() as any;
        if (data && typeof data.isOnline === 'boolean') setIsOnline(data.isOnline);
      });
    return () => unsub();
  }, [agentDocPath]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const cred = await auth().signInWithEmailAndPassword(email.trim().toLowerCase(), password);
      try {
        await firestore()
          .doc(`users/${cred.user.uid}`)
          .set({ lastLogin: firestore.FieldValue.serverTimestamp() }, { merge: true });
      } catch {
        /* non-fatal */
      }
      // onAuthStateChanged resolves the rest.
    } catch (err: any) {
      const code = err?.code;
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Invalid email or password');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address');
      } else {
        setError(err?.message || 'Sign in failed');
      }
      setLoading(false);
      throw err;
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, inviteCode: string) => {
      setLoading(true);
      setError(null);
      try {
        const cleanCode = inviteCode.trim().toUpperCase();
        if (!/^[A-Z0-9]{4}-\d{5}$/.test(cleanCode)) {
          throw new Error('Invalid invite code format. Expected: XXXX-00000');
        }
        const normEmail = email.trim().toLowerCase();

        const tmSnap = await firestore()
          .collectionGroup('teamMembers')
          .where('inviteCode', '==', cleanCode)
          .where('memberType', 'in', ['agent', 'plant', 'staff'])
          .get();

        if (!tmSnap.empty) {
          const tmDoc = tmSnap.docs[0];
          const tmData = tmDoc.data() as TeamMember;
          if (tmData.inviteStatus === 'accepted') {
            throw new Error('This invite code has already been used. Please sign in instead.');
          }
          if (tmData.email.toLowerCase() !== normEmail) {
            throw new Error("Email doesn't match the invite. Use the email your admin registered.");
          }
          const cred = await auth().createUserWithEmailAndPassword(normEmail, password);
          const uid = cred.user.uid;
          const sId = shopIdFromPath(tmDoc.ref.path);
          if (!sId) throw new Error('Shop not found');

          await firestore().doc(`users/${uid}`).set({
            email: normEmail,
            role: resolveTeamRole(tmData),
            shopId: sId,
            teamMemberId: tmDoc.id,
            createdAt: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
            status: 'active',
          });
          await firestore().doc(tmDoc.ref.path).update({
            authUid: uid,
            inviteStatus: 'accepted',
            lastLoginAt: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
          });

          const shopDoc = await firestore().doc(`shops/${sId}`).get();
          const staffLike = teamMemberToStaff({ ...tmData, id: tmDoc.id, authUid: uid, inviteStatus: 'accepted' });
          applyResolved(staffLike, sId, pickShop(shopDoc.data()), tmDoc.ref.path, tmData.isOnline ?? false);
          setLoading(false);
        } else {
          // Legacy: staff collection.
          const staffSnap = await firestore()
            .collectionGroup('staff')
            .where('inviteCode', '==', cleanCode)
            .where('memberType', 'in', ['agent', 'plant', 'staff'])
            .get();
          if (staffSnap.empty) throw new Error('Invalid invite code. Please check and try again.');

          const staffDoc = staffSnap.docs[0];
          const staffData = staffDoc.data() as Staff;
          if (staffData.inviteStatus === 'accepted') {
            throw new Error('This invite code has already been used. Please sign in instead.');
          }
          if (staffData.email && staffData.email.toLowerCase() !== normEmail) {
            throw new Error("Email doesn't match the invite. Use the email your admin registered.");
          }
          const cred = await auth().createUserWithEmailAndPassword(normEmail, password);
          const uid = cred.user.uid;
          const sId = shopIdFromPath(staffDoc.ref.path);
          if (!sId) throw new Error('Shop not found');

          await firestore().doc(`users/${uid}`).set({
            email: normEmail,
            role: resolveTeamRole(staffData),
            shopId: sId,
            staffId: staffDoc.id,
            createdAt: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
            status: 'active',
          });
          await firestore().doc(staffDoc.ref.path).update({
            authUid: uid,
            email: normEmail,
            inviteStatus: 'accepted',
            lastLoginAt: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
          });

          const shopDoc = await firestore().doc(`shops/${sId}`).get();
          const resolved = { ...staffData, id: staffDoc.id, authUid: uid, email: normEmail, inviteStatus: 'accepted' as const };
          applyResolved(resolved as Staff, sId, pickShop(shopDoc.data()), staffDoc.ref.path, staffData.isOnline ?? false);
          setLoading(false);
        }
      } catch (err: any) {
        setError(err?.message || 'Sign up failed');
        setLoading(false);
        throw err;
      }
    },
    [applyResolved],
  );

  const signOutAgent = useCallback(() => {
    void auth().signOut();
  }, []);

  const setOnline = useCallback(
    async (online: boolean) => {
      if (!agentDocPath) return;
      try {
        await firestore().doc(agentDocPath).update({
          isOnline: online,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
        setIsOnline(online);
      } catch (err) {
        console.error('Error updating online status:', err);
      }
    },
    [agentDocPath],
  );

  const value: DriverAuthContextType = {
    agent,
    shopId,
    shopName,
    shop,
    teamAccess,
    loading,
    error,
    isOnline,
    signIn,
    signUp,
    signOutAgent,
    goOnline: () => setOnline(true),
    goOffline: () => setOnline(false),
  };

  return <DriverAuthContext.Provider value={value}>{children}</DriverAuthContext.Provider>;
}

function teamMemberToStaff(tm: TeamMember): Staff {
  return {
    id: tm.id,
    name: tm.name || tm.email,
    phone: (tm as any).phone || '',
    email: tm.email,
    // Keep agent→'staff' (unchanged); only surface the manager distinction within the staff surface.
    role: tm.memberType === 'plant' ? 'plant_operator' : (tm as any).role === 'manager' ? 'manager' : 'staff',
    memberType: tm.memberType,
    payType: 'monthly',
    baseSalary: 0,
    joiningDate: tm.createdAt as any,
    isActive: true,
    inviteCode: tm.inviteCode,
    inviteStatus: tm.inviteStatus,
    authUid: tm.authUid,
    vehicle: tm.vehicle,
    serviceAreas: tm.serviceAreas,
    isOnline: tm.isOnline,
    lastLoginAt: tm.lastLoginAt,
    createdAt: tm.createdAt,
    updatedAt: tm.updatedAt,
  } as Staff;
}

export function useDriverAuth() {
  const ctx = useContext(DriverAuthContext);
  if (!ctx) throw new Error('useDriverAuth must be used within a DriverAuthProvider');
  return ctx;
}
