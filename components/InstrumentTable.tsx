import { formatValue, type InstrumentRow } from "@/lib/filter";
import { StatusBadge } from "./StatusBadge";

interface Props {
  rows: InstrumentRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function InstrumentTable({ rows, selectedId, onSelect }: Props) {
  if (rows.length === 0) {
    return <p className="empty">No instruments match the current filters.</p>;
  }

  return (
    <table className="table">
      <caption className="sr-only">Instrument readings</caption>
      <thead>
        <tr>
          <th scope="col">Instrument</th>
          <th scope="col">Subsystem</th>
          <th scope="col">Reading</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            data-testid="instrument-row"
            className={row.id === selectedId ? "selected" : undefined}
          >
            <th scope="row">
              <button
                type="button"
                className="row-button"
                aria-pressed={row.id === selectedId}
                onClick={() => onSelect(row.id)}
              >
                {row.name}
              </button>
            </th>
            <td>{row.subsystem}</td>
            <td className="num">{formatValue(row.value, row.unit)}</td>
            <td>
              <StatusBadge status={row.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
