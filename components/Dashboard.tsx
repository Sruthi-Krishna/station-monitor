"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { countByStatus } from "@/lib/alarms";
import {
  applyView,
  type InstrumentRow,
  type SortKey,
  type StatusFilter,
} from "@/lib/filter";
import { gql, HISTORY_QUERY, INSTRUMENTS_QUERY } from "@/lib/graphql-client";
import { AlarmBanner } from "./AlarmBanner";
import { InstrumentTable } from "./InstrumentTable";
import { StatusBadge } from "./StatusBadge";
import { TrendChart, type TrendPoint } from "./TrendChart";

export const POLL_INTERVAL_MS = 3000;

export function Dashboard({ pollMs = POLL_INTERVAL_MS }: { pollMs?: number }) {
  const [rows, setRows] = useState<InstrumentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [sort, setSort] = useState<SortKey>("severity");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [trendError, setTrendError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await gql<{ instruments: InstrumentRow[] }>(INSTRUMENTS_QUERY);
      setRows(data.instruments);
      setError(null);
      setLastUpdated(new Date());
    } catch (e) {
      // Keep showing the last good data; just flag that it is stale.
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }, []);

  useEffect(() => {
    // Defer the first load so the effect itself never sets state synchronously.
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, pollMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh, pollMs]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    async function loadTrend() {
      try {
        const data = await gql<{ history: TrendPoint[] }>(HISTORY_QUERY, {
          id: selectedId,
          points: 40,
          stepSeconds: 15,
        });
        if (!cancelled) {
          setTrend(data.history);
          setTrendError(null);
        }
      } catch (e) {
        if (!cancelled) setTrendError(e instanceof Error ? e.message : "Unknown error");
      }
    }
    loadTrend();
    const timer = setInterval(loadTrend, pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedId, pollMs]);

  const visible = useMemo(
    () => applyView(rows ?? [], { search, status, sort }),
    [rows, search, status, sort],
  );
  const counts = useMemo(() => countByStatus((rows ?? []).map((r) => r.status)), [rows]);
  const selected = rows?.find((r) => r.id === selectedId) ?? null;

  if (rows === null && error === null) {
    return <p role="status">Loading instruments…</p>;
  }
  if (rows === null) {
    return (
      <div role="alert" className="banner banner-fault">
        Could not load instruments: {error}
        <button type="button" className="retry" onClick={refresh}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <AlarmBanner counts={counts} />

      {error && (
        <p role="alert" className="stale">
          Connection problem ({error}). Showing the last data received
          {lastUpdated ? ` at ${lastUpdated.toLocaleTimeString()}` : ""}.
        </p>
      )}

      <section className="controls" aria-label="Filters">
        <label>
          Search
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or subsystem"
          />
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            <option value="ALL">All</option>
            <option value="FAULT">Fault</option>
            <option value="WARNING">Warning</option>
            <option value="OK">OK</option>
            <option value="UNKNOWN">No data</option>
          </select>
        </label>
        <label>
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="severity">Severity</option>
            <option value="name">Name</option>
            <option value="subsystem">Subsystem</option>
          </select>
        </label>
        <span className="meta">
          {visible.length} of {rows.length} shown
          {lastUpdated ? ` · updated ${lastUpdated.toLocaleTimeString()}` : ""}
        </span>
      </section>

      <div className="layout">
        <InstrumentTable rows={visible} selectedId={selectedId} onSelect={setSelectedId} />

        <aside className="detail" aria-live="polite">
          {selected ? (
            <>
              <h2>{selected.name}</h2>
              <p>
                <StatusBadge status={selected.status} />
              </p>
              {trendError ? (
                <p role="alert" className="stale">
                  Could not load trend: {trendError}
                </p>
              ) : (
                <TrendChart
                  points={trend}
                  unit={selected.unit}
                  warnHigh={selected.warnHigh}
                  faultHigh={selected.faultHigh}
                  warnLow={selected.warnLow}
                  faultLow={selected.faultLow}
                />
              )}
            </>
          ) : (
            <p className="empty">Select an instrument to see its trend.</p>
          )}
        </aside>
      </div>
    </>
  );
}
