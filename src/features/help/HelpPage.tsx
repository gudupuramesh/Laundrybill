/**
 * Help & support — topic tiles, searchable FAQ (written from how the app works),
 * Super Admin guides/videos/docs, Send feedback (→ `feedback`, same collection
 * as the owner app, reviewed in Super Admin → Feedback), contact and app links.
 */

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import { useSupportSettings } from "@/hooks/use-support-settings";
import { useLToast } from "@/components/laundry";
import { useIsMobile } from "@/hooks/use-mobile";
import { getYoutubeThumbnailUrl } from "@/lib/youtube-thumbnail";
import { StoreBadge } from "@/features/apps/AppsPage";
import { APP_STORE_URL, GOOGLE_PLAY_URL } from "@/config/app-links";
import {
    Search, Rocket, ReceiptIndianRupee, ScanBarcode, Users, Smartphone, Wallet, BarChart3, Crown,
    ChevronDown, ChevronRight, Mail, Phone, MessageCircle, Clock, Video, FileText, ExternalLink, X,
} from "lucide-react";

type TopicId = "start" | "billing" | "orders" | "customers" | "team" | "payments" | "reports" | "subscription";

const TOPICS: { id: TopicId; label: string; icon: ReactNode; bg: string; fg: string }[] = [
    { id: "start", label: "Getting started", icon: <Rocket size={30} strokeWidth={1.6} />, bg: "#EEF2FF", fg: "#2563EB" },
    { id: "billing", label: "Billing & receipts", icon: <ReceiptIndianRupee size={30} strokeWidth={1.6} />, bg: "#DCFCE7", fg: "#16A34A" },
    { id: "orders", label: "Orders & tags", icon: <ScanBarcode size={30} strokeWidth={1.6} />, bg: "#EDE9FE", fg: "#7C3AED" },
    { id: "customers", label: "Customers", icon: <Users size={30} strokeWidth={1.6} />, bg: "#FFEDD5", fg: "#EA580C" },
    { id: "team", label: "Team app", icon: <Smartphone size={30} strokeWidth={1.6} />, bg: "#CCFBF1", fg: "#0F766E" },
    { id: "payments", label: "Payments & dues", icon: <Wallet size={30} strokeWidth={1.6} />, bg: "#FEF3C7", fg: "#B45309" },
    { id: "reports", label: "Reports", icon: <BarChart3 size={30} strokeWidth={1.6} />, bg: "#EDE9FE", fg: "#6D28D9" },
    { id: "subscription", label: "Subscription", icon: <Crown size={30} strokeWidth={1.6} />, bg: "#FEE2E2", fg: "#DC2626" },
];

type Faq = { id: string; topic: TopicId; q: string; a: string[]; tagArt?: boolean };
const FAQS: Faq[] = [
    { id: "tag", topic: "orders", tagArt: true, q: "How do I print a tag for an order?", a: ["Open the order and click “Print tag” in the Tag card. Choose one tag per service or one per item.", "Pick QR code or barcode once in Settings → Operations & receipts → Tags — the apps use the same choice.", "Scan the tag at the counter or in the Team app to open the order and update its status."] },
    { id: "track", topic: "customers", q: "Why does a customer need to enter their phone to track?", a: ["Tracking links show order details, so the customer confirms the phone number on the order before we show anything.", "It keeps one customer from seeing another customer's order. You can turn tracking links off in Settings → Operations & receipts."] },
    { id: "login", topic: "team", q: "How do I add a team login?", a: ["Go to Staff, add the person (or open them) and click “Create login”. Choose their role and email.", "Click “Share invite” — they install the Laundrybill Team app, tap Sign up, and use that email with their invite code.", "The Team logins card on Staff shows how many logins your plan allows."] },
    { id: "upi", topic: "payments", q: "Where do I set the UPI ID for the scan-to-pay QR?", a: ["Settings → Bank & payments → UPI ID. Keep “Show UPI QR on unpaid receipts” on.", "Receipts with a balance due then print a QR with the amount filled in. No UPI ID? A payment link is used instead."] },
    { id: "first-order", topic: "start", q: "How do I create my first order?", a: ["Open New Order and add the customer. Tap items to add them — items priced per kg ask for the weight.", "Click Checkout, choose the order type and payment, then Place order. Print the receipt or tag from the confirmation."] },
    { id: "services", topic: "start", q: "How do I add my services and prices?", a: ["Go to Services. “Import default catalogue” adds common services with suggested prices without touching yours.", "Or click “Add service” and set the unit (per piece, per kg, per pair), price and express surcharge."] },
    { id: "profile", topic: "start", q: "Where do I add my shop logo, address and GST?", a: ["Settings → Business profile. The logo prints on receipts when “Print shop logo” is on in Operations & receipts."] },
    { id: "devices", topic: "start", q: "Can I use Laundrybill on my phone and computer?", a: ["Yes — install the owner app from Get the apps and sign in with the same account.", "One phone and one browser can be signed in at a time. Manage them in Settings → Account."] },
    { id: "print", topic: "billing", q: "How do I print or share a receipt?", a: ["After placing an order use Print receipt A4, Print 80 mm, WhatsApp bill or PDF bill.", "Later, open the order and use the same buttons at the top."] },
    { id: "terms", topic: "billing", q: "How do I add terms to my receipts?", a: ["Settings → Operations & receipts → Terms printed on receipt. They appear at the bottom of every receipt."] },
    { id: "tax", topic: "billing", q: "How do I charge GST or VAT?", a: ["Settings → Tax & currency → turn on “Charge tax on bills” and set the name and rate. Tax is added on top of item prices."] },
    { id: "wa", topic: "billing", q: "Can I change the WhatsApp message customers get?", a: ["Settings → Reminders & notifications. Edit the greeting and closing line and choose what to include."] },
    { id: "scan", topic: "orders", q: "How do I scan a tag?", a: ["Click “Scan a tag” (or press F3) on New Order, or use Scan in the Team app. The order opens so you can update it."] },
    { id: "edit", topic: "orders", q: "How do I edit an order after placing it?", a: ["Open the order and click Edit. Items, order type and dates can be changed; payments already collected are kept."] },
    { id: "hold", topic: "orders", q: "Can I keep an order aside at the counter?", a: ["On New Order click “Hold order”. Serve the next customer, then resume it from Held orders at the top."] },
    { id: "dues", topic: "customers", q: "How do I see which customers owe money?", a: ["Customers → With dues shows everyone with an outstanding balance. On a customer's page, Send reminder opens WhatsApp with the amount."] },
    { id: "logins-plan", topic: "team", q: "How many team logins can I have?", a: ["It depends on your plan — see Settings → Subscription. Revoking a login frees the slot."] },
    { id: "lost-phone", topic: "team", q: "A phone was lost — how do I sign it out?", a: ["Settings → Account → Signed-in devices → ⋮ → Sign out this phone. For a team member, revoke their login on Staff."] },
    { id: "partial", topic: "payments", q: "How do I take a part payment?", a: ["At checkout choose Partial and enter the amount paid now. Collect the rest later from the order with “Collect payment”."] },
    { id: "expense", topic: "payments", q: "How do I record expenses and salaries?", a: ["Expenses → Add expense. Salaries paid on the Payroll page appear in Expenses automatically."] },
    { id: "profit", topic: "reports", q: "How is net profit calculated?", a: ["Net profit is the money collected in the period minus expenses, including salaries paid."] },
    { id: "export", topic: "reports", q: "Can I download my reports?", a: ["Reports → Export PDF downloads the report for the period you picked."] },
    { id: "upgrade", topic: "subscription", q: "How do I upgrade my plan?", a: ["Settings → Subscription → Upgrade. Pro+, Business and Franchise are billed monthly on the web; Pro is bought inside the app."] },
    { id: "invoices", topic: "subscription", q: "Where are my subscription invoices?", a: ["Settings → Subscription → Invoices, or View all for the full payment history."] },
];

export function HelpPage({ embedded }: { embedded?: boolean } = {}) {
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const { data: support } = useSupportSettings();
    const { user, shopId, shopName } = useAuth();
    const { addToast } = useLToast();

    const [search, setSearch] = useState("");
    const [topic, setTopic] = useState<TopicId | null>(null);
    const [openFaq, setOpenFaq] = useState<string | null>("tag");
    const [fbType, setFbType] = useState<"issue" | "suggestion" | "other">("issue");
    const [fbText, setFbText] = useState("");
    const [sending, setSending] = useState(false);

    const guides = (support.pageHelp ?? []).filter((p) => p.videoUrl?.trim() || p.docUrl?.trim());
    const q = search.trim().toLowerCase();
    const faqs = useMemo(() => FAQS.filter((f) => (!topic || f.topic === topic) && (!q || `${f.q} ${f.a.join(" ")}`.toLowerCase().includes(q))), [topic, q]);
    const filteredGuides = guides.filter((g) => !q || g.pageTitle.toLowerCase().includes(q));
    const filteredVideos = (support.supportVideos ?? []).filter((v) => !q || (v.title || "").toLowerCase().includes(q));
    const filteredDocs = (support.supportDocs ?? []).filter((d) => !q || (d.title || "").toLowerCase().includes(q));
    const countFor = (id: TopicId) => FAQS.filter((f) => f.topic === id).length;

    const sendFeedback = async () => {
        const message = fbText.trim();
        if (!message) { addToast({ type: "error", title: "Please write a message" }); return; }
        if (!user) return;
        setSending(true);
        try {
            await addDoc(collection(db, "feedback"), {
                type: fbType, message, shopId: shopId || null, shopName: shopName || null,
                userId: user.uid, userEmail: user.email || null, platform: "web", status: "new", createdAt: serverTimestamp(),
            });
            setFbText("");
            addToast({ type: "success", title: "Thank you!", description: "Your feedback has been sent. Our team reads every message." });
        } catch (e) {
            console.error("feedback", e);
            addToast({ type: "error", title: "Could not send", description: "Please check your connection and try again." });
        } finally { setSending(false); }
    };

    const card: CSSProperties = { border: "1px solid var(--ds-border)", borderRadius: 14, background: "var(--ds-card)", padding: "20px 22px" };
    const wa = (support.whatsappNumber || "").replace(/\D/g, "");

    const contactRow = (icon: ReactNode, label: string, value: string, href: string, external?: boolean) => (
        <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} style={{ display: "flex", alignItems: "center", gap: 18, textDecoration: "none", color: "inherit" }}>
            <span style={{ width: 54, height: 54, flex: "none", borderRadius: 12, background: "var(--ds-blue-soft)", color: "var(--ds-blue)", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
            <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, color: "var(--ds-text-2)" }}>{label}</span>
                <span style={{ display: "block", fontSize: 15, fontWeight: 500, color: "var(--ds-blue)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
            </span>
        </a>
    );

    return (
        <div className="lb-ds" style={{ minHeight: "100%", background: embedded ? "transparent" : "var(--ds-bg)", padding: isMobile ? "16px 14px calc(88px + env(safe-area-inset-bottom, 0px))" : embedded ? "24px 26px 28px" : "24px 26px 36px" }}>
            <div style={{ fontSize: embedded ? 21 : 27, fontWeight: embedded ? 600 : 700, letterSpacing: "-.02em", marginBottom: 18 }}>Help &amp; support</div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : embedded ? "repeat(auto-fit, minmax(340px, 1fr))" : "minmax(0, 1fr) minmax(300px, 380px)", gap: 22, alignItems: "start" }}>
                {/* MAIN */}
                <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
                    <div style={{ position: "relative" }}>
                        <Search size={20} style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", color: "var(--ds-text-2)" }} />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search help — e.g. print tags, collect payment"
                            style={{ width: "100%", font: "inherit", fontSize: 16, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 12, padding: "15px 44px 15px 52px", outline: "none" }} />
                        {search && <button onClick={() => setSearch("")} aria-label="Clear search" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", cursor: "pointer", border: 0, background: "transparent", color: "var(--ds-text-2)", display: "inline-flex" }}><X size={18} /></button>}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 12 }}>
                        {TOPICS.map((tp) => {
                            const on = topic === tp.id;
                            return (
                                <button key={tp.id} onClick={() => { setTopic(on ? null : tp.id); setOpenFaq(null); }} aria-pressed={on}
                                    style={{ cursor: "pointer", font: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "22px 10px 20px", borderRadius: 14, border: `${on ? 2 : 1}px solid ${on ? "var(--ds-blue)" : "var(--ds-border)"}`, background: "var(--ds-card)", color: "var(--ds-text)" }}>
                                    <span style={{ width: 70, height: 70, borderRadius: 16, background: tp.bg, color: tp.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>{tp.icon}</span>
                                    <span style={{ fontSize: 16.5, fontWeight: 500, marginTop: 4 }}>{tp.label}</span>
                                    <span style={{ fontSize: 14, color: "var(--ds-text-2)" }}>{countFor(tp.id)} articles</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* FAQ */}
                    <div style={card}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                            <span style={{ fontSize: 18, fontWeight: 600 }}>FAQ</span>
                            {topic && (
                                <button onClick={() => setTopic(null)} style={{ cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "var(--ds-blue)", background: "var(--ds-blue-soft)", border: 0, borderRadius: 20, padding: "4px 10px" }}>
                                    {TOPICS.find((x) => x.id === topic)?.label}<X size={13} />
                                </button>
                            )}
                        </div>
                        {faqs.length === 0 && <div style={{ fontSize: 14, color: "var(--ds-text-2)", padding: "12px 2px" }}>No answers match “{search}”. Try other words, or send us a message.</div>}
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {faqs.map((f) => {
                                const open = openFaq === f.id;
                                return (
                                    <div key={f.id} style={{ border: "1px solid var(--ds-border)", borderRadius: 10, overflow: "hidden" }}>
                                        <button onClick={() => setOpenFaq(open ? null : f.id)} aria-expanded={open}
                                            style={{ width: "100%", cursor: "pointer", font: "inherit", display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", fontSize: 15, fontWeight: 500, textAlign: "left", color: open ? "var(--ds-blue)" : "var(--ds-text)", background: "var(--ds-card)", border: 0 }}>
                                            <span style={{ flex: 1 }}>{f.q}</span>
                                            {open ? <ChevronDown size={18} style={{ transform: "rotate(180deg)" }} /> : <ChevronRight size={18} />}
                                        </button>
                                        {open && (
                                            <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", padding: "12px 22px 16px", background: "#F5F8FF", borderTop: "1px solid var(--ds-divider)" }}>
                                                <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 6 }}>
                                                    {f.a.map((line, i) => <div key={i} style={{ fontSize: 14.5, lineHeight: 1.6 }}>{line}</div>)}
                                                </div>
                                                {f.tagArt && (
                                                    <div style={{ flex: "none", background: "#fff", border: "1px solid var(--ds-border)", borderRadius: 8, padding: "8px 14px", textAlign: "center" }}>
                                                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>SAMPLE-0001</div>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                                            <QRCodeSVG value="SAMPLE-0001" size={50} />
                                                            <img src="https://bwipjs-api.metafloor.com/?bcid=code128&text=SAMPLE-0001&scale=2&height=10&backgroundcolor=ffffff" alt="" style={{ height: 50 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                                        </div>
                                                        <div style={{ fontSize: 10.5, color: "var(--ds-text-2)", marginTop: 5 }}>Sample tag</div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* guides & videos from Super Admin */}
                    {(filteredGuides.length > 0 || filteredVideos.length > 0 || filteredDocs.length > 0) && (
                        <div style={card}>
                            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 14 }}>Guides &amp; videos</div>
                            {filteredVideos.length > 0 && (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: filteredGuides.length || filteredDocs.length ? 16 : 0 }}>
                                    {filteredVideos.map((v) => (
                                        <a key={v.id} href={v.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", border: "1px solid var(--ds-border)", borderRadius: 10, overflow: "hidden", textDecoration: "none", color: "inherit" }}>
                                            <div style={{ aspectRatio: "16/9", background: "#F3F4F6", position: "relative" }}>
                                                {getYoutubeThumbnailUrl(v.url) && <img src={getYoutubeThumbnailUrl(v.url) || ""} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                                                <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,.92)", display: "flex", alignItems: "center", justifyContent: "center" }}><Video size={18} /></span></span>
                                            </div>
                                            <div style={{ padding: "9px 11px", fontSize: 13.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.title || "Watch video"}</div>
                                        </a>
                                    ))}
                                </div>
                            )}
                            <div style={{ display: "flex", flexDirection: "column" }}>
                                {filteredGuides.map((g) => (
                                    <div key={g.pageId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderTop: "1px solid var(--ds-divider)", flexWrap: "wrap" }}>
                                        <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500 }}>{g.pageTitle}</span>
                                        {g.videoUrl?.trim() && <a href={g.videoUrl.trim()} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13.5, color: "var(--ds-blue)", textDecoration: "none" }}><Video size={15} />Video</a>}
                                        {g.docUrl?.trim() && <a href={g.docUrl.trim()} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13.5, color: "var(--ds-blue)", textDecoration: "none" }}><FileText size={15} />Guide</a>}
                                    </div>
                                ))}
                                {filteredDocs.map((d) => (
                                    <a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderTop: "1px solid var(--ds-divider)", textDecoration: "none", color: "inherit" }}>
                                        <FileText size={16} style={{ color: "var(--ds-text-2)" }} />
                                        <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500 }}>{d.title || "Document"}</span>
                                        <ExternalLink size={15} style={{ color: "var(--ds-text-2)" }} />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT RAIL */}
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div style={card}>
                        <div style={{ fontSize: 18, fontWeight: 600 }}>Send feedback</div>
                        <div style={{ fontSize: 13.5, color: "var(--ds-text-2)", marginTop: 5, marginBottom: 12 }}>We’d love to hear your thoughts.</div>
                        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                            {([["issue", "Problem"], ["suggestion", "Idea"], ["other", "Other"]] as const).map(([k, label]) => (
                                <button key={k} onClick={() => setFbType(k)} style={{ cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600, padding: "5px 12px", borderRadius: 20, border: `1px solid ${fbType === k ? "var(--ds-blue)" : "var(--ds-border)"}`, background: fbType === k ? "var(--ds-blue-soft)" : "var(--ds-card)", color: fbType === k ? "var(--ds-blue)" : "var(--ds-text-2)" }}>{label}</button>
                            ))}
                        </div>
                        <div style={{ position: "relative" }}>
                            <textarea value={fbText} maxLength={500} rows={5} onChange={(e) => setFbText(e.target.value)} placeholder="Tell us what happened or what you'd like to see"
                                style={{ width: "100%", font: "inherit", fontSize: 14.5, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 10, padding: "12px 14px 28px", resize: "vertical", outline: "none" }} />
                            <span style={{ position: "absolute", right: 12, bottom: 10, fontSize: 12.5, color: "var(--ds-text-2)" }}>{fbText.length} / 500</span>
                        </div>
                        <button onClick={() => void sendFeedback()} disabled={sending || !fbText.trim()} style={{ width: "100%", marginTop: 14, cursor: sending ? "wait" : "pointer", font: "inherit", fontSize: 15.5, fontWeight: 600, color: "#fff", background: "var(--ds-blue)", border: 0, borderRadius: 10, padding: "12px 14px", opacity: sending || !fbText.trim() ? 0.6 : 1 }}>{sending ? "Sending…" : "Send"}</button>
                    </div>

                    {(support.supportEmail || wa || support.supportPhone || support.workingHours) && (
                        <div style={card}>
                            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Contact</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                {support.supportEmail && contactRow(<Mail size={24} />, "Email us anytime.", support.supportEmail, `mailto:${support.supportEmail}`)}
                                {wa && contactRow(<MessageCircle size={24} />, "Chat on WhatsApp", support.whatsappNumber, `https://wa.me/${wa}`, true)}
                                {support.supportPhone && contactRow(<Phone size={24} />, "Call us", support.supportPhone, `tel:${support.supportPhone.replace(/\s/g, "")}`)}
                                {support.workingHours && <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--ds-text-2)" }}><Clock size={16} />{support.workingHours}</div>}
                            </div>
                        </div>
                    )}

                    <div style={card}>
                        <div style={{ fontSize: 18, fontWeight: 600 }}>Get the apps</div>
                        <div style={{ fontSize: 13.5, color: "var(--ds-text-2)", marginTop: 5, marginBottom: 16 }}>Manage your shop on the go.</div>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                            <StoreBadge store="apple" href={APP_STORE_URL} />
                            <StoreBadge store="google" href={GOOGLE_PLAY_URL} />
                        </div>
                        <button onClick={() => navigate("/settings?section=apps")} style={{ marginTop: 12, cursor: "pointer", font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--ds-blue)", background: "transparent", border: 0, padding: 0 }}>Team app &amp; invite message →</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
