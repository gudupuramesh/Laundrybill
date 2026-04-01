/**
 * Customers List Component
 * 
 * Used within master-detail layout on desktop
 * Displays searchable list of customers with stats
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    LSearchInput,
    LList,
    LListItem,
    LAvatar,
    LAmount,
    LEmptyState,
    LSkeletonList,
    LButton,
    LStatCard,
    LAdSlot,
} from "@/components/laundry";
import { useCustomers, useCustomerStats } from "@/hooks/use-customers";
import { useIsMobile } from "@/hooks/use-mobile";
import { useShopLimits } from "@/hooks/use-shop-limits";
import { CustomerFormSheet } from "./CustomerFormSheet";
import { useLToast } from "@/components/laundry";
import { Users, UserPlus, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const AD_FREQUENCY = 8; // Show ad every 8 customers on mobile

interface CustomersListProps {
    selectedId?: string | null;
    onSelect?: (customerId: string) => void;
}

export function CustomersList({ selectedId, onSelect }: CustomersListProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const [searchQuery, setSearchQuery] = useState("");
    const [formSheetOpen, setFormSheetOpen] = useState(false);

    const { customers, loading, hasMore, loadMore, createCustomer } = useCustomers(searchQuery);
    const stats = useCustomerStats();
    const { checkLimit } = useShopLimits();
    const { addToast } = useLToast();

    const customerLimit = checkLimit("maxCustomers", stats.totalCustomers);
    const handleAddCustomer = () => {
        if (!customerLimit.allowed) {
            addToast({
                type: "error",
                title: t("customers.limitReached", "Customer limit reached"),
                description: t("customers.limitReachedDesc", `Your plan allows up to ${customerLimit.limit} customers. Upgrade to add more.`),
            });
            return;
        }
        setFormSheetOpen(true);
    };

    const handleCreateCustomer = async (data: any) => {
        try {
            const customer = await createCustomer(data);
            if (customer) {
                setFormSheetOpen(false);
                if (onSelect) {
                    onSelect(customer.id);
                } else {
                    navigate(`/customers/${customer.id}`);
                }
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

    const handleCustomerClick = (customerId: string) => {
        if (onSelect) {
            onSelect(customerId);
        } else {
            navigate(`/customers/${customerId}`);
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header with stats */}
            <div className="sticky top-0 z-10 bg-card p-4 space-y-4 border-b border-border">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                    <LStatCard
                        icon={<Users className="h-4 w-4" />}
                        title={t('customers.total')}
                        value={stats.totalCustomers}
                        variant="primary"
                    />
                    <LStatCard
                        icon={<UserPlus className="h-4 w-4" />}
                        title={t('customers.newMonth')}
                        value={stats.newThisMonth}
                        variant="success"
                    />
                    <LStatCard
                        icon={<TrendingUp className="h-4 w-4" />}
                        title={t('customers.active')}
                        value={stats.activeCustomers}
                        variant="default"
                    />
                </div>

                {/* Title + Add Button */}
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-bold text-foreground">{t('customers.title')}</h1>
                    <LButton
                        variant="primary"
                        size="sm"
                        leftIcon={<UserPlus className="h-4 w-4" />}
                        onClick={handleAddCustomer}
                    >
                        {t('customers.add')}
                    </LButton>
                </div>

                {/* Search */}
                <LSearchInput
                    placeholder={t('customers.searchPlaceholder')}
                    onChange={setSearchQuery}
                />
            </div>

            {/* Customer List */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <LSkeletonList count={8} />
                ) : customers.length === 0 ? (
                    <LEmptyState
                        icon={<Users className="h-8 w-8" />}
                        title={searchQuery ? t('customers.noResults') : t('customers.empty')}
                        description={
                            searchQuery
                                ? t('customers.tryDifferentSearch')
                                : t('customers.addFirst')
                        }
                        action={
                            !searchQuery
                                ? {
                                    label: t('customers.addCustomer'),
                                    onClick: handleAddCustomer,
                                }
                                : undefined
                        }
                    />
                ) : (
                    <>
                        <LList>
                            {customers.map((customer, index) => (
                                <React.Fragment key={customer.id}>
                                    <LListItem
                                        title={customer.name}
                                        subtitle={customer.phone}
                                        leftContent={<LAvatar name={customer.name} size="md" />}
                                        rightContent={
                                            <div className="text-right">
                                                <LAmount value={customer.totalSpent} size="sm" />
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {customer.totalOrders} {t('customers.orders')}
                                                </p>
                                            </div>
                                        }
                                        onClick={() => handleCustomerClick(customer.id)}
                                        className={cn(
                                            "cursor-pointer transition-colors",
                                            selectedId === customer.id &&
                                            "bg-primary-muted border-l-4 border-l-primary"
                                        )}
                                    />
                                    {/* Mobile: Show ad card every N items */}
                                    {isMobile && (index + 1) % AD_FREQUENCY === 0 && (
                                        <LAdSlot
                                            variant="card"
                                            position={`customers-list-${index + 1}`}
                                        />
                                    )}
                                </React.Fragment>
                            ))}
                        </LList>

                        {hasMore && (
                            <div className="text-center py-4">
                                <LButton variant="ghost" onClick={loadMore}>
                                    {t('common.loadMore')}
                                </LButton>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Add Customer Sheet */}
            <CustomerFormSheet
                open={formSheetOpen}
                onClose={() => setFormSheetOpen(false)}
                onSubmit={handleCreateCustomer}
            />
        </div>
    );
}
