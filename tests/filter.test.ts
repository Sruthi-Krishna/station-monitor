import { describe, expect, it } from "vitest";
import { applyView, formatValue, type InstrumentRow } from "@/lib/filter";

function row(over: Partial<InstrumentRow>): InstrumentRow {
  return {
    id: "x",
    name: "X",
    subsystem: "Sub",
    unit: "u",
    value: 1,
    status: "OK",
    warnLow: null,
    warnHigh: null,
    faultLow: null,
    faultHigh: null,
    updatedAt: "2026-10-28T04:00:00.000Z",
    ...over,
  };
}

const rows: InstrumentRow[] = [
  row({ id: "a", name: "Alpha Temp", subsystem: "Cooling", status: "OK" }),
  row({ id: "b", name: "Beta Voltage", subsystem: "Power", status: "FAULT" }),
  row({ id: "c", name: "Gamma Current", subsystem: "Power", status: "WARNING" }),
  row({ id: "d", name: "Delta Link", subsystem: "Network", status: "UNKNOWN" }),
];

const base = { search: "", status: "ALL", sort: "name" } as const;

describe("applyView", () => {
  it("returns everything when no filter is set", () => {
    expect(applyView(rows, base)).toHaveLength(4);
  });

  it("filters by status", () => {
    expect(applyView(rows, { ...base, status: "FAULT" }).map((r) => r.id)).toEqual(["b"]);
  });

  it("searches name and subsystem, ignoring case and surrounding spaces", () => {
    expect(applyView(rows, { ...base, search: "  power " }).map((r) => r.id)).toEqual(["b", "c"]);
    expect(applyView(rows, { ...base, search: "ALPHA" }).map((r) => r.id)).toEqual(["a"]);
  });

  it("combines search and status", () => {
    expect(applyView(rows, { search: "power", status: "WARNING", sort: "name" })).toHaveLength(1);
  });

  it("returns an empty list when nothing matches", () => {
    expect(applyView(rows, { ...base, search: "zzz" })).toEqual([]);
  });

  it("sorts by severity, worst first, then by name", () => {
    expect(applyView(rows, { ...base, sort: "severity" }).map((r) => r.id)).toEqual([
      "b", // FAULT
      "c", // WARNING
      "d", // UNKNOWN
      "a", // OK
    ]);
  });

  it("sorts by name and by subsystem", () => {
    expect(applyView(rows, { ...base, sort: "name" }).map((r) => r.id)).toEqual(["a", "b", "d", "c"]);
    expect(applyView(rows, { ...base, sort: "subsystem" }).map((r) => r.id)).toEqual([
      "a", // Cooling
      "d", // Network
      "b", // Power, Beta
      "c", // Power, Gamma
    ]);
  });

  it("does not mutate the input array", () => {
    const copy = [...rows];
    applyView(rows, { ...base, sort: "severity" });
    expect(rows).toEqual(copy);
  });
});

describe("formatValue", () => {
  it("uses two decimals for small values and one for large", () => {
    expect(formatValue(3.14159, "V")).toBe("3.14 V");
    expect(formatValue(123.456, "Gb/s")).toBe("123.5 Gb/s");
  });
});
