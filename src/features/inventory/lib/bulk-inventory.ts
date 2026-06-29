/**
 * Bulk inventory import/export — pure logic (no React), so it stays unit-testable
 * and keeps `xlsx` lazy. SheetJS is only pulled in via `loadXlsx()` inside the two
 * functions that actually need it (generate + parse), so importing this module for
 * its types/constants never bloats the main bundle.
 *
 * Round-trip model:
 *  - Download exports the shop's CURRENT data as an .xlsx (Services + Items + Instructions sheets).
 *  - Re-upload (.xlsx or .csv): blank `id` = create, filled `id` = update, isActive=FALSE = deactivate.
 *    Nothing is ever deleted. An item's `categoryName` is resolved to the real categoryId
 *    (auto-creating the category if it's new).
 */

import { toTitleCase } from "@/lib/utils";
import type { InventoryCategory, InventoryItem, PricingType } from "@/types/inventory";

export const PRICING_TYPES: PricingType[] = ["piece", "kg", "lb", "sqft", "sqm", "set", "pair", "load", "bag"];

// No `id` columns — rows are matched by NAME (services by name, items by category + name).
// Auto-generated ids are never shown to the user, so they can't enter a wrong one.
export const SERVICE_COLUMNS = ["name", "icon", "turnaroundDays", "isActive"] as const;
export const ITEM_COLUMNS = [
    "categoryName", "name", "subCategory", "basePrice",
    "pricingType", "expressMultiplier", "turnaroundDays", "description", "isActive",
] as const;

type RawRow = Record<string, unknown>;

export interface RowError {
    sheet: "Services" | "Items";
    rowNo: number;
    field: string;
    message: string;
}

export interface PlannedCategory {
    tempKey: string;            // "new:<normalized name>" — resolved to a real id at write time
    name: string;
    icon?: string;
    turnaroundDays: number;
    isActive: boolean;
}
export interface SvcUpdate {
    id: string;
    name: string;
    icon?: string;
    turnaroundDays: number;
    isActive: boolean;
}
export interface ItemWrite {
    id?: string;                // present => update
    categoryRef: string;        // real categoryId OR a planned tempKey ("new:…")
    categoryName: string;
    name: string;
    subCategory?: string;
    basePrice: number;
    pricingType: PricingType;
    expressMultiplier: number;
    turnaroundDays: number;
    description?: string;
    isActive: boolean;
}

export interface ImportPlan {
    plannedCats: PlannedCategory[]; // categories to create (from Services sheet + auto-created from item rows), deduped
    svcUpdate: SvcUpdate[];
    itemCreate: ItemWrite[];
    itemUpdate: ItemWrite[];
    /** Replace-mode candidates: currently-active ids NOT present in the file (hidden only if the user opts in). */
    svcDeactivate: string[];
    itemDeactivate: string[];
    errors: RowError[];
    counts: {
        newCategories: number;
        servicesUpdate: number;
        itemsCreate: number;
        itemsUpdate: number;
        servicesDeactivate: number;
        itemsDeactivate: number;
        errors: number;
    };
}

/** Single lazy entry point for SheetJS — reused by generate + parse.
 * Defensive against CJS/ESM interop: some bundlers expose the API on the module
 * namespace, others under `.default`. */
async function loadXlsx(): Promise<typeof import("xlsx")> {
    const mod = (await import("xlsx")) as unknown as Record<string, unknown>;
    return (mod.utils ? mod : (mod.default as Record<string, unknown>)) as unknown as typeof import("xlsx");
}

// ---------- helpers ----------

/** Mirror the mutation-layer normalization so sheet names match stored names. */
export function normalizeName(s: string): string {
    return toTitleCase(String(s ?? "").trim());
}

/** Case/space-insensitive header lookup so "Name" and "name" both work. */
function pick(row: RawRow, key: string): string {
    const target = key.toLowerCase();
    for (const k of Object.keys(row)) {
        if (k.toLowerCase().trim() === target) return String(row[k] ?? "").trim();
    }
    return "";
}

function isEmptyRow(row: RawRow): boolean {
    return Object.values(row).every((v) => String(v ?? "").trim() === "");
}

function parseBool(raw: string, def: boolean): { ok: boolean; value: boolean } {
    const v = raw.trim().toLowerCase();
    if (v === "") return { ok: true, value: def };
    if (["true", "yes", "1", "y", "active"].includes(v)) return { ok: true, value: true };
    if (["false", "no", "0", "n", "inactive", "hidden"].includes(v)) return { ok: true, value: false };
    return { ok: false, value: def };
}

function parseNumber(raw: string, def: number): { ok: boolean; value: number } {
    const v = raw.trim();
    if (v === "") return { ok: true, value: def };
    const n = Number(v.replace(/,/g, "")); // tolerate "1,200"
    if (Number.isNaN(n)) return { ok: false, value: def };
    return { ok: true, value: n };
}

function coercePricingType(raw: string): { ok: boolean; value: PricingType } {
    const v = raw.trim().toLowerCase();
    if (v === "") return { ok: true, value: "piece" };
    if ((PRICING_TYPES as string[]).includes(v)) return { ok: true, value: v as PricingType };
    return { ok: false, value: "piece" };
}

// ---------- template generation (export) ----------

export async function generateTemplateBlob(
    categories: InventoryCategory[],
    items: InventoryItem[],
): Promise<Blob> {
    const XLSX = await loadXlsx();

    const svcRows = categories.length
        ? categories.map((c) => ({
              name: c.name,
              icon: c.icon ?? "",
              turnaroundDays: c.turnaroundDays ?? 2,
              isActive: c.isActive ? "TRUE" : "FALSE",
          }))
        : [{ name: "Wash & Fold", icon: "droplets", turnaroundDays: 2, isActive: "TRUE" }];

    const itemRows = items.length
        ? items.map((i) => ({
              categoryName: i.categoryName,
              name: i.name,
              subCategory: i.subCategory ?? "",
              basePrice: i.basePrice,
              pricingType: i.pricingType,
              expressMultiplier: i.expressMultiplier,
              turnaroundDays: i.turnaroundDays,
              description: i.description ?? "",
              isActive: i.isActive ? "TRUE" : "FALSE",
          }))
        : [{
              categoryName: "Wash & Fold", name: "Shirt", subCategory: "",
              basePrice: 20, pricingType: "piece", expressMultiplier: 1.5,
              turnaroundDays: 2, description: "", isActive: "TRUE",
          }];

    const wsSvc = XLSX.utils.json_to_sheet(svcRows, { header: SERVICE_COLUMNS as unknown as string[] });
    const wsItems = XLSX.utils.json_to_sheet(itemRows, { header: ITEM_COLUMNS as unknown as string[] });

    const ref: (string | number)[][] = [
        ["HOW TO USE THIS FILE"],
        ["Rows are matched by NAME — you never deal with ids."],
        ["Keep a name the same and change other columns to UPDATE that item/service."],
        ["Add a new row with a new name to CREATE a new item/service."],
        ["To hide something, set isActive to FALSE. (Import never deletes anything.)"],
        ["To rename, change it in the app (changing a name here makes a NEW one)."],
        ["On the Items sheet, categoryName must match a Service name."],
        ["If a categoryName is new, the service (category) is created automatically."],
        [""],
        ["Valid pricingType values:", ...PRICING_TYPES],
        ["isActive accepts:", "TRUE / FALSE / yes / no / 1 / 0"],
        [""],
        ["Your existing service (category) names:"],
        ...categories.map((c) => [c.name]),
    ];
    const wsRef = XLSX.utils.aoa_to_sheet(ref);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSvc, "Services");
    XLSX.utils.book_append_sheet(wb, wsItems, "Items");
    XLSX.utils.book_append_sheet(wb, wsRef, "Instructions");

    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// ---------- parse (import) ----------

export async function parseWorkbook(file: File): Promise<{ services: RawRow[]; items: RawRow[] }> {
    const XLSX = await loadXlsx();
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const svcSheet = wb.Sheets["Services"];
    // CSV / single-sheet files: treat the only (or first) sheet as the Items sheet.
    const itemSheet = wb.Sheets["Items"] ?? wb.Sheets[wb.SheetNames[0]];
    const opts = { defval: "", raw: false } as const;
    return {
        services: svcSheet ? (XLSX.utils.sheet_to_json(svcSheet, opts) as RawRow[]) : [],
        items: itemSheet ? (XLSX.utils.sheet_to_json(itemSheet, opts) as RawRow[]) : [],
    };
}

// ---------- validate + resolve + classify (pure) ----------

export function buildImportPlan(
    raw: { services: RawRow[]; items: RawRow[] },
    existingCategories: InventoryCategory[],
    existingItems: InventoryItem[],
): ImportPlan {
    const errors: RowError[] = [];

    // norm name -> { id, source }. id is a real categoryId (existing) or a tempKey (planned).
    const catByNorm = new Map<string, { id: string; source: "existing" | "planned" }>();
    for (const c of existingCategories) catByNorm.set(normalizeName(c.name), { id: c.id, source: "existing" });
    // existing items keyed by `${categoryId}|${normName}` → queue of ids, consumed on match
    // (so duplicate item names within a category map to distinct existing rows in order).
    const itemsByKey = new Map<string, string[]>();
    for (const it of existingItems) {
        const key = `${it.categoryId}|${normalizeName(it.name)}`;
        const arr = itemsByKey.get(key);
        if (arr) arr.push(it.id);
        else itemsByKey.set(key, [it.id]);
    }

    const plannedCats: PlannedCategory[] = [];
    const plannedByTemp = new Map<string, PlannedCategory>();
    const planNewCategory = (name: string, icon: string, turnaroundDays: number, isActive: boolean): string => {
        const norm = normalizeName(name);
        const tempKey = `new:${norm}`;
        if (!plannedByTemp.has(tempKey)) {
            const pc: PlannedCategory = { tempKey, name, icon, turnaroundDays, isActive };
            plannedByTemp.set(tempKey, pc);
            plannedCats.push(pc);
            catByNorm.set(norm, { id: tempKey, source: "planned" });
        }
        return tempKey;
    };

    const svcUpdate: SvcUpdate[] = [];

    // ===== Services sheet =====
    raw.services.forEach((row, idx) => {
        const rowNo = idx + 2; // +1 header, +1 to 1-base
        if (isEmptyRow(row)) return;
        const name = pick(row, "name");
        if (!name) {
            errors.push({ sheet: "Services", rowNo, field: "name", message: "Name is required." });
            return;
        }
        const icon = pick(row, "icon");
        const tdR = parseNumber(pick(row, "turnaroundDays"), 2);
        if (!tdR.ok) errors.push({ sheet: "Services", rowNo, field: "turnaroundDays", message: `"${pick(row, "turnaroundDays")}" is not a number.` });
        const actR = parseBool(pick(row, "isActive"), true);
        if (!actR.ok) errors.push({ sheet: "Services", rowNo, field: "isActive", message: `"${pick(row, "isActive")}" is not TRUE/FALSE.` });

        const existing = catByNorm.get(normalizeName(name));
        if (existing && existing.source === "existing") {
            // name matches an existing service → update it
            svcUpdate.push({ id: existing.id, name, icon, turnaroundDays: tdR.value, isActive: actR.value });
        } else if (!existing) {
            // new name → create the service
            planNewCategory(name, icon, tdR.value, actR.value);
        }
        // existing.source === "planned" (same new name appears twice) → already planned; skip
    });

    // ===== Items sheet =====
    const itemCreate: ItemWrite[] = [];
    const itemUpdate: ItemWrite[] = [];
    raw.items.forEach((row, idx) => {
        const rowNo = idx + 2;
        if (isEmptyRow(row)) return;
        const name = pick(row, "name");
        const categoryName = pick(row, "categoryName");
        let bad = false;
        if (!name) { errors.push({ sheet: "Items", rowNo, field: "name", message: "Name is required." }); bad = true; }
        if (!categoryName) { errors.push({ sheet: "Items", rowNo, field: "categoryName", message: "Category is required." }); bad = true; }

        const priceR = parseNumber(pick(row, "basePrice"), 0);
        if (!priceR.ok) { errors.push({ sheet: "Items", rowNo, field: "basePrice", message: `"${pick(row, "basePrice")}" is not a number.` }); bad = true; }
        else if (priceR.value < 0) { errors.push({ sheet: "Items", rowNo, field: "basePrice", message: "Price must be 0 or more." }); bad = true; }
        const ptR = coercePricingType(pick(row, "pricingType"));
        if (!ptR.ok) { errors.push({ sheet: "Items", rowNo, field: "pricingType", message: `"${pick(row, "pricingType")}" is not valid (use: ${PRICING_TYPES.join(", ")}).` }); bad = true; }
        const multR = parseNumber(pick(row, "expressMultiplier"), 1.5);
        if (!multR.ok) { errors.push({ sheet: "Items", rowNo, field: "expressMultiplier", message: `"${pick(row, "expressMultiplier")}" is not a number.` }); bad = true; }
        const tdR = parseNumber(pick(row, "turnaroundDays"), 2);
        if (!tdR.ok) { errors.push({ sheet: "Items", rowNo, field: "turnaroundDays", message: `"${pick(row, "turnaroundDays")}" is not a number.` }); bad = true; }
        const actR = parseBool(pick(row, "isActive"), true);
        if (!actR.ok) { errors.push({ sheet: "Items", rowNo, field: "isActive", message: `"${pick(row, "isActive")}" is not TRUE/FALSE.` }); bad = true; }

        if (bad) return;

        // resolve category (existing OR planned earlier OR auto-create)
        let resolved = catByNorm.get(normalizeName(categoryName));
        if (!resolved) {
            const tempKey = planNewCategory(categoryName, "", 2, true);
            resolved = { id: tempKey, source: "planned" };
        }

        const write: ItemWrite = {
            categoryRef: resolved.id,
            categoryName,
            name,
            subCategory: pick(row, "subCategory") || undefined,
            basePrice: priceR.value,
            pricingType: ptR.value,
            expressMultiplier: multR.value,
            turnaroundDays: tdR.value,
            description: pick(row, "description") || undefined,
            isActive: actR.value,
        };

        // match an existing item by category + name (only when the category already exists)
        let matchedId: string | undefined;
        if (resolved.source === "existing") {
            const bucket = itemsByKey.get(`${resolved.id}|${normalizeName(name)}`);
            if (bucket && bucket.length) matchedId = bucket.shift();
        }
        if (matchedId) itemUpdate.push({ ...write, id: matchedId });
        else itemCreate.push(write);
    });

    // ===== Replace-mode candidates: active rows NOT present in the file =====
    // "kept" = matched/updated items + any category touched by a Services row or referenced by an item row.
    const keptItemIds = new Set(itemUpdate.map((u) => u.id as string));
    const keptCatIds = new Set<string>(svcUpdate.map((u) => u.id));
    for (const w of [...itemUpdate, ...itemCreate]) {
        if (!w.categoryRef.startsWith("new:")) keptCatIds.add(w.categoryRef);
    }
    const itemDeactivate = existingItems.filter((it) => it.isActive && !keptItemIds.has(it.id)).map((it) => it.id);
    const svcDeactivate = existingCategories.filter((c) => c.isActive && !keptCatIds.has(c.id)).map((c) => c.id);

    return {
        plannedCats,
        svcUpdate,
        itemCreate,
        itemUpdate,
        svcDeactivate,
        itemDeactivate,
        errors,
        counts: {
            newCategories: plannedCats.length,
            servicesUpdate: svcUpdate.length,
            itemsCreate: itemCreate.length,
            itemsUpdate: itemUpdate.length,
            servicesDeactivate: svcDeactivate.length,
            itemsDeactivate: itemDeactivate.length,
            errors: errors.length,
        },
    };
}
