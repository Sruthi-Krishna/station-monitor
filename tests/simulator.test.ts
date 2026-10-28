import { describe, expect, it } from "vitest";
import { classify } from "@/lib/alarms";
import {
  INSTRUMENTS,
  history,
  noiseAt,
  readValue,
  snapshotAll,
  type InstrumentDef,
} from "@/lib/simulator";

const T0 = Date.UTC(2026, 9, 28, 4, 0, 0);

describe("noiseAt", () => {
  it("is deterministic", () => {
    expect(noiseAt("abc", 42)).toBe(noiseAt("abc", 42));
  });

  it("stays within [-1, 1)", () => {
    for (let i = 0; i < 2000; i++) {
      const n = noiseAt("seed", i);
      expect(n).toBeGreaterThanOrEqual(-1);
      expect(n).toBeLessThan(1);
    }
  });

  it("differs between seeds", () => {
    expect(noiseAt("a", 1)).not.toBe(noiseAt("b", 1));
  });
});

describe("readValue", () => {
  it("returns the same value for the same instant (stateless)", () => {
    for (const def of INSTRUMENTS) {
      expect(readValue(def, T0)).toBe(readValue(def, T0));
    }
  });

  it("stays within the possible envelope", () => {
    for (const def of INSTRUMENTS) {
      const maxExcursion = def.excursion?.delta ?? 0;
      const lo = def.base - def.amplitude - def.noise - Math.max(0, -maxExcursion) - 0.001;
      const hi = def.base + def.amplitude + def.noise + Math.max(0, maxExcursion) + 0.001;
      for (let s = 0; s < 3600; s += 7) {
        const v = readValue(def, T0 + s * 1000);
        expect(v).toBeGreaterThanOrEqual(lo);
        expect(v).toBeLessThanOrEqual(hi);
      }
    }
  });

  it("applies a recurring excursion only inside its window", () => {
    const def: InstrumentDef = {
      id: "test",
      name: "Test",
      subsystem: "Test",
      unit: "u",
      base: 10,
      amplitude: 0,
      periodSec: 100,
      phase: 0,
      noise: 0,
      limits: {},
      excursion: { everySec: 100, durationSec: 10, offsetSec: 0, delta: 5 },
    };
    expect(readValue(def, 5_000)).toBe(15); // inside the first 10 s of the cycle
    expect(readValue(def, 50_000)).toBe(10); // outside
    expect(readValue(def, 105_000)).toBe(15); // next cycle
  });
});

describe("instrument definitions", () => {
  it("have unique ids", () => {
    const ids = INSTRUMENTS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("have consistent limits (fault is beyond warning)", () => {
    for (const { id, limits } of INSTRUMENTS) {
      if (limits.warnHigh !== undefined && limits.faultHigh !== undefined) {
        expect(limits.faultHigh, id).toBeGreaterThan(limits.warnHigh);
      }
      if (limits.warnLow !== undefined && limits.faultLow !== undefined) {
        expect(limits.faultLow, id).toBeLessThan(limits.warnLow);
      }
    }
  });

  it("produce all of OK, WARNING and FAULT over a day, so the demo shows every state", () => {
    const seen = new Set<string>();
    for (const def of INSTRUMENTS) {
      for (let s = 0; s < 86_400; s += 13) {
        seen.add(classify(readValue(def, T0 + s * 1000), def.limits));
      }
    }
    expect(seen.has("OK")).toBe(true);
    expect(seen.has("WARNING")).toBe(true);
    expect(seen.has("FAULT")).toBe(true);
  });
});

describe("snapshotAll and history", () => {
  it("snapshotAll returns every instrument with a status", () => {
    const all = snapshotAll(T0);
    expect(all).toHaveLength(INSTRUMENTS.length);
    expect(all.every((s) => ["OK", "WARNING", "FAULT"].includes(s.status))).toBe(true);
  });

  it("history is oldest-first, evenly spaced, and ends at now", () => {
    const h = history(INSTRUMENTS[0], T0, 5, 10);
    expect(h).toHaveLength(5);
    expect(h[4].t).toBe(T0);
    expect(h[0].t).toBe(T0 - 40_000);
    expect(h[1].t - h[0].t).toBe(10_000);
  });

  it("history's last point equals the current reading", () => {
    const def = INSTRUMENTS[3];
    const h = history(def, T0, 3, 5);
    expect(h[2].value).toBe(readValue(def, T0));
  });
});
