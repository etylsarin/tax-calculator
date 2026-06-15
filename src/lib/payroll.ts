import { TaxConfig, TAX_CONFIG_2026 } from "./taxConfig";

export interface PayrollInput {
  /** Contractual monthly gross salary (the "Rate"). The taxable gross is derived from it. */
  monthlySalary: number;
  /** Taxable cash car allowance — added to the assessment base AND paid out in cash. */
  carAllowance: number;
  /** Taxable cash telephone allowance — added to the assessment base AND paid out. Defaults to 0. */
  telephoneAllowance?: number;

  // --- Vacation ---
  /** Vacation taken this month, in days (supports half-days). Defaults to 0. */
  vacationDays?: number;
  /**
   * Average hourly rate used to pay vacation ("Averag." on the payslip). Usually
   * a bit higher than the base hourly rate. Defaults to the base hourly rate
   * (monthlySalary / monthlyWorkHours), i.e. vacation has no net effect on pay.
   */
  averageHourlyRate?: number;
  /**
   * Total scheduled weekday hours in the month (weekdays × 8, holidays included —
   * they are paid at salary). Drives the base hourly rate. Defaults to 168.
   */
  monthlyWorkHours?: number;

  /**
   * Pension fund — contribution base the percentages apply to.
   * Defaults to `monthlySalary` (the usual case).
   */
  pensionBaseSalary?: number;
  /**
   * Employee's own pension contribution rate, % of the base. Negative values are
   * treated as 0. Contributing above 4 % is allowed but only the first 4 % is
   * matched (the default employer rate caps at 10 %).
   */
  employeePensionPct: number;
  /**
   * Employer's pension contribution rate, % of the base. Defaults to the company
   * policy: 2.5 × the employee's rate, capped at 10 % (reached at employee 4 %).
   * Shares the 50 000 CZK/yr exemption; non-cash.
   */
  employerPensionPct?: number;

  /**
   * Employer's monthly contribution to non-qualifying insurance (managerial / other),
   * which is a fully taxable benefit from the first crown. Non-cash.
   */
  taxableInsuranceMonthly: number;
  /** Any further non-cash taxable benefit added to the base (e.g. 1 % company-car value). */
  otherTaxableBenefits: number;

  /** Month of the year (1–12), used to accrue the savings exemption / social cap. */
  month: number;
  /**
   * Employer pension contributed earlier this year, before `month`.
   * Defaults to `employerPension × (month − 1)` (constant monthly contribution).
   */
  priorYtdOldAgeSavings?: number;
  /** Social-security assessment base already used this year, before `month`. Defaults to 0. */
  priorYtdSocialBase?: number;

  /** Apply the basic taxpayer credit (sleva na poplatníka). */
  applyBasicCredit: boolean;
  /**
   * Other monthly personal tax credits in CZK (e.g. disability 210 / 420,
   * ZTP/P holder 1 345). Like the basic credit, they can zero the tax but
   * never create a refund. Defaults to 0.
   */
  otherMonthlyCredits?: number;
  /** Number of dependent children for the child tax credit. */
  children: number;

  /**
   * Skip the minimum health-insurance assessment base top-up. Set for employees
   * the minimum doesn't apply to: state-insured persons (pensioners, students,
   * ZTP/P, parental leave), or those whose other employment already meets it.
   * Defaults to false (the top-up applies). Note: partial-month proration of the
   * minimum base is not modelled — assume full-month employment.
   */
  exemptFromMinHealthBase?: boolean;

  // --- Post-tax deductions (withheld from the payout, after tax & insurance) ---
  /** Multisport (or similar) card contribution. */
  multisport: number;
  /** Any other post-tax deductions (loans, advances, …). */
  otherDeductions: number;
}

export interface PayrollResult {
  /** Basic wage for the month (salary reduced for vacation hours). */
  basicWage: number;
  /** Vacation pay (vacation hours × average hourly rate). */
  vacationPay: number;
  /** Taxable cash wage = basic wage + vacation pay (matches "Gross salary"). */
  grossSalary: number;

  base: number;
  taxablePensionExcess: number;

  /** Employer pension contribution (10 % of base) — non-cash benefit. */
  employerPension: number;
  /** Employee pension contribution (4 % of base) — post-tax deduction. */
  employeePension: number;
  /** Sum of all post-tax deductions (employee pension + Multisport + other). */
  postTaxDeductions: number;

  taxBaseRounded: number;
  incomeTaxBeforeCredits: number;
  /** Basic taxpayer credit + other personal credits actually applied. */
  personalCreditsApplied: number;
  childCreditApplied: number;
  /** Income tax actually withheld (never negative). */
  incomeTax: number;
  /** Monthly tax bonus paid out when child credits exceed the tax. */
  taxBonus: number;

  healthEmployee: number;
  socialEmployee: number;
  healthEmployer: number;
  socialEmployer: number;

  /** Wage after tax & employee insurance (matches "Net Salary" on the payslip). */
  netSalary: number;
  /** Final cash payout (matches "To pay CZK"). */
  toPay: number;
  /** Total cost to the employer (super-gross). */
  employerCost: number;
}

/** Standard full-time working day. */
const HOURS_PER_DAY = 8;

/** Czech rounding: contributions & advance tax round up to the whole crown. */
const ceilCZK = (n: number) => Math.ceil(roundCents(n));
/** Tame binary-float noise (e.g. 9357.929999999) before ceiling. */
const roundCents = (n: number) => Math.round(n * 100) / 100;

/** Child tax credit for the n-th child (1-indexed). */
export function childCredit(order: number, cfg: TaxConfig): number {
  if (order < 1) return 0;
  const idx = Math.min(order, cfg.childCredits.length) - 1;
  return cfg.childCredits[idx];
}

export function totalChildCredit(children: number, cfg: TaxConfig): number {
  let sum = 0;
  for (let i = 1; i <= children; i++) sum += childCredit(i, cfg);
  return sum;
}

export function calculatePayroll(
  input: PayrollInput,
  cfg: TaxConfig = TAX_CONFIG_2026,
): PayrollResult {
  // --- Vacation: split the monthly salary into worked (basic) wage + vacation pay ---
  const monthlyWorkHours =
    input.monthlyWorkHours && input.monthlyWorkHours > 0 ? input.monthlyWorkHours : 168;
  // Clamp vacation to the scheduled hours so the basic wage can't go negative.
  const vacationHours = Math.min(
    Math.max(0, input.vacationDays ?? 0) * HOURS_PER_DAY,
    monthlyWorkHours,
  );
  // The hourly rate is rounded to hellers (2 decimals) before it is applied.
  const salaryHourly = roundCents(input.monthlySalary / monthlyWorkHours);
  const averageHourly =
    input.averageHourlyRate && input.averageHourlyRate > 0
      ? input.averageHourlyRate
      : salaryHourly;
  const vacationPay = Math.round(vacationHours * averageHourly);
  const basicWage = Math.round(input.monthlySalary - vacationHours * salaryHourly);
  const grossSalary = basicWage + vacationPay;

  // --- Pension fund contributions (percentage of the salary base) ---
  const pensionBase = input.pensionBaseSalary ?? input.monthlySalary;
  // Company policy: employer matches 2.5× the employee's rate, capped at 10 %.
  const employeePct = Math.max(0, input.employeePensionPct);
  const employerPct = Math.max(0, input.employerPensionPct ?? Math.min(employeePct * 2.5, 10));
  const employerPension = Math.round(pensionBase * (employerPct / 100));
  const employeePension = Math.round(pensionBase * (employeePct / 100));

  // --- Taxable excess of employer pension contributions (cumulative over the year) ---
  const priorSavings = input.priorYtdOldAgeSavings ?? employerPension * (input.month - 1);
  const exemption = cfg.oldAgeSavingsAnnualExemption;
  const priorExcess = Math.max(0, priorSavings - exemption);
  const currentExcess = Math.max(0, priorSavings + employerPension - exemption);
  const taxablePensionExcess = currentExcess - priorExcess;

  // Taxable cash allowances (added to the base AND paid out).
  const cashAllowances = input.carAllowance + (input.telephoneAllowance ?? 0);

  // --- Combined tax & insurance assessment base (never negative) ---
  const base = Math.max(
    0,
    grossSalary +
      cashAllowances +
      input.taxableInsuranceMonthly +
      taxablePensionExcess +
      input.otherTaxableBenefits,
  );

  // --- Income tax: base rounded up to whole hundreds, 15 % / 23 %, advance rounded up ---
  const taxBaseRounded = Math.ceil(base / 100) * 100;
  const lowPart = Math.min(taxBaseRounded, cfg.monthlyHighRateThreshold);
  const highPart = Math.max(0, taxBaseRounded - cfg.monthlyHighRateThreshold);
  const rawTax = cfg.taxRateBase * lowPart + cfg.taxRateHigh * highPart;
  const incomeTaxBeforeCredits = ceilCZK(rawTax);

  const basicCreditApplied = input.applyBasicCredit ? cfg.basicTaxpayerCredit : 0;
  const personalCredits = basicCreditApplied + (input.otherMonthlyCredits ?? 0);
  // Personal credits can zero the tax but never create a refund.
  const afterBasic = Math.max(0, incomeTaxBeforeCredits - personalCredits);

  const childCreditApplied = totalChildCredit(input.children, cfg);
  const afterChild = afterBasic - childCreditApplied;
  const incomeTax = Math.max(0, afterChild);
  // The monthly bonus is only paid if taxable employment income (the whole § 6
  // base, incl. taxable allowances/benefits) reaches ½ the minimum wage.
  const eligibleForBonus = base >= cfg.monthlyTaxBonusMinIncome;
  const taxBonus = eligibleForBonus ? Math.max(0, -afterChild) : 0;

  // --- Social security (assessment base capped at the annual max) ---
  const priorSocial = input.priorYtdSocialBase ?? 0;
  const socialBase = Math.max(0, Math.min(base, cfg.socialAnnualMaxBase - priorSocial));
  const socialEmployee = ceilCZK(socialBase * cfg.socialEmployeeRate);
  const socialEmployer = ceilCZK(socialBase * cfg.socialEmployerRate);

  // --- Health insurance (no max base) ---
  const healthEmployer = ceilCZK(base * cfg.healthEmployerRate);
  // Below the minimum assessment base the employee pays 13.5 % of the shortfall on
  // top — unless they're exempt from the minimum (state-insured, other employment …).
  const minTopUp =
    !input.exemptFromMinHealthBase && base < cfg.minHealthAssessmentBase
      ? ceilCZK((cfg.minHealthAssessmentBase - base) * cfg.healthTotalRate)
      : 0;
  const healthEmployee = ceilCZK(base * cfg.healthEmployeeRate) + minTopUp;

  // --- Pay ---
  const postTaxDeductions = employeePension + input.multisport + input.otherDeductions;
  const netSalary =
    grossSalary - incomeTax + taxBonus - healthEmployee - socialEmployee;
  const toPay = netSalary + cashAllowances - postTaxDeductions;

  const employerCost =
    grossSalary +
    cashAllowances +
    healthEmployer +
    socialEmployer +
    employerPension +
    input.taxableInsuranceMonthly;

  return {
    basicWage,
    vacationPay,
    grossSalary,
    base,
    taxablePensionExcess,
    employerPension,
    employeePension,
    postTaxDeductions,
    taxBaseRounded,
    incomeTaxBeforeCredits,
    personalCreditsApplied: personalCredits,
    childCreditApplied,
    incomeTax,
    taxBonus,
    healthEmployee,
    socialEmployee,
    healthEmployer,
    socialEmployer,
    netSalary,
    toPay,
    employerCost,
  };
}
