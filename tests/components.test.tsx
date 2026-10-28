import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AlarmBanner } from "@/components/AlarmBanner";
import { InstrumentTable } from "@/components/InstrumentTable";
import { StatusBadge } from "@/components/StatusBadge";
import { TrendChart } from "@/components/TrendChart";
import type { InstrumentRow } from "@/lib/filter";

function row(over: Partial<InstrumentRow>): InstrumentRow {
  return {
    id: "x",
    name: "X",
    subsystem: "Sub",
    unit: "V",
    value: 1.234,
    status: "OK",
    warnLow: null,
    warnHigh: null,
    faultLow: null,
    faultHigh: null,
    updatedAt: "2026-10-28T04:00:00.000Z",
    ...over,
  };
}

describe("StatusBadge", () => {
  it.each([
    ["OK", "OK"],
    ["WARNING", "Warning"],
    ["FAULT", "Fault"],
    ["UNKNOWN", "No data"],
  ] as const)("shows a text label for %s, not colour alone", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByTestId("status-badge")).toHaveTextContent(label);
    expect(screen.getByTestId("status-badge")).toHaveClass(`badge-${status.toLowerCase()}`);
  });
});

describe("AlarmBanner", () => {
  it("is nominal when nothing is wrong", () => {
    render(<AlarmBanner counts={{ OK: 5, WARNING: 0, FAULT: 0, UNKNOWN: 0 }} />);
    expect(screen.getByTestId("alarm-banner")).toHaveTextContent("All instruments nominal");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("raises an alert role for faults and mentions warnings too", () => {
    render(<AlarmBanner counts={{ OK: 3, WARNING: 2, FAULT: 1, UNKNOWN: 0 }} />);
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("1 instrument in fault, 2 in warning");
  });

  it("pluralises correctly", () => {
    render(<AlarmBanner counts={{ OK: 0, WARNING: 0, FAULT: 3, UNKNOWN: 0 }} />);
    expect(screen.getByTestId("alarm-banner")).toHaveTextContent("3 instruments in fault");
  });

  it("shows a warning-only message without an alert role", () => {
    render(<AlarmBanner counts={{ OK: 4, WARNING: 1, FAULT: 0, UNKNOWN: 0 }} />);
    expect(screen.getByRole("status")).toHaveTextContent("1 instrument in warning");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("InstrumentTable", () => {
  const rows = [
    row({ id: "a", name: "Alpha", status: "FAULT", value: 12.5, unit: "A" }),
    row({ id: "b", name: "Beta", status: "OK" }),
  ];

  it("renders one row per instrument with its reading and status", () => {
    render(<InstrumentTable rows={rows} selectedId={null} onSelect={() => {}} />);
    const dataRows = screen.getAllByTestId("instrument-row");
    expect(dataRows).toHaveLength(2);
    expect(within(dataRows[0]).getByText("12.50 A")).toBeInTheDocument();
    expect(within(dataRows[0]).getByTestId("status-badge")).toHaveTextContent("Fault");
  });

  it("calls onSelect with the id when a name is clicked", async () => {
    const onSelect = vi.fn();
    render(<InstrumentTable rows={rows} selectedId={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: "Beta" }));
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("marks the selected row", () => {
    render(<InstrumentTable rows={rows} selectedId="a" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "Alpha" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Beta" })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows an empty state when nothing matches", () => {
    render(<InstrumentTable rows={[]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText(/No instruments match/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("TrendChart", () => {
  const points = Array.from({ length: 10 }, (_, i) => ({
    t: new Date(2026, 9, 28, 4, 0, i).toISOString(),
    value: 20 + Math.sin(i),
  }));

  it("draws a labelled chart with a line", () => {
    const { container } = render(<TrendChart points={points} unit="°C" warnHigh={21} faultHigh={24} />);
    expect(screen.getByTestId("trend-chart")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAccessibleName(/Trend of the last 10 readings/);
    expect(container.querySelector("path.line")).not.toBeNull();
  });

  it("shows a threshold guide when it is near the data, and omits a distant one", () => {
    const { container } = render(<TrendChart points={points} unit="°C" warnHigh={21} faultHigh={500} />);
    expect(container.querySelectorAll(".guide-warn")).toHaveLength(1);
    expect(container.querySelectorAll(".guide-fault")).toHaveLength(0);
  });

  it("handles a flat series without NaN coordinates", () => {
    const flat = points.map((p) => ({ ...p, value: 5 }));
    const { container } = render(<TrendChart points={flat} unit="V" />);
    expect(container.querySelector("path.line")?.getAttribute("d")).not.toMatch(/NaN/);
  });

  it("shows a message when there is too little data", () => {
    render(<TrendChart points={points.slice(0, 1)} unit="V" />);
    expect(screen.getByText(/Not enough data/)).toBeInTheDocument();
  });
});
