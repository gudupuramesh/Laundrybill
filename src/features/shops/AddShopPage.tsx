/**
 * Add shop — a franchise owner creates an additional shop under the same
 * account. The new shop gets a GENERATED doc id (never the uid — that's the
 * primary shop) with ownerId = uid; the Cloud Function stamps its plan from
 * the owner's Franchise subscription (no trial) and the default catalog is
 * seeded exactly like signup.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, collection, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import { useShop } from "@/hooks/use-shop";
import { useShopLimits } from "@/hooks/use-shop-limits";
import { buildNewShopData, seedBranchCatalog } from "@/lib/new-shop";
import { LButton, LTextInput, useLToast } from "@/components/laundry";
import { ArrowLeft, Store } from "lucide-react";

export function AddShopPage() {
    const { user, ownedShops, refreshOwnedShops, switchShop, primaryShopId } = useAuth();
    const { shop: primaryShop } = useShop();
    const { checkLimit, plan: currentPlan } = useShopLimits();
    const { addToast } = useLToast();
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [city, setCity] = useState("");
    const [saving, setSaving] = useState(false);

    const shopCheck = checkLimit("maxShops", Math.max(1, ownedShops.length));
    const canAdd = shopCheck.allowed;

    const handleCreate = async () => {
        const uid = user?.uid;
        if (!uid || saving) return;
        if (!name.trim()) {
            addToast({ type: "error", title: "Shop name required", description: "Give the new shop a name." });
            return;
        }
        setSaving(true);
        try {
            // Inherit country/currency/tax defaults from the primary shop so the
            // whole franchise bills and formats consistently.
            const s = (primaryShop?.settings ?? {}) as Record<string, unknown>;
            const ref = doc(collection(db, "shops")); // generated id ≠ uid
            await setDoc(
                ref,
                buildNewShopData(name.trim(), uid, {
                    phone: phone.trim() || null,
                    email: email.trim().toLowerCase() || null,
                    location: city.trim() || null,
                    currency: s.currency as string | undefined,
                    currencySymbol: s.currencySymbol as string | undefined,
                    countryCode: s.countryCode as string | undefined,
                    phoneCountryCode: s.phoneCountryCode as string | undefined,
                    locale: s.locale as string | undefined,
                    timezone: s.timezone as string | undefined,
                    taxName: (s.tax as { name?: string } | undefined)?.name,
                }),
            );
            // Branches inherit the main shop's services + prices (falls back to
            // the default catalog when the main shop has none yet).
            await seedBranchCatalog(ref.id, primaryShopId || uid);
            await refreshOwnedShops();
            switchShop(ref.id);
            addToast({ type: "success", title: "Shop created", description: `${name.trim()} is ready — you're now viewing it.` });
            navigate("/dashboard");
        } catch (e) {
            console.error("Add shop failed:", e);
            addToast({ type: "error", title: "Could not create the shop", description: (e as Error)?.message || "Please try again." });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-lg px-4 py-6">
            <button
                type="button"
                onClick={() => navigate(-1)}
                className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="h-4 w-4" /> Back
            </button>

            <div className="mb-6 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Store className="h-5 w-5" />
                </span>
                <div>
                    <h1 className="text-xl font-bold text-foreground">Add a shop</h1>
                    <p className="text-sm text-muted-foreground">
                        A new branch under your account — covered by your {currentPlan?.name || "current"} plan.
                    </p>
                </div>
            </div>

            {!canAdd ? (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <p className="text-sm font-semibold text-foreground">
                        Your plan covers {shopCheck.limit} shop{shopCheck.limit === 1 ? "" : "s"}.
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Upgrade to the <span className="font-semibold text-foreground">Franchise</span> plan to run up to 4
                        shops with one subscription — every shop gets full Business features.
                    </p>
                    <LButton className="mt-4" fullWidth onClick={() => navigate("/settings/subscription")}>
                        View Franchise plan
                    </LButton>
                </div>
            ) : (
                <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <LTextInput label="Shop name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Laundrybill Indiranagar" required />
                    <LTextInput label="Shop phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Customer-facing number" />
                    <LTextInput label="Shop email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="branch@example.com" />
                    <LTextInput label="City / area (optional)" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Indiranagar, Bengaluru" />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        The new shop starts with your main shop&apos;s service menu and prices — adjust them any time in
                        its own Services page. Staff logins, orders, and customers stay separate per shop.
                    </p>
                    <LButton fullWidth loading={saving} onClick={handleCreate}>
                        Create shop
                    </LButton>
                </div>
            )}
        </div>
    );
}

export default AddShopPage;
