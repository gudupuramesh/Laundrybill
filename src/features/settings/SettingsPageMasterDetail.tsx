/**
 * Settings Page with Master-Detail Layout
 * 
 * Desktop: Left panel (settings nav) + Right panel (selected section details)
 * Mobile: Single column navigation to separate pages
 * 
 * Consolidated sections:
 * - Shop Info: Name, Logo, Contact, Location
 * - Financials: Business Details (GST/PAN) + Bank Details
 * - Preferences: Theme, Notifications
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageWrapper } from "@/components/PageWrapper";
import {
    LCard,
    LList,
    LListItem,
    LToggle,
    LDivider,
    LTextInput,
    LPhoneInput,
    LButton,
    useLToast,
    LLanguageSelector,
    LLocationMap,
} from "@/components/laundry";
import { useAuth } from "@/features/auth/AuthContext";
import { useCurrency } from "@/hooks/use-currency";
import { useShop, useShopMutations } from "@/hooks/use-shop";
import { COUNTRIES, getCountry } from "@/config/countries";
import { reverseGeocode } from "@/lib/geocoding";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import {
    User,
    Bell,
    Palette,
    HelpCircle,
    LogOut,
    Store,
    MapPin,
    FileText,
    Building2,
    Phone,
    Camera,
    Copy,
    Globe,
    CreditCard,
    Receipt,
    Truck,
} from "lucide-react";
import {
    cn,
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

type SettingsSection = "shopInfo" | "financials" | "preferences";

interface SettingsNavItem {
    id: SettingsSection;
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    /** Only show for specific plan (e.g. publicOrderingPage) */
    feature?: string;
}

// Remove static array outside component
export function SettingsPageMasterDetail() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Define nav items inside component to use translations
    const settingsNavItems: SettingsNavItem[] = [
        { id: "shopInfo", icon: <Store className="h-5 w-5" />, title: t('settings.shopInfo', 'Shop Info'), subtitle: t('settings.shopInfoDesc', 'Name, contact, location') },
        { id: "financials", icon: <FileText className="h-5 w-5" />, title: t('settings.financials', 'Financials'), subtitle: t('settings.financialsDesc', 'GST, PAN, Bank details') },
        { id: "preferences", icon: <Palette className="h-5 w-5" />, title: t('settings.preferences', 'Preferences'), subtitle: t('settings.preferencesDesc', 'Theme, Notifications') },
    ];

    const isMobile = useIsMobile();
    const { addToast } = useLToast();
    const { currencySymbol } = useCurrency();
    const { user, role, shopName, signOut } = useAuth();
    const { shop, loading } = useShop();
    const { updateShop, updateLocation, updateBankDetails, updateGST, updateTaxSettings, updateDeliverySettings, updateCountrySettings } = useShopMutations();

    // Determine if phone/email are locked (from shop doc or auth user)
    const isPhoneLocked = !!(shop?.phone || user?.phone);
    const isEmailLocked = !!(shop?.email || user?.email);

    const [selectedSection, setSelectedSection] = useState<SettingsSection>("shopInfo");
    const [mobileShowDetail, setMobileShowDetail] = useState(false);

    // Sync section from URL (?section=...) or redirect legacy publicPage link to standalone page
    useEffect(() => {
        const section = searchParams.get("section");
        if (section === "publicPage") {
            navigate("/settings/public-page", { replace: true });
            return;
        }
        if (section && ["shopInfo", "financials", "preferences"].includes(section)) {
            setSelectedSection(section as SettingsSection);
            if (isMobile) setMobileShowDetail(true);
        }
    }, [searchParams, isMobile, navigate]);

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

    // Delivery fee (for home delivery & pickup_home; applies when order below min)
    const [deliveryFeeEnabled, setDeliveryFeeEnabled] = useState(true);
    const [deliveryFeeMinOrder, setDeliveryFeeMinOrder] = useState(300);
    const [deliveryFeeAmount, setDeliveryFeeAmount] = useState(50);

    const [darkMode, setDarkMode] = useState(false);
    const [notifications, setNotifications] = useState(true);
    const [saving, setSaving] = useState(false);
    const [initialized, setInitialized] = useState(false);

    // Country & Currency settings
    const [selectedCountryCode, setSelectedCountryCode] = useState(shop?.settings?.countryCode || "IN");
    const [savingCountry, setSavingCountry] = useState(false);

    // Load shop data - Only once
    useEffect(() => {
        if (shop && !initialized) {
            setFormShopName(shop.name || "");
            // Get phone from shop or auth user (fallback for OTP registration)
            const rawPhone = shop.phone || user?.phone || "";
            // Clean phone: remove +91 prefix, keep last 10 digits
            setPhone(rawPhone.replace(/^\+?91/, "").replace(/\D/g, "").slice(-10));
            // Get email from shop or auth user (fallback for Google sign-in)
            setEmail(shop.email || user?.email || "");
            // WhatsApp defaults to registered phone; user can change it later
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
            }
            // Country setting
            setSelectedCountryCode(shop.settings?.countryCode || "IN");

            setInitialized(true);
        }
    }, [shop, initialized]);

    // Save country & currency settings
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

    // Get current location and reverse geocode
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

    // Save all shop info
    const handleSaveShopInfo = async () => {
        // Validate phone
        if (phone && !isValidIndianPhone(phone)) {
            addToast({ type: "error", title: t("validation.invalidPhone"), description: t('validation.phoneDesc', "Phone must be 10 digits starting with 6-9") });
            return;
        }
        if (whatsappNumber && !isValidIndianPhone(whatsappNumber)) {
            addToast({ type: "error", title: t("validation.invalidPhone"), description: t('validation.phoneDesc', "WhatsApp number must be 10 digits starting with 6-9") });
            return;
        }
        // Validate email
        if (email && !isValidEmail(email)) {
            addToast({ type: "error", title: t("validation.invalidEmail"), description: t('validation.emailDesc', "Please enter a valid email address") });
            return;
        }

        setSaving(true);
        try {
            await updateShop({
                name: toTitleCase(formShopName),
                // Only update phone if not locked (first save only)
                ...(isPhoneLocked ? {} : { phone: phone ? normalizePhone(phone) : "" }),
                // Only update email if not locked (first save only)
                ...(isEmailLocked ? {} : { email: email ? normalizeEmail(email) : "" }),
                whatsappNumber: whatsappNumber ? normalizePhone(whatsappNumber) : ""
            });
            await updateLocation({
                address: toTitleCase(address),
                city: toTitleCase(city),
                state: toTitleCase(state),
                pincode,
                latitude,
                longitude
            });
            addToast({ type: "success", title: t("shop.settingsSaved") });
        } catch {
            addToast({ type: "error", title: t("shop.saveError") });
        } finally {
            setSaving(false);
        }
    };

    // Save financials
    const handleSaveFinancials = async () => {
        // Validate PAN
        if (panNumber && !isValidPAN(panNumber)) {
            addToast({ type: "error", title: t("validation.invalidPAN"), description: t('validation.panDesc', "PAN must be 10 characters (e.g., ABCDE1234F)") });
            return;
        }
        // Validate GST
        if (gstNumber && !isValidGST(gstNumber)) {
            addToast({ type: "error", title: t("validation.invalidGST"), description: t('validation.gstDesc', "GST must be 15 characters (e.g., 29ABCDE1234F1Z5)") });
            return;
        }
        // Validate IFSC
        if (ifscCode && !isValidIFSC(ifscCode)) {
            addToast({ type: "error", title: t("validation.invalidIFSC"), description: t('validation.ifscDesc', "IFSC must be 11 characters (e.g., SBIN0001234)") });
            return;
        }
        // Validate UPI
        if (upiId && !isValidUPI(upiId)) {
            addToast({ type: "error", title: t("validation.invalidUPI"), description: t('validation.upiDesc', "UPI ID must contain @ (e.g., name@upi)") });
            return;
        }
        // Validate account number
        if (accountNumber && !isValidAccountNumber(accountNumber)) {
            addToast({ type: "error", title: t("validation.invalidAccount"), description: t('validation.accountDesc', "Account number must be 8-18 digits") });
            return;
        }

        setSaving(true);
        try {
            await updateGST(
                gstNumber ? normalizeGST(gstNumber) : "",
                panNumber ? normalizePAN(panNumber) : ""
            );
            await updateBankDetails({
                accountNumber: accountNumber ? normalizeAccountNumber(accountNumber) : "",
                ifscCode: ifscCode ? normalizeIFSC(ifscCode) : "",
                bankName: toTitleCase(bankName),
                accountHolderName: toTitleCase(accountHolderName),
                upiId: upiId ? normalizeUPI(upiId) : ""
            });
            await updateTaxSettings(taxEnabled, taxName, taxRate);
            await updateDeliverySettings({
                deliveryFeeEnabled: deliveryFeeEnabled,
                deliveryFeeMinOrder: deliveryFeeMinOrder,
                deliveryFeeAmount: deliveryFeeAmount,
                defaultCharge: deliveryFeeAmount,
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

    // Copy location link
    const copyLocationLink = async () => {
        if (!latitude || !longitude) return;
        await navigator.clipboard.writeText(`https://maps.google.com/?q=${latitude},${longitude}`);
        addToast({ type: "success", title: t("shop.locationCopied") });
    };

    // Handle nav item click
    const handleNavItemClick = (section: SettingsSection) => {
        setSelectedSection(section);
        if (isMobile) {
            setMobileShowDetail(true);
        }
    };

    // Handle mobile back button
    const handleMobileBack = () => {
        setMobileShowDetail(false);
    };

    // Left Panel - Navigation
    const LeftPanel = () => (
        <div className="h-full overflow-y-auto">
            {/* Profile Header */}
            <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary-muted flex items-center justify-center">
                        {user?.photoURL ? (
                            <img src={user.photoURL} alt="Profile" className="w-12 h-12 rounded-full" />
                        ) : (
                            <User className="h-6 w-6 text-primary" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{shopName || user?.displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">{user?.email || user?.phone}</p>
                        <p className="text-xs text-primary capitalize">{role}</p>
                    </div>
                </div>
            </div>

            {/* Settings Nav */}
            <div className="p-2 space-y-1">
                {/* Settings Menu Card */}
                <LCard variant="outlined" className="p-0 overflow-hidden">
                    {settingsNavItems.map((item, index) => (
                        <div key={item.id}>
                            <button
                                onClick={() => handleNavItemClick(item.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 p-4 transition-colors text-left",
                                    selectedSection === item.id && !isMobile
                                        ? "bg-primary-muted border-l-4 border-l-primary"
                                        : "hover:bg-muted"
                                )}
                            >
                                <div className={cn(
                                    "text-muted-foreground",
                                    selectedSection === item.id && !isMobile && "text-primary"
                                )}>
                                    {item.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-foreground text-sm">{item.title}</p>
                                    {item.subtitle && (
                                        <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                                    )}
                                </div>
                                {isMobile && (
                                    <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                )}
                            </button>
                            {index < settingsNavItems.length - 1 && <LDivider />}
                        </div>
                    ))}
                </LCard>

                <div className="h-2" />

                {/* Subscription & Payment History */}
                <LCard variant="outlined" className="p-0 overflow-hidden">
                    <button
                        onClick={() => navigate("/settings/subscription")}
                        className="w-full flex items-center gap-3 p-4 transition-colors text-left hover:bg-muted border-b border-border"
                    >
                        <CreditCard className="h-5 w-5 text-primary" />
                        <div className="flex-1 min-w-0 text-left">
                            <p className="font-medium text-foreground text-sm">{t("settings.subscription", "Subscription & Billing")}</p>
                            <p className="text-xs text-muted-foreground truncate">{t("settings.subscriptionDesc", "Manage plan, view usage")}</p>
                        </div>
                        <svg className="h-4 w-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                    <button
                        onClick={() => navigate("/settings/payment-history")}
                        className="w-full flex items-center gap-3 p-4 transition-colors text-left hover:bg-muted"
                    >
                        <Receipt className="h-5 w-5 text-primary" />
                        <div className="flex-1 min-w-0 text-left">
                            <p className="font-medium text-foreground text-sm">{t("settings.paymentHistory", "Payment History")}</p>
                            <p className="text-xs text-muted-foreground truncate">{t("settings.paymentHistoryDesc", "Subscription and renewal payments")}</p>
                        </div>
                        <svg className="h-4 w-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </LCard>

                <div className="h-2" />

                {/* Help Card - navigates to standalone Help page */}
                <LCard variant="outlined" className="p-0 overflow-hidden">
                    <button
                        onClick={() => navigate("/help")}
                        className="w-full flex items-center gap-3 p-4 transition-colors text-left hover:bg-muted"
                    >
                        <HelpCircle className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium text-foreground text-sm">{t("settings.helpSupport")}</span>
                        <svg className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </LCard>

                <div className="h-2" />

                {/* Sign Out Card */}
                <LCard variant="outlined" className="p-0 overflow-hidden">
                    <button
                        onClick={signOut}
                        className="w-full flex items-center gap-3 p-4 transition-colors text-left hover:bg-destructive/10"
                    >
                        <LogOut className="h-5 w-5 text-destructive" />
                        <span className="font-medium text-destructive text-sm">{t("auth.signOut")}</span>
                    </button>
                </LCard>
            </div>
        </div>
    );

    // Right Panel - Detail Content
    const RightPanel = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
            );
        }

        return (
            <div className="p-6 overflow-y-auto h-full">
                <div className="max-w-xl space-y-6">
                    {/* Shop Info - Combined: Name, Logo, Contact, Location */}
                    {selectedSection === "shopInfo" && (
                        <>
                            {/* Logo & Name */}
                            <div>
                                <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                                    <Store className="h-5 w-5 text-primary" />
                                    {t("settings.shopSettings")}
                                </h2>
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        {shop?.logo ? (
                                            <img src={shop.logo} alt={formShopName} className="w-20 h-20 rounded-xl object-cover" />
                                        ) : (
                                            <div className="w-20 h-20 rounded-xl bg-primary-muted flex items-center justify-center">
                                                <Store className="h-10 w-10 text-primary" />
                                            </div>
                                        )}
                                        <button className="absolute -bottom-2 -right-2 p-2 bg-primary text-white rounded-full shadow-lg">
                                            <Camera className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="flex-1">
                                        <LTextInput
                                            label={t("shop.shopName")}
                                            value={formShopName}
                                            onChange={(e) => setFormShopName(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <LDivider />

                            {/* Contact Info */}
                            <div>
                                <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-primary" />
                                    {t("shop.contactInfo")}
                                </h3>
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <LPhoneInput
                                            label={t("shop.phoneNumber")}
                                            value={phone}
                                            onValueChange={setPhone}
                                            showClear={!isPhoneLocked}
                                            disabled={isPhoneLocked}
                                            className={isPhoneLocked ? "opacity-70 bg-muted" : ""}
                                        />
                                        {isPhoneLocked && (
                                            <p className="text-[10px] text-muted-foreground">{t("shop.phoneImmutable", "Registered phone cannot be changed")}</p>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <LPhoneInput label={t("shop.whatsappNumber")} value={whatsappNumber} onValueChange={setWhatsappNumber} showClear />
                                        <p className="text-[10px] text-muted-foreground px-1">{t("shop.whatsappNumberHint", "Defaults to your registered phone. You can update it anytime.")}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <LTextInput
                                            label={t("shop.email")}
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            disabled={isEmailLocked}
                                            className={isEmailLocked ? "opacity-70 bg-muted" : ""}
                                        />
                                        {isEmailLocked && (
                                            <p className="text-[10px] text-muted-foreground">{t("shop.emailImmutable", "Registered email cannot be changed")}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <LDivider />

                            {/* Location */}
                            <div>
                                <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-primary" />
                                    {t("shop.location")}
                                </h3>
                                <div className="space-y-3">
                                    <LLocationMap
                                        latitude={latitude}
                                        longitude={longitude}
                                        onLocationChange={handleMapLocationChange}
                                        onGetLocation={getCurrentLocation}
                                        gettingLocation={gettingLocation}
                                        className="mb-3"
                                    />
                                    <LTextInput label={t("shop.address")} value={address} onChange={(e) => setAddress(e.target.value)} />
                                    <div className="grid grid-cols-2 gap-3">
                                        <LTextInput label={t("shop.city")} value={city} onChange={(e) => setCity(e.target.value)} />
                                        <LTextInput label={t("shop.state")} value={state} onChange={(e) => setState(e.target.value)} />
                                    </div>
                                    <LTextInput label={t("shop.pincode")} value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} />

                                    {/* GPS (map has Get Location button) */}
                                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                                        <div>
                                            <p className="text-sm font-medium">{t("shop.gpsLocation")}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {latitude && longitude ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` : t("shop.noLocationCaptured")}
                                            </p>
                                        </div>
                                        {latitude && longitude && (
                                            <LButton variant="ghost" size="sm" onClick={copyLocationLink} leftIcon={<Copy className="h-4 w-4" />}>
                                                {t("common.copy")}
                                            </LButton>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <LButton variant="primary" onClick={handleSaveShopInfo} loading={saving} fullWidth>
                                {t("shop.saveSettings")}
                            </LButton>
                        </>
                    )}

                    {/* Financials - Combined: GST/PAN + Bank Details */}
                    {selectedSection === "financials" && (
                        <>
                            {/* Business Details */}
                            <div>
                                <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-primary" />
                                    {t("shop.businessDetails")}
                                </h2>
                                <div className="space-y-3">
                                    <LTextInput label={t("shop.gstNumber")} value={gstNumber} onChange={(e) => setGstNumber(e.target.value.toUpperCase())} maxLength={15} placeholder="22AAAAA0000A1Z5" />
                                    <LTextInput label={t("shop.panNumber")} value={panNumber} onChange={(e) => setPanNumber(e.target.value.toUpperCase())} maxLength={10} placeholder="AAAAA0000A" />
                                </div>
                            </div>

                            <LDivider />

                            {/* Tax Settings */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                                        <span className="text-xl">﹪</span>
                                        {t("shop.taxSettings", "Tax Settings")}
                                    </h2>
                                    <LToggle
                                        checked={taxEnabled}
                                        onChange={setTaxEnabled}
                                    />
                                </div>

                                {taxEnabled && (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <LTextInput
                                                label={t("shop.taxName", "Tax Name")}
                                                value={taxName}
                                                onChange={(e) => setTaxName(e.target.value)}
                                                placeholder="GST"
                                            />
                                            <LTextInput
                                                label={t("shop.taxRate", "Tax Rate (%)")}
                                                value={taxRate.toString()}
                                                onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                                                placeholder="18"
                                                inputMode="numeric"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <LDivider />

                            {/* Delivery Fee (home delivery & pickup_home only) */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                                        <Truck className="h-5 w-5 text-primary" />
                                        {t("settings.deliveryFee", "Delivery Fee")}
                                    </h2>
                                    <LToggle
                                        checked={deliveryFeeEnabled}
                                        onChange={setDeliveryFeeEnabled}
                                    />
                                </div>
                                <p className="text-sm text-muted-foreground mb-3">
                                    {t("settings.deliveryFeeHelp", "Applies to Home Delivery and Pickup & Delivery when order is below minimum. Not applied to Shop Pickup.")}
                                </p>
                                {deliveryFeeEnabled && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <LTextInput
                                            label={`${t("settings.deliveryFeeMinOrder", "Min order for free delivery")} (${currencySymbol})`}
                                            value={deliveryFeeMinOrder.toString()}
                                            onChange={(e) => setDeliveryFeeMinOrder(Number(e.target.value) || 0)}
                                            inputMode="numeric"
                                            placeholder="300"
                                        />
                                        <LTextInput
                                            label={`${t("settings.deliveryFeeAmount", "Delivery fee when below min")} (${currencySymbol})`}
                                            value={deliveryFeeAmount.toString()}
                                            onChange={(e) => setDeliveryFeeAmount(Number(e.target.value) || 0)}
                                            inputMode="numeric"
                                            placeholder="50"
                                        />
                                    </div>
                                )}
                            </div>

                            <LDivider />

                            {/* Bank Details */}
                            <div>
                                <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-primary" />
                                    {t("shop.bankDetails")}
                                </h3>
                                <div className="space-y-3">
                                    <LTextInput label={t("shop.accountHolderName")} value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} />
                                    <LTextInput label={t("shop.accountNumber")} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))} />
                                    <div className="grid grid-cols-2 gap-3">
                                        <LTextInput label={t("shop.ifscCode")} value={ifscCode} onChange={(e) => setIfscCode(e.target.value.toUpperCase())} maxLength={11} />
                                        <LTextInput label={t("shop.bankName")} value={bankName} onChange={(e) => setBankName(e.target.value)} />
                                    </div>
                                    <LTextInput label={t("shop.upiId")} value={upiId} onChange={(e) => setUpiId(e.target.value.toLowerCase())} placeholder="shop@upi" />
                                </div>
                            </div>

                            <LButton variant="primary" onClick={handleSaveFinancials} loading={saving} fullWidth>
                                {t("shop.saveSettings")}
                            </LButton>
                        </>
                    )}

                    {/* Preferences */}
                    {selectedSection === "preferences" && (
                        <>
                            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                                <Palette className="h-5 w-5 text-primary" />
                                {t("settings.title")}
                            </h2>

                            {/* Language Selection */}
                            <LCard variant="outlined" className="p-4 mb-4">
                                <div className="flex items-center gap-3 mb-4">
                                    <Globe className="h-5 w-5 text-primary" />
                                    <h3 className="font-semibold text-foreground">{t("settings.language")}</h3>
                                </div>
                                <LLanguageSelector variant="list" />
                            </LCard>

                            {/* Country & Currency */}
                            <LCard variant="outlined" className="p-4 mb-4">
                                <div className="flex items-center gap-3 mb-4">
                                    <CreditCard className="h-5 w-5 text-primary" />
                                    <h3 className="font-semibold text-foreground">{t("settings.countryCurrency", "Country & Currency")}</h3>
                                </div>

                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-muted-foreground">{t("shop.country", "Country")}</label>
                                        <select
                                            value={selectedCountryCode}
                                            onChange={(e) => setSelectedCountryCode(e.target.value)}
                                            className="w-full h-12 px-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        >
                                            {COUNTRIES.map((c) => (
                                                <option key={c.code} value={c.code}>
                                                    {c.name} ({c.currencySymbol} {c.currencyCode})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Preview */}
                                    {(() => {
                                        const preview = getCountry(selectedCountryCode);
                                        return (
                                            <div className="bg-muted rounded-xl p-3 space-y-1 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">{t("settings.currency", "Currency")}</span>
                                                    <span className="font-medium">{preview.currencySymbol} {preview.currencyCode}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">{t("settings.phoneCode", "Phone Code")}</span>
                                                    <span className="font-medium">{preview.phoneCode}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">{t("settings.timezone", "Timezone")}</span>
                                                    <span className="font-medium">{preview.timezone}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">{t("settings.taxLabel", "Default Tax")}</span>
                                                    <span className="font-medium">{preview.taxName}</span>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Show save button only if changed */}
                                    {selectedCountryCode !== (shop?.settings?.countryCode || "IN") && (
                                        <LButton
                                            variant="primary"
                                            fullWidth
                                            onClick={handleSaveCountry}
                                            loading={savingCountry}
                                        >
                                            {t("settings.updateCountry", "Update Country & Currency")}
                                        </LButton>
                                    )}
                                </div>
                            </LCard>

                            {/* Other Preferences */}
                            <LCard variant="outlined" className="p-0">
                                <LList dividers={false}>
                                    <LListItem
                                        title={t("settings.darkMode")}
                                        leftContent={<Palette className="h-5 w-5 text-muted-foreground" />}
                                        rightContent={<LToggle checked={darkMode} onChange={setDarkMode} />}
                                    />
                                    <LDivider className="ml-12" />
                                    <LListItem
                                        title={t("settings.notifications")}
                                        leftContent={<Bell className="h-5 w-5 text-muted-foreground" />}
                                        rightContent={<LToggle checked={notifications} onChange={setNotifications} />}
                                    />
                                </LList>
                            </LCard>
                        </>
                    )}

                </div>
            </div>
        );
    };

    // Mobile view: Show nav list OR detail based on state
    if (isMobile) {
        if (mobileShowDetail) {
            // Mobile Detail View
            return (
                <PageWrapper>
                    <div className="flex items-center gap-2 mb-4">
                        <button
                            onClick={handleMobileBack}
                            className="p-2 -ml-2 rounded-lg hover:bg-muted"
                        >
                            <svg className="h-5 w-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <h1 className="text-xl font-bold text-foreground">
                            {settingsNavItems.find(item => item.id === selectedSection)?.title}
                        </h1>
                    </div>
                    {RightPanel()}
                </PageWrapper>
            );
        }

        // Mobile Nav View
        return (
            <PageWrapper>
                {LeftPanel()}
            </PageWrapper>
        );
    }

    // Desktop: Master-Detail Layout
    return (
        <div className="flex h-[calc(100vh-64px)]">
            {/* Left Panel - Nav */}
            <div className="w-[320px] flex-shrink-0 border-r border-border bg-card overflow-hidden">
                {LeftPanel()}
            </div>

            {/* Right Panel - Detail */}
            <div className="flex-1 bg-background overflow-hidden">
                {RightPanel()}
            </div>
        </div>
    );
}
