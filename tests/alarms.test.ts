import { describe, expect, it } from "vitest";
import { classify, countByStatus, worstStatus, type Limits } from "@/lib/alarms";

const both: Limits = { warnLow: 10, warnHigh: 20, faultLow: 5, faultHigh: 25 };

describe("classify", () => {
  it("is OK between the warning limits", () => {
    expect(classify(15, both)).toBe("OK");
  });

  it("is OK just inside the warning limits", () => {
    expect(classify(19.99, both)).toBe("OK");
    expect(classify(10.01, both)).toBe("OK");
  });

  it("trips WARNING exactly on a warning limit (boundaries are inclusive)", () => {
    expect(classify(20, both)).toBe("WARNING");
    expect(classify(10, both)).toBe("WARNING");
  });

  it("is WARNING between the warning and fault limits", () => {
    expect(classify(22, both)).toBe("WARNING");
    expect(classify(7, both)).toBe("WARNING");
  });

  it("trips FAULT exactly on a fault limit, and beyond", () => {
    expect(classify(25, both)).toBe("FAULT");
    expect(classify(5, both)).toBe("FAULT");
    expect(classify(100, both)).toBe("FAULT");
    expect(classify(-100, both)).toBe("FAULT");
  });

  it("treats a missing or non-finite reading as UNKNOWN, never OK", () => {
    expect(classify(null, both)).toBe("UNKNOWN");
    expect(classify(undefined, both)).toBe("UNKNOWN");
    expect(classify(Number.NaN, both)).toBe("UNKNOWN");
    expect(classify(Number.POSITIVE_INFINITY, both)).toBe("UNKNOWN");
  });

  it("supports one-sided limits", () => {
    const upperOnly: Limits = { warnHigh: 30, faultHigh: 40 };
    expect(classify(-1000, upperOnly)).toBe("OK");
    expect(classify(35, upperOnly)).toBe("WARNING");
  });

  it("is always OK when no limits are set", () => {
    expect(classify(12345, {})).toBe("OK");
  });

  it("recovers to OK when the value returns inside the limits", () => {
    expect(classify(30, both)).toBe("FAULT");
    expect(classify(15, both)).toBe("OK");
  });
});

describe("worstStatus", () => {
  it("returns the most severe status", () => {
    expect(worstStatus(["OK", "WARNING", "OK"])).toBe("WARNING");
    expect(worstStatus(["OK", "FAULT", "WARNING"])).toBe("FAULT");
  });

  it("ranks UNKNOWN above OK but below WARNING", () => {
    expect(worstStatus(["OK", "UNKNOWN"])).toBe("UNKNOWN");
    expect(worstStatus(["UNKNOWN", "WARNING"])).toBe("WARNING");
  });

  it("is OK for an empty list", () => {
    expect(worstStatus([])).toBe("OK");
  });
});

describe("countByStatus", () => {
  it("counts each status", () => {
    expect(countByStatus(["OK", "OK", "FAULT", "WARNING", "UNKNOWN", "OK"])).toEqual({
      OK: 3,
      WARNING: 1,
      FAULT: 1,
      UNKNOWN: 1,
    });
  });
});
