import { useState, useEffect, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useDriverAuth } from "@/features/driver-app/DriverAuthContext";
import {
    Package,
    RotateCw,
    CheckCircle2,
    Truck,
    ArrowRight,
    Scan,
    Loader2
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
        return (
            <div style={{ display: "flex", height: "100%", minHeight: 320, alignItems: "center", justifyContent: "center" }}>
                <Loader2 className="animate-spin" size={28} style={{ color: "var(--c-primary)" }} />
            </div>
        );
    }

    const kpis = [
        { label: "Inbound Pending", value: stats.inbound, ref: "c-warning", soft: "c-warning-soft", icon: <Package size={15} />, to: "/plant/inbound" },
        { label: "In Processing", value: stats.processing, ref: "c-primary", soft: "c-primary-soft", icon: <RotateCw size={15} />, to: "/plant/processing" },
        { label: "Ready to Pack", value: stats.ready, ref: "c-success", soft: "c-success-soft", icon: <CheckCircle2 size={15} />, to: "/plant/ready" },
        { label: "Dispatched Today", value: stats.completedToday, ref: "c-cyan", soft: "c-cyan-soft", icon: <Truck size={15} />, to: "/plant/completed" },
    ];

    return (
        <div style={{ color: "var(--c-text)", fontSize: 14, lineHeight: 1.45, padding: "20px 22px 40px" }}>

            {/* ===== Header ===== */}
            <div style={{ marginBottom: 18 }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.01em" }}>
                    {t('plant.dashboard', 'Plant Dashboard')}
                </h1>
                <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--c-text-2)" }}>
                    {t('plant.welcome', 'Welcome back')}, {agent?.name || 'Operator'}
                </p>
            </div>

            {/* ===== KPI ROW ===== */}
            <div className="lb-kpi" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 16 }}>
                {kpis.map((k) => (
                    <div
                        key={k.label}
                        onClick={() => navigate(k.to)}
                        style={{ ...card, padding: "15px 16px", cursor: "pointer" }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <ChipIcon soft={k.soft} refColor={k.ref}>{k.icon}</ChipIcon>
                            <span style={{ fontSize: 11.5, color: "var(--c-text-3)", fontWeight: 500 }}>{k.label}</span>
                        </div>
                        <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 25, letterSpacing: "-.02em", marginTop: 11 }}>{k.value}</div>
                    </div>
                ))}
            </div>

            {/* ===== Main + Sidebar ===== */}
            <div className="lb-row" style={{ display: "flex", gap: 16 }}>

                {/* Main column */}
                <div style={{ flex: 1.7, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>

                    {/* Quick Identity Scan */}
                    <div style={{ ...card, padding: "18px 20px", background: "var(--c-primary-tint)", borderColor: "var(--c-primary)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                                <ChipIcon soft="c-primary-soft" refColor="c-primary"><Scan size={18} /></ChipIcon>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 15, fontWeight: 600 }}>Quick Identity Scan</div>
                                    <div style={{ fontSize: 12.5, color: "var(--c-text-2)" }}>Scan any bag tag or garment tag to see details</div>
                                </div>
                            </div>
                            <button type="button" onClick={() => navigate('/plant/scan')} style={btnPrimary}>
                                <Scan size={16} />Open Scanner
                            </button>
                        </div>
                    </div>

                    {/* New Arrivals (Inbound) */}
                    <div style={{ ...card, overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px 12px", borderBottom: "1px solid var(--c-border)" }}>
                            <ChipIcon soft="c-warning-soft" refColor="c-warning"><Package size={16} /></ChipIcon>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>New Arrivals (Inbound)</div>
                                <div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>Items just received at the plant</div>
                            </div>
                            <button type="button" onClick={() => navigate('/plant/inbound')} style={{ ...btnGhost, marginLeft: "auto", color: "var(--c-primary)" }}>
                                View All <ArrowRight size={15} />
                            </button>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px 16px" }}>
                            {recentInbound.length === 0 ? (
                                <div style={{ padding: "28px 8px", textAlign: "center", color: "var(--c-text-3)", fontSize: 13 }}>
                                    No pending orders
                                </div>
                            ) : (
                                recentInbound.map((order) => (
                                    <div
                                        key={order.id}
                                        style={{ ...card, boxShadow: "none", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                                            <div style={{ width: 42, height: 42, flex: "none", borderRadius: 9, background: "var(--c-warning-soft)", color: "var(--c-warning)", fontFamily: MONO, fontWeight: 700, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 4px" }}>
                                                {order.orderNumber}
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{order.customerName}</div>
                                                <div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>
                                                    {order.items?.length || 0} Items • {order.deliveryType === 'pickup_store' ? 'Shop Pickup' : 'Delivery'}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: "var(--c-warning-soft)", color: "var(--c-warning)" }}>
                                                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--c-warning)" }} />
                                                {order.status === 'pickup_completed' ? 'Arrived' : 'New'}
                                            </span>
                                            <button type="button" onClick={() => navigate(`/plant/orders/${order.id}`)} style={btnOutline}>
                                                View
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar — Plant Status */}
                <div style={{ ...card, flex: 1, minWidth: 0, alignSelf: "flex-start" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px 12px", borderBottom: "1px solid var(--c-border)" }}>
                        <ChipIcon soft="c-info-soft" refColor="c-info"><CheckCircle2 size={16} /></ChipIcon>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>Plant Status</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", padding: "6px 18px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--c-border)" }}>
                            <span style={{ fontSize: 13, color: "var(--c-text-2)" }}>Operator</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--c-success)" }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-success)" }} />Online
                            </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--c-border)" }}>
                            <span style={{ fontSize: 13, color: "var(--c-text-2)" }}>Pending Orders</span>
                            <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 14 }}>{stats.inbound}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
                            <span style={{ fontSize: 13, color: "var(--c-text-2)" }}>Completed Today</span>
                            <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 14, color: "var(--c-primary)" }}>{stats.completedToday}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ===== helpers (shared design-system primitives) ===== */
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const card: CSSProperties = {
    background: "var(--c-surface)", border: "1px solid var(--c-border)",
    borderRadius: 12, boxShadow: "var(--sh-sm)",
};
const btnPrimary: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 9, padding: "10px 16px", boxShadow: "var(--sh-sm)" };
const btnOutline: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-surface)", border: "1px solid var(--c-primary)", borderRadius: 9, padding: "10px 16px" };
const btnGhost: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", background: "transparent", border: 0, padding: "8px 10px" };

function ChipIcon({ children, soft, refColor }: { children: ReactNode; soft: string; refColor: string }) {
    return <span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: `var(--${soft})`, color: `var(--${refColor})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</span>;
}
