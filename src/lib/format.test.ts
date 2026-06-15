import { describe, it, expect } from "vitest";
import { formatCZK, formatNumber, formatPct } from "./format";

/** Strip grouping/space characters so assertions don't depend on the exact ICU separator. */
const digits = (s: string) => s.replace(/[\s  ]/g, "");

describe("formatCZK", () => {
  it("groups thousands and appends the currency", () => {
    expect(digits(formatCZK(123456))).toBe("123456Kč");
  });

  it("rounds to whole crowns", () => {
    expect(digits(formatCZK(99.6))).toBe("100Kč");
    expect(digits(formatCZK(-1234.4))).toBe("-1234Kč");
  });
});

describe("formatNumber", () => {
  it("groups thousands without a currency suffix", () => {
    expect(digits(formatNumber(123456))).toBe("123456");
  });
});

describe("formatPct", () => {
  it("renders a rate as a percentage", () => {
    expect(formatPct(0.071).replace(/[\s  ]/g, "")).toBe("7,1%");
    expect(formatPct(0.135).replace(/[\s  ]/g, "")).toBe("13,5%");
  });
});
