/**
 * Staff App Auth Context
 * 
 * Firebase Auth (email + password) authentication for staff users
 * Staff must sign up with an invite code first, then login with email/password
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
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { Staff, TeamMember } from "@/types/staff";

interface StaffAuthContextType {
    staff: Staff | null;
    shopId: string | null;
    shopName: string | null;
    loading: boolean;
    error: string | null;
    firebaseUser: User | null;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, inviteCode: string) => Promise<void>;
    signOut: () => void;
}

const StaffAuthContext = createContext<StaffAuthContextType | null>(null);

export function StaffAuthProvider({ children }: { children: React.ReactNode }) {
    const [staff, setStaff] = useState<Staff | null>(null);
    const [shopId, setShopId] = useState<string | null>(null);
    const [shopName, setShopName] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

    // Listen to Firebase Auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setFirebaseUser(user);

            if (user) {
                try {
                    // 1. Try teamMembers first (new app logins). Retry once after delay so first-time
                    // login after signUp sees the doc (Firestore replication can lag).
                    let tmSnapshot = await getDocs(
                        query(
                            collectionGroup(db, "teamMembers"),
                            where("authUid", "==", user.uid),
                            where("memberType", "==", "staff")
                        )
                    );
                    if (tmSnapshot.empty) {
                        await new Promise((r) => setTimeout(r, 500));
                        tmSnapshot = await getDocs(
                            query(
                                collectionGroup(db, "teamMembers"),
                                where("authUid", "==", user.uid),
                                where("memberType", "==", "staff")
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
                                role: "staff",
                                memberType: "staff",
                                payType: "monthly",
                                baseSalary: 0,
                                joiningDate: tmData.createdAt,
                                isActive: true,
                                inviteCode: tmData.inviteCode,
                                inviteStatus: tmData.inviteStatus,
                                authUid: tmData.authUid,
                                lastLoginAt: tmData.lastLoginAt,
                                createdAt: tmData.createdAt,
                                updatedAt: tmData.updatedAt,
                            };
                            setStaff(staffLike);
                            setShopId(shopRef.id);
                            setShopName(shopDoc.data()?.name || "Shop");
                        }
                    } else {
                        // 2. Fallback: staff collection (legacy)
                        const staffQuery = query(
                            collectionGroup(db, "staff"),
                            where("authUid", "==", user.uid)
                        );
                        const staffSnapshot = await getDocs(staffQuery);
                        if (!staffSnapshot.empty) {
                            const staffDoc = staffSnapshot.docs[0];
                            const staffData = { id: staffDoc.id, ...staffDoc.data() } as Staff;
                            const shopDocRef = staffDoc.ref.parent.parent;
                            if (shopDocRef) {
                                const shopDoc = await getDoc(shopDocRef);
                                setStaff(staffData);
                                setShopId(shopDocRef.id);
                                setShopName(shopDoc.data()?.name || "Shop");
                            }
                        } else {
                            setStaff(null);
                            setShopId(null);
                            setShopName(null);
                        }
                    }
                } catch (err) {
                    console.error("Error fetching staff data:", err);
                    setError("Failed to load staff data");
                }
            } else {
                // User is signed out
                setStaff(null);
                setShopId(null);
                setShopName(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Sign in with email and password
    const signIn = useCallback(async (email: string, password: string) => {
        setLoading(true);
        setError(null);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);

            // Update lastLogin timestamp in users collection
            try {
                await updateDoc(doc(db, "users", userCredential.user.uid), {
                    lastLogin: serverTimestamp()
                });
            } catch (e) {
                // User doc might not exist for legacy accounts, don't fail the sign-in
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
            // Validate invite code format (XXXX-00000 where X is alphanumeric)
            const cleanCode = inviteCode.trim().toUpperCase();
            if (!/^[A-Z0-9]{4}-\d{5}$/.test(cleanCode)) {
                throw new Error("Invalid invite code format. Expected: XXXX-00000");
            }

            // 1. Try teamMembers first (Staff App users)
            const tmQuery = query(
                collectionGroup(db, "teamMembers"),
                where("inviteCode", "==", cleanCode),
                where("memberType", "==", "staff")
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

                await setDoc(doc(db, "users", uid), {
                    email: email.trim().toLowerCase(),
                    role: "staff",
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
                    role: "staff",
                    memberType: "staff",
                    payType: "monthly",
                    baseSalary: 0,
                    joiningDate: tmData.createdAt,
                    isActive: true,
                    inviteCode: tmData.inviteCode,
                    inviteStatus: "accepted",
                    authUid: uid,
                    lastLoginAt: undefined,
                    createdAt: tmData.createdAt,
                    updatedAt: tmData.updatedAt,
                };
                setStaff(staffLike);
                setShopId(shopRef.id);
                setShopName(shopDoc.data()?.name || "Shop");
                setLoading(false);
            } else {
                // 2. Fallback: staff collection (legacy)
                const staffQuery = query(
                    collectionGroup(db, "staff"),
                    where("inviteCode", "==", cleanCode)
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

                await setDoc(doc(db, "users", uid), {
                    email: email.trim().toLowerCase(),
                    role: "staff",
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
                const staffDataWithAuth = { ...staffData, id: staffDoc.id, authUid: uid, email: email.trim().toLowerCase(), inviteStatus: "accepted" as const };
                setStaff(staffDataWithAuth as Staff);
                setShopId(shopDocRef.id);
                setShopName(shopDoc.data()?.name || "Shop");
                setLoading(false);
            }

            // State already set above for first-time; onAuthStateChanged will keep it in sync on later logins
        } catch (err: any) {
            console.error("Sign up error:", err);
            if (err.code === "auth/email-already-in-use") {
                setError("This email is already registered. Try signing in instead.");
            } else if (err.code === "auth/weak-password") {
                setError("Password should be at least 6 characters");
            } else if (err.code === "auth/invalid-email") {
                setError("Please enter a valid email address");
            } else {
                setError(err.message || "Sign up failed");
            }
            setLoading(false);
            throw err;
        }
    }, []);

    // Sign out
    const signOut = useCallback(() => {
        firebaseSignOut(auth);
        setStaff(null);
        setShopId(null);
        setShopName(null);
        setError(null);
    }, []);

    return (
        <StaffAuthContext.Provider
            value={{
                staff,
                shopId,
                shopName,
                loading,
                error,
                firebaseUser,
                signIn,
                signUp,
                signOut,
            }}
        >
            {children}
        </StaffAuthContext.Provider>
    );
}

export function useStaffAuth() {
    const context = useContext(StaffAuthContext);
    if (!context) {
        throw new Error("useStaffAuth must be used within a StaffAuthProvider");
    }
    return context;
}

/**
 * Safe version of useStaffAuth that returns null when used outside StaffAuthProvider
 * Use this when the component may be rendered outside the staff context
 */
export function useStaffAuthOptional() {
    const context = useContext(StaffAuthContext);
    return context;
}
