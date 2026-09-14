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
    LConfirmDialog,
} from "@/components/laundry";
import { collection, getDocs, limit, query, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import { useCurrency } from "@/hooks/use-currency";
import { useShop, useShopMutations } from "@/hooks/use-shop";
import { useIsMobile } from "@/hooks/use-mobile";
import { phoneLenOk, COUNTRIES, getCountry, splitInternationalPhone, getStateLabel } from "@/config/countries";
import { reverseGeocode } from "@/lib/geocoding";
import { useTranslation } from "react-i18next";
import {
    Store,
    Camera,
    Loader2,
    Receipt,
    Landmark,
    SlidersHorizontal,
    Palette,
    Building2,
    Phone,
    MapPin,
    FileText,
    Hash,
    Globe,
    CreditCard,
    Truck,
    Copy,
    HelpCircle,
    LogOut,
    ChevronRight,
    ChevronLeft,
    Check,
    Plus,
    Trash2,
    Route,
    MessageCircle,
    CircleDollarSign,
    ClipboardList,
    LayoutTemplate,
    Tag,
    Bell,
    LayoutGrid,
    UserRound,
    Crown,
    ChevronDown,
    Lock,
    Calculator,
    AlertCircle,
    Info,
    Laptop,
    Smartphone,
    ShieldCheck,
    MoreVertical,
} from "lucide-react";
import { MobileSettings } from "./MobileSettings";
import { useSupportSettings } from "@/hooks/use-support-settings";
import { auth } from "@/lib/firebase";
import { updateProfile } from "firebase/auth";
import { QRCodeSVG } from "qrcode.react";
import { useShopLimits } from "@/hooks/use-shop-limits";
import { ServiceAreasList, PickupSlotsList, DeliverySlotsList } from "./ServiceAreasSettings";
import { PublicPageSettingsPage } from "./pages/PublicPageSettingsPage";
import { OffersPage } from "./pages/OffersPage";
import { SubscriptionPage } from "./pages/SubscriptionPage";
import { AppsPage } from "@/features/apps/AppsPage";
import { HelpPage } from "@/features/help/HelpPage";
import { format } from "date-fns";
import { formatOrderId } from "@/lib/generateShopCode";
import { smartUploadToR2, deleteFromR2 } from "@/lib/storage";
import {
    toTitleCase,
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
    const { updateShop, updateLocation, updateBankDetails, updateGST, updateTaxSettings, updateDeliverySettings, updateCountrySettings, updateReceiptTerms, updateNextOrderNumber, updateWaShare } = useShopMutations();

    const isPhoneLocked = !!(shop?.phone || user?.phone);
    const isEmailLocked = !!(shop?.email || user?.email);

    const [selectedSection, setSelectedSection] = useState<SettingsSection>("business");

    // Form state
    const [formShopName, setFormShopName] = useState("");
    const [phone, setPhone] = useState("");
    // Dial code the registered phone was STORED with (e.g. "+91"). The locked field
    // must show the real number — never re-prefix it with the current country's code.
    const [registeredDialCode, setRegisteredDialCode] = useState("");
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
    const [paymentLink, setPaymentLink] = useState("");
    const [receiptPaymentQr, setReceiptPaymentQr] = useState(true);
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
    const [receiptTerms, setReceiptTerms] = useState("");
    const [receiptShowLogo, setReceiptShowLogo] = useState(true);

    // Shop logo upload (Business profile tile) — R2 upload + shop doc update.
    const logoInputRef = useRef<HTMLInputElement | null>(null);
    const [logoUploading, setLogoUploading] = useState(false);
    const handleLogoFile = async (file: File | null) => {
        if (!file || !shop || !user) return;
        if (!file.type.startsWith("image/")) {
            addToast({ type: "error", title: t("settings.logoNotImage", "Please choose an image file") });
            return;
        }
        setLogoUploading(true);
        try {
            const oldKey = shop.logoKey;
            const res = await smartUploadToR2(shop.id, user.uid, "shop-logos", file, { maxWidth: 512, quality: 0.9 });
            await updateShop({ logo: res.url, logoKey: res.key });
            if (oldKey && oldKey !== res.key) {
                try { await deleteFromR2(oldKey); } catch { /* replacing worked — old-file cleanup is best-effort */ }
            }
            addToast({ type: "success", title: t("settings.logoUpdated", "Logo updated"), description: t("settings.logoUpdatedDesc", "It now shows in the app and prints on receipts.") });
        } catch (e) {
            console.error("logo upload", e);
            addToast({ type: "error", title: t("settings.logoUploadFailed", "Could not upload the logo") });
        } finally {
            setLogoUploading(false);
        }
    };
    // Order-number counter — lets a shop continue numbering from previous software.
    const [nextOrderNum, setNextOrderNum] = useState<number>(1);
    // WhatsApp share message customization + shop-wide customer-tracking switch.
    const [waHeader, setWaHeader] = useState("");
    const [waFooter, setWaFooter] = useState("");
    const [waShowItems, setWaShowItems] = useState(true);
    const [waShowPayment, setWaShowPayment] = useState(true);
    const [waShowExpectedDate, setWaShowExpectedDate] = useState(true);
    const [waShowReceiptLink, setWaShowReceiptLink] = useState(true);
    const [trackingOn, setTrackingOn] = useState(true);
    const [tagStyle, setTagStyle] = useState<"qr" | "barcode">("qr");
    const [countryUnderstood, setCountryUnderstood] = useState(false);

    const [notifications, setNotifications] = useState(true);
    const baselineRef = useRef<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [initialized, setInitialized] = useState(false);

    // Country & Currency
    const [selectedCountryCode, setSelectedCountryCode] = useState(shop?.settings?.countryCode || "IN");
    const [savingCountry, setSavingCountry] = useState(false);
    // Set when a currency change would relabel existing orders — asks for explicit confirmation.
    const [currencyWarn, setCurrencyWarn] = useState<{ from: string; to: string } | null>(null);

    // Desktop settings shell: which section is open (synced to ?section=).
    const { hasFeature, plan } = useShopLimits();
    const deskFromUrl = (v: string | null): DeskSection => {
        const legacy: Record<string, DeskSection> = { shopInfo: "business", financials: "tax", preferences: "language" };
        if (!v) return "business";
        if (legacy[v]) return legacy[v];
        return (DESK_SECTIONS as string[]).includes(v) ? (v as DeskSection) : "business";
    };
    const [deskSection, setDeskSection] = useState<DeskSection>(() => deskFromUrl(searchParams.get("section")));
    const selectDesk = (id: DeskSection) => {
        setDeskSection(id);
        const next = new URLSearchParams(searchParams);
        next.set("section", id);
        navigate({ search: next.toString() }, { replace: true });
    };

    // Sync section from URL (?section=...) or redirect legacy publicPage link
    useEffect(() => {
        const section = searchParams.get("section");
        if (section === "publicPage" && isMobile) {
            navigate("/settings/public-page", { replace: true });
            return;
        }
        if (section) {
            const mapped = LEGACY_SECTION[section] || (TABS.some((tb) => tb.id === section) ? (section as SettingsSection) : null);
            if (mapped) setSelectedSection(mapped);
        }
        if (section && !isMobile) setDeskSection(deskFromUrl(section));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, navigate, isMobile]);

    // Load shop data once
    useEffect(() => {
        if (shop && !initialized) {
            setFormShopName(shop.name || "");
            // Parse the stored phone by its OWN dial code (works for +91, +971, …) —
            // never assume India, and never re-prefix with the current country's code.
            const parsedPhone = splitInternationalPhone(shop.phone || user?.phone || "");
            setPhone(parsedPhone.local);
            setRegisteredDialCode(parsedPhone.dialCode);
            setEmail(shop.email || user?.email || "");
            setWhatsappNumber(splitInternationalPhone(shop.whatsappNumber || shop.phone || user?.phone || "").local);
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
                setPaymentLink(shop.bankDetails.paymentLink || "");
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
            setReceiptTerms(shop.settings?.receiptTerms || "");
            setReceiptShowLogo(shop.settings?.receiptShowLogo !== false);
            setReceiptPaymentQr(shop.settings?.receiptPaymentQr !== false);
            setNextOrderNum(shop.settings?.nextOrderNumber || 1);
            const ws = shop.settings?.waShare;
            setWaHeader(ws?.headerText || "");
            setWaFooter(ws?.footerText || "");
            setWaShowItems(ws?.showItems !== false);
            setWaShowPayment(ws?.showPayment !== false);
            setWaShowExpectedDate(ws?.showExpectedDate !== false);
            setWaShowReceiptLink(ws?.showReceiptLink !== false);
            setTrackingOn(shop.settings?.trackingEnabled !== false);
            setTagStyle(shop.settings?.tagStyle === "barcode" ? "barcode" : "qr");
            setSelectedCountryCode(shop.settings?.countryCode || "IN");
            setInitialized(true);
        }
    }, [shop, initialized, user]);

    const formSnapshot = JSON.stringify([
        formShopName, phone, email, whatsappNumber, address, city, state, pincode, latitude, longitude, gstNumber, panNumber,
        accountNumber, ifscCode, bankName, accountHolderName, upiId, paymentLink, receiptPaymentQr,
        taxEnabled, taxName, taxRate, deliveryFeeEnabled, deliveryFeeMinOrder, deliveryFeeAmount, distanceFeeEnabled, distanceBands,
        receiptTerms, receiptShowLogo, nextOrderNum, waHeader, waFooter, waShowItems, waShowPayment, waShowExpectedDate, waShowReceiptLink,
        trackingOn, tagStyle, selectedCountryCode,
    ]);
    useEffect(() => {
        if (initialized && baselineRef.current === null) baselineRef.current = formSnapshot;
    }, [initialized, formSnapshot]);

    const doSaveCountry = async () => {
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
            return true;
        } catch (err) {
            console.error("Failed to save country:", err);
            addToast({ type: "error", title: t("common.error", "Error"), description: t("settings.countryFailed", "Failed to update country settings") });
        } finally {
            setSavingCountry(false);
        }
    };

    const handleSaveCountry = async () => {
        // Amounts on historical orders are plain numbers — changing the currency does
        // NOT convert them, it only relabels them (₹57 would print as AED 57). When the
        // shop already has orders, make the owner confirm that explicitly.
        const country = getCountry(selectedCountryCode);
        const fromCurrency = shop?.settings?.currency || "INR";
        if (shop?.id && country.currencyCode !== fromCurrency) {
            let hasOrders = true; // if the check fails, still warn — never relabel silently
            try {
                const snap = await getDocs(query(collection(db, "shops", shop.id, "orders"), limit(1)));
                hasOrders = !snap.empty;
            } catch { /* keep hasOrders = true */ }
            if (hasOrders) {
                setCurrencyWarn({ from: fromCurrency, to: country.currencyCode });
                return;
            }
        }
        return doSaveCountry();
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
        // Validate against the shop's COUNTRY (9 digits for UAE, 10 for India, …), not
        // an India-only rule — a UAE shop must be able to save its business profile.
        const country = getCountry(selectedCountryCode);
        if (!isPhoneLocked && phone && !phoneLenOk(country, phone)) {
            addToast({ type: "error", title: t("validation.invalidPhone"), description: t("validation.phoneDigitsDesc", { count: country.phoneDigits, defaultValue: `Phone must be ${country.phoneDigits} digits` }) });
            return;
        }
        if (whatsappNumber && !phoneLenOk(country, whatsappNumber)) {
            addToast({ type: "error", title: t("validation.invalidPhone"), description: t("validation.phoneDigitsDesc", { count: country.phoneDigits, defaultValue: `WhatsApp number must be ${country.phoneDigits} digits` }) });
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
                // Store international (+<dial><digits>) under the shop's country — this is
                // what prints on receipts and feeds WhatsApp links.
                ...(isPhoneLocked ? {} : { phone: phone ? `${country.phoneCode}${phone.replace(/\D/g, "")}` : "" }),
                ...(isEmailLocked ? {} : { email: email ? normalizeEmail(email) : "" }),
                whatsappNumber: whatsappNumber ? whatsappNumber.replace(/\D/g, "") : "",
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
            return true;
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
                paymentLink: paymentLink.trim(),
            }, receiptPaymentQr);
            await updateTaxSettings(taxEnabled, taxName, taxRate);
            addToast({ type: "success", title: t("shop.settingsSaved") });
            return true;
        } catch {
            addToast({ type: "error", title: t("shop.saveError") });
        } finally {
            setSaving(false);
        }
    };

    // Operations = delivery rules + receipt terms + order numbering. Kept OFF the
    // tax/bank financials write so a stale GST/bank value can never block saving these.
    const handleSaveOperations = async () => {
        // Order counter may only move FORWARD — lowering it would mint duplicate
        // orderNumber/publicIds and break tracking links & barcode scans.
        const storedNext = shop?.settings?.nextOrderNumber || 1;
        const wantedNext = Math.round(Number(nextOrderNum) || 0);
        if (wantedNext !== storedNext && (!Number.isFinite(wantedNext) || wantedNext < storedNext)) {
            addToast({
                type: "error",
                title: t("settings.nextOrderTooLow", "Next order number can only be increased (currently {{n}})", { n: storedNext }),
            });
            return;
        }
        setSaving(true);
        try {
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
            await updateReceiptTerms(receiptTerms.trim(), receiptShowLogo);
            if (wantedNext !== storedNext) await updateNextOrderNumber(wantedNext);
            await updateWaShare({
                headerText: waHeader.trim(),
                footerText: waFooter.trim(),
                showItems: waShowItems,
                showPayment: waShowPayment,
                showExpectedDate: waShowExpectedDate,
                showReceiptLink: waShowReceiptLink,
            }, trackingOn);
            if (tagStyle !== (shop?.settings?.tagStyle === "barcode" ? "barcode" : "qr") && shop?.id) {
                await updateDoc(doc(db, "shops", shop.id), { "settings.tagStyle": tagStyle, updatedAt: serverTimestamp() });
            }
            addToast({ type: "success", title: t("shop.settingsSaved") });
            return true;
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
    const handleSave = async () => {
        if (selectedSection === "business") return handleSaveShopInfo();
        if (selectedSection === "preferences") {
            if (countryChanged) return handleSaveCountry();
            addToast({ type: "success", title: t("shop.settingsSaved", "Saved") });
            return;
        }
        // The "tax" section hosts the Country & currency picker, so a country change must be
        // persisted from the header Save too — otherwise it falls through to the financials
        // write below and is silently dropped. Save it first, then the tax/bank/delivery write.
        if (selectedSection === "operations") return handleSaveOperations();
        if (selectedSection === "tax" && countryChanged) {
            await handleSaveCountry();
        }
        return handleSaveFinancials(); // tax + bank share the GST/bank write
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

    // ================= DESKTOP (reference layout) =================
    if (!isMobile) {
        const NATIVE: DeskSection[] = ["business", "tax", "bank", "operations", "delivery", "notifications"];
        const isNative = NATIVE.includes(deskSection);
        const dirty = isNative && baselineRef.current !== null && baselineRef.current !== formSnapshot;
        const doDeskSave = async () => {
            let ok: boolean | undefined;
            if (deskSection === "business") ok = await handleSaveShopInfo();
            else if (deskSection === "tax") {
                if (countryChanged) {
                    if (!countryUnderstood) {
                        addToast({ type: "error", title: t("settings.tickUnderstand", "Tick “I understand” to change the country") });
                        return;
                    }
                    const c = await doSaveCountry();
                    if (!c) return;
                }
                ok = await handleSaveFinancials();
            } else if (deskSection === "bank") ok = await handleSaveFinancials();
            else ok = await handleSaveOperations();
            if (ok) { baselineRef.current = formSnapshot; setCountryUnderstood(false); }
        };
        const discard = () => { baselineRef.current = null; setInitialized(false); setCountryUnderstood(false); };

        const SECTIONS: { id: DeskSection; label: string; icon: ReactNode; owner?: boolean; badge?: string }[] = [
            { id: "business", label: t("settings.navBusiness", "Business profile"), icon: <Store size={19} /> },
            { id: "tax", label: t("settings.navTax", "Tax & currency"), icon: <CircleDollarSign size={19} /> },
            { id: "bank", label: t("settings.navBank", "Bank & payments"), icon: <Landmark size={19} /> },
            { id: "operations", label: t("settings.navOperations", "Operations & receipts"), icon: <ClipboardList size={19} /> },
            { id: "delivery", label: t("settings.navDelivery", "Delivery & service areas"), icon: <MapPin size={19} /> },
            { id: "publicPage", label: t("settings.navPublicPage", "Public booking page"), icon: <LayoutTemplate size={19} />, owner: true },
            { id: "offers", label: t("settings.navOffers", "Offers"), icon: <Tag size={19} />, badge: hasFeature("offers") ? undefined : "PRO+" },
            { id: "notifications", label: t("settings.navNotifications", "Reminders & notifications"), icon: <Bell size={19} /> },
            { id: "language", label: t("settings.navLanguage", "Language"), icon: <Globe size={19} /> },
            { id: "subscription", label: t("settings.navSubscription", "Subscription"), icon: <CreditCard size={19} />, owner: true },
            { id: "apps", label: t("settings.navApps", "Apps"), icon: <LayoutGrid size={19} /> },
            { id: "help", label: t("settings.navHelp", "Help & support"), icon: <HelpCircle size={19} /> },
            { id: "account", label: t("settings.navAccount", "Account"), icon: <UserRound size={19} /> },
        ].filter((x) => !x.owner || role === "admin") as { id: DeskSection; label: string; icon: ReactNode; owner?: boolean; badge?: string }[];
        const curDesk = SECTIONS.find((x) => x.id === deskSection) || SECTIONS[0];

        const dsCard: CSSProperties = { background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 14 };
        const inner: CSSProperties = { border: "1px solid var(--ds-border)", borderRadius: 12, padding: "18px 20px" };
        const L: CSSProperties = { display: "block", fontSize: 13.5, fontWeight: 500, color: "var(--ds-text)", marginBottom: 8 };
        const F: CSSProperties = { width: "100%", font: "inherit", fontSize: 14.5, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 10, padding: "11px 13px", outline: "none" };
        const Fro: CSSProperties = { ...F, background: "var(--ds-table-head)", color: "var(--ds-text-2)" };
        const hint: CSSProperties = { fontSize: 12.5, color: "var(--ds-text-2)", marginTop: 6 };
        const h3: CSSProperties = { fontSize: 16, fontWeight: 600, marginBottom: 4 };
        const sub: CSSProperties = { fontSize: 13, color: "var(--ds-text-2)", marginBottom: 16 };
        const Toggle = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
            <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
                style={{ position: "relative", flex: "none", cursor: "pointer", width: 44, height: 24, border: 0, borderRadius: 20, background: on ? "var(--ds-blue)" : "#D1D5DB" }}>
                <span style={{ position: "absolute", top: 3, left: 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.25)", transition: "transform .15s", transform: on ? "translateX(20px)" : "translateX(0)" }} />
            </button>
        );
        const SwitchRow = ({ title, desc, on, onChange, last }: { title: string; desc?: string; on: boolean; onChange: (v: boolean) => void; last?: boolean }) => (
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0", borderBottom: last ? 0 : "1px solid var(--ds-divider)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{title}</div>
                    {desc && <div style={{ fontSize: 12.5, color: "var(--ds-text-2)", marginTop: 3 }}>{desc}</div>}
                </div>
                <Toggle on={on} onChange={onChange} label={title} />
            </div>
        );
        const Seg = <T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) => (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${options.length}, 1fr)`, border: "1px solid var(--ds-border)", borderRadius: 10, overflow: "hidden" }}>
                {options.map(([v, label], i) => {
                    const on = value === v;
                    return <button key={v} type="button" onClick={() => onChange(v)} style={{ cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: on ? 600 : 500, padding: "10px 8px", border: 0, borderLeft: i ? "1px solid var(--ds-border)" : 0, background: on ? "var(--ds-blue)" : "var(--ds-card)", color: on ? "#fff" : "var(--ds-text)" }}>{label}</button>;
                })}
            </div>
        );
        const Money = ({ value, onChange, placeholder }: { value: number; onChange: (n: number) => void; placeholder?: string }) => (
            <div style={{ display: "flex", alignItems: "stretch", border: "1px solid var(--ds-border)", borderRadius: 10, overflow: "hidden" }}>
                <span style={{ width: 40, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text-2)", borderRight: "1px solid var(--ds-border)" }}>{currencySymbol}</span>
                <input value={value ? String(value) : ""} placeholder={placeholder} inputMode="numeric" onChange={(e) => onChange(Number(e.target.value.replace(/[^0-9.]/g, "")) || 0)}
                    style={{ flex: 1, minWidth: 0, font: "inherit", fontSize: 14.5, border: 0, padding: "11px 13px", outline: "none", background: "transparent", color: "var(--ds-text)" }} />
            </div>
        );

        const planName = plan?.name || (plan?.id ? plan.id.toUpperCase() : "");
        const renewAt = (shop?.subscription?.endDate as { toDate?: () => Date } | undefined)?.toDate?.();
        const sampleId = formatOrderId(shop?.shopCode || "SHOP", Math.max(1, nextOrderNum || 1));
        const upiTarget = upiId ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(formShopName || "Shop")}` : (paymentLink || "");
        const previewTax = taxEnabled ? Math.round((100 + (100 * (Number(taxRate) || 0)) / 100) * 100) / 100 : 100;
        const shopAddressLine = [address, city].filter(Boolean).join(", ");

        const MiniReceipt = ({ width, thermal }: { width: number; thermal?: boolean }) => (
            <div style={{ width, background: "#fff", border: "1px solid var(--ds-border)", borderRadius: 4, padding: thermal ? "10px 9px" : "12px 12px", fontSize: 8.5, color: "#111827", boxShadow: "0 2px 6px rgba(16,24,40,.06)", lineHeight: 1.45 }}>
                {receiptShowLogo && shop?.logo && <img src={shop.logo} alt="" style={{ width: 22, height: 22, borderRadius: 4, objectFit: "cover", display: "block", margin: "0 auto 4px" }} />}
                <div style={{ textAlign: "center", fontWeight: 700, fontSize: 10 }}>{formShopName || "Your shop"}</div>
                <div style={{ textAlign: "center", fontSize: 7.5, color: "#6B7280" }}>{shopAddressLine}</div>
                <div style={{ borderTop: "1px dashed #D1D5DB", margin: "6px 0" }} />
                <div>Bill #{sampleId}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span>{t("settings.sampleItem", "Sample item")}</span><span>{currencySymbol}100.00</span></div>
                {taxEnabled && <div style={{ display: "flex", justifyContent: "space-between" }}><span>{taxName} ({taxRate}%)</span><span>{currencySymbol}{(previewTax - 100).toFixed(2)}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: 2 }}><span>{t("settings.balanceDue", "Balance due")}</span><span style={{ color: "#DC2626" }}>{currencySymbol}{previewTax.toFixed(2)}</span></div>
                {receiptPaymentQr && upiTarget && (
                    <div style={{ textAlign: "center", marginTop: 6 }}>
                        <div style={{ fontSize: 7, fontWeight: 700 }}>SCAN TO PAY</div>
                        <QRCodeSVG value={upiTarget} size={thermal ? 46 : 52} style={{ margin: "3px auto 0", display: "block" }} />
                    </div>
                )}
                {trackingOn && <div style={{ textAlign: "center", fontSize: 7, color: "#2563EB", marginTop: 4 }}>Track: /track/{sampleId}</div>}
                {receiptTerms && <div style={{ fontSize: 6.5, color: "#6B7280", marginTop: 5, whiteSpace: "pre-wrap", maxHeight: 40, overflow: "hidden" }}>{receiptTerms}</div>}
            </div>
        );

        return (
            <div className="lb-ds" style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", background: "var(--ds-bg)" }}>
                {/* page header */}
                <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 14, padding: "20px 24px 14px" }}>
                    <span style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-.02em", marginRight: "auto" }}>{t("settings.title", "Settings")}</span>
                    <button onClick={() => selectDesk("help")} style={{ cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14.5, color: "var(--ds-text)", background: "transparent", border: 0 }}><HelpCircle size={19} />{t("settings.help", "Help")}</button>
                    {role === "admin" && planName && (
                        <button onClick={() => selectDesk("subscription")} style={{ cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14.5, fontWeight: 600, color: "var(--ds-blue)", background: "var(--ds-card)", border: "1px solid var(--ds-blue)", borderRadius: 11, padding: "9px 14px" }}>
                            <Crown size={17} style={{ color: "#F59E0B" }} />{planName}{renewAt ? ` · ${t("settings.renews", "Renews")} ${format(renewAt, "d MMM")}` : ""}
                        </button>
                    )}
                </div>

                <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 18, padding: "0 24px" }}>
                    {/* section rail */}
                    <nav className="lb-scroll" style={{ ...dsCard, width: 250, flex: "none", overflow: "auto", padding: "18px 12px", alignSelf: "stretch", marginBottom: 18 }}>
                        <div style={{ fontSize: 17.5, fontWeight: 600, padding: "0 10px 14px" }}>{t("settings.title", "Settings")}</div>
                        {SECTIONS.map((x) => {
                            const on = x.id === deskSection;
                            return (
                                <button key={x.id} onClick={() => selectDesk(x.id)} aria-current={on ? "page" : undefined}
                                    style={{ width: "100%", cursor: "pointer", font: "inherit", display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", marginBottom: 3, fontSize: 14.5, fontWeight: on ? 600 : 500, color: on ? "var(--ds-blue)" : "var(--ds-text)", background: on ? "var(--ds-blue-soft)" : "transparent", border: 0, borderRadius: 10, textAlign: "left" }}>
                                    <span style={{ color: on ? "var(--ds-blue)" : "var(--ds-text-2)", display: "inline-flex" }}>{x.icon}</span>
                                    {x.label}
                                    {x.badge && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ds-blue)", background: "var(--ds-blue-soft)", borderRadius: 20, padding: "2px 8px" }}>{x.badge}</span>}
                                </button>
                            );
                        })}
                        <div style={{ height: 1, background: "var(--ds-divider)", margin: "10px 6px" }} />
                        <button onClick={signOut} style={{ width: "100%", cursor: "pointer", font: "inherit", display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", fontSize: 14.5, fontWeight: 500, color: "var(--ds-negative)", background: "transparent", border: 0, borderRadius: 10, textAlign: "left" }}><LogOut size={19} />{t("auth.signOut", "Sign out")}</button>
                    </nav>

                    {/* content */}
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
                        <div className="lb-scroll" style={{ ...dsCard, flex: 1, minHeight: 0, overflow: "auto", padding: isNative || deskSection === "language" || deskSection === "account" ? "24px 26px" : 0, marginBottom: isNative ? 0 : 18, borderBottomLeftRadius: isNative ? 0 : 14, borderBottomRightRadius: isNative ? 0 : 14 }}>
                            {loading ? (
                                <div style={{ padding: 40, textAlign: "center", color: "var(--ds-text-2)" }}>{t("common.loading", "Loading…")}</div>
                            ) : (
                            <>
                            {isNative || deskSection === "language" || deskSection === "account" ? <div style={{ fontSize: 21, fontWeight: 600, marginBottom: 18 }}>{curDesk.label}</div> : null}

                            {/* ===== BUSINESS PROFILE ===== */}
                            {deskSection === "business" && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                                    <div style={{ ...inner, display: "grid", gridTemplateColumns: "230px minmax(0,1fr)", gap: 26 }}>
                                        <div>
                                            <label style={L}>{t("settings.shopLogo", "Shop logo")}</label>
                                            <div style={{ border: "1px solid var(--ds-border)", borderRadius: 12, padding: "16px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                                                <span style={{ width: 170, height: 170, borderRadius: "50%", overflow: "hidden", background: "var(--ds-blue-soft)", color: "var(--ds-blue)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                    {logoUploading ? <Loader2 size={34} style={{ animation: "spin 1s linear infinite" }} /> : shop?.logo ? <img src={shop.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Store size={56} />}
                                                </span>
                                                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                                                <button type="button" onClick={() => logoInputRef.current?.click()} disabled={logoUploading} style={{ cursor: "pointer", font: "inherit", fontSize: 14.5, fontWeight: 500, color: "var(--ds-blue)", background: "var(--ds-card)", border: "1px solid var(--ds-blue)", borderRadius: 8, padding: "9px 22px" }}>{shop?.logo ? t("settings.changeLogo", "Change logo") : t("settings.uploadLogo", "Upload logo")}</button>
                                                <input ref={logoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { void handleLogoFile(e.target.files?.[0] || null); e.target.value = ""; }} />
                                                <div style={{ fontSize: 12, color: "var(--ds-text-2)", textAlign: "center" }}>{t("settings.logoHint", "JPG or PNG. Uploads instantly.")}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 22px", alignContent: "start" }}>
                                            <div><label style={L}>{t("settings.shopName", "Shop name")}</label><input style={F} value={formShopName} onChange={(e) => setFormShopName(e.target.value)} /></div>
                                            <div>
                                                <label style={L}>{t("settings.phone", "Phone")}</label>
                                                <LPhoneInput value={phone} onValueChange={setPhone} showClear={!isPhoneLocked} disabled={isPhoneLocked} countryCode={(isPhoneLocked && registeredDialCode) || phoneCountry.phoneCode} maxDigits={isPhoneLocked && phone ? phone.length : phoneCountry.phoneDigits} />
                                            </div>
                                            <div><label style={L}>{t("settings.email", "Email")}</label><input style={isEmailLocked ? Fro : F} type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isEmailLocked} /></div>
                                            <div>
                                                <label style={L}>{t("settings.whatsapp", "WhatsApp number")}</label>
                                                <LPhoneInput value={whatsappNumber} onValueChange={setWhatsappNumber} showClear countryCode={phoneCountry.phoneCode} maxDigits={phoneCountry.phoneDigits} />
                                            </div>
                                            <div style={{ gridColumn: "1 / -1" }}><label style={L}>{t("settings.address", "Address")}</label><input style={F} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
                                            <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 22 }}>
                                                <div><label style={L}>{t("settings.city", "City")}</label><input style={F} value={city} onChange={(e) => setCity(e.target.value)} /></div>
                                                <div><label style={L}>{getStateLabel(selectedCountryCode)}</label><input style={F} value={state} onChange={(e) => setState(e.target.value)} /></div>
                                                <div><label style={L}>{phoneCountry.pinLabel}</label><input style={F} value={pincode} maxLength={12} onChange={(e) => setPincode(selectedCountryCode === "IN" ? e.target.value.replace(/\D/g, "").slice(0, 6) : e.target.value.replace(/[^a-zA-Z0-9\s-]/g, "").slice(0, 12))} /></div>
                                            </div>
                                            <div style={{ gridColumn: "1 / -1" }}>
                                                <label style={L}>{phoneCountry.code === "IN" ? t("settings.gstNumber", "GST number") : `${phoneCountry.taxName} ${t("shop.registrationNo", "registration no.")}`}</label>
                                                <input style={F} value={gstNumber} maxLength={phoneCountry.code === "IN" ? 15 : 30} onChange={(e) => setGstNumber(e.target.value.toUpperCase())} />
                                                <div style={hint}>{t("settings.gstSavedWithTax", "Saved with Tax & currency.")}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={inner}>
                                        <div style={h3}>{t("settings.mapLocation", "Map location")}</div>
                                        <div style={sub}>{t("settings.mapLocationDesc", "Used for directions on your booking page and for delivery agents.")}</div>
                                        <LLocationMap latitude={latitude} longitude={longitude} onLocationChange={handleMapLocationChange} onGetLocation={getCurrentLocation} gettingLocation={gettingLocation} />
                                        {latitude && longitude && (
                                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, fontSize: 13, color: "var(--ds-text-2)" }}>
                                                {latitude.toFixed(6)}, {longitude.toFixed(6)}
                                                <button onClick={copyLocationLink} style={{ cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ds-blue)", background: "transparent", border: 0 }}><Copy size={14} />{t("common.copy", "Copy")}</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ===== TAX & CURRENCY ===== */}
                            {deskSection === "tax" && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                                    <div>
                                        <label style={L}>{t("settings.country", "Country")}</label>
                                        <div style={{ position: "relative" }}>
                                            <select value={selectedCountryCode} onChange={(e) => { setSelectedCountryCode(e.target.value); setCountryUnderstood(false); }} style={{ ...F, appearance: "none", WebkitAppearance: "none", paddingRight: 40, cursor: "pointer" }}>
                                                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                                            </select>
                                            <ChevronDown size={18} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                                        </div>
                                        <div style={hint}>{t("settings.countryHint", "Changing the country updates currency, tax name and phone format.")}</div>
                                    </div>
                                    <div>
                                        <label style={L}>{t("settings.currency", "Currency")}</label>
                                        <div style={{ ...Fro, display: "flex", alignItems: "center" }}>
                                            {phoneCountry.currencySymbol} {phoneCountry.currencyCode}
                                            <Lock size={17} style={{ marginLeft: "auto" }} />
                                        </div>
                                    </div>
                                    <div style={inner}>
                                        <div style={{ fontSize: 16, fontWeight: 600, paddingBottom: 12, borderBottom: "1px solid var(--ds-divider)" }}>{t("settings.tax", "Tax")}</div>
                                        <SwitchRow title={t("settings.chargeTax", "Charge tax on bills")} on={taxEnabled} onChange={setTaxEnabled} last={!taxEnabled} />
                                        {taxEnabled && (
                                            <>
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 20, marginTop: 14 }}>
                                                    <div><label style={L}>{t("settings.taxName", "Tax name")}</label><input style={F} value={taxName} onChange={(e) => setTaxName(e.target.value)} placeholder="GST" /></div>
                                                    <div>
                                                        <label style={L}>{t("settings.rate", "Rate")}</label>
                                                        <div style={{ display: "flex", border: "1px solid var(--ds-border)", borderRadius: 10, overflow: "hidden" }}>
                                                            <input value={taxRate ? String(taxRate) : ""} inputMode="decimal" onChange={(e) => setTaxRate(Number(e.target.value.replace(/[^0-9.]/g, "")) || 0)} placeholder="18" style={{ flex: 1, minWidth: 0, font: "inherit", fontSize: 14.5, border: 0, padding: "11px 13px", outline: "none" }} />
                                                            <span style={{ width: 40, display: "flex", alignItems: "center", justifyContent: "center", borderLeft: "1px solid var(--ds-border)", color: "var(--ds-text-2)" }}>%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16, padding: "12px 16px", background: "var(--ds-table-head)", border: "1px solid var(--ds-divider)", borderRadius: 10 }}>
                                                    <Calculator size={20} style={{ color: "var(--ds-text-2)" }} />
                                                    <div>
                                                        <div style={{ fontSize: 12.5, color: "var(--ds-text-2)" }}>{t("settings.preview", "Preview")} · {t("settings.taxOnTop", "tax is added on top of item prices")}</div>
                                                        <div style={{ fontSize: 15.5, fontWeight: 500, marginTop: 2 }}>{currencySymbol}100 {t("settings.item", "item")} <span style={{ color: "var(--ds-text-2)" }}>→</span> <span style={{ color: "#16A34A" }}>{currencySymbol}{previewTax} {t("settings.onTheBill", "on the bill")}</span></div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    {phoneCountry.code === "IN" && (
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                                            <div><label style={L}>{t("settings.gstNumber", "GST number")}</label><input style={F} value={gstNumber} maxLength={15} onChange={(e) => setGstNumber(e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" /></div>
                                            <div><label style={L}>{t("settings.panNumber", "PAN number")}</label><input style={F} value={panNumber} maxLength={10} onChange={(e) => setPanNumber(e.target.value.toUpperCase())} placeholder="AAAAA0000A" /></div>
                                        </div>
                                    )}
                                    {countryChanged && (
                                        <div style={{ padding: "16px 18px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14.5, fontWeight: 500 }}><AlertCircle size={20} style={{ color: "#D97706" }} />{t("settings.countryWarn", "Changing the country when orders already exist will NOT convert past amounts")}</div>
                                            <label style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, fontSize: 13.5, cursor: "pointer" }}>
                                                <input type="checkbox" checked={countryUnderstood} onChange={(e) => setCountryUnderstood(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--ds-blue)" }} />
                                                {t("settings.iUnderstand", "I understand")}
                                            </label>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ===== BANK & PAYMENTS ===== */}
                            {deskSection === "bank" && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                                    <div style={{ ...inner, padding: 0 }}>
                                        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 250px" }}>
                                            <div style={{ padding: "18px 20px", borderRight: "1px solid var(--ds-divider)" }}>
                                                <div style={h3}>{t("settings.scanToPay", "Scan to pay")}</div>
                                                <div style={sub}>{t("settings.scanToPayDesc", "Let customers pay you instantly by scanning the QR on unpaid receipts.")}</div>
                                                <SwitchRow title={t("settings.showUpiQr", "Show UPI QR on unpaid receipts")} on={receiptPaymentQr} onChange={setReceiptPaymentQr} last />
                                                <div style={{ marginTop: 10 }}>
                                                    <label style={L}>{t("settings.upiId", "UPI ID")}</label>
                                                    <input style={F} value={upiId} onChange={(e) => setUpiId(e.target.value.toLowerCase())} placeholder="shop@upi" />
                                                    <div style={hint}>{t("settings.upiHint", "Use any UPI ID linked to your bank account")}</div>
                                                </div>
                                                <div style={{ marginTop: 16 }}>
                                                    <label style={L}>{t("settings.paymentLink", "Payment link")}</label>
                                                    <div style={{ display: "flex", border: "1px solid var(--ds-border)", borderRadius: 10, overflow: "hidden" }}>
                                                        <input value={paymentLink} onChange={(e) => setPaymentLink(e.target.value)} placeholder="https://rzp.io/l/yourshop" style={{ flex: 1, minWidth: 0, font: "inherit", fontSize: 14.5, border: 0, padding: "11px 13px", outline: "none" }} />
                                                        <button type="button" onClick={() => { if (paymentLink) { void navigator.clipboard.writeText(paymentLink); addToast({ type: "success", title: t("common.copied", "Copied") }); } }} disabled={!paymentLink} style={{ cursor: paymentLink ? "pointer" : "default", font: "inherit", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 14, color: "var(--ds-text)", background: "var(--ds-card)", border: 0, borderLeft: "1px solid var(--ds-border)", padding: "0 16px", opacity: paymentLink ? 1 : 0.5 }}><Copy size={16} />{t("common.copy", "Copy")}</button>
                                                    </div>
                                                    <div style={hint}>{t("settings.paymentLinkHint", "Used for the QR when there's no UPI ID (Razorpay, Stripe, PayPal…)")}</div>
                                                </div>
                                            </div>
                                            <div style={{ padding: "18px 16px" }}>
                                                <div style={{ fontSize: 13, color: "var(--ds-text-2)", marginBottom: 10 }}>{t("settings.receiptPreview", "Receipt preview")}</div>
                                                <MiniReceipt width={200} />
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", borderTop: "1px solid var(--ds-divider)", background: "var(--ds-table-head)", fontSize: 13.5, color: "var(--ds-text-2)", borderRadius: "0 0 12px 12px" }}><Info size={17} />{t("settings.qrOnlyDue", "Customers see the QR only when a balance is due")}</div>
                                    </div>
                                    <div style={inner}>
                                        <div style={h3}>{t("settings.bankDetails", "Bank details")} <span style={{ fontSize: 13, fontWeight: 400, color: "var(--ds-text-2)" }}>({t("settings.forReference", "for reference on invoices")})</span></div>
                                        <div style={sub}>{t("settings.bankDetailsDesc", "Keep your settlement account on file.")}</div>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 22px" }}>
                                            <div><label style={L}>{t("settings.accountName", "Account name")}</label><input style={F} value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} /></div>
                                            <div><label style={L}>{t("settings.accountNumber", "Account number")}</label><input style={F} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))} /></div>
                                            <div><label style={L}>{t("settings.ifsc", "IFSC code")}</label><input style={F} value={ifscCode} maxLength={11} onChange={(e) => setIfscCode(e.target.value.toUpperCase())} /></div>
                                            <div><label style={L}>{t("settings.bankName", "Bank name")}</label><input style={F} value={bankName} onChange={(e) => setBankName(e.target.value)} /></div>
                                        </div>
                                        <div style={{ ...hint, display: "flex", alignItems: "center", gap: 7, marginTop: 12 }}><Lock size={14} />{t("settings.bankPrivate", "These details are for reference only and won't be shared publicly.")}</div>
                                    </div>
                                </div>
                            )}

                            {/* ===== OPERATIONS & RECEIPTS ===== */}
                            {deskSection === "operations" && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.2fr)", gap: 18 }}>
                                        <div style={inner}>
                                            <div style={{ ...h3, marginBottom: 16 }}>{t("settings.orderNumbers", "Order numbers")}</div>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                                <div><label style={L}>{t("settings.prefix", "Prefix")}</label><div style={{ ...Fro, display: "flex", alignItems: "center" }}>{shop?.shopCode || "—"}-<Lock size={15} style={{ marginLeft: "auto" }} /></div><div style={hint}>{t("settings.prefixHint", "Your unique shop code")}</div></div>
                                                <div>
                                                    <label style={L}>{t("settings.nextNumber", "Next number")}</label>
                                                    <input type="number" min={shop?.settings?.nextOrderNumber || 1} value={nextOrderNum} onChange={(e) => setNextOrderNum(Math.max(0, Math.round(Number(e.target.value) || 0)))} style={F} />
                                                    <div style={hint}>{t("settings.raiseOnly", "Can be raised, never lowered")}</div>
                                                </div>
                                            </div>
                                            <div style={{ marginTop: 16, fontSize: 13.5, color: "var(--ds-text-2)" }}>{t("settings.nextOrderPreview", "Next order will be")} <b style={{ color: "var(--ds-blue)", fontWeight: 600 }}>{sampleId}</b></div>
                                        </div>
                                        <div style={inner}>
                                            <div style={h3}>{t("settings.tags", "Tags")}</div>
                                            <div style={sub}>{t("settings.tagsDesc", "Choose the type of code printed on order tags (shared with the apps).")}</div>
                                            <Seg value={tagStyle} onChange={setTagStyle} options={[["qr", t("settings.qrCode", "QR code")], ["barcode", t("settings.barcode128", "Barcode (Code 128)")]]} />
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                                                <div style={{ border: `1px solid ${tagStyle === "qr" ? "var(--ds-blue)" : "var(--ds-border)"}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                                    <div style={{ fontSize: 12.5, marginBottom: 8 }}>{t("settings.qrPreview", "QR code preview")}</div>
                                                    <QRCodeSVG value={sampleId} size={60} style={{ display: "block", margin: "0 auto" }} />
                                                    <div style={{ fontSize: 12, marginTop: 6 }}>{sampleId}</div>
                                                </div>
                                                <div style={{ border: `1px solid ${tagStyle === "barcode" ? "var(--ds-blue)" : "var(--ds-border)"}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                                    <div style={{ fontSize: 12.5, marginBottom: 8 }}>{t("settings.barcodePreview", "Barcode preview")}</div>
                                                    <img src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(sampleId)}&scale=2&height=8&includetext&textsize=9&backgroundcolor=ffffff`} alt={sampleId} style={{ maxWidth: "100%", height: 62, objectFit: "contain" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ ...inner, padding: 0 }}>
                                        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,0.9fr) minmax(0,1fr) minmax(0,1.15fr)" }}>
                                            <div style={{ padding: "18px 20px", borderRight: "1px solid var(--ds-divider)" }}>
                                                <div style={h3}>{t("settings.receipts", "Receipts")}</div>
                                                <div style={sub}>{t("settings.receiptsDesc", "Choose what to print on customer receipts")}</div>
                                                <SwitchRow title={t("settings.printLogo", "Print shop logo")} desc={shop?.logo ? t("settings.printLogoDesc", "Show your shop logo on receipts") : t("settings.uploadLogoFirst", "Upload a logo in Business profile first")} on={receiptShowLogo} onChange={setReceiptShowLogo} />
                                                <SwitchRow title={t("settings.scanToPayQr", "Scan-to-pay QR")} desc={t("settings.scanToPayQrDesc", "Show UPI QR on unpaid receipts")} on={receiptPaymentQr} onChange={setReceiptPaymentQr} />
                                                <SwitchRow title={t("settings.trackingLink", "Tracking link")} desc={t("settings.trackingLinkDesc", "Tracking links & QR on receipts and WhatsApp")} on={trackingOn} onChange={setTrackingOn} last />
                                            </div>
                                            <div style={{ padding: "18px 20px", borderRight: "1px solid var(--ds-divider)" }}>
                                                <div style={{ fontSize: 14, fontWeight: 500 }}>{t("settings.termsOnReceipt", "Terms printed on receipt")}</div>
                                                <div style={{ ...sub, marginTop: 4 }}>{t("settings.termsOnReceiptDesc", "These terms will appear at the bottom of every receipt.")}</div>
                                                <textarea value={receiptTerms} onChange={(e) => setReceiptTerms(e.target.value.slice(0, 1000))} rows={7} maxLength={1000}
                                                    placeholder={t("settings.receiptTermsPlaceholder", "e.g. Goods once delivered will not be taken back. Please collect within 30 days.")}
                                                    style={{ ...F, resize: "vertical", lineHeight: 1.55 }} />
                                                <div style={hint}>{receiptTerms.length} / 1000</div>
                                            </div>
                                            <div style={{ padding: "18px 16px" }}>
                                                <div style={{ fontSize: 13, color: "var(--ds-text-2)", marginBottom: 10 }}>{t("settings.receiptPreview", "Receipt preview")}</div>
                                                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                                                    <div><div style={{ fontSize: 12, marginBottom: 5 }}>A4</div><MiniReceipt width={150} /></div>
                                                    <div><div style={{ fontSize: 12, marginBottom: 5 }}>80 mm</div><MiniReceipt width={118} thermal /></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ===== DELIVERY & SERVICE AREAS ===== */}
                            {deskSection === "delivery" && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                                    <div style={inner}>
                                        <div style={h3}>{t("settings.serviceAreas", "Service areas")}</div>
                                        <div style={sub}>{t("settings.serviceAreasDesc2", "Add the localities where you offer pickup and delivery. Changes save instantly.")}</div>
                                        <ServiceAreasList />
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                                        <div style={inner}>
                                            <div style={h3}>{t("settings.pickupSlots", "Pickup time slots")}</div>
                                            <div style={sub}>{t("settings.slotsSaveInstantly", "Changes save instantly.")}</div>
                                            <PickupSlotsList />
                                        </div>
                                        <div style={inner}>
                                            <div style={h3}>{t("settings.deliverySlots", "Delivery time slots")}</div>
                                            <div style={sub}>{t("settings.slotsSaveInstantly", "Changes save instantly.")}</div>
                                            <DeliverySlotsList />
                                        </div>
                                    </div>
                                    <div style={inner}>
                                        <SwitchRow title={t("settings.deliveryFee", "Delivery fee")} desc={t("settings.deliveryFeeHelp2", "For home delivery and home pickup orders below the free-delivery amount. Shop pickup is always free.")} on={deliveryFeeEnabled} onChange={setDeliveryFeeEnabled} last />
                                        {deliveryFeeEnabled && (
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, marginTop: 12 }}>
                                                <div><label style={L}>{t("settings.deliveryFeeAmt", "Delivery fee")}</label><Money value={deliveryFeeAmount} onChange={setDeliveryFeeAmount} placeholder="50" /></div>
                                                <div><label style={L}>{t("settings.freeAbove", "Free above")}</label><Money value={deliveryFeeMinOrder} onChange={setDeliveryFeeMinOrder} placeholder="500" /><div style={hint}>{t("settings.freeAboveHint", "Orders at or above this amount get free delivery")}</div></div>
                                            </div>
                                        )}
                                    </div>
                                    <div style={inner}>
                                        <SwitchRow title={t("settings.distanceFee", "Charge by distance")} desc={t("settings.distanceFeeHelp2", "Staff pick a km band at checkout and that band's fee applies instead of the flat fee.")} on={distanceFeeEnabled}
                                            onChange={(v) => { setDistanceFeeEnabled(v); if (v && distanceBands.length === 0) setDistanceBands([{ id: "b0", label: "0–5 km", fee: 0 }, { id: "b1", label: "5–10 km", fee: 0 }, { id: "b2", label: "10–15 km", fee: 0 }, { id: "b3", label: "15–20 km", fee: 0 }]); }} last />
                                        {distanceFeeEnabled && (
                                            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                                                {distanceBands.map((b, i) => (
                                                    <div key={b.id} style={{ display: "grid", gridTemplateColumns: "1fr 180px 40px", gap: 12, alignItems: "center" }}>
                                                        <input style={F} value={b.label} placeholder="0–5 km" onChange={(e) => { const n = [...distanceBands]; n[i] = { ...n[i], label: e.target.value }; setDistanceBands(n); }} />
                                                        <Money value={b.fee} onChange={(v) => { const n = [...distanceBands]; n[i] = { ...n[i], fee: v }; setDistanceBands(n); }} placeholder="0" />
                                                        <button type="button" aria-label={t("settings.removeBand", "Remove band")} onClick={() => setDistanceBands(distanceBands.filter((_, j) => j !== i))} style={{ height: 42, cursor: "pointer", border: "1px solid var(--ds-border)", borderRadius: 10, background: "var(--ds-card)", color: "var(--ds-negative)", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={16} /></button>
                                                    </div>
                                                ))}
                                                <button type="button" onClick={() => setDistanceBands([...distanceBands, { id: `b-${distanceBands.length}-${Date.now() % 100000}`, label: "", fee: 0 }])} style={{ cursor: "pointer", font: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14, fontWeight: 500, color: "var(--ds-blue)", background: "transparent", border: "1px dashed var(--ds-border)", borderRadius: 10, padding: 11 }}><Plus size={16} />{t("settings.addBand", "Add band")}</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ===== REMINDERS & NOTIFICATIONS ===== */}
                            {deskSection === "notifications" && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                                    <div style={inner}>
                                        <div style={h3}>{t("settings.waMessage", "WhatsApp order message")}</div>
                                        <div style={sub}>{t("settings.waShareHelp", "Customize the WhatsApp message sent to customers when you share an order. Applies on web and in the apps.")}</div>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 8 }}>
                                            <div><label style={L}>{t("settings.waHeader", "Greeting (first line)")}</label><input style={F} value={waHeader} onChange={(e) => setWaHeader(e.target.value.slice(0, 120))} placeholder={`${shop?.name || "Your Shop"} - Order Confirmed!`} /></div>
                                            <div><label style={L}>{t("settings.waFooter", "Closing line")}</label><input style={F} value={waFooter} onChange={(e) => setWaFooter(e.target.value.slice(0, 160))} placeholder={t("settings.waFooterPlaceholder", "Any questions? Reply to this message!")} /></div>
                                        </div>
                                        <SwitchRow title={t("settings.waShowItems", "Items list")} desc={t("settings.waShowItemsDesc", "Each service with quantity")} on={waShowItems} onChange={setWaShowItems} />
                                        <SwitchRow title={t("settings.waShowPayment", "Payment details")} desc={t("settings.waShowPaymentDesc", "Total, paid and balance due")} on={waShowPayment} onChange={setWaShowPayment} />
                                        <SwitchRow title={t("settings.waShowExpectedDate", "Expected date")} desc={t("settings.waShowExpectedDateDesc", "Ready / delivery date line")} on={waShowExpectedDate} onChange={setWaShowExpectedDate} />
                                        <SwitchRow title={t("settings.waShowReceiptLink", "Receipt link")} desc={t("settings.waShowReceiptLinkDesc", "Online receipt the customer can open")} on={waShowReceiptLink} onChange={setWaShowReceiptLink} />
                                        <SwitchRow title={t("settings.trackingEnabled", "Customer order tracking")} desc={t("settings.trackingEnabledDesc", "Off = no tracking links or QR codes anywhere — WhatsApp messages, printed receipts and PDF receipts")} on={trackingOn} onChange={setTrackingOn} last />
                                    </div>
                                </div>
                            )}

                            {/* ===== LANGUAGE ===== */}
                            {deskSection === "language" && (
                                <div style={inner}>
                                    <div style={sub}>{t("settings.languageDesc", "The app language on this device. Applies instantly.")}</div>
                                    <LLanguageSelector variant="list" />
                                </div>
                            )}

                            {/* ===== ACCOUNT ===== */}
                            {deskSection === "account" && (
                                <AccountSection />
                            )}

                            {/* ===== embedded full screens (they save on their own) ===== */}
                            {deskSection === "publicPage" && (hasFeature("publicOrderingPage") ? <PublicPageSettingsPage embedded onOpenOffers={() => selectDesk("offers")} /> : <UpgradeCard feature={t("settings.navPublicPage", "Public booking page")} onUpgrade={() => selectDesk("subscription")} />)}
                            {deskSection === "offers" && (hasFeature("offers") ? <OffersPage embedded /> : <UpgradeCard feature={t("settings.navOffers", "Offers")} onUpgrade={() => selectDesk(role === "admin" ? "subscription" : "offers")} />)}
                            {deskSection === "subscription" && <SubscriptionPage embedded />}
                            {deskSection === "apps" && <AppsPage embedded />}
                            {deskSection === "help" && <HelpPage embedded />}
                            </>
                            )}
                        </div>

                        {/* sticky save bar (sections that save with the button) */}
                        {isNative && (
                            <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 14, padding: "16px 26px", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderTop: "1px solid var(--ds-divider)", borderRadius: "0 0 14px 14px", marginBottom: 18, boxShadow: "0 -6px 16px rgba(16,24,40,.04)" }}>
                                <span style={{ fontSize: 14, color: dirty ? "var(--ds-text)" : "var(--ds-text-2)" }}>{dirty ? t("settings.unsaved", "You have unsaved changes") : t("settings.allSaved", "All changes saved")}</span>
                                <div style={{ flex: 1 }} />
                                <button onClick={discard} disabled={!dirty || saving || savingCountry} style={{ cursor: dirty ? "pointer" : "default", font: "inherit", fontSize: 15, fontWeight: 500, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 10, padding: "11px 26px", opacity: dirty ? 1 : 0.5 }}>{t("settings.discard", "Discard")}</button>
                                <button onClick={() => void doDeskSave()} disabled={!dirty || saving || savingCountry} style={{ cursor: dirty ? "pointer" : "default", font: "inherit", fontSize: 15, fontWeight: 600, color: "#fff", background: "var(--ds-blue)", border: 0, borderRadius: 10, padding: "12px 34px", opacity: dirty && !saving && !savingCountry ? 1 : 0.55 }}>{saving || savingCountry ? t("common.saving", "Saving…") : t("settings.saveChanges", "Save changes")}</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // MOBILE: render the owner app's SettingsScreen clone (the hub for every
    // section — the mobile bottom nav matches the app's five tabs).
    // The hub is the SETTINGS ROOT on mobile; ?section= opens that section as its
    // own screen (app model: Settings list → Business Settings screen).
    const mobileSection = searchParams.get("section");
    if (isMobile && !mobileSection) return <MobileSettings onEditProfile={() => navigate("/settings?section=business")} />;

    return (
        <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", background: "var(--c-bg)" }}>
            {/* header — on mobile this is the app's back-header for the open section */}
            <header
                style={{
                    flex: "none",
                    minHeight: 58,
                    background: "var(--c-surface)",
                    borderBottom: "1px solid var(--c-border)",
                    display: "flex",
                    alignItems: "center",
                    gap: isMobile ? 10 : 14,
                    padding: isMobile ? "0 12px" : "0 22px",
                }}
            >
                {isMobile && (
                    <button onClick={() => navigate("/settings")} aria-label="Back"
                        style={{ cursor: "pointer", flex: "none", width: 40, height: 40, borderRadius: 20, border: 0, background: "var(--c-surface-2)", color: "var(--c-text-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ChevronLeft size={24} />
                    </button>
                )}
                <div style={{ fontSize: isMobile ? 18 : 17, fontWeight: isMobile ? 700 : 600, letterSpacing: "-.01em" }}>{isMobile ? cur.label : "Settings"}</div>
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
                        // Mobile navigates from the Settings hub, so the rail is desktop-only.
                        display: isMobile ? "none" : "flex",
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

                    {/* secondary links — hidden in the mobile horizontal strip; reachable from elsewhere.
                        Billing is owner-only: managers share the dashboard but never see subscription pages. */}
                    {!isMobile && (
                        <>
                            {role === "admin" && (
                                <>
                                    <NavLinkRow icon={<CreditCard size={17} />} label="Subscription & billing" onClick={() => navigate("/settings/subscription")} />
                                    <NavLinkRow icon={<Receipt size={17} />} label="Payment history" onClick={() => navigate("/settings/payment-history")} />
                                </>
                            )}
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
                                            <button type="button" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}
                                                aria-label={t("settings.uploadLogo", "Upload logo")}
                                                title={t("settings.uploadLogo", "Upload logo")}
                                                style={{ position: "relative", width: 64, height: 64, flex: "none", padding: 0, border: 0, cursor: logoUploading ? "wait" : "pointer", background: "transparent" }}>
                                                <span style={{ display: "flex", width: "100%", height: "100%", borderRadius: 16, overflow: "hidden", background: "var(--c-primary)", color: "#fff", alignItems: "center", justifyContent: "center" }}>
                                                    {logoUploading
                                                        ? <Loader2 size={26} style={{ animation: "spin 1s linear infinite" }} />
                                                        : shop?.logo ? <img src={shop.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Store size={30} />}
                                                </span>
                                                <span style={{ position: "absolute", right: -6, bottom: -6, width: 26, height: 26, borderRadius: 13, background: "var(--c-primary)", color: "#fff", border: "2px solid var(--c-surface)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--sh-sm)" }}>
                                                    <Camera size={13} />
                                                </span>
                                                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                                            </button>
                                            <input ref={logoInputRef} type="file" accept="image/*" style={{ display: "none" }}
                                                onChange={(e) => { void handleLogoFile(e.target.files?.[0] || null); e.target.value = ""; }} />
                                            <Field label={t("shop.shopName", "Business name")}>
                                                <input style={fld} value={formShopName} onChange={(e) => setFormShopName(e.target.value)} />
                                            </Field>
                                        </div>

                                        <div style={cardTitle}><Phone size={16} style={{ color: "var(--c-primary)" }} />{t("shop.contactInfo", "Contact")}</div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                            <div>
                                                <label style={lbl}>{t("shop.phoneNumber", "Phone")}</label>
                                                {/* Locked field shows the number's OWN dial code — switching the shop country
                                                    must not re-prefix the registered phone into a number that doesn't exist. */}
                                                <LPhoneInput value={phone} onValueChange={setPhone} showClear={!isPhoneLocked} disabled={isPhoneLocked} countryCode={(isPhoneLocked && registeredDialCode) || phoneCountry.phoneCode} maxDigits={isPhoneLocked && phone ? phone.length : phoneCountry.phoneDigits} />
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
                                                <Field label={getStateLabel(selectedCountryCode)}><input style={fld} value={state} onChange={(e) => setState(e.target.value)} /></Field>
                                            </div>
                                            <Field label={phoneCountry.pinLabel}>
                                                {/* India PIN is 6 digits; UAE PO Box / other postal codes are alphanumeric — don't force digits-only for non-IN. */}
                                                <input style={fldMono} value={pincode} onChange={(e) => setPincode(selectedCountryCode === "IN" ? e.target.value.replace(/\D/g, "").slice(0, 6) : e.target.value.replace(/[^a-zA-Z0-9\s-]/g, "").slice(0, 12))} maxLength={12} />
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
                                        <Field label={t("shop.paymentLink", "Payment link (optional)")}><input style={fldMono} value={paymentLink} onChange={(e) => setPaymentLink(e.target.value)} placeholder="https://rzp.io/l/yourshop" /></Field>
                                        <ToggleRow
                                            label={t("settings.receiptPaymentQr", "Payment QR on receipts")}
                                            desc={t("settings.receiptPaymentQrDesc", "Bills with a balance due carry a scan-to-pay QR — your UPI ID (or payment link) with the amount pre-filled. A4 and 80mm.")}
                                            on={receiptPaymentQr} onChange={setReceiptPaymentQr}
                                        />
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

                                {/* Receipt Terms & Conditions — printed at the bottom of the customer's receipt */}
                                <div style={card}>
                                    <div style={cardTitle}><FileText size={16} style={{ color: "var(--c-cyan)" }} />{t("settings.receiptTerms", "Receipt terms & conditions")}</div>
                                    <p style={{ fontSize: 12.5, color: "var(--c-text-2)", margin: "0 0 12px", lineHeight: 1.5 }}>{t("settings.receiptTermsHelp", "Shown at the bottom of every receipt the customer receives (PDF, print and app). Leave blank to hide.")}</p>
                                    <div style={{ marginBottom: 12 }}>
                                        <ToggleRow
                                            label={t("settings.receiptShowLogo", "Shop logo on receipts")}
                                            desc={shop?.logo
                                                ? t("settings.receiptShowLogoDesc", "Print your logo at the top of every receipt (A4 and 80mm)")
                                                : t("settings.receiptShowLogoNoLogo", "Upload a logo in Business profile first — then it prints at the top of every receipt")}
                                            on={receiptShowLogo} onChange={setReceiptShowLogo}
                                        />
                                    </div>
                                    <textarea
                                        value={receiptTerms}
                                        onChange={(e) => setReceiptTerms(e.target.value.slice(0, 1000))}
                                        rows={5}
                                        maxLength={1000}
                                        placeholder={t("settings.receiptTermsPlaceholder", "e.g. Goods once delivered will not be taken back. Please collect within 30 days. Shop is not responsible for colour bleeding or shrinkage.")}
                                        style={{ ...fld, resize: "vertical", minHeight: 96, lineHeight: 1.5 }}
                                    />
                                    <div style={{ textAlign: "right", fontSize: 11, color: "var(--c-text-3)", marginTop: 6, fontFamily: MONO }}>{receiptTerms.length}/1000</div>
                                </div>

                                {/* Order numbering — continue billing from previous software */}
                                <div style={card}>
                                    <div style={cardTitle}><Hash size={16} style={{ color: "var(--c-violet)" }} />{t("settings.orderNumbering", "Order numbering")}</div>
                                    <p style={{ fontSize: 12.5, color: "var(--c-text-2)", margin: "0 0 12px", lineHeight: 1.5 }}>
                                        {t("settings.orderNumberingHelp", "Coming from another billing software? Set the next bill number to continue where it left off. The number can only be increased — lowering it would create duplicate order numbers.")}
                                    </p>
                                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                                        <div>
                                            <label style={FIELD_LBL}>{t("settings.nextOrderNumber", "Next order number")}</label>
                                            <input
                                                type="number"
                                                min={shop?.settings?.nextOrderNumber || 1}
                                                value={nextOrderNum}
                                                onChange={(e) => setNextOrderNum(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                                                style={{ ...fld, width: 160, fontFamily: MONO }}
                                            />
                                        </div>
                                        <div style={{ paddingTop: 18 }}>
                                            <span style={{ fontSize: 12.5, color: "var(--c-text-2)" }}>{t("settings.nextOrderPreview", "Next order will be")} </span>
                                            <span style={{ fontFamily: MONO, fontWeight: 700, color: "var(--c-primary)", background: "var(--c-primary-soft)", padding: "3px 9px", borderRadius: 6 }}>
                                                {formatOrderId(shop?.shopCode || "SHOP", Math.max(1, nextOrderNum || 1))}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* WhatsApp message & customer tracking — owner-customizable share message */}
                                <div style={card}>
                                    <div style={cardTitle}><MessageCircle size={16} style={{ color: "var(--c-success)" }} />{t("settings.waShareTitle", "WhatsApp message & tracking")}</div>
                                    <p style={{ fontSize: 12.5, color: "var(--c-text-2)", margin: "0 0 14px", lineHeight: 1.5 }}>
                                        {t("settings.waShareHelp", "Customize the WhatsApp message sent to customers when you share an order. Applies on web and in the apps.")}
                                    </p>
                                    <div style={{ display: "grid", gap: 12, marginBottom: 14 }}>
                                        <div>
                                            <label style={FIELD_LBL}>{t("settings.waHeader", "Greeting (first line)")}</label>
                                            <input
                                                value={waHeader}
                                                onChange={(e) => setWaHeader(e.target.value.slice(0, 120))}
                                                placeholder={`${shop?.name || "Your Shop"} - Order Confirmed!`}
                                                style={fld}
                                            />
                                        </div>
                                        <div>
                                            <label style={FIELD_LBL}>{t("settings.waFooter", "Closing line")}</label>
                                            <input
                                                value={waFooter}
                                                onChange={(e) => setWaFooter(e.target.value.slice(0, 160))}
                                                placeholder={t("settings.waFooterPlaceholder", "Any questions? Reply to this message!")}
                                                style={fld}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ display: "grid", gap: 4 }}>
                                        <ToggleRow label={t("settings.waShowItems", "Items list")} desc={t("settings.waShowItemsDesc", "Each service with quantity")} on={waShowItems} onChange={setWaShowItems} />
                                        <ToggleRow label={t("settings.waShowPayment", "Payment details")} desc={t("settings.waShowPaymentDesc", "Total, paid and balance due")} on={waShowPayment} onChange={setWaShowPayment} />
                                        <ToggleRow label={t("settings.waShowExpectedDate", "Expected date")} desc={t("settings.waShowExpectedDateDesc", "Ready / delivery date line")} on={waShowExpectedDate} onChange={setWaShowExpectedDate} />
                                        <ToggleRow label={t("settings.waShowReceiptLink", "Receipt link")} desc={t("settings.waShowReceiptLinkDesc", "Online receipt the customer can open")} on={waShowReceiptLink} onChange={setWaShowReceiptLink} />
                                        <ToggleRow
                                            label={t("settings.trackingEnabled", "Customer order tracking")}
                                            desc={t("settings.trackingEnabledDesc", "Off = no tracking links or QR codes anywhere — WhatsApp messages, printed receipts and PDF receipts")}
                                            on={trackingOn}
                                            onChange={setTrackingOn}
                                        />
                                    </div>
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

            {/* Currency-change guard: historical amounts are NOT converted — get explicit
                confirmation before relabelling existing orders under a new currency. */}
            <LConfirmDialog
                open={!!currencyWarn}
                onClose={() => setCurrencyWarn(null)}
                onConfirm={() => {
                    setCurrencyWarn(null);
                    void doSaveCountry();
                }}
                variant="destructive"
                title={t("settings.currencyChangeTitle", "Change currency?")}
                description={t("settings.currencyChangeWarn", {
                    from: currencyWarn?.from,
                    to: currencyWarn?.to,
                    defaultValue: `This shop already has orders recorded in ${currencyWarn?.from}. Amounts will NOT be converted — every past order and lifetime total will simply be shown in ${currencyWarn?.to}, which misstates your revenue history. Only continue if this shop really operates in ${currencyWarn?.to}.`,
                })}
                confirmText={t("settings.currencyChangeConfirm", "Change anyway")}
                cancelText={t("common.cancel", "Cancel")}
            />
        </div>
    );
}

type DeskSection = "business" | "tax" | "bank" | "operations" | "delivery" | "publicPage" | "offers" | "notifications" | "language" | "subscription" | "apps" | "help" | "account";
const DESK_SECTIONS: DeskSection[] = ["business", "tax", "bank", "operations", "delivery", "publicPage", "offers", "notifications", "language", "subscription", "apps", "help", "account"];

function UpgradeCard({ feature, onUpgrade }: { feature: string; onUpgrade: () => void }) {
    const { t } = useTranslation();
    return (
        <div style={{ padding: 48, textAlign: "center" }}>
            <span style={{ width: 60, height: 60, borderRadius: 16, background: "var(--ds-blue-soft)", color: "var(--ds-blue)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}><Crown size={28} /></span>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{feature}</div>
            <div style={{ fontSize: 14, color: "var(--ds-text-2)", marginTop: 6 }}>{t("settings.upgradeToUnlock", "Available on higher plans. Upgrade to unlock it.")}</div>
            <button onClick={onUpgrade} style={{ marginTop: 18, cursor: "pointer", font: "inherit", fontSize: 14.5, fontWeight: 600, color: "#fff", background: "var(--ds-blue)", border: 0, borderRadius: 10, padding: "11px 22px" }}>{t("settings.seePlans", "See plans")}</button>
        </div>
    );
}

/** Account: profile + signed-in devices (web + phone slots of the one-session-per-platform guard). */
function AccountSection() {
    const { t } = useTranslation();
    const { user, role, signOut } = useAuth();
    const { addToast } = useLToast();
    const navigate = useNavigate();
    const [slots, setSlots] = useState<{ web?: { claimedAt?: Date; userAgent?: string }; mobile?: { claimedAt?: Date; userAgent?: string; platform?: string; deviceName?: string } }>({});
    const [confirmOut, setConfirmOut] = useState<"mobile" | "all" | null>(null);
    const { data: support } = useSupportSettings();
    const { shop } = useShop();
    const [editOpen, setEditOpen] = useState(false);
    const [nameDraft, setNameDraft] = useState("");
    const [nameOverride, setNameOverride] = useState<string | null>(null);
    const [savingName, setSavingName] = useState(false);
    const [phoneMenu, setPhoneMenu] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const displayName = nameOverride ?? user?.displayName ?? "";
    const saveName = async () => {
        const name = nameDraft.trim();
        if (!name || !auth.currentUser) return;
        setSavingName(true);
        try {
            await updateProfile(auth.currentUser, { displayName: name });
            try { await setDoc(doc(db, "users", auth.currentUser.uid), { displayName: name }, { merge: true }); } catch { /* profile doc optional */ }
            setNameOverride(name);
            setEditOpen(false);
            addToast({ type: "success", title: t("settings.profileSaved", "Profile updated") });
        } catch (e) {
            console.error("update profile", e);
            addToast({ type: "error", title: t("settings.profileFailed", "Could not update your name") });
        } finally { setSavingName(false); }
    };
    // Deleting a shop is irreversible and there is no self-serve delete yet — the
    // request goes to support (email / WhatsApp) with the shop details prefilled.
    const deletionText = `Please delete my Laundrybill shop and account.\nShop: ${shop?.name || ""} (${shop?.shopCode || shop?.id || ""})\nAccount: ${user?.email || user?.phone || ""}`;
    const requestDeletion = () => {
        setDeleteOpen(false);
        setDeleteConfirmText("");
        const wa = (support.whatsappNumber || "").replace(/\D/g, "");
        if (support.supportEmail) window.location.href = `mailto:${support.supportEmail}?subject=${encodeURIComponent("Delete my shop and account")}&body=${encodeURIComponent(deletionText)}`;
        else if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent(deletionText)}`, "_blank");
        else { navigate("/help"); return; }
        addToast({ type: "success", title: t("settings.deletionRequested", "Deletion request opened"), description: t("settings.deletionRequestedDesc", "Send the message — support will confirm before anything is deleted.") });
    };
    const load = useCallback(async () => {
        if (!user?.uid) return;
        const read = async (id: string) => {
            try {
                const snap = await getDoc(doc(db, "users", user.uid, "sessions", id));
                if (!snap.exists()) return undefined;
                const d = snap.data() as { claimedAt?: { toDate?: () => Date }; userAgent?: string; platform?: string; deviceName?: string; sessionId?: string };
                if (!d.sessionId || String(d.sessionId).startsWith("revoked")) return undefined;
                return { claimedAt: d.claimedAt?.toDate?.(), userAgent: d.userAgent, platform: d.platform, deviceName: d.deviceName };
            } catch { return undefined; }
        };
        setSlots({ web: await read("web"), mobile: await read("mobile") });
    }, [user?.uid]);
    useEffect(() => { void load(); }, [load]);

    const browserLabel = (ua?: string) => {
        const u = ua || navigator.userAgent;
        const b = /Edg\//.test(u) ? "Edge" : /Chrome\//.test(u) ? "Chrome" : /Firefox\//.test(u) ? "Firefox" : /Safari\//.test(u) ? "Safari" : "Browser";
        const os = /Mac OS X/.test(u) ? "Mac" : /Windows/.test(u) ? "Windows" : /Android/.test(u) ? "Android" : /iPhone|iPad/.test(u) ? "iOS" : /Linux/.test(u) ? "Linux" : "";
        return os ? `${b} on ${os}` : b;
    };
    // Writing a different sessionId into the phone's slot makes the app's session
    // guard sign that phone out (same mechanism a newer login uses).
    const revokeMobile = async () => {
        if (!user?.uid) return;
        await setDoc(doc(db, "users", user.uid, "sessions", "mobile"), { sessionId: `revoked-${Date.now()}`, claimedAt: serverTimestamp() });
    };
    const run = async () => {
        const which = confirmOut;
        setConfirmOut(null);
        try {
            if (which === "mobile" || which === "all") await revokeMobile();
            if (which === "all") { await signOut(); return; }
            addToast({ type: "success", title: t("settings.phoneSignedOut", "The phone has been signed out") });
            void load();
        } catch (e) {
            console.error("sign out device", e);
            addToast({ type: "error", title: t("settings.signOutFailed", "Could not sign the device out") });
        }
    };

    const card: CSSProperties = { border: "1px solid var(--ds-border)", borderRadius: 12, padding: "20px 22px" };
    const initial = (user?.displayName || user?.email || "?").trim()[0]?.toUpperCase();
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ ...card, display: "flex", alignItems: "center", gap: 20 }}>
                <span style={{ width: 80, height: 80, flex: "none", borderRadius: "50%", overflow: "hidden", background: "#EDE9FE", color: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 600 }}>
                    {user?.photoURL ? <img src={user.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initial}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 20, fontWeight: 600 }}>{displayName || t("settings.owner", "Owner")}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ds-blue)", background: "var(--ds-blue-soft)", borderRadius: 20, padding: "2px 9px", textTransform: "capitalize" }}>{role === "admin" ? t("settings.owner", "Owner") : role}</span>
                    </div>
                    {user?.email && <div style={{ fontSize: 14.5, marginTop: 6 }}>{user.email}</div>}
                    {user?.phone && <div style={{ fontSize: 14.5, marginTop: 4 }}>{user.phone}</div>}
                </div>
                <button onClick={() => { setNameDraft(displayName); setEditOpen(true); }} style={{ cursor: "pointer", font: "inherit", fontSize: 15, fontWeight: 500, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 10, padding: "11px 22px" }}>{t("settings.editProfile", "Edit profile")}</button>
            </div>
            {editOpen && (
                <div style={{ ...card, display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 260px" }}>
                        <label style={{ display: "block", fontSize: 13.5, fontWeight: 500, marginBottom: 8 }}>{t("settings.yourName", "Your name")}</label>
                        <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void saveName(); }} style={{ width: "100%", font: "inherit", fontSize: 14.5, border: "1px solid var(--ds-border)", borderRadius: 10, padding: "11px 13px", outline: "none" }} />
                        <div style={{ fontSize: 12.5, color: "var(--ds-text-2)", marginTop: 6 }}>{t("settings.emailPhoneLocked", "Email and phone are your sign-in and can't be changed here.")}</div>
                    </div>
                    <button onClick={() => setEditOpen(false)} style={{ cursor: "pointer", font: "inherit", fontSize: 14.5, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 10, padding: "11px 18px", marginBottom: 24 }}>{t("common.cancel", "Cancel")}</button>
                    <button onClick={() => void saveName()} disabled={savingName || !nameDraft.trim()} style={{ cursor: "pointer", font: "inherit", fontSize: 14.5, fontWeight: 600, color: "#fff", background: "var(--ds-blue)", border: 0, borderRadius: 10, padding: "12px 22px", marginBottom: 24, opacity: savingName || !nameDraft.trim() ? 0.6 : 1 }}>{savingName ? t("common.saving", "Saving…") : t("common.save", "Save")}</button>
                </div>
            )}

            <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{t("settings.signedInDevices", "Signed-in devices")}</span>
                    <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--ds-text-2)" }}><ShieldCheck size={16} />{t("settings.onePerPlatform", "One phone and one browser per login")}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--ds-text-2)", margin: "4px 0 14px" }}>{t("settings.devicesDesc", "A new sign-in on another phone or browser signs the older one out.")}</div>
                <div style={{ border: "1px solid var(--ds-border)", borderRadius: 11 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px" }}>
                        <Laptop size={24} style={{ color: "var(--ds-blue)" }} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 500 }}>{t("settings.thisBrowser", "This browser")} <span style={{ marginLeft: 6, fontSize: 12, padding: "2px 8px", borderRadius: 6, background: "var(--ds-table-head)", border: "1px solid var(--ds-border)" }}>{t("settings.current", "Current")}</span></div>
                            <div style={{ fontSize: 13, color: "var(--ds-text-2)", marginTop: 3 }}>{browserLabel(slots.web?.userAgent)}</div>
                        </div>
                        <span style={{ fontSize: 12.5, padding: "3px 9px", borderRadius: 6, background: "#DCFCE7", color: "#15803D" }}>{t("settings.active", "Active")}</span>
                        {slots.web?.claimedAt && <span style={{ fontSize: 13, color: "var(--ds-text-2)", minWidth: 190 }}>{t("settings.since", "Since")} {format(slots.web.claimedAt, "d MMM yyyy, h:mm a")}</span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px", borderTop: "1px solid var(--ds-divider)" }}>
                        <Smartphone size={24} style={{ color: "var(--ds-blue)" }} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 500 }}>{slots.mobile?.deviceName || t("settings.phone", "Phone")}</div>
                            <div style={{ fontSize: 13, color: "var(--ds-text-2)", marginTop: 3 }}>{slots.mobile ? `${t("settings.ownerApp", "Laundry Bill app")}${slots.mobile.platform && slots.mobile.platform !== "mobile" ? ` · ${slots.mobile.platform}` : ""}` : t("settings.noPhone", "Not signed in on a phone")}</div>
                        </div>
                        {slots.mobile && <span style={{ fontSize: 12.5, padding: "3px 9px", borderRadius: 6, background: "#DCFCE7", color: "#15803D" }}>{t("settings.active", "Active")}</span>}
                        {slots.mobile?.claimedAt && <span style={{ fontSize: 13, color: "var(--ds-text-2)", minWidth: 190 }}>{t("settings.since", "Since")} {format(slots.mobile.claimedAt, "d MMM yyyy, h:mm a")}</span>}
                        {slots.mobile && (
                            <span style={{ position: "relative" }}>
                                <button onClick={() => setPhoneMenu((v) => !v)} aria-label={t("common.more", "More")} style={{ cursor: "pointer", width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text)", background: "transparent", border: 0 }}><MoreVertical size={18} /></button>
                                {phoneMenu && (
                                    <div onMouseLeave={() => setPhoneMenu(false)} style={{ position: "absolute", right: 0, top: "100%", zIndex: 20, minWidth: 190, background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 11, boxShadow: "0 12px 32px rgba(16,24,40,.14)", padding: 6 }}>
                                        <button onClick={() => { setPhoneMenu(false); setConfirmOut("mobile"); }} style={{ width: "100%", cursor: "pointer", font: "inherit", display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: "var(--ds-negative)", background: "transparent", border: 0, borderRadius: 8, padding: "9px 10px", textAlign: "left" }}><LogOut size={15} />{t("settings.signOutThisPhone", "Sign out this phone")}</button>
                                    </div>
                                )}
                            </span>
                        )}
                    </div>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                    <button onClick={() => void signOut()} style={{ cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 9, fontSize: 14.5, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 10, padding: "10px 18px" }}><LogOut size={17} />{t("auth.signOut", "Sign out")}</button>
                    <button onClick={() => setConfirmOut("all")} style={{ marginLeft: "auto", cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 9, fontSize: 14.5, color: "var(--ds-negative)", background: "var(--ds-card)", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 18px" }}><LogOut size={17} />{t("settings.signOutAll", "Sign out of all devices")}</button>
                </div>
            </div>

            <div style={{ ...card, border: "1px solid #FECACA", background: "#FFFBFB", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 320px" }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#DC2626" }}>{t("settings.deleteTitle", "Delete shop and account")}</div>
                    <div style={{ fontSize: 13.5, color: "var(--ds-text-2)", marginTop: 5 }}>{t("settings.deleteDesc", "Permanently deletes your shop, all data, orders and customers. This cannot be undone. Support processes the request after confirming it's you.")}</div>
                </div>
                <button onClick={() => setDeleteOpen(true)} disabled={role !== "admin"} title={role !== "admin" ? t("settings.ownerOnly", "Only the shop owner can do this") : undefined} style={{ cursor: role === "admin" ? "pointer" : "not-allowed", font: "inherit", display: "inline-flex", alignItems: "center", gap: 9, fontSize: 14.5, fontWeight: 500, color: "#DC2626", background: "var(--ds-card)", border: "1px solid #FCA5A5", borderRadius: 10, padding: "11px 20px", opacity: role === "admin" ? 1 : 0.5 }}><Trash2 size={17} />{t("settings.deleteTitle", "Delete shop and account")}</button>
            </div>

            {deleteOpen && (
                <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setDeleteOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(17,24,39,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                    <div style={{ width: "100%", maxWidth: 460, background: "var(--ds-card)", borderRadius: 16, padding: 24, boxShadow: "0 24px 64px rgba(16,24,40,.24)" }}>
                        <div style={{ fontSize: 18, fontWeight: 600, color: "#DC2626" }}>{t("settings.deleteConfirmTitle", "Delete {{shop}}?", { shop: shop?.name || t("settings.yourShop", "your shop") })}</div>
                        <div style={{ fontSize: 14, color: "var(--ds-text-2)", marginTop: 8, lineHeight: 1.55 }}>{t("settings.deleteConfirmDesc", "This sends a deletion request to Laundrybill support. Once processed, every order, customer, staff record and payment for this shop is gone for good. Cancel your subscription first if you have one.")}</div>
                        <label style={{ display: "block", fontSize: 13.5, fontWeight: 500, marginTop: 16, marginBottom: 8 }}>{t("settings.typeDelete", "Type DELETE to confirm")}</label>
                        <input autoFocus value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} style={{ width: "100%", font: "inherit", fontSize: 14.5, border: "1px solid var(--ds-border)", borderRadius: 10, padding: "11px 13px", outline: "none" }} />
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                            <button onClick={() => { setDeleteOpen(false); setDeleteConfirmText(""); }} style={{ cursor: "pointer", font: "inherit", fontSize: 14.5, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 10, padding: "10px 18px" }}>{t("common.cancel", "Cancel")}</button>
                            <button onClick={requestDeletion} disabled={deleteConfirmText.trim().toUpperCase() !== "DELETE"} style={{ cursor: deleteConfirmText.trim().toUpperCase() === "DELETE" ? "pointer" : "not-allowed", font: "inherit", fontSize: 14.5, fontWeight: 600, color: "#fff", background: "#DC2626", border: 0, borderRadius: 10, padding: "10px 18px", opacity: deleteConfirmText.trim().toUpperCase() === "DELETE" ? 1 : 0.5 }}>{t("settings.sendDeletion", "Send deletion request")}</button>
                        </div>
                    </div>
                </div>
            )}

            <LConfirmDialog
                open={!!confirmOut}
                onClose={() => setConfirmOut(null)}
                onConfirm={() => void run()}
                variant="destructive"
                title={confirmOut === "all" ? t("settings.signOutAllTitle", "Sign out of all devices?") : t("settings.signOutPhoneTitle", "Sign out the phone?")}
                description={confirmOut === "all" ? t("settings.signOutAllDesc", "Your phone and this browser will be signed out. You'll need to sign in again.") : t("settings.signOutPhoneDesc", "The Laundry Bill app on your phone will be signed out.")}
                confirmText={t("auth.signOut", "Sign out")}
            />
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
