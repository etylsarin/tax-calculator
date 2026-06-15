import { describe, it, expect } from "vitest";
import { encodeShareLink, decodeShareLink } from "./shareLink";
import { PayrollInput } from "./payroll";
import { TAX_CONFIG_2026 } from "./taxConfig";
import { weekdayHours } from "./calendar";

const DEFAULTS: PayrollInput = {
  monthlySalary: 0,
  carAllowance: 17000,
  telephoneAllowance: 800,
  vacationDays: 0,
  averageHourlyRate: 0,
  monthlyWorkHours: weekdayHours(TAX_CONFIG_2026.year, 6),
  employeePensionPct: 4,
  taxableInsuranceMonthly: 0,
  otherTaxableBenefits: 0,
  month: 6,
  applyBasicCredit: true,
  otherMonthlyCredits: 0,
  children: 0,
  exemptFromMinHealthBase: false,
  multisport: 270,
  otherDeductions: 0,
};

/** Apply a decoded link the way the app does: merge over defaults, re-derive hours. */
function apply(param: string): PayrollInput {
  const shared = decodeShareLink(param);
  const next = { ...DEFAULTS, ...shared };
  if (shared.month !== undefined && shared.monthlyWorkHours === undefined) {
    next.monthlyWorkHours = weekdayHours(TAX_CONFIG_2026.year, shared.month);
  }
  return next;
}

describe("share link codec", () => {
  it("round-trips a fully customised input", () => {
    const input: PayrollInput = {
      ...DEFAULTS,
      monthlySalary: 85000,
      carAllowance: 12000,
      telephoneAllowance: 500,
      vacationDays: 2.5,
      averageHourlyRate: 512.34,
      monthlyWorkHours: 160,
      employeePensionPct: 3.5,
      taxableInsuranceMonthly: 1500,
      otherTaxableBenefits: 300,
      month: 11,
      applyBasicCredit: false,
      otherMonthlyCredits: 210,
      children: 2,
      exemptFromMinHealthBase: true,
      multisport: 0,
      otherDeductions: 1234,
    };
    expect(apply(encodeShareLink(input))).toEqual(input);
  });

  it("keeps a salary-only link short", () => {
    const input = { ...DEFAULTS, monthlySalary: 80000 };
    const param = encodeShareLink(input);
    // version + salary + month, nothing else
    expect(param).toBe(`1-${(80000).toString(36)}-6`);
    expect(apply(param)).toEqual(input);
  });

  it("preserves decimals via fixed-point encoding", () => {
    const input = { ...DEFAULTS, vacationDays: 0.5, averageHourlyRate: 199.99 };
    const back = apply(encodeShareLink(input));
    expect(back.vacationDays).toBe(0.5);
    expect(back.averageHourlyRate).toBe(199.99);
  });

  it("re-derives working hours from the month when not overridden", () => {
    const input = { ...DEFAULTS, monthlySalary: 50000, month: 2 };
    input.monthlyWorkHours = weekdayHours(TAX_CONFIG_2026.year, 2);
    const param = encodeShareLink(input);
    // hours token is omitted because it matches February's default
    expect(apply(param).monthlyWorkHours).toBe(weekdayHours(TAX_CONFIG_2026.year, 2));
  });

  it("carries an explicit working-hours override", () => {
    const input = { ...DEFAULTS, month: 2, monthlyWorkHours: 80 };
    expect(apply(encodeShareLink(input)).monthlyWorkHours).toBe(80);
  });

  it("ignores empty, malformed, and wrong-version payloads", () => {
    expect(decodeShareLink("")).toEqual({});
    expect(decodeShareLink(null)).toEqual({});
    expect(decodeShareLink("9-zzz")).toEqual({}); // unknown version
  });
});
