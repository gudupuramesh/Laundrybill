/**
 * Settings — Enterprise Laundry CRM design system.
 *
 * Tabbed settings shell: a white nav rail + a DS header with a Save action,
 * and section cards. Wired to the real shop document (useShop / useShopMutations)
 * — sections map to data that actually exists (business profile, tax & currency,
 * bank details, operations, preferences). Demo-only DS sections that have no
 * backend (payout schedules, branches, 2FA, sessions) are intentionally omitted.
 */

import { useState, useEffect, useCallback, useRef, type CSSProperties, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    LPhoneInput,
    useLToast,
    LLanguageSelector,
    LLocationMap,
} from "@/components/laundry";
import { useAuth } from "@/features/auth/AuthContext";
import { useCurrency } from "@/hooks/use-currency";
import { useShop, useShopMutations } from "@/hooks/use-shop";
import { useIsMobile } from "@/hooks/use-mobile";
import { COUNTRIES, getCountry } from "@/config/countries";
import { reverseGeocode } from "@/lib/geocoding";
import { useTranslation } from "react-i18next";
import {
    Store,
    Receipt,
    Landmark,
    SlidersHorizontal,
    Palette,
    Building2,
    Phone,
    MapPin,
    FileText,
    Globe,
    CreditCard,
    Truck,
    Copy,
    HelpCircle,
    LogOut,
    ChevronRight,
    Check,
    Plus,
    Trash2,
    Route,
} from "lucide-react";
import {
    toTitleCase,
    isValidIndianPhone,
    normalizePhone,
    isValidEmail,
    normalizeEmail,
    isValidPAN,
    normalizePAN,
    isValidGST,
    normalizeGST,
    isValidIFSC,
    normalizeIFSC,
    isValidUPI,
    normalizeUPI,
    isValidAccountNumber,
    normalizeAccountNumber,
} from "@/lib/utils";

const MONO = "'IBM Plex Mono'";

type SettingsSection = "business" | "tax" | "bank" | "operations" | "preferences";

const TABS: { id: SettingsSection; label: string; icon: typeof Store; color: string; soft: string; desc: string }[] = [
    { id: "business", label: "Business profile", icon: Store, color: "var(--c-primary)", soft: "var(--c-primary-soft)", desc: "Your shop identity, contact and location." },
    { id: "tax", label: "Tax & currency", icon: Receipt, color: "var(--c-violet)", soft: "var(--c-violet-soft)", desc: "Country, currency, tax and registration." },
    { id: "bank", label: "Bank details", icon: Landmark, color: "var(--c-success)", soft: "var(--c-success-soft)", desc: "Settlement account for your payouts." },
    { id: "operations", label: "Operations", icon: SlidersHorizontal, color: "var(--c-cyan)", soft: "var(--c-cyan-soft)", desc: "Delivery fee and order rules." },
    { id: "preferences", label: "Preferences", icon: Palette, color: "var(--c-warning)", soft: "var(--c-warning-soft)", desc: "Language, theme and notifications." },
];

// Map legacy ?section= values onto the new tab ids
const LEGACY_SECTION: Record<string, SettingsSection> = {
    shopInfo: "business",
    financials: "tax",
    preferences: "preferences",
};

// Module-scope so it keeps a stable identity across renders — defining it inside
// the component remounts every wrapped input on each keystroke (focus loss).
const FIELD_LBL: CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--c-text-2)" };
function Field({ label, span, children }: { label: string; span?: string; children: ReactNode }) {
    return (
        <div style={span ? { gridColumn: span } : undefined}>
            <label style={FIELD_LBL}>{label}</label>
            {children}
        </div>
    );
}

export function SettingsPageMasterDetail() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isMobile = useIsMobile();

    const { addToast } = useLToast();
    const { currencySymbol } = useCurrency();
    const { user, role, shopName, signOut } = useAuth();
    const { shop, loading } = useShop();
    const { updateShop, updateLocation, updateBankDetails, updateGST, updateTaxSettings, updateDeliverySettings, updateCountrySettings } = useShopMutations();

    const isPhoneLocked = !!(shop?.phone || user?.phone);
    const isEmailLocked = !!(shop?.email || user?.email);

    const [selectedSection, setSelectedSection] = useState<SettingsSection>("business");

    // Form state
    const [formShopName, setFormShopName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [whatsappNumber, setWhatsappNumber] = useState("");
    const [address, setAddress] = useState("");
    const [city, setCity] = useState("");
    const [state, setState] = useState("");
    const [pincode, setPincode] = useState("");
    const [latitude, setLatitude] = useState<number | undefined>();
    const [longitude, setLongitude] = useState<number | undefined>();
    const [gettingLocation, setGettingLocation] = useState(false);
    const [gstNumber, setGstNumber] = useState("");
    const [panNumber, setPanNumber] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [ifscCode, setIfscCode] = useState("");
    const [bankName, setBankName] = useState("");
    const [accountHolderName, setAccountHolderName] = useState("");
    const [upiId, setUpiId] = useState("");
    // Tax
    const [taxEnabled, setTaxEnabled] = useState(false);
    const [taxName, setTaxName] = useState("GST");
    const [taxRate, setTaxRate] = useState(0);
    // Delivery fee
    const [deliveryFeeEnabled, setDeliveryFeeEnabled] = useState(true);
    const [deliveryFeeMinOrder, setDeliveryFeeMinOrder] = useState(300);
    const [deliveryFeeAmount, setDeliveryFeeAmount] = useState(50);
    // Distance-band delivery fee
    const [distanceFeeEnabled, setDistanceFeeEnabled] = useState(false);
    const [distanceBands, setDistanceBands] = useState<{ id: string; label: string; fee: number }[]>([]);

    const [notifications, setNotifications] = useState(true);
    const [saving, setSaving] = useState(false);
    const [initialized, setInitialized] = useState(false);

    // Country & Currency
    const [selectedCountryCode, setSelectedCountryCode] = useState(shop?.settings?.countryCode || "IN");
    const [savingCountry, setSavingCountry] = useState(false);

    // Sync section from URL (?section=...) or redirect legacy publicPage link
    useEffect(() => {
        const section = searchParams.get("section");
        if (section === "publicPage") {
            navigate("/settings/public-page", { replace: true });
            return;
        }
        if (section) {
            const mapped = LEGACY_SECTION[section] || (TABS.some((tb) => tb.id === section) ? (section as SettingsSection) : null);
            if (mapped) setSelectedSection(mapped);
        }
    }, [searchParams, navigate]);

    // Load shop data once
    useEffect(() => {
        if (shop && !initialized) {
            setFormShopName(shop.name || "");
            const rawPhone = shop.phone || user?.phone || "";
            setPhone(rawPhone.replace(/^\+?91/, "").replace(/\D/g, "").slice(-10));
            setEmail(shop.email || user?.email || "");
            const rawPhoneForWhatsApp = shop.phone || user?.phone || "";
            setWhatsappNumber(shop.whatsappNumber || rawPhoneForWhatsApp.replace(/^\+?91/, "").replace(/\D/g, "").slice(-10) || "");
            if (shop.location) {
                setAddress(shop.location.address || "");
                setCity(shop.location.city || "");
                setState(shop.location.state || "");
                setPincode(shop.location.pincode || "");
                setLatitude(shop.location.latitude);
                setLongitude(shop.location.longitude);
            }
            setGstNumber(shop.gstNumber || "");
            setPanNumber(shop.panNumber || "");
            if (shop.bankDetails) {
                setAccountNumber(shop.bankDetails.accountNumber || "");
                setIfscCode(shop.bankDetails.ifscCode || "");
                setBankName(shop.bankDetails.bankName || "");
                setAccountHolderName(shop.bankDetails.accountHolderName || "");
                setUpiId(shop.bankDetails.upiId || "");
            }
            if (shop.settings?.tax) {
                setTaxEnabled(shop.settings.tax.enabled);
                setTaxName(shop.settings.tax.name);
                setTaxRate(shop.settings.tax.rate);
            }
            if (shop.settings?.delivery) {
                const d = shop.settings.delivery;
                setDeliveryFeeEnabled(d.deliveryFeeEnabled ?? true);
                setDeliveryFeeMinOrder(d.deliveryFeeMinOrder ?? 300);
                setDeliveryFeeAmount(d.deliveryFeeAmount ?? d.defaultCharge ?? 50);
                setDistanceFeeEnabled(d.distanceFeeEnabled ?? false);
                setDistanceBands(Array.isArray(d.distanceBands) ? d.distanceBands : []);
            }
            setSelectedCountryCode(shop.settings?.countryCode || "IN");
            setInitialized(true);
        }
    }, [shop, initialized, user]);

    const handleSaveCountry = async () => {
        setSavingCountry(true);
        try {
            const country = getCountry(selectedCountryCode);
            await updateCountrySettings({
                countryCode: country.code,
                currency: country.currencyCode,
                currencySymbol: country.currencySymbol,
                phoneCountryCode: country.phoneCode,
                locale: country.locale,
                timezone: country.timezone,
                taxName: country.taxName,
            });
            addToast({ type: "success", title: t("common.saved", "Saved"), description: t("settings.countrySaved", "Country & currency updated") });
        } catch (err) {
            console.error("Failed to save country:", err);
            addToast({ type: "error", title: t("common.error", "Error"), description: t("settings.countryFailed", "Failed to update country settings") });
        } finally {
            setSavingCountry(false);
        }
    };

    const getCurrentLocation = async () => {
        if (!navigator.geolocation) {
            addToast({ type: "error", title: t("shop.locationNotSupported") });
            return;
        }
        setGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                setLatitude(lat);
                setLongitude(lng);
                try {
                    const result = await reverseGeocode(lat, lng);
                    if (result) {
                        if (result.address) setAddress(result.address);
                        if (result.city) setCity(result.city);
                        if (result.state) setState(result.state);
                        if (result.pincode) setPincode(result.pincode);
                        addToast({ type: "success", title: t("shop.locationCaptured"), description: t("shop.addressAutoFilled") });
                    } else {
                        addToast({ type: "success", title: t("shop.locationCaptured"), description: t("shop.enterAddressManually") });
                    }
                } catch {
                    addToast({ type: "success", title: t("shop.locationCaptured"), description: t("shop.enterAddressManually") });
                }
                setGettingLocation(false);
            },
            (error) => {
                setGettingLocation(false);
                addToast({ type: "error", title: t("shop.locationError"), description: error.message });
            },
            { enableHighAccuracy: true }
        );
    };

    const handleSaveShopInfo = async () => {
        if (phone && !isValidIndianPhone(phone)) {
            addToast({ type: "error", title: t("validation.invalidPhone"), description: t("validation.phoneDesc", "Phone must be 10 digits starting with 6-9") });
            return;
        }
        if (whatsappNumber && !isValidIndianPhone(whatsappNumber)) {
            addToast({ type: "error", title: t("validation.invalidPhone"), description: t("validation.phoneDesc", "WhatsApp number must be 10 digits starting with 6-9") });
            return;
        }
        if (email && !isValidEmail(email)) {
            addToast({ type: "error", title: t("validation.invalidEmail"), description: t("validation.emailDesc", "Please enter a valid email address") });
            return;
        }
        setSaving(true);
        try {
            await updateShop({
                name: toTitleCase(formShopName),
                ...(isPhoneLocked ? {} : { phone: phone ? normalizePhone(phone) : "" }),
                ...(isEmailLocked ? {} : { email: email ? normalizeEmail(email) : "" }),
                whatsappNumber: whatsappNumber ? normalizePhone(whatsappNumber) : "",
            });
            await updateLocation({
                address: toTitleCase(address),
                city: toTitleCase(city),
                state: toTitleCase(state),
                pincode,
                latitude,
                longitude,
            });
            addToast({ type: "success", title: t("shop.settingsSaved") });
        } catch {
            addToast({ type: "error", title: t("shop.saveError") });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveFinancials = async () => {
        const isIndiaTax = selectedCountryCode === "IN";
        // GST/PAN are India-specific formats — only enforce them for India.
        if (isIndiaTax) {
            if (panNumber && !isValidPAN(panNumber)) {
                addToast({ type: "error", title: t("validation.invalidPAN"), description: t("validation.panDesc", "PAN must be 10 characters (e.g., ABCDE1234F)") });
                return;
            }
            if (gstNumber && !isValidGST(gstNumber)) {
                addToast({ type: "error", title: t("validation.invalidGST"), description: t("validation.gstDesc", "GST must be 15 characters (e.g., 29ABCDE1234F1Z5)") });
                return;
            }
        }
        if (ifscCode && !isValidIFSC(ifscCode)) {
            addToast({ type: "error", title: t("validation.invalidIFSC"), description: t("validation.ifscDesc", "IFSC must be 11 characters (e.g., SBIN0001234)") });
            return;
        }
        if (upiId && !isValidUPI(upiId)) {
            addToast({ type: "error", title: t("validation.invalidUPI"), description: t("validation.upiDesc", "UPI ID must contain @ (e.g., name@upi)") });
            return;
        }
        if (accountNumber && !isValidAccountNumber(accountNumber)) {
            addToast({ type: "error", title: t("validation.invalidAccount"), description: t("validation.accountDesc", "Account number must be 8-18 digits") });
            return;
        }
        setSaving(true);
        try {
            await updateGST(
                isIndiaTax ? (gstNumber ? normalizeGST(gstNumber) : "") : (gstNumber.trim().toUpperCase() || ""),
                isIndiaTax ? (panNumber ? normalizePAN(panNumber) : "") : "",
            );
            await updateBankDetails({
                accountNumber: accountNumber ? normalizeAccountNumber(accountNumber) : "",
                ifscCode: ifscCode ? normalizeIFSC(ifscCode) : "",
                bankName: toTitleCase(bankName),
                accountHolderName: toTitleCase(accountHolderName),
                upiId: upiId ? normalizeUPI(upiId) : "",
            });
            await updateTaxSettings(taxEnabled, taxName, taxRate);
            await updateDeliverySettings({
                deliveryFeeEnabled,
                deliveryFeeMinOrder,
                deliveryFeeAmount,
                defaultCharge: deliveryFeeAmount,
                distanceFeeEnabled,
                distanceBands: distanceBands
                    .filter((b) => b.label.trim())
                    .map((b) => ({ id: b.id, label: b.label.trim(), fee: Number(b.fee) || 0 })),
            });
            addToast({ type: "success", title: t("shop.settingsSaved") });
        } catch {
            addToast({ type: "error", title: t("shop.saveError") });
        } finally {
            setSaving(false);
        }
    };

    const reverseGeocodeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleMapLocationChange = useCallback(async (lat: number, lng: number) => {
        setLatitude(lat);
        setLongitude(lng);
        if (reverseGeocodeRef.current) clearTimeout(reverseGeocodeRef.current);
        reverseGeocodeRef.current = setTimeout(async () => {
            try {
                const result = await reverseGeocode(lat, lng);
                if (result) {
                    if (result.address) setAddress(result.address);
                    if (result.city) setCity(result.city);
                    if (result.state) setState(result.state);
                    if (result.pincode) setPincode(result.pincode);
                }
                reverseGeocodeRef.current = null;
            } catch {
                reverseGeocodeRef.current = null;
            }
        }, 400);
    }, []);

    const copyLocationLink = async () => {
        if (!latitude || !longitude) return;
        await navigator.clipboard.writeText(`https://maps.google.com/?q=${latitude},${longitude}`);
        addToast({ type: "success", title: t("shop.locationCopied") });
    };

    const countryChanged = selectedCountryCode !== (shop?.settings?.countryCode || "IN");

    // Header "Save changes" dispatches by section
    const handleSave = () => {
        if (selectedSection === "business") return handleSaveShopInfo();
        if (selectedSection === "preferences") {
            if (countryChanged) return handleSaveCountry();
            addToast({ type: "success", title: t("shop.settingsSaved", "Saved") });
            return;
        }
        return handleSaveFinancials(); // tax, bank, operations share the financials write
    };

    // ---- shared styles ----
    const fld: CSSProperties = {
        width: "100%",
        font: "inherit",
        fontSize: 14,
        color: "var(--c-text)",
        background: "var(--c-surface)",
        border: "1px solid var(--c-border-strong)",
        borderRadius: 9,
        padding: "10px 12px",
        outline: "none",
    };
    const fldMono: CSSProperties = { ...fld, fontFamily: MONO };
    const lbl: CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--c-text-2)" };
    const card: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14, padding: 22, boxShadow: "var(--sh-sm)" };
    const cardTitle: CSSProperties = { fontSize: 14, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 9 };
    const grid2: CSSProperties = { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 };

    const cur = TABS.find((tb) => tb.id === selectedSection) || TABS[0];
    // Phone prefix follows the selected country (e.g. UAE → +971).
    const phoneCountry = getCountry(selectedCountryCode);

    return (
        <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", background: "var(--c-bg)" }}>
            {/* header */}
            <header
                style={{
                    flex: "none",
                    minHeight: 58,
                    background: "var(--c-surface)",
                    borderBottom: "1px solid var(--c-border)",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "0 22px",
                }}
            >
                <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.01em" }}>Settings</div>
                <div style={{ flex: 1 }} />
                <button
                    onClick={handleSave}
                    disabled={saving || savingCountry || loading}
                    style={{
                        cursor: saving || savingCountry ? "wait" : "pointer",
                        font: "inherit",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#fff",
                        background: "var(--c-primary)",
                        border: 0,
                        borderRadius: 8,
                        padding: "8px 18px",
                        boxShadow: "var(--sh-sm)",
                        opacity: saving || savingCountry || loading ? 0.6 : 1,
                    }}
                >
                    {saving || savingCountry ? "Saving…" : "Save changes"}
                </button>
            </header>

            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: isMobile ? "column" : "row", overflow: "hidden" }}>
                {/* settings nav rail */}
                <nav
                    className="lb-thin"
                    style={{
                        width: isMobile ? "100%" : 236,
                        flex: "none",
                        background: "var(--c-surface)",
                        borderRight: isMobile ? "none" : "1px solid var(--c-border)",
                        borderBottom: isMobile ? "1px solid var(--c-border)" : "none",
                        padding: isMobile ? "10px 12px" : "14px 12px",
                        display: "flex",
                        flexDirection: isMobile ? "row" : "column",
                        alignItems: isMobile ? "center" : "stretch",
                        gap: 3,
                        overflowX: isMobile ? "auto" : "hidden",
                        overflowY: isMobile ? "hidden" : "auto",
                    }}
                >
                    {/* profile chip */}
                    <div style={{ display: isMobile ? "none" : "flex", alignItems: "center", gap: 10, padding: "8px 10px 14px", marginBottom: 4, borderBottom: "1px solid var(--c-border)" }}>
                        <span style={{ width: 38, height: 38, flex: "none", borderRadius: "50%", overflow: "hidden", background: "var(--c-primary-soft)", color: "var(--c-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600 }}>
                            {user?.photoURL ? <img src={user.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (shopName || user?.displayName || "S").slice(0, 1).toUpperCase()}
                        </span>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shopName || user?.displayName}</div>
                            <div style={{ fontSize: 11, color: "var(--c-text-3)", textTransform: "capitalize" }}>{role}</div>
                        </div>
                    </div>

                    {TABS.map((tb) => {
                        const on = tb.id === selectedSection;
                        const Icon = tb.icon;
                        return (
                            <button
                                key={tb.id}
                                onClick={() => setSelectedSection(tb.id)}
                                aria-current={on ? "true" : "false"}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 11,
                                    padding: "10px 12px",
                                    borderRadius: 9,
                                    border: 0,
                                    cursor: "pointer",
                                    textAlign: "left",
                                    font: "inherit",
                                    fontSize: 13.5,
                                    fontWeight: on ? 600 : 500,
                                    color: on ? "var(--c-primary)" : "var(--c-text-2)",
                                    background: on ? "var(--c-primary-soft)" : "transparent",
                                    flex: isMobile ? "none" : undefined,
                                    whiteSpace: isMobile ? "nowrap" : undefined,
                                }}
                            >
                                <Icon size={17} style={{ color: on ? "var(--c-primary)" : "var(--c-text-3)" }} />
                                {tb.label}
                            </button>
                        );
                    })}

                    <div style={{ height: 1, background: "var(--c-border)", margin: "10px 4px", display: isMobile ? "none" : "block" }} />

                    {/* secondary links — hidden in the mobile horizontal strip; reachable from elsewhere */}
                    {!isMobile && (
                        <>
                            <NavLinkRow icon={<CreditCard size={17} />} label="Subscription & billing" onClick={() => navigate("/settings/subscription")} />
                            <NavLinkRow icon={<Receipt size={17} />} label="Payment history" onClick={() => navigate("/settings/payment-history")} />
                            <NavLinkRow icon={<HelpCircle size={17} />} label="Help & support" onClick={() => navigate("/help")} />
                        </>
                    )}
                    <button
                        onClick={signOut}
                        style={{
                            display: isMobile ? "none" : "flex",
                            alignItems: "center",
                            gap: 11,
                            padding: "10px 12px",
                            borderRadius: 9,
                            border: 0,
                            cursor: "pointer",
                            textAlign: "left",
                            font: "inherit",
                            fontSize: 13.5,
                            fontWeight: 500,
                            color: "var(--c-error)",
                            background: "transparent",
                            marginTop: 2,
                        }}
                    >
                        <LogOut size={17} />
                        {t("auth.signOut", "Sign out")}
                    </button>
                </nav>

                {/* content */}
                <div
                    className="lb-scroll"
                    style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: "auto",
                        padding: isMobile ? 16 : 24,
                        paddingBottom: isMobile ? "calc(88px + env(safe-area-inset-bottom, 0px))" : 24,
                    }}
                >
                    {loading ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                            <div style={{ width: 32, height: 32, border: "3px solid var(--c-border)", borderTopColor: "var(--c-primary)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                        </div>
                    ) : (
                        <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 16 }}>
                            <div style={{ marginBottom: 2 }}>
                                <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.01em" }}>{cur.label}</div>
                                <div style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 3 }}>{cur.desc}</div>
                            </div>

                            {/* ===== BUSINESS PROFILE ===== */}
                            {selectedSection === "business" && (
                                <>
                                    <div style={card}>
                                        <div style={{ display: "flex", gap: 18, alignItems: "center", marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid var(--c-border)" }}>
                                            <span style={{ width: 64, height: 64, flex: "none", borderRadius: 16, overflow: "hidden", background: "var(--c-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                {shop?.logo ? <img src={shop.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Store size={30} />}
                                            </span>
                                            <Field label={t("shop.shopName", "Business name")}>
                                                <input style={fld} value={formShopName} onChange={(e) => setFormShopName(e.target.value)} />
                                            </Field>
                                        </div>

                                        <div style={cardTitle}><Phone size={16} style={{ color: "var(--c-primary)" }} />{t("shop.contactInfo", "Contact")}</div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                            <div>
                                                <label style={lbl}>{t("shop.phoneNumber", "Phone")}</label>
                                                <LPhoneInput value={phone} onValueChange={setPhone} showClear={!isPhoneLocked} disabled={isPhoneLocked} countryCode={phoneCountry.phoneCode} maxDigits={phoneCountry.phoneDigits} />
                                                {isPhoneLocked && <p style={{ fontSize: 10.5, color: "var(--c-text-3)", marginTop: 4 }}>{t("shop.phoneImmutable", "Registered phone cannot be changed")}</p>}
                                            </div>
                                            <div>
                                                <label style={lbl}>{t("shop.whatsappNumber", "WhatsApp number")}</label>
                                                <LPhoneInput value={whatsappNumber} onValueChange={setWhatsappNumber} showClear countryCode={phoneCountry.phoneCode} maxDigits={phoneCountry.phoneDigits} />
                                                <p style={{ fontSize: 10.5, color: "var(--c-text-3)", marginTop: 4 }}>{t("shop.whatsappNumberHint", "Defaults to your registered phone. You can update it anytime.")}</p>
                                            </div>
                                            <Field label={t("shop.email", "Email")}>
                                                <input style={{ ...fld, ...(isEmailLocked ? { background: "var(--c-surface-2)", opacity: 0.8 } : {}) }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isEmailLocked} />
                                                {isEmailLocked && <p style={{ fontSize: 10.5, color: "var(--c-text-3)", marginTop: 4 }}>{t("shop.emailImmutable", "Registered email cannot be changed")}</p>}
                                            </Field>
                                        </div>
                                    </div>

                                    <div style={card}>
                                        <div style={cardTitle}><MapPin size={16} style={{ color: "var(--c-primary)" }} />{t("shop.location", "Location")}</div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                            <LLocationMap latitude={latitude} longitude={longitude} onLocationChange={handleMapLocationChange} onGetLocation={getCurrentLocation} gettingLocation={gettingLocation} />
                                            <Field label={t("shop.address", "Address")}>
                                                <input style={fld} value={address} onChange={(e) => setAddress(e.target.value)} />
                                            </Field>
                                            <div style={grid2}>
                                                <Field label={t("shop.city", "City")}><input style={fld} value={city} onChange={(e) => setCity(e.target.value)} /></Field>
                                                <Field label={t("shop.state", "State")}><input style={fld} value={state} onChange={(e) => setState(e.target.value)} /></Field>
                                            </div>
                                            <Field label={t("shop.pincode", "Pincode")}>
                                                <input style={fldMono} value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} />
                                            </Field>
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 13px", background: "var(--c-surface-2)", borderRadius: 10 }}>
                                                <div>
                                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{t("shop.gpsLocation", "GPS location")}</div>
                                                    <div style={{ fontSize: 11.5, color: "var(--c-text-3)", fontFamily: latitude && longitude ? MONO : undefined }}>
                                                        {latitude && longitude ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` : t("shop.noLocationCaptured", "No location captured")}
                                                    </div>
                                                </div>
                                                {latitude && longitude && (
                                                    <button onClick={copyLocationLink} style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 8, padding: "7px 12px" }}>
                                                        <Copy size={14} />{t("common.copy", "Copy")}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* ===== TAX & CURRENCY ===== */}
                            {selectedSection === "tax" && (
                                <>
                                    <div style={card}>
                                        <div style={cardTitle}><Globe size={16} style={{ color: "var(--c-violet)" }} />{t("settings.countryCurrency", "Country & currency")}</div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                            <Field label={t("shop.country", "Country")}>
                                                <select style={fld} value={selectedCountryCode} onChange={(e) => setSelectedCountryCode(e.target.value)}>
                                                    {COUNTRIES.map((c) => (
                                                        <option key={c.code} value={c.code}>{c.name} ({c.currencySymbol} {c.currencyCode})</option>
                                                    ))}
                                                </select>
                                            </Field>
                                            {(() => {
                                                const preview = getCountry(selectedCountryCode);
                                                const row = (k: string, v: string) => (
                                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                                                        <span style={{ color: "var(--c-text-3)" }}>{k}</span>
                                                        <span style={{ fontWeight: 600 }}>{v}</span>
                                                    </div>
                                                );
                                                return (
                                                    <div style={{ background: "var(--c-surface-2)", borderRadius: 10, padding: 13, display: "flex", flexDirection: "column", gap: 6 }}>
                                                        {row(t("settings.currency", "Currency"), `${preview.currencySymbol} ${preview.currencyCode}`)}
                                                        {row(t("settings.phoneCode", "Phone code"), preview.phoneCode)}
                                                        {row(t("settings.timezone", "Timezone"), preview.timezone)}
                                                        {row(t("settings.taxLabel", "Default tax"), preview.taxName)}
                                                    </div>
                                                );
                                            })()}
                                            {countryChanged && (
                                                <button onClick={handleSaveCountry} disabled={savingCountry} style={{ alignSelf: "flex-start", cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 9, padding: "10px 16px", boxShadow: "var(--sh-sm)", opacity: savingCountry ? 0.6 : 1 }}>
                                                    {savingCountry ? "Saving…" : t("settings.updateCountry", "Update country & currency")}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div style={card}>
                                        <ToggleRow label={t("shop.taxSettings", "Tax")} desc={t("settings.taxToggleDesc", "Apply tax to invoices")} on={taxEnabled} onChange={setTaxEnabled} />
                                        {taxEnabled && (
                                            <div style={{ ...grid2, marginTop: 16 }}>
                                                <Field label={t("shop.taxName", "Tax name")}><input style={fld} value={taxName} onChange={(e) => setTaxName(e.target.value)} placeholder="GST" /></Field>
                                                <Field label={t("shop.taxRate", "Tax rate (%)")}><input style={fldMono} value={taxRate.toString()} onChange={(e) => setTaxRate(Number(e.target.value) || 0)} inputMode="numeric" placeholder="18" /></Field>
                                            </div>
                                        )}
                                    </div>

                                    <div style={card}>
                                        <div style={cardTitle}><FileText size={16} style={{ color: "var(--c-violet)" }} />{t("shop.businessDetails", "Tax registration")}</div>
                                        {phoneCountry.code === "IN" ? (
                                            <div style={grid2}>
                                                <Field label={t("shop.gstNumber", "GST number")}><input style={fldMono} value={gstNumber} onChange={(e) => setGstNumber(e.target.value.toUpperCase())} maxLength={15} placeholder="22AAAAA0000A1Z5" /></Field>
                                                <Field label={t("shop.panNumber", "PAN number")}><input style={fldMono} value={panNumber} onChange={(e) => setPanNumber(e.target.value.toUpperCase())} maxLength={10} placeholder="AAAAA0000A" /></Field>
                                            </div>
                                        ) : (
                                            <Field label={`${phoneCountry.taxName} ${t("shop.registrationNo", "registration no.")}`}>
                                                <input style={fldMono} value={gstNumber} onChange={(e) => setGstNumber(e.target.value.toUpperCase())} maxLength={30} placeholder={t("shop.trnPlaceholder", "Tax registration number")} />
                                            </Field>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* ===== BANK DETAILS ===== */}
                            {selectedSection === "bank" && (
                                <div style={card}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 18 }}>
                                        <span style={{ width: 40, height: 40, flex: "none", borderRadius: 10, background: "var(--c-success-soft)", color: "var(--c-success)", display: "flex", alignItems: "center", justifyContent: "center" }}><Building2 size={20} /></span>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 600 }}>{t("shop.bankDetails", "Payout bank account")}</div>
                                            <div style={{ fontSize: 12, color: "var(--c-text-3)" }}>{t("settings.bankDesc", "Where your settlements are deposited")}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                        <Field label={t("shop.accountHolderName", "Account holder name")}><input style={fld} value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} /></Field>
                                        <Field label={t("shop.accountNumber", "Account number")}><input style={fldMono} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))} /></Field>
                                        <div style={grid2}>
                                            <Field label={t("shop.ifscCode", "IFSC code")}><input style={fldMono} value={ifscCode} onChange={(e) => setIfscCode(e.target.value.toUpperCase())} maxLength={11} /></Field>
                                            <Field label={t("shop.bankName", "Bank name")}><input style={fld} value={bankName} onChange={(e) => setBankName(e.target.value)} /></Field>
                                        </div>
                                        <Field label={t("shop.upiId", "UPI ID")}><input style={fldMono} value={upiId} onChange={(e) => setUpiId(e.target.value.toLowerCase())} placeholder="shop@upi" /></Field>
                                    </div>
                                </div>
                            )}

                            {/* ===== OPERATIONS ===== */}
                            {selectedSection === "operations" && (
                                <>
                                <div style={card}>
                                    <ToggleRow
                                        label={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Truck size={16} style={{ color: "var(--c-cyan)" }} />{t("settings.deliveryFee", "Delivery fee")}</span>}
                                        desc={t("settings.deliveryFeeHelp", "Applies to Home Delivery and Pickup & Delivery when an order is below the minimum. Not applied to Shop Pickup.")}
                                        on={deliveryFeeEnabled}
                                        onChange={setDeliveryFeeEnabled}
                                    />
                                    {deliveryFeeEnabled && (
                                        <div style={{ ...grid2, marginTop: 16 }}>
                                            <Field label={`${t("settings.deliveryFeeMinOrder", "Min order for free delivery")} (${currencySymbol})`}>
                                                <input style={fldMono} value={deliveryFeeMinOrder.toString()} onChange={(e) => setDeliveryFeeMinOrder(Number(e.target.value) || 0)} inputMode="numeric" placeholder="300" />
                                            </Field>
                                            <Field label={`${t("settings.deliveryFeeAmount", "Delivery fee below min")} (${currencySymbol})`}>
                                                <input style={fldMono} value={deliveryFeeAmount.toString()} onChange={(e) => setDeliveryFeeAmount(Number(e.target.value) || 0)} inputMode="numeric" placeholder="50" />
                                            </Field>
                                        </div>
                                    )}
                                </div>

                                {/* distance-band delivery fee */}
                                <div style={card}>
                                    <ToggleRow
                                        label={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Route size={16} style={{ color: "var(--c-cyan)" }} />{t("settings.distanceFee", "Charge by distance")}</span>}
                                        desc={t("settings.distanceFeeHelp", "Staff pick a km band at checkout for Home Delivery / Pickup-from-home, and that band's fee applies. Overrides the flat fee above. Shop pickup stays free.")}
                                        on={distanceFeeEnabled}
                                        onChange={(v) => {
                                            setDistanceFeeEnabled(v);
                                            if (v && distanceBands.length === 0) {
                                                setDistanceBands([
                                                    { id: "b0", label: "0–5 km", fee: 0 },
                                                    { id: "b1", label: "5–10 km", fee: 0 },
                                                    { id: "b2", label: "10–15 km", fee: 0 },
                                                    { id: "b3", label: "15–20 km", fee: 0 },
                                                ]);
                                            }
                                        }}
                                    />
                                    {distanceFeeEnabled && (
                                        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                                            {distanceBands.map((b, i) => (
                                                <div key={b.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                                    <input style={{ ...fld, flex: 1 }} value={b.label} placeholder="0–5 km" onChange={(e) => { const next = [...distanceBands]; next[i] = { ...next[i], label: e.target.value }; setDistanceBands(next); }} />
                                                    <div style={{ position: "relative", width: 130, flex: "none" }}>
                                                        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--c-text-3)" }}>{currencySymbol}</span>
                                                        <input style={{ ...fldMono, paddingLeft: 26 }} value={b.fee.toString()} inputMode="numeric" onChange={(e) => { const next = [...distanceBands]; next[i] = { ...next[i], fee: Number(e.target.value) || 0 }; setDistanceBands(next); }} />
                                                    </div>
                                                    <button type="button" aria-label="Remove band" onClick={() => setDistanceBands(distanceBands.filter((_, j) => j !== i))} style={{ width: 38, height: 38, flex: "none", border: "1px solid var(--c-border)", borderRadius: 8, background: "transparent", color: "var(--c-text-3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={15} /></button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => setDistanceBands([...distanceBands, { id: `b-${distanceBands.length}-${Date.now() % 100000}`, label: "", fee: 0 }])} style={{ alignSelf: "flex-start", cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-primary-soft)", border: 0, borderRadius: 8, padding: "7px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}><Plus size={13} />{t("settings.addBand", "Add band")}</button>
                                        </div>
                                    )}
                                </div>
                                </>
                            )}

                            {/* ===== PREFERENCES ===== */}
                            {selectedSection === "preferences" && (
                                <>
                                    <div style={card}>
                                        <div style={cardTitle}><Globe size={16} style={{ color: "var(--c-warning)" }} />{t("settings.language", "Language")}</div>
                                        <LLanguageSelector variant="list" />
                                    </div>
                                    <div style={card}>
                                        <ToggleRow label={t("settings.notifications", "Notifications")} desc={t("settings.notificationsDesc", "Receive order and system alerts")} on={notifications} onChange={setNotifications} />
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function NavLinkRow({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "10px 12px",
                borderRadius: 9,
                border: 0,
                cursor: "pointer",
                textAlign: "left",
                font: "inherit",
                fontSize: 13.5,
                fontWeight: 500,
                color: "var(--c-text-2)",
                background: "transparent",
            }}
        >
            <span style={{ color: "var(--c-text-3)", display: "inline-flex" }}>{icon}</span>
            <span style={{ flex: 1 }}>{label}</span>
            <ChevronRight size={15} style={{ color: "var(--c-text-3)" }} />
        </button>
    );
}

function ToggleRow({ label, desc, on, onChange }: { label: ReactNode; desc?: string; on: boolean; onChange: (v: boolean) => void }) {
    return (
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, cursor: "pointer" }}>
            <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</div>
                {desc && <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginTop: 2, maxWidth: 460 }}>{desc}</div>}
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => onChange(!on)}
                style={{
                    position: "relative",
                    flex: "none",
                    cursor: "pointer",
                    width: 44,
                    height: 25,
                    border: 0,
                    borderRadius: 20,
                    background: on ? "var(--c-primary)" : "var(--c-border-strong)",
                    transition: "background .15s",
                }}
            >
                <span style={{ position: "absolute", top: 3, left: 3, width: 19, height: 19, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.3)", transition: "transform .15s", transform: on ? "translateX(19px)" : "translateX(0)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {on && <Check size={11} style={{ color: "var(--c-primary)" }} />}
                </span>
            </button>
        </label>
    );
}
