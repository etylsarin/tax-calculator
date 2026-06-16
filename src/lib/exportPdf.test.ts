import { describe, it, expect } from "vitest";
import { buildPayslipDoc, payslipFileName } from "./exportPdf";
import { calculatePayroll, PayrollInput } from "./payroll";
import { TAX_CONFIG_2026 as CFG } from "./taxConfig";

const input: PayrollInput = {
  monthlySalary: 50000,
  carAllowance: 17000,
  telephoneAllowance: 800,
  vacationDays: 2,
  averageHourlyRate: 0,
  monthlyWorkHours: 168,
  employeePensionPct: 4,
  taxableInsuranceMonthly: 0,
  otherTaxableBenefits: 0,
  month: 6,
  applyBasicCredit: true,
  children: 2,
  multisport: 270,
  otherDeductions: 0,
};

describe("payslip PDF export", () => {
  it("builds a non-empty PDF document", () => {
    const r = calculatePayroll(input, CFG);
    const doc = buildPayslipDoc(input, r, CFG);
    const bytes = doc.output("arraybuffer");
    expect(bytes.byteLength).toBeGreaterThan(1000);
    // Sanity: it's a PDF (starts with "%PDF").
    const head = String.fromCharCode(...new Uint8Array(bytes).slice(0, 4));
    expect(head).toBe("%PDF");
  });

  it("derives a sensible file name from the month/year", () => {
    expect(payslipFileName(input, CFG)).toBe("payslip-june-2026.pdf");
  });
});
