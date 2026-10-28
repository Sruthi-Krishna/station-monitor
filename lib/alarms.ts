export type Status = "OK" | "WARNING" | "FAULT" | "UNKNOWN";

/**
 * Alarm limits for one instrument. Every limit is optional so an instrument
 * can be one-sided (e.g. only an upper limit on temperature).
 *
 * Boundaries are inclusive: a reading exactly on a limit trips that limit.
 */
export interface Limits {
  warnLow?: number;
  warnHigh?: number;
  faultLow?: number;
  faultHigh?: number;
}

/** Severity order used for sorting and for picking the worst status. */
export const STATUS_RANK: Record<Status, number> = {
  FAULT: 3,
  WARNING: 2,
  UNKNOWN: 1,
  OK: 0,
};

/**
 * Classify a single reading against its limits.
 * A missing or non-finite reading is UNKNOWN, never OK: silence from a sensor
 * should not look healthy.
 */
export function classify(value: number | null | undefined, limits: Limits): Status {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "UNKNOWN";
  }
  const { warnLow, warnHigh, faultLow, faultHigh } = limits;

  if (faultHigh !== undefined && value >= faultHigh) return "FAULT";
  if (faultLow !== undefined && value <= faultLow) return "FAULT";
  if (warnHigh !== undefined && value >= warnHigh) return "WARNING";
  if (warnLow !== undefined && value <= warnLow) return "WARNING";
  return "OK";
}

/** The most severe status in a list. An empty list is OK. */
export function worstStatus(statuses: Status[]): Status {
  return statuses.reduce<Status>(
    (worst, s) => (STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst),
    "OK",
  );
}

export interface StatusCounts {
  OK: number;
  WARNING: number;
  FAULT: number;
  UNKNOWN: number;
}

export function countByStatus(statuses: Status[]): StatusCounts {
  const counts: StatusCounts = { OK: 0, WARNING: 0, FAULT: 0, UNKNOWN: 0 };
  for (const s of statuses) counts[s] += 1;
  return counts;
}
