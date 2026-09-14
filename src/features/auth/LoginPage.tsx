/**
 * Login Page
 * 
 * Multi-provider login (Phone OTP + Google) for LaundryBill
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
    LButton,
    LPhoneInput,
    LCard,
    LLocationMap,
    useLToast,
} from "@/components/laundry";
import { Msg91Login } from "@/components/auth/Msg91Login";
import type { Msg91Handle } from "@/components/auth/Msg91Login";
import { useAuth } from "./AuthContext";
import { Download, Eye, EyeOff, Mail, Lock, Users, ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { useIsMobile } from "@/hooks/use-mobile";
import { reverseGeocode } from "@/lib/geocoding";
import { phoneLenOk, phoneLenLabel, COUNTRIES, getCountry, DEFAULT_COUNTRY, detectCountryByTimezone, getStateLabel } from "@/config/countries";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { consumeEvictionFlag } from "@/lib/session-guard";

function InstallPrompt() {
    const { canInstall, promptInstall } = usePWAInstall();

    if (!canInstall) return null;

    return (
        <LCard className="mb-6 border-primary/20 bg-primary/5">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Download className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-sm text-gray-900">Install App</h3>
                    <p className="text-xs text-gray-500">Add to your home screen for better experience</p>
                </div>
                <LButton size="sm" onClick={promptInstall} variant="outline" className="border-primary text-primary hover:bg-primary/5">
                    Install
                </LButton>
            </div>
        </LCard>
    );
}

type Step = "phone" | "otp" | "setup";

export function LoginPage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { addToast } = useLToast();
    const isMobile = useIsMobile();
    const {
        signInWithGoogle,
        signInWithApple,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        completeSignup,
        error,
        loading,
        user,
        shopId,
        isNewUser,
        clearError,
    } = useAuth();

    const [step, setStep] = useState<Step>("phone");
    const [phone, setPhone] = useState("");
    // const [otp, setOtp] = useState("");
    const [shopName, setShopName] = useState("");

    // Expanded onboarding form state
    const [email, setEmail] = useState("");
    const [address, setAddress] = useState("");
    const [city, setCity] = useState("");
    const [formState, setFormState] = useState("");
    const [pincode, setPincode] = useState("");
    const [latitude, setLatitude] = useState<number | undefined>();
    const [longitude, setLongitude] = useState<number | undefined>();
    const [gettingLocation, setGettingLocation] = useState(false);
    const [shopNameError, setShopNameError] = useState<string | undefined>();
    const [emailError, setEmailError] = useState<string | undefined>();
    const [phoneError, setPhoneError] = useState<string | undefined>();
    const [addressError, setAddressError] = useState<string | undefined>();
    const [cityError, setCityError] = useState<string | undefined>();
    const [stateError, setStateError] = useState<string | undefined>();
    const [pincodeError, setPincodeError] = useState<string | undefined>();
    const [checkingEmail, setCheckingEmail] = useState(false);
    const [checkingPhone, setCheckingPhone] = useState(false);

    // Country-based login mode detection
    const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
    const [loginMode, setLoginMode] = useState<"phone" | "email">("email"); // default to email (encouraged); phone OTP is a secondary option
    const [emailAuthMode, setEmailAuthMode] = useState<"signin" | "signup">("signin");
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loginEmailError, setLoginEmailError] = useState<string | undefined>();
    const [loginPasswordError, setLoginPasswordError] = useState<string | undefined>();
    const [confirmPassword, setConfirmPassword] = useState("");
    const [confirmPasswordError, setConfirmPasswordError] = useState<string | undefined>();
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    // Shown once if this session was signed out by a newer login on another device.
    const [evictedNotice, setEvictedNotice] = useState(false);
    useEffect(() => { if (consumeEvictionFlag()) setEvictedNotice(true); }, []);

    // Auto-detect country (used by the shop-setup step's country selector).
    // Login itself defaults to EMAIL for everyone (encouraged, alongside Google);
    // mobile/phone OTP stays available as a clearly-labelled secondary option.
    useEffect(() => {
        const detected = detectCountryByTimezone();
        setDetectedCountry(detected);
    }, []);

    // Country selection (drives currency, phone code, pincode label) — for setup step
    const [selectedCountryCode, setSelectedCountryCode] = useState(DEFAULT_COUNTRY);
    const selectedCountry = getCountry(selectedCountryCode);

    // Sync setup step country with detected country
    useEffect(() => {
        if (detectedCountry) {
            setSelectedCountryCode(detectedCountry);
        }
    }, [detectedCountry]);

    // Refs
    const msg91Ref = useRef<Msg91Handle>(null);
    const reverseGeocodeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Force login UI to always be in English, regardless of previous language.
    useEffect(() => {
        const previousLang = i18n.language;

        if (previousLang !== "en") {
            void i18n.changeLanguage("en");
        }

        return () => {
            if (previousLang && previousLang !== i18n.language) {
                void i18n.changeLanguage(previousLang);
            }
        };
    }, [i18n]);

    // Determine if fields are locked based on auth method
    const isPhoneLocked = !!user?.phone;
    const isEmailLocked = !!user?.email;

    // Redirect if already logged in with shop
    useEffect(() => {
        if (user && shopId && !isNewUser) {
            navigate("/");
        }
    }, [user, shopId, isNewUser, navigate]);

    // Show setup step for new users
    useEffect(() => {
        if (isNewUser) {
            setStep("setup");
        }
    }, [isNewUser]);

    // Pre-fill phone/email from auth user when entering setup step
    useEffect(() => {
        if (isNewUser && user) {
            // Pre-fill phone from OTP auth (clean +91 prefix)
            if (user.phone) {
                const cleanPhone = user.phone.replace(/^\+?91/, "").replace(/\D/g, "").slice(-10);
                setPhone(cleanPhone);
            }
            // Pre-fill email from Google auth
            if (user.email) {
                setEmail(user.email);
            }
        }
    }, [isNewUser, user]);

    // Auto-request location once when setup step is shown
    const autoLocationTried = useRef(false);
    useEffect(() => {
        if (step === "setup" && !autoLocationTried.current && navigator.geolocation) {
            autoLocationTried.current = true;
            getCurrentLocation();
        }
    }, [step]);

    // Get current GPS location and reverse geocode
    const getCurrentLocation = async () => {
        if (!navigator.geolocation) {
            addToast({ type: "error", title: t("shop.locationNotSupported") });
            return;
        }
        setGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                setLatitude(lat);
                setLongitude(lng);
                try {
                    const result = await reverseGeocode(lat, lng);
                    if (result) {
                        if (result.address) setAddress(result.address);
                        if (result.city) setCity(result.city);
                        if (result.state) setFormState(result.state);
                        if (result.pincode) setPincode(result.pincode);
                        addToast({ type: "success", title: t("shop.locationCaptured") });
                    }
                } catch {
                    addToast({ type: "success", title: t("shop.locationCaptured") });
                }
                setGettingLocation(false);
            },
            (error) => {
                setGettingLocation(false);
                addToast({ type: "error", title: t("shop.locationError"), description: error.message });
            },
            { enableHighAccuracy: true }
        );
    };

    // Check if email is already used by any shop (for registration - no shop yet)
    const checkEmailInUse = async (emailToCheck: string): Promise<boolean> => {
        if (!emailToCheck || !emailToCheck.includes("@")) return false;
        const q = query(
            collection(db, "shops"),
            where("email", "==", emailToCheck.trim().toLowerCase()),
            limit(1)
        );
        const snapshot = await getDocs(q);
        return !snapshot.empty;
    };

    // Check if phone number is already used by any shop (checks both +91 and plain 10-digit formats)
    const checkPhoneInUse = async (phoneToCheck: string): Promise<boolean> => {
        const digits = phoneToCheck.replace(/\D/g, "").slice(-10);
        if (!digits || digits.length !== 10) return false;

        const withPrefix = `+91${digits}`;
        const q1 = query(
            collection(db, "shops"),
            where("phone", "==", withPrefix),
            limit(1)
        );
        const q2 = query(
            collection(db, "shops"),
            where("phone", "==", digits),
            limit(1)
        );
        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        return !snap1.empty || !snap2.empty;
    };

    const isValidEmailFormat = (e: string) => {
        const trimmed = e.trim();
        if (!trimmed) return true; // empty is ok (optional)
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    };

    const handleEmailBlur = async () => {
        if (isEmailLocked) {
            setEmailError(undefined);
            return;
        }
        if (!email.trim()) {
            setEmailError(undefined);
            return;
        }
        if (!isValidEmailFormat(email)) {
            setEmailError(t("auth.invalidEmailFormat", "Please enter a valid email address (e.g., name@example.com)"));
            return;
        }
        setCheckingEmail(true);
        setEmailError(undefined);
        try {
            const inUse = await checkEmailInUse(email.trim());
            if (inUse) {
                setEmailError(t("auth.emailAlreadyInUse", "This email is already being used with another account. You cannot add this. Try with another email address."));
            }
        } catch {
            // Ignore
        } finally {
            setCheckingEmail(false);
        }
    };

    const handlePhoneBlur = async () => {
        if (isPhoneLocked) {
            setPhoneError(undefined);
            return;
        }
        const digits = phone.replace(/\D/g, "");
        if (!digits || digits.length !== 10) {
            // Length validation is handled separately; don't duplicate error
            return;
        }
        setCheckingPhone(true);
        setPhoneError(undefined);
        try {
            const inUse = await checkPhoneInUse(digits);
            if (inUse) {
                setPhoneError(t("auth.phoneAlreadyInUse", "This phone number is already registered with another shop. Please use a different number."));
            }
        } catch {
            // Ignore network errors on blur
        } finally {
            setCheckingPhone(false);
        }
    };

    const handleMapLocationChange = async (lat: number, lng: number) => {
        setLatitude(lat);
        setLongitude(lng);
        if (reverseGeocodeRef.current) clearTimeout(reverseGeocodeRef.current);
        reverseGeocodeRef.current = setTimeout(async () => {
            try {
                const result = await reverseGeocode(lat, lng);
                if (result) {
                    if (result.address) setAddress(result.address);
                    if (result.city) setCity(result.city);
                    if (result.state) setFormState(result.state);
                    if (result.pincode) setPincode(result.pincode);
                }
                reverseGeocodeRef.current = null;
            } catch {
                reverseGeocodeRef.current = null;
            }
        }, 400);
    };

    const handleMsg91Click = () => {
        if (!phoneLenOk(selectedCountry, phone)) {
            addToast({ type: "error", title: t('auth.invalidPhone') });
            return;
        }

        // Trigger MSG91 Widget via Ref
        msg91Ref.current?.openWidget(selectedCountry.phoneCode + phone);
    };

    const handleGoogleSignIn = async (e?: React.MouseEvent) => {
        // When running inside Android WebView, use native Google sign-in; Android will call window.onGoogleLoginSuccess(idToken) or onGoogleLoginFailure(error)
        const w = window as Window & { Android?: { googleLogin: () => void } };
        if (w.Android?.googleLogin) {
            e?.preventDefault();
            w.Android.googleLogin();
            return;
        }
        try {
            await signInWithGoogle();
        } catch {
            // Error handled in context
        }
    };

    // Apple Sign-In (web popup) — for owners who created their account with Apple on iOS
    const handleAppleSignIn = async () => {
        try {
            await signInWithApple();
        } catch {
            // Error handled in context
        }
    };

    // Email/Password login handler
    const handleEmailAuth = async () => {
        setLoginEmailError(undefined);
        setLoginPasswordError(undefined);
        setConfirmPasswordError(undefined);
        clearError();

        let hasErrors = false;

        if (!loginEmail.trim()) {
            setLoginEmailError(t("validation.required", "This field is required"));
            hasErrors = true;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim())) {
            setLoginEmailError(t("auth.invalidEmailFormat", "Please enter a valid email address"));
            hasErrors = true;
        }

        if (!loginPassword) {
            setLoginPasswordError(t("validation.required", "This field is required"));
            hasErrors = true;
        } else if (loginPassword.length < 6) {
            setLoginPasswordError(t("auth.weakPassword", "Password must be at least 6 characters"));
            hasErrors = true;
        }

        // Create account: the password must be typed twice and match.
        if (emailAuthMode === "signup") {
            if (!confirmPassword) {
                setConfirmPasswordError(t("auth.confirmPasswordRequired", "Please re-enter your password"));
                hasErrors = true;
            } else if (confirmPassword !== loginPassword) {
                setConfirmPasswordError(t("auth.passwordsDontMatch", "Passwords don't match"));
                hasErrors = true;
            }
        }

        if (hasErrors) return;

        try {
            if (emailAuthMode === "signin") {
                await signInWithEmail(loginEmail.trim(), loginPassword);
            } else {
                await signUpWithEmail(loginEmail.trim(), loginPassword);
            }
        } catch (err) {
            // Error is set in context, also show as field error for better UX
            const msg = err instanceof Error ? err.message : "Authentication failed";
            if (msg.toLowerCase().includes("email") || msg.toLowerCase().includes("account")) {
                setLoginEmailError(msg);
            } else if (msg.toLowerCase().includes("password")) {
                setLoginPasswordError(msg);
            }
        }
    };

    // Forgot password handler
    const handleForgotPassword = async () => {
        if (!loginEmail.trim()) {
            setLoginEmailError(t("auth.enterEmailForReset", "Please enter your email address first"));
            return;
        }
        try {
            await resetPassword(loginEmail.trim());
            addToast({ type: "success", title: t("auth.resetEmailSent", "Password reset email sent"), description: t("auth.checkInbox", "Check your inbox for the reset link") });
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to send reset email";
            addToast({ type: "error", title: msg });
        }
    };

    const requiredMsg = t("validation.required", "This field is required");

    const handleCompleteSetup = async () => {
        setShopNameError(undefined);
        setEmailError(undefined);
        setPhoneError(undefined);
        setAddressError(undefined);
        setCityError(undefined);
        setStateError(undefined);
        setPincodeError(undefined);

        let hasErrors = false;

        if (!shopName.trim()) {
            setShopNameError(requiredMsg);
            hasErrors = true;
        }

        if (!isPhoneLocked) {
            const digits = phone.replace(/\D/g, "");
            if (!phoneLenOk(selectedCountry, digits)) {
                setPhoneError(t("auth.phoneDigitsRequired", { digits: phoneLenLabel(selectedCountry), defaultValue: "Please enter a {{digits}}-digit phone number" }));
                hasErrors = true;
            }
        }

        if (!isEmailLocked) {
            if (!email.trim()) {
                setEmailError(requiredMsg);
                hasErrors = true;
            } else if (!isValidEmailFormat(email)) {
                setEmailError(t("auth.invalidEmailFormat", "Please enter a valid email address (e.g., name@example.com)"));
                hasErrors = true;
            }
        }

        if (!address.trim()) {
            setAddressError(requiredMsg);
            hasErrors = true;
        }
        if (!city.trim()) {
            setCityError(requiredMsg);
            hasErrors = true;
        }
        if (!formState.trim()) {
            setStateError(requiredMsg);
            hasErrors = true;
        }
        // Postal code isn't universal — UAE uses an optional P.O. Box. Only require it
        // where it's a real mandatory field (India PIN).
        if (selectedCountry.code === "IN" && !pincode.trim()) {
            setPincodeError(requiredMsg);
            hasErrors = true;
        }

        if (hasErrors) {
            addToast({ type: "error", title: t("validation.fixErrors", "Please fill in all required fields") });
            return;
        }

        // Validate phone not already in use (both flows: Google sign-in where user types it,
        // and OTP sign-in where phone comes from auth — prevents duplicate shops with same number)
        {
            const digits = phone.replace(/\D/g, "").slice(-10);
            if (digits.length === 10) {
                let phoneInUse = false;
                try { phoneInUse = await checkPhoneInUse(digits); } catch (e) { console.warn("phone-in-use check failed", e); }
                if (phoneInUse) {
                    addToast({
                        type: "error",
                        title: t("auth.phoneAlreadyInUse", "This phone number is already registered with another shop. Please use a different number."),
                    });
                    setPhoneError(t("auth.phoneAlreadyInUse", "This phone number is already registered with another shop. Please use a different number."));
                    return;
                }
            }
        }

        // Validate email not already in use (when user provides it)
        if (!isEmailLocked && email.trim()) {
            let inUse = false;
            try { inUse = await checkEmailInUse(email.trim()); } catch (e) { console.warn("email-in-use check failed", e); }
            if (inUse) {
                addToast({
                    type: "error",
                    title: t("auth.emailAlreadyInUse", "This email is already being used with another account. You cannot add this. Try with another email address."),
                });
                setEmailError(t("auth.emailAlreadyInUse", "This email is already being used with another account. You cannot add this. Try with another email address."));
                return;
            }
        }

        try {
            // Build additional data from the welcome page form to save atomically with the shop doc.
            // This avoids the race condition where completeSignup triggers a redirect
            // before a separate updateDoc call can save phone/email/location.
            const additionalData: Record<string, unknown> = {};

            // Add phone (normalize to country code + digits)
            if (phone) {
                const digits = phone.replace(/\D/g, "").slice(-selectedCountry.phoneDigits);
                if (phoneLenOk(selectedCountry, digits)) {
                    additionalData.phone = `${selectedCountry.phoneCode}${digits}`;
                }
            }

            // Pass country settings so completeSignup can store them atomically
            additionalData.countryCode = selectedCountry.code;
            additionalData.currency = selectedCountry.currencyCode;
            additionalData.currencySymbol = selectedCountry.currencySymbol;
            additionalData.phoneCountryCode = selectedCountry.phoneCode;
            additionalData.locale = selectedCountry.locale;
            additionalData.timezone = selectedCountry.timezone;
            additionalData.taxName = selectedCountry.taxName;
            additionalData.pinLabel = selectedCountry.pinLabel;

            // Add email if manually entered (Google sign-in already provides email via auth)
            if (email && !isEmailLocked) {
                additionalData.email = email.trim().toLowerCase();
            }

            // Add location if provided
            if (address || city || formState || pincode || latitude != null || longitude != null) {
                const loc: Record<string, unknown> = {
                    address: address || "",
                    city: city || "",
                    state: formState || "",
                    pincode: pincode || "",
                };
                if (latitude != null) loc.latitude = latitude;
                if (longitude != null) loc.longitude = longitude;
                additionalData.location = loc;
            }

            // Create the shop with ALL data in one atomic write
            await completeSignup(shopName.trim(), additionalData);

            addToast({
                type: "success",
                title: t('auth.welcomeShop'),
                description: t('auth.shopCreated'),
            });

            // Navigate directly to dashboard - onboarding complete!
            navigate("/");
        } catch (e) {
            // The context stores the message, but the setup step never rendered it —
            // a failed save looked like a dead button. Say what went wrong.
            const msg = e instanceof Error ? e.message : "";
            addToast({ type: "error", title: t("auth.createShopFailed", "Could not create the shop"), description: msg || undefined });
        }
    };

    /*
    const handleBack = () => {
        setStep("phone");
        setOtp("");
        clearError();
    };
    */

    // ---- styles (reference layout) ----
    const L: React.CSSProperties = { display: "block", fontSize: 15, fontWeight: 500, color: "#111827", marginBottom: 9 };
    const inputBox = (err?: string): React.CSSProperties => ({ display: "flex", alignItems: "center", gap: 12, height: 52, padding: "0 16px", border: `1px solid ${err ? "#DC2626" : "#E5E7EB"}`, borderRadius: 10, background: "#fff" });
    const bare: React.CSSProperties = { flex: 1, minWidth: 0, height: "100%", border: 0, outline: "none", font: "inherit", fontSize: 15.5, color: "#111827", background: "transparent" };
    const errTxt = (m?: string) => (m ? <p style={{ fontSize: 13, color: "#DC2626", margin: "6px 2px 0" }}>{m}</p> : null);
    const outlineBtn: React.CSSProperties = { width: "100%", height: 52, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, font: "inherit", fontSize: 16.5, fontWeight: 500, color: "#111827", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, cursor: "pointer" };
    const primaryBtn: React.CSSProperties = { width: "100%", height: 52, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, font: "inherit", fontSize: 17, fontWeight: 600, color: "#fff", background: "#1F5EF2", border: 0, borderRadius: 10, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1 };
    const link: React.CSSProperties = { font: "inherit", color: "#1F5EF2", background: "transparent", border: 0, padding: 0, cursor: "pointer" };
    const flag = (code: string) => code.toUpperCase().replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));
    const isSetup = step === "setup";
    const signup = emailAuthMode === "signup";

    const GoogleIcon = (
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
    );
    const AppleIcon = (
        <svg width="20" height="20" viewBox="0 0 16 16" fill="#000" aria-hidden="true" style={{ marginTop: -2 }}>
            <path d="M11.182.008C11.148-.03 9.923.023 8.857 1.18c-1.066 1.156-.902 2.482-.878 2.516.024.034 1.52.087 2.475-1.258.955-1.345.762-2.391.728-2.43Zm3.314 11.733c-.048-.096-2.325-1.234-2.113-3.422.212-2.189 1.675-2.789 1.698-2.854.023-.065-.597-.79-1.254-1.157a3.692 3.692 0 0 0-1.563-.434c-.108-.003-.483-.095-1.254.116-.508.139-1.653.589-1.968.607-.316.018-1.256-.522-2.267-.665-.647-.125-1.333.131-1.824.328-.49.196-1.422.754-2.074 2.237-.652 1.482-.311 3.83-.067 4.56.244.729.625 1.924 1.273 2.796.576.984 1.34 1.667 1.659 1.899.319.232 1.219.386 1.843.067.502-.308 1.408-.485 1.766-.472.357.013 1.061.154 1.782.539.571.197 1.111.115 1.652-.105.541-.221 1.324-1.059 2.238-2.758.347-.79.505-1.217.473-1.282Z" />
        </svg>
    );
    const Brand = ({ size = 50 }: { size?: number }) => (
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src="/icons/owner-login-logo.png" alt="" style={{ width: size, height: size, borderRadius: 12 }} />
            <span style={{ fontSize: size * 0.62, fontWeight: 600, letterSpacing: "-.02em", color: "#111827" }}>Laundrybill</span>
        </div>
    );
    const Check = ({ n }: { n?: number }) => (
        <span style={{ width: 26, height: 26, flex: "none", borderRadius: "50%", background: "#1F5EF2", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{n ?? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}</span>
    );

    /* ---------------- left marketing panel ---------------- */
    const leftPanel = (
        <aside style={{ flex: "1 1 50%", minWidth: 0, background: "#F5F7FB", padding: "40px 48px 36px", display: "flex", flexDirection: "column" }}>
            <Brand />
            {!isSetup ? (
                <>
                    <h1 style={{ margin: "46px 0 0", fontSize: "clamp(34px, 3.4vw, 52px)", lineHeight: 1.12, fontWeight: 700, letterSpacing: "-.03em", color: "#0B1220" }}>
                        {t("auth.heroLine1", "Run your laundry business from")} <span style={{ color: "#1F5EF2" }}>{t("auth.heroAccent", "your pocket.")}</span>
                    </h1>
                    <p style={{ margin: "18px 0 0", fontSize: 19, lineHeight: 1.55, color: "#4B5563", maxWidth: 520 }}>{t("auth.heroSub", "Billing, orders, tags, team and profit — on your phone, at the counter and on the web.")}</p>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 0" }}>
                        <img src="/img/login-hero.jpg" alt="" style={{ width: "100%", maxWidth: 720, mixBlendMode: "multiply", WebkitMaskImage: "radial-gradient(ellipse 72% 70% at center, #000 62%, transparent 100%)", maskImage: "radial-gradient(ellipse 72% 70% at center, #000 62%, transparent 100%)" }} />
                    </div>
                    <div style={{ display: "flex", gap: 34, flexWrap: "wrap", justifyContent: "center", fontSize: 16, color: "#1F2937" }}>
                        {[t("auth.trustFree", "Free to start"), t("auth.trustLanguages", "9 languages"), t("auth.trustCountries", "India · Philippines · UAE")].map((x) => (
                            <span key={x} style={{ display: "inline-flex", alignItems: "center", gap: 12 }}><Check />{x}</span>
                        ))}
                    </div>
                </>
            ) : (
                <>
                    <h1 style={{ margin: "56px 0 0", fontSize: "clamp(32px, 3vw, 44px)", lineHeight: 1.15, fontWeight: 600, letterSpacing: "-.02em", color: "#0B1220" }}>
                        {t("auth.setupHero1", "Your first bill is")}<br />{t("auth.setupHero2", "a")} <span style={{ color: "#1F5EF2" }}>{t("auth.setupHeroAccent", "minute away")}</span>
                    </h1>
                    <p style={{ margin: "18px 0 0", fontSize: 17, lineHeight: 1.55, color: "#4B5563", maxWidth: 300 }}>{t("auth.setupSub", "Finish these quick steps and you'll be ready to serve customers.")}</p>
                    <div style={{ marginTop: 30, display: "flex", flexDirection: "column" }}>
                        {[
                            { title: t("auth.setupStep1", "Set up your shop"), desc: t("auth.setupStep1Desc", "Tell us about your shop") },
                            { title: t("auth.setupStep2", "Add services"), desc: t("auth.setupStep2Desc", "Add your laundry & dry clean services") },
                            { title: t("auth.setupStep3", "Take your first order"), desc: t("auth.setupStep3Desc", "Create an order and print a bill") },
                        ].map((st, i) => (
                            <div key={st.title} style={{ display: "flex", gap: 22 }}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                    <span style={{ width: 38, height: 38, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 600, background: i === 0 ? "#1F5EF2" : "#EDF1F7", color: i === 0 ? "#fff" : "#374151" }}>{i + 1}</span>
                                    {i < 2 && <span style={{ flex: 1, minHeight: 34, borderLeft: "2px dashed #D6DCE6", margin: "6px 0" }} />}
                                </div>
                                <div style={{ paddingTop: 7, paddingBottom: 20 }}>
                                    <div style={{ fontSize: 15.5, fontWeight: 500, color: i === 0 ? "#1F5EF2" : "#111827" }}>{st.title}</div>
                                    <div style={{ fontSize: 14.5, color: "#4B5563", marginTop: 5 }}>{st.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingTop: 20 }}>
                        <img src="/img/login-hero.jpg" alt="" style={{ width: "100%", maxWidth: 560, mixBlendMode: "multiply", WebkitMaskImage: "radial-gradient(ellipse 72% 70% at center, #000 62%, transparent 100%)", maskImage: "radial-gradient(ellipse 72% 70% at center, #000 62%, transparent 100%)" }} />
                    </div>
                </>
            )}
        </aside>
    );

    /* ---------------- sign-in / sign-up form ---------------- */
    const signInForm = (
        <div style={{ width: "100%", maxWidth: 444 }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
                <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-.02em", color: "#0B1220" }}>{signup ? t("auth.createYourAccount", "Create your account") : t("auth.welcomeBack", "Welcome back")}</div>
                <div style={{ fontSize: 18, color: "#4B5563", marginTop: 10 }}>{signup ? t("auth.startFree", "Start free — set up your shop in a minute") : t("auth.signInToManage", "Sign in to manage your shop")}</div>
            </div>

            <InstallPrompt />

            {evictedNotice && (
                <p style={{ fontSize: 13.5, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 12px", margin: "0 0 16px" }}>
                    {t("auth.evicted", "You were signed out because your account was signed in on another device.")}
                </p>
            )}

            {loginMode === "email" ? (
                <>
                    <div style={{ marginBottom: 20 }}>
                        <label style={L} htmlFor="login-email">{t("auth.email", "Email")}</label>
                        <div style={inputBox(loginEmailError)}>
                            <Mail size={20} style={{ color: "#4B5563" }} />
                            <input id="login-email" type="email" autoComplete="email" value={loginEmail} placeholder="you@yourshop.com" style={bare}
                                onChange={(e) => { setLoginEmail(e.target.value); setLoginEmailError(undefined); clearError(); }}
                                onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()} />
                        </div>
                        {errTxt(loginEmailError)}
                    </div>
                    <div>
                        <label style={L} htmlFor="login-password">{t("auth.password", "Password")}</label>
                        <div style={inputBox(loginPasswordError)}>
                            <Lock size={20} style={{ color: "#4B5563" }} />
                            <input id="login-password" type={showPassword ? "text" : "password"} autoComplete={signup ? "new-password" : "current-password"} value={loginPassword} style={bare}
                                placeholder={signup ? t("auth.createPassword", "Create a password (min 6 chars)") : t("auth.enterPassword", "Enter your password")}
                                onChange={(e) => { setLoginPassword(e.target.value); setLoginPasswordError(undefined); clearError(); }}
                                onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()} />
                            <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} style={{ ...link, color: "#4B5563", display: "inline-flex" }}>
                                {showPassword ? <EyeOff size={21} /> : <Eye size={21} />}
                            </button>
                        </div>
                        {errTxt(loginPasswordError)}
                    </div>
                    {signup && (
                        <div style={{ marginTop: 20 }}>
                            <label style={L} htmlFor="login-confirm-password">{t("auth.confirmPassword", "Confirm password")}</label>
                            <div style={inputBox(confirmPasswordError)}>
                                <Lock size={20} style={{ color: "#4B5563" }} />
                                <input id="login-confirm-password" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} style={bare}
                                    placeholder={t("auth.reenterPassword", "Re-enter your password")}
                                    onChange={(e) => { setConfirmPassword(e.target.value); setConfirmPasswordError(undefined); clearError(); }}
                                    onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()} />
                                {confirmPassword && confirmPassword === loginPassword && <span style={{ color: "#16A34A", display: "inline-flex" }} title={t("auth.passwordsMatch", "Passwords match")}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>}
                                <button type="button" onClick={() => setShowConfirmPassword((v) => !v)} aria-label={showConfirmPassword ? "Hide password" : "Show password"} style={{ ...link, color: "#4B5563", display: "inline-flex" }}>
                                    {showConfirmPassword ? <EyeOff size={21} /> : <Eye size={21} />}
                                </button>
                            </div>
                            {errTxt(confirmPasswordError)}
                        </div>
                    )}
                    {!signup && (
                        <div style={{ textAlign: "right", marginTop: 12 }}>
                            <button type="button" onClick={handleForgotPassword} style={{ ...link, fontSize: 15 }}>{t("auth.forgotPassword", "Forgot password?")}</button>
                        </div>
                    )}
                    {error && !loginEmailError && !loginPasswordError && !confirmPasswordError && (
                        <p style={{ fontSize: 13.5, color: "#B91C1C", background: "#FEF2F2", borderRadius: 10, padding: "10px 12px", margin: "14px 0 0" }}>{error}</p>
                    )}
                    <button type="button" onClick={handleEmailAuth} disabled={loading} style={{ ...primaryBtn, marginTop: signup ? 22 : 18 }}>
                        {loading ? t("common.loading", "Please wait…") : signup ? t("auth.createAccountBtn", "Create account") : t("auth.signInBtn", "Sign in")}
                    </button>
                </>
            ) : (
                <>
                    <label style={L}>{t("auth.enterPhoneNumber", "Mobile number")}</label>
                    <LPhoneInput label="" value={phone} onValueChange={setPhone} showClear helperText={t("auth.verifyWithSms", "We will send you a verification code")} />
                    {phone.length > 0 && phone.length < 10 && <p style={{ fontSize: 13, color: "#DC2626", margin: "6px 2px 0" }}>{t("auth.phoneTenDigits", "Please enter a 10-digit phone number")}</p>}
                    <button type="button" onClick={handleMsg91Click} disabled={loading || phone.length !== 10} style={{ ...primaryBtn, marginTop: 18, opacity: loading || phone.length !== 10 ? 0.55 : 1 }}>
                        {t("auth.verifyWithSmsBtn", "Verify with SMS")}
                    </button>
                    <Msg91Login ref={msg91Ref} onSuccess={() => addToast({ type: "success", title: "Verification Successful" })} onError={(msg: string) => addToast({ type: "error", title: msg })} />
                    {error && <p style={{ fontSize: 13.5, color: "#B91C1C", background: "#FEF2F2", borderRadius: 10, padding: "10px 12px", margin: "14px 0 0" }}>{error}</p>}
                </>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 18, margin: "26px 0", color: "#4B5563", fontSize: 16 }}>
                <span style={{ flex: 1, height: 1, background: "#E5E7EB" }} />{t("auth.or", "or")}<span style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <button id="google-signin-btn" type="button" onClick={handleGoogleSignIn} disabled={loading} style={outlineBtn}>{GoogleIcon}{t("auth.continueWithGoogle", "Continue with Google")}</button>
                <button id="apple-signin-btn" type="button" onClick={handleAppleSignIn} disabled={loading} style={outlineBtn}>{AppleIcon}{t("auth.continueWithApple", "Continue with Apple")}</button>
            </div>

            <div style={{ textAlign: "center", marginTop: 26 }}>
                <button type="button" onClick={() => { setLoginMode(loginMode === "email" ? "phone" : "email"); clearError(); }} style={{ ...link, fontSize: 16.5 }}>
                    {loginMode === "email" ? t("auth.useMobileInstead", "Sign in with mobile number instead") : t("auth.useEmailInstead", "Sign in with email instead")}
                </button>
            </div>
            {loginMode === "email" && (
                <div style={{ textAlign: "center", marginTop: 26, fontSize: 16.5, color: "#1F2937" }}>
                    {signup ? t("auth.haveAccount", "Already have an account?") : t("auth.newHere", "New here?")}{" "}
                    <button type="button" onClick={() => { setEmailAuthMode(signup ? "signin" : "signup"); clearError(); setLoginEmailError(undefined); setLoginPasswordError(undefined); setConfirmPassword(""); setConfirmPasswordError(undefined); }} style={{ ...link, fontSize: 16.5, fontWeight: 500 }}>
                        {signup ? t("auth.signIn", "Sign in") : t("auth.createAccountLink", "Create account")}
                    </button>
                </div>
            )}

            {/* team members (staff / delivery agents / plant) have their own sign-in */}
            <button type="button" onClick={() => navigate("/team/login")}
                style={{ width: "100%", marginTop: 34, cursor: "pointer", font: "inherit", display: "flex", alignItems: "center", gap: 16, textAlign: "left", padding: "14px 18px", background: "#F5F7FB", border: "1px solid #E5E7EB", borderRadius: 10, color: "#111827" }}>
                <span style={{ width: 42, height: 42, flex: "none", borderRadius: 10, background: "#fff", border: "1px solid #E5E7EB", color: "#1F5EF2", display: "flex", alignItems: "center", justifyContent: "center" }}><Users size={22} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 16, fontWeight: 600 }}>{t("auth.teamLoginBtn", "Team login")}</span>
                    <span style={{ display: "block", fontSize: 13.5, color: "#4B5563", marginTop: 2 }}>{t("auth.teamLoginDesc", "For staff, delivery agents and plant")}</span>
                </span>
                <ChevronRight size={20} style={{ color: "#4B5563" }} />
            </button>
            <p style={{ textAlign: "center", fontSize: 12.5, color: "#9CA3AF", marginTop: 22 }}>{t("auth.termsAgreement", "By signing in, you agree to our Terms of Service and Privacy Policy.")}</p>
        </div>
    );

    /* ---------------- shop setup form ---------------- */
    const setupForm = (
        <div style={{ width: "100%", maxWidth: 700 }}>
            <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-.02em", color: "#0B1220" }}>{t("auth.welcomeUser", { name: user?.displayName || t("auth.there", "there"), defaultValue: "Welcome, {{name}}!" })}</div>
            <div style={{ fontSize: 17, color: "#4B5563", marginTop: 8, marginBottom: 26 }}>{t("auth.letsSetupShop", "Let's set up your laundry shop")}</div>

            <div style={{ marginBottom: 18 }}>
                <label style={L}>{t("shop.country", "Country")}</label>
                <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 20, pointerEvents: "none" }}>{flag(selectedCountry.code)}</span>
                    <select value={selectedCountryCode} onChange={(e) => setSelectedCountryCode(e.target.value)}
                        style={{ width: "100%", height: 48, font: "inherit", fontSize: 15.5, color: "#111827", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: "0 42px 0 48px", appearance: "none", WebkitAppearance: "none", cursor: "pointer", outline: "none" }}>
                        {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.currencySymbol} {c.currencyCode})</option>)}
                    </select>
                    <ChevronDown size={18} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                </div>
                <p style={{ fontSize: 13.5, color: "#4B5563", margin: "7px 2px 0" }}>{t("auth.countryHint", "Sets currency, {{tax}} and phone format", { tax: selectedCountry.taxName })}</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "0 44px", marginBottom: 18 }}>
                <div>
                    <label style={L}>{t("auth.shopName", "Shop name")}</label>
                    <div style={{ ...inputBox(shopNameError || error || undefined), height: 48 }}>
                        <input value={shopName} placeholder={t("auth.shopNamePlaceholder", "e.g. Wash It")} style={bare} onChange={(e) => { setShopName(e.target.value); setShopNameError(undefined); }} />
                    </div>
                    {errTxt(shopNameError || error || undefined)}
                </div>
                <div>
                    <label style={L}>{t("shop.phoneNumber", "Phone")}</label>
                    <LPhoneInput label="" value={phone} onValueChange={(v) => { setPhone(v); setPhoneError(undefined); }} onBlur={handlePhoneBlur}
                        showClear={!isPhoneLocked} disabled={isPhoneLocked} error={phoneError} countryCode={selectedCountry.phoneCode} maxDigits={selectedCountry.phoneDigits} />
                    {isPhoneLocked && <p style={{ fontSize: 12.5, color: "#6B7280", margin: "5px 2px 0" }}>✓ {t("shop.phoneVerified", "Phone verified from login")}</p>}
                    {checkingPhone && <p style={{ fontSize: 12.5, color: "#6B7280", margin: "5px 2px 0" }}>{t("auth.checking", "Checking…")}</p>}
                </div>
            </div>

            <div style={{ marginBottom: 18 }}>
                <label style={L}>{t("shop.email", "Email")}</label>
                <div style={{ ...inputBox(emailError), height: 48, background: isEmailLocked ? "#F9FAFB" : "#fff" }}>
                    <input type="email" value={email} disabled={isEmailLocked} style={{ ...bare, color: isEmailLocked ? "#374151" : "#111827" }} onBlur={handleEmailBlur}
                        onChange={(e) => {
                            const val = e.target.value;
                            setEmail(val);
                            if (!val.trim()) setEmailError(undefined);
                            else if (!isValidEmailFormat(val)) setEmailError(t("auth.invalidEmailFormat", "Please enter a valid email address (e.g., name@example.com)"));
                            else setEmailError(undefined);
                        }} />
                    {isEmailLocked && <Lock size={18} style={{ color: "#4B5563" }} />}
                </div>
                {emailError ? errTxt(emailError) : <p style={{ fontSize: 13.5, color: "#4B5563", margin: "7px 2px 0" }}>{isEmailLocked ? t("auth.emailFromLogin", "From your sign-in · used for login and important updates") : t("auth.emailHint", "Used for login and important updates")}</p>}
                {checkingEmail && <p style={{ fontSize: 12.5, color: "#6B7280", margin: "5px 2px 0" }}>{t("auth.checking", "Checking…")}</p>}
            </div>

            <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: "18px 16px" }}>
                <div style={{ fontSize: 16, fontWeight: 500 }}>{t("shop.location", "Location")}</div>
                <div style={{ fontSize: 14, color: "#4B5563", marginTop: 4, marginBottom: 12 }}>{t("auth.dragPin", "Drag the pin to your shop location")}</div>
                <LLocationMap latitude={latitude} longitude={longitude} onLocationChange={handleMapLocationChange} onGetLocation={getCurrentLocation} gettingLocation={gettingLocation} className="rounded-xl overflow-hidden" />
                <p style={{ fontSize: 13.5, color: "#4B5563", margin: "8px 2px 16px" }}>{t("auth.locationHelps", "This helps with delivery and route planning")}</p>
                <div style={{ marginBottom: 16 }}>
                    <label style={L}>{t("shop.address", "Address")}</label>
                    <div style={{ ...inputBox(addressError), height: 46 }}>
                        <input value={address} placeholder={t("shop.addressPlaceholder", "Shop address")} style={bare} onChange={(e) => { setAddress(e.target.value); setAddressError(undefined); }} />
                    </div>
                    {errTxt(addressError)}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 20 }}>
                    <div>
                        <label style={L}>{t("shop.city", "City")}</label>
                        <div style={{ ...inputBox(cityError), height: 46 }}><input value={city} style={bare} onChange={(e) => { setCity(e.target.value); setCityError(undefined); }} /></div>
                        {errTxt(cityError)}
                    </div>
                    <div>
                        <label style={L}>{getStateLabel(selectedCountry.code)}</label>
                        <div style={{ ...inputBox(stateError), height: 46 }}><input value={formState} style={bare} onChange={(e) => { setFormState(e.target.value); setStateError(undefined); }} /></div>
                        {errTxt(stateError)}
                    </div>
                    <div>
                        <label style={L}>{selectedCountry.pinLabel}</label>
                        <div style={{ ...inputBox(pincodeError), height: 46 }}><input value={pincode} maxLength={10} style={bare} onChange={(e) => { setPincode(e.target.value.replace(/[^a-zA-Z0-9\s-]/g, "").slice(0, 10)); setPincodeError(undefined); }} /></div>
                        {errTxt(pincodeError)}
                    </div>
                </div>
            </div>

            <button type="button" onClick={handleCompleteSetup} disabled={loading} style={{ ...primaryBtn, height: 48, fontSize: 16, marginTop: 16 }}>
                {loading ? t("common.loading", "Please wait…") : t("auth.createShopContinue", "Create shop & continue")}
            </button>
            <p style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 14, color: "#4B5563", marginTop: 20 }}>
                <Lock size={17} />{t("auth.changeLater", "You can change all of this later in Settings")}
            </p>
        </div>
    );

    return (
        <div style={{ minHeight: "100vh", display: "flex", background: "#fff", color: "#111827", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
            {!isMobile && leftPanel}
            <main style={{ flex: isMobile ? "1 1 auto" : "1 1 50%", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: isSetup ? "flex-start" : "center", padding: isMobile ? "28px 18px 40px" : isSetup ? "40px 48px 40px" : "40px 32px" }}>
                {isMobile && <div style={{ alignSelf: "center", display: "flex", justifyContent: "center", marginBottom: 24 }}><Brand size={40} /></div>}
                {isSetup ? setupForm : signInForm}
            </main>
        </div>
    );
}
