import { describe, it, expect } from "vitest";
import { calculatePayroll, childCredit, totalChildCredit, PayrollInput } from "./payroll";
import { TAX_CONFIG_2026 as CFG } from "./taxConfig";

/** Minimal valid input; override per test. No vacation, no benefits, 168 h month. */
function mk(overrides: Partial<PayrollInput> = {}): PayrollInput {
  return {
    monthlySalary: 40000,
    carAllowance: 0,
    employeePensionPct: 0,
    taxableInsuranceMonthly: 0,
    otherTaxableBenefits: 0,
    month: 1,
    applyBasicCredit: true,
    children: 0,
    multisport: 0,
    otherDeductions: 0,
    monthlyWorkHours: 168,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Child tax credit helpers
// ---------------------------------------------------------------------------
describe("childCredit / totalChildCredit", () => {
  it("returns the per-order monthly amounts (§ 35c)", () => {
    expect(childCredit(1, CFG)).toBe(1267);
    expect(childCredit(2, CFG)).toBe(1860);
    expect(childCredit(3, CFG)).toBe(2320);
    expect(childCredit(4, CFG)).toBe(2320); // 4th+ uses the 3rd-child amount
  });

  it("returns 0 for non-positive orders", () => {
    expect(childCredit(0, CFG)).toBe(0);
    expect(childCredit(-1, CFG)).toBe(0);
  });

  it("sums credits across children", () => {
    expect(totalChildCredit(0, CFG)).toBe(0);
    expect(totalChildCredit(1, CFG)).toBe(1267);
    expect(totalChildCredit(2, CFG)).toBe(3127);
    expect(totalChildCredit(3, CFG)).toBe(5447);
    expect(totalChildCredit(4, CFG)).toBe(7767);
  });
});

// ---------------------------------------------------------------------------
// Income tax: brackets, rounding, advance ceiling
// ---------------------------------------------------------------------------
describe("income tax", () => {
  it("applies 15 % below the monthly threshold", () => {
    expect(calculatePayroll(mk({ monthlySalary: 40000, applyBasicCredit: false })).incomeTaxBeforeCredits).toBe(6000);
  });

  it("stays at 15 % exactly at the threshold (146 901 → rounds to 147 000? no: 146 900 stays 15 %)", () => {
    // 146 900 rounds to 146 900 (already a hundred), all within the 15 % band.
    const r = calculatePayroll(mk({ monthlySalary: 146900, applyBasicCredit: false }));
    expect(r.taxBaseRounded).toBe(146900);
    expect(r.incomeTaxBeforeCredits).toBe(22035); // 0.15 × 146 900
  });

  it("applies 23 % above the threshold", () => {
    // 0.15×146901 + 0.23×(200000−146901) = 22035.15 + 12212.77 = 34247.92 → ceil 34248
    expect(calculatePayroll(mk({ monthlySalary: 200000, applyBasicCredit: false })).incomeTaxBeforeCredits).toBe(34248);
  });

  it("rounds the tax base up to whole hundreds", () => {
    const r = calculatePayroll(mk({ monthlySalary: 40001, applyBasicCredit: false }));
    expect(r.taxBaseRounded).toBe(40100);
    expect(r.incomeTaxBeforeCredits).toBe(6015); // 0.15 × 40 100
  });

  it("rounds the advance up to the whole crown", () => {
    // base 147000 → 0.15×146901 + 0.23×99 = 22035.15 + 22.77 = 22057.92 → ceil 22058
    const r = calculatePayroll(mk({ monthlySalary: 147000, applyBasicCredit: false }));
    expect(r.incomeTaxBeforeCredits).toBe(22058);
  });
});

// ---------------------------------------------------------------------------
// Tax credits & tax bonus
// ---------------------------------------------------------------------------
describe("tax credits & bonus", () => {
  it("subtracts the basic taxpayer credit", () => {
    expect(calculatePayroll(mk({ monthlySalary: 40000 })).incomeTax).toBe(6000 - 2570);
  });

  it("adds other personal credits, never going below zero", () => {
    const r = calculatePayroll(mk({ monthlySalary: 40000, otherMonthlyCredits: 1345 }));
    expect(r.personalCreditsApplied).toBe(2570 + 1345);
    expect(r.incomeTax).toBe(6000 - 2570 - 1345);
  });

  it("omits the basic credit when not applied", () => {
    const r = calculatePayroll(mk({ monthlySalary: 40000, applyBasicCredit: false }));
    expect(r.personalCreditsApplied).toBe(0);
    expect(r.incomeTax).toBe(6000);
  });

  it("reduces tax with child credit but not below zero", () => {
    // afterBasic = 6000−2570 = 3430; minus 2 children 3127 → 303
    const r = calculatePayroll(mk({ monthlySalary: 40000, children: 2 }));
    expect(r.childCreditApplied).toBe(3127);
    expect(r.incomeTax).toBe(303);
    expect(r.taxBonus).toBe(0);
  });

  it("pays a tax bonus when child credit exceeds the tax", () => {
    // afterBasic = 3430; 3 children = 5447 → afterChild −2017 → bonus 2017
    const r = calculatePayroll(mk({ monthlySalary: 40000, children: 3 }));
    expect(r.incomeTax).toBe(0);
    expect(r.taxBonus).toBe(2017);
  });

  it("withholds no bonus below ½ the minimum wage (11 200)", () => {
    const r = calculatePayroll(mk({ monthlySalary: 10000, children: 2 }));
    expect(r.incomeTax).toBe(0);
    expect(r.taxBonus).toBe(0); // income < 11 200 → bonus not paid monthly
  });

  it("pays the bonus exactly at the ½-minimum-wage threshold", () => {
    const r = calculatePayroll(mk({ monthlySalary: 11200, children: 2 }));
    // tax 0.15×11200=1680 → afterBasic 0 → child 3127 → bonus 3127
    expect(r.taxBonus).toBe(3127);
  });
});

// ---------------------------------------------------------------------------
// Social security
// ---------------------------------------------------------------------------
describe("social security", () => {
  it("charges 7.1 % employee / 24.8 % employer, rounded up", () => {
    const r = calculatePayroll(mk({ monthlySalary: 40000 }));
    expect(r.socialEmployee).toBe(Math.ceil(40000 * 0.071)); // 2840
    expect(r.socialEmployer).toBe(Math.ceil(40000 * 0.248)); // 9920
  });

  it("caps the assessment base at the annual maximum (partial month)", () => {
    const r = calculatePayroll(mk({ monthlySalary: 200000, priorYtdSocialBase: 2_350_000 }));
    // remaining = 2 350 416 − 2 350 000 = 416
    expect(r.socialEmployee).toBe(Math.ceil(416 * 0.071));
    expect(r.socialEmployer).toBe(Math.ceil(416 * 0.248));
  });

  it("charges nothing once the cap is exhausted", () => {
    const r = calculatePayroll(mk({ monthlySalary: 200000, priorYtdSocialBase: 2_350_416 }));
    expect(r.socialEmployee).toBe(0);
    expect(r.socialEmployer).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Health insurance
// ---------------------------------------------------------------------------
describe("health insurance", () => {
  it("charges 4.5 % employee / 9 % employer, rounded up", () => {
    const r = calculatePayroll(mk({ monthlySalary: 40000 }));
    expect(r.healthEmployee).toBe(Math.ceil(40000 * 0.045)); // 1800
    expect(r.healthEmployer).toBe(Math.ceil(40000 * 0.09)); // 3600
  });

  it("tops the employee up to the minimum assessment base (22 400)", () => {
    const r = calculatePayroll(mk({ monthlySalary: 10000, applyBasicCredit: false }));
    const employer = Math.ceil(10000 * 0.09); // 900
    const topUp = Math.ceil((22400 - 10000) * 0.135); // 1674
    expect(r.healthEmployer).toBe(employer);
    expect(r.healthEmployee).toBe(Math.ceil(10000 * 0.045) + topUp); // 450 + 1674 = 2124
    expect(r.healthEmployee + r.healthEmployer).toBe(Math.ceil(22400 * 0.135)); // 3024
  });

  it("has no upper cap (unlike social security)", () => {
    const r = calculatePayroll(mk({ monthlySalary: 3_000_000, applyBasicCredit: false }));
    expect(r.healthEmployee).toBe(Math.ceil(3_000_000 * 0.045)); // 135 000, uncapped
  });
});

// ---------------------------------------------------------------------------
// Pension fund
// ---------------------------------------------------------------------------
describe("pension fund", () => {
  it("uses the monthly salary as the base by default", () => {
    const r = calculatePayroll(mk({ monthlySalary: 50000, employeePensionPct: 4 }));
    expect(r.employeePension).toBe(2000); // 4 %
    expect(r.employerPension).toBe(5000); // 2.5 × 4 % = 10 %
  });

  it("honours an explicit contribution base distinct from the salary", () => {
    const r = calculatePayroll(mk({ monthlySalary: 80000, pensionBaseSalary: 60000, employeePensionPct: 4 }));
    expect(r.employeePension).toBe(2400); // 4 % of 60 000, not 80 000
    expect(r.employerPension).toBe(6000); // 10 % of 60 000
  });

  it("matches employer at 2.5× the employee rate, capped at 10 %", () => {
    const at = (pct: number) => calculatePayroll(mk({ monthlySalary: 100000, employeePensionPct: pct })).employerPension;
    expect(at(0)).toBe(0);
    expect(at(2)).toBe(5000); // 5 %
    expect(at(4)).toBe(10000); // 10 %
    expect(at(6)).toBe(10000); // still capped at 10 %
  });

  it("respects an explicit employer percentage override", () => {
    const r = calculatePayroll(mk({ monthlySalary: 100000, employeePensionPct: 4, employerPensionPct: 3 }));
    expect(r.employerPension).toBe(3000);
  });
});

// ---------------------------------------------------------------------------
// Old-age-savings exemption (50 000 CZK/yr, accrued cumulatively)
// ---------------------------------------------------------------------------
describe("benefit exemption accrual", () => {
  const big = { monthlySalary: 200000, pensionBaseSalary: 200000, employeePensionPct: 4 }; // employer 20 000/mo

  it("is fully exempt while cumulative contributions stay under 50 000", () => {
    expect(calculatePayroll(mk({ ...big, month: 1 })).taxablePensionExcess).toBe(0); // cum 20 000
    expect(calculatePayroll(mk({ ...big, month: 2 })).taxablePensionExcess).toBe(0); // cum 40 000
  });

  it("taxes only the part above 50 000 in the crossover month", () => {
    // month 3: prior cum 40 000, this month 20 000 → over by 10 000
    expect(calculatePayroll(mk({ ...big, month: 3 })).taxablePensionExcess).toBe(10000);
  });

  it("taxes the whole contribution once the exemption is used up", () => {
    expect(calculatePayroll(mk({ ...big, month: 4 })).taxablePensionExcess).toBe(20000);
  });

  it("accepts an explicit prior-YTD override", () => {
    const r = calculatePayroll(mk({ ...big, month: 6, priorYtdOldAgeSavings: 48000 }));
    // cum 48 000 + 20 000 = 68 000 → over by 18 000, prior over 0 → 18 000
    expect(r.taxablePensionExcess).toBe(18000);
  });
});

// ---------------------------------------------------------------------------
// Vacation
// ---------------------------------------------------------------------------
describe("vacation", () => {
  it("leaves gross = salary when no vacation is taken", () => {
    const r = calculatePayroll(mk({ monthlySalary: 50000, vacationDays: 0 }));
    expect(r.basicWage).toBe(50000);
    expect(r.vacationPay).toBe(0);
    expect(r.grossSalary).toBe(50000);
  });

  it("is net-neutral when paid at the base hourly rate", () => {
    const r = calculatePayroll(mk({ monthlySalary: 50000, vacationDays: 5 }));
    expect(r.grossSalary).toBe(50000); // basic drop = vacation pay
    expect(r.vacationPay).toBeGreaterThan(0);
  });

  it("raises gross when the average rate exceeds the base rate", () => {
    const r = calculatePayroll(mk({ monthlySalary: 50000, vacationDays: 5, averageHourlyRate: 350 }));
    // base hourly = round(50000/168) = 297.62; vacationPay = 40×350 = 14000
    expect(r.vacationPay).toBe(14000);
    expect(r.basicWage).toBe(Math.round(50000 - 40 * 297.62)); // 38095
    expect(r.grossSalary).toBe(52095);
  });

  it("supports half-days", () => {
    const r = calculatePayroll(mk({ monthlySalary: 50000, vacationDays: 0.5 }));
    // 0.5 × 8 = 4 h at base rate 297.62 → 1190
    expect(r.vacationPay).toBe(Math.round(4 * 297.62)); // 1190
    expect(r.grossSalary).toBe(50000);
  });

  it("uses the month's working hours for the base hourly rate", () => {
    const a = calculatePayroll(mk({ monthlySalary: 50000, vacationDays: 1, averageHourlyRate: 300, monthlyWorkHours: 160 }));
    const b = calculatePayroll(mk({ monthlySalary: 50000, vacationDays: 1, averageHourlyRate: 300, monthlyWorkHours: 176 }));
    expect(a.grossSalary).toBe(49900); // higher base hourly → bigger deduction → lower gross
    expect(b.grossSalary).toBe(50127);
  });
});

// ---------------------------------------------------------------------------
// Pay assembly: net, payout, employer cost
// ---------------------------------------------------------------------------
describe("pay assembly", () => {
  it("net = gross − tax − employee insurance (+ bonus)", () => {
    const r = calculatePayroll(mk({ monthlySalary: 40000 }));
    expect(r.netSalary).toBe(r.grossSalary - r.incomeTax + r.taxBonus - r.healthEmployee - r.socialEmployee);
  });

  it("to-pay adds the car allowance and subtracts post-tax deductions", () => {
    const r = calculatePayroll(
      mk({ monthlySalary: 40000, carAllowance: 5000, employeePensionPct: 4, multisport: 270, otherDeductions: 100 }),
    );
    expect(r.postTaxDeductions).toBe(r.employeePension + 270 + 100);
    expect(r.toPay).toBe(r.netSalary + 5000 - r.postTaxDeductions);
  });

  it("employer cost = gross + car + employer insurance + employer pension + taxable insurance", () => {
    const r = calculatePayroll(
      mk({ monthlySalary: 100000, carAllowance: 5000, employeePensionPct: 4, taxableInsuranceMonthly: 2000 }),
    );
    const expected =
      r.grossSalary + 5000 + r.healthEmployer + r.socialEmployer + r.employerPension + 2000;
    expect(r.employerCost).toBe(expected);
    expect(r.socialEmployer).toBe(Math.ceil(r.base * 0.248)); // employer social rounds up
  });
});

// ---------------------------------------------------------------------------
// Defaults for omitted optional fields
// ---------------------------------------------------------------------------
describe("optional-field defaults", () => {
  it("defaults vacation, benefits and prior-YTD sensibly", () => {
    const r = calculatePayroll({
      monthlySalary: 40000,
      carAllowance: 0,
      employeePensionPct: 0,
      taxableInsuranceMonthly: 0,
      otherTaxableBenefits: 0,
      month: 1,
      applyBasicCredit: true,
      children: 0,
      multisport: 0,
      otherDeductions: 0,
    });
    expect(r.vacationPay).toBe(0);
    expect(r.grossSalary).toBe(40000);
    expect(r.employerPension).toBe(0);
    expect(r.taxablePensionExcess).toBe(0);
    expect(r.base).toBe(40000);
  });
});

// ---------------------------------------------------------------------------
// Robustness / edge cases (from panel review)
// ---------------------------------------------------------------------------
describe("robustness & edge cases", () => {
  it("bonus floor counts the whole taxable base, not just salary", () => {
    // salary 8 000 + car 5 000 → base 13 000 ≥ 11 200 → bonus paid
    const withCar = calculatePayroll(mk({ monthlySalary: 8000, carAllowance: 5000, children: 2 }));
    expect(withCar.taxBonus).toBeGreaterThan(0);
    // salary 8 000 alone → base 8 000 < 11 200 → no bonus
    const salaryOnly = calculatePayroll(mk({ monthlySalary: 8000, children: 2 }));
    expect(salaryOnly.taxBonus).toBe(0);
  });

  it("skips the minimum health top-up when the employee is exempt", () => {
    const normal = calculatePayroll(mk({ monthlySalary: 10000, applyBasicCredit: false }));
    const exempt = calculatePayroll(
      mk({ monthlySalary: 10000, applyBasicCredit: false, exemptFromMinHealthBase: true }),
    );
    expect(exempt.healthEmployee).toBe(Math.ceil(10000 * 0.045)); // 450, no top-up
    expect(normal.healthEmployee).toBeGreaterThan(exempt.healthEmployee);
  });

  it("clamps vacation to scheduled hours — basic wage never goes negative", () => {
    const r = calculatePayroll(mk({ monthlySalary: 50000, vacationDays: 30, monthlyWorkHours: 168 }));
    expect(r.basicWage).toBeGreaterThanOrEqual(0);
    expect(r.grossSalary).toBe(50000); // full month paid as vacation, gross unchanged
  });

  it("never produces negative tax/insurance from non-positive inputs", () => {
    const r = calculatePayroll(mk({ monthlySalary: -5000, carAllowance: -1000, applyBasicCredit: false }));
    expect(r.base).toBe(0);
    expect(r.incomeTax).toBe(0);
    expect(r.socialEmployee).toBe(0);
    expect(r.taxBonus).toBe(0);
  });

  it("treats a negative pension rate as zero", () => {
    const r = calculatePayroll(mk({ monthlySalary: 50000, employeePensionPct: -5 }));
    expect(r.employeePension).toBe(0);
    expect(r.employerPension).toBe(0);
  });

  it("charges no health top-up exactly at the minimum base", () => {
    const r = calculatePayroll(mk({ monthlySalary: 22400, applyBasicCredit: false }));
    expect(r.healthEmployee).toBe(Math.ceil(22400 * 0.045)); // no top-up at the boundary
  });

  it("taxes no pension excess when the cumulative lands exactly on 50 000", () => {
    const r = calculatePayroll(mk({ monthlySalary: 100000, employeePensionPct: 4, priorYtdOldAgeSavings: 40000 }));
    expect(r.employerPension).toBe(10000);
    expect(r.taxablePensionExcess).toBe(0); // 40 000 + 10 000 = 50 000, not over
  });

  it("rounds the tax base up to hundreds before the bracket split (146 950 → 147 000)", () => {
    const r = calculatePayroll(mk({ monthlySalary: 146950, applyBasicCredit: false }));
    expect(r.taxBaseRounded).toBe(147000);
    expect(r.incomeTaxBeforeCredits).toBe(22058); // 0.15×146901 + 0.23×99
  });

  it("charges no social security once prior YTD exceeds the cap", () => {
    const r = calculatePayroll(mk({ monthlySalary: 200000, priorYtdSocialBase: 3_000_000 }));
    expect(r.socialEmployee).toBe(0);
    expect(r.socialEmployer).toBe(0);
  });
});
