import type { Status } from "@/lib/alarms";

const LABELS: Record<Status, string> = {
  OK: "OK",
  WARNING: "Warning",
  FAULT: "Fault",
  UNKNOWN: "No data",
};

const SYMBOLS: Record<Status, string> = {
  OK: "●",
  WARNING: "▲",
  FAULT: "✖",
  UNKNOWN: "?",
};

/** Colour is never the only signal: each status also has a symbol and a text label. */
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`badge badge-${status.toLowerCase()}`} data-testid="status-badge">
      <span aria-hidden="true">{SYMBOLS[status]}</span> {LABELS[status]}
    </span>
  );
}
