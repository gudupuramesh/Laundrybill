/**
 * Services (Inventory) — 1000% to the design system (Services.dc.html):
 * two-pane catalog → category sidebar + item grid, with New Service / Add Item
 * + the Service Areas / Pickup / Delivery sub-tabs. Wired to useInventory(+mutations).
 */

import { useState, useEffect, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { LEmptyState, LSpinner, LActionSheet, LCard } from "@/components/laundry";
import { useInventory, useInventoryMutations } from "@/hooks/use-inventory";
import { useCurrency } from "@/hooks/use-currency";
import { ServiceFormSheet } from "./ServiceFormSheet";
import { CategoryFormSheet } from "./CategoryFormSheet";
import { BulkImportModal } from "./BulkImportModal";
import { ServiceAreasList, PickupSlotsList, DeliverySlotsList } from "@/features/settings/ServiceAreasSettings";
import type { InventoryItem, InventoryCategory } from "@/types/inventory";
import { Package, Plus, Search, Pencil, Clock, MapPin, Truck, MoreVertical, Shirt, Download, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getTranslatedItemName, getTranslatedCategoryName, isWeightUnit } from "@/lib/inventory-translations";
import { useMinLoading } from "@/hooks/use-min-loading";
import { useIsMobile } from "@/hooks/use-mobile";

type ViewMode = "services" | "service-areas" | "pickup-slots" | "delivery-slots";

const MONO = "'IBM Plex Mono'";
const TINTS = ["c-primary", "c-violet", "c-info", "c-cyan", "c-success", "c-warning"];
const tintFor = (s: string) => { let h = 0; for (const c of s || "x") h = (h * 31 + c.charCodeAt(0)) >>> 0; return TINTS[h % TINTS.length]; };

export function InventoryPage() {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const { items, allItems, categories, allCategories, loading } = useInventory();
    const { deleteItem, updateItem, deleteCategory, updateCategory } = useInventoryMutations();
    const { formatAmount, currencySymbol } = useCurrency();

    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get("tab");
    const [viewMode, setViewMode] = useState<ViewMode>(((["service-areas", "pickup-slots", "delivery-slots"].includes(tabParam || "")) ? tabParam : "services") as ViewMode);
    const [showInactive, setShowInactive] = useState(false);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
    const [search, setSearch] = useState("");

    const [serviceSheet, setServiceSheet] = useState<{ open: boolean; item?: InventoryItem }>({ open: false });
    const [categorySheet, setCategorySheet] = useState<{ open: boolean; category?: InventoryCategory }>({ open: false });
    const [actionSheet, setActionSheet] = useState<{ open: boolean; item?: InventoryItem; category?: InventoryCategory }>({ open: false });
    const [importOpen, setImportOpen] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Download the current services + items as an .xlsx the owner can edit and re-upload.
    const handleExportExcel = async () => {
        setExporting(true);
        try {
            const { generateTemplateBlob } = await import("./lib/bulk-inventory");
            const blob = await generateTemplateBlob(allCategories, allItems);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `services-${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch (e) {
            console.error("Excel export failed:", e);
        }
        setExporting(false);
    };

    useEffect(() => {
        if (tabParam && ["services", "service-areas", "pickup-slots", "delivery-slots"].includes(tabParam)) setViewMode(tabParam as ViewMode);
    }, [tabParam]);

    const sourceCategories = (showInactive ? allCategories : categories).slice().sort((a, b) => a.order - b.order);
    const sourceItems = showInactive ? allItems : items;

    // keep a valid selected category
    useEffect(() => {
        if (sourceCategories.length && !sourceCategories.some((c) => c.id === selectedCategoryId)) {
            setSelectedCategoryId(sourceCategories[0].id);
        }
    }, [sourceCategories, selectedCategoryId]);

    const selectedCat = sourceCategories.find((c) => c.id === selectedCategoryId) || sourceCategories[0];
    const catItems = sourceItems.filter((i) => i.categoryId === selectedCat?.id && (!search || getTranslatedItemName(i.name).toLowerCase().includes(search.toLowerCase())));

    const priceRange = (catId: string) => {
        const ps = allItems.filter((i) => i.categoryId === catId).map((i) => i.basePrice);
        if (!ps.length) return "—";
        const lo = Math.min(...ps), hi = Math.max(...ps);
        return `${Math.round(lo)}–${Math.round(hi)} ${currencySymbol}`;
    };
    const perLabel = (p: string) => (isWeightUnit(p) ? `/ ${p}` : "/ pc");
    const unitLabel = (p: string) => (isWeightUnit(p) ? `Per ${p}` : "Per piece");

    const handleTabChange = (mode: ViewMode) => { setViewMode(mode); setSearchParams(mode === "services" ? {} : { tab: mode }); };
    const handleDelete = async () => { if (actionSheet.item) await deleteItem(actionSheet.item.id); else if (actionSheet.category) await deleteCategory(actionSheet.category.id); setActionSheet({ open: false }); };
    const handleToggleActive = async () => { if (actionSheet.item) await updateItem(actionSheet.item.id, { isActive: !actionSheet.item.isActive }); else if (actionSheet.category) await updateCategory(actionSheet.category.id, { isActive: !actionSheet.category.isActive }); setActionSheet({ open: false }); };

    const showLoading = useMinLoading(loading);

    const tabs: { id: ViewMode; label: string; icon: typeof Package }[] = [
        { id: "services", label: t("inventory.services", "Catalog"), icon: Package },
        { id: "service-areas", label: t("settings.serviceAreas", "Service Areas"), icon: MapPin },
        { id: "pickup-slots", label: t("settings.pickupTab", "Pickup"), icon: Clock },
        { id: "delivery-slots", label: t("settings.deliveryTab", "Delivery"), icon: Truck },
    ];

    const totalItems = allItems.length;
    const cardBox: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14, boxShadow: "var(--sh-sm)" };

    return (
        <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", background: "var(--c-bg)" }}>
            {/* header */}
            <header style={{ flex: "none", minHeight: 58, background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "10px 22px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                    <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.01em" }}>{t("nav.services", "Services")}</span>
                    <span style={{ fontSize: 12, color: "var(--c-text-3)", fontFamily: MONO }}>{allCategories.length} {t("inventory.services", "services")} · {totalItems} {t("inventory.items", "items")}</span>
                </div>
                <div style={{ flex: 1 }} />
                {viewMode === "services" && (
                    <>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--c-text-2)", cursor: "pointer" }}>
                            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} style={{ accentColor: "var(--c-primary)", width: 15, height: 15 }} />
                            {t("inventory.showInactive", "Show hidden")}
                        </label>
                        <div style={{ position: "relative", flex: isMobile ? "1 1 140px" : "none" }}>
                            <Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--c-text-3)" }} />
                            <input value={search} onChange={(e) => setSearch(e.target.value)} type="search" placeholder={t("inventory.searchItems", "Search items…")}
                                style={{ width: isMobile ? "100%" : 200, font: "inherit", fontSize: 13, color: "var(--c-text)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: "8px 11px 8px 33px", outline: "none" }} />
                        </div>
                        <button onClick={handleExportExcel} disabled={exporting} title={t("inventory.exportExcelHint", "Download services & items as Excel to edit and re-upload")}
                            style={{ cursor: exporting ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 8, padding: "8px 13px", opacity: exporting ? 0.7 : 1 }}>
                            <Download size={15} />{exporting ? "…" : t("inventory.exportExcel", "Download")}
                        </button>
                        <button onClick={() => setImportOpen(true)} title={t("inventory.importExcelHint", "Bulk add/update services & items from Excel/CSV")}
                            style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 8, padding: "8px 13px" }}>
                            <Upload size={15} />{t("inventory.importExcel", "Import")}
                        </button>
                        <button onClick={() => setCategorySheet({ open: true })} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 8, padding: "8px 14px", boxShadow: "var(--sh-sm)" }}><Plus size={15} />{t("inventory.newService", "New Service")}</button>
                    </>
                )}
            </header>

            {/* sub-tabs */}
            <div className="lb-thin" style={{ flex: "none", background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", padding: "10px 22px", display: "flex", gap: 8, overflowX: "auto" }}>
                {tabs.map((tb) => {
                    const on = viewMode === tb.id;
                    return (
                        <button key={tb.id} onClick={() => handleTabChange(tb.id)} style={{ cursor: "pointer", whiteSpace: "nowrap", font: "inherit", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, padding: "7px 13px", borderRadius: 9, border: `1px solid ${on ? "var(--c-primary)" : "var(--c-border)"}`, background: on ? "var(--c-primary-soft)" : "var(--c-surface)", color: on ? "var(--c-primary)" : "var(--c-text-2)" }}>
                            <tb.icon size={14} />{tb.label}
                        </button>
                    );
                })}
            </div>

            {showLoading ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><LSpinner size="lg" /></div>
            ) : viewMode === "services" ? (
                <div className="lb-cols" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: isMobile ? "column" : "row", overflow: isMobile ? "auto" : "hidden" }}>
                    {/* category sidebar */}
                    <section className="lb-svclist lb-scroll" style={{ width: isMobile ? "100%" : 288, flex: "none", overflow: isMobile ? "visible" : "auto", borderRight: isMobile ? "none" : "1px solid var(--c-border)", borderBottom: isMobile ? "1px solid var(--c-border)" : "none", background: "var(--c-surface)", padding: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--c-text-3)", padding: "4px 6px 10px" }}>{t("inventory.serviceCategories", "Service categories")}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {sourceCategories.map((c) => {
                                const on = c.id === selectedCat?.id;
                                const ref = tintFor(c.id);
                                const count = allItems.filter((i) => i.categoryId === c.id).length;
                                return (
                                    <button key={c.id} onClick={() => setSelectedCategoryId(c.id)} style={{ cursor: "pointer", font: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: 10, borderRadius: 10, border: `1px solid ${on ? "var(--c-primary)" : "var(--c-border)"}`, background: on ? "var(--c-primary-soft)" : "var(--c-surface)" }}>
                                        <span style={{ width: 42, height: 42, flex: "none", borderRadius: 10, background: `var(--${ref}-soft)`, color: `var(--${ref})`, display: "flex", alignItems: "center", justifyContent: "center" }}><Shirt size={22} strokeWidth={1.6} /></span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getTranslatedCategoryName(c.name, c.id)}</div>
                                            <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginTop: 1 }}>{count} {t("inventory.items", "items")} · {priceRange(c.id)}</div>
                                        </div>
                                        <span style={{ width: 8, height: 8, flex: "none", borderRadius: "50%", background: c.isActive ? "var(--c-success)" : "var(--c-text-3)" }} />
                                    </button>
                                );
                            })}
                        </div>
                        <button onClick={() => setCategorySheet({ open: true })} style={{ width: "100%", marginTop: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-primary)", background: "transparent", border: "1px dashed var(--c-border-strong)", borderRadius: 10, padding: 11 }}><Plus size={15} />{t("inventory.newServiceCategory", "New service category")}</button>
                    </section>

                    {/* item catalog */}
                    <section className="lb-scroll" style={{ flex: 1, minWidth: 0, overflow: isMobile ? "visible" : "auto", padding: isMobile ? "16px 16px calc(88px + env(safe-area-inset-bottom, 0px))" : "20px 22px 40px" }}>
                        {!selectedCat ? (
                            <LEmptyState icon={<Package className="h-8 w-8" />} title={t("inventory.noCategories", "No services yet")} description={t("inventory.noCategoriesDesc", "Create a service category to start adding items.")} action={{ label: t("inventory.newService", "New Service"), onClick: () => setCategorySheet({ open: true }) }} />
                        ) : (
                            <>
                                {/* service header */}
                                <div style={{ ...cardBox, padding: "18px 20px", display: "flex", alignItems: "center", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
                                    {(() => { const ref = tintFor(selectedCat.id); return (
                                        <span style={{ width: 54, height: 54, flex: "none", borderRadius: 13, background: `var(--${ref}-soft)`, color: `var(--${ref})`, display: "flex", alignItems: "center", justifyContent: "center" }}><Shirt size={28} strokeWidth={1.6} /></span>
                                    ); })()}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.01em" }}>{getTranslatedCategoryName(selectedCat.name, selectedCat.id)}</span>
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: selectedCat.isActive ? "var(--c-success)" : "var(--c-text-3)", background: selectedCat.isActive ? "var(--c-success-soft)" : "var(--c-surface-2)", padding: "3px 9px", borderRadius: 20 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: selectedCat.isActive ? "var(--c-success)" : "var(--c-text-3)" }} />{selectedCat.isActive ? t("common.active", "Active") : t("inventory.inactive", "Hidden")}</span>
                                        </div>
                                        <div style={{ fontSize: 12.5, color: "var(--c-text-3)", marginTop: 4 }}>{catItems.length} {t("inventory.items", "items")} {t("inventory.in", "in")} {getTranslatedCategoryName(selectedCat.name, selectedCat.id)}</div>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                                        <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>{t("inventory.priceRange", "Price range")}</span>
                                        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 16 }}>{priceRange(selectedCat.id)}</span>
                                    </div>
                                    <button onClick={() => setCategorySheet({ open: true, category: selectedCat })} aria-label="Edit service" style={{ cursor: "pointer", width: 36, height: 36, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 9 }}><Pencil size={16} /></button>
                                    <button onClick={() => setActionSheet({ open: true, category: selectedCat })} aria-label="More" style={{ cursor: "pointer", width: 36, height: 36, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 9 }}><MoreVertical size={16} /></button>
                                </div>

                                {/* items toolbar */}
                                <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600 }}>{t("inventory.items", "Items")} <span style={{ color: "var(--c-text-3)", fontWeight: 500, fontFamily: MONO }}>({catItems.length})</span></div>
                                    <button onClick={() => setServiceSheet({ open: true })} style={{ marginLeft: "auto", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-primary-soft)", border: 0, borderRadius: 8, padding: "8px 13px" }}><Plus size={15} />{t("inventory.addItem", "Add Item")}</button>
                                </div>

                                {/* items grid */}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 14 }}>
                                    {catItems.map((it) => {
                                        const ref = tintFor(it.id);
                                        return (
                                            <div key={it.id} style={{ ...cardBox, overflow: "hidden", borderRadius: 12 }}>
                                                <div style={{ height: 118, background: `var(--${ref}-soft)`, color: `var(--${ref})`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", borderBottom: "1px solid var(--c-border)", overflow: "hidden" }}>
                                                    {it.imageUrl ? <img src={it.imageUrl} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : <Shirt size={46} strokeWidth={1.4} />}
                                                    <span style={{ position: "absolute", top: 9, right: 9, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "3px 7px", borderRadius: 20, background: "var(--c-surface)", color: it.isActive ? "var(--c-success)" : "var(--c-text-3)", boxShadow: "var(--sh-sm)" }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: it.isActive ? "var(--c-success)" : "var(--c-text-3)" }} />{it.isActive ? t("common.active", "Active") : t("inventory.inactive", "Hidden")}</span>
                                                    <button onClick={() => setServiceSheet({ open: true, item: it })} aria-label="Edit item" style={{ position: "absolute", bottom: 9, right: 9, cursor: "pointer", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-text-2)", background: "var(--c-surface)", border: 0, borderRadius: 7, boxShadow: "var(--sh-sm)" }}><Pencil size={14} /></button>
                                                </div>
                                                <div style={{ padding: "12px 13px" }}>
                                                    <div style={{ fontWeight: 600, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getTranslatedItemName(it.name)}</div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                                                        <span style={{ fontSize: 11, color: "var(--c-text-3)", background: "var(--c-surface-2)", padding: "2px 7px", borderRadius: 5 }}>{unitLabel(it.pricingType)}</span>
                                                        <span style={{ fontSize: 11, color: "var(--c-text-3)", display: "inline-flex", alignItems: "center", gap: 3 }}><Clock size={11} />{it.turnaroundDays || selectedCat.turnaroundDays || 2}d</span>
                                                    </div>
                                                    <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginTop: 10 }}>
                                                        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 17 }}>{formatAmount(it.basePrice)}</span>
                                                        <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>{perLabel(it.pricingType)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {/* add item card */}
                                    <button onClick={() => setServiceSheet({ open: true })} style={{ cursor: "pointer", font: "inherit", minHeight: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 9, color: "var(--c-text-3)", background: "transparent", border: "1px dashed var(--c-border-strong)", borderRadius: 12 }}>
                                        <span style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--c-surface)", border: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={20} /></span>
                                        <span style={{ fontSize: 13, fontWeight: 600 }}>{t("inventory.addNewItem", "Add new item")}</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </section>
                </div>
            ) : (
                <div className="lb-scroll" style={{ flex: 1, overflow: "auto", padding: isMobile ? "16px 16px calc(88px + env(safe-area-inset-bottom, 0px))" : "24px 22px 40px" }}>
                    <div style={{ maxWidth: 760, margin: "0 auto" }}>
                        {viewMode === "service-areas" && (
                            <LCard variant="outlined" padding="lg">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--c-primary-soft)", color: "var(--c-primary)" }}><MapPin className="h-5 w-5" /></div>
                                    <div><h3 className="font-semibold text-foreground">{t("settings.serviceAreas", "Service Areas")}</h3><p className="text-sm text-muted-foreground">{t("settings.serviceAreasDesc", "Areas where you offer pickup/delivery")}</p></div>
                                </div>
                                <ServiceAreasList />
                            </LCard>
                        )}
                        {viewMode === "pickup-slots" && (
                            <LCard variant="outlined" padding="lg">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--c-success-soft)", color: "var(--c-success)" }}><Clock className="h-5 w-5" /></div>
                                    <div><h3 className="font-semibold text-foreground">{t("checkout.pickupSchedule", "Pickup Schedule")}</h3><p className="text-sm text-muted-foreground">{t("settings.pickupSlotsDesc", "Time slots for home pickup")}</p></div>
                                </div>
                                <PickupSlotsList />
                            </LCard>
                        )}
                        {viewMode === "delivery-slots" && (
                            <LCard variant="outlined" padding="lg">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--c-warning-soft)", color: "var(--c-warning)" }}><Truck className="h-5 w-5" /></div>
                                    <div><h3 className="font-semibold text-foreground">{t("checkout.deliverySchedule", "Delivery Schedule")}</h3><p className="text-sm text-muted-foreground">{t("checkout.deliveryScheduleDesc", "Time slots for home delivery")}</p></div>
                                </div>
                                <DeliverySlotsList />
                            </LCard>
                        )}
                    </div>
                </div>
            )}

            {/* sheets */}
            <ServiceFormSheet
                open={serviceSheet.open}
                onClose={() => setServiceSheet({ open: false })}
                item={serviceSheet.item}
                categories={categories}
                existingSubcategories={[...new Set(allItems.map((i) => i.subCategory).filter(Boolean))] as string[]}
                onAddCategory={() => setCategorySheet({ open: true })}
            />
            <CategoryFormSheet open={categorySheet.open} onClose={() => setCategorySheet({ open: false })} category={categorySheet.category} />
            <BulkImportModal open={importOpen} onClose={() => setImportOpen(false)} categories={allCategories} items={allItems} />
            <LActionSheet
                open={actionSheet.open}
                onClose={() => setActionSheet({ open: false })}
                title={actionSheet.item ? actionSheet.item.name : actionSheet.category?.name || ""}
                actions={[
                    { id: "toggle-active", label: (actionSheet.item?.isActive || actionSheet.category?.isActive) ? t("common.deactivate", "Hide") : t("common.activate", "Show"), onClick: handleToggleActive },
                    { id: "delete", label: t("common.delete", "Delete"), onClick: handleDelete, destructive: true },
                ]}
            />
        </div>
    );
}
