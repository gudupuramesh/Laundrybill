/**
 * Platform Settings Page
 * 
 * Configure company branding, contact info, and email settings
 */

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LCard, LButton, LTextInput, LPageLoader, LToggle, useLToast } from "@/components/laundry";
import { useSuperAdmin } from "../SuperAdminAuthContext";
import {
    Building2,
    Globe,
    Mail,
    Phone,
    MessageSquare,
    Image,
    FileText,
    Video,
    BookOpen,
    Save,
    Facebook,
    Instagram,
    Twitter,
    Linkedin,
    Percent,
    CreditCard,
    Smartphone,
} from "lucide-react";
interface PlatformSettings {
    // Brand
    logoUrl: string;
    brandName: string;
    websiteUrl: string;
    appUrl: string;

    // Legal
    companyName: string;
    gstNumber: string;
    address: string;

    // Support
    supportEmail: string;
    supportPhone: string;
    whatsappNumber: string;

    // Social (optional)
    facebookUrl: string;
    instagramUrl: string;
    twitterUrl: string;
    linkedinUrl: string;

    // Help Resources (legacy single URLs; kept for emailBranding if needed)
    videoTutorialUrl: string;
    helpDocsUrl: string;
}

/** Duration discount % for 3/6/9/12 months (shop subscription page) */
interface DurationDiscounts {
    discount3Months: number;
    discount6Months: number;
    discount9Months: number;
    discount12Months: number;
}

/** Whether shop owners can upgrade/downgrade/cancel subscriptions */
interface SubscriptionControls {
    buttonsEnabled: boolean;
}

/** App version control — triggers update prompt in mobile app */
interface AppVersionSettings {
    latestVersion: string;
    minVersion: string;
    whatsNew: string;
}

const DEFAULT_DURATION_DISCOUNTS: DurationDiscounts = {
    discount3Months: 0,
    discount6Months: 5,
    discount9Months: 10,
    discount12Months: 17,
};

const DEFAULT_SETTINGS: PlatformSettings = {
    logoUrl: "",
    brandName: "LaundryBill",
    websiteUrl: "https://laundrybill.com",
    appUrl: "https://app.laundrybill.com",
    companyName: "",
    gstNumber: "",
    address: "",
    supportEmail: "",
    supportPhone: "",
    whatsappNumber: "",
    facebookUrl: "",
    instagramUrl: "",
    twitterUrl: "",
    linkedinUrl: "",
    videoTutorialUrl: "",
    helpDocsUrl: ""
};

export function PlatformSettingsPage() {
    const { superAdmin } = useSuperAdmin();
    const { addToast } = useLToast();
    const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
    const [durationDiscounts, setDurationDiscounts] = useState<DurationDiscounts>(DEFAULT_DURATION_DISCOUNTS);
    const [subscriptionControls, setSubscriptionControls] = useState<SubscriptionControls>({ buttonsEnabled: true });
    const [appVersion, setAppVersion] = useState<AppVersionSettings>({ latestVersion: "", minVersion: "", whatsNew: "" });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Load settings on mount
    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const [brandSnap, subSnap, appSnap] = await Promise.all([
                getDoc(doc(db, "platformSettings", "emailBranding")),
                getDoc(doc(db, "platformSettings", "subscription")),
                getDoc(doc(db, "platformSettings", "app")),
            ]);

            if (brandSnap.exists()) {
                const data = brandSnap.data();
                setSettings({
                    logoUrl: data.logoUrl || "",
                    brandName: data.brandName || "LaundryBill",
                    websiteUrl: data.websiteUrl || "",
                    appUrl: data.appUrl || "",
                    companyName: data.companyName || "",
                    gstNumber: data.gstNumber || "",
                    address: data.address || "",
                    supportEmail: data.supportEmail || "",
                    supportPhone: data.supportPhone || "",
                    whatsappNumber: data.whatsappNumber || "",
                    facebookUrl: data.facebookUrl || "",
                    instagramUrl: data.instagramUrl || "",
                    twitterUrl: data.twitterUrl || "",
                    linkedinUrl: data.linkedinUrl || "",
                    videoTutorialUrl: data.videoTutorialUrl || "",
                    helpDocsUrl: data.helpDocsUrl || ""
                });
            }

            if (subSnap.exists()) {
                const data = subSnap.data();
                const pct = (k: keyof DurationDiscounts) => {
                    const v = Number(data?.[k]);
                    return Number.isFinite(v) && v >= 0 && v <= 100 ? v : DEFAULT_DURATION_DISCOUNTS[k];
                };
                setDurationDiscounts({
                    discount3Months: pct("discount3Months"),
                    discount6Months: pct("discount6Months"),
                    discount9Months: pct("discount9Months"),
                    discount12Months: pct("discount12Months"),
                });
                // Load subscription buttons enabled (default true if not set)
                setSubscriptionControls({
                    buttonsEnabled: data?.subscriptionButtonsEnabled !== false,
                });
            }

            if (appSnap.exists()) {
                const data = appSnap.data();
                setAppVersion({
                    latestVersion: data.latestVersion || "",
                    minVersion: data.minVersion || "",
                    whatsNew: data.whatsNew || "",
                });
            }
        } catch (error) {
            console.error("Error loading settings:", error);
            addToast({ type: "error", title: "Failed to load settings" });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await Promise.all([
                setDoc(doc(db, "platformSettings", "emailBranding"), {
                    ...settings,
                    updatedAt: serverTimestamp(),
                    updatedBy: superAdmin?.id || "unknown"
                }, { merge: true }),
                setDoc(doc(db, "platformSettings", "subscription"), {
                    discount3Months: durationDiscounts.discount3Months,
                    discount6Months: durationDiscounts.discount6Months,
                    discount9Months: durationDiscounts.discount9Months,
                    discount12Months: durationDiscounts.discount12Months,
                    subscriptionButtonsEnabled: subscriptionControls.buttonsEnabled,
                    updatedAt: serverTimestamp(),
                    updatedBy: superAdmin?.id || "unknown"
                }, { merge: true }),
                setDoc(doc(db, "platformSettings", "app"), {
                    latestVersion: appVersion.latestVersion,
                    minVersion: appVersion.minVersion,
                    whatsNew: appVersion.whatsNew,
                    updatedAt: serverTimestamp(),
                    updatedBy: superAdmin?.id || "unknown"
                }, { merge: true }),
            ]);

            addToast({ type: "success", title: "Settings saved successfully!" });
        } catch (error) {
            console.error("Error saving settings:", error);
            addToast({ type: "error", title: "Failed to save settings" });
        } finally {
            setSaving(false);
        }
    };

    const updateField = (field: keyof PlatformSettings, value: string) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    if (loading) return <LPageLoader message="Loading settings..." />;

    return (
        <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Platform Settings</h1>
                    <p className="text-muted-foreground">Configure company branding and contact info for emails</p>
                </div>
                <LButton
                    onClick={handleSave}
                    loading={saving}
                    leftIcon={<Save className="h-4 w-4" />}
                >
                    Save Changes
                </LButton>
            </div>

            {/* Brand Settings */}
            <LCard className="p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Image className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Brand Settings</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <LTextInput
                        label="Logo URL"
                        placeholder="https://your-domain.com/logo.png"
                        value={settings.logoUrl}
                        onChange={(e) => updateField("logoUrl", e.target.value)}
                        hint="Hosted image URL (PNG/WebP, max 200KB recommended)"
                    />
                    <LTextInput
                        label="Brand Name"
                        placeholder="LaundryBill"
                        value={settings.brandName}
                        onChange={(e) => updateField("brandName", e.target.value)}
                    />
                    <LTextInput
                        label="Website URL"
                        placeholder="https://laundrybill.com"
                        value={settings.websiteUrl}
                        onChange={(e) => updateField("websiteUrl", e.target.value)}
                        leftIcon={<Globe className="h-4 w-4" />}
                    />
                    <LTextInput
                        label="App URL"
                        placeholder="https://app.laundrybill.com"
                        value={settings.appUrl}
                        onChange={(e) => updateField("appUrl", e.target.value)}
                        leftIcon={<Globe className="h-4 w-4" />}
                    />
                </div>
            </LCard>

            {/* Duration discounts for shop subscription (3/6/9/12 months) */}
            <LCard className="p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Percent className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Subscription duration discounts</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                    Discount % for 3, 6, 9, and 12 month plans. Shop subscription page shows these options; longer duration gets this discount off (monthly × months).
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {([3, 6, 9, 12] as const).map((m) => {
                        const key = `discount${m}Months` as keyof DurationDiscounts;
                        return (
                            <div key={m}>
                                <label className="text-sm font-medium text-foreground block mb-1.5">{m} months %</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={durationDiscounts[key]}
                                    onChange={(e) => {
                                        const v = parseInt(e.target.value, 10);
                                        if (!Number.isNaN(v) && v >= 0 && v <= 100)
                                            setDurationDiscounts(prev => ({ ...prev, [key]: v }));
                                    }}
                                    className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                        );
                    })}
                </div>
            </LCard>

            {/* Subscription Controls */}
            <LCard className="p-6">
                <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Subscription Controls</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                    Control whether shop owners can upgrade, downgrade, or cancel their subscriptions from the Subscription page.
                </p>
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                        <p className="font-medium text-foreground">Enable subscription buttons</p>
                        <p className="text-sm text-muted-foreground">
                            When enabled, shop owners can upgrade, switch plans, and cancel subscriptions. When disabled, they can only view plans.
                        </p>
                    </div>
                    <LToggle
                        checked={subscriptionControls.buttonsEnabled}
                        onChange={(checked) => setSubscriptionControls({ buttonsEnabled: checked })}
                    />
                </div>
            </LCard>

            {/* App Version Control */}
            <LCard className="p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Smartphone className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">App Version Control</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                    When you publish a new version to the Play Store, update the version here. Users will see an update prompt when they open the app.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <LTextInput
                        label="Latest Version"
                        placeholder="1.5.3"
                        value={appVersion.latestVersion}
                        onChange={(e) => setAppVersion(prev => ({ ...prev, latestVersion: e.target.value }))}
                        hint="Current version on Play Store"
                    />
                    <LTextInput
                        label="Minimum Version (Force Update)"
                        placeholder="1.0.0"
                        value={appVersion.minVersion}
                        onChange={(e) => setAppVersion(prev => ({ ...prev, minVersion: e.target.value }))}
                        hint="Users below this version must update"
                    />
                    <div className="md:col-span-1">
                        <label className="text-sm font-medium text-foreground block mb-1.5">What's New</label>
                        <textarea
                            value={appVersion.whatsNew}
                            onChange={(e) => setAppVersion(prev => ({ ...prev, whatsNew: e.target.value }))}
                            placeholder="e.g. Bug fixes and performance improvements"
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                        />
                    </div>
                </div>
            </LCard>

            {/* Legal / Company Details */}
            <LCard className="p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Building2 className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Company Details</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <LTextInput
                        label="Company Name (Legal)"
                        placeholder="LaundryBill Technologies Pvt. Ltd."
                        value={settings.companyName}
                        onChange={(e) => updateField("companyName", e.target.value)}
                    />
                    <LTextInput
                        label="GST Number"
                        placeholder="27AABCU9603R1ZX"
                        value={settings.gstNumber}
                        onChange={(e) => updateField("gstNumber", e.target.value)}
                        leftIcon={<FileText className="h-4 w-4" />}
                    />
                    <div className="md:col-span-2">
                        <LTextInput
                            label="Registered Address"
                            placeholder="123 Business Hub, Andheri East, Mumbai, Maharashtra 400069"
                            value={settings.address}
                            onChange={(e) => updateField("address", e.target.value)}
                        />
                    </div>
                </div>
            </LCard>

            {/* Support Contacts */}
            <LCard className="p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Phone className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Support Contacts</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <LTextInput
                        label="Support Email"
                        type="email"
                        placeholder="support@laundrybill.com"
                        value={settings.supportEmail}
                        onChange={(e) => updateField("supportEmail", e.target.value)}
                        leftIcon={<Mail className="h-4 w-4" />}
                    />
                    <LTextInput
                        label="Support Phone"
                        placeholder="+91 98765 43210"
                        value={settings.supportPhone}
                        onChange={(e) => updateField("supportPhone", e.target.value)}
                        leftIcon={<Phone className="h-4 w-4" />}
                    />
                    <LTextInput
                        label="WhatsApp Number"
                        placeholder="919876543210"
                        value={settings.whatsappNumber}
                        onChange={(e) => updateField("whatsappNumber", e.target.value)}
                        hint="Without + or spaces (e.g., 919876543210)"
                        leftIcon={<MessageSquare className="h-4 w-4" />}
                    />
                </div>
            </LCard>

            {/* Support & Help: configured in dedicated page */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                <p><strong>Support & Help:</strong> Contact details for the Help page, welcome message, and per-page video/docs are configured in <strong>Support & Help</strong> (sidebar).</p>
            </div>

            {/* Help Resources (single URLs for emails) */}
            <LCard className="p-6">
                <div className="flex items-center gap-2 mb-4">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Help Resources (for emails)</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <LTextInput
                        label="Video Tutorial URL"
                        placeholder="https://youtube.com/watch?v=..."
                        value={settings.videoTutorialUrl}
                        onChange={(e) => updateField("videoTutorialUrl", e.target.value)}
                        leftIcon={<Video className="h-4 w-4" />}
                    />
                    <LTextInput
                        label="Help Docs URL"
                        placeholder="https://docs.laundrybill.com"
                        value={settings.helpDocsUrl}
                        onChange={(e) => updateField("helpDocsUrl", e.target.value)}
                        leftIcon={<BookOpen className="h-4 w-4" />}
                    />
                </div>
            </LCard>

            {/* Social Media */}
            <LCard className="p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Globe className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Social Media (Optional)</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <LTextInput
                        label="Facebook"
                        placeholder="https://facebook.com/laundrybill"
                        value={settings.facebookUrl}
                        onChange={(e) => updateField("facebookUrl", e.target.value)}
                        leftIcon={<Facebook className="h-4 w-4" />}
                    />
                    <LTextInput
                        label="Instagram"
                        placeholder="https://instagram.com/laundrybill"
                        value={settings.instagramUrl}
                        onChange={(e) => updateField("instagramUrl", e.target.value)}
                        leftIcon={<Instagram className="h-4 w-4" />}
                    />
                    <LTextInput
                        label="Twitter / X"
                        placeholder="https://twitter.com/laundrybill"
                        value={settings.twitterUrl}
                        onChange={(e) => updateField("twitterUrl", e.target.value)}
                        leftIcon={<Twitter className="h-4 w-4" />}
                    />
                    <LTextInput
                        label="LinkedIn"
                        placeholder="https://linkedin.com/company/laundrybill"
                        value={settings.linkedinUrl}
                        onChange={(e) => updateField("linkedinUrl", e.target.value)}
                        leftIcon={<Linkedin className="h-4 w-4" />}
                    />
                </div>
            </LCard>

            {/* Preview Note */}
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                <p><strong>Note:</strong> These settings will be used in all outgoing emails (welcome, upgrade confirmation, expiry reminders). Changes take effect immediately for new emails.</p>
            </div>

            {/* Bottom Save Button */}
            <div className="flex justify-end">
                <LButton
                    size="lg"
                    onClick={handleSave}
                    loading={saving}
                    leftIcon={<Save className="h-4 w-4" />}
                >
                    Save All Changes
                </LButton>
            </div>
        </div>
    );
}
