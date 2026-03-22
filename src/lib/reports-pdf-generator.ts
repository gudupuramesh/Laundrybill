/**
 * Reports PDF Generator (Manual jsPDF Implementation)
 * 
 * Generates a high-quality A4 PDF financial report by drawing directly on the canvas.
 * This avoids HTML/CSS rendering issues (html2canvas) and provides perfect layout control.
 */

import { jsPDF } from "jspdf";
import { format } from "date-fns";

export interface ReportData {
    periodLabel: string;
    revenue: number;
    orderCount: number;
    avgOrderValue: number;
    collections: number;
    outstanding: number;
    collectionRate: number;
    totalExpenses: number;
    expensesByCategory: Record<string, number>;
    salariesPaid: number;
    profit: number;
    profitMargin: number;
    orderStats: {
        total: number;
        delivered: number;
        cancelled: number;
        pickupStore: number;
        deliveryHome: number;
        pickupHome: number;
    };
    staffMetrics?: {
        staffId: string;
        staffName: string;
        presentDays: number;
        salaryPaid: number;
    }[];
    customerStats?: {
        totalCustomers: number;
        newCustomers: number;
    };
}

export const generateReportsPDF = async (data: ReportData) => {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = margin;

    // Helper: Draw text
    const text = (str: string, x: number, yVal: number, options?: { align?: "left" | "center" | "right", size?: number, font?: "normal" | "bold" | "italic", color?: [number, number, number] }) => {
        doc.setFont("helvetica", options?.font || "normal");
        doc.setFontSize(options?.size || 10);
        doc.setTextColor(...(options?.color || [0, 0, 0]));
        doc.text(str, x, yVal, { align: options?.align || "left" });
    };

    // Helper: Draw line
    const divider = (yVal: number) => {
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.5);
        doc.line(margin, yVal, pageWidth - margin, yVal);
        return yVal + 10;
    };

    // Helper: Check page overflow
    const checkOverflow = (needed: number) => {
        if (y + needed > pageHeight - margin) {
            doc.addPage();
            y = margin;
            return true;
        }
        return false;
    };

    // --- HEADER ---
    doc.setFillColor(245, 247, 250); // Light background for header
    doc.rect(0, 0, pageWidth, 40, "F");

    text("Finanical Report", margin, 25, { size: 24, font: "bold", color: [13, 148, 136] }); // Primary Color
    text(`Generated on ${format(new Date(), "MMM d, yyyy")}`, margin, 32, { size: 10, color: [100, 116, 139] });

    text(data.periodLabel, pageWidth - margin, 25, { size: 14, font: "bold", align: "right" });
    text("Statement Period", pageWidth - margin, 32, { size: 10, color: [100, 116, 139], align: "right" });

    y = 50;

    // --- KPI GRID ---
    const drawKpi = (label: string, value: string, x: number, color: [number, number, number] = [0, 0, 0]) => {
        text(label.toUpperCase(), x, y, { size: 8, color: [100, 116, 139] });
        text(value, x, y + 6, { size: 16, font: "bold", color });
    };

    const colWidth = (pageWidth - margin * 2) / 4;

    drawKpi("Total Revenue", `Rs. ${data.revenue.toLocaleString()}`, margin);
    drawKpi("Expenses", `Rs. ${data.totalExpenses.toLocaleString()}`, margin + colWidth, [220, 38, 38]); // Red

    const profitColor: [number, number, number] = data.profit >= 0 ? [22, 163, 74] : [220, 38, 38];
    drawKpi("Net Profit", `Rs. ${data.profit.toLocaleString()}`, margin + colWidth * 2, profitColor);
    drawKpi("Profit Margin", `${data.profitMargin.toFixed(1)}%`, margin + colWidth * 3, profitColor);

    y += 20;
    y = divider(y);

    // --- OPERATIONAL METRICS & ORDER SOURCES ---
    const leftCol = margin;
    const rightCol = pageWidth / 2 + 10;

    text("Operational Metrics", leftCol, y, { size: 12, font: "bold" });
    text("Order Sources", rightCol, y, { size: 12, font: "bold" });
    y += 8;

    const rowHeight = 6;
    const metricRow = (label: string, val: string, x: number) => {
        text(label, x, y, { color: [100, 116, 139] });
        text(val, x + 60, y, { align: "right", font: "bold" });
    };

    const ongoing = data.orderStats.total - data.orderStats.delivered - data.orderStats.cancelled;

    // Left Column
    metricRow("Total Orders", data.orderCount.toString(), leftCol);
    text(`${data.orderStats.pickupStore}`, rightCol + 60, y, { align: "right", font: "bold" });
    text("Store Walk-in", rightCol, y, { color: [100, 116, 139] });
    y += rowHeight;

    metricRow("Avg Order Value", `Rs. ${data.avgOrderValue.toFixed(0)}`, leftCol);
    text(`${data.orderStats.deliveryHome}`, rightCol + 60, y, { align: "right", font: "bold" });
    text("Standard Delivery", rightCol, y, { color: [100, 116, 139] });
    y += rowHeight;

    metricRow("Ongoing Orders", ongoing.toString(), leftCol);
    text(`${data.orderStats.pickupHome}`, rightCol + 60, y, { align: "right", font: "bold" });
    text("Pickup & Delivery", rightCol, y, { color: [100, 116, 139] });
    y += rowHeight;

    metricRow("Completed", data.orderStats.delivered.toString(), leftCol);
    y += rowHeight;

    metricRow("Cancelled", data.orderStats.cancelled.toString(), leftCol);
    y += rowHeight + 5;

    y = divider(y);

    // --- STAFF & CUSTOMER ---
    checkOverflow(60);
    text("Staff Performance & Payroll", leftCol, y, { size: 12, font: "bold" });
    text("Customer Growth", rightCol, y, { size: 12, font: "bold" });
    y += 8;

    const startY = y;

    // Staff Table
    if (data.staffMetrics && data.staffMetrics.length > 0) {
        text("Name", leftCol, y, { size: 9, font: "bold", color: [100, 116, 139] });
        text("Days", leftCol + 40, y, { size: 9, font: "bold", color: [100, 116, 139], align: "right" });
        text("Paid", leftCol + 65, y, { size: 9, font: "bold", color: [100, 116, 139], align: "right" });
        y += 6;

        data.staffMetrics.forEach(staff => {
            text(staff.staffName, leftCol, y, { size: 9 });
            text(staff.presentDays.toString(), leftCol + 40, y, { size: 9, align: "right" });
            text(staff.salaryPaid.toLocaleString(), leftCol + 65, y, { size: 9, align: "right" });
            y += 5;
        });
    } else {
        text("No staff data available.", leftCol, y + 5, { size: 9, color: [100, 116, 139], font: "italic" });
        y += 10;
    }

    // Customer Stats (Right side)
    const custY = startY;
    if (data.customerStats) {
        // Boxes
        doc.setDrawColor(13, 148, 136); // Primary
        doc.setFillColor(240, 253, 250); // Primary Light
        doc.roundedRect(rightCol, custY, 35, 20, 2, 2, "FD");

        text(data.customerStats.newCustomers.toString(), rightCol + 17.5, custY + 8, { align: "center", font: "bold", size: 12, color: [13, 148, 136] });
        text("NEW", rightCol + 17.5, custY + 14, { align: "center", size: 7, color: [13, 148, 136] });

        doc.setDrawColor(226, 232, 240); // Border
        doc.setFillColor(255, 255, 255); // White
        doc.roundedRect(rightCol + 40, custY, 35, 20, 2, 2, "FD");

        text(data.customerStats.totalCustomers.toString(), rightCol + 57.5, custY + 8, { align: "center", font: "bold", size: 12 });
        text("TOTAL", rightCol + 57.5, custY + 14, { align: "center", size: 7, color: [100, 116, 139] });

        text(`${data.customerStats.newCustomers} new customers added this period.`, rightCol, custY + 28, { size: 9, color: [100, 116, 139] });
    }

    // Ensure Y is below both columns
    y = Math.max(y, startY + 35);
    y = divider(y);

    // --- FINANCIAL SUMMARY & EXPENSES ---
    checkOverflow(80);
    text("Financial Summary", leftCol, y, { size: 12, font: "bold" });
    text("Expense Breakdown", rightCol, y, { size: 12, font: "bold" });
    y += 8;

    const finStartY = y;

    // Financial Table
    const financeRow = (label: string, val: number, isBold: boolean = false, color: [number, number, number] = [0, 0, 0]) => {
        text(label, leftCol, y, { size: 9, font: isBold ? "bold" : "normal", color: isBold ? [0, 0, 0] : [100, 116, 139] });
        text(`Rs. ${val.toLocaleString()}`, leftCol + 65, y, { size: 9, align: "right", font: isBold ? "bold" : "normal", color });
        y += 6;
        doc.setDrawColor(240, 240, 240);
        doc.line(leftCol, y - 4, leftCol + 70, y - 4); // row line
    };

    financeRow("Total Billed", data.revenue);
    financeRow("Collections (Received)", data.collections, false, [22, 163, 74]);
    financeRow("Outstanding (Unpaid)", data.outstanding, false, [220, 38, 38]);

    y += 2;
    financeRow("Net Profit", data.profit, true, profitColor);

    // Expense Table
    y = finStartY;
    const sortedExpenses = Object.entries(data.expensesByCategory)
        .filter(([_, amount]) => amount > 0)
        .sort((a, b) => b[1] - a[1]);

    if (sortedExpenses.length > 0) {
        sortedExpenses.slice(0, 8).forEach(([cat, amount]) => {
            const percentage = (amount / data.totalExpenses) * 100;
            const catName = cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

            text(catName, rightCol, y, { size: 9 });
            text(`${percentage.toFixed(0)}%`, rightCol + 50, y, { size: 8, color: [100, 116, 139], align: "right" });
            text(`Rs. ${amount.toLocaleString()}`, rightCol + 75, y, { size: 9, align: "right" });
            y += 5;
        });

        if (sortedExpenses.length > 8) {
            text(`+ ${sortedExpenses.length - 8} more categories...`, rightCol, y + 4, { size: 8, font: "italic", color: [100, 116, 139] });
        }
    } else {
        text("No expenses recorded.", rightCol, y, { size: 9, font: "italic", color: [100, 116, 139] });
    }

    // --- FOOTER ---
    const footerY = pageHeight - 15;
    doc.setDrawColor(13, 148, 136); // Primary line
    doc.setLineWidth(1);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

    const branding = "Generated by laundrybill.com";
    text(branding, pageWidth / 2, footerY, { align: "center", size: 8, color: [100, 116, 139] });
    const brandingWidth = doc.getTextWidth(branding);
    doc.link((pageWidth - brandingWidth) / 2, footerY - 3, brandingWidth, 4, { url: "https://laundrybill.com" });
    text(format(new Date(), "yyyy-MM-dd HH:mm"), pageWidth / 2, footerY + 4, { align: "center", size: 8, color: [100, 116, 139] });

    // Save
    const fileName = `Financial_Report_${data.periodLabel.replace(/[\s,]+/g, '_')}.pdf`;
    doc.save(fileName);
};
