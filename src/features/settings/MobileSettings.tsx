/**
 * MOBILE Settings — a 1:1 clone of the owner app's SettingsScreen
 * (mobile/src/screens/SettingsScreen.tsx): shop profile card with edit ·
 * blue-gradient subscription banner (plan, status pill, Expires | Staff Logins
 * | Billing, Upgrade) · sectioned list cards — Services & Items, Staff &
 * Attendance, Finance, Business, Appearance & Language, About & Support,
 * Account — each row an icon chip + title + subtitle + chevron.
 *
 * Desktop keeps SettingsPageMasterDetail's nav-rail layout.
 */

import { type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useShop } from "@/hooks/use-shop";
import { useShopLimits } from "@/hooks/use-shop-limits";
import { useShopSubscription } from "@/hooks/use-shop-subscription";
import { useTeamMembers } from "@/hooks/use-team-members";
import { LLanguageSelector } from "@/components/laundry";
import { useTranslation } from "react-i18next";
import { GOOGLE_PLAY_URL, APP_STORE_URL, detectMobileOS } from "@/config/app-links";
import {
    Edit, ChevronRight, Play, Apple, Package, ShoppingCart, MapPin, UserCog, Calendar, IndianRupee,
    FileText, Receipt, Store, Globe, BadgePercent, QrCode, Smartphone, HelpCircle,
    CreditCard, LogOut, Building2, Palette,
} from "lucide-react";

export function MobileSettings({ onEditProfile }: { onEditProfile?: () => void }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user, role, shopName, signOut, ownedShops } = useAuth();
    const { shop } = useShop();
    const { plan, isPro } = useShopLimits();
    const { subscription } = useShopSubscription();
    const { teamMembers } = useTeamMembers();

    const isOwner = role === "admin";
    const status = String(subscription?.status || "free").toLowerCase();
    const statusLabel = status === "active" ? t("mobile.statusActive", "ACTIVE")
        : status === "trial" ? t("mobile.statusTrial", "TRIAL")
            : status === "cancelled" ? t("mobile.statusCancelled", "CANCELLED")
                : t("mobile.statusFree", "FREE");
    const expiry = subscription?.activeUntil?.toDate?.() || subscription?.endDate?.toDate?.();
    const expiryText = expiry ? expiry.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "—";
    const billingText = subscription?.billingCycle === "yearly" ? t("mobile.yearly", "Yearly") : subscription?.billingCycle === "monthly" ? t("mobile.monthly", "Monthly") : "—";
    const loginCap = plan.limits?.maxTeamLogins ?? 0;

    const card: CSSProperties = { background: "var(--c-surface)", borderRadius: 18, border: "1px solid var(--c-border)", boxShadow: "var(--sh-sm)", overflow: "hidden" };
    const sectionTitle: CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: ".5px", margin: "4px 4px 8px" };

    const Row = ({ icon, tint, title, sub, right, onClick, last }: {
        icon: ReactNode; tint: string; title: string; sub?: string; right?: ReactNode; onClick?: () => void; last?: boolean;
    }) => (
        <button onClick={onClick} disabled={!onClick}
            style={{ width: "100%", cursor: onClick ? "pointer" : "default", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", font: "inherit", textAlign: "left", border: 0, background: "transparent", borderBottom: last ? "none" : "1px solid var(--c-border)" }}>
            <span style={{ width: 34, height: 34, flex: "none", borderRadius: 10, background: `var(--${tint}-soft)`, color: `var(--${tint})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{title}</span>
                {sub && <span style={{ display: "block", fontSize: 11.5, color: "var(--c-text-3)", marginTop: 1 }}>{sub}</span>}
            </span>
            {right}
            {onClick && <ChevronRight size={16} style={{ flex: "none", color: "var(--c-text-3)" }} />}
        </button>
    );

    return (
        <div style={{ minHeight: "100%", background: "var(--c-bg)", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", padding: "12px 16px", background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)" }}>
                <span style={{ fontSize: 18, fontWeight: 700 }}>{t("mobile.settingsTitle", "Settings")}</span>
            </div>

            <div style={{ flex: 1, padding: 16, paddingBottom: "calc(110px + env(safe-area-inset-bottom, 0px))", display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Shop profile card */}
                <div style={{ ...card, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 52, height: 52, flex: "none", borderRadius: 14, background: "var(--c-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, fontWeight: 700, overflow: "hidden" }}>
                        {shop?.logo ? <img src={shop.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (shopName || "S").charAt(0).toUpperCase()}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shopName || shop?.name}</div>
                        <div style={{ fontSize: 12, color: "var(--c-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {(shop?.location as { city?: string } | undefined)?.city ? `Store: ${(shop!.location as { city?: string }).city}` : (user?.email || "")}
                        </div>
                        {shop?.phone && <div style={{ fontSize: 12, color: "var(--c-text-3)" }}>{shop.phone}</div>}
                    </div>
                    <button onClick={onEditProfile} aria-label={t("common.edit", "Edit")} style={{ cursor: "pointer", flex: "none", width: 38, height: 38, borderRadius: 10, border: "1px solid var(--c-border)", background: "var(--c-surface-2)", color: "var(--c-text-2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Edit size={16} /></button>
                </div>

                {/* Subscription banner (blue gradient) — owner only, like the app */}
                {isOwner && (
                    <div role="button" tabIndex={0} onClick={() => navigate("/settings/subscription")} onKeyDown={(e) => { if (e.key === "Enter") navigate("/settings/subscription"); }}
                        style={{ cursor: "pointer", borderRadius: 18, padding: 16, background: "linear-gradient(135deg, #1B61E5, #124BB8)", color: "#fff", boxShadow: "var(--sh-md, var(--sh-sm))" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                            <div>
                                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".5px", color: "rgba(255,255,255,.75)", textTransform: "uppercase" }}>{t("mobile.currentPlan", "Current plan")}</div>
                                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 1 }}>{isPro ? plan.name : t("mobile.planStatusFree", "Free Plan")}</div>
                            </div>
                            <span style={{ background: "rgba(255,255,255,.2)", padding: "4px 10px", borderRadius: 999, fontSize: 10.5, fontWeight: 700 }}>{statusLabel}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.15)" }}>
                            {[
                                { v: expiryText, l: t("mobile.expires", "Expires") },
                                { v: `${teamMembers.length}${loginCap > 0 ? `/${loginCap}` : ""}`, l: t("mobile.staffLoginsLabel", "Staff Logins") },
                                { v: billingText, l: t("mobile.billing", "Billing") },
                            ].map((s, i) => (
                                <div key={s.l} style={{ flex: 1, display: "flex", minWidth: 0 }}>
                                    {i > 0 && <span style={{ width: 1, background: "rgba(255,255,255,.2)", margin: "0 10px", flex: "none" }} />}
                                    <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
                                        <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.v}</div>
                                        <div style={{ fontSize: 10, color: "rgba(255,255,255,.7)" }}>{s.l}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                            <span style={{ background: "#fff", color: "var(--c-primary)", padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>{t("common.upgradePlan", "Upgrade plan")}</span>
                        </div>
                    </div>
                )}

                {/* Franchise — only when the plan covers more than one shop */}
                {isOwner && (ownedShops?.length || 0) > 1 && (
                    <div>
                        <div style={sectionTitle}>{t("mobile.franchise", "Franchise")}</div>
                        <div style={card}>
                            <Row icon={<Store size={17} />} tint="c-primary" title={t("shops.allShops", "All shops")} sub={`${ownedShops!.length} ${t("shops.shops", "shops")}`} onClick={() => navigate("/shops")} />
                            <Row icon={<Building2 size={17} />} tint="c-violet" title={t("shops.addShop", "Add shop")} sub={t("shops.addShopSub", "Open a new branch")} onClick={() => navigate("/shops/new")} last />
                        </div>
                    </div>
                )}

                {/* Services & Items */}
                <div>
                    <div style={sectionTitle}>{t("mobile.servicesItems", "Services & Items")}</div>
                    <div style={card}>
                        <Row icon={<Package size={17} />} tint="c-primary" title={t("mobile.manageServices", "Manage Services")} sub={t("mobile.manageServicesSub", "Add/edit service categories & pricing")} onClick={() => navigate("/inventory")} />
                        <Row icon={<ShoppingCart size={17} />} tint="c-warning" title={t("mobile.manageItems", "Manage Items")} sub={t("mobile.manageItemsSub", "Configure clothing items & prices")} onClick={() => navigate("/inventory")} />
                        <Row icon={<MapPin size={17} />} tint="c-success" title={t("mobile.serviceAreas", "Service Areas")} sub={t("mobile.serviceAreasSub", "Delivery areas & per-area agents")} onClick={() => navigate("/delivery-settings")} last />
                    </div>
                </div>

                {/* Staff & Attendance */}
                <div>
                    <div style={sectionTitle}>{t("mobile.staffSection", "Staff & Attendance")}</div>
                    <div style={card}>
                        <Row icon={<UserCog size={17} />} tint="c-primary" title={t("nav.staff", "Staff")} sub={t("mobile.staffSub", "Roster, app logins & payroll setup")} onClick={() => navigate("/manage-staff")} />
                        <Row icon={<Calendar size={17} />} tint="c-info" title={t("nav.attendance", "Attendance")} sub={t("mobile.attendanceSub", "Mark daily attendance")} onClick={() => navigate("/attendance")} />
                        <Row icon={<IndianRupee size={17} />} tint="c-success" title={t("nav.payroll", "Payroll")} sub={t("mobile.payrollSub", "Salaries & payments")} onClick={() => navigate("/payroll")} last />
                    </div>
                </div>

                {/* Finance */}
                <div>
                    <div style={sectionTitle}>{t("mobile.financeSection", "Finance")}</div>
                    <div style={card}>
                        <Row icon={<Receipt size={17} />} tint="c-warning" title={t("nav.expenses", "Expenses")} sub={t("mobile.expensesSub", "Track shop spending")} onClick={() => navigate("/expenses")} />
                        <Row icon={<FileText size={17} />} tint="c-violet" title={t("nav.reports", "Reports")} sub={t("mobile.reportsSub", "Revenue, profit & trends")} onClick={() => navigate("/reports")} />
                        {isOwner && <Row icon={<CreditCard size={17} />} tint="c-primary" title={t("nav.paymentHistory", "Payment history")} sub={t("mobile.paymentHistorySub", "Your subscription invoices")} onClick={() => navigate("/settings/payment-history")} />}
                        <Row icon={<BadgePercent size={17} />} tint="c-error" title={t("nav.offers", "Offers")} sub={t("mobile.offersSub", "Coupons & loyalty points")} onClick={() => navigate("/settings/offers")} last />
                    </div>
                </div>

                {/* Business */}
                <div>
                    <div style={sectionTitle}>{t("mobile.businessSection", "Business")}</div>
                    <div style={card}>
                        <Row icon={<Store size={17} />} tint="c-primary" title={t("settings.businessProfile", "Business profile")} sub={t("mobile.businessProfileSub", "Shop identity, contact & location")} onClick={() => navigate("/settings?section=business")} />
                        <Row icon={<Receipt size={17} />} tint="c-violet" title={t("settings.taxCurrency", "Tax & currency")} sub={t("mobile.taxSub", "Country, currency & tax")} onClick={() => navigate("/settings?section=tax")} />
                        <Row icon={<Globe size={17} />} tint="c-cyan" title={t("publicPage.title", "Public ordering page")} sub={t("mobile.publicPageSub", "Let customers book online")} onClick={() => navigate("/settings/public-page")} />
                        <Row icon={<QrCode size={17} />} tint="c-info" title={t("common.scan", "Scan")} sub={t("mobile.scanSub", "Look up an order by QR/barcode")} onClick={() => navigate("/scan")} last />
                    </div>
                </div>

                {/* Appearance & Language */}
                <div>
                    <div style={sectionTitle}>{t("mobile.appearance", "Appearance & Language")}</div>
                    <div style={{ ...card, padding: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                            <span style={{ width: 34, height: 34, flex: "none", borderRadius: 10, background: "var(--c-warning-soft)", color: "var(--c-warning)", display: "flex", alignItems: "center", justifyContent: "center" }}><Palette size={17} /></span>
                            <span style={{ fontSize: 14, fontWeight: 600 }}>{t("settings.language", "Language")}</span>
                        </div>
                        <LLanguageSelector variant="dropdown" showLabel={false} />
                    </div>
                </div>

                {/* Get the app — a permanent home for the store links, so the
                    promo banner isn't the only way to reach them. */}
                <div>
                    <div style={sectionTitle}>{t("appPromo.section", "Get the mobile app")}</div>
                    <div style={{ ...card, padding: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                            <span style={{ width: 40, height: 40, flex: "none", borderRadius: 11, background: "var(--c-primary-soft)", color: "var(--c-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}><Smartphone size={20} /></span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{t("appPromo.title", "Get the Laundrybill app")}</span>
                                <span style={{ display: "block", fontSize: 11.5, color: "var(--c-text-3)", marginTop: 1 }}>{t("appPromo.body", "Run your shop from your phone — orders, billing and instant notifications.")}</span>
                            </span>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            {(detectMobileOS() === "ios"
                                ? [{ id: "appstore", label: "App Store", icon: <Apple size={16} fill="currentColor" />, url: APP_STORE_URL }, { id: "play", label: "Google Play", icon: <Play size={15} fill="currentColor" />, url: GOOGLE_PLAY_URL }]
                                : [{ id: "play", label: "Google Play", icon: <Play size={15} fill="currentColor" />, url: GOOGLE_PLAY_URL }, { id: "appstore", label: "App Store", icon: <Apple size={16} fill="currentColor" />, url: APP_STORE_URL }]
                            ).map((st, i) => (
                                <a key={st.id} href={st.url} target="_blank" rel="noopener noreferrer"
                                    style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px 8px", borderRadius: 11, textDecoration: "none", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
                                        color: i === 0 ? "#fff" : "var(--c-text)", background: i === 0 ? "var(--c-primary)" : "var(--c-surface-2)", border: `1px solid ${i === 0 ? "var(--c-primary)" : "var(--c-border-strong)"}` }}>
                                    {st.icon}{st.label}
                                </a>
                            ))}
                        </div>
                    </div>
                </div>

                {/* About & Support */}
                <div>
                    <div style={sectionTitle}>{t("mobile.about", "About & Support")}</div>
                    <div style={card}>
                        <Row icon={<Smartphone size={17} />} tint="c-primary" title={t("nav.apps", "Apps")} sub={t("mobile.appsSub", "Download the mobile apps")} onClick={() => navigate("/apps")} />
                        <Row icon={<HelpCircle size={17} />} tint="c-info" title={t("nav.help", "Help & support")} sub={t("mobile.helpSub", "Guides and contact")} onClick={() => navigate("/help")} last />
                    </div>
                </div>

                {/* Account */}
                <div>
                    <div style={sectionTitle}>{t("mobile.account", "Account")}</div>
                    <div style={card}>
                        <button onClick={signOut} style={{ width: "100%", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", font: "inherit", textAlign: "left", border: 0, background: "transparent", color: "var(--c-error)" }}>
                            <span style={{ width: 34, height: 34, flex: "none", borderRadius: 10, background: "var(--c-error-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}><LogOut size={17} /></span>
                            <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{t("auth.signOut", "Sign out")}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
