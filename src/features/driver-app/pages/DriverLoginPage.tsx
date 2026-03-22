/**
 * Driver Login Page
 * 
 * Login/Signup page for delivery agents
 * Email + password authentication (like Staff App)
 * 
 * Agent flow:
 * 1. Admin creates agent with invite code in Staff page
 * 2. Agent signs up with email, password, and invite code
 * 3. Agent logs in with email and password
 */

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { sendPasswordResetEmail } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/lib/firebase";
import { useDriverAuth } from "../DriverAuthContext";
import {
    LCard,
    LTextInput,
    LButton,
} from "@/components/laundry";
import { LogIn, UserPlus, Download, ArrowLeft, Loader2 } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";

type AuthMode = "login" | "signup";

function InstallPrompt() {
    const { canInstall, promptInstall } = usePWAInstall();

    if (!canInstall) return null;

    return (
        <LCard className="mb-6 border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <Download className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-sm">Install App</h3>
                    <p className="text-xs text-muted-foreground">Add to your home screen for better experience</p>
                </div>
                <LButton size="sm" onClick={promptInstall} className="bg-green-600 hover:bg-green-700">Install</LButton>
            </div>
        </LCard>
    );
}

export function DriverLoginPage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { signIn, signUp, loading, error } = useDriverAuth();

    const [mode, setMode] = useState<AuthMode>("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [inviteCode, setInviteCode] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);
    const [forgotPassword, setForgotPassword] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [resetError, setResetError] = useState<string | null>(null);

    // Force driver login UI to always be in English.
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

    const from = (location.state as any)?.from?.pathname || "/agent";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);

        if (!email.trim() || !password.trim()) {
            setLocalError(t("auth.fillAllFields", "Please fill in all fields"));
            return;
        }

        if (mode === "signup" && !inviteCode.trim()) {
            setLocalError(t("auth.inviteRequired", "Invite code is required"));
            return;
        }

        try {
            if (mode === "signup") {
                await signUp(email, password, inviteCode);
            } else {
                await signIn(email, password);
            }
            navigate(from, { replace: true });
        } catch (err) {
            // Error is handled by context
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
            const res = await validateFn({ email: emailTrim, appType: "agent" });
            const allowed = res.data?.allowed === true;
            if (!allowed) {
                setResetError(
                    t(
                        "auth.emailNotAgent",
                        "This email is not registered for the Agent App. If you're the shop owner, use the main LaundryBill app. Otherwise ask your admin to add you as a delivery agent."
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
                            alt="LaundryBill Agent"
                            className="w-16 h-16"
                        />
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">LaundryBill</h1>
                    </div>
                    <p className="text-gray-500 text-sm font-medium">
                        {t("agent.tagline", "Pickup & Delivery App")}
                    </p>
                </div>

                <InstallPrompt />

                {/* Login/Signup Card */}
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
                                <form onSubmit={handleForgotPassword} className="space-y-4">
                                    {resetError && (
                                        <div className="bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm font-medium border border-red-100">
                                            {resetError}
                                        </div>
                                    )}
                                    <LTextInput
                                        label={t("auth.email", "Email")}
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder={t("auth.emailPlaceholder", "you@example.com")}
                                        className="rounded-2xl"
                                    />
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
                            {t("agent.appName", "Agent Portal")}
                        </h2>
                    </div>

                    {/* Mode Tabs */}
                    <div className="flex border-b border-gray-100 mb-6 pb-1">
                        <button
                            type="button"
                            onClick={() => setMode("login")}
                            className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${mode === "login"
                                ? "text-primary border-primary"
                                : "text-gray-400 border-transparent hover:text-gray-600"
                                }`}
                        >
                            <LogIn className="h-4 w-4 inline mr-2" />
                            {t("auth.login", "Login")}
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode("signup")}
                            className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${mode === "signup"
                                ? "text-primary border-primary"
                                : "text-gray-400 border-transparent hover:text-gray-600"
                                }`}
                        >
                            <UserPlus className="h-4 w-4 inline mr-2" />
                            {t("auth.signup", "Sign Up")}
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Invite Code - Only for signup */}
                        {mode === "signup" && (
                            <LTextInput
                                label={t("auth.inviteCode", "Invite Code")}
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                placeholder="XXXX-00000"
                                required
                                className="rounded-2xl"
                            />
                        )}

                        {/* Email */}
                        <LTextInput
                            label={t("auth.email", "Email")}
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t("auth.emailPlaceholder", "you@example.com")}
                            required
                            className="rounded-2xl"
                        />

                        {/* Password */}
                        <LTextInput
                            label={t("auth.password", "Password")}
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            className="rounded-2xl"
                        />

                        {/* Error Message */}
                        {(error || localError) && (
                            <div className="bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm font-medium border border-red-100 flex items-center gap-2">
                                <span className="text-lg">!</span>
                                {localError || error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <LButton
                            type="submit"
                            variant="primary"
                            size="lg"
                            className="w-full h-12 rounded-2xl text-base mt-2"
                            loading={loading}
                        >
                            {mode === "login"
                                ? t("auth.loginBtn", "Login")
                                : t("auth.signupBtn", "Create Account")}
                        </LButton>

                        {/* Forgot password - only when in login mode */}
                        {mode === "login" && (
                            <p className="text-center text-sm mt-3">
                                <button
                                    type="button"
                                    onClick={() => setForgotPassword(true)}
                                    className="text-primary hover:underline font-medium"
                                >
                                    {t("auth.forgotPassword", "Forgot password?")}
                                </button>
                            </p>
                        )}
                    </form>

                    {/* Help Text */}
                    <p className="text-xs text-center text-gray-500 mt-6 px-4 leading-relaxed">
                        {mode === "signup"
                            ? t("agent.signupHelp", "Enter the invite code given by your admin")
                            : t("agent.loginHelp", "Use the credentials you created during signup")}
                    </p>
                    </>
                    )}
                </LCard>

                {/* Footer */}
                <p className="text-xs text-center text-primary/80 mt-8 mb-4 hover:underline cursor-pointer">
                    {t("agent.helpContact", "Need help? Contact your admin")}
                </p>
            </div>
        </div>
    );
}
