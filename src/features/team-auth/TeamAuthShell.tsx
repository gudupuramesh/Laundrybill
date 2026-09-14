/** Shared two-panel layout for Team sign in / sign up — matches the owner LoginPage design. */
import type React from "react";
import { Link } from "react-router-dom";
import { Truck, Factory, UserRound, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export const tl = {
    label: { display: "block", fontSize: 15, fontWeight: 500, color: "#111827", marginBottom: 9 } as React.CSSProperties,
    box: (err?: boolean): React.CSSProperties => ({ display: "flex", alignItems: "center", gap: 12, height: 52, padding: "0 16px", border: `1px solid ${err ? "#DC2626" : "#E5E7EB"}`, borderRadius: 10, background: "#fff" }),
    bare: { flex: 1, minWidth: 0, height: "100%", border: 0, outline: "none", font: "inherit", fontSize: 15.5, color: "#111827", background: "transparent" } as React.CSSProperties,
    primary: (busy?: boolean): React.CSSProperties => ({ width: "100%", height: 52, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, font: "inherit", fontSize: 17, fontWeight: 600, color: "#fff", background: "#1F5EF2", border: 0, borderRadius: 10, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }),
    outline: { width: "100%", height: 52, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, font: "inherit", fontSize: 16, fontWeight: 500, color: "#111827", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, cursor: "pointer", textDecoration: "none" } as React.CSSProperties,
    link: { font: "inherit", color: "#1F5EF2", background: "transparent", border: 0, padding: 0, cursor: "pointer", fontWeight: 500, textDecoration: "none" } as React.CSSProperties,
    error: { fontSize: 14, color: "#B91C1C", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "11px 14px" } as React.CSSProperties,
    success: { fontSize: 14, color: "#166534", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "11px 14px" } as React.CSSProperties,
    icon: { width: 20, height: 20, color: "#9CA3AF", flex: "none" } as React.CSSProperties,
};

export function TeamAuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
    const isMobile = useIsMobile();
    const roles = [
        { icon: UserRound, name: "Counter staff", desc: "Take orders, print tags & bills, mark attendance" },
        { icon: Truck, name: "Delivery agents", desc: "Pickups & deliveries with route, OTP and payments" },
        { icon: Factory, name: "Plant operators", desc: "Scan tags in, process, and mark orders ready" },
    ];
    return (
        <div style={{ minHeight: "100vh", display: "flex", background: "#fff", fontFamily: "inherit" }}>
            {!isMobile && (
                <aside style={{ flex: "1 1 50%", minWidth: 0, background: "#F5F7FB", padding: "40px 48px 36px", display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <img src="/icons/team-login-logo.png" alt="" style={{ width: 50, height: 50, borderRadius: 12 }} />
                        <span style={{ fontSize: 31, fontWeight: 600, letterSpacing: "-.02em", color: "#111827" }}>Laundrybill <span style={{ color: "#1F5EF2" }}>Team</span></span>
                    </div>
                    <h1 style={{ margin: "46px 0 0", fontSize: "clamp(34px, 3.4vw, 52px)", lineHeight: 1.12, fontWeight: 700, letterSpacing: "-.03em", color: "#0B1220" }}>
                        Everyone on your team, <span style={{ color: "#1F5EF2" }}>one app.</span>
                    </h1>
                    <p style={{ margin: "18px 0 0", fontSize: 19, lineHeight: 1.55, color: "#4B5563", maxWidth: 520 }}>
                        Sign in with the login your shop owner created for you. You'll land on the screen for your role.
                    </p>
                    <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 14, maxWidth: 520 }}>
                        {roles.map((r) => (
                            <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 16, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "14px 16px" }}>
                                <span style={{ width: 44, height: 44, borderRadius: 10, background: "#EAF1FF", color: "#1F5EF2", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><r.icon size={22} /></span>
                                <div>
                                    <div style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>{r.name}</div>
                                    <div style={{ fontSize: 14.5, color: "#4B5563", marginTop: 3 }}>{r.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 0" }}>
                        <img src="/img/login-hero.jpg" alt="" style={{ width: "100%", maxWidth: 440, mixBlendMode: "multiply", WebkitMaskImage: "radial-gradient(ellipse 72% 70% at center, #000 62%, transparent 100%)", maskImage: "radial-gradient(ellipse 72% 70% at center, #000 62%, transparent 100%)" }} />
                    </div>
                </aside>
            )}
            <main style={{ flex: "1 1 50%", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: isMobile ? "32px 20px" : "40px 48px" }}>
                <div style={{ width: "100%", maxWidth: 444 }}>
                    {isMobile && (
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
                            <img src="/icons/team-login-logo.png" alt="" style={{ width: 64, height: 64, borderRadius: 16 }} />
                        </div>
                    )}
                    <div style={{ textAlign: "center", marginBottom: 32 }}>
                        <div style={{ fontSize: isMobile ? 30 : 36, fontWeight: 600, letterSpacing: "-.02em", color: "#0B1220" }}>{title}</div>
                        <div style={{ fontSize: 17, color: "#4B5563", marginTop: 10 }}>{subtitle}</div>
                    </div>
                    {children}
                    <Link to="/login" style={{ ...tl.outline, marginTop: 28, justifyContent: "space-between", padding: "0 16px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
                            <img src="/icons/owner-login-logo.png" alt="" style={{ width: 24, height: 24, borderRadius: 6 }} />
                            Shop owner? Sign in here
                        </span>
                        <ChevronRight size={20} color="#6B7280" />
                    </Link>
                    <p style={{ textAlign: "center", fontSize: 13, color: "#9CA3AF", marginTop: 24 }}>Protected by Laundrybill Security</p>
                </div>
            </main>
        </div>
    );
}
