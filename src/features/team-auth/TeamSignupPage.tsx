/**
 * Unified Team Signup
 *
 * ONE invite-code signup for every team role. Looks up the invite in `teamMembers`
 * (any memberType — staff / plant / agent), creates the Firebase Auth account, links it
 * to the member doc, and routes to the matching portal. Mirrors the per-role signUp logic
 * that previously lived in StaffAuthContext / DriverAuthContext, merged into one flow.
 */

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
    collectionGroup,
    query,
    where,
    getDocs,
    getDoc,
    doc,
    setDoc,
    updateDoc,
    serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { TeamAuthShell, tl } from "./TeamAuthShell";
import { Mail, Lock, KeyRound, Loader2, Eye, EyeOff } from "lucide-react";
import { getCurrentLanguage, changeLanguage } from "@/lib/i18n";

const INVITE_RE = /^[A-Z0-9]{4}-\d{5}$/;

function routeForMember(memberType?: string, role?: string): string {
    if (memberType === "agent") return "/agent";
    if (memberType === "plant") return "/plant";
    if (role === "manager") return "/"; // managers use the owner-style web dashboard
    return "/staff";
}

/** users.role written for each member type (kept consistent with the legacy contexts). */
function userRoleFor(memberType?: string, role?: string): string {
    if (memberType === "agent") return "agent";
    if (memberType === "plant") return "plant_operator";
    if (role === "manager") return "manager";
    return "staff";
}

export function TeamSignupPage() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [inviteCode, setInviteCode] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const previousLang = getCurrentLanguage();
        if (previousLang !== "en") void changeLanguage("en");
        return () => {
            const current = getCurrentLanguage();
            if (previousLang && previousLang !== current) void changeLanguage(previousLang);
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!email.trim()) return setError("Please enter your email");
        if (!password) return setError("Please enter a password");

        const cleanCode = inviteCode.trim().toUpperCase();
        if (!INVITE_RE.test(cleanCode)) {
            return setError("Invalid invite code format. Expected: XXXX-00000");
        }

        setLoading(true);
        try {
            // 1. teamMembers (any role) by invite code.
            const tmSnap = await getDocs(
                query(collectionGroup(db, "teamMembers"), where("inviteCode", "==", cleanCode))
            );

            if (!tmSnap.empty) {
                const tmDoc = tmSnap.docs[0];
                const tmData = tmDoc.data() as any;
                if (tmData.inviteStatus === "accepted") {
                    throw new Error("This invite code has already been used. Please sign in instead.");
                }
                if (tmData.email && tmData.email.toLowerCase() !== email.trim().toLowerCase()) {
                    throw new Error("Email doesn't match the invite. Please use the email your admin registered.");
                }
                const shopRef = tmDoc.ref.parent.parent;
                if (!shopRef) throw new Error("Shop not found");

                const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
                const uid = cred.user.uid;

                await setDoc(doc(db, "users", uid), {
                    email: email.trim().toLowerCase(),
                    role: userRoleFor(tmData.memberType, tmData.role),
                    shopId: shopRef.id,
                    teamMemberId: tmDoc.id,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    status: "active",
                });

                await updateDoc(tmDoc.ref, {
                    authUid: uid,
                    inviteStatus: "accepted",
                    lastLoginAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });

                navigate(routeForMember(tmData.memberType, tmData.role), { replace: true });
                return;
            }

            // 2. Legacy fallback: staff collection by invite code.
            const staffSnap = await getDocs(
                query(collectionGroup(db, "staff"), where("inviteCode", "==", cleanCode))
            );
            if (staffSnap.empty) {
                throw new Error("Invalid invite code. Please check and try again.");
            }
            const staffDoc = staffSnap.docs[0];
            const staffData = staffDoc.data() as any;
            if (staffData.inviteStatus === "accepted") {
                throw new Error("This invite code has already been used. Please sign in instead.");
            }
            if (staffData.email && staffData.email.toLowerCase() !== email.trim().toLowerCase()) {
                throw new Error("Email doesn't match the invite. Please use the email your admin registered.");
            }
            const shopDocRef = staffDoc.ref.parent.parent;
            if (!shopDocRef) throw new Error("Shop not found");

            const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
            const uid = cred.user.uid;
            // Verify shop exists (keeps parity with legacy flow's getDoc).
            await getDoc(shopDocRef);

            await setDoc(doc(db, "users", uid), {
                email: email.trim().toLowerCase(),
                role: userRoleFor(staffData.memberType),
                shopId: shopDocRef.id,
                staffId: staffDoc.id,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                status: "active",
            });

            await updateDoc(staffDoc.ref, {
                authUid: uid,
                email: email.trim().toLowerCase(),
                inviteStatus: "accepted",
                lastLoginAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            navigate(routeForMember(staffData.memberType), { replace: true });
        } catch (err: any) {
            if (err?.code === "auth/email-already-in-use") {
                setError("This email is already registered. Try signing in instead.");
            } else if (err?.code === "auth/weak-password") {
                setError("Password should be at least 6 characters");
            } else if (err?.code === "auth/invalid-email") {
                setError("Please enter a valid email address");
            } else {
                setError(err?.message || "Sign up failed");
            }
            setLoading(false);
        }
    };

    return (
        <TeamAuthShell title="Activate your account" subtitle="Use the email & invite code your shop gave you">
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {error && <div style={tl.error}>{error}</div>}
                <div>
                    <label style={tl.label}>Email</label>
                    <div style={tl.box()}>
                        <Mail style={tl.icon} />
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={tl.bare} autoComplete="email" />
                    </div>
                </div>
                <div>
                    <label style={tl.label}>Invite code</label>
                    <div style={tl.box()}>
                        <KeyRound style={tl.icon} />
                        <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} placeholder="ABCD-12345" autoCapitalize="characters" style={{ ...tl.bare, letterSpacing: ".12em", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }} />
                    </div>
                </div>
                <div>
                    <label style={tl.label}>Create a password</label>
                    <div style={tl.box()}>
                        <Lock style={tl.icon} />
                        <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" style={tl.bare} autoComplete="new-password" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} style={{ border: 0, background: "transparent", padding: 4, cursor: "pointer", color: "#6B7280", display: "flex" }}>
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                </div>
                <button type="submit" disabled={loading} style={tl.primary(loading)}>
                    {loading ? <><Loader2 size={20} className="animate-spin" />Creating account...</> : "Create account"}
                </button>
                <p style={{ textAlign: "center", fontSize: 15, color: "#4B5563", margin: 0 }}>
                    Already activated? <Link to="/team/login" style={tl.link}>Sign in</Link>
                </p>
            </form>
        </TeamAuthShell>
    );
}
