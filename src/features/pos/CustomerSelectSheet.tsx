/**
 * Customer Select Sheet
 * 
 * Select existing customer, create new, or continue as guest
 */

import { useState } from "react";
import {
    LResponsiveDialog,
    LSearchInput,
    LList,
    LListItem,
    LAvatar,
    LButton,
    LPhoneInput,
    LTextInput,
    LEmptyState,
    LDivider,
    LSpacer,
} from "@/components/laundry";
import { useCustomers } from "@/hooks/use-customers";
import type { Customer } from "@/types/customer";
import { useLToast } from "@/components/laundry";
import { User, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";

interface CustomerSelectSheetProps {
    open: boolean;
    onClose: () => void;
    selectedId?: string;
    onSelect: (customer: Customer | null) => void;
    // onGuestCheckout deprecated/removed
    onGuestCheckout?: (phone: string) => void;
}

type Tab = "search" | "new";

export function CustomerSelectSheet({
    open,
    onClose,
    selectedId,
    onSelect,
}: CustomerSelectSheetProps) {
    const { t } = useTranslation();
    const { addToast } = useLToast();
    const [tab, setTab] = useState<Tab>("search");
    const [searchQuery, setSearchQuery] = useState("");
    const [newCustomer, setNewCustomer] = useState({ name: "", phone: "" });

    const { customers, createCustomer } = useCustomers();

    // Filter customers by phone or name
    const filteredCustomers = customers.filter((c) => {
        if (!searchQuery) return false; // Hide by default until user types
        const query = searchQuery.toLowerCase();
        return (
            c.name.toLowerCase().includes(query) ||
            c.phone.includes(query)
        );
    }).slice(0, 8); // Limit to top 8 results for performance

    const handleCreateCustomer = async () => {
        if (!newCustomer.name || !newCustomer.phone) return;

        try {
            const customer = await createCustomer({
                name: newCustomer.name,
                phone: newCustomer.phone,
            });
            if (customer) {
                onSelect(customer);
            }
        } catch (err) {
            if (err instanceof Error && err.message === "DUPLICATE_PHONE") {
                addToast({
                    type: "error",
                    title: t("validation.duplicatePhone"),
                    description: t("validation.duplicatePhoneCustomerDesc", "This mobile number is already used by another customer. Each customer must have a unique phone number."),
                });
            }
        }
    };

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title={t('customer.selectCustomer')}
            size="md"
            snapPoints={[0.9]}
        >
            <div className="space-y-4">
                {/* Tab Buttons */}
                <div className="flex gap-2">
                    <LButton
                        variant={tab === "search" ? "primary" : "ghost"}
                        size="sm"
                        leftIcon={<User className="h-4 w-4" />}
                        onClick={() => setTab("search")}
                    >
                        {t('common.search')}
                    </LButton>
                    <LButton
                        variant={tab === "new" ? "primary" : "ghost"}
                        size="sm"
                        leftIcon={<UserPlus className="h-4 w-4" />}
                        onClick={() => setTab("new")}
                    >
                        {t('customer.newCustomer')}
                    </LButton>
                </div>

                <LDivider />

                {/* Search Tab */}
                {tab === "search" && (
                    <div className="space-y-4">
                        <LSearchInput
                            placeholder={t('customer.searchCustomers')}
                            onChange={setSearchQuery}
                        />

                        {filteredCustomers.length > 0 ? (
                            <LList className="max-h-[300px] overflow-auto">
                                {filteredCustomers.map((customer) => (
                                    <LListItem
                                        key={customer.id}
                                        title={customer.name}
                                        subtitle={customer.phone}
                                        leftContent={<LAvatar name={customer.name} size="sm" />}
                                        rightContent={
                                            selectedId === customer.id ? (
                                                <span className="text-primary">✓</span>
                                            ) : undefined
                                        }
                                        onClick={() => onSelect(customer)}
                                    />
                                ))}
                            </LList>
                        ) : (
                            <LEmptyState
                                icon={<User className="h-6 w-6" />}
                                title={t('customer.noCustomersFound')}
                                description={t('customer.createNew')}
                            />
                        )}
                    </div>
                )}

                {/* New Customer Tab */}
                {tab === "new" && (
                    <div className="space-y-4">
                        <LTextInput
                            label={t('customer.name')}
                            value={newCustomer.name}
                            onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                        />
                        <LPhoneInput
                            label={t('customer.phone')}
                            value={newCustomer.phone}
                            onValueChange={(v) => setNewCustomer({ ...newCustomer, phone: v })}
                        />
                        <LSpacer size="sm" />
                        <LButton
                            variant="primary"
                            fullWidth
                            onClick={handleCreateCustomer}
                            disabled={!newCustomer.name || newCustomer.phone.length !== 10}
                        >
                            {t('customer.createAndSelect')}
                        </LButton>
                    </div>
                )}
            </div>
        </LResponsiveDialog>
    );
}
