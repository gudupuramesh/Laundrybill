/**
 * Public Order Hero — Enterprise Laundry CRM design system.
 * Clean white header: brand mark + name + timing, with social buttons on the
 * right. Wired to real shop data (logo, socialLinks, business hours, phone).
 */

import { type CSSProperties } from "react";
import { Phone, Clock, Facebook, Instagram, Twitter, Youtube, Linkedin } from "lucide-react";
import type { Shop } from "@/types/shop";
import type { PublicTemplateId } from "../config/templates";
import { getShopOpenStatus } from "../lib/shop-hours";

interface PublicOrderHeroProps {
    shop: Shop;
    templateId?: PublicTemplateId | string;
    compact?: boolean;
}

const SOCIAL_ICONS: Record<string, typeof Facebook> = {
    facebook: Facebook,
    instagram: Instagram,
    twitter: Twitter,
    youtube: Youtube,
    linkedin: Linkedin,
};

const WhatsAppIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3Zm4.3 12.5c-.2.5-1 .9-1.4 1-.4 0-.8.2-2.6-.6-2.2-.9-3.6-3.2-3.7-3.3-.1-.2-.9-1.2-.9-2.3 0-1 .6-1.5.8-1.7.2-.2.4-.3.6-.3h.4c.2 0 .4 0 .5.4l.7 1.6c0 .2.1.3 0 .5l-.4.5c-.2.2-.3.3-.1.6.2.3.8 1.2 1.6 1.9 1 .8 1.7 1 2 1.2.2 0 .4 0 .5-.2l.6-.7c.2-.2.3-.2.6-.1l1.6.8c.2.1.4.2.4.3.1.2.1.6 0 1Z" />
    </svg>
);

const BrandMark = ({ logo, name, size = 36 }: { logo?: string; name: string; size?: number }) => (
    <span style={{ width: size, height: size, flex: "none", borderRadius: size > 32 ? 10 : 8, overflow: "hidden", background: "var(--c-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
        {logo ? (
            <img src={logo} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
            <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none">
                <path d="M8 3.5 5 6v14.5h14V6l-3-2.5-2 1.6a3 3 0 0 1-4 0L8 3.5Z" fill="#fff" />
                <path d="M7 13l2.6-2.6L12 13l3-3.2 2.2 2.2" stroke="var(--c-primary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )}
    </span>
);

function SocialButtons({ links, phone }: { links?: Record<string, string | undefined>; phone?: string }) {
    const entries = Object.entries(links || {}).filter(([, url]) => url?.trim());
    if (entries.length === 0 && !phone) return null;

    const btn: CSSProperties = {
        width: 34,
        height: 34,
        borderRadius: 9,
        background: "var(--c-surface-2)",
        color: "var(--c-text-2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
    };

    return (
        <div style={{ display: "flex", gap: 7 }}>
            {phone && (
                <a href={`tel:${phone}`} aria-label="Call" style={btn}><Phone size={16} /></a>
            )}
            {entries.map(([key, url]) => {
                const href = url!.startsWith("http") ? url! : key === "whatsapp" ? `https://wa.me/${url!.replace(/\D/g, "")}` : `https://${url}`;
                const Icon = SOCIAL_ICONS[key];
                return (
                    <a key={key} href={href} target="_blank" rel="noopener noreferrer" aria-label={key} style={btn}>
                        {key === "whatsapp" ? <WhatsAppIcon /> : Icon ? <Icon size={16} /> : null}
                    </a>
                );
            })}
        </div>
    );
}

export function PublicOrderHero({ shop, compact }: PublicOrderHeroProps) {
    const openStatus = getShopOpenStatus(shop);
    const socialLinks = shop.publicOrdering?.socialLinks as Record<string, string | undefined> | undefined;
    const contactNumber = shop.phone || shop.whatsappNumber;
    const tagline = shop.publicOrdering?.tagline?.trim();

    const headerBase: CSSProperties = {
        width: "100%",
        flex: "none",
        background: "var(--c-surface)",
        borderBottom: "1px solid var(--c-border)",
    };

    if (compact) {
        return (
            <header style={headerBase}>
                <div style={{ maxWidth: 840, margin: "0 auto", padding: "10px 20px", display: "flex", alignItems: "center", gap: 10 }}>
                    <BrandMark logo={shop.logo} name={shop.name} size={30} />
                    <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.01em", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shop.name}</div>
                    {contactNumber && (
                        <a href={`tel:${contactNumber}`} aria-label="Call" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", textDecoration: "none" }}>
                            <Phone size={15} />{contactNumber}
                        </a>
                    )}
                </div>
            </header>
        );
    }

    return (
        <header style={headerBase}>
            <div style={{ maxWidth: 840, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                <BrandMark logo={shop.logo} name={shop.name} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shop.name}</div>
                    {tagline ? (
                        <div style={{ fontSize: 11.5, color: "var(--c-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tagline}</div>
                    ) : (
                        <div style={{ fontSize: 11.5, color: "var(--c-text-3)", display: "flex", alignItems: "center", gap: 5 }}>
                            <Clock size={12} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{openStatus.timingText}</span>
                            {!openStatus.isOpen && <span style={{ color: "var(--c-warning)", fontWeight: 600 }}>· Closed</span>}
                        </div>
                    )}
                </div>
                <SocialButtons links={socialLinks} phone={contactNumber} />
            </div>
        </header>
    );
}
