/**
 * Customer Detail Panel
 * 
 * Used within master-detail layout on desktop
 * Displays full customer details inline
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    LButton,
    LAvatar,
    LAmount,
    LList,
    LListItem,
    LStatusBadge,
    LDateDisplay,
    LEmptyState,
    LSpinner,
    LActionSheet,
} from "@/components/laundry";
import { useCustomer, useCustomers } from "@/hooks/use-customers";
import { useOrders } from "@/hooks/use-orders";
import { useShop } from "@/hooks/use-shop";
import { buildWaPhone } from "@/lib/whatsappShare";
import { CustomerFormSheet } from "./CustomerFormSheet";
import {
    ArrowLeft,
    MoreVertical,
    Phone,
    MessageCircle,
    Edit,
    Trash2,
    ClipboardList,
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
    const { shop } = useShop();

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
        <div className="h-full overflow-y-auto bg-[#F4F6FA] dark:bg-background">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-card border-b border-border/50 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {onClose && (
                            <LButton variant="ghost" size="icon-sm" onClick={onClose} className="rounded-full hover:bg-muted">
                                <ArrowLeft className="h-5 w-5" />
                            </LButton>
                        )}
                        <h1 className="text-lg font-extrabold text-foreground">{t('customers.title', 'Customer Profile')}</h1>
                    </div>
                    <LButton
                        variant="ghost"
                        size="icon"
                        className="rounded-full hover:bg-muted"
                        onClick={() => setActionSheetOpen(true)}
                    >
                        <MoreVertical className="h-5 w-5" />
                    </LButton>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 pb-24">
                
                {/* Profile Card */}
                <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-sm flex flex-col items-center text-center">
                    <LAvatar name={customer.name} size="xl" className="mb-3" />
                    <h2 className="text-2xl font-extrabold text-foreground">{customer.name}</h2>
                    <p className="text-sm font-semibold text-muted-foreground mt-1">{customer.phone}</p>
                    
                    {/* Action buttons row */}
                    <div className="grid grid-cols-[1fr_1fr_1.2fr] gap-2 w-full mt-5">
                        <button
                            onClick={() => window.open(`tel:${customer.phone}`)}
                            className="py-3 px-2 flex items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold border border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted transition-colors"
                        >
                            <Phone className="h-4 w-4" />
                            {t('common.call', 'Call')}
                        </button>
                        <button
                            onClick={() => window.open(`https://wa.me/${buildWaPhone(customer.phone, shop || undefined)}`)}
                            className="py-3 px-2 flex items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold border border-border/60 bg-muted/20 text-muted-foreground hover:bg-[#25D366]/10 hover:text-[#25D366] transition-colors"
                        >
                            <MessageCircle className="h-4 w-4" />
                            {t('common.whatsapp', 'WhatsApp')}
                        </button>
                        <button
                            onClick={() => navigate(`/new-order?customerId=${customer.id}`)}
                            className="py-3 px-2 flex items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
                        >
                            {t('customers.newOrder', 'New Order')}
                        </button>
                    </div>

                    {/* Notes */}
                    {customer.notes && (
                        <div className="w-full mt-5 pt-4 border-t border-border/50 text-left">
                            <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-1.5">{t('customers.notes', 'Special Instruction')}</p>
                            <p className="text-sm font-bold text-foreground leading-relaxed">{customer.notes}</p>
                        </div>
                    )}
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-card rounded-2xl border border-border/50 p-4 shadow-sm flex flex-col justify-center">
                        <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-1">{t('customers.totalSpent', 'Total Spent')}</p>
                        <p className="text-xl font-black text-success"><LAmount value={customer.totalSpent} /></p>
                    </div>
                    <div className="bg-card rounded-2xl border border-border/50 p-4 shadow-sm flex flex-col justify-center">
                        <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-1">{t('customers.totalOrders', 'Total Orders')}</p>
                        <p className="text-xl font-black text-foreground">{customer.totalOrders}</p>
                    </div>
                </div>

                {/* Details */}
                <div className="bg-card rounded-2xl border border-border/50 p-5 shadow-sm">
                    <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-4">{t('customers.details', 'Details')}</h3>
                    <div className="space-y-4">
                        {customer.email && (
                            <div className="flex items-center gap-3">
                                <Mail className="h-4 w-4 text-primary" />
                                <span className="text-sm font-semibold text-foreground">{customer.email}</span>
                            </div>
                        )}
                        {customer.address && (
                            <div className="flex items-start gap-3">
                                <MapPin className="h-4 w-4 text-primary mt-0.5" />
                                <span className="text-sm font-semibold text-foreground leading-relaxed">{customer.address}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium text-muted-foreground">
                                {t('customers.customerSince', 'Customer since')} <LDateDisplay date={customer.createdAt?.toDate()} format="date" className="font-bold text-foreground inline ml-1" />
                            </span>
                        </div>
                        {customer.lastOrderAt && (
                            <div className="flex items-center gap-3">
                                <ClipboardList className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium text-muted-foreground">
                                    {t('customers.lastOrder', 'Last order')} <LDateDisplay date={customer.lastOrderAt.toDate()} format="relative" className="font-bold text-foreground inline ml-1" />
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Order History */}
                <div>
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">{t('customers.orderHistory', 'Order History')}</h3>
                        {orders.length > 0 && (
                            <LButton
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/orders?customerId=${customer.id}`)}
                                className="h-6 text-xs font-bold rounded-md hover:bg-primary/10 text-primary"
                            >
                                {t('common.viewAll')}
                            </LButton>
                        )}
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">

                    {ordersLoading ? (
                        <div className="p-6 flex justify-center"><LSpinner size="md" /></div>
                    ) : orders.length === 0 ? (
                        <div className="p-6">
                            <LEmptyState
                                icon={<ClipboardList className="h-8 w-8 text-muted-foreground/50" />}
                                title={t('customers.noOrders')}
                                description={t('customers.noOrdersDesc')}
                                action={{
                                    label: t('customers.createOrder'),
                                    onClick: () => navigate(`/new-order?customerId=${customer.id}`),
                                }}
                            />
                        </div>
                    ) : (
                        <LList className="divide-y divide-border/50 border-0">
                            {orders.slice(0, 5).map((order) => (
                                <LListItem
                                    key={order.id}
                                    title={<span className="font-bold text-sm">#{order.publicId}</span>}
                                    subtitle={<span className="font-medium text-xs text-muted-foreground mt-0.5">{order.items.length} {t('pos.items')} • {format(order.createdAt.toDate(), "MMM d, yyyy")}</span>}
                                    rightContent={
                                        <div className="text-right flex flex-col items-end gap-1">
                                            <LAmount value={order.financials.total} size="sm" className="font-bold" />
                                            <LStatusBadge status={order.status} size="sm" className="text-[9px] py-0 px-1.5 font-bold tracking-wider uppercase rounded-md" />
                                        </div>
                                    }
                                    showChevron
                                    onClick={() => navigate(`/orders/${order.id}`)}
                                    className="hover:bg-muted/30 transition-colors py-3 px-4 border-0"
                                />
                            ))}
                        </LList>
                    )}
                    </div>
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
                        onClick: () => window.open(`https://wa.me/${buildWaPhone(customer.phone, shop || undefined)}`)
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
