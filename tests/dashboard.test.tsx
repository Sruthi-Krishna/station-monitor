import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/Dashboard";
import { GraphQLRequestError } from "@/lib/graphql-client";
import type { InstrumentRow } from "@/lib/filter";

const gqlMock = vi.fn();

vi.mock("@/lib/graphql-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/graphql-client")>();
  return { ...actual, gql: (...args: unknown[]) => gqlMock(...args) };
});

function row(over: Partial<InstrumentRow>): InstrumentRow {
  return {
    id: "x",
    name: "X",
    subsystem: "Sub",
    unit: "V",
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

const instruments = [
  row({ id: "a", name: "Alpha Temp", subsystem: "Cooling", status: "OK" }),
  row({ id: "b", name: "Beta Voltage", subsystem: "Power", status: "FAULT" }),
  row({ id: "c", name: "Gamma Current", subsystem: "Power", status: "WARNING" }),
];

const history = Array.from({ length: 10 }, (_, i) => ({
  t: new Date(2026, 9, 28, 4, 0, i).toISOString(),
  value: i,
}));

beforeEach(() => {
  gqlMock.mockReset();
});

function respondWith(handler: (query: string) => unknown) {
  gqlMock.mockImplementation(async (query: string) => handler(query));
}

describe("Dashboard", () => {
  it("shows a loading state, then the instruments and an alert for the fault", async () => {
    respondWith((q) => (q.includes("history") ? { history } : { instruments }));
    render(<Dashboard pollMs={60_000} />);

    expect(screen.getByText(/Loading instruments/)).toBeInTheDocument();
    expect(await screen.findAllByTestId("instrument-row")).toHaveLength(3);
    expect(screen.getByRole("alert")).toHaveTextContent("1 instrument in fault, 1 in warning");
  });

  it("filters by search text and by status", async () => {
    respondWith(() => ({ instruments }));
    render(<Dashboard pollMs={60_000} />);
    await screen.findAllByTestId("instrument-row");

    await userEvent.type(screen.getByLabelText("Search"), "power");
    expect(screen.getAllByTestId("instrument-row")).toHaveLength(2);

    await userEvent.selectOptions(screen.getByLabelText("Status"), "WARNING");
    const rows = screen.getAllByTestId("instrument-row");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText("Gamma Current")).toBeInTheDocument();
    expect(screen.getByText("1 of 3 shown", { exact: false })).toBeInTheDocument();
  });

  it("shows the trend for a selected instrument", async () => {
    respondWith((q) => (q.includes("history(") ? { history } : { instruments }));
    render(<Dashboard pollMs={60_000} />);
    await screen.findAllByTestId("instrument-row");

    expect(screen.getByText(/Select an instrument/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Alpha Temp" }));
    expect(await screen.findByTestId("trend-chart")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Alpha Temp" })).toBeInTheDocument();
  });

  it("shows an error with a retry button when the first load fails, then recovers", async () => {
    gqlMock.mockRejectedValueOnce(new GraphQLRequestError("Network error: could not reach the API"));
    respondWith(() => ({ instruments }));
    render(<Dashboard pollMs={60_000} />);

    expect(await screen.findByText(/Could not load instruments/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findAllByTestId("instrument-row")).toHaveLength(3);
  });

  it("keeps showing the last data and flags it as stale when a later poll fails", async () => {
    let calls = 0;
    gqlMock.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) return { instruments };
      throw new GraphQLRequestError("Network error: could not reach the API");
    });
    render(<Dashboard pollMs={30} />);

    expect(await screen.findAllByTestId("instrument-row")).toHaveLength(3);
    await waitFor(() => expect(screen.getByText(/Connection problem/)).toBeInTheDocument());
    expect(screen.getAllByTestId("instrument-row")).toHaveLength(3);
  });
});
