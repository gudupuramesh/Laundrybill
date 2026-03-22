/**
 * Expenses PDF Generator
 * 
 * Generates PDF reports for expenses
 */

import type { Expense } from "@/types/finance";
import { format } from "date-fns";

const categoryConfig: Record<string, { label: string }> = {
    rent: { label: "Rent" },
    electricity: { label: "Electricity Bill" },
    water: { label: "Water Bill" },
    detergents: { label: "Detergents" },
    fabric_softener: { label: "Fabric Softener" },
    stain_remover: { label: "Stain Remover" },
    bleach: { label: "Bleach" },
    hangers: { label: "Hangers" },
    plastic_covers: { label: "Plastic Covers/Bags" },
    tags_ribbons: { label: "Tags & Ribbons" },
    iron_spray: { label: "Iron Spray" },
    equipment: { label: "Equipment Purchase" },
    maintenance: { label: "General Maintenance" },
    washing_machine: { label: "Washing Machine" },
    dryer: { label: "Dryer" },
    pressing_equipment: { label: "Pressing Equipment" },
    transport: { label: "Transport" },
    delivery: { label: "Delivery Charges" },
    packaging: { label: "Packaging Materials" },
    marketing: { label: "Marketing" },
    advertising: { label: "Advertising" },
    salary: { label: "Salary" },
    insurance: { label: "Insurance" },
    licenses: { label: "Licenses & Permits" },
    miscellaneous: { label: "Miscellaneous" },
};

function getCategoryLabel(expense: Expense): string {
    const config = categoryConfig[expense.category];
    if (config) return config.label;

    // Custom category
    return (expense as any).customCategoryName ||
        expense.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export async function generateExpensesPDF(
    expenses: Expense[],
    month: Date,
    selectedCategory?: string,
    currencySymbol: string = "₹"
): Promise<void> {
    const monthYear = format(month, "MMMM yyyy");
    const categoryLabel = selectedCategory && selectedCategory !== "all"
        ? getCategoryLabel(expenses.find(e => e.category === selectedCategory) || expenses[0])
        : "All Categories";

    // Calculate totals
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Group by category
    const byCategory = expenses.reduce((acc, expense) => {
        const catLabel = getCategoryLabel(expense);
        if (!acc[catLabel]) {
            acc[catLabel] = { expenses: [], total: 0 };
        }
        acc[catLabel].expenses.push(expense);
        acc[catLabel].total += expense.amount;
        return acc;
    }, {} as Record<string, { expenses: Expense[]; total: number }>);

    // Create HTML
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Expenses Report - ${monthYear}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 40px;
            color: #333;
            background: white;
        }
        .report {
            max-width: 900px;
            margin: 0 auto;
            border: 2px solid #1a1a2e;
            padding: 30px;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #1a1a2e;
            padding-bottom: 20px;
            margin-bottom: 20px;
        }
        .company-name {
            font-size: 28px;
            font-weight: bold;
            color: #1a1a2e;
        }
        .report-title {
            font-size: 18px;
            color: #666;
            margin-top: 5px;
        }
        .month-year {
            font-size: 16px;
            color: #888;
            margin-top: 5px;
        }
        .filter-info {
            text-align: center;
            margin-bottom: 20px;
            padding: 10px;
            background: #f5f5f5;
            border-radius: 5px;
            font-size: 14px;
            color: #666;
        }
        .summary {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            padding: 15px;
            background: #f9f9f9;
            border-radius: 5px;
            border: 1px solid #ddd;
        }
        .summary-label {
            font-size: 12px;
            color: #666;
            margin-bottom: 5px;
        }
        .summary-value {
            font-size: 24px;
            font-weight: bold;
            color: #1a1a2e;
        }
        .category-section {
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        .category-header {
            background: #1a1a2e;
            color: white;
            padding: 10px 15px;
            font-weight: bold;
            font-size: 14px;
            border-radius: 5px 5px 0 0;
        }
        .category-total {
            background: #f5f5f5;
            padding: 8px 15px;
            text-align: right;
            font-weight: bold;
            border-top: 1px solid #ddd;
        }
        .expenses-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #ddd;
        }
        .expenses-table th {
            background: #f5f5f5;
            padding: 10px;
            text-align: left;
            font-size: 12px;
            font-weight: bold;
            color: #666;
            border-bottom: 2px solid #ddd;
        }
        .expenses-table td {
            padding: 10px;
            border-bottom: 1px solid #eee;
            font-size: 12px;
        }
        .expenses-table tr:last-child td {
            border-bottom: none;
        }
        .amount-cell {
            text-align: right;
            font-weight: 500;
        }
        .date-cell {
            color: #666;
        }
        .total-box {
            background: #1a1a2e;
            color: white;
            padding: 20px;
            text-align: center;
            margin-top: 30px;
            border-radius: 5px;
        }
        .total-label {
            font-size: 14px;
            opacity: 0.8;
        }
        .total-amount {
            font-size: 36px;
            font-weight: bold;
            margin-top: 5px;
        }
        .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 11px;
            color: #999;
            border-top: 1px solid #eee;
            padding-top: 15px;
        }
        @media print {
            body {
                padding: 0;
            }
            .report {
                border: none;
            }
        }
    </style>
</head>
<body>
    <div class="report">
        <div class="header">
            <div class="company-name">LaundryBill</div>
            <div class="report-title">EXPENSES REPORT</div>
            <div class="month-year">${monthYear}</div>
        </div>

        ${selectedCategory && selectedCategory !== "all" ? `
        <div class="filter-info">
            Filtered by: <strong>${categoryLabel}</strong>
        </div>
        ` : ''}

        <div class="summary">
            <div class="summary-card">
                <div class="summary-label">Total Expenses</div>
                <div class="summary-value">${currencySymbol}${total.toLocaleString()}</div>
            </div>
            <div class="summary-card">
                <div class="summary-label">Number of Expenses</div>
                <div class="summary-value">${expenses.length}</div>
            </div>
        </div>

        ${Object.entries(byCategory)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([category, data]) => `
        <div class="category-section">
            <div class="category-header">
                ${category} (${data.expenses.length} ${data.expenses.length === 1 ? 'expense' : 'expenses'})
            </div>
            <table class="expenses-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Vendor</th>
                        <th style="text-align: right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.expenses
                    .sort((a, b) => b.date.toMillis() - a.date.toMillis())
                    .map(expense => `
                    <tr>
                        <td class="date-cell">${format(expense.date.toDate(), "dd MMM yyyy")}</td>
                        <td>${expense.description}</td>
                        <td>${expense.vendor || "-"}</td>
                        <td class="amount-cell">${currencySymbol}${expense.amount.toLocaleString()}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="category-total">
                Category Total: ${currencySymbol}${data.total.toLocaleString()}
            </div>
        </div>
        `).join('')}

        <div class="total-box">
            <div class="total-label">TOTAL EXPENSES</div>
            <div class="total-amount">${currencySymbol}${total.toLocaleString()}</div>
        </div>

        <div class="footer">
            Generated on ${format(new Date(), "dd MMM yyyy, hh:mm a")} | <a href="https://laundrybill.com" style="text-decoration:none; color: inherit;">LaundryBill</a>
        </div>
    </div>

    <script>
        window.onload = function() {
            window.print();
        }
    </script>
</body>
</html>
`;

    // Open new window and print
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
    } else {
        throw new Error("Failed to open print window. Please allow popups for this site.");
    }
}
