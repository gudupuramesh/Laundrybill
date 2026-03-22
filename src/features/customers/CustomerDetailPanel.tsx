/**
 * Customer Detail Panel
 * 
 * Used within master-detail layout on desktop
 * Displays full customer details inline
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    LCard,
    LButton,
    LAvatar,
    LAmount,
    LList,
    LListItem,
    LStatusBadge,
    LDateDisplay,
    LEmptyState,
    LSpinner,
    LDivider,
    LActionSheet,
} from "@/components/laundry";
import { useCustomer, useCustomers } from "@/hooks/use-customers";
import { useOrders } from "@/hooks/use-orders";
import { CustomerFormSheet } from "./CustomerFormSheet";
import {
    ArrowLeft,
    MoreVertical,
    Phone,
    MessageCircle,
    Edit,
    Trash2,
    ClipboardList,
    IndianRupee,
    Calendar,
    MapPin,
    Mail,
} from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

interface CustomerDetailPanelProps {
    customerId: string;
    onClose?: () => void;
}

export function CustomerDetailPanel({ customerId, onClose }: CustomerDetailPanelProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { customer, loading } = useCustomer(customerId);
    const { orders, loading: ordersLoading } = useOrders({ customerId });
    const { updateCustomer } = useCustomers();

    const [editSheetOpen, setEditSheetOpen] = useState(false);
    const [actionSheetOpen, setActionSheetOpen] = useState(false);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <LSpinner size="lg" />
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <p className="text-lg font-medium">{t('customers.notFound')}</p>
                <LButton variant="ghost" className="mt-4" onClick={onClose}>
                    {t('common.goBack')}
                </LButton>
            </div>
        );
    }

    const handleUpdateCustomer = async (data: any) => {
        await updateCustomer(customer.id, data);
        setEditSheetOpen(false);
    };

    return (
        <div className="h-full overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        {onClose && (
                            <LButton variant="ghost" size="icon-sm" onClick={onClose}>
                                <ArrowLeft className="h-5 w-5" />
                            </LButton>
                        )}
                        <LAvatar name={customer.name} size="xl" />
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">{customer.name}</h1>
                            <p className="text-muted-foreground">{customer.phone}</p>
                        </div>
                    </div>
                    <LButton
                        variant="ghost"
                        size="icon"
                        onClick={() => setActionSheetOpen(true)}
                    >
                        <MoreVertical className="h-5 w-5" />
                    </LButton>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-6">
                {/* Quick Actions */}
                <div className="flex gap-2">
                    <LButton
                        variant="outline"
                        size="sm"
                        leftIcon={<Phone className="h-4 w-4" />}
                        onClick={() => window.open(`tel:${customer.phone}`)}
                    >
                        {t('common.call')}
                    </LButton>
                    <LButton
                        variant="outline"
                        size="sm"
                        leftIcon={<MessageCircle className="h-4 w-4" />}
                        onClick={() => window.open(`https://wa.me/91${customer.phone}`)}
                    >
                        {t('common.whatsapp')}
                    </LButton>
                    <LButton
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/new-order?customerId=${customer.id}`)}
                    >
                        {t('customers.newOrder')}
                    </LButton>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                    <LCard variant="filled" padding="md">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary-muted flex items-center justify-center">
                                <ClipboardList className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">{customer.totalOrders}</p>
                                <p className="text-xs text-muted-foreground">{t('customers.totalOrders')}</p>
                            </div>
                        </div>
                    </LCard>
                    <LCard variant="filled" padding="md">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-success-muted flex items-center justify-center">
                                <IndianRupee className="h-5 w-5 text-success" />
                            </div>
                            <div>
                                <LAmount value={customer.totalSpent} size="xl" />
                                <p className="text-xs text-muted-foreground">{t('customers.totalSpent')}</p>
                            </div>
                        </div>
                    </LCard>
                </div>

                {/* Customer Details */}
                <LCard variant="outlined" padding="md">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">{t('customers.details')}</h3>
                    <div className="space-y-3">
                        {customer.email && (
                            <div className="flex items-center gap-3">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm text-foreground">{customer.email}</span>
                            </div>
                        )}
                        {customer.address && (
                            <div className="flex items-start gap-3">
                                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                                <span className="text-sm text-foreground">{customer.address}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-foreground">
                                {t('customers.customerSince')} <LDateDisplay date={customer.createdAt?.toDate()} format="date" />
                            </span>
                        </div>
                        {customer.lastOrderAt && (
                            <div className="flex items-center gap-3">
                                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm text-foreground">
                                    {t('customers.lastOrder')} <LDateDisplay date={customer.lastOrderAt.toDate()} format="relative" />
                                </span>
                            </div>
                        )}
                    </div>

                    {customer.notes && (
                        <>
                            <LDivider className="my-3" />
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">{t('customers.notes')}</p>
                                <p className="text-sm text-foreground">{customer.notes}</p>
                            </div>
                        </>
                    )}
                </LCard>

                {/* Order History */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-foreground">{t('customers.orderHistory')}</h3>
                        {orders.length > 0 && (
                            <LButton
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/orders?customerId=${customer.id}`)}
                            >
                                {t('common.viewAll')}
                            </LButton>
                        )}
                    </div>

                    {ordersLoading ? (
                        <LSpinner size="md" />
                    ) : orders.length === 0 ? (
                        <LCard variant="outlined" padding="none">
                            <LEmptyState
                                icon={<ClipboardList className="h-6 w-6" />}
                                title={t('customers.noOrders')}
                                description={t('customers.noOrdersDesc')}
                                action={{
                                    label: t('customers.createOrder'),
                                    onClick: () => navigate(`/new-order?customerId=${customer.id}`),
                                }}
                            />
                        </LCard>
                    ) : (
                        <LList>
                            {orders.slice(0, 5).map((order) => (
                                <LListItem
                                    key={order.id}
                                    title={`#${order.publicId}`}
                                    subtitle={`${order.items.length} ${t('pos.items')} • ${format(order.createdAt.toDate(), "MMM d, yyyy")}`}
                                    rightContent={
                                        <div className="text-right">
                                            <LAmount value={order.financials.total} size="sm" />
                                            <div className="mt-1">
                                                <LStatusBadge status={order.status} size="sm" />
                                            </div>
                                        </div>
                                    }
                                    showChevron
                                    onClick={() => navigate(`/orders/${order.id}`)}
                                />
                            ))}
                        </LList>
                    )}
                </div>
            </div>

            {/* Sheets */}
            <CustomerFormSheet
                open={editSheetOpen}
                onClose={() => setEditSheetOpen(false)}
                customer={customer}
                onSubmit={handleUpdateCustomer}
            />

            <LActionSheet
                open={actionSheetOpen}
                onClose={() => setActionSheetOpen(false)}
                title={t('customers.customerActions')}
                actions={[
                    {
                        id: "edit",
                        label: t('customers.editCustomer'),
                        icon: <Edit className="h-5 w-5" />,
                        onClick: () => { setActionSheetOpen(false); setEditSheetOpen(true); }
                    },
                    {
                        id: "call",
                        label: t('common.call'),
                        icon: <Phone className="h-5 w-5" />,
                        onClick: () => window.open(`tel:${customer.phone}`)
                    },
                    {
                        id: "whatsapp",
                        label: t('common.whatsapp'),
                        icon: <MessageCircle className="h-5 w-5" />,
                        onClick: () => window.open(`https://wa.me/91${customer.phone}`)
                    },
                    {
                        id: "delete",
                        label: t('customers.deleteCustomer'),
                        icon: <Trash2 className="h-5 w-5" />,
                        destructive: true,
                        onClick: () => console.log("Delete customer")
                    },
                ]}
            />
        </div>
    );
}
