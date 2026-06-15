import { PayrollInput } from "./payroll";
import { TAX_CONFIG_2026 } from "./taxConfig";
import { weekdayHours } from "./calendar";

/**
 * Shareable-link codec.
 *
 * The calculator's inputs are packed into a single, opaque query param so a link
 * can prepopulate the form without exposing field names or readable values:
 *
 *   ?d=<version>-<v1>-<v2>-…
 *
 * The values are a fixed-order positional array (no keys → no sensitive names),
 * each encoded in base-36 to stay short and unreadable. A field equal to its
 * default serialises as an empty token and trailing empties are dropped, so a
 * salary-only link is tiny, e.g. `?d=1-1jis-6`.
 *
 * This is obfuscation, not encryption — the payload is opaque to a casual reader
 * but anyone can decode it. Don't put secrets in it.
 */

/** Bump when the field list changes incompatibly; old links with other versions are ignored. */
const VERSION = 1;
const SEP = "-";

type Kind = "int" | "dec" | "bool";

interface FieldSpec {
  key: keyof PayrollInput;
  kind: Kind;
  /**
   * Default for this field given the whole input. A value equal to it is omitted
   * from the link (restored from the form default on decode). Return `null` to
   * always include the field.
   */
  def: (input: PayrollInput) => number | boolean | null;
}

/**
 * The wire contract for share links: field order is positional and permanent.
 * APPEND ONLY — never reorder or remove an entry, or existing links decode into
 * the wrong fields. Most-customised fields go first so trailing-default trimming
 * keeps common links short.
 */
const FIELDS: FieldSpec[] = [
  { key: "monthlySalary", kind: "int", def: () => 0 },
  { key: "month", kind: "int", def: () => null }, // always carried — useful context
  { key: "carAllowance", kind: "int", def: () => 17000 },
  { key: "telephoneAllowance", kind: "int", def: () => 800 },
  { key: "vacationDays", kind: "dec", def: () => 0 },
  { key: "averageHourlyRate", kind: "dec", def: () => 0 },
  // Omitted when it matches the weekdays-derived default for the chosen month.
  { key: "monthlyWorkHours", kind: "int", def: (i) => weekdayHours(TAX_CONFIG_2026.year, i.month) },
  { key: "employeePensionPct", kind: "dec", def: () => 4 },
  { key: "taxableInsuranceMonthly", kind: "int", def: () => 0 },
  { key: "otherTaxableBenefits", kind: "int", def: () => 0 },
  { key: "applyBasicCredit", kind: "bool", def: () => true },
  { key: "otherMonthlyCredits", kind: "int", def: () => 0 },
  { key: "children", kind: "int", def: () => 0 },
  { key: "exemptFromMinHealthBase", kind: "bool", def: () => false },
  { key: "multisport", kind: "int", def: () => 270 },
  { key: "otherDeductions", kind: "int", def: () => 0 },
];

const b36 = (n: number) => Math.max(0, Math.round(n)).toString(36);

function encodeToken(value: number | boolean | undefined, kind: Kind): string {
  switch (kind) {
    case "bool":
      return value ? "1" : "0";
    case "dec":
      return b36(Number(value ?? 0) * 100);
    case "int":
      return b36(Number(value ?? 0));
  }
}

function decodeToken(token: string, kind: Kind): number | boolean | undefined {
  if (kind === "bool") return token === "1";
  const n = parseInt(token, 36);
  if (Number.isNaN(n)) return undefined;
  return kind === "dec" ? n / 100 : n;
}

const sameValue = (a: number | boolean | undefined, b: number | boolean) =>
  typeof b === "boolean" ? Boolean(a) === b : Number(a ?? 0) === b;

/** Pack the form state into the opaque `d` param value (without the `d=` prefix). */
export function encodeShareLink(input: PayrollInput): string {
  const tokens = FIELDS.map((spec) => {
    const value = input[spec.key] as number | boolean | undefined;
    const def = spec.def(input);
    if (def !== null && sameValue(value, def)) return ""; // default → omit
    return encodeToken(value, spec.kind);
  });

  // Drop trailing defaults to keep the link short.
  while (tokens.length && tokens[tokens.length - 1] === "") tokens.pop();

  return [VERSION.toString(36), ...tokens].join(SEP);
}

/**
 * Decode a `d` param value into the subset of inputs it carries. Unknown or
 * malformed payloads yield `{}` so the caller falls back to defaults. Note that
 * an omitted `monthlyWorkHours` is left out here; the caller should re-derive it
 * from the decoded `month`.
 */
export function decodeShareLink(param: string | null | undefined): Partial<PayrollInput> {
  if (!param) return {};
  const parts = param.split(SEP);
  if (parseInt(parts[0], 36) !== VERSION) return {};

  const tokens = parts.slice(1);
  const out: Partial<PayrollInput> = {};
  FIELDS.forEach((spec, i) => {
    const token = tokens[i];
    if (token === undefined || token === "") return; // omitted → keep default
    const value = decodeToken(token, spec.kind);
    if (value !== undefined) (out[spec.key] as number | boolean) = value;
  });
  return out;
}
