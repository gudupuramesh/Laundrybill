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
    LTextInput,
    LCard,
    LLocationMap,
    useLToast,
} from "@/components/laundry";
import { Msg91Login } from "@/components/auth/Msg91Login";
import type { Msg91Handle } from "@/components/auth/Msg91Login";
import { useAuth } from "./AuthContext";
import { Download, MapPin, Eye, EyeOff, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { reverseGeocode } from "@/lib/geocoding";
import { COUNTRIES, getCountry, DEFAULT_COUNTRY, detectCountryByTimezone } from "@/config/countries";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

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
    const {
        signInWithGoogle,
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
    const [loginMode, setLoginMode] = useState<"phone" | "email">("phone"); // phone = India OTP, email = email/password
    const [emailAuthMode, setEmailAuthMode] = useState<"signin" | "signup">("signin");
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loginEmailError, setLoginEmailError] = useState<string | undefined>();
    const [loginPasswordError, setLoginPasswordError] = useState<string | undefined>();

    // Auto-detect country on mount
    useEffect(() => {
        const detected = detectCountryByTimezone();
        setDetectedCountry(detected);
        if (detected && detected !== "IN") {
            setLoginMode("email");
        } else {
            setLoginMode("phone");
        }
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
        if (phone.length !== selectedCountry.phoneDigits) {
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

    // Email/Password login handler
    const handleEmailAuth = async () => {
        setLoginEmailError(undefined);
        setLoginPasswordError(undefined);
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
            if (digits.length !== selectedCountry.phoneDigits) {
                setPhoneError(t("auth.phoneDigitsRequired", { count: selectedCountry.phoneDigits, defaultValue: `Please enter a ${selectedCountry.phoneDigits}-digit phone number` }));
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
        if (!pincode.trim()) {
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
                const phoneInUse = await checkPhoneInUse(digits);
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
            const inUse = await checkEmailInUse(email.trim());
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
                if (digits.length === selectedCountry.phoneDigits) {
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
        } catch {
            // Error handled in context
        }
    };

    /*
    const handleBack = () => {
        setStep("phone");
        setOtp("");
        clearError();
    };
    */

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Brand Section */}
                <div className="flex flex-col items-center justify-center mb-8">
                    <div className="flex items-center gap-4 mb-2">
                        <img
                            src="/icons/Gemini_Generated_Image_o2wsl2o2wsl2o2ws-Photoroom.svg"
                            alt="LaundryBill"
                            className="w-16 h-16"
                        />
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">LaundryBill</h1>
                    </div>
                    <p className="text-gray-500 text-sm font-medium">
                        {step === "setup" ? t('auth.setupShop') : t('auth.signInToManage')}
                    </p>
                </div>

                <InstallPrompt />

                <LCard className="bg-white shadow-xl border-border/50 p-6 md:p-8 rounded-3xl">
                    {step === "phone" && (
                        <div className="space-y-6">
                            {/* Google Sign-In — always shown for all countries */}
                            <button
                                id="google-signin-btn"
                                type="button"
                                onClick={handleGoogleSignIn}
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 group"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path
                                        fill="#4285F4"
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    />
                                    <path
                                        fill="#34A853"
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    />
                                    <path
                                        fill="#FBBC05"
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    />
                                    <path
                                        fill="#EA4335"
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    />
                                </svg>
                                <span className="text-gray-700 font-medium group-hover:text-gray-900 transition-colors">
                                    {t('auth.continueWithGoogle')}
                                </span>
                            </button>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-100"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-4 bg-white text-gray-400 font-medium">OR</span>
                                </div>
                            </div>

                            {/* Indian users: Phone OTP login (MSG91) */}
                            {loginMode === "phone" && (
                                <div className="space-y-4">
                                    <h2 className="text-sm font-semibold text-gray-700">
                                        {t('auth.enterPhoneNumber')}
                                    </h2>

                                    <LPhoneInput
                                        label=""
                                        value={phone}
                                        onValueChange={setPhone}
                                        showClear
                                        helperText={t('auth.verifyWithSms', 'We will send you a verification code')}
                                        className="rounded-2xl"
                                    />

                                    <LButton
                                        variant="primary"
                                        size="lg"
                                        fullWidth
                                        onClick={handleMsg91Click}
                                        loading={loading}
                                        disabled={phone.length !== 10}
                                        className="h-12 rounded-2xl text-base"
                                    >
                                        Verify with SMS
                                    </LButton>
                                    {phone.length > 0 && phone.length < 10 && (
                                        <p className="text-xs text-destructive px-1">
                                            {t("auth.phoneTenDigits", "Please enter a 10-digit phone number")}
                                        </p>
                                    )}

                                    <Msg91Login
                                        ref={msg91Ref}
                                        onSuccess={() => {
                                            addToast({ type: "success", title: "Verification Successful" });
                                        }}
                                        onError={(msg: string) => addToast({ type: "error", title: msg })}
                                    />

                                    {/* Switch to email login */}
                                    <button
                                        type="button"
                                        onClick={() => { setLoginMode("email"); clearError(); }}
                                        className="w-full text-center text-xs text-primary hover:text-primary/80 transition-colors pt-1"
                                    >
                                        {t("auth.notInIndia", "Not in India? Sign in with email instead")}
                                    </button>
                                </div>
                            )}

                            {/* Non-Indian users: Email/Password login */}
                            {loginMode === "email" && (
                                <div className="space-y-4">
                                    {/* Sign In / Create Account toggle */}
                                    <div className="flex rounded-xl bg-gray-100 p-1">
                                        <button
                                            type="button"
                                            onClick={() => { setEmailAuthMode("signin"); clearError(); setLoginEmailError(undefined); setLoginPasswordError(undefined); }}
                                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                                                emailAuthMode === "signin"
                                                    ? "bg-white text-gray-900 shadow-sm"
                                                    : "text-gray-500 hover:text-gray-700"
                                            }`}
                                        >
                                            {t("auth.signIn", "Sign In")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setEmailAuthMode("signup"); clearError(); setLoginEmailError(undefined); setLoginPasswordError(undefined); }}
                                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                                                emailAuthMode === "signup"
                                                    ? "bg-white text-gray-900 shadow-sm"
                                                    : "text-gray-500 hover:text-gray-700"
                                            }`}
                                        >
                                            {t("auth.createAccount", "Create Account")}
                                        </button>
                                    </div>

                                    {/* Email field */}
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-gray-700">{t("auth.email", "Email")}</label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                                <Mail className="h-4 w-4" />
                                            </div>
                                            <input
                                                type="email"
                                                value={loginEmail}
                                                onChange={(e) => { setLoginEmail(e.target.value); setLoginEmailError(undefined); clearError(); }}
                                                placeholder="you@example.com"
                                                className={`w-full h-12 pl-10 pr-3 rounded-xl border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${
                                                    loginEmailError ? "border-destructive" : "border-gray-200"
                                                }`}
                                                onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()}
                                            />
                                        </div>
                                        {loginEmailError && (
                                            <p className="text-xs text-destructive px-1">{loginEmailError}</p>
                                        )}
                                    </div>

                                    {/* Password field */}
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-gray-700">{t("auth.password", "Password")}</label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                value={loginPassword}
                                                onChange={(e) => { setLoginPassword(e.target.value); setLoginPasswordError(undefined); clearError(); }}
                                                placeholder={emailAuthMode === "signup" ? t("auth.createPassword", "Create a password (min 6 chars)") : t("auth.enterPassword", "Enter your password")}
                                                className={`w-full h-12 px-3 pr-10 rounded-xl border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${
                                                    loginPasswordError ? "border-destructive" : "border-gray-200"
                                                }`}
                                                onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword((p) => !p)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                tabIndex={-1}
                                            >
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                        {loginPasswordError && (
                                            <p className="text-xs text-destructive px-1">{loginPasswordError}</p>
                                        )}
                                    </div>

                                    {/* Forgot password — only for sign in */}
                                    {emailAuthMode === "signin" && (
                                        <button
                                            type="button"
                                            onClick={handleForgotPassword}
                                            className="text-xs text-primary hover:text-primary/80 transition-colors"
                                        >
                                            {t("auth.forgotPassword", "Forgot password?")}
                                        </button>
                                    )}

                                    {/* Auth error from context */}
                                    {error && !loginEmailError && !loginPasswordError && (
                                        <p className="text-xs text-destructive bg-destructive/5 rounded-lg px-3 py-2">{error}</p>
                                    )}

                                    {/* Submit button */}
                                    <LButton
                                        variant="primary"
                                        size="lg"
                                        fullWidth
                                        onClick={handleEmailAuth}
                                        loading={loading}
                                        className="h-12 rounded-2xl text-base"
                                    >
                                        {emailAuthMode === "signin"
                                            ? t("auth.signInBtn", "Sign In")
                                            : t("auth.createAccountBtn", "Create Account")}
                                    </LButton>

                                    {/* Switch to phone login */}
                                    <button
                                        type="button"
                                        onClick={() => { setLoginMode("phone"); clearError(); }}
                                        className="w-full text-center text-xs text-primary hover:text-primary/80 transition-colors pt-1"
                                    >
                                        {t("auth.inIndia", "In India? Sign in with phone number instead")}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* OTP step removed - MSG91 handles verification internally */}

                    {step === "setup" && (
                        <div className="space-y-5">
                            {/* Header */}
                            <div className="text-center">
                                {user?.photoURL && (
                                    <img
                                        src={user.photoURL}
                                        alt="Profile"
                                        className="w-16 h-16 rounded-full mx-auto mb-3 border-4 border-gray-50 shadow-sm"
                                    />
                                )}
                                <h2 className="text-lg font-bold text-gray-900">
                                    {t('auth.welcomeUser', { name: user?.displayName || t('auth.there') })}
                                </h2>
                                <p className="text-xs text-gray-500 mt-1">
                                    {t('auth.letsSetupShop')}
                                </p>
                            </div>

                            {/* Country */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">{t('shop.country', 'Country')}</label>
                                <select
                                    value={selectedCountryCode}
                                    onChange={(e) => setSelectedCountryCode(e.target.value)}
                                    className="w-full h-12 px-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                >
                                    {COUNTRIES.map((c) => (
                                        <option key={c.code} value={c.code}>
                                            {c.name} ({c.currencySymbol} {c.currencyCode})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Shop Name */}
                            <LTextInput
                                label={t('auth.shopName')}
                                value={shopName}
                                onChange={(e) => {
                                    setShopName(e.target.value);
                                    setShopNameError(undefined);
                                }}
                                placeholder={t('auth.shopNamePlaceholder')}
                                error={shopNameError || error || undefined}
                            />

                            {/* Contact Info Section */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-700">{t('shop.contactInfo')}</h3>

                                {/* Phone: locked if OTP registration */}
                                <div className="space-y-1">
                                    <LPhoneInput
                                        label={t('shop.phoneNumber')}
                                        value={phone}
                                        onValueChange={(v) => {
                                            setPhone(v);
                                            setPhoneError(undefined);
                                        }}
                                        onBlur={handlePhoneBlur}
                                        showClear={!isPhoneLocked}
                                        disabled={isPhoneLocked}
                                        error={phoneError}
                                        countryCode={selectedCountry.phoneCode}
                                        maxDigits={selectedCountry.phoneDigits}
                                        className={isPhoneLocked ? "opacity-70 bg-muted" : ""}
                                    />
                                    {isPhoneLocked && (
                                        <p className="text-[10px] text-gray-400 px-1">✓ {t('shop.phoneVerified', 'Phone verified from login')}</p>
                                    )}
                                    {checkingPhone && (
                                        <p className="text-[10px] text-gray-500 px-1">Checking...</p>
                                    )}
                                </div>

                                {/* Email: locked if Google sign-in */}
                                <div className="space-y-1">
                                    <LTextInput
                                        label={t('shop.email')}
                                        type="email"
                                        value={email}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setEmail(val);
                                            if (!val.trim()) {
                                                setEmailError(undefined);
                                            } else if (!isValidEmailFormat(val)) {
                                                setEmailError(t("auth.invalidEmailFormat", "Please enter a valid email address (e.g., name@example.com)"));
                                            } else {
                                                setEmailError(undefined);
                                            }
                                        }}
                                        onBlur={handleEmailBlur}
                                        disabled={isEmailLocked}
                                        error={emailError}
                                        className={isEmailLocked ? "opacity-70 bg-muted" : ""}
                                    />
                                    {isEmailLocked && (
                                        <p className="text-[10px] text-gray-400 px-1">✓ {t('shop.emailVerified', 'Email verified from Google')}</p>
                                    )}
                                    {checkingEmail && (
                                        <p className="text-[10px] text-gray-500 px-1">Checking...</p>
                                    )}
                                </div>
                            </div>

                            {/* Location Section - Map + address fields; lat/lng saved but not shown */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {t('shop.location')}
                                </h3>

                                <LLocationMap
                                    latitude={latitude}
                                    longitude={longitude}
                                    onLocationChange={handleMapLocationChange}
                                    onGetLocation={getCurrentLocation}
                                    gettingLocation={gettingLocation}
                                    className="rounded-xl overflow-hidden"
                                />

                                <LTextInput
                                    label={t('shop.address')}
                                    value={address}
                                    onChange={(e) => {
                                        setAddress(e.target.value);
                                        setAddressError(undefined);
                                    }}
                                    placeholder={t('shop.addressPlaceholder', 'Shop address')}
                                    error={addressError}
                                />

                                <div className="grid grid-cols-2 gap-2">
                                    <LTextInput
                                        label={t('shop.city')}
                                        value={city}
                                        onChange={(e) => {
                                            setCity(e.target.value);
                                            setCityError(undefined);
                                        }}
                                        error={cityError}
                                    />
                                    <LTextInput
                                        label={t('shop.state')}
                                        value={formState}
                                        onChange={(e) => {
                                            setFormState(e.target.value);
                                            setStateError(undefined);
                                        }}
                                        error={stateError}
                                    />
                                </div>

                                <LTextInput
                                    label={selectedCountry.pinLabel}
                                    value={pincode}
                                    onChange={(e) => {
                                        setPincode(e.target.value.replace(/[^a-zA-Z0-9\s-]/g, "").slice(0, 10));
                                        setPincodeError(undefined);
                                    }}
                                    maxLength={10}
                                    error={pincodeError}
                                />
                            </div>

                            {/* Submit Button - always enabled; validation shows red fields on submit */}
                            <LButton
                                variant="primary"
                                size="lg"
                                fullWidth
                                onClick={handleCompleteSetup}
                                loading={loading}
                                className="h-12 rounded-2xl"
                            >
                                {t('auth.createShop')}
                            </LButton>
                        </div>
                    )}
                </LCard>

                <p className="text-center text-xs text-gray-400 mt-8">
                    {t('auth.termsAgreement')}
                </p>
            </div>
        </div>
    );
}
