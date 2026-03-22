/**
 * Payments Page
 * 
 * Lists all payments with filtering
 */

import { useState } from "react";
import { usePayments, useVerifyPayment, usePaymentStats } from "../hooks/use-payments";
import { useSuperAdmin } from "../SuperAdminAuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { LCard, LPageLoader, LButton, LBottomSheet } from "@/components/laundry";
import {
    Search,
    CreditCard,
    Calendar,
    CheckCircle,
    XCircle,
    Clock,
    RefreshCw,
    Store,
    Check,
    AlertTriangle,
    IndianRupee,
    Filter,
} from "lucide-react";
import { format } from "date-fns";
import type { PaymentStatus } from "@/types/super-admin";
import { cn } from "@/lib/utils";
import { formatCurrencyValue } from "@/hooks/use-currency";

const STATUS_FILTERS: { value: PaymentStatus | "all"; label: string; icon: typeof CreditCard }[] = [
    { value: "all", label: "All", icon: CreditCard },
    { value: "success", label: "Success", icon: CheckCircle },
    { value: "pending", label: "Pending", icon: Clock },
    { value: "failed", label: "Failed", icon: XCircle },
    { value: "refunded", label: "Refunded", icon: RefreshCw },
];

const STATUS_COLORS: Record<PaymentStatus, string> = {
    success: "text-green-600 bg-green-100 dark:bg-green-900/30",
    pending: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30",
    failed: "text-red-600 bg-red-100 dark:bg-red-900/30",
    refunded: "text-gray-600 bg-gray-100 dark:bg-gray-900/30",
};

export function PaymentsPage() {
    const { superAdmin } = useSuperAdmin();
    const isMobile = useIsMobile();
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<PaymentStatus | "all">("all");
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);
    const [verifyingId, setVerifyingId] = useState<string | null>(null);

    const { payments, loading, error, refetch } = usePayments({
        statusFilter,
        searchTerm,
    });
    const { stats, loading: statsLoading } = usePaymentStats();

    const { verifyPayment } = useVerifyPayment();

    const handleVerifyPayment = async (paymentId: string) => {
        if (!superAdmin) return;

        const reference = prompt("Enter payment reference/transaction ID:");
        if (!reference) return;

        const notes = prompt("Add any notes (optional):") || "";

        setVerifyingId(paymentId);
        const success = await verifyPayment(paymentId, reference, notes, superAdmin.id);
        if (success) {
            refetch();
        }
        setVerifyingId(null);
    };

    return (
        <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground">Payments</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Track and manage all platform payments
                </p>
            </div>

            {/* Failed payments alert */}
            {!statsLoading && stats.recentFailedCount > 0 && (
                <div
                    className="flex items-center gap-3 p-4 rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    role="alert"
                >
                    <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                    <div>
                        <p className="font-medium">
                            {stats.recentFailedCount} failed payment{stats.recentFailedCount !== 1 ? "s" : ""} in the last 7 days
                        </p>
                        <p className="text-sm opacity-90">Review failed payments and follow up with shops.</p>
                    </div>
                    <button
                        onClick={() => setStatusFilter("failed")}
                        className="ml-auto px-3 py-1.5 rounded-full text-sm font-medium bg-amber-500/20 hover:bg-amber-500/30 transition-colors"
                    >
                        View failed
                    </button>
                </div>
            )}

            {/* Payment stats: horizontal scroll on mobile (no scrollbar, same-size cards), grid on desktop */}
            {!statsLoading && (
                <div
                    className={cn(
                        isMobile
                            ? "w-full overflow-x-auto overflow-y-hidden scrollbar-hide pb-1 -mx-1 touch-pan-x"
                            : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4"
                    )}
                    style={isMobile ? { WebkitOverflowScrolling: "touch" } : undefined}
                >
                    {isMobile ? (
                        <div className="flex gap-2 flex-nowrap w-max min-w-full px-0.5">
                            <div className="min-w-[100px] shrink-0">
                                <LCard variant="outlined" padding="sm" className="flex flex-col items-center text-center min-h-[72px] justify-center">
                                    <IndianRupee className="h-4 w-4 text-muted-foreground mb-0.5" />
                                    <p className="text-base font-bold leading-tight">{formatCurrencyValue(stats.totalRevenue)}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Revenue</p>
                                </LCard>
                            </div>
                            <div className="min-w-[100px] shrink-0">
                                <LCard variant="outlined" padding="sm" className="flex flex-col items-center text-center min-h-[72px] justify-center">
                                    <CheckCircle className="h-4 w-4 text-green-600 mb-0.5" />
                                    <p className="text-base font-bold leading-tight">{stats.successCount}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Success</p>
                                </LCard>
                            </div>
                            <div className="min-w-[100px] shrink-0">
                                <LCard variant="outlined" padding="sm" className="flex flex-col items-center text-center min-h-[72px] justify-center">
                                    <XCircle className="h-4 w-4 text-red-600 mb-0.5" />
                                    <p className="text-base font-bold leading-tight">{stats.failedCount}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Failed</p>
                                </LCard>
                            </div>
                            <div className="min-w-[100px] shrink-0">
                                <LCard variant="outlined" padding="sm" className="flex flex-col items-center text-center min-h-[72px] justify-center">
                                    <RefreshCw className="h-4 w-4 text-gray-500 mb-0.5" />
                                    <p className="text-base font-bold leading-tight">{stats.refundedCount}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Refunded</p>
                                </LCard>
                            </div>
                            <div className="min-w-[100px] shrink-0">
                                <LCard variant="outlined" padding="sm" className="flex flex-col items-center text-center min-h-[72px] justify-center">
                                    <Clock className="h-4 w-4 text-yellow-600 mb-0.5" />
                                    <p className="text-base font-bold leading-tight">{stats.pendingCount}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pending</p>
                                </LCard>
                            </div>
                        </div>
                    ) : (
                        <>
                            <LCard variant="outlined" padding="sm" className="flex flex-col items-center text-center">
                                <IndianRupee className="h-5 w-5 text-muted-foreground mb-1" />
                                <p className="text-2xl font-bold">{formatCurrencyValue(stats.totalRevenue)}</p>
                                <p className="text-xs text-muted-foreground">Total revenue</p>
                            </LCard>
                            <LCard variant="outlined" padding="sm" className="flex flex-col items-center text-center">
                                <CheckCircle className="h-5 w-5 text-green-600 mb-1" />
                                <p className="text-2xl font-bold">{stats.successCount}</p>
                                <p className="text-xs text-muted-foreground">Success</p>
                            </LCard>
                            <LCard variant="outlined" padding="sm" className="flex flex-col items-center text-center">
                                <XCircle className="h-5 w-5 text-red-600 mb-1" />
                                <p className="text-2xl font-bold">{stats.failedCount}</p>
                                <p className="text-xs text-muted-foreground">Failed</p>
                            </LCard>
                            <LCard variant="outlined" padding="sm" className="flex flex-col items-center text-center">
                                <RefreshCw className="h-5 w-5 text-gray-500 mb-1" />
                                <p className="text-2xl font-bold">{stats.refundedCount}</p>
                                <p className="text-xs text-muted-foreground">Refunded</p>
                            </LCard>
                            <LCard variant="outlined" padding="sm" className="flex flex-col items-center text-center">
                                <Clock className="h-5 w-5 text-yellow-600 mb-1" />
                                <p className="text-2xl font-bold">{stats.pendingCount}</p>
                                <p className="text-xs text-muted-foreground">Pending</p>
                            </LCard>
                        </>
                    )}
                </div>
            )}

            {/* Search + Filter (filter opens bottom sheet) */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search by shop, invoice, or transaction ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-10 pl-10 pr-4 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm md:text-base"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => setFilterSheetOpen(true)}
                    className={cn(
                        "h-10 px-3 rounded-lg border border-input bg-background flex items-center gap-2 shrink-0",
                        "hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                    )}
                    aria-label="Filter by status"
                >
                    <Filter className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground hidden sm:inline">
                        {STATUS_FILTERS.find((f) => f.value === statusFilter)?.label ?? "Filter"}
                    </span>
                </button>
            </div>

            {/* Filter bottom sheet */}
            <LBottomSheet
                open={filterSheetOpen}
                onClose={() => setFilterSheetOpen(false)}
                title="Filter by status"
                snapPoints={[0.4]}
            >
                <div className="p-4 space-y-2">
                    {STATUS_FILTERS.map((filter) => (
                        <button
                            key={filter.value}
                            onClick={() => {
                                setStatusFilter(filter.value);
                                setFilterSheetOpen(false);
                            }}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors",
                                statusFilter === filter.value
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted/50 text-foreground hover:bg-muted"
                            )}
                        >
                            <filter.icon className="h-4 w-4 shrink-0" />
                            {filter.label}
                        </button>
                    ))}
                </div>
            </LBottomSheet>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center h-40">
                    <LPageLoader message="Loading payments..." />
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-destructive">
                    {error}
                </div>
            )}

            {/* Empty State */}
            {!loading && payments.length === 0 && (
                <div className="text-center py-12">
                    <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-1">No payments found</h3>
                    <p className="text-muted-foreground">
                        {searchTerm || statusFilter !== "all"
                            ? "Try adjusting your filters"
                            : "No payments have been recorded yet"}
                    </p>
                </div>
            )}

            {/* Payments List */}
            {!loading && payments.length > 0 && (
                <div className="grid gap-4">
                    {payments.map((payment) => (
                        <LCard
                            key={payment.id}
                            variant="elevated"
                            padding="md"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "w-10 h-10 rounded-lg flex items-center justify-center",
                                        STATUS_COLORS[payment.status]
                                    )}>
                                        {payment.status === "success" && <CheckCircle className="h-5 w-5" />}
                                        {payment.status === "pending" && <Clock className="h-5 w-5" />}
                                        {payment.status === "failed" && <XCircle className="h-5 w-5" />}
                                        {payment.status === "refunded" && <RefreshCw className="h-5 w-5" />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg font-semibold">
                                                {formatCurrencyValue(payment.amount ?? 0)}
                                            </span>
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-full text-xs font-medium capitalize",
                                                STATUS_COLORS[payment.status]
                                            )}>
                                                {payment.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Store className="h-3.5 w-3.5" />
                                                {payment.shopName}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3.5 w-3.5" />
                                                {payment.createdAt?.toDate?.()
                                                    ? format(payment.createdAt.toDate(), "MMM d, yyyy HH:mm")
                                                    : "N/A"
                                                }
                                            </span>
                                            <span className="capitalize">{payment.planId?.replace("_", " ")}</span>
                                            <span className="capitalize">{payment.billingCycle}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                {payment.status === "pending" && (
                                    <LButton
                                        variant="outline"
                                        size="sm"
                                        leftIcon={<Check className="h-4 w-4" />}
                                        loading={verifyingId === payment.id}
                                        onClick={() => handleVerifyPayment(payment.id)}
                                    >
                                        Verify
                                    </LButton>
                                )}
                            </div>

                            {/* Additional details */}
                            <div className="mt-3 pt-3 border-t border-border flex items-center gap-6 text-xs text-muted-foreground">
                                {payment.invoiceNumber && (
                                    <span>Invoice: {payment.invoiceNumber}</span>
                                )}
                                {payment.gatewayPaymentId && (
                                    <span>Gateway ID: {payment.gatewayPaymentId}</span>
                                )}
                                {payment.method && (
                                    <span className="capitalize">Method: {payment.method.replace("_", " ")}</span>
                                )}
                                {payment.manualDetails?.verifiedBy && (
                                    <span className="text-green-600">
                                        ✓ Verified by {payment.manualDetails.verifiedBy}
                                    </span>
                                )}
                            </div>
                        </LCard>
                    ))}
                </div>
            )}
        </div>
    );
}
