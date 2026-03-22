/**
 * Staff Signup Page
 * 
 * New staff members sign up with their invite code
 */

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useStaffAuth } from "../StaffAuthContext";
import { LButton } from "@/components/laundry";
import { Mail, Lock, Key, Loader2, Eye, EyeOff } from "lucide-react";
import { t } from "@/lib/i18n";

export function StaffSignupPage() {
    const navigate = useNavigate();
    const { signUp, loading, error } = useStaffAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [inviteCode, setInviteCode] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);

        // Validation
        if (!email.trim()) {
            setLocalError("Please enter your email");
            return;
        }
        if (password.length < 6) {
            setLocalError("Password must be at least 6 characters");
            return;
        }
        if (password !== confirmPassword) {
            setLocalError("Passwords don't match");
            return;
        }
        if (!inviteCode.trim()) {
            setLocalError("Please enter your invite code");
            return;
        }

        try {
            await signUp(email, password, inviteCode);
            navigate("/staff", { replace: true });
        } catch (err) {
            // Error already set in context
        }
    };

    const formatInviteCode = (value: string) => {
        // Auto-format: XXXX-XXXXX
        const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (clean.length <= 4) {
            return clean;
        }
        return `${clean.slice(0, 4)}-${clean.slice(4, 9)}`;
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden">
                {/* Header */}
                <div className="bg-primary px-6 pt-12 pb-8 flex flex-col items-center justify-center">
                    <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                        <span className="text-3xl">👕</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-1">
                        {t("staff.signup.title")}
                    </h1>
                    <p className="text-white/70 text-sm text-center">
                        {t("staff.signup.subtitle")}
                    </p>
                </div>

                {/* Signup Form */}
                <div className="px-6 pt-8 pb-12">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Error */}
                        {(localError || error) && (
                            <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-xl px-4 py-3 text-sm">
                                {localError || error}
                            </div>
                        )}

                        {/* Invite Code */}
                        <div className="relative">
                            <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
                            <input
                                type="text"
                                value={inviteCode}
                                onChange={(e) => setInviteCode(formatInviteCode(e.target.value))}
                                placeholder={t("staff.signup.inviteCodePlaceholder")}
                                className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-border bg-muted/30 
                                    text-foreground placeholder:text-muted-foreground 
                                    focus:outline-none focus:border-primary focus:bg-background
                                    font-mono text-center text-lg tracking-wider uppercase"
                                maxLength={10}
                            />
                        </div>

                        {/* Email */}
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder={t("staff.signup.email")}
                                className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-border bg-muted/30 
                                    text-foreground placeholder:text-muted-foreground 
                                    focus:outline-none focus:border-primary focus:bg-background"
                            />
                        </div>

                        {/* Password */}
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t("staff.signup.password")}
                                className="w-full pl-12 pr-12 py-4 rounded-2xl border-2 border-border bg-muted/30 
                                    text-foreground placeholder:text-muted-foreground 
                                    focus:outline-none focus:border-primary focus:bg-background"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>

                        {/* Confirm Password */}
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
                            <input
                                type={showPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder={t("staff.signup.confirmPassword")}
                                className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-border bg-muted/30 
                                    text-foreground placeholder:text-muted-foreground 
                                    focus:outline-none focus:border-primary focus:bg-background"
                            />
                        </div>

                        {/* Submit Button */}
                        <LButton
                            type="submit"
                            variant="primary"
                            size="lg"
                            fullWidth
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                    {t("common.loading")}
                                </>
                            ) : (
                                t("staff.signup.submit")
                            )}
                        </LButton>

                        {/* Login Link */}
                        <p className="text-center text-sm text-muted-foreground">
                            {t("staff.signup.haveAccount")}{" "}
                            <Link to="/staff/login" className="text-primary hover:underline font-medium">
                                {t("staff.signup.signIn")}
                            </Link>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
}
