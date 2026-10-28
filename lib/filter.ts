import { STATUS_RANK, type Status } from "./alarms";

export interface InstrumentRow {
  id: string;
  name: string;
  subsystem: string;
  unit: string;
  value: number;
  status: Status;
  warnLow: number | null;
  warnHigh: number | null;
  faultLow: number | null;
  faultHigh: number | null;
  updatedAt: string;
}

export type StatusFilter = "ALL" | Status;
export type SortKey = "severity" | "name" | "subsystem";

export interface ViewOptions {
  search: string;
  status: StatusFilter;
  sort: SortKey;
}

/** Filter by status and free-text search (name or subsystem), then sort. Pure: never mutates input. */
export function applyView(rows: InstrumentRow[], opts: ViewOptions): InstrumentRow[] {
  const q = opts.search.trim().toLowerCase();

  const filtered = rows.filter((r) => {
    if (opts.status !== "ALL" && r.status !== opts.status) return false;
    if (q === "") return true;
    return r.name.toLowerCase().includes(q) || r.subsystem.toLowerCase().includes(q);
  });

  return [...filtered].sort((a, b) => {
    if (opts.sort === "severity") {
      const diff = STATUS_RANK[b.status] - STATUS_RANK[a.status];
      if (diff !== 0) return diff;
    }
    if (opts.sort === "subsystem") {
      const diff = a.subsystem.localeCompare(b.subsystem);
      if (diff !== 0) return diff;
    }
    return a.name.localeCompare(b.name);
  });
}

export function formatValue(value: number, unit: string): string {
  const digits = Math.abs(value) >= 100 ? 1 : 2;
  return `${value.toFixed(digits)} ${unit}`;
}
