/**
 * Unified Team Login
 *
 * ONE login for every team role — staff, plant operator, delivery agent and manager.
 * Signs in with email + password, resolves the member's role from their `teamMembers`
 * doc (no memberType pre-filter, so nobody gets "stuck" on the wrong login), and routes
 * to the matching portal:
 *   agent  -> /agent
 *   plant  -> /plant
 *   staff  -> /staff   (managers are memberType "staff" and land here too)
 *
 * Each portal's own auth provider then loads its data from the persisted Firebase session.
 */

import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    sendPasswordResetEmail,
} from "firebase/auth";
import {
    collectionGroup,
    query,
    where,
    getDocs,
    getDoc,
    doc,
    updateDoc,
    serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "@/lib/firebase";
import { LButton, LCard } from "@/components/laundry";
import { Mail, Lock, Loader2, Eye, EyeOff, Download, ArrowLeft } from "lucide-react";
import { t, getCurrentLanguage, changeLanguage } from "@/lib/i18n";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { consumeEvictionFlag } from "@/lib/session-guard";

/** Portal home for a given member type. Staff + manager share the staff portal. */
function routeForMember(memberType?: string): string {
    if (memberType === "agent") return "/agent";
    if (memberType === "plant") return "/plant";
    return "/staff";
}

/** Does the member's shop plan include the app-login feature for their role? */
async function shopAllowsLogin(shopId: string, memberType?: string): Promise<boolean> {
    try {
        const shopSnap = await getDoc(doc(db, "shops", shopId));
        const planId = (shopSnap.data()?.plan as string) || "free";
        const planSnap = await getDoc(doc(db, "plans", planId));
        const features = (planSnap.data()?.features || {}) as Record<string, boolean>;
        const key = memberType === "agent" ? "driverApp" : memberType === "plant" ? "plantApp" : "staffApp";
        return features[key] === true;
    } catch {
        return true; // fail-open: don't lock out paying staff on a transient read error
    }
}

/**
 * Find where a signed-in user should land. Looks up teamMembers by authUid (any role),
 * retrying once for replication lag, then falls back to the legacy `staff` collection.
 * `home` is null if the account isn't a team member (e.g. a shop owner); `blocked` is
 * true if they ARE a team member but their shop's plan no longer includes team logins
 * (e.g. downgraded to Pro) — team logins are a Pro+/Business feature.
 */
async function resolveTeamHome(uid: string): Promise<{ home: string | null; blocked: boolean }> {
    const fetchTeam = () =>
        getDocs(query(collectionGroup(db, "teamMembers"), where("authUid", "==", uid)));

    let snap = await fetchTeam();
    if (snap.empty) {
        await new Promise((r) => setTimeout(r, 500));
        snap = await fetchTeam();
    }
    let memberDoc = snap.empty ? null : snap.docs[0];
    if (!memberDoc) {
        // Legacy fallback: staff collection
        const staffSnap = await getDocs(query(collectionGroup(db, "staff"), where("authUid", "==", uid)));
        if (!staffSnap.empty) memberDoc = staffSnap.docs[0];
    }
    if (!memberDoc) return { home: null, blocked: false };

    const memberType = memberDoc.data().memberType as string | undefined;
    const shopId = memberDoc.ref.parent.parent?.id;
    if (shopId && !(await shopAllowsLogin(shopId, memberType))) {
        return { home: null, blocked: true };
    }
    return { home: routeForMember(memberType), blocked: false };
}

const TEAM_PLAN_BLOCKED_MSG =
    "Your shop's plan no longer includes team app logins. Ask the shop owner to upgrade to Pro+ or Business.";

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

export function TeamLoginPage() {
    const navigate = useNavigate();
    const location = useLocation();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [booting, setBooting] = useState(true);

    const [forgotPassword, setForgotPassword] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [resetError, setResetError] = useState<string | null>(null);

    // Show a notice if this session was signed out by a newer login elsewhere.
    useEffect(() => {
        if (consumeEvictionFlag()) {
            setError("You were signed out because your account was signed in on another device.");
        }
    }, []);

    // Force the team login UI to English (matches the staff/agent login behaviour).
    useEffect(() => {
        const previousLang = getCurrentLanguage();
        if (previousLang !== "en") void changeLanguage("en");
        return () => {
            const current = getCurrentLanguage();
            if (previousLang && previousLang !== current) void changeLanguage(previousLang);
        };
    }, []);

    // If already signed in, send them straight to their portal.
    useEffect(() => {
        let active = true;
        const current = auth.currentUser;
        if (!current) {
            setBooting(false);
            return;
        }
        resolveTeamHome(current.uid)
            .then((res) => {
                if (!active) return;
                if (res.home) { navigate(res.home, { replace: true }); return; }
                if (res.blocked) { firebaseSignOut(auth).catch(() => {}); setError(TEAM_PLAN_BLOCKED_MSG); }
                setBooting(false);
            })
            .catch(() => active && setBooting(false));
        return () => {
            active = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!email.trim()) {
            setError("Please enter your email");
            return;
        }
        if (!password) {
            setError("Please enter your password");
            return;
        }

        setLoading(true);
        try {
            const cred = await signInWithEmailAndPassword(auth, email.trim(), password);

            // Best-effort lastLogin (user doc may not exist for legacy accounts).
            try {
                await updateDoc(doc(db, "users", cred.user.uid), { lastLogin: serverTimestamp() });
            } catch {
                /* ignore */
            }

            const res = await resolveTeamHome(cred.user.uid);
            if (!res.home) {
                await firebaseSignOut(auth);
                setError(
                    res.blocked
                        ? TEAM_PLAN_BLOCKED_MSG
                        : "This account isn't registered as a team member. If you're the shop owner, use the main LaundryBill app to sign in."
                );
                setLoading(false);
                return;
            }

            const requested = (location.state as { from?: { pathname: string } })?.from?.pathname;
            // Only honour the saved destination if it belongs to this member's portal.
            const dest = requested && requested.startsWith(res.home) ? requested : res.home;
            navigate(dest, { replace: true });
        } catch (err: any) {
            if (err?.code === "auth/user-not-found" || err?.code === "auth/wrong-password" || err?.code === "auth/invalid-credential") {
                setError("Invalid email or password");
            } else if (err?.code === "auth/invalid-email") {
                setError("Please enter a valid email address");
            } else if (err?.code === "auth/too-many-requests") {
                setError("Too many attempts. Please wait a moment and try again.");
            } else {
                setError(err?.message || "Sign in failed");
            }
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setResetError(null);
        const emailTrim = email.trim();
        if (!emailTrim) {
            setResetError("Please enter your email address");
            return;
        }
        setResetLoading(true);
        try {
            const validateFn = httpsCallable<{ email: string; appType: string }, { allowed: boolean }>(
                functions,
                "validateAppLoginEmailForPasswordReset"
            );
            // "staff" covers staff + plant; fall back to "agent".
            let allowed = (await validateFn({ email: emailTrim, appType: "staff" })).data?.allowed === true;
            if (!allowed) {
                allowed = (await validateFn({ email: emailTrim, appType: "agent" })).data?.allowed === true;
            }
            if (!allowed) {
                setResetError(
                    "This email isn't registered for a team login. If you're the shop owner, use the main LaundryBill app to reset your password."
                );
                setResetLoading(false);
                return;
            }
            await sendPasswordResetEmail(auth, emailTrim);
            setResetSent(true);
        } catch (err: any) {
            if (err?.code === "auth/user-not-found") {
                setResetError("No account found with this email");
            } else if (err?.code === "auth/invalid-email") {
                setResetError("Please enter a valid email address");
            } else {
                setResetError(err?.message || "Could not send reset email");
            }
        } finally {
            setResetLoading(false);
        }
    };

    if (booting) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Brand */}
                <div className="flex flex-col items-center justify-center mb-8">
                    <img
                        src="/icons/team-login-logo.png"
                        alt="LaundryBill Team"
                        className="w-24 h-24 rounded-3xl shadow-lg mb-3"
                    />
                    <p className="text-gray-500 text-sm font-medium">Team sign in</p>
                </div>

                <InstallPrompt />

                <LCard className="bg-white shadow-xl border-border/50 p-6 md:p-8 rounded-3xl">
                    {forgotPassword ? (
                        <>
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold text-gray-900">Forgot password?</h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    Enter your email and we'll send you a link to reset your password.
                                </p>
                            </div>
                            {resetSent ? (
                                <div className="space-y-4">
                                    <div className="bg-green-50 text-green-700 rounded-xl px-4 py-3 text-sm border border-green-100">
                                        Check your email for a link to reset your password. If you don't see it, check your spam folder.
                                    </div>
                                    <LButton
                                        type="button"
                                        variant="outline"
                                        fullWidth
                                        onClick={() => {
                                            setForgotPassword(false);
                                            setResetSent(false);
                                        }}
                                    >
                                        <ArrowLeft className="h-4 w-4 mr-2" />
                                        Back to login
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
                                        <label className="text-sm font-medium text-gray-700 ml-1">Email</label>
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="you@laundrybill.com"
                                                className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <LButton
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setForgotPassword(false);
                                                setResetError(null);
                                            }}
                                            className="flex-1"
                                        >
                                            <ArrowLeft className="h-4 w-4 mr-2" />
                                            Cancel
                                        </LButton>
                                        <LButton type="submit" variant="primary" disabled={resetLoading} className="flex-1">
                                            {resetLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send reset link"}
                                        </LButton>
                                    </div>
                                </form>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold text-gray-900">Sign in to your account</h2>
                                <p className="text-sm text-gray-500 mt-1">Staff, plant &amp; delivery agents</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                {error && (
                                    <div className="bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm font-medium border border-red-100 flex items-center gap-2">
                                        <span className="text-lg">!</span>
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@laundrybill.com"
                                            className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full pl-12 pr-12 py-3.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all"
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
                                            {t("common.loading", "Loading...")}
                                        </>
                                    ) : (
                                        "Sign in"
                                    )}
                                </LButton>

                                <p className="text-center text-sm">
                                    <button
                                        type="button"
                                        onClick={() => setForgotPassword(true)}
                                        className="text-primary hover:text-primary-dark font-medium hover:underline"
                                    >
                                        Forgot password?
                                    </button>
                                </p>

                                <p className="text-center text-sm text-gray-500 pt-2">
                                    Have an invite code?{" "}
                                    <Link to="/team/signup" className="text-primary hover:text-primary-dark font-semibold hover:underline">
                                        Sign up
                                    </Link>
                                </p>
                            </form>
                        </>
                    )}
                </LCard>

                <p className="text-center text-xs text-gray-400 mt-8">Protected by LaundryBill Security</p>
            </div>
        </div>
    );
}
