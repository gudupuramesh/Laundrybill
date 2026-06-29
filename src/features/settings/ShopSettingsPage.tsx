/**
 * Shop Settings Page
 * 
 * Comprehensive shop settings with logo, contact, location, GST, and bank details
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    LCard,
    LTextInput,
    LPhoneInput,
    LButton,
    LDivider,
    LToggle,
    LLocationMap,
    useLToast,
} from "@/components/laundry";
import { useShop, useShopMutations } from "@/hooks/use-shop";
import { reverseGeocode } from "@/lib/geocoding";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import {
    Store,
    MapPin,
    Phone,
    FileText,
    Building2,
    Share2,
    Camera,
    Copy,
    Check,
    Truck,
    Shield,
} from "lucide-react";
import { ServiceAreasSettings } from "./ServiceAreasSettings";
import { useAuth } from "@/features/auth/AuthContext";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function ShopSettingsPage() {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const { addToast } = useLToast();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isOnboarding = searchParams.get("onboarding") === "true";

    const { shop, loading } = useShop();
    const { user } = useAuth();
    const { updateShop, updateLocation, updateBankDetails, updateGST, updateTaxSettings } =
        useShopMutations();

    // Determine if phone/email are locked (either from shop doc or from auth)
    const isPhoneLocked = !!(shop?.phone || user?.phone);
    const isEmailLocked = !!(shop?.email || user?.email);

    // Form state
    const [shopName, setShopName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [whatsappNumber, setWhatsappNumber] = useState("");

    // Location
    const [address, setAddress] = useState("");
    const [city, setCity] = useState("");
    const [state, setState] = useState("");
    const [pincode, setPincode] = useState("");
    const [latitude, setLatitude] = useState<number | undefined>();
    const [longitude, setLongitude] = useState<number | undefined>();
    const [gettingLocation, setGettingLocation] = useState(false);

    // Business
    const [gstNumber, setGstNumber] = useState("");
    const [panNumber, setPanNumber] = useState("");

    // Tax
    const [taxEnabled, setTaxEnabled] = useState(true);
    const [taxName, setTaxName] = useState("GST");
    const [taxRate, setTaxRate] = useState(18);

    // Bank
    const [accountNumber, setAccountNumber] = useState("");
    const [ifscCode, setIfscCode] = useState("");
    const [bankName, setBankName] = useState("");
    const [accountHolderName, setAccountHolderName] = useState("");
    const [upiId, setUpiId] = useState("");

    // UI state
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const [emailError, setEmailError] = useState<string | undefined>();
    const [phoneError, setPhoneError] = useState<string | undefined>();
    const [checkingEmail, setCheckingEmail] = useState(false);
    const [checkingPhone, setCheckingPhone] = useState(false);

    // Load shop data into form - Only once when data is available
    useEffect(() => {
        if (shop && !initialized) {
            setShopName(shop.name || "");

            // Get phone from shop or auth user (fallback for OTP registration)
            const rawPhone = shop.phone || user?.phone || "";
            // Clean phone number: remove +91 prefix and keep last 10 digits
            const cleanPhone = rawPhone.replace(/^\+?91/, "").replace(/\D/g, "").slice(-10);
            setPhone(cleanPhone);

            // Get email from shop or auth user (fallback for Google sign-in)
            setEmail(shop.email || user?.email || "");
            // WhatsApp defaults to registered phone; user can change it later
            setWhatsappNumber(shop.whatsappNumber || cleanPhone || "");

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

            if (shop.settings.tax) {
                setTaxEnabled(shop.settings.tax.enabled);
                setTaxName(shop.settings.tax.name);
                setTaxRate(shop.settings.tax.rate);
            }

            if (shop.bankDetails) {
                setAccountNumber(shop.bankDetails.accountNumber || "");
                setIfscCode(shop.bankDetails.ifscCode || "");
                setBankName(shop.bankDetails.bankName || "");
                setAccountHolderName(shop.bankDetails.accountHolderName || "");
                setUpiId(shop.bankDetails.upiId || "");
            }

            setInitialized(true);
        }
    }, [shop, initialized]);

    // ============================================
    // DUPLICATE CHECKING FUNCTIONS
    // ============================================

    // Check if phone exists in another shop (check both +91 and plain 10-digit formats)
    const checkPhoneDuplicate = async (phoneToCheck: string): Promise<boolean> => {
        const digits = phoneToCheck.replace(/\D/g, "").slice(-10);
        if (!digits || digits.length !== 10 || !shop?.id) return false;

        const withPrefix = `+91${digits}`;
        const q1 = query(
            collection(db, "shops"),
            where("phone", "==", withPrefix),
            limit(2)
        );
        const q2 = query(
            collection(db, "shops"),
            where("phone", "==", digits),
            limit(2)
        );
        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        const foundOther = (snap: { docs: { id: string }[] }) =>
            snap.docs.some((d) => d.id !== shop.id);
        return foundOther(snap1) || foundOther(snap2);
    };

    // Check if email exists in another shop
    const checkEmailDuplicate = async (emailToCheck: string): Promise<boolean> => {
        if (!emailToCheck || !shop?.id) return false;

        const q = query(
            collection(db, "shops"),
            where("email", "==", emailToCheck.toLowerCase()),
            limit(1)
        );
        const snapshot = await getDocs(q);
        // Return true if found in a DIFFERENT shop
        return snapshot.docs.some(doc => doc.id !== shop.id);
    };

    // Check if WhatsApp number exists in another shop
    const checkWhatsAppDuplicate = async (whatsappToCheck: string): Promise<boolean> => {
        if (!whatsappToCheck || !shop?.id) return false;

        const q = query(
            collection(db, "shops"),
            where("whatsappNumber", "==", whatsappToCheck),
            limit(1)
        );
        const snapshot = await getDocs(q);
        // Return true if found in a DIFFERENT shop
        return snapshot.docs.some(doc => doc.id !== shop.id);
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

    // Get current location and reverse geocode
    const getCurrentLocation = async () => {
        if (!navigator.geolocation) {
            addToast({
                type: "error",
                title: t("shop.locationNotSupported"),
            });
            return;
        }

        setGettingLocation(true);

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                setLatitude(lat);
                setLongitude(lng);

                // Try to reverse geocode to get address
                try {
                    const result = await reverseGeocode(lat, lng);
                    if (result) {
                        // Auto-fill address fields
                        if (result.address) setAddress(result.address);
                        if (result.city) setCity(result.city);
                        if (result.state) setState(result.state);
                        if (result.pincode) setPincode(result.pincode);

                        addToast({
                            type: "success",
                            title: t("shop.locationCaptured"),
                            description: t("shop.addressAutoFilled"),
                        });
                    } else {
                        addToast({
                            type: "success",
                            title: t("shop.locationCaptured"),
                            description: t("shop.enterAddressManually"),
                        });
                    }
                } catch (error) {
                    console.error("Reverse geocoding failed:", error);
                    addToast({
                        type: "success",
                        title: t("shop.locationCaptured"),
                        description: t("shop.enterAddressManually"),
                    });
                }

                setGettingLocation(false);
            },
            (error) => {
                console.error("Geolocation error:", error);
                setGettingLocation(false);
                addToast({
                    type: "error",
                    title: t("shop.locationError"),
                    description: error.message,
                });
            },
            { enableHighAccuracy: true }
        );
    };

    // Save all settings
    const handleSave = async () => {
        if (phoneError || emailError) {
            addToast({
                type: "error",
                title: t("shop.fixErrors", "Fix errors before saving"),
                description: phoneError || emailError,
            });
            return;
        }
        setSaving(true);

        try {
            // ============================================
            // DUPLICATE VALIDATION BEFORE SAVE
            // ============================================

            // Check phone duplicate (only if not locked and being updated)
            if (!isPhoneLocked && phone.replace(/\D/g, "").length === 10) {
                const isPhoneDuplicate = await checkPhoneDuplicate(phone);
                if (isPhoneDuplicate) {
                    addToast({
                        type: "error",
                        title: t("shop.duplicatePhone", "Phone already in use"),
                        description: t("shop.duplicatePhoneDesc", "This number is already listed with another business. Please add a different number."),
                    });
                    setSaving(false);
                    return;
                }
            }

            // Check email duplicate (only if not locked and being updated)
            if (!isEmailLocked && email) {
                const isEmailDuplicate = await checkEmailDuplicate(email);
                if (isEmailDuplicate) {
                    addToast({
                        type: "error",
                        title: t("shop.duplicateEmail", "Email already in use"),
                        description: t("shop.duplicateEmailDesc", "This email is already listed with another business. Please add a different email."),
                    });
                    setSaving(false);
                    return;
                }
            }

            // Check WhatsApp duplicate (always check if provided)
            if (whatsappNumber) {
                const isWhatsAppDuplicate = await checkWhatsAppDuplicate(whatsappNumber);
                if (isWhatsAppDuplicate) {
                    addToast({
                        type: "error",
                        title: t("shop.duplicateWhatsApp", "WhatsApp Already Used"),
                        description: t("shop.duplicateWhatsAppDesc", "This WhatsApp number is already used by another shop."),
                    });
                    setSaving(false);
                    return;
                }
            }

            // ============================================
            // BUILD AND SAVE PAYLOAD
            // ============================================

            // Build update payload - skip phone/email if already saved (immutability)
            const updatePayload: Record<string, unknown> = {
                name: shopName,
                whatsappNumber,
            };

            // Only allow phone update if not already locked (use digits only)
            if (!isPhoneLocked && phone.replace(/\D/g, "").length === 10) {
                updatePayload.phone = `+91${phone.replace(/\D/g, "").slice(-10)}`;
            }

            // Only allow email update if not already locked
            if (!isEmailLocked && email) {
                updatePayload.email = email;
            }

            await updateShop(updatePayload);

            // Update location
            await updateLocation({
                address,
                city,
                state,
                pincode,
                latitude,
                longitude,
            });

            // Update GST
            if (gstNumber || panNumber) {
                await updateGST(gstNumber, panNumber);
            }

            // Update bank details
            if (accountNumber || upiId) {
                await updateBankDetails({
                    accountNumber,
                    ifscCode,
                    bankName,
                    accountHolderName,
                    upiId,
                });
            }

            // Update Tax Settings
            await updateTaxSettings(taxEnabled, taxName, taxRate);

            addToast({
                type: "success",
                title: isOnboarding ? t("shop.setupComplete", "Setup Complete!") : t("shop.settingsSaved"),
                description: isOnboarding ? t("shop.redirecting", "Redirecting to dashboard...") : undefined,
            });

            if (isOnboarding) {
                setTimeout(() => navigate("/dashboard"), 1500);
            }
        } catch (error) {
            console.error("Save error:", error);
            addToast({
                type: "error",
                title: t("shop.saveError"),
            });
        } finally {
            setSaving(false);
        }
    };

    // Share shop details
    const handleShare = async () => {
        const shareText = `
🧺 ${shopName}

📍 ${address}${city ? `, ${city}` : ""}${state ? `, ${state}` : ""} ${pincode}
📞 ${phone}
${email ? `✉️ ${email}` : ""}
${latitude && longitude ? `📌 https://maps.google.com/?q=${latitude},${longitude}` : ""}
`.trim();

        if (navigator.share) {
            try {
                await navigator.share({
                    title: shopName,
                    text: shareText,
                });
            } catch (error) {
                // User cancelled or error
                console.log("Share cancelled");
            }
        } else {
            // Fallback to clipboard
            await navigator.clipboard.writeText(shareText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            addToast({
                type: "success",
                title: t("shop.copiedToClipboard"),
            });
        }
    };

    // Copy location link
    const copyLocationLink = async () => {
        if (!latitude || !longitude) return;

        const link = `https://maps.google.com/?q=${latitude},${longitude}`;
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        addToast({
            type: "success",
            title: t("shop.locationCopied"),
        });
    };

    if (loading) {
        return (
            <PageWrapper>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
            </PageWrapper>
        );
    }

    // Handle error state (e.g. permission denied)
    if (!shop) {
        return (
            <PageWrapper>
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <Shield className="h-12 w-12 text-destructive mb-4 opacity-50" />
                    <h2 className="text-xl font-bold text-foreground mb-2">{t("common.error")}</h2>
                    <p className="text-muted-foreground max-w-md">
                        {t("shop.loadError", "Unable to load shop settings. Please clean your cache and try again, or contact support.")}
                    </p>
                    <LButton
                        variant="ghost"
                        className="mt-4"
                        onClick={() => window.location.reload()}
                    >
                        {t("common.retry")}
                    </LButton>
                </div>
            </PageWrapper>
        );
    }

    return (
        <PageWrapper>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-foreground">
                    {t("shop.settings")}
                </h1>
                <LButton
                    variant="ghost"
                    size="sm"
                    onClick={handleShare}
                    leftIcon={copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                >
                    {t("shop.share")}
                </LButton>
            </div>

            <div className="space-y-6 max-w-2xl">
                {/* Shop Logo & Name */}
                <LCard variant="elevated" className="p-4">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="relative">
                            {shop?.logo ? (
                                <img
                                    src={shop.logo}
                                    alt={shopName}
                                    className="w-20 h-20 rounded-xl object-cover"
                                />
                            ) : (
                                <div className="w-20 h-20 rounded-xl bg-primary-muted flex items-center justify-center">
                                    <Store className="h-10 w-10 text-primary" />
                                </div>
                            )}
                            <button className="absolute -bottom-2 -right-2 p-2 bg-primary text-white rounded-full shadow-lg hover:bg-primary/90 transition-colors">
                                <Camera className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex-1">
                            <LTextInput
                                label={t("shop.shopName")}
                                value={shopName}
                                onChange={(e) => setShopName(e.target.value)}
                                placeholder={t("shop.shopNamePlaceholder")}
                            />
                        </div>
                    </div>
                </LCard>

                {/* Contact Information */}
                <LCard variant="outlined" className="p-4">
                    <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Phone className="h-5 w-5 text-primary" />
                        {t("shop.contactInfo")}
                    </h2>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <LPhoneInput
                                label={t("shop.phoneNumber")}
                                value={phone}
                                onValueChange={(v) => {
                                    setPhone(v);
                                    setPhoneError(undefined);
                                }}
                                onBlur={async () => {
                                    if (isPhoneLocked || phone.replace(/\D/g, "").length !== 10) {
                                        setPhoneError(undefined);
                                        return;
                                    }
                                    setCheckingPhone(true);
                                    setPhoneError(undefined);
                                    try {
                                        const isDup = await checkPhoneDuplicate(phone);
                                        if (isDup) {
                                            setPhoneError(t("shop.duplicatePhoneDesc", "This number is already listed with another business. Please add a different number."));
                                        }
                                    } catch {
                                        // ignore
                                    } finally {
                                        setCheckingPhone(false);
                                    }
                                }}
                                showClear={!isPhoneLocked}
                                disabled={isPhoneLocked}
                                error={phoneError}
                                helperText={checkingPhone ? t("shop.checking", "Checking...") : undefined}
                                className={isPhoneLocked ? "opacity-70 bg-muted" : ""}
                            />
                            {isPhoneLocked && (
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Shield className="h-3 w-3" />
                                    {t("shop.phoneImmutable", "Registered phone number cannot be changed")}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1">
                            <LPhoneInput
                                label={t("shop.whatsappNumber")}
                                value={whatsappNumber}
                                onValueChange={setWhatsappNumber}
                                showClear
                            />
                            <p className="text-[10px] text-muted-foreground px-1">
                                {t("shop.whatsappNumberHint", "Defaults to your registered phone. You can update it anytime.")}
                            </p>
                        </div>

                        <div className="space-y-1">
                            <LTextInput
                                label={t("shop.email")}
                                type="email"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    setEmailError(undefined);
                                }}
                                onBlur={async () => {
                                    if (isEmailLocked || !email.trim() || !email.includes("@")) {
                                        setEmailError(undefined);
                                        return;
                                    }
                                    setCheckingEmail(true);
                                    setEmailError(undefined);
                                    try {
                                        const isDup = await checkEmailDuplicate(email.trim());
                                        if (isDup) {
                                            setEmailError(t("shop.duplicateEmailDesc", "This email is already listed with another business. Please add a different email."));
                                        }
                                    } catch {
                                        // ignore
                                    } finally {
                                        setCheckingEmail(false);
                                    }
                                }}
                                error={emailError}
                                placeholder="shop@example.com"
                                disabled={isEmailLocked}
                                className={isEmailLocked ? "opacity-70 bg-muted" : ""}
                            />
                            {isEmailLocked && (
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Shield className="h-3 w-3" />
                                    {t("shop.emailImmutable", "Registered email cannot be changed")}
                                </p>
                            )}
                            {checkingEmail && (
                                <p className="text-[10px] text-muted-foreground">Checking...</p>
                            )}
                        </div>
                    </div>
                </LCard>

                {/* Location */}
                <LCard variant="outlined" className="p-4">
                    <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        {t("shop.location")}
                    </h2>

                    <div className="space-y-4">
                        <LLocationMap
                            latitude={latitude}
                            longitude={longitude}
                            onLocationChange={handleMapLocationChange}
                            onGetLocation={getCurrentLocation}
                            gettingLocation={gettingLocation}
                            className="mb-4"
                        />
                        <LTextInput
                            label={t("shop.address")}
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder={t("shop.addressPlaceholder")}
                        />

                        <div className="grid grid-cols-2 gap-4" style={{ gridTemplateColumns: isMobile ? "1fr" : undefined }}>
                            <LTextInput
                                label={t("shop.city")}
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                placeholder="Hyderabad"
                            />
                            <LTextInput
                                label={t("shop.state")}
                                value={state}
                                onChange={(e) => setState(e.target.value)}
                                placeholder="Telangana"
                            />
                        </div>

                        <LTextInput
                            label={t("shop.pincode")}
                            value={pincode}
                            onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="500001"
                            inputMode="numeric"
                            maxLength={6}
                        />

                        <LDivider />

                        {/* Copy location link - lat/lng saved to DB for Super Admin; coordinates not shown */}
                        {latitude && longitude && (
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-sm text-muted-foreground">
                                    {t("shop.locationCaptured")}
                                </p>
                                <LButton
                                    variant="ghost"
                                    size="sm"
                                    onClick={copyLocationLink}
                                    leftIcon={<Copy className="h-4 w-4" />}
                                >
                                    {t("shop.copyLocationLink", "Copy location link")}
                                </LButton>
                            </div>
                        )}
                    </div>
                </LCard>

                {/* Business Details (GST) */}
                <LCard variant="outlined" className="p-4">
                    <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        {t("shop.businessDetails")}
                    </h2>

                    <div className="space-y-4">
                        <LTextInput
                            label={t("shop.gstNumber")}
                            value={gstNumber}
                            onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                            placeholder="22AAAAA0000A1Z5"
                            maxLength={15}
                        />

                        <LTextInput
                            label={t("shop.panNumber")}
                            value={panNumber}
                            onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                            placeholder="AAAAA0000A"
                            maxLength={10}
                        />
                    </div>
                </LCard>

                {/* Tax Settings */}
                <LCard variant="outlined" className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <span className="text-xl">﹪</span>
                            {t("shop.taxSettings", "Tax Settings")}
                        </h2>
                        <LToggle
                            checked={taxEnabled}
                            onChange={setTaxEnabled}
                        />
                    </div>

                    {taxEnabled && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4" style={{ gridTemplateColumns: isMobile ? "1fr" : undefined }}>
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
                </LCard>

                {/* Bank Details */}
                <LCard variant="outlined" className="p-4">
                    <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        {t("shop.bankDetails")}
                    </h2>

                    <div className="space-y-4">
                        <LTextInput
                            label={t("shop.accountHolderName")}
                            value={accountHolderName}
                            onChange={(e) => setAccountHolderName(e.target.value)}
                            placeholder="John Doe"
                        />

                        <LTextInput
                            label={t("shop.accountNumber")}
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                            placeholder="1234567890123456"
                            inputMode="numeric"
                        />

                        <div className="grid grid-cols-2 gap-4" style={{ gridTemplateColumns: isMobile ? "1fr" : undefined }}>
                            <LTextInput
                                label={t("shop.ifscCode")}
                                value={ifscCode}
                                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                                placeholder="SBIN0001234"
                                maxLength={11}
                            />
                            <LTextInput
                                label={t("shop.bankName")}
                                value={bankName}
                                onChange={(e) => setBankName(e.target.value)}
                                placeholder="State Bank of India"
                            />
                        </div>

                        <LDivider />

                        <LTextInput
                            label={t("shop.upiId")}
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value.toLowerCase())}
                            placeholder="shop@upi"
                        />
                    </div>
                </LCard>

                {/* Service Areas & Time Slots */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <Truck className="h-5 w-5 text-primary" />
                        {t("shop.deliverySettings", "Delivery & Pickup Settings")}
                    </h2>
                    <ServiceAreasSettings />
                </div>

                {/* Save Button */}
                <LButton
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleSave}
                    loading={saving}
                    disabled={!!(phoneError || emailError)}
                >
                    {isOnboarding ? t("shop.completeSetup", "Complete Setup & Go to Dashboard") : t("shop.saveSettings")}
                </LButton>
            </div>
        </PageWrapper>
    );
}
