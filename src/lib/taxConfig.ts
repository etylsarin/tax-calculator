/**
 * Czech payroll constants, grounded in the law / government decrees for the year.
 *
 * 2026 sources:
 *  - Average wage 48 967 CZK and 23 % monthly threshold 146 901 CZK (3× avg wage),
 *    annual 1 762 812 CZK (36× avg wage)  — nařízení vlády č. 282/2025 Sb.
 *  - Social security: employee 7.1 %, employer 24.8 %; annual max base 2 350 416 CZK
 *    (48× avg wage). Health insurance: employee 4.5 %, employer 9 %, no max base.
 *    (zákon č. 589/1992 Sb., zákon č. 592/1992 Sb.)
 *  - Income tax 15 % / 23 % (§ 16 ZDP, zákon č. 586/1992 Sb.).
 *  - Basic taxpayer credit 30 840 CZK/yr; child credits 15 204 / 22 320 / 27 840 CZK/yr
 *    for the 1st / 2nd / 3rd-and-further child (§ 35ba, § 35c ZDP).
 *  - 50 000 CZK/yr exemption for employer contributions to old-age-savings products
 *    (supplementary pension, qualifying life insurance, DIP, long-term care) — § 6 odst. 9 ZDP.
 *  - Minimum wage 22 400 CZK/month (nařízení vlády); minimum health-insurance
 *    assessment base for employees = minimum wage.
 */

export interface TaxConfig {
  year: number;

  /** Monthly average wage. Drives the 23 % threshold and the social-security cap. */
  averageWage: number;

  // --- Income tax (§ 16 ZDP) ---
  taxRateBase: number; // 15 %
  taxRateHigh: number; // 23 %
  /** Monthly base above which the 23 % rate applies (= 3 × averageWage). */
  monthlyHighRateThreshold: number;

  // --- Monthly tax credits ---
  /** Basic taxpayer credit per month (§ 35ba ZDP). */
  basicTaxpayerCredit: number;
  /**
   * Monthly child tax credit by birth order: [1st, 2nd, 3rd-and-further] (§ 35c ZDP).
   * Each child beyond the 2nd uses the last value.
   */
  childCredits: [number, number, number];
  /**
   * Minimum monthly employment income to be paid a monthly child tax *bonus*
   * (= ½ × minimum wage). Below it, unused child credit is not paid out monthly.
   */
  monthlyTaxBonusMinIncome: number;

  // --- Social security (zákon č. 589/1992 Sb.) ---
  socialEmployeeRate: number; // 7.1 %
  socialEmployerRate: number; // 24.8 %
  /** Annual cap on the social-security assessment base (= 48 × averageWage). */
  socialAnnualMaxBase: number;

  // --- Public health insurance (zákon č. 592/1992 Sb.) ---
  healthEmployeeRate: number; // 4.5 %
  healthEmployerRate: number; // 9 %
  healthTotalRate: number; // 13.5 %
  /** Minimum monthly health-insurance assessment base for employees (= minimum wage). */
  minHealthAssessmentBase: number;

  // --- Employer benefit exemptions (§ 6 odst. 9 ZDP) ---
  /**
   * Combined annual exemption for employer contributions to "old-age savings products"
   * (supplementary pension savings, qualifying life insurance, DIP, long-term care).
   * Contributions above this — measured cumulatively over the year — are taxable income
   * and enter the social/health assessment base.
   */
  oldAgeSavingsAnnualExemption: number;

  // --- Reference ---
  minimumWage: number;
}

export const TAX_CONFIG_2026: TaxConfig = {
  year: 2026,
  averageWage: 48967,

  taxRateBase: 0.15,
  taxRateHigh: 0.23,
  monthlyHighRateThreshold: 146901, // 3 × 48 967

  basicTaxpayerCredit: 2570, // 30 840 / yr
  childCredits: [1267, 1860, 2320], // 15 204 / 22 320 / 27 840 per yr
  monthlyTaxBonusMinIncome: 11200, // ½ × 22 400 minimum wage

  socialEmployeeRate: 0.071,
  socialEmployerRate: 0.248,
  socialAnnualMaxBase: 48 * 48967, // 2 350 416

  healthEmployeeRate: 0.045,
  healthEmployerRate: 0.09,
  healthTotalRate: 0.135,
  minHealthAssessmentBase: 22400,

  oldAgeSavingsAnnualExemption: 50000,

  minimumWage: 22400,
};
