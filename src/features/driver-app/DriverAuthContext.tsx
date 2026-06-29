/**
 * Driver App Auth Context
 * 
 * Firebase Auth (email + password) authentication for delivery agents
 * Agent must sign up with an invite code first (like Staff), then login with email/password
 * Only allows staff members with memberType: 'agent'
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    type User,
} from "firebase/auth";
import {
    collectionGroup,
    query,
    where,
    getDocs,
    getDoc,
    updateDoc,
    serverTimestamp,
    doc,
    setDoc,
    onSnapshot,
} from "firebase/firestore";
import type { DocumentSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { releaseWebSession } from "@/lib/session-guard";
import type { Staff, TeamMember } from "@/types/staff";

interface DriverAuthContextType {
    agent: Staff | null;           // The agent's staff record
    shopId: string | null;
    shopName: string | null;
    loading: boolean;
    error: string | null;
    firebaseUser: User | null;
    isOnline: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, inviteCode: string) => Promise<void>;
    signOut: () => void;
    goOnline: () => Promise<void>;
    goOffline: () => Promise<void>;
}

const DriverAuthContext = createContext<DriverAuthContextType | null>(null);

export function DriverAuthProvider({ children }: { children: React.ReactNode }) {
    const [agent, setAgent] = useState<Staff | null>(null);
    const [shopId, setShopId] = useState<string | null>(null);
    const [shopName, setShopName] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [isOnline, setIsOnline] = useState(false);
    const [agentDocRef, setAgentDocRef] = useState<any>(null);

    // Listen to Firebase Auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setFirebaseUser(user);

            if (user) {
                try {
                    // 1. Try teamMembers first (agent/plant). Retry once after delay so first-time
                    // login after signUp sees the doc (Firestore replication can lag).
                    let tmSnapshot = await getDocs(
                        query(
                            collectionGroup(db, "teamMembers"),
                            where("authUid", "==", user.uid),
                            where("memberType", "in", ["agent", "plant"])
                        )
                    );
                    if (tmSnapshot.empty) {
                        await new Promise((r) => setTimeout(r, 500));
                        tmSnapshot = await getDocs(
                            query(
                                collectionGroup(db, "teamMembers"),
                                where("authUid", "==", user.uid),
                                where("memberType", "in", ["agent", "plant"])
                            )
                        );
                    }

                    if (!tmSnapshot.empty) {
                        const tmDoc = tmSnapshot.docs[0];
                        const tmData = { id: tmDoc.id, ...tmDoc.data() } as TeamMember;
                        const shopRef = tmDoc.ref.parent.parent;
                        if (shopRef) {
                            const shopDoc = await getDoc(shopRef);
                            const staffLike: Staff = {
                                id: tmData.id,
                                name: tmData.name || tmData.email,
                                phone: "",
                                email: tmData.email,
                                role: tmData.memberType === "plant" ? "plant_operator" : "staff",
                                memberType: tmData.memberType,
                                payType: "monthly",
                                baseSalary: 0,
                                joiningDate: tmData.createdAt,
                                isActive: true,
                                inviteCode: tmData.inviteCode,
                                inviteStatus: tmData.inviteStatus,
                                authUid: tmData.authUid,
                                vehicle: tmData.vehicle,
                                serviceAreas: tmData.serviceAreas,
                                isOnline: tmData.isOnline,
                                lastLoginAt: tmData.lastLoginAt,
                                createdAt: tmData.createdAt,
                                updatedAt: tmData.updatedAt,
                            };
                            setAgent(staffLike);
                            setShopId(shopRef.id);
                            setShopName(shopDoc.data()?.name || "Shop");
                            setIsOnline(tmData.isOnline ?? false);
                            setAgentDocRef(tmDoc.ref);
                        }
                    } else {
                        // 2. Fallback: staff collection (legacy)
                        const staffQuery = query(
                            collectionGroup(db, "staff"),
                            where("authUid", "==", user.uid),
                            where("memberType", "in", ["agent", "plant"])
                        );
                        const staffSnapshot = await getDocs(staffQuery);
                        if (!staffSnapshot.empty) {
                            const staffDoc = staffSnapshot.docs[0];
                            const staffData = { id: staffDoc.id, ...staffDoc.data() } as Staff;
                            const shopDocRef = staffDoc.ref.parent.parent;
                            if (shopDocRef) {
                                const shopDoc = await getDoc(shopDocRef);
                                setAgent(staffData);
                                setShopId(shopDocRef.id);
                                setShopName(shopDoc.data()?.name || "Shop");
                                setIsOnline(staffData.isOnline ?? false);
                                setAgentDocRef(staffDoc.ref);
                            }
                        } else {
                            setAgent(null);
                            setShopId(null);
                            setShopName(null);
                        }
                    }
                } catch (err) {
                    console.error("Error fetching agent data:", err);
                    setError("Failed to load agent data");
                }
            } else {
                // User is signed out
                setAgent(null);
                setShopId(null);
                setShopName(null);
                setIsOnline(false);
                setAgentDocRef(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Realtime listener for isOnline (so owner changes reflect immediately for agent)
    useEffect(() => {
        if (!agentDocRef) return;
        const unsub = onSnapshot(agentDocRef, (snap: DocumentSnapshot) => {
            const data = snap.data();
            if (data && typeof data.isOnline === "boolean") {
                setIsOnline(data.isOnline);
            }
        });
        return () => unsub();
    }, [agentDocRef?.path]);

    // Sign in with email and password
    const signIn = useCallback(async (email: string, password: string) => {
        setLoading(true);
        setError(null);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);

            // Update lastLogin timestamp
            try {
                await updateDoc(doc(db, "users", userCredential.user.uid), {
                    lastLogin: serverTimestamp()
                });
            } catch (e) {
                console.warn("Could not update lastLogin:", e);
            }

            // The onAuthStateChanged listener will handle the rest
        } catch (err: any) {
            console.error("Sign in error:", err);
            if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
                setError("Invalid email or password");
            } else if (err.code === "auth/invalid-email") {
                setError("Please enter a valid email address");
            } else {
                setError(err.message || "Sign in failed");
            }
            setLoading(false);
            throw err;
        }
    }, []);

    // Sign up with email, password, and invite code
    const signUp = useCallback(async (email: string, password: string, inviteCode: string) => {
        setLoading(true);
        setError(null);

        try {
            // Validate invite code format (XXXX-00000 where X is alphanumeric, 0 is digit)
            const cleanCode = inviteCode.trim().toUpperCase();
            if (!/^[A-Z0-9]{4}-\d{5}$/.test(cleanCode)) {
                throw new Error("Invalid invite code format. Expected: XXXX-00000");
            }

            // 1. Try teamMembers first (agent/plant)
            const tmQuery = query(
                collectionGroup(db, "teamMembers"),
                where("inviteCode", "==", cleanCode),
                where("memberType", "in", ["agent", "plant"])
            );
            const tmSnapshot = await getDocs(tmQuery);

            if (!tmSnapshot.empty) {
                const tmDoc = tmSnapshot.docs[0];
                const tmData = tmDoc.data() as TeamMember;
                if (tmData.inviteStatus === "accepted") {
                    throw new Error("This invite code has already been used. Please sign in instead.");
                }
                if (tmData.email.toLowerCase() !== email.trim().toLowerCase()) {
                    throw new Error("Email doesn't match the invite. Please use the email your admin registered.");
                }
                const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
                const uid = userCredential.user.uid;
                const shopRef = tmDoc.ref.parent.parent;
                if (!shopRef) throw new Error("Shop not found");
                const userRole = tmData.memberType === "plant" ? "plant_operator" : "agent";

                await setDoc(doc(db, "users", uid), {
                    email: email.trim().toLowerCase(),
                    role: userRole,
                    shopId: shopRef.id,
                    teamMemberId: tmDoc.id,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    status: "active",
                });

                await updateDoc(tmDoc.ref, {
                    authUid: uid,
                    inviteStatus: "accepted",
                    lastLoginAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });

                // Set state immediately so first-time login lands on dashboard without waiting for
                // onAuthStateChanged's query (which can miss the just-written authUid due to replication delay).
                const shopDoc = await getDoc(shopRef);
                const staffLike: Staff = {
                    id: tmDoc.id,
                    name: tmData.name || tmData.email,
                    phone: "",
                    email: tmData.email,
                    role: tmData.memberType === "plant" ? "plant_operator" : "staff",
                    memberType: tmData.memberType,
                    payType: "monthly",
                    baseSalary: 0,
                    joiningDate: tmData.createdAt,
                    isActive: true,
                    inviteCode: tmData.inviteCode,
                    inviteStatus: "accepted",
                    authUid: uid,
                    vehicle: tmData.vehicle,
                    serviceAreas: tmData.serviceAreas,
                    isOnline: tmData.isOnline ?? false,
                    lastLoginAt: undefined,
                    createdAt: tmData.createdAt,
                    updatedAt: tmData.updatedAt,
                };
                setAgent(staffLike);
                setShopId(shopRef.id);
                setShopName(shopDoc.data()?.name || "Shop");
                setIsOnline(tmData.isOnline ?? false);
                setAgentDocRef(tmDoc.ref);
                setLoading(false);
            } else {
                // 2. Fallback: staff collection (legacy)
                const staffQuery = query(
                    collectionGroup(db, "staff"),
                    where("inviteCode", "==", cleanCode),
                    where("memberType", "in", ["agent", "plant"])
                );
                const staffSnapshot = await getDocs(staffQuery);
                if (staffSnapshot.empty) {
                    throw new Error("Invalid invite code. Please check and try again.");
                }

                const staffDoc = staffSnapshot.docs[0];
                const staffData = staffDoc.data() as Staff;
                if (staffData.inviteStatus === "accepted") {
                    throw new Error("This invite code has already been used. Please sign in instead.");
                }
                if (staffData.email && staffData.email.toLowerCase() !== email.trim().toLowerCase()) {
                    throw new Error("Email doesn't match the invite. Please use the email your admin registered.");
                }

                const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
                const uid = userCredential.user.uid;
                const shopDocRef = staffDoc.ref.parent.parent;
                if (!shopDocRef) throw new Error("Shop not found");
                const userRole = staffData.memberType === "plant" ? "plant_operator" : "agent";

                await setDoc(doc(db, "users", uid), {
                    email: email.trim().toLowerCase(),
                    role: userRole,
                    shopId: shopDocRef.id,
                    staffId: staffDoc.id,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    status: "active",
                });

                await updateDoc(staffDoc.ref, {
                    authUid: uid,
                    email: email.trim().toLowerCase(),
                    inviteStatus: "accepted",
                    lastLoginAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });

                const shopDoc = await getDoc(shopDocRef);
                const staffDataWithAuth = {
                    ...staffData,
                    id: staffDoc.id,
                    authUid: uid,
                    email: email.trim().toLowerCase(),
                    inviteStatus: "accepted" as const,
                };
                setAgent(staffDataWithAuth as Staff);
                setShopId(shopDocRef.id);
                setShopName(shopDoc.data()?.name || "Shop");
                setIsOnline(staffData.isOnline ?? false);
                setAgentDocRef(staffDoc.ref);
                setLoading(false);
            }

            // State already set above for first-time; onAuthStateChanged will keep it in sync on later logins
        } catch (err: any) {
            console.error("Sign up error:", err);
            setError(err.message || "Sign up failed");
            setLoading(false);
            throw err;
        }
    }, []);

    // Sign out
    const signOut = useCallback(() => {
        void releaseWebSession(auth.currentUser?.uid || "");
        firebaseSignOut(auth);
    }, []);

    // Go online - set isOnline to true
    const goOnline = useCallback(async () => {
        if (!agentDocRef) return;
        try {
            await updateDoc(agentDocRef, {
                isOnline: true,
                updatedAt: serverTimestamp()
            });
            setIsOnline(true);
        } catch (err) {
            console.error("Error going online:", err);
        }
    }, [agentDocRef]);

    // Go offline - set isOnline to false
    const goOffline = useCallback(async () => {
        if (!agentDocRef) return;
        try {
            await updateDoc(agentDocRef, {
                isOnline: false,
                updatedAt: serverTimestamp()
            });
            setIsOnline(false);
        } catch (err) {
            console.error("Error going offline:", err);
        }
    }, [agentDocRef]);

    const value: DriverAuthContextType = {
        agent,
        shopId,
        shopName,
        loading,
        error,
        firebaseUser,
        isOnline,
        signIn,
        signUp,
        signOut,
        goOnline,
        goOffline,
    };

    return (
        <DriverAuthContext.Provider value={value}>
            {children}
        </DriverAuthContext.Provider>
    );
}

export function useDriverAuth() {
    const context = useContext(DriverAuthContext);
    if (!context) {
        throw new Error("useDriverAuth must be used within a DriverAuthProvider");
    }
    return context;
}

/** Like useDriverAuth but returns null outside the agent portal (for code shared across portals). */
export function useDriverAuthOptional() {
    return useContext(DriverAuthContext);
}
