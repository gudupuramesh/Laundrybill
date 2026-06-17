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

const EMPTY = { name: "", phone: "", email: "", address: "", area: "" };

export function CustomerDetailsCard({
    customerId,
    customerName,
    customerPhone,
    onSelectCustomer,
    onClearCustomer,
}: CustomerDetailsCardProps) {
    const { t } = useTranslation();
    const { addToast } = useLToast();
    const { customers, createCustomer } = useCustomers();
    const { settings } = useDeliverySettings();
    const { shop } = useShop();
    const country = getCountry(shop?.settings?.countryCode || "IN");

    const [query, setQuery] = useState("");
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);

    const hasSelection = !!(customerName || customerPhone);
    const areaOptions = (settings.serviceAreas || []).filter((a) => a.isActive);
    const useAreaDropdown = settings.enableServiceAreas && areaOptions.length > 0;

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        // No query → show the most recent customers so picking an existing one is obvious
        if (!q) return customers.slice(0, 6);
        return customers
            .filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q))
            .slice(0, 6);
    }, [query, customers]);

    const selectedCustomer = customers.find((c) => c.id === customerId);

    const handleCreate = async () => {
        if (!form.name.trim() || form.phone.length !== country.phoneDigits) return;
        setSaving(true);
        try {
            const created = await createCustomer({
                name: form.name,
                phone: form.phone,
                email: form.email || undefined,
                address: form.address || undefined,
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
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-extrabold text-foreground">{t('customer.customerDetails', 'Customer Details')}</h2>
                {!showAdd && (
                    <LButton
                        variant="outline"
                        size="sm"
                        leftIcon={<UserPlus className="h-4 w-4" />}
                        onClick={() => { setShowAdd(true); onClearCustomer(); }}
                    >
                        {t('customer.quickAdd', 'Quick-Add Customer')}
                    </LButton>
                )}
            </div>

            {/* Selected customer */}
            {hasSelection && !showAdd ? (
                <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <LAvatar name={customerName || customerPhone || "?"} size="md" />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-foreground">{customerName || t('customer.guest', 'Guest')}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            {customerPhone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{customerPhone}</span>}
                            {selectedCustomer?.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{selectedCustomer.email}</span>}
                            {selectedCustomer?.area && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{selectedCustomer.area}</span>}
                        </div>
                    </div>
                    <button
                        onClick={onClearCustomer}
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title={t('common.change', 'Change')}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ) : showAdd ? (
                /* Quick-add form */
                <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <LTextInput
                            label={t('customer.name', 'Name')}
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value.replace(/[0-9]/g, "") })}
                            placeholder={t('customers.namePlaceholder', 'Full name')}
                            required
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
                    <LTextArea
                        label={t('customers.addressOptional', 'Address (optional)')}
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        placeholder={t('customers.addressPlaceholder', 'Door no, street, landmark…')}
                        minRows={2}
                    />
                    <div className="flex gap-2 pt-1">
                        <LButton variant="ghost" onClick={() => { setShowAdd(false); setForm(EMPTY); }}>
                            {t('common.cancel', 'Cancel')}
                        </LButton>
                        <LButton
                            variant="primary"
                            fullWidth
                            loading={saving}
                            disabled={!form.name.trim() || form.phone.length !== country.phoneDigits}
                            onClick={handleCreate}
                        >
                            {t('customer.addAndSelect', 'Add & Select')}
                        </LButton>
                    </div>
                </div>
            ) : (
                /* Search */
                <div className="space-y-2">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t('customer.searchByNamePhone', 'Search by customer name or phone number…')}
                            className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                    {results.length > 0 && (
                        <div className="overflow-hidden rounded-xl border border-border divide-y divide-border">
                            {results.map((c) => (
                                <button
                                    key={c.id}
                                    onClick={() => { onSelectCustomer(c); setQuery(""); }}
                                    className="flex w-full items-center gap-3 p-2.5 text-left transition-colors hover:bg-muted/50"
                                >
                                    <LAvatar name={c.name} size="sm" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                                        <p className="text-xs text-muted-foreground">{c.phone}{c.area ? ` · ${c.area}` : ""}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
