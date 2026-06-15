const czk = new Intl.NumberFormat("cs-CZ", {
  maximumFractionDigits: 0,
});

/** Format a number as whole CZK with Czech thousands separators, e.g. "143 679 Kč". */
export function formatCZK(n: number): string {
  return `${czk.format(Math.round(n))} Kč`;
}

/** Format a number as a plain grouped integer, e.g. "143 679". */
export function formatNumber(n: number): string {
  return czk.format(Math.round(n));
}

/** Format a rate as a percentage, e.g. 0.071 -> "7,1 %". */
export function formatPct(rate: number): string {
  return `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(
    rate * 100,
  )} %`;
}
