/**
 * Customer Details card for the billing portal.
 * Search existing customers, show the selected one, or Quick-Add a new
 * customer inline (name · phone · email · address · area).
 */

import { useMemo, useState } from "react";
import {
    LTextInput,
    LPhoneInput,
    LTextArea,
    LSelect,
    LButton,
    LAvatar,
    useLToast,
    LResponsiveDialog,
} from "@/components/laundry";
import { useCustomers } from "@/hooks/use-customers";
import { useDeliverySettings } from "@/hooks/use-delivery-settings";
import { useShop } from "@/hooks/use-shop";
import { getCountry } from "@/config/countries";
import type { Customer } from "@/types/customer";
import { Search, UserPlus, X, MapPin, Phone, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

interface CustomerDetailsCardProps {
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    onSelectCustomer: (customer: Customer) => void;
    onClearCustomer: () => void;
}

const EMPTY = { name: "", phone: "", email: "", flat: "", street: "", pincode: "", area: "" };

export function CustomerDetailsCard({
    customerId,
    customerName,
    customerPhone,
    onSelectCustomer,
    onClearCustomer,
}: CustomerDetailsCardProps) {
    const { t } = useTranslation();
    const { addToast } = useLToast();
    const [query, setQuery] = useState("");
    const { customers, createCustomer } = useCustomers(query);
    const { settings } = useDeliverySettings();
    const { shop } = useShop();
    const country = getCountry(shop?.settings?.countryCode || "IN");

    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);

    const hasSelection = !!(customerName || customerPhone);
    const areaOptions = (settings.serviceAreas || []).filter((a) => a.isActive);
    const useAreaDropdown = settings.enableServiceAreas && areaOptions.length > 0;

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        // No query → hide list by default
        if (!q) return [];
        return customers
            .filter((c) => 
                c.name.toLowerCase().includes(q) || 
                c.phone.includes(q) ||
                (c.email && c.email.toLowerCase().includes(q))
            )
            .slice(0, 6);
    }, [query, customers]);

    const selectedCustomer = customers.find((c) => c.id === customerId);

    const handleCreate = async () => {
        if (!form.name.trim() || form.phone.length !== country.phoneDigits) return;
        setSaving(true);
        const addressParts = [form.flat, form.street, form.pincode].filter(Boolean);
        const combinedAddress = addressParts.length > 0 ? addressParts.join(', ') : undefined;

        try {
            const created = await createCustomer({
                name: form.name,
                phone: form.phone,
                email: form.email || undefined,
                address: combinedAddress,
                area: form.area || undefined,
            });
            if (created) {
                onSelectCustomer(created);
                setForm(EMPTY);
                setShowAdd(false);
                setQuery("");
            }
        } catch (err) {
            if (err instanceof Error && err.message === "DUPLICATE_PHONE") {
                addToast({
                    type: "error",
                    title: t("validation.duplicatePhone", "Duplicate phone"),
                    description: t("validation.duplicatePhoneCustomerDesc", "This mobile number is already used by another customer."),
                });
            } else {
                addToast({ type: "error", title: t("validation.saveError", "Could not save") });
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300">

            {/* Selected customer */}
            {hasSelection ? (
                <div className="relative overflow-hidden flex items-center gap-4 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/6 via-primary/[0.01] to-card p-4 shadow-sm transition-all duration-300">
                    {/* Decorative Background Blob */}
                    <div className="absolute right-0 bottom-0 -translate-x-2 translate-y-6 opacity-[0.03] pointer-events-none select-none">
                        <UserPlus className="h-28 w-28 text-primary" />
                    </div>

                    <LAvatar 
                        name={customerName || customerPhone || "?"} 
                        size="md" 
                        className="shadow-sm border border-primary/10" 
                    />
                    <div className="min-w-0 flex-1 z-10">
                        <p className="truncate text-base font-bold text-foreground">
                            {customerName || t('customer.guest', 'Guest')}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                            {customerPhone && (
                                <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-lg">
                                    <Phone className="h-3.5 w-3.5 text-primary/70" />
                                    <span className="font-semibold">{customerPhone}</span>
                                </span>
                            )}
                            {selectedCustomer?.email && (
                                <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-lg">
                                    <Mail className="h-3.5 w-3.5 text-primary/70" />
                                    <span className="font-semibold truncate max-w-[180px]">{selectedCustomer.email}</span>
                                </span>
                            )}
                            {selectedCustomer?.area && (
                                <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-lg">
                                    <MapPin className="h-3.5 w-3.5 text-primary/70" />
                                    <span className="font-semibold">{selectedCustomer.area}</span>
                                </span>
                            )}
                        </div>
                        {selectedCustomer?.address && (
                            <div className="mt-2 text-xs text-muted-foreground flex items-start gap-1.5 bg-primary/5 p-2 rounded-lg border border-primary/10">
                                <MapPin className="h-3.5 w-3.5 text-primary/70 shrink-0 mt-0.5" />
                                <span className="font-semibold leading-snug">{selectedCustomer.address}</span>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onClearCustomer}
                        className="rounded-xl p-2.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200 z-10 cursor-pointer active:scale-90"
                        title={t('common.change', 'Change')}
                    >
                        <X className="h-4.5 w-4.5" />
                    </button>
                </div>
            ) : (
                /* Search form */
                <div className="space-y-3">
                    <div className="flex gap-3 items-center">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={t('customer.searchByNamePhone', 'Search by customer name or phone number…')}
                                className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <LButton
                            type="button"
                            variant="outline"
                            leftIcon={<UserPlus className="h-4 w-4" />}
                            onClick={() => { setShowAdd(true); onClearCustomer(); }}
                            className="hover:bg-primary/5 border-primary/20 text-primary rounded-xl cursor-pointer shrink-0"
                        >
                            <span className="hidden sm:inline">{t('customer.quickAdd', 'Quick-Add Customer')}</span>
                            <span className="sm:hidden">{t('common.add', 'Add')}</span>
                        </LButton>
                    </div>
                    {results.length > 0 && (
                        <div className="overflow-hidden rounded-xl border border-border divide-y divide-border/60 bg-card/50">
                            {results.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => { onSelectCustomer(c); setQuery(""); }}
                                    className="flex w-full items-center gap-3 p-3 text-left transition-all duration-150 hover:bg-primary/5 hover:translate-x-0.5 cursor-pointer"
                                >
                                    <LAvatar name={c.name} size="sm" className="bg-primary/10 text-primary border border-primary/5" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-bold text-foreground">{c.name}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                            <span>{c.phone}</span>
                                            {c.area && (
                                                <>
                                                    <span className="text-[10px] opacity-40">•</span>
                                                    <span className="truncate">{c.area}</span>
                                                </>
                                            )}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Quick-Add Customer Dialog Modal */}
            <LResponsiveDialog
                open={showAdd}
                onClose={() => { setShowAdd(false); setForm(EMPTY); }}
                title={t('customer.quickAdd', 'Quick-Add Customer')}
                size="lg"
            >
                <div className="space-y-4 pt-1">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <LTextInput
                            label={t('customer.name', 'Name')}
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value.replace(/[0-9]/g, "") })}
                            placeholder={t('customers.namePlaceholder', 'Full name')}
                            required
                            className="focus:ring-2 focus:ring-primary/20"
                        />
                        <LPhoneInput
                            label={t('customer.phone', 'Mobile number')}
                            value={form.phone}
                            onValueChange={(v) => setForm({ ...form, phone: v })}
                            countryCode={country.phoneCode}
                            maxDigits={country.phoneDigits}
                        />
                        <LTextInput
                            label={t('customers.emailOptional', 'Email (optional)')}
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            placeholder="customer@example.com"
                        />
                        {useAreaDropdown ? (
                            <LSelect
                                label={t('checkout.serviceArea', 'Area')}
                                value={form.area}
                                onChange={(v) => setForm({ ...form, area: v })}
                                placeholder={t('customer.selectArea', 'Select area')}
                                options={areaOptions.map((a) => ({ value: a.value, label: a.value }))}
                            />
                        ) : (
                            <LTextInput
                                label={t('customer.areaOptional', 'Area (optional)')}
                                value={form.area}
                                onChange={(e) => setForm({ ...form, area: e.target.value })}
                                placeholder={t('customer.areaPlaceholder', 'Locality / area')}
                            />
                        )}
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <LTextInput
                            label={t('customers.flatOptional', 'Flat / House No.')}
                            value={form.flat}
                            onChange={(e) => setForm({ ...form, flat: e.target.value })}
                            placeholder="Flat 101, Building Name"
                        />
                        <LTextInput
                            label={country.pinLabel || t('customers.pincodeOptional', 'Pincode')}
                            value={form.pincode}
                            onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                            placeholder="123456"
                        />
                        <div className="sm:col-span-2">
                            <LTextArea
                                label={t('customers.streetOptional', 'Street / Landmark')}
                                value={form.street}
                                onChange={(e) => setForm({ ...form, street: e.target.value })}
                                placeholder="Street name, landmark, city"
                                minRows={2}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t border-border mt-2">
                        <LButton 
                            variant="ghost" 
                            onClick={() => { setShowAdd(false); setForm(EMPTY); }}
                            className="rounded-xl cursor-pointer"
                        >
                            {t('common.cancel', 'Cancel')}
                        </LButton>
                        <LButton
                            variant="primary"
                            loading={saving}
                            disabled={!form.name.trim() || form.phone.length !== country.phoneDigits}
                            onClick={handleCreate}
                            className="rounded-xl px-6 cursor-pointer"
                        >
                            {t('customer.addAndSelect', 'Add & Select')}
                        </LButton>
                    </div>
                </div>
            </LResponsiveDialog>
        </section>
    );
}
