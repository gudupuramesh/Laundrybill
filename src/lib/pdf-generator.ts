/**
 * PDF Generator
 * 
 * Generates PDF payslips and other documents
 */

import type { Staff, PayrollEntry } from "@/types/staff";
import { format } from "date-fns";

// Simple PDF generation using browser print
export async function generatePayslipPDF(
    staff: Staff,
    payroll: PayrollEntry,
    monthString: string,
    currencySymbol: string = "₹"
): Promise<void> {
    const monthDate = new Date(monthString + "-01");
    const monthYear = format(monthDate, "MMMM yyyy");

    // Create payslip HTML
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Payslip - ${staff.name} - ${monthYear}</title>
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
        .payslip {
            max-width: 800px;
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
        .payslip-title {
            font-size: 18px;
            color: #666;
            margin-top: 5px;
        }
        .month-year {
            font-size: 16px;
            color: #888;
            margin-top: 5px;
        }
        .section {
            margin-bottom: 20px;
        }
        .section-title {
            font-size: 14px;
            font-weight: bold;
            color: #1a1a2e;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
            margin-bottom: 10px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }
        .info-item {
            display: flex;
            justify-content: space-between;
        }
        .info-label {
            color: #666;
        }
        .info-value {
            font-weight: 500;
        }
        .earnings-table, .deductions-table {
            width: 100%;
            border-collapse: collapse;
        }
        .earnings-table td, .deductions-table td {
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        .earnings-table td:last-child, .deductions-table td:last-child {
            text-align: right;
        }
        .total-row {
            font-weight: bold;
            border-top: 2px solid #1a1a2e !important;
        }
        .net-salary-box {
            background: #1a1a2e;
            color: white;
            padding: 20px;
            text-align: center;
            margin-top: 20px;
        }
        .net-salary-label {
            font-size: 14px;
            opacity: 0.8;
        }
        .net-salary-amount {
            font-size: 32px;
            font-weight: bold;
        }
        .footer {
            margin-top: 30px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
        }
        .signature-box {
            border-top: 1px solid #333;
            padding-top: 10px;
            text-align: center;
            font-size: 12px;
            color: #666;
        }
        .payment-info {
            margin-top: 20px;
            padding: 15px;
            background: #f5f5f5;
            border-radius: 5px;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-paid {
            background: #d4edda;
            color: #155724;
        }
        .status-partial {
            background: #fff3cd;
            color: #856404;
        }
        @media print {
            body {
                padding: 0;
            }
            .payslip {
                border: none;
            }
        }
    </style>
</head>
<body>
    <div class="payslip">
        <div class="header">
            <div class="company-name">LaundryBill</div>
            <div class="payslip-title">PAYSLIP</div>
            <div class="month-year">${monthYear}</div>
        </div>

        <div class="section">
            <div class="section-title">EMPLOYEE DETAILS</div>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Name:</span>
                    <span class="info-value">${staff.name}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Phone:</span>
                    <span class="info-value">${staff.phone}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Pay Type:</span>
                    <span class="info-value">${staff.payType === "monthly" ? "Monthly Salary" : "Daily Wage"}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Base Rate:</span>
                    <span class="info-value">${currencySymbol}${staff.baseSalary.toLocaleString()}/${staff.payType === "monthly" ? "month" : "day"}</span>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">ATTENDANCE SUMMARY</div>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Days Present:</span>
                    <span class="info-value">${payroll.daysPresent ?? payroll.daysWorked ?? 0}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Days Absent:</span>
                    <span class="info-value">${payroll.daysAbsent ?? 0}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Half Days:</span>
                    <span class="info-value">${payroll.daysHalf ?? 0}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Leave Days:</span>
                    <span class="info-value">${payroll.daysLeave ?? 0}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Effective Days:</span>
                    <span class="info-value">${payroll.daysWorked ?? 0}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Overtime Hours:</span>
                    <span class="info-value">${payroll.overtimeHours ?? 0}h</span>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">EARNINGS</div>
            <table class="earnings-table">
                <tr>
                    <td>Base Salary</td>
                    <td>${currencySymbol}${payroll.baseSalary.toLocaleString()}</td>
                </tr>
                ${payroll.overtimeAmount > 0 ? `
                <tr>
                    <td>Overtime (${payroll.overtimeHours}h × 1.5x)</td>
                    <td>${currencySymbol}${payroll.overtimeAmount.toLocaleString()}</td>
                </tr>
                ` : ''}
                ${payroll.bonus > 0 ? `
                <tr>
                    <td>Bonus</td>
                    <td>${currencySymbol}${payroll.bonus.toLocaleString()}</td>
                </tr>
                ` : ''}
                ${payroll.isSettlement ? `
                ${payroll.noticePeriodAmount ? `
                <tr>
                    <td>Notice Period (${payroll.noticePeriodDays} days)</td>
                    <td>${currencySymbol}${payroll.noticePeriodAmount.toLocaleString()}</td>
                </tr>
                ` : ''}
                ${payroll.leaveEncashmentAmount ? `
                <tr>
                    <td>Leave Encashment (${payroll.leaveEncashmentDays} days)</td>
                    <td>${currencySymbol}${payroll.leaveEncashmentAmount.toLocaleString()}</td>
                </tr>
                ` : ''}
                ${payroll.gratuity ? `
                <tr>
                    <td>Gratuity</td>
                    <td>${currencySymbol}${payroll.gratuity.toLocaleString()}</td>
                </tr>
                ` : ''}
                ` : ''}
                <tr class="total-row">
                    <td>Total Earnings</td>
                    <td>${currencySymbol}${payroll.totalEarnings.toLocaleString()}</td>
                </tr>
            </table>
        </div>

        ${payroll.totalDeductions > 0 ? `
        <div class="section">
            <div class="section-title">DEDUCTIONS</div>
            <table class="deductions-table">
                ${payroll.advances > 0 ? `
                <tr>
                    <td>Advances</td>
                    <td>${currencySymbol}${payroll.advances.toLocaleString()}</td>
                </tr>
                ` : ''}
                ${payroll.deductions > 0 ? `
                <tr>
                    <td>Other Deductions</td>
                    <td>${currencySymbol}${payroll.deductions.toLocaleString()}</td>
                </tr>
                ` : ''}
                <tr class="total-row">
                    <td>Total Deductions</td>
                    <td>${currencySymbol}${payroll.totalDeductions.toLocaleString()}</td>
                </tr>
            </table>
        </div>
        ` : ''}

        <div class="net-salary-box">
            <div class="net-salary-label">NET SALARY</div>
            <div class="net-salary-amount">${currencySymbol}${payroll.netSalary.toLocaleString()}</div>
        </div>

        ${payroll.payments && payroll.payments.length > 0 ? `
        <div class="payment-info">
            <div class="section-title" style="margin-bottom: 10px;">PAYMENT DETAILS</div>
            ${payroll.payments.map(p => `
            <div class="info-item" style="margin-bottom: 5px;">
                <span>${p.date?.toDate ? format(p.date.toDate(), "dd MMM yyyy") : "-"} (${p.mode.toUpperCase()})</span>
                <span>${currencySymbol}${p.amount.toLocaleString()}</span>
            </div>
            `).join('')}
            <div class="info-item" style="margin-top: 10px; font-weight: bold;">
                <span>Total Paid:</span>
                <span>${currencySymbol}${payroll.totalPaid?.toLocaleString() ?? payroll.netSalary.toLocaleString()}</span>
            </div>
            <div style="margin-top: 10px;">
                <span class="status-badge ${payroll.status === 'paid' ? 'status-paid' : 'status-partial'}">
                    ${payroll.status.toUpperCase()}
                </span>
            </div>
        </div>
        ` : ''}

        <div class="footer">
            <div class="signature-box">
                Employee Signature
            </div>
            <div class="signature-box">
                Authorized Signature
            </div>
        </div>

        <div style="margin-top: 20px; text-align: center; font-size: 11px; color: #999;">
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
        throw new Error("Could not open print window. Please allow popups.");
    }
}
