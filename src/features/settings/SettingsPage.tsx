/**
 * Settings Page
 * 
 * User settings and preferences with Shop Settings link
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageWrapper } from "@/components/PageWrapper";
import { LCard, LList, LListItem, LToggle, LDivider } from "@/components/laundry";
import { useAuth } from "@/features/auth/AuthContext";
import { useTranslation } from "react-i18next";
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
    Truck,
    CreditCard,
    Receipt,
} from "lucide-react";

export function SettingsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user, role, shopName, signOut } = useAuth();
    const [darkMode, setDarkMode] = useState(false);
    const [notifications, setNotifications] = useState(true);

    return (
        <PageWrapper>
            <h1 className="text-2xl font-bold text-foreground mb-6">{t('settings.title')}</h1>

            {/* Profile Section */}
            <LCard variant="elevated" className="p-4 mb-4">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary-muted flex items-center justify-center">
                        {user?.photoURL ? (
                            <img src={user.photoURL} alt="Profile" className="w-16 h-16 rounded-full" />
                        ) : (
                            <User className="h-8 w-8 text-primary" />
                        )}
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">{shopName || user?.displayName}</h2>
                        <p className="text-muted-foreground">{user?.phone || user?.email}</p>
                        <p className="text-sm text-primary capitalize">{role}</p>
                    </div>
                </div>
            </LCard>

            {/* Shop Settings */}
            <LCard variant="outlined" className="p-0 mb-4">
                <LList dividers={false}>
                    <LListItem
                        title={t('settings.shopSettings')}
                        subtitle={t('settings.shopSettingsDesc')}
                        leftContent={<Store className="h-5 w-5 text-primary" />}
                        showChevron
                        onClick={() => navigate("/shop-settings")}
                    />
                    <LDivider className="ml-12" />
                    <LListItem
                        title={t('settings.subscription', 'Subscription & Billing')}
                        subtitle={t('settings.subscriptionDesc', 'Manage plan, view usage')}
                        leftContent={<CreditCard className="h-5 w-5 text-primary" />}
                        showChevron
                        onClick={() => navigate("/settings/subscription")}
                    />
                    <LDivider className="ml-12" />
                    <LListItem
                        title={t('settings.paymentHistory', 'Payment History')}
                        subtitle={t('settings.paymentHistoryDesc', 'Subscription and renewal payments')}
                        leftContent={<Receipt className="h-5 w-5 text-primary" />}
                        showChevron
                        onClick={() => navigate("/settings/payment-history")}
                    />
                    <LDivider className="ml-12" />
                    <LListItem
                        title={t('settings.shopLocation')}
                        subtitle={t('settings.shopLocationDesc')}
                        leftContent={<MapPin className="h-5 w-5 text-muted-foreground" />}
                        showChevron
                        onClick={() => navigate("/shop-settings")}
                    />
                    <LDivider className="ml-12" />
                    <LListItem
                        title={t('settings.businessDetails')}
                        subtitle={t('settings.businessDetailsDesc')}
                        leftContent={<FileText className="h-5 w-5 text-muted-foreground" />}
                        showChevron
                        onClick={() => navigate("/shop-settings")}
                    />
                    <LDivider className="ml-12" />
                    <LListItem
                        title={t('settings.bankDetails')}
                        subtitle={t('settings.bankDetailsDesc')}
                        leftContent={<Building2 className="h-5 w-5 text-muted-foreground" />}
                        showChevron
                        onClick={() => navigate("/shop-settings")}
                    />
                    <LDivider className="ml-12" />
                    <LListItem
                        title={t('settings.deliverySettings', 'Delivery & Pickup')}
                        subtitle={t('settings.deliverySettingsDesc', 'Service areas and time slots')}
                        leftContent={<Truck className="h-5 w-5 text-primary" />}
                        showChevron
                        onClick={() => navigate("/delivery-settings")}
                    />
                </LList>
            </LCard>

            {/* Preferences */}
            <LCard variant="outlined" className="p-0 mb-4">
                <LList dividers={false}>
                    <LListItem
                        title={t('settings.darkMode')}
                        leftContent={<Palette className="h-5 w-5 text-muted-foreground" />}
                        rightContent={
                            <LToggle checked={darkMode} onChange={setDarkMode} />
                        }
                    />
                    <LDivider className="ml-12" />
                    <LListItem
                        title={t('settings.notifications')}
                        leftContent={<Bell className="h-5 w-5 text-muted-foreground" />}
                        rightContent={
                            <LToggle checked={notifications} onChange={setNotifications} />
                        }
                    />
                </LList>
            </LCard>

            {/* Help */}
            <LCard variant="outlined" className="p-0 mb-4">
                <LList dividers={false}>
                    <LListItem
                        title={t('settings.helpSupport')}
                        leftContent={<HelpCircle className="h-5 w-5 text-muted-foreground" />}
                        showChevron
                        onClick={() => { }}
                    />
                </LList>
            </LCard>

            {/* Sign Out */}
            <LCard variant="outlined" className="p-0">
                <LListItem
                    title={t('auth.signOut')}
                    leftContent={<LogOut className="h-5 w-5 text-destructive" />}
                    destructive
                    onClick={signOut}
                />
            </LCard>

            {/* Version */}
            <p className="text-center text-xs text-muted-foreground mt-6">
                LaundryBill v1.0.0
            </p>
        </PageWrapper>
    );
}
