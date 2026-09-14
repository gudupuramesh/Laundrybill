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
import { TeamAuthShell, tl } from "./TeamAuthShell";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    sendPasswordResetEmail,
} from "firebase/auth";
import {
    collection,
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
import { consumeEvictionFlag, claimWebSession } from "@/lib/session-guard";

/** Portal home for a member. Managers get the owner-style web dashboard (with
 *  owner-only pages gated); plain staff use the staff portal. */
function routeForMember(memberType?: string, role?: string): string {
    if (memberType === "agent") return "/agent";
    if (memberType === "plant") return "/plant";
    if (role === "manager") return "/";
    return "/staff";
}

/** TOTAL login cap from a plan's limits (any role mix); legacy per-role sum fallback. */
function teamLoginCap(limits: Record<string, number> | undefined): number {
    if (!limits) return 0;
    if (typeof limits.maxTeamLogins === "number") return limits.maxTeamLogins;
    const parts = [limits.maxStaff ?? 0, limits.maxDeliveryAgents ?? 0, limits.maxPlantStaff ?? 0];
    if (parts.some((p) => p === -1)) return -1;
    return parts.reduce((a, b) => a + Math.max(0, b), 0);
}

type TeamLoginBlock = null | { reason: "expired" } | { reason: "over_cap"; cap: number };

/**
 * Is this member's login still covered by the shop's plan?
 *  - "expired": the plan lacks the member's app feature (Free/Pro/lapsed) → all blocked.
 *  - "over_cap": plan has team logins but the shop exceeds the TOTAL cap (e.g.
 *    Business 15 → Pro+ 4); the OLDEST `cap` logins keep working, newer are blocked.
 */
async function shopLoginBlock(shopId: string, memberType: string | undefined, memberId: string): Promise<TeamLoginBlock> {
    try {
        const shopSnap = await getDoc(doc(db, "shops", shopId));
        const planId = (shopSnap.data()?.plan as string) || "free";
        const planSnap = await getDoc(doc(db, "plans", planId));
        const features = (planSnap.data()?.features || {}) as Record<string, boolean>;
        const key = memberType === "agent" ? "driverApp" : memberType === "plant" ? "plantApp" : "staffApp";
        if (features[key] !== true) return { reason: "expired" };

        const cap = teamLoginCap(planSnap.data()?.limits as Record<string, number> | undefined);
        if (cap >= 0) {
            const all = await getDocs(collection(db, "shops", shopId, "teamMembers"));
            const ranked = all.docs
                .map((d) => {
                    const at = (d.data().createdAt as { toMillis?: () => number; seconds?: number } | undefined);
                    return { id: d.id, at: at?.toMillis?.() ?? (at?.seconds ? at.seconds * 1000 : 0) };
                })
                .sort((a, b) => a.at - b.at);
            const index = ranked.findIndex((r) => r.id === memberId);
            if (index >= cap) return { reason: "over_cap", cap };
        }
        return null;
    } catch {
        return null; // fail-open: don't lock out paying staff on a transient read error
    }
}

/**
 * Find where a signed-in user should land. Looks up teamMembers by authUid (any role),
 * retrying once for replication lag, then falls back to the legacy `staff` collection.
 * `home` is null if the account isn't a team member (e.g. a shop owner); `blocked` is
 * true if they ARE a team member but their shop's plan no longer includes team logins
 * (e.g. downgraded to Pro) — team logins are a Pro+/Business feature.
 */
async function resolveTeamHome(uid: string): Promise<{ home: string | null; blocked: TeamLoginBlock }> {
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
    if (!memberDoc) return { home: null, blocked: null };

    const memberType = memberDoc.data().memberType as string | undefined;
    const memberRole = memberDoc.data().role as string | undefined;
    const shopId = memberDoc.ref.parent.parent?.id;
    if (shopId) {
        const block = await shopLoginBlock(shopId, memberType, memberDoc.id);
        if (block) return { home: null, blocked: block };
    }
    return { home: routeForMember(memberType, memberRole), blocked: null };
}

const TEAM_PLAN_BLOCKED_MSG =
    "Your shop's plan no longer includes team app logins. Ask the shop owner to upgrade to Pro+ or Business.";
const blockedMessage = (block: TeamLoginBlock): string =>
    block?.reason === "over_cap"
        ? `Your shop's current plan allows ${block.cap} team login${block.cap === 1 ? "" : "s"} and this login is outside that limit. Ask the shop owner to upgrade or free up a login slot.`
        : TEAM_PLAN_BLOCKED_MSG;

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
                // A confirmed team member landing here (e.g. reload) claims their web slot;
                // an owner who merely opened this page resolves to no home and is left alone.
                if (res.home) { claimWebSession(current.uid); navigate(res.home, { replace: true }); return; }
                if (res.blocked) { firebaseSignOut(auth).catch(() => {}); setError(blockedMessage(res.blocked)); }
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
                        ? blockedMessage(res.blocked)
                        : "This account isn't registered as a team member. If you're the shop owner, use the main LaundryBill app to sign in."
                );
                setLoading(false);
                return;
            }

            // Single-web-session: the owner AuthContext no longer auto-claims on team
            // routes (so an owner opening this page can't evict their own dashboard), so
            // an actual team login must claim its own web slot here.
            claimWebSession(cred.user.uid);

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

    const busy = loading || resetLoading;
    return (
        <TeamAuthShell
            title={forgotPassword ? "Forgot password?" : "Team sign in"}
            subtitle={forgotPassword ? "We'll email you a link to reset it" : "Staff, plant & delivery agents"}
        >
            <InstallPrompt />
            {forgotPassword ? (
                resetSent ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                        <div style={tl.success}>Check your email for a link to reset your password. If you don't see it, check your spam folder.</div>
                        <button type="button" style={tl.outline} onClick={() => { setForgotPassword(false); setResetSent(false); }}>
                            <ArrowLeft size={18} /> Back to sign in
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleForgotPassword} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        {resetError && <div style={tl.error}>{resetError}</div>}
                        <div>
                            <label style={tl.label}>Email</label>
                            <div style={tl.box(!!resetError)}>
                                <Mail style={tl.icon} />
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={tl.bare} autoComplete="email" />
                            </div>
                        </div>
                        <button type="submit" disabled={resetLoading} style={tl.primary(resetLoading)}>
                            {resetLoading ? <Loader2 size={20} className="animate-spin" /> : "Send reset link"}
                        </button>
                        <button type="button" style={{ ...tl.link, alignSelf: "center", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => { setForgotPassword(false); setResetError(null); }}>
                            <ArrowLeft size={16} /> Back to sign in
                        </button>
                    </form>
                )
            ) : (
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {error && <div style={tl.error}>{error}</div>}
                    <div>
                        <label style={tl.label}>Email</label>
                        <div style={tl.box(!!error)}>
                            <Mail style={tl.icon} />
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={tl.bare} autoComplete="email" />
                        </div>
                    </div>
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <label style={tl.label}>Password</label>
                            <button type="button" style={{ ...tl.link, fontSize: 14.5 }} onClick={() => setForgotPassword(true)}>Forgot password?</button>
                        </div>
                        <div style={tl.box(!!error)}>
                            <Lock style={tl.icon} />
                            <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" style={tl.bare} autoComplete="current-password" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} style={{ border: 0, background: "transparent", padding: 4, cursor: "pointer", color: "#6B7280", display: "flex" }}>
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>
                    <button type="submit" disabled={busy} style={tl.primary(loading)}>
                        {loading ? <><Loader2 size={20} className="animate-spin" />{t("common.loading", "Loading...")}</> : "Sign in"}
                    </button>
                    <p style={{ textAlign: "center", fontSize: 15, color: "#4B5563", margin: 0 }}>
                        Have an invite code? <Link to="/team/signup" style={tl.link}>Activate your account</Link>
                    </p>
                </form>
            )}
        </TeamAuthShell>
    );
}
