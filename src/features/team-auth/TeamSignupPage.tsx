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
import { LButton, LCard } from "@/components/laundry";
import { Mail, Lock, KeyRound, Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { getCurrentLanguage, changeLanguage } from "@/lib/i18n";

const INVITE_RE = /^[A-Z0-9]{4}-\d{5}$/;

function routeForMember(memberType?: string): string {
    if (memberType === "agent") return "/agent";
    if (memberType === "plant") return "/plant";
    return "/staff";
}

/** users.role written for each member type (kept consistent with the legacy contexts). */
function userRoleFor(memberType?: string): string {
    if (memberType === "agent") return "agent";
    if (memberType === "plant") return "plant_operator";
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
                    role: userRoleFor(tmData.memberType),
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

                navigate(routeForMember(tmData.memberType), { replace: true });
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
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="flex flex-col items-center justify-center mb-8">
                    <img
                        src="/icons/team-login-logo.png"
                        alt="LaundryBill Team"
                        className="w-24 h-24 rounded-3xl shadow-lg mb-3"
                    />
                    <p className="text-gray-500 text-sm font-medium">Activate your team account</p>
                </div>

                <LCard className="bg-white shadow-xl border-border/50 p-6 md:p-8 rounded-3xl">
                    <div className="text-center mb-6">
                        <h2 className="text-xl font-bold text-gray-900">Sign up with an invite</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Use the email &amp; invite code your admin gave you
                        </p>
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
                            <label className="text-sm font-medium text-gray-700 ml-1">Invite code</label>
                            <div className="relative">
                                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
                                <input
                                    type="text"
                                    value={inviteCode}
                                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                    placeholder="ABCD-12345"
                                    autoCapitalize="characters"
                                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-gray-900 placeholder:text-gray-400 tracking-widest focus:outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700 ml-1">Create a password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="At least 6 characters"
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
                                    Creating account...
                                </>
                            ) : (
                                "Create account"
                            )}
                        </LButton>

                        <p className="text-center text-sm text-gray-500 pt-2">
                            <Link to="/team/login" className="text-primary hover:text-primary-dark font-semibold hover:underline inline-flex items-center">
                                <ArrowLeft className="h-4 w-4 mr-1" />
                                Back to sign in
                            </Link>
                        </p>
                    </form>
                </LCard>

                <p className="text-center text-xs text-gray-400 mt-8">Protected by LaundryBill Security</p>
            </div>
        </div>
    );
}
