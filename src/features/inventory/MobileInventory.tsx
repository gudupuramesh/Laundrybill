/**
 * MOBILE Services & Items — clones the owner app's two screens
 * (ServiceItemsScreen + its service list): a service list where each row is an
 * icon chip + name + "N items · price range" + chevron, then drilling into a
 * service shows its items as thumbnail rows with price, unit and express
 * badges, an "Add Item" button and edit/delete actions.
 *
 * Desktop keeps InventoryPage's two-pane layout.
 */

import { useMemo, useState, type CSSProperties } from "react";
import { useInventory } from "@/hooks/use-inventory";
import { useCurrency } from "@/hooks/use-currency";
import { useTranslation } from "react-i18next";
import type { InventoryCategory, InventoryItem } from "@/types/inventory";
import { ArrowLeft, Plus, Search, X, Package, Pencil, ImageIcon, ChevronRight } from "lucide-react";

const TINTS = ["c-primary", "c-violet", "c-info", "c-cyan", "c-success", "c-warning"];
const tintFor = (s: string) => { let h = 0; for (const c of s || "x") h = (h * 31 + c.charCodeAt(0)) >>> 0; return TINTS[h % TINTS.length]; };

export function MobileInventory({ onBack, onNewService, onEditService, onNewItem, onEditItem }: {
    onBack: () => void;
    onNewService: () => void;
    onEditService: (c: InventoryCategory) => void;
    onNewItem: (categoryId: string) => void;
    onEditItem: (i: InventoryItem) => void;
}) {
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();
    const { items, categories, loading } = useInventory();
    const [openCat, setOpenCat] = useState<InventoryCategory | null>(null);
    const [search, setSearch] = useState("");
    const [showSearch, setShowSearch] = useState(false);

    const sortedCats = useMemo(() => categories.slice().sort((a, b) => a.order - b.order), [categories]);
    const catItems = useMemo(() => {
        if (!openCat) return [];
        const list = items.filter((i) => i.categoryId === openCat.id);
        if (!search.trim()) return list;
        const q = search.toLowerCase();
        return list.filter((i) => i.name.toLowerCase().includes(q));
    }, [items, openCat, search]);

    const priceRange = (catId: string) => {
        const prices = items.filter((i) => i.categoryId === catId).map((i) => i.basePrice).filter((p) => p > 0);
        if (!prices.length) return "—";
        const min = Math.min(...prices), max = Math.max(...prices);
        return min === max ? formatAmount(min) : `${formatAmount(min)}–${formatAmount(max)}`;
    };

    const card: CSSProperties = { background: "var(--c-surface)", borderRadius: 18, border: "1px solid var(--c-border)", boxShadow: "var(--sh-sm)", overflow: "hidden" };
    const iconBtn = (on?: boolean): CSSProperties => ({
        cursor: "pointer", flex: "none", width: 40, height: 40, borderRadius: 20, border: 0,
        background: on ? "var(--c-primary-soft)" : "var(--c-surface-2)", color: on ? "var(--c-primary)" : "var(--c-text-2)",
        display: "flex", alignItems: "center", justifyContent: "center",
    });
    const unitSuffix = (p?: string) => (p === "kg" ? "/kg" : p === "sqft" ? "/sqft" : "/pc");

    /* ── Item list for one service (app's ServiceItemsScreen) ───────────── */
    if (openCat) {
        return (
            <div style={{ minHeight: "100%", background: "var(--c-bg)", display: "flex", flexDirection: "column" }}>
                <div style={{ position: "sticky", top: 0, zIndex: 5, flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)" }}>
                    <button onClick={() => { setOpenCat(null); setSearch(""); setShowSearch(false); }} aria-label="Back" style={iconBtn()}><ArrowLeft size={22} /></button>
                    <div style={{ flex: 1, fontSize: 18, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{openCat.name}</div>
                    <button onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearch(""); }} aria-label={t("common.search", "Search")} style={iconBtn(showSearch)}><Search size={20} /></button>
                </div>

                <div style={{ flex: 1, padding: 16, paddingBottom: "calc(110px + env(safe-area-inset-bottom, 0px))", display: "flex", flexDirection: "column", gap: 12 }}>
                    {showSearch && (
                        <div style={{ position: "relative" }}>
                            <Search size={20} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--c-text-3)" }} />
                            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("inventory.searchItems", "Search items…")}
                                style={{ width: "100%", height: 46, font: "inherit", fontSize: 14, fontWeight: 600, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "0 40px 0 46px", outline: "none" }} />
                            {search && <button onClick={() => setSearch("")} aria-label="Clear" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", cursor: "pointer", border: 0, background: "transparent", color: "var(--c-text-3)", display: "flex" }}><X size={18} /></button>}
                        </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: ".5px" }}>
                            {t("mobile.inventoryCurrentSection", `Current items (${catItems.length})`)}
                        </span>
                        <button onClick={() => onNewItem(openCat.id)} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, font: "inherit", fontSize: 12.5, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 9, padding: "7px 12px" }}>
                            <Plus size={15} />{t("mobile.addItemBtn", "Add Item")}
                        </button>
                    </div>

                    {catItems.length === 0 ? (
                        <div style={{ ...card, padding: "40px 16px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                            <Package size={40} style={{ color: "var(--c-text-3)" }} />
                            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text-2)" }}>{t("mobile.noItemsYet", "No items yet")}</span>
                            <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>{t("mobile.noItemsHint", "Add your first item to this service.")}</span>
                        </div>
                    ) : (
                        <div style={card}>
                            {catItems.map((item, i) => (
                                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", borderBottom: i < catItems.length - 1 ? "1px solid var(--c-border)" : "none" }}>
                                    {item.imageUrl ? (
                                        <img src={item.imageUrl} alt="" style={{ width: 40, height: 40, flex: "none", borderRadius: 10, objectFit: "cover" }} />
                                    ) : (
                                        <span style={{ width: 40, height: 40, flex: "none", borderRadius: 10, background: "var(--c-surface-2)", color: "var(--c-text-3)", display: "flex", alignItems: "center", justifyContent: "center" }}><ImageIcon size={16} /></span>
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                                            <span style={{ fontSize: 10, fontWeight: 700, background: "var(--c-surface-2)", color: "var(--c-text-2)", padding: "2px 6px", borderRadius: 6 }}>{unitSuffix(item.pricingType)}</span>
                                            {(item.expressMultiplier || 1) > 1 && (
                                                <span style={{ fontSize: 10, fontWeight: 700, background: "var(--c-warning-soft)", color: "var(--c-warning)", padding: "2px 6px", borderRadius: 6 }}>{item.expressMultiplier}×</span>
                                            )}
                                        </div>
                                    </div>
                                    <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>{formatAmount(item.basePrice)}</span>
                                    <button onClick={() => onEditItem(item)} aria-label={t("common.edit", "Edit")} style={{ cursor: "pointer", flex: "none", width: 34, height: 34, borderRadius: 9, border: "1px solid var(--c-border)", background: "var(--c-surface-2)", color: "var(--c-text-2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Pencil size={15} /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    /* ── Service list ───────────────────────────────────────────────────── */
    return (
        <div style={{ minHeight: "100%", background: "var(--c-bg)", display: "flex", flexDirection: "column", position: "relative" }}>
            <div style={{ position: "sticky", top: 0, zIndex: 5, flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)" }}>
                <button onClick={onBack} aria-label="Back" style={iconBtn()}><ArrowLeft size={22} /></button>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{t("mobile.manageServices", "Services & Items")}</div>
                    <div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{sortedCats.length} {t("inventory.services", "services")} · {items.length} {t("inventory.items", "items")}</div>
                </div>
                <button onClick={onNewService} aria-label={t("inventory.newService", "New Service")} style={{ ...iconBtn(), background: "var(--c-primary-soft)", color: "var(--c-primary)" }}><Plus size={20} /></button>
            </div>

            <div style={{ flex: 1, padding: 16, paddingBottom: "calc(110px + env(safe-area-inset-bottom, 0px))" }}>
                {loading ? (
                    <div style={{ padding: "48px 0", textAlign: "center", color: "var(--c-text-3)", fontSize: 13 }}>{t("common.loading", "Loading…")}</div>
                ) : sortedCats.length === 0 ? (
                    <div style={{ ...card, padding: "48px 16px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                        <Package size={40} style={{ color: "var(--c-text-3)" }} />
                        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-2)" }}>{t("inventory.noCategories", "No services yet")}</span>
                        <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>{t("inventory.noCategoriesDesc", "Create a service to start adding items.")}</span>
                    </div>
                ) : (
                    <div style={card}>
                        {sortedCats.map((c, i) => {
                            const tint = tintFor(c.id);
                            const count = items.filter((it) => it.categoryId === c.id).length;
                            return (
                                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: i < sortedCats.length - 1 ? "1px solid var(--c-border)" : "none" }}>
                                    <span style={{ width: 38, height: 38, flex: "none", borderRadius: 11, background: `var(--${tint}-soft)`, color: `var(--${tint})`, display: "flex", alignItems: "center", justifyContent: "center" }}><Package size={18} /></span>
                                    <button onClick={() => setOpenCat(c)} style={{ flex: 1, minWidth: 0, cursor: "pointer", border: 0, background: "transparent", font: "inherit", textAlign: "left", padding: 0 }}>
                                        <div style={{ fontSize: 14.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                                        <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginTop: 1 }}>{count} {t("inventory.items", "items")} · {priceRange(c.id)}</div>
                                    </button>
                                    <button onClick={() => onEditService(c)} aria-label={t("common.edit", "Edit")} style={{ cursor: "pointer", flex: "none", width: 34, height: 34, borderRadius: 9, border: "1px solid var(--c-border)", background: "var(--c-surface-2)", color: "var(--c-text-2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Pencil size={15} /></button>
                                    <ChevronRight size={16} style={{ flex: "none", color: "var(--c-text-3)" }} />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <button onClick={onNewService} aria-label={t("inventory.newService", "New Service")}
                style={{ position: "fixed", right: 18, bottom: "calc(86px + env(safe-area-inset-bottom, 0px))", zIndex: 41, cursor: "pointer", width: 56, height: 56, borderRadius: 28, border: 0, background: "var(--c-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px rgba(27,97,229,.35)" }}>
                <Plus size={28} />
            </button>
        </div>
    );
}
