import { jsPDF } from "jspdf";
import { PayrollInput, PayrollResult } from "./payroll";
import { TaxConfig } from "./taxConfig";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Whole-CZK formatting with thin spaces, safe for PDF text. */
function czk(n: number): string {
  const s = Math.round(n)
    .toLocaleString("en-US")
    .replace(/,/g, " ");
  return `${s} Kc`;
}

/** Build the calculated payslip as a jsPDF document (pure — no download side effect). */
export function buildPayslipDoc(
  input: PayrollInput,
  r: PayrollResult,
  cfg: TaxConfig,
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const LEFT = 20;
  const RIGHT = 190;
  let y = 22;

  const text = (s: string, x: number, opts: { align?: "left" | "right" } = {}) =>
    doc.text(s, x, y, { align: opts.align ?? "left" });

  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(10);
    doc.setTextColor(bold ? 0 : 40);
    text(label, LEFT);
    text(value, RIGHT, { align: "right" });
    y += 5.5;
  };

  const section = (t: string) => {
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(120);
    text(t.toUpperCase(), LEFT);
    doc.setTextColor(0);
    y += 5;
  };

  const divider = () => {
    doc.setDrawColor(220);
    doc.line(LEFT, y - 3.5, RIGHT, y - 3.5);
  };

  // --- Header ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  text("Czech Salary Calculator", LEFT);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  text(`Payslip estimate — ${MONTHS[input.month - 1]} ${cfg.year}`, LEFT);
  doc.setTextColor(0);
  y += 4;
  divider();
  y += 4;

  // --- To pay headline ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  text("TO PAY", LEFT);
  doc.setFontSize(18);
  text(czk(r.toPay), RIGHT, { align: "right" });
  y += 9;

  const phone = input.telephoneAllowance ?? 0;

  section("Gross salary");
  row("Basic wage", czk(r.basicWage));
  if (r.vacationPay > 0) row(`Vacation pay (${input.vacationDays ?? 0} days)`, czk(r.vacationPay));
  row("Gross salary", czk(r.grossSalary), true);

  section("Assessment base");
  row("Gross salary", czk(r.grossSalary));
  row("Car allowance", czk(input.carAllowance));
  if (phone > 0) row("Telephone allowance", czk(phone));
  if (input.taxableInsuranceMonthly > 0) row("Taxable insurance", czk(input.taxableInsuranceMonthly));
  if (r.taxablePensionExcess > 0) row("Taxable pension excess", czk(r.taxablePensionExcess));
  if (input.otherTaxableBenefits > 0) row("Other taxable benefits", czk(input.otherTaxableBenefits));
  row("Tax / insurance base", czk(r.base), true);

  section("Income tax");
  row("Tax before credits (15 % / 23 %)", czk(r.incomeTaxBeforeCredits));
  if (r.personalCreditsApplied > 0) row("Personal credits", `- ${czk(r.personalCreditsApplied)}`);
  if (r.childCreditApplied > 0) row("Child tax credit", `- ${czk(r.childCreditApplied)}`);
  row("Income tax withheld", czk(r.incomeTax), true);
  if (r.taxBonus > 0) row("Tax bonus (paid out)", czk(r.taxBonus));

  section("Employee contributions");
  row("Social security (7.1 %)", czk(r.socialEmployee));
  row("Health insurance (4.5 %)", czk(r.healthEmployee));

  section("Net & payout");
  row("Net salary", czk(r.netSalary));
  row("+ Car allowance", czk(input.carAllowance));
  if (phone > 0) row("+ Telephone allowance", czk(phone));
  row("- Employee pension", `- ${czk(r.employeePension)}`);
  if (input.multisport > 0) row("- Multisport", `- ${czk(input.multisport)}`);
  if (input.otherDeductions > 0) row("- Other deductions", `- ${czk(input.otherDeductions)}`);
  row("To pay", czk(r.toPay), true);

  section("Employer side (info)");
  row("Social security (24.8 %)", czk(r.socialEmployer));
  row("Health insurance (9 %)", czk(r.healthEmployer));
  row("Employer pension", czk(r.employerPension));
  row("Total employer cost", czk(r.employerCost), true);

  // --- Footer ---
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(130);
  const generated = new Date().toISOString().slice(0, 10);
  doc.text(
    `Tax year ${cfg.year}. Indicative estimate only — verify against your official payslip. Generated ${generated}.`,
    LEFT,
    285,
  );

  return doc;
}

/** File-name-safe payslip name, e.g. "payslip-june-2026.pdf". */
export function payslipFileName(input: PayrollInput, cfg: TaxConfig): string {
  return `payslip-${MONTHS[input.month - 1].toLowerCase()}-${cfg.year}.pdf`;
}

/** Build and trigger a browser download of the payslip PDF. */
export function downloadPayslip(
  input: PayrollInput,
  r: PayrollResult,
  cfg: TaxConfig,
): void {
  buildPayslipDoc(input, r, cfg).save(payslipFileName(input, cfg));
}
