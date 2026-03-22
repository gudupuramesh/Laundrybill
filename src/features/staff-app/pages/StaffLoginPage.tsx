/**
 * Staff Login Page
 * 
 * Email + Password login for staff users
 */

import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/lib/firebase";
import { useStaffAuth } from "../StaffAuthContext";
import { LButton, LCard } from "@/components/laundry";
import { Mail, Lock, Loader2, Eye, EyeOff, Download, ArrowLeft } from "lucide-react";
import { t, getCurrentLanguage, changeLanguage } from "@/lib/i18n";
import { usePWAInstall } from "@/hooks/use-pwa-install";

function InstallPrompt() {
    const { canInstall, promptInstall } = usePWAInstall();

    if (!canInstall) return null;

    return (
        <LCard className="mb-6 border-blue-200 bg-blue-50">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Download className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-sm text-gray-900">Install App</h3>
                    <p className="text-xs text-gray-500">Add to your home screen for better experience</p>
                </div>
                <LButton size="sm" onClick={promptInstall} className="bg-blue-600 hover:bg-blue-700 text-white">
                    Install
                </LButton>
            </div>
        </LCard>
    );
}

export function StaffLoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { signIn, loading, error } = useStaffAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [forgotPassword, setForgotPassword] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [resetError, setResetError] = useState<string | null>(null);

    // Force staff login UI to always be in English.
    useEffect(() => {
        const previousLang = getCurrentLanguage();

        if (previousLang !== "en") {
            void changeLanguage("en");
        }

        return () => {
            const current = getCurrentLanguage();
            if (previousLang && previousLang !== current) {
                void changeLanguage(previousLang);
            }
        };
    }, []);

    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/staff";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);

        if (!email.trim()) {
            setLocalError("Please enter your email");
            return;
        }
        if (!password) {
            setLocalError("Please enter your password");
            return;
        }

        try {
            await signIn(email, password);
            navigate(from, { replace: true });
        } catch (err) {
            // Error already set in context
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setResetError(null);
        const emailTrim = email.trim();
        if (!emailTrim) {
            setResetError(t("auth.enterEmail", "Please enter your email address"));
            return;
        }
        setResetLoading(true);
        try {
            const validateFn = httpsCallable<{ email: string; appType: string }, { allowed: boolean }>(
                functions,
                "validateAppLoginEmailForPasswordReset"
            );
            const res = await validateFn({ email: emailTrim, appType: "staff" });
            const allowed = res.data?.allowed === true;
            if (!allowed) {
                setResetError(
                    t(
                        "auth.emailNotStaffOrPlant",
                        "This email is not registered for the Staff App. If you're the shop owner, use the main LaundryBill app to sign in or reset your password there."
                    )
                );
                setResetLoading(false);
                return;
            }
            await sendPasswordResetEmail(auth, emailTrim);
            setResetSent(true);
        } catch (err: any) {
            if (err.code === "auth/user-not-found") {
                setResetError(t("auth.noUserForEmail", "No account found with this email"));
            } else if (err.code === "auth/invalid-email") {
                setResetError(t("auth.invalidEmail", "Please enter a valid email address"));
            } else {
                setResetError(err.message || t("auth.resetFailed", "Could not send reset email"));
            }
        } finally {
            setResetLoading(false);
        }
    };

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
                        {t("staff.login.subtitle")}
                    </p>
                </div>

                <InstallPrompt />

                {/* Login Card */}
                <LCard className="bg-white shadow-xl border-border/50 p-6 md:p-8 rounded-3xl">
                    {forgotPassword ? (
                        <>
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold text-gray-900">
                                    {t("auth.forgotPassword", "Forgot password?")}
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    {t("auth.forgotPasswordHint", "Enter your email and we'll send you a link to reset your password.")}
                                </p>
                            </div>
                            {resetSent ? (
                                <div className="space-y-4">
                                    <div className="bg-green-50 text-green-700 rounded-xl px-4 py-3 text-sm border border-green-100">
                                        {t("auth.resetEmailSent", "Check your email for a link to reset your password. If you don't see it, check your spam folder.")}
                                    </div>
                                    <LButton
                                        type="button"
                                        variant="outline"
                                        fullWidth
                                        onClick={() => { setForgotPassword(false); setResetSent(false); }}
                                    >
                                        <ArrowLeft className="h-4 w-4 mr-2" />
                                        {t("auth.backToLogin", "Back to login")}
                                    </LButton>
                                </div>
                            ) : (
                                <form onSubmit={handleForgotPassword} className="space-y-5">
                                    {resetError && (
                                        <div className="bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm font-medium border border-red-100">
                                            {resetError}
                                        </div>
                                    )}
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-gray-700 ml-1">{t("staff.login.email")}</label>
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="started@laundrybill.com"
                                                className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <LButton
                                            type="button"
                                            variant="outline"
                                            onClick={() => { setForgotPassword(false); setResetError(null); }}
                                            className="flex-1"
                                        >
                                            <ArrowLeft className="h-4 w-4 mr-2" />
                                            {t("common.cancel", "Cancel")}
                                        </LButton>
                                        <LButton
                                            type="submit"
                                            variant="primary"
                                            disabled={resetLoading}
                                            className="flex-1"
                                        >
                                            {resetLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : t("auth.sendResetLink", "Send reset link")}
                                        </LButton>
                                    </div>
                                </form>
                            )}
                        </>
                    ) : (
                    <>
                    <div className="text-center mb-6">
                        <h2 className="text-xl font-bold text-gray-900">
                            {t("staff.login.title")}
                        </h2>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Error */}
                        {(localError || error) && (
                            <div className="bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm font-medium border border-red-100 flex items-center gap-2">
                                <span className="text-lg">!</span>
                                {localError || error}
                            </div>
                        )}

                        {/* Email */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700 ml-1">{t("staff.login.email")}</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="started@laundrybill.com"
                                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-200 bg-gray-50/50 
                                        text-gray-900 placeholder:text-gray-400 
                                        focus:outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700 ml-1">{t("staff.login.password")}</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-12 pr-12 py-3.5 rounded-2xl border border-gray-200 bg-gray-50/50 
                                        text-gray-900 placeholder:text-gray-400 
                                        focus:outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <LButton
                            type="submit"
                            variant="primary"
                            size="lg"
                            fullWidth
                            disabled={loading}
                            className="h-12 rounded-2xl text-base mt-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                    {t("common.loading")}
                                </>
                            ) : (
                                t("staff.login.submit")
                            )}
                        </LButton>

                        {/* Forgot password */}
                        <p className="text-center text-sm">
                            <button
                                type="button"
                                onClick={() => setForgotPassword(true)}
                                className="text-primary hover:text-primary-dark font-medium hover:underline"
                            >
                                {t("auth.forgotPassword", "Forgot password?")}
                            </button>
                        </p>

                        {/* Signup Link */}
                        <p className="text-center text-sm text-gray-500 pt-2">
                            {t("staff.login.noAccount")}{" "}
                            <Link to="/staff/signup" className="text-primary hover:text-primary-dark font-semibold hover:underline">
                                {t("staff.login.signUp")}
                            </Link>
                        </p>
                    </form>
                    </>
                    )}
                </LCard>

                <p className="text-center text-xs text-gray-400 mt-8">
                    Protected by LaundryBill Security
                </p>
            </div>
        </div>
    );
}
