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
import { doc, getDoc, setDoc, serverTimestamp, collection, writeBatch, limit } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { claimWebSession, releaseWebSession, teardownWebSession } from "@/lib/session-guard";
import { LLoadingOverlay } from "@/components/laundry";
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
    role: "admin" | "staff" | "plant_operator" | "agent" | null;
    loading: boolean;
    error: string | null;
    isNewUser: boolean;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Google provider instance
const googleProvider = new GoogleAuthProvider();

// Apple provider instance (web popup). The same Apple ID resolves to the same
// Firebase account as the iOS app, so Apple-signup users can log in on web too.
const appleProvider = new OAuthProvider("apple.com");
appleProvider.addScope("email");
appleProvider.addScope("name");

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
                const isPublicRoute =
                    path.startsWith("/order/") || path.startsWith("/track") || path.startsWith("/receipt/");
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
                            role: userData.role || "admin",
                            loading: false,
                            error: null,
                            isNewUser: false,
                        });
                    } else {
                        // Check if this is a staff member (they won't have a users doc)
                        // Staff users have authUid set in their staff document
                        const { collectionGroup, query, where, getDocs } = await import("firebase/firestore");
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
                            let matchedShop: { id: string; name: string } | null = null;

                            if (firebaseUser.email) {
                                const emailQ = query(
                                    collection(db, "shops"),
                                    where("email", "==", firebaseUser.email.trim().toLowerCase()),
                                    limit(1)
                                );
                                const emailSnap = await getDocs(emailQ);
                                if (!emailSnap.empty) {
                                    const shop = emailSnap.docs[0];
                                    matchedShop = { id: shop.id, name: shop.data().name || "" };
                                }
                            }

                            if (!matchedShop && firebaseUser.phoneNumber) {
                                const digits = firebaseUser.phoneNumber.replace(/\D/g, "").slice(-10);
                                if (digits.length === 10) {
                                    const withPrefix = `+91${digits}`;
                                    const [q1, q2] = [
                                        query(collection(db, "shops"), where("phone", "==", withPrefix), limit(1)),
                                        query(collection(db, "shops"), where("phone", "==", digits), limit(1)),
                                    ];
                                    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
                                    const snap = !snap1.empty ? snap1 : snap2;
                                    if (!snap.empty) {
                                        const shop = snap.docs[0];
                                        matchedShop = { id: shop.id, name: shop.data().name || "" };
                                    }
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

    // Seed default categories and inventory for new shops.
    // Uses platform default catalog (Super Admin Items List) when present, so new shops get categories, items, and images.
    const seedDefaultInventory = async (shopId: string) => {
        const batch = writeBatch(db);
        const { getDefaultCatalog } = await import("@/features/super-admin/hooks/use-default-catalog");
        const platformCatalog = await getDefaultCatalog();

        if (platformCatalog?.categories?.length && platformCatalog?.items?.length) {
            // Seed from platform catalog (includes imageUrl when set)
            platformCatalog.categories.forEach((cat) => {
                const ref = doc(collection(db, `shops/${shopId}/categories`), cat.id);
                batch.set(ref, {
                    name: cat.name,
                    icon: cat.icon,
                    order: cat.order,
                    turnaroundDays: cat.turnaroundDays,
                    isActive: true,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            });
            platformCatalog.items.forEach((item) => {
                const ref = doc(collection(db, `shops/${shopId}/inventory`));
                const itemData: Record<string, unknown> = {
                    categoryId: item.categoryId,
                    categoryName: item.categoryName,
                    subCategory: item.subCategory ?? "",
                    name: item.name,
                    basePrice: item.basePrice,
                    pricingType: item.pricingType,
                    turnaroundDays: item.turnaroundDays,
                    order: item.order,
                    expressMultiplier: 1.5,
                    isActive: true,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                };
                if (item.imageUrl) itemData.imageUrl = item.imageUrl;
                batch.set(ref, itemData);
            });
        } else {
            const { DEFAULT_CATEGORIES, DEFAULT_ITEMS } = await import("@/lib/default-inventory");
            DEFAULT_CATEGORIES.forEach((cat) => {
                const ref = doc(collection(db, `shops/${shopId}/categories`), cat.id);
                batch.set(ref, {
                    name: cat.name,
                    icon: cat.icon,
                    order: cat.order,
                    turnaroundDays: cat.turnaroundDays,
                    isActive: true,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            });
            DEFAULT_ITEMS.forEach((item) => {
                const ref = doc(collection(db, `shops/${shopId}/inventory`));
                batch.set(ref, {
                    ...item,
                    expressMultiplier: 1.5,
                    isActive: true,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            });
        }

        await batch.commit();
    };

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
            const currencyCode = (additionalData?.currency as string) || "INR";
            const currencySymbol = (additionalData?.currencySymbol as string) || "₹";
            const countryCode = (additionalData?.countryCode as string) || "IN";
            const phoneCountryCode = (additionalData?.phoneCountryCode as string) || "+91";
            const shopLocale = (additionalData?.locale as string) || "en-IN";
            const shopTimezone = (additionalData?.timezone as string) || "Asia/Kolkata";
            const taxName = (additionalData?.taxName as string) || "GST";

            const shopData: Record<string, unknown> = {
                name: shopName,
                ownerId: userId,
                phone: pendingUser.phoneNumber || null,
                email: pendingUser.email || null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                settings: {
                    countryCode,
                    currency: currencyCode,
                    currencySymbol,
                    phoneCountryCode,
                    locale: shopLocale,
                    timezone: shopTimezone,
                    orderPrefix: "A",
                    nextOrderNumber: 1,
                    adsEnabled: true,
                    showSelfPromo: true,
                    whatsappNotifications: true,
                    smsNotifications: false,
                    tax: { enabled: true, name: taxName, rate: 18 },
                    delivery: {
                        enableServiceAreas: enableServiceAreas,
                        serviceAreas: initialServiceAreas,
                        enablePickupSlots: true,
                        enableDeliverySlots: true,
                        deliveryFeeEnabled: true,
                        deliveryFeeMinOrder: 300,
                        deliveryFeeAmount: 50,
                        defaultCharge: 50,
                        pickupTimeSlots: [
                            { id: "slot1", value: "9:00 AM - 11:00 AM", isActive: true },
                            { id: "slot2", value: "11:00 AM - 1:00 PM", isActive: true },
                            { id: "slot3", value: "2:00 PM - 4:00 PM", isActive: true },
                            { id: "slot4", value: "4:00 PM - 6:00 PM", isActive: true },
                        ],
                        deliveryTimeSlots: [
                            { id: "slot1", value: "9:00 AM - 11:00 AM", isActive: true },
                            { id: "slot2", value: "11:00 AM - 1:00 PM", isActive: true },
                            { id: "slot3", value: "2:00 PM - 4:00 PM", isActive: true },
                            { id: "slot4", value: "4:00 PM - 6:00 PM", isActive: true },
                        ]
                    }
                },
            };

            // Merge additional data from the welcome page form (phone, email, location)
            // This overrides the defaults above when the user provides values on the form
            if (additionalData) {
                if (additionalData.phone) shopData.phone = additionalData.phone;
                if (additionalData.email) shopData.email = additionalData.email;
                if (additionalData.location) shopData.location = additionalData.location;
            }

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

            {/* Loading overlay - Don't show on staff or super-admin routes since they have their own auth context */}
            {!window.location.pathname.startsWith("/staff") && !window.location.pathname.startsWith("/super-admin") && (
                <LLoadingOverlay visible={state.loading} message="Loading..." />
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
