/**
 * Super Admin Login Page
 * 
 * Login page for platform administrators
 */

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSuperAdmin } from "../SuperAdminAuthContext";
import { LButton, LCard } from "@/components/laundry";
import { Shield, Mail, Lock, AlertCircle, Download } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";

function InstallPrompt() {
    const { canInstall, promptInstall } = usePWAInstall();

    if (!canInstall) return null;

    return (
        <LCard className="mb-6 border-red-200 bg-red-50">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <Download className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-sm text-gray-900">Install App</h3>
                    <p className="text-xs text-gray-500">Add to your home screen for better experience</p>
                </div>
                <LButton size="sm" onClick={promptInstall} className="bg-red-600 hover:bg-red-700 text-white">
                    Install
                </LButton>
            </div>
        </LCard>
    );
}

export function SuperAdminLoginPage() {
    const { signIn, loading, error: authError } = useSuperAdmin();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const from = (location.state as any)?.from || "/super-admin";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            await signIn(email, password);
            navigate(from, { replace: true });
        } catch (err: any) {
            setError(err.message || "Failed to sign in");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            {/* Background pattern */}
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5 pointer-events-none" />

            <div className="relative w-full max-w-md">
                {/* Brand Section */}
                <div className="flex flex-col items-center justify-center mb-8">
                    <div className="flex items-center gap-4 mb-2">
                        <img
                            src="/icons/Gemini_Generated_Image_o2wsl2o2wsl2o2ws-Photoroom.svg"
                            alt="LaundryBill Admin"
                            className="w-16 h-16"
                        />
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">LaundryBill</h1>
                    </div>
                    <p className="text-gray-500 text-sm font-medium">
                        Platform Administration
                    </p>
                </div>

                <InstallPrompt />

                <LCard variant="elevated" padding="lg" className="bg-white shadow-xl rounded-3xl border-border/50">
                    <div className="text-center mb-6">
                        <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                            <Shield className="h-6 w-6 text-red-600" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">
                            Super Admin Login
                        </h2>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Error message */}
                        {(error || authError) && (
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                                <p className="text-sm text-red-600 font-medium">
                                    {error || authError}
                                </p>
                            </div>
                        )}

                        {/* Email */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700 ml-1">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder="admin@laundrybill.com"
                                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-200 bg-gray-50/50 
                                        text-gray-900 placeholder:text-gray-400 
                                        focus:outline-none focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10 transition-all"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700 ml-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-200 bg-gray-50/50 
                                        text-gray-900 placeholder:text-gray-400 
                                        focus:outline-none focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10 transition-all"
                                />
                            </div>
                        </div>

                        {/* Submit */}
                        <LButton
                            type="submit"
                            variant="primary"
                            size="lg"
                            fullWidth
                            loading={submitting || loading}
                            className="h-12 rounded-2xl text-base mt-2 bg-red-600 hover:bg-red-700 border-red-600"
                        >
                            Sign In to Admin Panel
                        </LButton>
                    </form>

                    <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                        <p className="text-xs text-gray-400 leading-relaxed">
                            Access restricted to authorized personnel only.
                            <br />
                            This activity is monitored.
                        </p>
                    </div>
                </LCard>

                {/* Back to app */}
                <div className="text-center mt-8">
                    <a
                        href="/login"
                        className="text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors"
                    >
                        ← Back to Shop Login
                    </a>
                </div>
            </div>
        </div>
    );
}
