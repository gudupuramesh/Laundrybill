/**
 * Super Admin Authentication Context
 * 
 * Manages authentication state for super admin users
 * Uses email whitelist for access control
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { User } from "firebase/auth";
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, app } from "@/lib/firebase";
import type { SuperAdmin } from "@/types/super-admin";
import { useSuperAdminFcmToken, useSuperAdminFcmForeground } from "@/hooks/use-super-admin-fcm";

// Whitelist of super admin emails
const SUPER_ADMIN_EMAILS = [
    "ramesh@laundrybill.com",
    "admin@laundrybill.com",
    "gudupuramesh@gmail.com",
    "superadmin@laundrybill.com", // New super admin
];

interface SuperAdminAuthContextType {
    superAdmin: SuperAdmin | null;
    firebaseUser: User | null;
    loading: boolean;
    error: string | null;
    signIn: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    isSuperAdmin: boolean;
}

const SuperAdminAuthContext = createContext<SuperAdminAuthContextType | null>(null);

export function SuperAdminAuthProvider({ children }: { children: React.ReactNode }) {
    const [superAdmin, setSuperAdmin] = useState<SuperAdmin | null>(null);
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Check if email is in whitelist
    const isEmailWhitelisted = useCallback((email: string | null): boolean => {
        if (!email) return false;
        return SUPER_ADMIN_EMAILS.some(
            (adminEmail) => adminEmail.toLowerCase() === email.toLowerCase()
        );
    }, []);

    // Listen for auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setFirebaseUser(user);

            if (user && isEmailWhitelisted(user.email)) {
                try {
                    // Fetch or create super admin document
                    const adminRef = doc(db, "super_admins", user.uid);
                    const adminDoc = await getDoc(adminRef);

                    if (adminDoc.exists()) {
                        const data = adminDoc.data();
                        setSuperAdmin({
                            id: adminDoc.id,
                            email: data.email,
                            name: data.name || user.displayName || "Admin",
                            phone: data.phone,
                            role: data.role || "admin",
                            permissions: data.permissions || {
                                manageShops: true,
                                manageSubscriptions: true,
                                managePayments: true,
                                manageAds: true,
                                viewAnalytics: true,
                                manageAdmins: false,
                            },
                            isActive: data.isActive ?? true,
                            lastLoginAt: data.lastLoginAt,
                            createdAt: data.createdAt,
                            updatedAt: data.updatedAt,
                        });

                        // Update last login
                        await setDoc(adminRef, { lastLoginAt: serverTimestamp() }, { merge: true });
                    } else {
                        // Create super admin document for first-time login
                        const newAdmin: Omit<SuperAdmin, "id"> = {
                            email: user.email!,
                            name: user.displayName || "Super Admin",
                            role: "admin",
                            permissions: {
                                manageShops: true,
                                manageSubscriptions: true,
                                managePayments: true,
                                manageAds: true,
                                viewAnalytics: true,
                                manageAdmins: false,
                            },
                            isActive: true,
                            createdAt: serverTimestamp() as any,
                            updatedAt: serverTimestamp() as any,
                            lastLoginAt: serverTimestamp() as any,
                        };

                        await setDoc(adminRef, newAdmin);
                        setSuperAdmin({ id: user.uid, ...newAdmin } as SuperAdmin);
                    }
                    setError(null);
                } catch (err) {
                    console.error("Failed to fetch super admin:", err);
                    setError("Failed to load admin data");
                    setSuperAdmin(null);
                }
            } else {
                setSuperAdmin(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, [isEmailWhitelisted]);

    // Sign in with email/password
    const signIn = async (email: string, password: string) => {
        setLoading(true);
        setError(null);

        // Check whitelist first
        if (!isEmailWhitelisted(email)) {
            setError("Unauthorized: This email is not authorized for super admin access");
            setLoading(false);
            throw new Error("Unauthorized access");
        }

        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err: any) {
            const message = err.code === "auth/wrong-password" || err.code === "auth/user-not-found"
                ? "Invalid email or password"
                : err.message || "Failed to sign in";
            setError(message);
            setLoading(false);
            throw new Error(message);
        }
    };

    // Sign out
    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
            setSuperAdmin(null);
        } catch (err) {
            console.error("Failed to sign out:", err);
        }
    };

    // Register FCM token for push notifications (new shop alerts, etc.)
    useSuperAdminFcmToken(app, superAdmin?.id ?? null);
    useSuperAdminFcmForeground(app);

    const value: SuperAdminAuthContextType = {
        superAdmin,
        firebaseUser,
        loading,
        error,
        signIn,
        signOut,
        isSuperAdmin: !!superAdmin && superAdmin.isActive,
    };

    return (
        <SuperAdminAuthContext.Provider value={value}>
            {children}
        </SuperAdminAuthContext.Provider>
    );
}

export function useSuperAdmin() {
    const context = useContext(SuperAdminAuthContext);
    if (!context) {
        throw new Error("useSuperAdmin must be used within SuperAdminAuthProvider");
    }
    return context;
}
