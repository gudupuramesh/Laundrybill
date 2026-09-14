/**
 * Services (Inventory) — 1000% to the design system (Services.dc.html):
 * two-pane catalog → category sidebar + item grid, with New Service / Add Item
 * + the Service Areas / Pickup / Delivery sub-tabs. Wired to useInventory(+mutations).
 */

import { useState, useEffect, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { LEmptyState, LSpinner, LActionSheet, LCard, LConfirmDialog, useLToast } from "@/components/laundry";
import { useAuth } from "@/features/auth";
import { importDefaultCatalogue } from "@/lib/new-shop";
import { useInventory, useInventoryMutations } from "@/hooks/use-inventory";
import { useCurrency } from "@/hooks/use-currency";
import { ServiceFormSheet } from "./ServiceFormSheet";
import { MobileInventory } from "./MobileInventory";
import { useNavigate } from "react-router-dom";
import { CategoryFormSheet } from "./CategoryFormSheet";
import { BulkImportModal } from "./BulkImportModal";
import { ServiceAreasList, PickupSlotsList, DeliverySlotsList } from "@/features/settings/ServiceAreasSettings";
import type { InventoryItem, InventoryCategory } from "@/types/inventory";
import { Package, Plus, Search, Pencil, Clock, MapPin, Truck, MoreVertical, Shirt, Download, Upload, Copy, Trash2, GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getTranslatedItemName, getTranslatedCategoryName } from "@/lib/inventory-translations";
import { useMinLoading } from "@/hooks/use-min-loading";
import { useIsMobile } from "@/hooks/use-mobile";

type ViewMode = "services" | "service-areas" | "pickup-slots" | "delivery-slots";


export function InventoryPage() {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const { items, allItems, categories, allCategories, loading } = useInventory();
    const { deleteItem, updateItem, deleteCategory, updateCategory, createItem, reorderCategories } = useInventoryMutations();
    const { shopId } = useAuth();
    const { addToast } = useLToast();
    const { formatAmount } = useCurrency();

    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get("tab");
    const [viewMode, setViewMode] = useState<ViewMode>(((["service-areas", "pickup-slots", "delivery-slots"].includes(tabParam || "")) ? tabParam : "services") as ViewMode);
    const [showInactive, setShowInactive] = useState(false);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
    const [search, setSearch] = useState("");

    const [serviceSheet, setServiceSheet] = useState<{ open: boolean; item?: InventoryItem }>({ open: false });
    const [categorySheet, setCategorySheet] = useState<{ open: boolean; category?: InventoryCategory }>({ open: false });
    const [importOpen, setImportOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const [confirmImport, setConfirmImport] = useState(false);
    const [importingDefaults, setImportingDefaults] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
    const [categoryMenu, setCategoryMenu] = useState<InventoryCategory | null>(null);
    const [dragCatId, setDragCatId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

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


    const handleTabChange = (mode: ViewMode) => { setViewMode(mode); setSearchParams(mode === "services" ? {} : { tab: mode }); };

    const showLoading = useMinLoading(loading);

    const tabs: { id: ViewMode; label: string; icon: typeof Package }[] = [
        { id: "services", label: t("inventory.services", "Catalog"), icon: Package },
        { id: "service-areas", label: t("settings.serviceAreas", "Service Areas"), icon: MapPin },
        { id: "pickup-slots", label: t("settings.pickupTab", "Pickup"), icon: Clock },
        { id: "delivery-slots", label: t("settings.deliveryTab", "Delivery"), icon: Truck },
    ];


    // MOBILE: the owner app's Services list → Service Items screens.
    if (isMobile) return (
        <>
            <MobileInventory
                onBack={() => navigate("/settings")}
                onNewService={() => setCategorySheet({ open: true })}
                onEditService={(c) => setCategorySheet({ open: true, category: c })}
                onNewItem={() => setServiceSheet({ open: true })}
                onEditItem={(i) => setServiceSheet({ open: true, item: i })}
            />
            <ServiceFormSheet
                open={serviceSheet.open}
                onClose={() => setServiceSheet({ open: false })}
                item={serviceSheet.item}
                categories={categories}
                existingSubcategories={[...new Set(allItems.map((i) => i.subCategory).filter(Boolean))] as string[]}
                onAddCategory={() => setCategorySheet({ open: true })}
            />
            <CategoryFormSheet open={categorySheet.open} onClose={() => setCategorySheet({ open: false })} category={categorySheet.category} />
        </>
    );

    // ---- desktop helpers ---------------------------------------------------
    const handleImportDefaults = async () => {
        if (!shopId) return;
        setImportingDefaults(true);
        try {
            const res = await importDefaultCatalogue(shopId, allCategories.map((c) => c.id), allItems.map((i) => ({ categoryId: i.categoryId, name: i.name })));
            addToast(res.categories || res.items
                ? { type: "success", title: t("inventory.catalogueImported", "Default catalogue imported"), description: t("inventory.catalogueImportedDesc", "{{c}} categories and {{i}} services added. Existing ones were left unchanged.", { c: res.categories, i: res.items }) }
                : { type: "info", title: t("inventory.catalogueUpToDate", "Nothing to import"), description: t("inventory.catalogueUpToDateDesc", "You already have every service from the default catalogue.") });
        } catch (e) {
            console.error("import default catalogue", e);
            addToast({ type: "error", title: t("inventory.catalogueImportFailed", "Could not import the catalogue") });
        } finally {
            setImportingDefaults(false);
            setConfirmImport(false);
        }
    };

    const duplicateItem = async (it: InventoryItem) => {
        await createItem({
            categoryId: it.categoryId, categoryName: it.categoryName, name: `${it.name} (${t("inventory.copy", "copy")})`,
            description: it.description, basePrice: it.basePrice, pricingType: it.pricingType, expressMultiplier: it.expressMultiplier,
            turnaroundDays: it.turnaroundDays, subCategory: it.subCategory, imageUrl: it.imageUrl, localizedNames: it.localizedNames, isActive: it.isActive,
        });
        addToast({ type: "success", title: t("inventory.duplicated", "Service duplicated") });
    };

    // Category drag & drop reorder
    const onCatDrop = async (targetId: string) => {
        const fromId = dragCatId;
        setDragCatId(null);
        setDragOverId(null);
        if (!fromId || fromId === targetId) return;
        const ids = sourceCategories.map((c) => c.id);
        const from = ids.indexOf(fromId), to = ids.indexOf(targetId);
        if (from < 0 || to < 0) return;
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        await reorderCategories(ids.map((id, i) => ({ id, order: i + 1 })));
    };

    const unitText = (p: string) => (p === "piece" ? t("inventory.perPc", "per pc") : `${t("pos.per", "per")} ${p === "sqm" ? "m²" : p}`);
    const expressText = (it: InventoryItem) => {
        const sur = Math.round(it.basePrice * ((it.expressMultiplier || 1) - 1));
        return sur > 0 ? `+${formatAmount(sur).replace(/\.00$/, "")}` : "—";
    };
    const money = (v: number) => formatAmount(v).replace(/\.00$/, "");
    const panelOpen = serviceSheet.open;

    const topBtn: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 10, font: "inherit", fontSize: 15, fontWeight: 600, borderRadius: 11, padding: "11px 18px", whiteSpace: "nowrap" };
    const iconBtn: CSSProperties = { cursor: "pointer", width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text-2)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 9 };
    const TH: CSSProperties = { padding: "14px 12px", fontSize: 14, fontWeight: 500, color: "var(--ds-text-2)", textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid var(--ds-border)", background: "var(--ds-card)", position: "sticky", top: 0, zIndex: 1 };
    const TD: CSSProperties = { padding: "8px 12px", fontSize: 14.5, borderBottom: "1px solid var(--ds-divider)", whiteSpace: "nowrap" };

    return (
        <div className="lb-ds" style={{ height: "100%", minHeight: 0, display: "flex", background: "var(--ds-bg)" }}>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
                {/* header */}
                <header style={{ flex: "none", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14, padding: "18px 22px 12px" }}>
                    <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.02em", marginRight: 60 }}>{t("nav.services", "Services")}</span>
                    {viewMode === "services" && (
                        <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 380 }}>
                            <Search size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ds-text-2)" }} />
                            <input value={search} onChange={(e) => setSearch(e.target.value)} type="search" placeholder={t("inventory.searchServices", "Search services")}
                                style={{ width: "100%", font: "inherit", fontSize: 14.5, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 11, padding: "11px 14px 11px 42px", outline: "none" }} />
                        </div>
                    )}
                    <div style={{ flex: 1 }} />
                    {viewMode === "services" && (
                        <>
                            <div style={{ position: "relative" }}>
                                <button onClick={() => setMoreOpen((v) => !v)} aria-label={t("inventory.excel", "Excel")} title={t("inventory.excelHint", "Download or import services with Excel")} style={{ ...iconBtn, width: 44, height: 44, borderRadius: 11 }}><MoreVertical size={18} /></button>
                                {moreOpen && (
                                    <div onMouseLeave={() => setMoreOpen(false)} style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 20, minWidth: 230, background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 12, boxShadow: "0 12px 32px rgba(16,24,40,.12)", padding: 6 }}>
                                        <button onClick={() => { setMoreOpen(false); void handleExportExcel(); }} disabled={exporting} style={menuItem}><Download size={16} />{exporting ? "…" : t("inventory.exportExcel", "Download as Excel")}</button>
                                        <button onClick={() => { setMoreOpen(false); setImportOpen(true); }} style={menuItem}><Upload size={16} />{t("inventory.importExcel", "Import from Excel")}</button>
                                    </div>
                                )}
                            </div>
                            <button onClick={() => setConfirmImport(true)} disabled={importingDefaults} style={{ ...topBtn, color: "var(--ds-blue)", background: "var(--ds-card)", border: "1px solid var(--ds-blue)", opacity: importingDefaults ? 0.6 : 1 }}>
                                <Upload size={18} />{importingDefaults ? t("common.loading", "Importing…") : t("inventory.importDefault", "Import default catalogue")}
                            </button>
                            <button onClick={() => setServiceSheet({ open: true })} style={{ ...topBtn, color: "#fff", background: "var(--ds-blue)", border: "1px solid var(--ds-blue)" }}>
                                <Plus size={18} />{t("inventory.addServiceBtn", "Add service")}
                            </button>
                        </>
                    )}
                </header>

                {/* catalogue / areas / slots */}
                <div style={{ flex: "none", display: "flex", gap: 22, padding: "0 22px", borderBottom: "1px solid var(--ds-border)" }}>
                    {tabs.map((tb) => {
                        const on = viewMode === tb.id;
                        return (
                            <button key={tb.id} onClick={() => handleTabChange(tb.id)} style={{ cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 600, padding: "10px 2px", background: "transparent", border: 0, borderBottom: `2px solid ${on ? "var(--ds-blue)" : "transparent"}`, color: on ? "var(--ds-blue)" : "var(--ds-text-2)" }}>
                                <tb.icon size={15} />{tb.label}
                            </button>
                        );
                    })}
                </div>

                {showLoading ? (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><LSpinner size="lg" /></div>
                ) : viewMode === "services" ? (
                    <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 16, padding: "16px 22px 20px" }}>
                        {/* categories */}
                        <section style={{ width: 172, flex: "none", display: "flex", flexDirection: "column", minHeight: 0, background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 14, overflow: "hidden" }}>
                            <div style={{ padding: "18px 16px 12px", fontSize: 14.5, fontWeight: 600 }}>{t("inventory.categoriesTitle", "Categories")}</div>
                            <div className="lb-scroll" style={{ flex: "0 1 auto", overflow: "auto", borderTop: "1px solid var(--ds-divider)" }}>
                                {sourceCategories.map((c) => {
                                    const on = c.id === selectedCat?.id;
                                    const count = allItems.filter((i) => i.categoryId === c.id && (showInactive || i.isActive)).length;
                                    return (
                                        <div key={c.id}
                                            draggable
                                            onDragStart={() => setDragCatId(c.id)}
                                            onDragOver={(e) => { e.preventDefault(); setDragOverId(c.id); }}
                                            onDragLeave={() => setDragOverId((v) => (v === c.id ? null : v))}
                                            onDrop={() => void onCatDrop(c.id)}
                                            onDragEnd={() => { setDragCatId(null); setDragOverId(null); }}
                                            onClick={() => setSelectedCategoryId(c.id)}
                                            className="svc-cat"
                                            style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: "13px 12px 13px 16px", borderBottom: "1px solid var(--ds-divider)", background: on ? "var(--ds-blue-soft)" : "var(--ds-card)", boxShadow: dragOverId === c.id && dragCatId !== c.id ? "inset 0 2px 0 var(--ds-blue)" : undefined, opacity: dragCatId === c.id ? 0.5 : c.isActive ? 1 : 0.55 }}>
                                            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: on ? 500 : 400, color: on ? "var(--ds-blue)" : "var(--ds-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={getTranslatedCategoryName(c.name, c.id)}>{getTranslatedCategoryName(c.name, c.id)}</span>
                                            <span className="svc-cat-count" style={{ fontSize: 13.5, color: "var(--ds-text-2)" }}>{count}</span>
                                            <button className="svc-cat-edit" onClick={(e) => { e.stopPropagation(); setCategoryMenu(c); }} aria-label={t("inventory.editCategory", "Edit category")} style={{ display: "none", cursor: "pointer", width: 22, height: 22, alignItems: "center", justifyContent: "center", color: "var(--ds-text-2)", background: "transparent", border: 0, padding: 0 }}><Pencil size={14} /></button>
                                            <GripVertical size={16} style={{ color: "var(--ds-text-3)", cursor: "grab", flex: "none" }} />
                                        </div>
                                    );
                                })}
                            </div>
                            <button onClick={() => setCategorySheet({ open: true })} style={{ cursor: "pointer", font: "inherit", display: "flex", alignItems: "center", gap: 10, padding: "16px 16px", fontSize: 14.5, fontWeight: 500, color: "var(--ds-blue)", background: "transparent", border: 0, textAlign: "left" }}><Plus size={18} />{t("inventory.addCategory", "Add category")}</button>
                            <div style={{ flex: 1 }} />
                            <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderTop: "1px solid var(--ds-divider)", fontSize: 12.5, color: "var(--ds-text-2)", cursor: "pointer" }}>
                                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} style={{ accentColor: "var(--ds-blue)", width: 14, height: 14 }} />
                                {t("inventory.showInactive", "Show hidden")}
                            </label>
                        </section>
                        <style>{`.svc-cat:hover .svc-cat-count{display:none}.svc-cat:hover .svc-cat-edit{display:inline-flex!important}`}</style>

                        {/* services table */}
                        <section style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 14, overflow: "hidden" }}>
                            {!selectedCat ? (
                                <div style={{ padding: 30 }}>
                                    <LEmptyState icon={<Package className="h-8 w-8" />} title={t("inventory.noCategories", "No services yet")} description={t("inventory.noCategoriesEmptyDesc", "Import the default catalogue or add a category to start.")} action={{ label: t("inventory.importDefault", "Import default catalogue"), onClick: () => setConfirmImport(true) }} />
                                </div>
                            ) : (
                                <div className="lb-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                                        <thead>
                                            <tr>
                                                <th style={{ ...TH, paddingLeft: 20, width: 76 }}>{t("inventory.colPhoto", "Photo")}</th>
                                                <th style={TH}>{t("inventory.colService", "Service")}</th>
                                                <th style={TH}>{t("inventory.colUnit", "Unit")}</th>
                                                <th style={TH}>{t("inventory.colPrice", "Price")}</th>
                                                <th style={TH}>{t("inventory.colExpress", "Express")}</th>
                                                <th style={TH}>{t("inventory.colActive", "Active")}</th>
                                                <th style={{ ...TH, textAlign: "center", paddingRight: 16 }}>{t("inventory.colActions", "Actions")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {catItems.length === 0 && (
                                                <tr><td colSpan={7} style={{ padding: "40px 12px", textAlign: "center", fontSize: 14, color: "var(--ds-text-2)" }}>
                                                    {search ? t("inventory.noSearchResults", "No services match your search.") : t("inventory.noItemsInCategory", "No services in this category yet.")}
                                                </td></tr>
                                            )}
                                            {catItems.map((it) => (
                                                <tr key={it.id} style={{ background: serviceSheet.item?.id === it.id ? "var(--ds-blue-soft)" : undefined }}>
                                                    <td style={{ ...TD, paddingLeft: 20 }}>
                                                        <span style={{ width: 56, height: 50, borderRadius: 6, overflow: "hidden", background: "var(--ds-table-head)", color: "var(--ds-text-3)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                                                            <Shirt size={22} strokeWidth={1.5} />
                                                            {it.imageUrl && <img src={it.imageUrl} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
                                                        </span>
                                                    </td>
                                                    <td style={{ ...TD, fontWeight: 500, whiteSpace: "normal" }}>{getTranslatedItemName(it.name, it.localizedNames)}</td>
                                                    <td style={{ ...TD, color: "var(--ds-text-2)" }}>{unitText(it.pricingType)}</td>
                                                    <td style={TD}>{money(it.basePrice)}</td>
                                                    <td style={TD}>{expressText(it)}</td>
                                                    <td style={TD}>
                                                        <button role="switch" aria-checked={it.isActive} aria-label={t("inventory.active", "Active")} onClick={() => void updateItem(it.id, { isActive: !it.isActive })}
                                                            style={{ position: "relative", cursor: "pointer", width: 34, height: 20, border: 0, borderRadius: 20, background: it.isActive ? "var(--ds-blue)" : "#D1D5DB", verticalAlign: "middle" }}>
                                                            <span style={{ position: "absolute", top: 3, left: 3, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "transform .15s", transform: it.isActive ? "translateX(14px)" : "translateX(0)" }} />
                                                        </button>
                                                    </td>
                                                    <td style={{ ...TD, paddingRight: 16 }}>
                                                        <div style={{ display: "flex", justifyContent: "center", gap: 7 }}>
                                                            <button onClick={() => setServiceSheet({ open: true, item: it })} aria-label={t("common.edit", "Edit")} title={t("common.edit", "Edit")} style={iconBtn}><Pencil size={15} /></button>
                                                            <button onClick={() => void duplicateItem(it)} aria-label={t("inventory.duplicate", "Duplicate")} title={t("inventory.duplicate", "Duplicate")} style={iconBtn}><Copy size={15} /></button>
                                                            <button onClick={() => setDeleteTarget(it)} aria-label={t("common.delete", "Delete")} title={t("common.delete", "Delete")} style={{ ...iconBtn, color: "var(--ds-negative)" }}><Trash2 size={15} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    </div>
                ) : (
                    <div className="lb-scroll" style={{ flex: 1, overflow: "auto", padding: "24px 22px 40px" }}>
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
            </div>

            {/* docked add/edit panel */}
            <ServiceFormSheet
                asPanel
                open={panelOpen && viewMode === "services"}
                onClose={() => setServiceSheet({ open: false })}
                item={serviceSheet.item}
                categories={categories}
                defaultCategoryId={selectedCat?.id}
                existingSubcategories={[...new Set(allItems.map((i) => i.subCategory).filter(Boolean))] as string[]}
                onAddCategory={() => setCategorySheet({ open: true })}
            />

            <CategoryFormSheet open={categorySheet.open} onClose={() => setCategorySheet({ open: false })} category={categorySheet.category} />
            <BulkImportModal open={importOpen} onClose={() => setImportOpen(false)} categories={allCategories} items={allItems} />
            <LActionSheet
                open={!!categoryMenu}
                onClose={() => setCategoryMenu(null)}
                title={categoryMenu?.name || ""}
                actions={categoryMenu ? [
                    { id: "edit", label: t("inventory.editCategory", "Edit category"), onClick: () => { const c = categoryMenu; setCategoryMenu(null); setCategorySheet({ open: true, category: c }); } },
                    { id: "toggle-active", label: categoryMenu.isActive ? t("common.deactivate", "Hide") : t("common.activate", "Show"), onClick: async () => { const c = categoryMenu; setCategoryMenu(null); await updateCategory(c.id, { isActive: !c.isActive }); } },
                    { id: "delete", label: t("common.delete", "Delete"), destructive: true, onClick: async () => { const c = categoryMenu; setCategoryMenu(null); await deleteCategory(c.id); } },
                ] : []}
            />
            <LConfirmDialog
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={async () => { if (deleteTarget) await deleteItem(deleteTarget.id); setDeleteTarget(null); }}
                title={t("inventory.deleteServiceTitle", "Delete this service?")}
                description={t("inventory.deleteServiceDesc", "{{name}} will be removed from the POS. Past orders keep it.", { name: deleteTarget?.name || "" })}
                confirmText={t("common.delete", "Delete")}
                variant="destructive"
            />
            <LConfirmDialog
                open={confirmImport}
                onClose={() => !importingDefaults && setConfirmImport(false)}
                onConfirm={() => void handleImportDefaults()}
                title={t("inventory.importDefaultTitle", "Import the default catalogue?")}
                description={t("inventory.importDefaultDesc", "Adds the standard categories and services with suggested prices. Services you already have are skipped, and nothing you've edited is changed.")}
                confirmText={t("inventory.import", "Import")}
                loading={importingDefaults}
            />
        </div>
    );
}

const menuItem: CSSProperties = { width: "100%", cursor: "pointer", font: "inherit", display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 500, color: "var(--ds-text)", background: "transparent", border: 0, borderRadius: 8, padding: "10px 12px", textAlign: "left" };
