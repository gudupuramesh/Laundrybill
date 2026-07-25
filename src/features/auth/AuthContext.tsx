/**
 * Authentication Context
 * 
 * Multi-provider authentication (Phone OTP + Google) for LaundryBill
 */

import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
    onAuthStateChanged,
    signInWithPhoneNumber,
    signInWithPopup,
    signInWithCredential,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    OAuthProvider,
    RecaptchaVerifier,
    signOut as firebaseSignOut,
} from "firebase/auth";
import type { User, ConfirmationResult } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, limit, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { buildNewShopData, seedDefaultInventory } from "@/lib/new-shop";
import { claimWebSession, releaseWebSession, teardownWebSession } from "@/lib/session-guard";
import { LSpinner } from "@/components/laundry";
import { loadLanguageFromFirebase } from "@/lib/i18n";

// Simplified user type for auth
interface AuthUser {
    uid: string;
    email: string | null;
    phone: string | null;
    displayName: string | null;
    photoURL: string | null;
}

interface AuthState {
    user: AuthUser | null;
    shopId: string | null;
    shopName: string | null;
    role: "admin" | "manager" | "staff" | "plant_operator" | "agent" | null;
    loading: boolean;
    error: string | null;
    isNewUser: boolean;
}

/** A shop owned by the signed-in owner (multi-shop / franchise). */
export interface OwnedShop {
    id: string;
    name: string;
}

interface AuthContextType extends AuthState {
    // Phone OTP
    sendOtp: (phone: string) => Promise<void>;
    verifyOtp: (code: string) => Promise<void>;
    // Google (web popup + Android native via idToken)
    signInWithGoogle: () => Promise<void>;
    signInWithGoogleIdToken: (idToken: string) => Promise<void>;
    // Apple (web popup) — lets users who signed up with Apple on iOS log in here too
    signInWithApple: () => Promise<void>;
    // Email/Password
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUpWithEmail: (email: string, password: string) => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    // Common
    signOut: () => Promise<void>;
    clearError: () => void;
    // New user setup
    completeSignup: (shopName: string, additionalData?: Record<string, unknown>) => Promise<void>;
    // ── Multi-shop (owners) ────────────────────────────────────────────────
    /** The owner's PRIMARY shop (users/{uid}.shopId) — billing always targets it. */
    primaryShopId: string | null;
    /** Every shop this owner owns (ownerId == uid). Single-shop owners: 1 entry. */
    ownedShops: OwnedShop[];
    /** Switch the ACTIVE shop (client-local; no Firestore write). */
    switchShop: (shopId: string) => void;
    /** Re-query owned shops (e.g. after Add Shop). */
    refreshOwnedShops: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Google provider instance
const googleProvider = new GoogleAuthProvider();

// Apple provider instance (web popup). The same Apple ID resolves to the same
// Firebase account as the iOS app, so Apple-signup users can log in on web too.
const appleProvider = new OAuthProvider("apple.com");
appleProvider.addScope("email");
appleProvider.addScope("name");

// Reserved single-segment paths that are app routes (NOT public shop slugs at /:shopSlug).
// Keep in sync with the static routes in App.tsx so a real shop page never claims the
// owner's web session, and the owner's own app routes still do.
const RESERVED_TOP_LEVEL = new Set([
    "login", "track", "receipt", "order", "team", "staff", "agent", "plant", "super-admin",
    "dashboard", "scan", "new-order", "orders", "customers", "inventory", "manage-staff",
    "attendance", "payroll", "expenses", "reports", "apps", "settings", "shop-settings",
    "delivery-settings", "help", "subscription", "shops",
]);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<AuthState>({
        user: null,
        shopId: null,
        shopName: null,
        role: null,
        loading: true,
        error: null,
        isNewUser: false,
    });

    const [confirmationResult, setConfirmationResult] =
        useState<ConfirmationResult | null>(null);
    const [recaptchaVerifier, setRecaptchaVerifier] =
        useState<RecaptchaVerifier | null>(null);
    const [pendingUser, setPendingUser] = useState<User | null>(null);

    // ── Multi-shop (owners) ────────────────────────────────────────────────
    // state.shopId stays the PRIMARY shop (users/{uid}.shopId — never rewritten
    // on switch). The ACTIVE shop is client-local: context overrides shopId/
    // shopName with the selection, persisted per-uid in localStorage. Access to
    // non-primary shops is authorized by rules' isShopOwner (shops.ownerId).
    const [ownedShops, setOwnedShops] = useState<OwnedShop[]>([]);
    const [activeShop, setActiveShop] = useState<OwnedShop | null>(null);

    const activeShopStorageKey = (uid: string) => `lb_active_shop_${uid}`;

    const loadOwnedShops = async (uid: string, primaryId: string | null): Promise<void> => {
        try {
            // NOTE: multi-shop is keyed on shops.ownerId == uid (what the security
            // rules' isShopOwner authorizes). A cross-provider LINKED identity (uid
            // != ownerId) gets an empty list here → no switcher; its primary shop
            // still works via users.shopId (isShopMember). Multi-shop owners should
            // use their original sign-in method.
            const snap = await getDocs(query(collection(db, "shops"), where("ownerId", "==", uid)));
            const shops: OwnedShop[] = snap.docs
                .map((d) => ({ id: d.id, name: (d.data().name as string) || "My shop" }))
                // Primary shop first, then by name for a stable menu order.
                .sort((a, b) => (a.id === primaryId ? -1 : b.id === primaryId ? 1 : a.name.localeCompare(b.name)));
            setOwnedShops(shops);
            // Restore the persisted active-shop selection (only if still owned).
            const savedId = typeof window !== "undefined" ? window.localStorage.getItem(activeShopStorageKey(uid)) : null;
            const saved = savedId ? shops.find((s) => s.id === savedId) : undefined;
            setActiveShop(saved && saved.id !== primaryId ? saved : null);
        } catch (e) {
            console.warn("Could not load owned shops:", e);
            setOwnedShops([]);
            setActiveShop(null);
        }
    };

    const refreshOwnedShops = async (): Promise<void> => {
        const uid = auth.currentUser?.uid;
        if (uid) await loadOwnedShops(uid, state.shopId);
    };

    const switchShop = (shopId: string) => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const target = ownedShops.find((s) => s.id === shopId);
        if (!target) return;
        if (target.id === state.shopId) {
            // Back to the primary shop — clear the override.
            setActiveShop(null);
            try { window.localStorage.removeItem(activeShopStorageKey(uid)); } catch { /* ignore */ }
        } else {
            setActiveShop(target);
            try { window.localStorage.setItem(activeShopStorageKey(uid), target.id); } catch { /* ignore */ }
        }
    };

    // Load the owned-shops list whenever an OWNER account settles (team members
    // and signed-out states clear it).
    useEffect(() => {
        const uid = state.user?.uid;
        if (uid && state.shopId && state.role === "admin") {
            loadOwnedShops(uid, state.shopId);
        } else {
            setOwnedShops([]);
            setActiveShop(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.user?.uid, state.shopId, state.role]);

    // Initialize recaptcha
    useEffect(() => {
        const initRecaptcha = () => {
            const container = document.getElementById("recaptcha-container");
            if (!container) {
                setTimeout(initRecaptcha, 100);
                return;
            }

            try {
                const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
                    size: "invisible",
                    callback: () => {
                        // reCAPTCHA solved
                    },
                });
                setRecaptchaVerifier(verifier);
            } catch (error) {
                console.error("Error initializing reCAPTCHA:", error);
            }
        };

        initRecaptcha();

        return () => {
            recaptchaVerifier?.clear();
        };
    }, []);

    // Listen to auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            console.log("[Auth] onAuthStateChanged fired, user:", firebaseUser?.email ?? "null", "uid:", firebaseUser?.uid ?? "none");
            if (firebaseUser) {
                // One-active-web-session: claim/watch this account's web slot (covers owner + team,
                // since this provider is top-level). Idempotent per uid.
                // Skip public customer-facing pages (booking / tracking / receipt): opening one while
                // logged in must NOT re-claim the web slot and evict the owner's real dashboard tab.
                const path = typeof window !== "undefined" ? window.location.pathname : "";
                // A single-segment path that isn't a reserved app route is a public shop page
                // (clean URL /:shopSlug) — don't claim/evict on it.
                const seg = path.split("/").filter(Boolean);
                const isPublicShopSlug = seg.length === 1 && !RESERVED_TOP_LEVEL.has(seg[0].toLowerCase());
                // Team-portal routes (staff/agent/plant login + their apps) run their OWN auth.
                // Opening one in a new tab while the owner is logged in must NOT re-claim the
                // owner's single web-session slot — that would evict the owner's dashboard tab.
                const isTeamPortalRoute =
                    path.startsWith("/team") || path.startsWith("/staff") || path.startsWith("/agent") || path.startsWith("/plant");
                const isPublicRoute =
                    path.startsWith("/order/") || path.startsWith("/track") || path.startsWith("/receipt/") || isPublicShopSlug || isTeamPortalRoute;
                if (!isPublicRoute) {
                    claimWebSession(firebaseUser.uid);
                }
                try {
                    // Check if user document exists
                    const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));

                    if (userDoc.exists()) {
                        const userData = userDoc.data();

                        // Load user's language preference from Firebase
                        await loadLanguageFromFirebase(firebaseUser.uid);

                        // Team members carry teamMemberId on their users doc. Their EFFECTIVE
                        // role always comes from the live teamMembers doc — a stale or wrongly
                        // written users.role (e.g. "staff" for a manager, or worse "admin")
                        // must never decide what a team login can access.
                        let effectiveRole = (userData.role || "admin") as AuthState["role"];
                        if (userData.teamMemberId && userData.shopId) {
                            try {
                                const tmSnap = await getDoc(
                                    doc(db, "shops", userData.shopId, "teamMembers", userData.teamMemberId)
                                );
                                if (tmSnap.exists()) {
                                    const tm = tmSnap.data() as { memberType?: string; role?: string };
                                    effectiveRole =
                                        tm.memberType === "plant" ? "plant_operator"
                                        : tm.memberType === "agent" ? "agent"
                                        : tm.role === "manager" ? "manager"
                                        : "staff";
                                    if (effectiveRole !== userData.role) {
                                        // Self-heal the stored role so other readers converge too.
                                        updateDoc(doc(db, "users", firebaseUser.uid), {
                                            role: effectiveRole,
                                            updatedAt: serverTimestamp(),
                                        }).catch(() => {});
                                    }
                                }
                            } catch { /* transient read error — keep the stored role */ }
                        }

                        setState({
                            user: {
                                uid: firebaseUser.uid,
                                email: firebaseUser.email,
                                phone: firebaseUser.phoneNumber,
                                displayName: firebaseUser.displayName,
                                photoURL: firebaseUser.photoURL,
                            },
                            shopId: userData.shopId,
                            shopName: userData.shopName,
                            role: effectiveRole,
                            loading: false,
                            error: null,
                            isNewUser: false,
                        });
                    } else {
                        // Check if this is a staff member (they won't have a users doc)
                        // Staff users have authUid set in their staff document
                        const { collectionGroup } = await import("firebase/firestore");
                        const staffQuery = query(
                            collectionGroup(db, "staff"),
                            where("authUid", "==", firebaseUser.uid)
                        );
                        const staffSnapshot = await getDocs(staffQuery);

                        if (!staffSnapshot.empty) {
                            // This is a staff member - don't treat as new owner
                            // Let StaffAuthContext handle them
                            setState({
                                user: {
                                    uid: firebaseUser.uid,
                                    email: firebaseUser.email,
                                    phone: firebaseUser.phoneNumber,
                                    displayName: firebaseUser.displayName,
                                    photoURL: firebaseUser.photoURL,
                                },
                                shopId: null,
                                shopName: null,
                                role: "staff",
                                loading: false,
                                error: null,
                                isNewUser: false, // Staff - not a new owner
                            });
                        } else {
                            // Cross-provider: check if this auth identity's email/phone matches an existing shop.
                            // If so, auto-associate this UID with that shop (same person, different sign-in method).
                            // Multi-shop safe: with several owned shops sharing contact info, always link to
                            // the PRIMARY shop (doc id == ownerId), never an arbitrary child shop.
                            const pickPrimaryShop = (
                                docs: Array<{ id: string; data: () => Record<string, unknown> }>
                            ): { id: string; name: string } | null => {
                                if (!docs.length) return null;
                                const primary = docs.find((d) => d.id === (d.data().ownerId as string));
                                const oldest = [...docs].sort((a, b) => {
                                    const ta = (a.data().createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
                                    const tb = (b.data().createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
                                    return ta - tb;
                                })[0];
                                const pick = primary || oldest;
                                return { id: pick.id, name: (pick.data().name as string) || "" };
                            };
                            let matchedShop: { id: string; name: string } | null = null;

                            if (firebaseUser.email) {
                                const emailQ = query(
                                    collection(db, "shops"),
                                    where("email", "==", firebaseUser.email.trim().toLowerCase()),
                                    limit(10)
                                );
                                const emailSnap = await getDocs(emailQ);
                                matchedShop = pickPrimaryShop(emailSnap.docs);
                            }

                            if (!matchedShop && firebaseUser.phoneNumber) {
                                const digits = firebaseUser.phoneNumber.replace(/\D/g, "").slice(-10);
                                if (digits.length === 10) {
                                    const withPrefix = `+91${digits}`;
                                    const [q1, q2] = [
                                        query(collection(db, "shops"), where("phone", "==", withPrefix), limit(10)),
                                        query(collection(db, "shops"), where("phone", "==", digits), limit(10)),
                                    ];
                                    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
                                    const snap = !snap1.empty ? snap1 : snap2;
                                    matchedShop = pickPrimaryShop(snap.docs);
                                }
                            }

                            if (matchedShop) {
                                // Create users/{uid} doc linking this auth identity to the existing shop
                                await setDoc(doc(db, "users", firebaseUser.uid), {
                                    email: firebaseUser.email,
                                    phone: firebaseUser.phoneNumber,
                                    displayName: firebaseUser.displayName,
                                    photoURL: firebaseUser.photoURL,
                                    shopId: matchedShop.id,
                                    shopName: matchedShop.name,
                                    role: "admin",
                                    createdAt: serverTimestamp(),
                                });
                                await loadLanguageFromFirebase(firebaseUser.uid);
                                setState({
                                    user: {
                                        uid: firebaseUser.uid,
                                        email: firebaseUser.email,
                                        phone: firebaseUser.phoneNumber,
                                        displayName: firebaseUser.displayName,
                                        photoURL: firebaseUser.photoURL,
                                    },
                                    shopId: matchedShop.id,
                                    shopName: matchedShop.name,
                                    role: "admin",
                                    loading: false,
                                    error: null,
                                    isNewUser: false,
                                });
                            } else {
                                // New owner user - needs to complete signup
                                setPendingUser(firebaseUser);
                                setState({
                                    user: {
                                        uid: firebaseUser.uid,
                                        email: firebaseUser.email,
                                        phone: firebaseUser.phoneNumber,
                                        displayName: firebaseUser.displayName,
                                        photoURL: firebaseUser.photoURL,
                                    },
                                    shopId: null,
                                    shopName: null,
                                    role: null,
                                    loading: false,
                                    error: null,
                                    isNewUser: true,
                                });
                            }
                        }
                    }
                } catch (error) {
                    console.error("Error fetching user profile:", error);
                    setState({
                        user: null,
                        shopId: null,
                        shopName: null,
                        role: null,
                        loading: false,
                        error: "Failed to load profile. Please try again.",
                        isNewUser: false,
                    });
                }
            } else {
                teardownWebSession(); // stop watching the web session slot on any sign-out
                setState({
                    user: null,
                    shopId: null,
                    shopName: null,
                    role: null,
                    loading: false,
                    error: null,
                    isNewUser: false,
                });
                setPendingUser(null);
            }
        });

        return unsubscribe;
    }, []);

    // Complete signup for new users
    const completeSignup = async (shopName: string, additionalData?: Record<string, unknown>) => {
        if (!pendingUser) {
            throw new Error("No pending user to complete signup");
        }

        setState((prev) => ({ ...prev, loading: true, error: null }));

        try {
            const userId = pendingUser.uid;



            // Try to detect location for initial service area
            let initialServiceAreas: any[] = [];
            let enableServiceAreas = false;

            try {
                if (navigator.geolocation) {
                    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
                    });

                    const { latitude, longitude } = position.coords;
                    const response = await fetch(
                        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
                    );
                    const data = await response.json();

                    if (data.status === "OK" && data.results.length > 0) {
                        const result = data.results[0];
                        let areaName = "";

                        // Extract locality/sublocality
                        for (const component of result.address_components) {
                            if (component.types.includes("sublocality_level_1") || component.types.includes("sublocality")) {
                                areaName = component.long_name;
                                break;
                            }
                            if (!areaName && component.types.includes("neighborhood")) areaName = component.long_name;
                            if (!areaName && component.types.includes("locality")) areaName = component.long_name;
                        }

                        if (areaName) {
                            initialServiceAreas = [{
                                id: crypto.randomUUID(),
                                value: areaName,
                                isActive: true
                            }];
                            enableServiceAreas = true;
                        }
                    }
                }
            } catch (err) {
                console.warn("Could not auto-detect location during signup:", err);
                // Continue without initial area
            }

            // Build the shop document — merge additionalData (phone, email, location, country from welcome page)
            // so everything is saved in one atomic write (no race condition with navigation redirect)
            // Country/currency settings come from LoginPage's country dropdown via additionalData
            const shopData = buildNewShopData(shopName, userId, {
                phone: (additionalData?.phone as string) || pendingUser.phoneNumber || null,
                email: (additionalData?.email as string) || pendingUser.email || null,
                location: (additionalData?.location as string) || null,
                currency: additionalData?.currency as string | undefined,
                currencySymbol: additionalData?.currencySymbol as string | undefined,
                countryCode: additionalData?.countryCode as string | undefined,
                phoneCountryCode: additionalData?.phoneCountryCode as string | undefined,
                locale: additionalData?.locale as string | undefined,
                timezone: additionalData?.timezone as string | undefined,
                taxName: additionalData?.taxName as string | undefined,
                initialServiceAreas,
                enableServiceAreas,
            });

            // Create shop document (shop ID = user ID for owner)
            await setDoc(doc(db, "shops", userId), shopData);

            // Seed default categories and inventory
            await seedDefaultInventory(userId);

            // Create user document
            await setDoc(doc(db, "users", userId), {
                email: pendingUser.email,
                phone: pendingUser.phoneNumber,
                displayName: pendingUser.displayName,
                photoURL: pendingUser.photoURL,
                shopId: userId,
                shopName: shopName,
                role: "admin",
                createdAt: serverTimestamp(),
            });

            // Update state
            setState({
                user: {
                    uid: userId,
                    email: pendingUser.email,
                    phone: pendingUser.phoneNumber,
                    displayName: pendingUser.displayName,
                    photoURL: pendingUser.photoURL,
                },
                shopId: userId,
                shopName: shopName,
                role: "admin",
                loading: false,
                error: null,
                isNewUser: false,
            });

            setPendingUser(null);
        } catch (error) {
            console.error("Error completing signup:", error);
            const message = error instanceof Error ? error.message : "Failed to create shop";
            setState((prev) => ({
                ...prev,
                loading: false,
                error: message,
            }));
            throw error;
        }
    };

    // Google Sign-In (popup for web)
    const signInWithGoogle = async () => {
        setState((prev) => ({ ...prev, loading: true, error: null }));

        try {
            const result = await signInWithPopup(auth, googleProvider);
            console.log("[Auth] Google sign-in successful for", result.user.email);
            // Auth state listener will handle the rest
        } catch (error: unknown) {
            console.error("Error signing in with Google:", error);
            const message = error instanceof Error ? error.message : "Failed to sign in with Google";
            setState((prev) => ({
                ...prev,
                loading: false,
                error: message,
            }));
            throw error;
        }
    };

    // Apple Sign-In (popup for web) — mirrors Google; the auth state listener handles the rest
    const signInWithApple = async () => {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        try {
            const result = await signInWithPopup(auth, appleProvider);
            console.log("[Auth] Apple sign-in successful for", result.user.email);
        } catch (error: unknown) {
            console.error("Error signing in with Apple:", error);
            const message = error instanceof Error ? error.message : "Failed to sign in with Apple";
            setState((prev) => ({ ...prev, loading: false, error: message }));
            throw error;
        }
    };

    // Google Sign-In with ID token (called from Android WebView via window.onGoogleLoginSuccess)
    const signInWithGoogleIdToken = async (idToken: string) => {
        console.log("[Auth Android] signInWithGoogleIdToken called, token length:", idToken?.length);
        console.log("[Auth Android] Token preview:", idToken?.substring(0, 30) + "...");
        setState((prev) => ({ ...prev, loading: true, error: null }));
        try {
            const credential = GoogleAuthProvider.credential(idToken);
            console.log("[Auth Android] Credential created, calling signInWithCredential...");
            const result = await signInWithCredential(auth, credential);
            console.log("[Auth Android] signInWithCredential SUCCESS for", result.user.email, "uid:", result.user.uid);
            // Auth state listener (onAuthStateChanged) will handle setting user/shopId/role and trigger redirect
        } catch (error: unknown) {
            console.error("[Auth Android] signInWithCredential FAILED:", error);
            const message = error instanceof Error ? error.message : "Failed to sign in with Google";
            console.error("[Auth Android] Error message:", message);
            setState((prev) => ({
                ...prev,
                loading: false,
                error: message,
            }));
        }
    };

    // Android WebView bridge: replace the global stubs (defined in index.html) with real Firebase implementations.
    // Also process any token that was queued before React mounted.
    const signInWithGoogleIdTokenRef = useRef(signInWithGoogleIdToken);
    signInWithGoogleIdTokenRef.current = signInWithGoogleIdToken;

    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any;

        // Replace the global token handler with real Firebase sign-in.
        // index.html defines __handleGoogleToken which queues; now we replace it to sign in directly.
        // This is called by: onGoogleLoginSuccess(), the androidGoogleToken setter trap, or queued token processing.
        win.__handleGoogleToken = (idToken: string) => {
            console.log("[Auth React] __handleGoogleToken called (Firebase ready), token length:", idToken?.length);
            signInWithGoogleIdTokenRef.current(idToken).catch((err: unknown) => {
                console.error("[Auth React] signInWithGoogleIdToken failed:", err);
            });
        };

        // Also replace global functions directly
        win.onGoogleLoginSuccess = (idToken: string) => {
            console.log("[Auth React] onGoogleLoginSuccess called, token length:", idToken?.length);
            signInWithGoogleIdTokenRef.current(idToken).catch((err: unknown) => {
                console.error("[Auth React] signInWithGoogleIdToken failed:", err);
            });
        };
        win.onGoogleLoginFailure = (error: string) => {
            console.error("[Auth React] onGoogleLoginFailure called:", error);
            setState((prev) => ({ ...prev, loading: false, error: error || "Login failed" }));
        };

        // Process any token that was queued before React mounted (by stubs or androidGoogleToken setter)
        if (win.__pendingGoogleIdToken) {
            console.log("[Auth React] Found queued token, processing. Length:", win.__pendingGoogleIdToken.length);
            const queuedToken = win.__pendingGoogleIdToken;
            win.__pendingGoogleIdToken = null;
            signInWithGoogleIdTokenRef.current(queuedToken).catch((err: unknown) => {
                console.error("[Auth React] Queued token processing failed:", err);
            });
        }

        if (win.__pendingGoogleLoginError) {
            const queuedError = win.__pendingGoogleLoginError;
            win.__pendingGoogleLoginError = null;
            setState((prev) => ({ ...prev, loading: false, error: queuedError || "Login failed" }));
        }

        // Cleanup: restore queuing behavior on unmount
        return () => {
            win.__handleGoogleToken = (idToken: string) => {
                console.log("[Android Bridge] Token received after React unmount, queuing");
                win.__pendingGoogleIdToken = idToken;
            };
            win.onGoogleLoginSuccess = (idToken: string) => {
                win.__pendingGoogleIdToken = idToken;
            };
            win.onGoogleLoginFailure = (error: string) => {
                win.__pendingGoogleLoginError = error;
            };
        };
    }, []);

    // Phone OTP - Send
    const sendOtp = async (phone: string) => {
        if (!recaptchaVerifier) {
            throw new Error("reCAPTCHA not initialized. Please refresh the page.");
        }

        setState((prev) => ({ ...prev, loading: true, error: null }));

        try {
            const formattedPhone = phone.startsWith("+91")
                ? phone
                : `+91${phone.replace(/\D/g, "")}`;

            const result = await signInWithPhoneNumber(
                auth,
                formattedPhone,
                recaptchaVerifier
            );
            setConfirmationResult(result);

            setState((prev) => ({ ...prev, loading: false }));
        } catch (error: unknown) {
            console.error("Error sending OTP:", error);
            const message = error instanceof Error ? error.message : "Failed to send OTP";
            setState((prev) => ({
                ...prev,
                loading: false,
                error: message,
            }));
            throw error;
        }
    };

    // Phone OTP - Verify
    const verifyOtp = async (code: string) => {
        if (!confirmationResult) {
            throw new Error("No OTP sent. Please request OTP first.");
        }

        setState((prev) => ({ ...prev, loading: true, error: null }));

        try {
            await confirmationResult.confirm(code);
            // Auth state listener will handle the rest
        } catch (error: unknown) {
            console.error("Error verifying OTP:", error);
            setState((prev) => ({
                ...prev,
                loading: false,
                error: "Invalid OTP. Please try again.",
            }));
            throw error;
        }
    };

    // Email/Password - Sign In (existing account)
    const signInWithEmail = async (email: string, password: string) => {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Auth state listener handles the rest
        } catch (error: unknown) {
            console.error("Error signing in with email:", error);
            let message = "Failed to sign in";
            if (error instanceof Error) {
                const code = (error as { code?: string }).code;
                if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
                    message = "No account found with this email. Please create an account first.";
                } else if (code === "auth/wrong-password") {
                    message = "Incorrect password. Please try again.";
                } else if (code === "auth/invalid-email") {
                    message = "Please enter a valid email address.";
                } else if (code === "auth/too-many-requests") {
                    message = "Too many failed attempts. Please try again later.";
                } else {
                    message = error.message;
                }
            }
            setState((prev) => ({ ...prev, loading: false, error: message }));
            throw new Error(message);
        }
    };

    // Email/Password - Sign Up (new account)
    const signUpWithEmail = async (email: string, password: string) => {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            // Auth state listener handles the rest (will see isNewUser = true)
        } catch (error: unknown) {
            console.error("Error creating account:", error);
            let message = "Failed to create account";
            if (error instanceof Error) {
                const code = (error as { code?: string }).code;
                if (code === "auth/email-already-in-use") {
                    message = "This email is already registered. Please sign in instead.";
                } else if (code === "auth/weak-password") {
                    message = "Password must be at least 6 characters.";
                } else if (code === "auth/invalid-email") {
                    message = "Please enter a valid email address.";
                } else {
                    message = error.message;
                }
            }
            setState((prev) => ({ ...prev, loading: false, error: message }));
            throw new Error(message);
        }
    };

    // Email/Password - Reset Password
    const resetPassword = async (email: string) => {
        try {
            await sendPasswordResetEmail(auth, email);
        } catch (error: unknown) {
            console.error("Error sending reset email:", error);
            let message = "Failed to send reset email";
            if (error instanceof Error) {
                const code = (error as { code?: string }).code;
                if (code === "auth/user-not-found") {
                    message = "No account found with this email.";
                } else if (code === "auth/invalid-email") {
                    message = "Please enter a valid email address.";
                } else {
                    message = error.message;
                }
            }
            throw new Error(message);
        }
    };

    // Sign Out
    const signOut = async () => {
        setState((prev) => ({ ...prev, loading: true }));
        try {
            await releaseWebSession(auth.currentUser?.uid || "");
            await firebaseSignOut(auth);
        } catch (error: unknown) {
            console.error("Error signing out:", error);
            const message = error instanceof Error ? error.message : "Failed to sign out";
            setState((prev) => ({
                ...prev,
                loading: false,
                error: message,
            }));
        }
    };

    const clearError = () => {
        setState((prev) => ({ ...prev, error: null }));
    };

    return (
        <AuthContext.Provider
            value={{
                ...state,
                // Active-shop override (multi-shop owners): everything that reads
                // shopId from useAuth() follows the selected shop; state.shopId
                // itself remains the primary shop from users/{uid}.
                shopId: activeShop?.id ?? state.shopId,
                shopName: activeShop?.name ?? state.shopName,
                primaryShopId: state.shopId,
                ownedShops,
                switchShop,
                refreshOwnedShops,
                sendOtp,
                verifyOtp,
                signInWithGoogle,
                signInWithGoogleIdToken,
                signInWithApple,
                signInWithEmail,
                signUpWithEmail,
                resetPassword,
                signOut,
                clearError,
                completeSignup,
            }}
        >
            {/* Invisible reCAPTCHA container */}
            <div id="recaptcha-container" />

            {/* Loading overlay — simple, fast ring spinner; skip on staff/super-admin routes (own auth context) */}
            {state.loading && !window.location.pathname.startsWith("/staff") && !window.location.pathname.startsWith("/super-admin") && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
                    <LSpinner size="lg" />
                </div>
            )}

            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
