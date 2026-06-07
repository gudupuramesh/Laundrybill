/**
 * Super Admin – Items List (Default Catalog)
 *
 * Manage the platform default catalog: same categories and items as user POS.
 * Upload an image per item (or paste URL). New shops are seeded from this so they
 * get categories, items, and images without uploading; they can later change or add their own.
 */

import { useState, useEffect, useMemo } from "react";
import {
  LCard,
  LButton,
  LTextInput,
  LPageLoader,
  LEmptyState,
  useLToast,
  LNumberInput,
  LSelect,
  LResponsiveDialog,
  LSpinner,
  LSmartImageUploader,
  LConfirmDialog,
} from "@/components/laundry";
import { useSuperAdmin } from "../SuperAdminAuthContext";
import {
  useDefaultCatalog,
  buildDefaultCatalogFromInventory,
} from "../hooks/use-default-catalog";
import type {
  DefaultCatalogCategory,
  DefaultCatalogItem,
} from "../types/default-catalog";
import type { ImageMetadata } from "@/types/image-upload";
import { Package, Image as ImageIcon, Save, Download, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { formatCurrencyValue } from "@/hooks/use-currency";

const CATEGORY_ICON_OPTIONS = [
  { value: "wind", label: "Wind (iron)" },
  { value: "droplets", label: "Droplets (wash)" },
  { value: "sparkles", label: "Sparkles" },
  { value: "shirt", label: "Shirt" },
  { value: "home", label: "Home" },
  { value: "footprints", label: "Footprints" },
  { value: "star", label: "Star" },
];

/** Build synthetic metadata for existing image URL (e.g. from catalog or pasted). */
function imageMetadataFromUrl(url: string): ImageMetadata {
  return {
    id: "existing",
    key: "",
    url,
    originalName: "Image",
    originalSize: 0,
    compressedSize: 0,
    compressionRatio: 0,
    width: 0,
    height: 0,
    mimeType: "image/jpeg",
    uploadedAt: new Date(),
  };
}

const PRICING_OPTIONS = [
  { value: "piece", label: "Piece" },
  { value: "kg", label: "Kg" },
  { value: "lb", label: "Pound (lb)" },
  { value: "sqft", label: "Sq. Foot" },
  { value: "sqm", label: "Sq. Meter (m²)" },
  { value: "set", label: "Set" },
  { value: "pair", label: "Pair" },
  { value: "load", label: "Per Load" },
  { value: "bag", label: "Per Bag" },
];

export function ItemsListPage() {
  const { firebaseUser } = useSuperAdmin();
  const { addToast } = useLToast();
  const { data, loading, saving, error, load, save } = useDefaultCatalog();

  const [categories, setCategories] = useState<DefaultCatalogCategory[]>([]);
  const [items, setItems] = useState<DefaultCatalogItem[]>([]);
  const [editItem, setEditItem] = useState<DefaultCatalogItem | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    basePrice: number;
    pricingType: DefaultCatalogItem["pricingType"];
    turnaroundDays: number;
    imageUrl: string;
  }>({ name: "", basePrice: 0, pricingType: "piece", turnaroundDays: 1, imageUrl: "" });
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [newCategoryForm, setNewCategoryForm] = useState({
    name: "",
    icon: "shirt",
    order: 1,
    turnaroundDays: 1,
  });

  const [addItemCategory, setAddItemCategory] = useState<DefaultCatalogCategory | null>(null);
  const [newItemForm, setNewItemForm] = useState({
    name: "",
    subCategory: "",
    basePrice: 0,
    pricingType: "piece" as DefaultCatalogItem["pricingType"],
    turnaroundDays: 1,
    imageUrl: "",
  });

  const [itemToDelete, setItemToDelete] = useState<DefaultCatalogItem | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (data) {
      setCategories(data.categories);
      setItems(data.items);
      if (data.categories.length && !expandedCategoryId)
        setExpandedCategoryId(data.categories[0].id);
    }
  }, [data]);

  const handleInitFromDefault = async () => {
    try {
      const catalog = await buildDefaultCatalogFromInventory();
      setCategories(catalog.categories);
      setItems(catalog.items);
      if (catalog.categories.length && !expandedCategoryId)
        setExpandedCategoryId(catalog.categories[0].id);
      addToast({ title: "Loaded default list", type: "success" });
    } catch (e) {
      addToast({
        title: e instanceof Error ? e.message : "Failed to load default list",
        type: "error",
      });
    }
  };

  const handleSave = async () => {
    if (!categories.length || !items.length) {
      addToast({ title: "Add categories and items first", type: "error" });
      return;
    }
    try {
      await save(
        { categories, items },
        firebaseUser?.uid ?? undefined
      );
      addToast({ title: "Catalog saved. New shops will get this list.", type: "success" });
    } catch {
      addToast({ title: "Failed to save catalog", type: "error" });
    }
  };

  const openEdit = (item: DefaultCatalogItem) => {
    setEditItem(item);
    setEditForm({
      name: item.name,
      basePrice: item.basePrice,
      pricingType: item.pricingType,
      turnaroundDays: item.turnaroundDays,
      imageUrl: item.imageUrl ?? "",
    });
  };

  const applyEdit = () => {
    if (!editItem) return;
    const key = (i: DefaultCatalogItem) =>
      `${i.categoryId}|${i.name}|${i.order}`;
    const editKey = key(editItem);
    setItems((prev) =>
      prev.map((i) =>
        key(i) === editKey
          ? {
              ...i,
              name: editForm.name,
              basePrice: editForm.basePrice,
              pricingType: editForm.pricingType,
              turnaroundDays: editForm.turnaroundDays,
              imageUrl: editForm.imageUrl.trim() || undefined,
            }
          : i
      )
    );
    setEditItem(null);
  };

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

  const handleAddCategory = () => {
    const name = newCategoryForm.name.trim();
    if (!name) {
      addToast({ title: "Enter category name", type: "error" });
      return;
    }
    let id = slugify(name) || `cat-${Date.now()}`;
    const existingIds = new Set(categories.map((c) => c.id));
    while (existingIds.has(id)) {
      id = `${slugify(name)}-${Math.random().toString(36).slice(2, 8)}`;
    }
    const newCat: DefaultCatalogCategory = {
      id,
      name,
      icon: newCategoryForm.icon,
      order: newCategoryForm.order,
      turnaroundDays: newCategoryForm.turnaroundDays,
    };
    setCategories((prev) => [...prev, newCat].sort((a, b) => a.order - b.order));
    setNewCategoryForm({ name: "", icon: "shirt", order: categories.length + 1, turnaroundDays: 1 });
    setAddCategoryOpen(false);
    setExpandedCategoryId(id);
    addToast({ title: "Category added", type: "success" });
  };

  const handleAddItem = () => {
    const cat = addItemCategory;
    if (!cat) return;
    const name = newItemForm.name.trim();
    if (!name) {
      addToast({ title: "Enter item name", type: "error" });
      return;
    }
    const catItems = items.filter((i) => i.categoryId === cat.id);
    const nextOrder = catItems.length ? Math.max(...catItems.map((i) => i.order)) + 1 : 100;
    const newItem: DefaultCatalogItem = {
      categoryId: cat.id,
      categoryName: cat.name,
      subCategory: newItemForm.subCategory.trim() || undefined,
      name,
      basePrice: newItemForm.basePrice,
      pricingType: newItemForm.pricingType,
      turnaroundDays: newItemForm.turnaroundDays,
      order: nextOrder,
      imageUrl: newItemForm.imageUrl.trim() || undefined,
    };
    setItems((prev) => [...prev, newItem]);
    setNewItemForm({
      name: "",
      subCategory: "",
      basePrice: 0,
      pricingType: "piece",
      turnaroundDays: cat.turnaroundDays,
      imageUrl: "",
    });
    setAddItemCategory(null);
    setExpandedCategoryId(cat.id);
    addToast({ title: "Item added", type: "success" });
  };

  const handleDeleteItem = () => {
    if (!itemToDelete) return;
    const key = (i: DefaultCatalogItem) =>
      `${i.categoryId}|${i.name}|${i.order}`;
    const deleteKey = key(itemToDelete);
    setItems((prev) => prev.filter((i) => key(i) !== deleteKey));
    setItemToDelete(null);
    addToast({ title: "Item removed", type: "success" });
  };

  const itemsByCategory = useMemo(() => {
    const map: Record<string, DefaultCatalogItem[]> = {};
    for (const c of categories) map[c.id] = [];
    for (const i of items) {
      if (map[i.categoryId]) map[i.categoryId].push(i);
    }
    for (const arr of Object.values(map)) arr.sort((a, b) => a.order - b.order);
    return map;
  }, [categories, items]);

  if (loading) return <LPageLoader />;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Items List (Default Catalog)</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Same categories and items as user POS. Set image URLs here; new shops get this list with images.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!data && (
            <LButton variant="outline" onClick={handleInitFromDefault} leftIcon={<Download className="h-4 w-4" />}>
              Initialize from default list
            </LButton>
          )}
          <LButton
            variant="outline"
            onClick={() => {
              setNewCategoryForm({
                name: "",
                icon: "shirt",
                order: categories.length + 1,
                turnaroundDays: 1,
              });
              setAddCategoryOpen(true);
            }}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Add category
          </LButton>
          <LButton
            onClick={handleSave}
            disabled={saving || !categories.length || !items.length}
            leftIcon={saving ? <LSpinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          >
            {saving ? "Saving…" : "Save catalog"}
          </LButton>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {!categories.length && !loading && (
        <LEmptyState
          icon={<Package className="h-12 w-12 text-muted-foreground" />}
          title="No catalog yet"
          description="Load the default list (same as new users get) then add image URLs and save. New shops will then get categories, items, and images automatically."
          action={{
            label: "Initialize from default list",
            onClick: handleInitFromDefault,
          }}
        />
      )}

      {categories.length > 0 && (
        <div className="space-y-3">
          {categories
            .sort((a, b) => a.order - b.order)
            .map((cat) => {
              const catItems = itemsByCategory[cat.id] ?? [];
              const isExpanded = expandedCategoryId === cat.id;
              return (
                <LCard key={cat.id} className="overflow-hidden">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                    onClick={() =>
                      setExpandedCategoryId((id) => (id === cat.id ? null : cat.id))
                    }
                  >
                    <span className="font-medium">{cat.name}</span>
                    <span className="text-muted-foreground text-sm">
                      {catItems.length} items
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="border-t border-border">
                      <div className="divide-y divide-border">
                        {catItems.map((item) => (
                          <div
                            key={`${item.categoryId}-${item.name}-${item.order}`}
                            className="flex flex-wrap items-center gap-3 p-3 md:flex-nowrap"
                          >
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                  <ImageIcon className="h-5 w-5" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{item.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatCurrencyValue(item.basePrice)} / {item.pricingType}
                                {item.subCategory ? ` · ${item.subCategory}` : ""}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <LButton
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(item)}
                                leftIcon={<Pencil className="h-3.5 w-3.5" />}
                              >
                                Edit
                              </LButton>
                              <LButton
                                variant="ghost"
                                size="sm"
                                onClick={() => setItemToDelete(item)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                              >
                                Delete
                              </LButton>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="p-3 border-t border-border">
                        <LButton
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAddItemCategory(cat);
                            setNewItemForm({
                              name: "",
                              subCategory: "",
                              basePrice: 0,
                              pricingType: "piece",
                              turnaroundDays: cat.turnaroundDays,
                              imageUrl: "",
                            });
                          }}
                          leftIcon={<Plus className="h-4 w-4" />}
                        >
                          Add item
                        </LButton>
                      </div>
                    </div>
                  )}
                </LCard>
              );
            })}
        </div>
      )}

      {/* Add category */}
      <LResponsiveDialog
        open={addCategoryOpen}
        onClose={() => setAddCategoryOpen(false)}
        title="Add category"
      >
        <div className="space-y-4">
          <LTextInput
            label="Category name"
            value={newCategoryForm.name}
            onChange={(e) =>
              setNewCategoryForm((f) => ({ ...f, name: e.target.value }))
            }
            placeholder="e.g. Wash & Iron"
          />
          <LSelect
            label="Icon"
            value={newCategoryForm.icon}
            onChange={(v) =>
              setNewCategoryForm((f) => ({ ...f, icon: v }))
            }
            options={CATEGORY_ICON_OPTIONS}
          />
          <LNumberInput
            label="Order"
            value={newCategoryForm.order}
            onChange={(v) =>
              setNewCategoryForm((f) => ({ ...f, order: v ?? 1 }))
            }
            min={1}
          />
          <LNumberInput
            label="Turnaround days"
            value={newCategoryForm.turnaroundDays}
            onChange={(v) =>
              setNewCategoryForm((f) => ({ ...f, turnaroundDays: v ?? 1 }))
            }
            min={1}
          />
          <div className="flex justify-end gap-2 pt-4">
            <LButton variant="outline" onClick={() => setAddCategoryOpen(false)}>
              Cancel
            </LButton>
            <LButton onClick={handleAddCategory}>Add category</LButton>
          </div>
        </div>
      </LResponsiveDialog>

      {/* Add item */}
      <LResponsiveDialog
        open={!!addItemCategory}
        onClose={() => setAddItemCategory(null)}
        title={addItemCategory ? `Add item to ${addItemCategory.name}` : "Add item"}
      >
        {addItemCategory && (
          <div className="space-y-4">
            <LTextInput
              label="Item name"
              value={newItemForm.name}
              onChange={(e) =>
                setNewItemForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="e.g. Shirt"
            />
            <LTextInput
              label="Sub-category (optional)"
              value={newItemForm.subCategory}
              onChange={(e) =>
                setNewItemForm((f) => ({ ...f, subCategory: e.target.value }))
              }
              placeholder="e.g. Men's Wear"
            />
            <LNumberInput
              label="Base price (₹)"
              value={newItemForm.basePrice}
              onChange={(v) =>
                setNewItemForm((f) => ({ ...f, basePrice: v ?? 0 }))
              }
              min={0}
            />
            <LSelect
              label="Pricing type"
              value={newItemForm.pricingType}
              onChange={(v) =>
                setNewItemForm((f) => ({
                  ...f,
                  pricingType: v as DefaultCatalogItem["pricingType"],
                }))
              }
              options={PRICING_OPTIONS}
            />
            <LNumberInput
              label="Turnaround days"
              value={newItemForm.turnaroundDays}
              onChange={(v) =>
                setNewItemForm((f) => ({ ...f, turnaroundDays: v ?? 1 }))
              }
              min={1}
            />
            <LTextInput
              label="Image URL (optional)"
              value={newItemForm.imageUrl}
              onChange={(e) =>
                setNewItemForm((f) => ({ ...f, imageUrl: e.target.value }))
              }
              placeholder="https://…"
            />
            <div className="flex justify-end gap-2 pt-4">
              <LButton variant="outline" onClick={() => setAddItemCategory(null)}>
                Cancel
              </LButton>
              <LButton onClick={handleAddItem}>Add item</LButton>
            </div>
          </div>
        )}
      </LResponsiveDialog>

      {/* Delete item confirm */}
      <LConfirmDialog
        open={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleDeleteItem}
        title="Remove item?"
        description={
          itemToDelete
            ? `"${itemToDelete.name}" will be removed from the default catalog. New shops will no longer get this item.`
            : undefined
        }
        confirmText="Remove"
        cancelText="Cancel"
        variant="destructive"
      />

      <LResponsiveDialog
        open={!!editItem}
        onClose={() => setEditItem(null)}
        title={editItem ? `Edit: ${editItem.name}` : "Edit item"}
      >
        {editItem && (
          <div className="space-y-4">
            <LTextInput
              label="Name"
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Item name"
            />
            <LNumberInput
              label="Base price (₹)"
              value={editForm.basePrice}
              onChange={(v) => setEditForm((f) => ({ ...f, basePrice: v }))}
              min={0}
            />
            <LSelect
              label="Pricing type"
              value={editForm.pricingType}
              onChange={(v) =>
                setEditForm((f) => ({ ...f, pricingType: v as DefaultCatalogItem["pricingType"] }))
              }
              options={PRICING_OPTIONS}
            />
            <LNumberInput
              label="Turnaround days"
              value={editForm.turnaroundDays}
              onChange={(v) => setEditForm((f) => ({ ...f, turnaroundDays: v }))}
              min={1}
            />
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Item image</p>
              <p className="text-xs text-muted-foreground">
                Upload an image or paste a URL. New shops will get this image in their POS.
              </p>
              <LSmartImageUploader
                shopId="platform"
                folder="default-catalog"
                maxFiles={1}
                showStats={false}
                value={
                  editForm.imageUrl
                    ? [imageMetadataFromUrl(editForm.imageUrl)]
                    : []
                }
                onChange={(metadata) =>
                  setEditForm((f) => ({
                    ...f,
                    imageUrl: metadata[0]?.url ?? "",
                  }))
                }
              />
              <LTextInput
                label="Or paste image URL"
                value={editForm.imageUrl}
                onChange={(e) => setEditForm((f) => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://…"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <LButton variant="outline" onClick={() => setEditItem(null)}>
                Cancel
              </LButton>
              <LButton onClick={applyEdit}>Apply</LButton>
            </div>
          </div>
        )}
      </LResponsiveDialog>
    </div>
  );
}
