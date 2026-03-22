/**
 * Payment History Page
 * Shows subscription payment history for the current shop (subscriptions/{shopId}/payments).
 */

import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PageWrapper } from "@/components/PageWrapper";
import { LCard, LButton, LSpinner, LBadge } from "@/components/laundry";
import { useAuth } from "@/features/auth";
import { useCurrency } from "@/hooks/use-currency";
import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";

const PAYMENT_LIMIT = 100;

type PaymentType = "subscription" | "renewal" | "renewal_failed" | "refund";

interface PaymentRecord {
    id: string;
    type: PaymentType;
    amount?: number;
    currency?: string;
    status?: string;
    method?: string;
    date: Date | null;
    paymentId?: string;
    orderId?: string;
    refundId?: string;
    originalPaymentId?: string;
    errorDescription?: string;
    attemptNumber?: number;
}

function formatType(type: PaymentType): string {
    const m: Record<PaymentType, string> = {
        subscription: "Subscription",
        renewal: "Renewal",
        renewal_failed: "Failed renewal",
        refund: "Refund",
    };
    return m[type] ?? type;
}

export function PaymentHistoryPage() {
    const { shopId } = useAuth();
    const { formatAmount } = useCurrency();
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchPayments() {
            if (!shopId) {
                setLoading(false);
                return;
            }
            try {
                const q = query(
                    collection(db, "subscriptions", shopId, "payments"),
                    orderBy("date", "desc"),
                    limit(PAYMENT_LIMIT)
                );
                const snap = await getDocs(q);
                const list: PaymentRecord[] = snap.docs.map((d) => {
                    const data = d.data();
                    const date = data.date?.toDate?.() ?? null;
                    return {
                        id: d.id,
                        type: (data.type as PaymentType) ?? "subscription",
                        amount: data.amount,
                        currency: data.currency,
                        status: data.status,
                        method: data.method,
                        date,
                        paymentId: data.paymentId,
                        orderId: data.orderId,
                        refundId: data.refundId,
                        originalPaymentId: data.originalPaymentId,
                        errorDescription: data.errorDescription,
                        attemptNumber: data.attemptNumber,
                    };
                });
                setPayments(list);
            } catch (e) {
                console.error("Payment history fetch error:", e);
                setPayments([]);
            } finally {
                setLoading(false);
            }
        }
        fetchPayments();
    }, [shopId]);

    return (
        <PageWrapper>
            <div className="flex items-center gap-2 mb-6">
                <LButton variant="ghost" size="icon" onClick={() => window.history.back()}>
                    <ChevronLeft className="h-5 w-5" />
                </LButton>
                <h1 className="text-2xl font-bold">Payment History</h1>
            </div>

            <div className="space-y-4 pb-20">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                        <LSpinner size="lg" />
                        <p className="text-muted-foreground">Loading payments...</p>
                    </div>
                ) : payments.length === 0 ? (
                    <LCard variant="elevated" className="p-8 text-center">
                        <p className="text-muted-foreground">No payment history yet.</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Subscription and renewal payments will appear here.
                        </p>
                    </LCard>
                ) : (
                    <LCard variant="elevated" className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="px-4 py-3 text-sm font-semibold">Date</th>
                                        <th className="px-4 py-3 text-sm font-semibold">Type</th>
                                        <th className="px-4 py-3 text-sm font-semibold">Amount</th>
                                        <th className="px-4 py-3 text-sm font-semibold">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((p) => (
                                        <tr key={p.id} className="border-b last:border-0">
                                            <td className="px-4 py-3 text-sm">
                                                {p.date ? format(p.date, "MMM d, yyyy · HH:mm") : "—"}
                                            </td>
                                            <td className="px-4 py-3 text-sm">{formatType(p.type)}</td>
                                            <td className="px-4 py-3 text-sm">
                                                {p.amount != null ? formatAmount(p.amount) : "—"}
                                            </td>
                                            <td className="px-4 py-3">
                                                <LBadge
                                                    variant={
                                                        p.status === "success"
                                                            ? "success"
                                                            : p.status === "failed"
                                                                ? "destructive"
                                                                : "secondary"
                                                    }
                                                >
                                                    {p.status ?? "—"}
                                                </LBadge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </LCard>
                )}
            </div>
        </PageWrapper>
    );
}
