# Czech Salary Calculator (2026)

A small React + TypeScript front-end that computes an employee's monthly net pay
in the Czech Republic. Built for forecasting upcoming months and modelling other
employees with different gross salaries and benefit packages.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # run the unit tests
npm run build    # output in dist/
```

## Deploy (GitHub Pages)

A workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and
publishes the app on every push to `main` (it runs the tests first, so a failing suite
blocks the deploy).

One-time setup:

1. Push the repo to GitHub (repo name **`tax-calculator`** — it's the base path in
   [`vite.config.ts`](vite.config.ts); change `BASE` there if you rename it or use a custom domain).
2. In **Settings → Pages**, set **Source: GitHub Actions**.

The site then publishes to `https://<user>.github.io/tax-calculator/`.

## How the calculation works

All rates and thresholds live in [`src/lib/taxConfig.ts`](src/lib/taxConfig.ts) and
are taken from Czech law / government decrees for the tax year. The pure calculation
is in [`src/lib/payroll.ts`](src/lib/payroll.ts).

### 2026 parameters

| Item | Value | Legal basis |
|------|-------|-------------|
| Average wage | 48 967 CZK/mo | nař. vlády 282/2025 Sb. |
| Income tax | 15 % up to 146 901 CZK/mo (3× avg wage), 23 % above | § 16 ZDP |
| Basic taxpayer credit | 2 570 CZK/mo (30 840/yr) | § 35ba ZDP |
| Child credit | 1 267 / 1 860 / 2 320 CZK/mo (1st / 2nd / 3rd+) | § 35c ZDP |
| Social security | employee 7.1 %, employer 24.8 % | zák. 589/1992 Sb. |
| Social max base | 2 350 416 CZK/yr (48× avg wage) | — |
| Health insurance | employee 4.5 %, employer 9 %, no cap | zák. 592/1992 Sb. |
| Min. health base | 22 400 CZK/mo (= minimum wage) | — |
| Benefit exemption | 50 000 CZK/yr (old-age-savings products) | § 6 odst. 9 ZDP |

### Steps

0. **Gross salary** = basic wage + vacation pay. Vacation pay = `vacation days × 8 ×
   average hourly rate`; the basic wage is the monthly salary reduced by the vacation
   hours at the base hourly rate (`monthly salary / weekday-hours`, rounded to hellers).
   With no vacation, gross = monthly salary.
1. **Assessment base** = gross salary + car allowance + fully-taxable employer
   insurance + taxable old-age-savings excess + other taxable benefits.
2. **Pension fund** — contributions are a percentage of the **gross salary**:
   the employee chooses their rate (a post-tax deduction) and the employer adds
   **2.5× that, capped at 10 %** (reached at employee 4 %; a non-cash benefit,
   auto-derived). The employer contribution
   shares a single **50 000 CZK/yr** exemption (with qualifying life insurance / DIP);
   the cumulative amount above it (accrued month by month) is taxable income.
   Non-qualifying "managerial / other" insurance has no exemption and is taxed in full.
3. **Income tax** — base rounded up to whole hundreds; 15 % / 23 % brackets;
   advance rounded up to whole CZK; minus the basic/personal and child credits.
   If the child credit exceeds the tax, the difference is paid out as a **tax bonus**
   — but only when monthly income reaches ½ the minimum wage (11 200 CZK).
4. **Insurance** — social 7.1 % (base capped at the annual maximum) and health 4.5 %
   (employee pays a 13.5 % top-up on any shortfall to the minimum base), each
   rounded up to the whole crown.
5. **Net salary** = wage − income tax − employee social − employee health.
   **To pay** = net + car allowance − post-tax deductions (employee pension,
   Multisport, other).

## Verification

[`src/lib/payroll.test.ts`](src/lib/payroll.test.ts) covers the full engine with
synthetic inputs — the child-credit helpers, income-tax brackets/rounding and
advance ceiling, personal credits, the tax bonus and its ½-minimum-wage floor, the
social-security cap, the minimum health base and the uncapped high end, the pension
match/cap and exemption accrual, vacation (incl. half-days and working hours), pay
assembly, and optional-field defaults. [`format.test.ts`](src/lib/format.test.ts)
covers the display helpers. Run `npm test`.

> Indicative tool. Always reconcile against the official payslip.
