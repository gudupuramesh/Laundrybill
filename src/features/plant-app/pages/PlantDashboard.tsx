import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useDriverAuth } from "@/features/driver-app/DriverAuthContext";
import {
    LCard,
    LStatCard,
    LButton,
    LBadge,
    LSpinner
} from "@/components/laundry";
import {
    Package,
    RotateCw,
    CheckCircle2,
    Truck,
    ArrowRight,
    Scan
} from "lucide-react";
import type { Order } from "@/types/order";
import { startOfDay } from "date-fns";

export function PlantDashboard() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { agent, shopId } = useDriverAuth();

    // State
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        inbound: 0,
        processing: 0,
        ready: 0,
        completedToday: 0
    });
    const [recentInbound, setRecentInbound] = useState<Order[]>([]);

    useEffect(() => {
        if (!shopId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const ordersRef = collection(db, "shops", shopId, "orders");
                const todayStart = startOfDay(new Date());

                // 1. Inbound Count (pickup_completed OR pending & not home pickup)
                // Since we can't do complex OR queries easily, we'll fetch all active and filter
                // Or simpler: just fetch pickup_completed + pending
                const inboundQ = query(ordersRef, where("status", "in", ["pickup_completed", "pending"]));
                const inboundSnap = await getDocs(inboundQ);
                const inboundCount = inboundSnap.docs.filter(doc => {
                    const data = doc.data();
                    if (data.status === "pickup_completed") return true;
                    if (data.status === "pending" && data.deliveryType !== "pickup_home") return true;
                    return false;
                }).length;

                // 2. Processing Count
                const processingQ = query(ordersRef, where("status", "==", "processing"));
                const processingSnap = await getDocs(processingQ);

                // 3. Ready Count (ready + ready_for_pickup)
                const readyQ = query(ordersRef, where("status", "in", ["ready", "ready_for_pickup"]));
                const readySnap = await getDocs(readyQ);

                // 4. Completed Today (out_for_delivery, delivered, picked_up updated today)
                // Note: out_for_delivery is "dispatched" which is sufficient for "Outbound" stat
                const dispatchedQ = query(
                    ordersRef,
                    where("status", "in", ["out_for_delivery", "delivered", "picked_up"]),
                    where("updatedAt", ">=", Timestamp.fromDate(todayStart))
                );
                const dispatchedSnap = await getDocs(dispatchedQ);

                setStats({
                    inbound: inboundCount,
                    processing: processingSnap.size,
                    ready: readySnap.size,
                    completedToday: dispatchedSnap.size
                });

                // 5. Recent Inbound Orders (Limit 5)
                // Ideally this should use the same filter logic, but for simplicity we'll just show pickup_completed
                // or we filter client side after fetching a batch
                const recentQ = query(
                    ordersRef,
                    where("status", "in", ["pickup_completed", "pending"]),
                    orderBy("createdAt", "desc"),
                    limit(20)
                );
                const recentSnap = await getDocs(recentQ);
                const recentList = recentSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Order))
                    .filter(o => {
                        if (o.status === "pickup_completed") return true;
                        if (o.status === "pending" && o.deliveryType !== "pickup_home") return true;
                        return false;
                    })
                    .slice(0, 5);

                setRecentInbound(recentList);

            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [shopId]);

    if (loading) {
        return <div className="flex h-screen items-center justify-center"><LSpinner size="lg" /></div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">
                    {t('plant.dashboard', 'Plant Dashboard')}
                </h1>
                <p className="text-muted-foreground">
                    {t('plant.welcome', 'Welcome back')}, {agent?.name || 'Operator'}
                </p>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <LStatCard
                    title="Inbound Pending"
                    value={stats.inbound}
                    icon={<Package className="h-5 w-5" />}
                    variant="warning"
                    onClick={() => navigate('/plant/inbound')}
                    className="cursor-pointer hover:border-warning transition-colors"
                />
                <LStatCard
                    title="In Processing"
                    value={stats.processing}
                    icon={<RotateCw className="h-5 w-5" />}
                    variant="primary"
                    onClick={() => navigate('/plant/processing')}
                    className="cursor-pointer hover:border-primary transition-colors"
                />
                <LStatCard
                    title="Ready to Pack"
                    value={stats.ready}
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    variant="success"
                    onClick={() => navigate('/plant/ready')}
                    className="cursor-pointer hover:border-success transition-colors"
                />
                <LStatCard
                    title="Dispatched Today"
                    value={stats.completedToday}
                    icon={<Truck className="h-5 w-5" />}
                    variant="default"
                    onClick={() => navigate('/plant/completed')}
                    className="cursor-pointer hover:border-border transition-colors"
                />
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {/* Main Action Area */}
                <div className="md:col-span-2 space-y-6">
                    {/* Quick Lookup */}
                    <LCard className="bg-primary/5 border-primary/20">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Scan className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg">Quick Identity Scan</h3>
                                    <p className="text-sm text-muted-foreground">Scan any bag tag or garment tag to see details</p>
                                </div>
                            </div>
                            <LButton
                                size="lg"
                                onClick={() => navigate('/plant/scan')}
                                leftIcon={<Scan className="h-5 w-5" />}
                            >
                                Open Scanner
                            </LButton>
                        </div>
                    </LCard>

                    {/* Recent Inbound List */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">New Arrivals (Inbound)</h2>
                            <LButton variant="ghost" size="sm" onClick={() => navigate('/plant/inbound')}>
                                View All <ArrowRight className="ml-2 h-4 w-4" />
                            </LButton>
                        </div>

                        {/* Order List Card */}
                        <div className="space-y-3">
                            {recentInbound.length === 0 ? (
                                <LCard className="p-8 text-center text-muted-foreground">
                                    No pending orders
                                </LCard>
                            ) : (
                                recentInbound.map((order) => (
                                    <LCard key={order.id} variant="outlined" padding="md" className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xs">
                                                {order.orderNumber}
                                            </div>
                                            <div>
                                                <p className="font-medium">{order.customerName}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {order.items?.length || 0} Items • {order.deliveryType === 'pickup_store' ? 'Shop Pickup' : 'Delivery'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <LBadge variant="warning">{order.status === 'pickup_completed' ? 'Arrived' : 'New'}</LBadge>
                                            <LButton
                                                size="sm"
                                                variant="outline"
                                                onClick={() => navigate(`/plant/orders/${order.id}`)}
                                            >
                                                View
                                            </LButton>
                                        </div>
                                    </LCard>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar / Plant Status */}
                <div className="space-y-6">
                    <LCard title="Plant Status">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Operator</span>
                                <span className="font-medium text-success">Online</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Pending Orders</span>
                                <span className="font-medium">{stats.inbound}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Completed Today</span>
                                <span className="font-medium text-primary">{stats.completedToday}</span>
                            </div>
                        </div>
                    </LCard>
                </div>
            </div>
        </div>
    );
}
