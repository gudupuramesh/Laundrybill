/**
 * Plant Portal Login Page
 * 
 * Login/Signup page for plant operators
 * Reuses DriverAuthContext mechanism but with Plant branding
 */

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDriverAuth } from "@/features/driver-app/DriverAuthContext";
import {
    LCard,
    LTextInput,
    LButton,
} from "@/components/laundry";
import { Download, LogIn, UserPlus } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";

type AuthMode = "login" | "signup";

function InstallPrompt() {
    const { canInstall, promptInstall } = usePWAInstall();

    if (!canInstall) return null;

    return (
        <LCard className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Download className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-sm">Install App</h3>
                    <p className="text-xs text-muted-foreground">Add to your home screen for better experience</p>
                </div>
                <LButton size="sm" onClick={promptInstall}>Install</LButton>
            </div>
        </LCard>
    );
}

export function PlantLoginPage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { signIn, signUp, loading, error } = useDriverAuth();

    const [mode, setMode] = useState<AuthMode>("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [inviteCode, setInviteCode] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);

    // Force plant login UI to always be in English.
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

    const from = (location.state as any)?.from?.pathname || "/plant/dashboard";

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

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Brand Section */}
                <div className="flex flex-col items-center justify-center mb-8">
                    <div className="flex items-center gap-4 mb-2">
                        <img
                            src="/icons/Gemini_Generated_Image_o2wsl2o2wsl2o2ws-Photoroom.svg"
                            alt="LaundryBill Plant"
                            className="w-16 h-16"
                        />
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">LaundryBill</h1>
                    </div>
                    <p className="text-gray-500 text-sm font-medium">
                        {t("plant.tagline", "Processing & Dispatch Portal")}
                    </p>
                </div>

                <InstallPrompt />

                {/* Login/Signup Card */}
                <LCard className="bg-white shadow-xl border-border/50 p-6 md:p-8 rounded-3xl">
                    <div className="text-center mb-6">
                        <h2 className="text-xl font-bold text-gray-900">
                            {t("plant.appName", "Plant Portal")}
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
                                placeholder="WASH-00000"
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
                            placeholder={t("auth.emailPlaceholder", "operator@example.com")}
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
                    </form>

                    {/* Help Text */}
                    <p className="text-xs text-center text-gray-500 mt-6 px-4 leading-relaxed">
                        {mode === "signup"
                            ? t("plant.signupHelp", "Enter the invite code from your admin to access the plant portal")
                            : t("plant.loginHelp", "Login with your operator credentials")}
                    </p>
                </LCard>

                {/* Footer */}
                <p className="text-xs text-center text-primary/80 mt-8 mb-4 hover:underline cursor-pointer">
                    {t("agent.helpContact", "Need help? Contact your admin")}
                </p>
            </div>
        </div>
    );
}
