import { useEffect, useMemo, useState } from "react";
import { calculatePayroll, PayrollInput } from "./lib/payroll";
import { TAX_CONFIG_2026 } from "./lib/taxConfig";
import { formatCZK } from "./lib/format";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Count of weekdays (Mon–Fri, holidays included) in a month, × 8 hours. */
function weekdayHours(year: number, month: number): number {
  const days = new Date(year, month, 0).getDate();
  let weekdays = 0;
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0 && dow !== 6) weekdays++;
  }
  return weekdays * 8;
}

const DEFAULT_INPUT: PayrollInput = {
  monthlySalary: 0,
  carAllowance: 16977,
  vacationDays: 0,
  averageHourlyRate: 0,
  monthlyWorkHours: weekdayHours(2026, new Date().getMonth() + 1),
  employeePensionPct: 4,
  taxableInsuranceMonthly: 0,
  otherTaxableBenefits: 0,
  month: new Date().getMonth() + 1,
  applyBasicCredit: true,
  otherMonthlyCredits: 0,
  children: 0,
  exemptFromMinHealthBase: false,
  multisport: 270,
  otherDeductions: 0,
};

export function App() {
  const [input, setInput] = useState<PayrollInput>(DEFAULT_INPUT);
  const cfg = TAX_CONFIG_2026;
  const r = useMemo(() => calculatePayroll(input, cfg), [input, cfg]);

  // When the month changes, refresh the default working hours for that month.
  const setMonth = (month: number) =>
    setInput((prev) => ({ ...prev, month, monthlyWorkHours: weekdayHours(cfg.year, month) }));

  const set =
    <K extends keyof PayrollInput>(key: K) =>
    (value: PayrollInput[K]) =>
      setInput((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="app">
      <header>
        <h1>Czech Salary Calculator</h1>
        <p className="subtitle">
          Employee net pay · tax year {cfg.year} · based on Czech tax law
        </p>
      </header>

      <div className="layout">
        <form className="panel inputs" onSubmit={(e) => e.preventDefault()}>
          <fieldset>
            <legend>Period</legend>
            <Field label="Month" hint="Sets working hours & accrues the yearly benefit exemption / social cap">
              <select value={input.month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </Field>
          </fieldset>

          <fieldset>
            <legend>Earnings (cash, taxable)</legend>
            <NumberField
              label="Monthly salary (Rate)"
              hint="The 'Rate' on your payslip — full-month salary, not the monthly 'Gross' (they differ when you take vacation/overtime)"
              value={input.monthlySalary}
              onChange={set("monthlySalary")}
            />
            <NumberField
              label="Car allowance"
              hint="Taxable cash allowance, also paid out"
              value={input.carAllowance}
              onChange={set("carAllowance")}
            />
          </fieldset>

          <fieldset>
            <legend>Vacation</legend>
            <NumberField
              label="Vacation days"
              hint={`${formatCZK(r.vacationPay)} vacation pay (${input.vacationDays ?? 0} × 8 h)`}
              value={input.vacationDays ?? 0}
              onChange={set("vacationDays")}
              step={0.5}
            />
            <NumberField
              label="Average hourly rate"
              hint="Vacation pay rate ('Averag.'). Leave 0 to use the base rate"
              value={input.averageHourlyRate ?? 0}
              onChange={set("averageHourlyRate")}
              step={1}
            />
            <NumberField
              label="Working hours this month"
              hint="Weekdays × 8 (auto from month; edit for part-time)"
              value={input.monthlyWorkHours ?? 0}
              onChange={set("monthlyWorkHours")}
              step={8}
            />
          </fieldset>

          <fieldset>
            <legend>Pension fund (% of monthly salary)</legend>
            <NumberField
              label="Employee contribution %"
              hint={`Up to 4 % → ${formatCZK(r.employeePension)} (post-tax deduction)`}
              value={input.employeePensionPct}
              onChange={set("employeePensionPct")}
              step={0.5}
            />
            <NumberField
              label="Employer contribution %"
              hint={`2.5 × your rate, max 10 % → ${formatCZK(r.employerPension)} (benefit)`}
              value={Math.min(input.employeePensionPct * 2.5, 10)}
              onChange={() => {}}
              readOnly
            />
          </fieldset>

          <fieldset>
            <legend>Other employer benefits (non-cash)</legend>
            <NumberField
              label="Taxable insurance"
              hint="Managerial / non-qualifying insurance — taxed from the 1st crown"
              value={input.taxableInsuranceMonthly}
              onChange={set("taxableInsuranceMonthly")}
            />
            <NumberField
              label="Other taxable benefits"
              hint="e.g. 1 % company-car value"
              value={input.otherTaxableBenefits}
              onChange={set("otherTaxableBenefits")}
            />
          </fieldset>

          <fieldset>
            <legend>Tax credits</legend>
            <Field label="Basic taxpayer credit">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={input.applyBasicCredit}
                  onChange={(e) => set("applyBasicCredit")(e.target.checked)}
                />
                <span>{formatCZK(cfg.basicTaxpayerCredit)} / month</span>
              </label>
            </Field>
            <NumberField
              label="Children"
              hint="1st: 1 267 · 2nd: 1 860 · 3rd+: 2 320 / month"
              value={input.children}
              onChange={set("children")}
              integer
            />
            <NumberField
              label="Other monthly credits"
              hint="e.g. disability 210 / 420, ZTP/P 1 345 per month"
              value={input.otherMonthlyCredits ?? 0}
              onChange={set("otherMonthlyCredits")}
            />
          </fieldset>

          <fieldset>
            <legend>Health insurance</legend>
            <Field
              label="Exempt from minimum base"
              hint="State-insured (pensioner, student, ZTP/P, parental leave) or minimum met by other employment"
            >
              <label className="switch">
                <input
                  type="checkbox"
                  checked={input.exemptFromMinHealthBase ?? false}
                  onChange={(e) => set("exemptFromMinHealthBase")(e.target.checked)}
                />
                <span>skip the 13.5 % top-up to the minimum base</span>
              </label>
            </Field>
          </fieldset>

          <fieldset>
            <legend>Post-tax deductions</legend>
            <NumberField
              label="Employee pension (auto)"
              hint="From the pension contribution % above"
              value={r.employeePension}
              onChange={() => {}}
              readOnly
            />
            <NumberField
              label="Multisport"
              value={input.multisport}
              onChange={set("multisport")}
            />
            <NumberField
              label="Other deductions"
              hint="Loans, advances, …"
              value={input.otherDeductions}
              onChange={set("otherDeductions")}
            />
          </fieldset>
        </form>

        <div className="panel results">
          <div className="headline">
            <span className="headline-label">To pay</span>
            <span className="headline-value">{formatCZK(r.toPay)}</span>
          </div>

          <Section title="Gross salary">
            <Row label="Basic wage" value={r.basicWage} />
            {r.vacationPay > 0 && <Row label="Vacation pay" value={r.vacationPay} />}
            <Row label="Gross salary" value={r.grossSalary} strong />
          </Section>

          <Section title="Assessment base">
            <Row label="Gross salary" value={r.grossSalary} />
            <Row label="Car allowance" value={input.carAllowance} />
            <Row label="Taxable insurance" value={input.taxableInsuranceMonthly} />
            <Row label="Taxable pension excess" value={r.taxablePensionExcess} />
            {input.otherTaxableBenefits > 0 && (
              <Row label="Other benefits" value={input.otherTaxableBenefits} />
            )}
            <Row label="Tax / insurance base" value={r.base} strong />
          </Section>

          <Section title="Income tax">
            <Row label="Tax before credits (15 % / 23 %)" value={r.incomeTaxBeforeCredits} />
            {r.personalCreditsApplied > 0 && (
              <Row label="Personal credits" value={-r.personalCreditsApplied} />
            )}
            {r.childCreditApplied > 0 && (
              <Row label="Child tax credit" value={-r.childCreditApplied} />
            )}
            <Row label="Income tax withheld" value={r.incomeTax} strong />
            {r.taxBonus > 0 && <Row label="Tax bonus (paid out)" value={r.taxBonus} positive />}
          </Section>

          <Section title="Employee contributions">
            <Row label="Social security (7.1 %)" value={r.socialEmployee} />
            <Row label="Health insurance (4.5 %)" value={r.healthEmployee} />
          </Section>

          <Section title="Net & payout">
            <Row label="Net salary" value={r.netSalary} />
            <Row label="+ Car allowance" value={input.carAllowance} />
            <Row label="− Employee pension" value={-r.employeePension} />
            {input.multisport > 0 && <Row label="− Multisport" value={-input.multisport} />}
            {input.otherDeductions > 0 && (
              <Row label="− Other deductions" value={-input.otherDeductions} />
            )}
            <Row label="To pay" value={r.toPay} strong />
          </Section>

          <Section title="Employer side (info)">
            <Row label="Social security (24.8 %)" value={r.socialEmployer} />
            <Row label="Health insurance (9 %)" value={r.healthEmployer} />
            <Row label="Total employer cost" value={r.employerCost} strong />
          </Section>
        </div>
      </div>

      <footer>
        Tax year {cfg.year}: 23 % rate above {formatCZK(cfg.monthlyHighRateThreshold)}/mo ·
        social cap {formatCZK(cfg.socialAnnualMaxBase)}/yr · benefit exemption{" "}
        {formatCZK(cfg.oldAgeSavingsAnnualExemption)}/yr. Indicative only — verify against
        your payslip.
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="result-section">
      <h2>{title}</h2>
      <div className="rows">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  strong,
  positive,
}: {
  label: string;
  value: number;
  strong?: boolean;
  positive?: boolean;
}) {
  const cls = ["row", strong && "row-strong", positive && "row-positive", value < 0 && "row-neg"]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls}>
      <span>{label}</span>
      <span>{formatCZK(value)}</span>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function NumberField({
  label,
  hint,
  value,
  onChange,
  integer,
  step,
  readOnly,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  integer?: boolean;
  step?: number;
  readOnly?: boolean;
}) {
  // Keep the raw text locally so a field showing 0 can be cleared and retyped
  // (a value-bound number input would otherwise force a sticky leading "0").
  const [text, setText] = useState(value === 0 ? "" : String(value));

  // Re-sync when the value changes from outside (computed fields, resets).
  useEffect(() => {
    const parsed = text.trim() === "" ? 0 : Number(text);
    if (parsed !== value) setText(value === 0 ? "" : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (readOnly) {
    return (
      <Field label={label} hint={hint}>
        <input type="number" value={value} readOnly tabIndex={-1} />
      </Field>
    );
  }

  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={step ?? (integer ? 1 : 100)}
        placeholder="0"
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          if (raw.trim() === "") {
            onChange(0);
            return;
          }
          const n = Number(raw);
          if (!Number.isNaN(n)) onChange(integer ? Math.max(0, Math.floor(n)) : Math.max(0, n));
        }}
      />
    </Field>
  );
}
