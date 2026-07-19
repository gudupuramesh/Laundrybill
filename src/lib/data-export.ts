/**
 * Bulk data export — download ALL of the shop's orders or customers as CSV or Excel.
 *
 * Reads directly from Firestore (not the paginated list hooks, which only hold the
 * current page), flattens each document into a spreadsheet row, and triggers a
 * browser download. `xlsx` (SheetJS) is lazy-loaded only when an Excel export runs,
 * so it never enters the initial bundle — same pattern as bulk-inventory.ts.
 */

import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DELIVERY_TYPE_LABELS, STATUS_LABELS } from "@/types/order";

export type ExportFormat = "xlsx" | "csv";

// ─── helpers ──────────────────────────────────────────────────────────────

function tsToString(v: unknown): string {
    if (!v) return "";
    // Firestore Timestamp, JS Date, or {seconds}
    const anyV = v as { toDate?: () => Date; seconds?: number };
    let d: Date | null = null;
    if (typeof anyV.toDate === "function") d = anyV.toDate();
    else if (typeof anyV.seconds === "number") d = new Date(anyV.seconds * 1000);
    else if (v instanceof Date) d = v;
    if (!d || isNaN(d.getTime())) return "";
    // Locale-independent, spreadsheet-friendly: YYYY-MM-DD HH:mm
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function labelDeliveryType(dt?: string): string {
    return (dt && DELIVERY_TYPE_LABELS[dt as keyof typeof DELIVERY_TYPE_LABELS]) || dt || "";
}
function labelStatus(s?: string): string {
    return (s && STATUS_LABELS[s as keyof typeof STATUS_LABELS]) || s || "";
}

function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Minimal, dependency-free CSV (RFC-4180 quoting). */
function toCsv(rows: Record<string, unknown>[], headers: string[]): string {
    const esc = (val: unknown): string => {
        const s = val == null ? "" : String(val);
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(","));
    // BOM so Excel opens UTF-8 (₹, accented names) correctly.
    return "﻿" + lines.join("\r\n");
}

async function writeXlsx(rows: Record<string, unknown>[], headers: string[], sheetName: string): Promise<Blob> {
    const mod = (await import("xlsx")) as unknown as Record<string, unknown>;
    const XLSX = (mod.utils ? mod : (mod.default as Record<string, unknown>)) as unknown as typeof import("xlsx");
    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

async function downloadDataset(
    rows: Record<string, unknown>[],
    headers: string[],
    baseName: string,
    sheetName: string,
    format: ExportFormat,
) {
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
        triggerDownload(new Blob([toCsv(rows, headers)], { type: "text/csv;charset=utf-8" }), `${baseName}-${stamp}.csv`);
    } else {
        triggerDownload(await writeXlsx(rows, headers, sheetName), `${baseName}-${stamp}.xlsx`);
    }
}

// ─── Orders ─────────────────────────────────────────────────────────────────

const ORDER_HEADERS = [
    "Order ID", "Order Number", "Status", "Order Type", "Order Source",
    "Customer", "Phone", "Email",
    "Items", "Item Count", "Pieces",
    "Subtotal", "Discount", "Coupon", "Tax", "Delivery Charge",
    "Points Redeemed", "Points Earned",
    "Total", "Paid", "Balance", "Payment Status",
    "Delivery Area", "Delivery Address", "Assigned Agent", "Staff",
    "Created", "Expected Delivery", "Notes",
];

function orderToRow(o: Record<string, any>): Record<string, unknown> {
    const fin = o.financials || {};
    const items: any[] = Array.isArray(o.items) ? o.items : [];
    const itemSummary = items
        .map((i) => `${i.serviceName || i.categoryName || "Item"} x${i.quantity ?? 1}`)
        .join("; ");
    const pieces = items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
    return {
        "Order ID": o.publicId || o.orderNumber || o.id || "",
        "Order Number": o.orderNumber || "",
        "Status": labelStatus(o.status),
        "Order Type": labelDeliveryType(o.deliveryType),
        "Order Source": o.orderSource || "pos",
        "Customer": o.customerName || (o.isGuest ? "Guest" : ""),
        "Phone": o.customerPhone || "",
        "Email": o.customerEmail || "",
        "Items": itemSummary,
        "Item Count": items.length,
        "Pieces": pieces,
        "Subtotal": Math.round(fin.subtotal || 0),
        "Discount": Math.round(fin.discountAmount || 0),
        "Coupon": fin.couponCode || "",
        "Tax": Math.round(fin.taxAmount || 0),
        "Delivery Charge": Math.round(fin.deliveryCharge || 0),
        "Points Redeemed": fin.pointsRedeemed || 0,
        "Points Earned": o.loyalty?.earnedPoints || 0,
        "Total": Math.round(fin.total || 0),
        "Paid": Math.round(fin.amountPaid || 0),
        "Balance": Math.round(fin.balance ?? ((fin.total || 0) - (fin.amountPaid || 0))),
        "Payment Status": o.paymentStatus || "",
        "Delivery Area": o.deliveryArea || "",
        "Delivery Address": o.deliveryAddress || o.customerAddress || "",
        "Assigned Agent": o.assignedAgentName || "",
        "Staff": o.staffName || "",
        "Created": tsToString(o.createdAt),
        "Expected Delivery": tsToString(o.expectedDelivery),
        "Notes": o.deliveryNotes || "",
    };
}

export async function exportOrders(shopId: string, format: ExportFormat): Promise<number> {
    const snap = await getDocs(query(collection(db, "shops", shopId, "orders"), orderBy("createdAt", "desc")));
    const rows = snap.docs.map((d) => orderToRow({ id: d.id, ...(d.data() as Record<string, unknown>) }));
    await downloadDataset(rows, ORDER_HEADERS, "orders", "Orders", format);
    return rows.length;
}

// ─── Customers ────────────────────────────────────────────────────────────

const CUSTOMER_HEADERS = [
    "Name", "Phone", "Email", "Area", "Address",
    "Total Orders", "Total Spent", "Loyalty Points", "Points Earned (lifetime)",
    "Notes", "Last Order", "Joined",
];

function customerToRow(c: Record<string, any>): Record<string, unknown> {
    const address = c.address
        || (Array.isArray(c.addresses) && c.addresses[0]?.address)
        || "";
    return {
        "Name": c.name || "",
        "Phone": c.phone || "",
        "Email": c.email || "",
        "Area": c.area || "",
        "Address": address,
        "Total Orders": c.totalOrders || 0,
        "Total Spent": Math.round(c.totalSpent || 0),
        "Loyalty Points": Math.max(0, Math.round(c.loyaltyPoints || 0)),
        "Points Earned (lifetime)": Math.max(0, Math.round(c.loyaltyEarned || 0)),
        "Notes": c.notes || "",
        "Last Order": tsToString(c.lastOrderAt),
        "Joined": tsToString(c.createdAt),
    };
}

export async function exportCustomers(shopId: string, format: ExportFormat): Promise<number> {
    const snap = await getDocs(collection(db, "shops", shopId, "customers"));
    const rows = snap.docs
        .map((d) => customerToRow({ id: d.id, ...(d.data() as Record<string, unknown>) }))
        .sort((a, b) => String(a["Name"]).localeCompare(String(b["Name"])));
    await downloadDataset(rows, CUSTOMER_HEADERS, "customers", "Customers", format);
    return rows.length;
}
