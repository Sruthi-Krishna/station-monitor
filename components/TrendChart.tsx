export interface TrendPoint {
  t: string;
  value: number;
}

interface Props {
  points: TrendPoint[];
  unit: string;
  warnHigh?: number | null;
  faultHigh?: number | null;
  warnLow?: number | null;
  faultLow?: number | null;
}

const W = 600;
const H = 220;
const PAD = { top: 12, right: 16, bottom: 24, left: 52 };

/** Plain SVG line chart with threshold guides. No chart library needed. */
export function TrendChart({ points, unit, warnHigh, faultHigh, warnLow, faultLow }: Props) {
  if (points.length < 2) {
    return <p className="empty">Not enough data to draw a trend yet.</p>;
  }

  const values = points.map((p) => p.value);
  const guides = [
    { y: warnHigh, cls: "guide-warn", label: "warn" },
    { y: warnLow, cls: "guide-warn", label: "warn" },
    { y: faultHigh, cls: "guide-fault", label: "fault" },
    { y: faultLow, cls: "guide-fault", label: "fault" },
  ].filter((g): g is { y: number; cls: string; label: string } => typeof g.y === "number");

  // Include guides in the range only when they are near the data, so a distant limit does not flatten the line.
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const span = Math.max(dataMax - dataMin, 1e-6);
  const near = guides.filter((g) => g.y >= dataMin - span && g.y <= dataMax + span);

  const lo = Math.min(dataMin, ...near.map((g) => g.y));
  const hi = Math.max(dataMax, ...near.map((g) => g.y));
  const range = Math.max(hi - lo, 1e-6);
  const yMin = lo - range * 0.08;
  const yMax = hi + range * 0.08;

  const x = (i: number) => PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const ticks = [yMin, (yMin + yMax) / 2, yMax];
  const last = points[points.length - 1];

  return (
    <figure className="chart" data-testid="trend-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Trend of the last ${points.length} readings in ${unit}. Latest ${last.value} ${unit}.`}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="grid" />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" className="axis">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {near.map((g, i) => (
          <g key={`${g.label}-${g.y}-${i}`}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(g.y)} y2={y(g.y)} className={g.cls} />
            <text x={W - PAD.right} y={y(g.y) - 3} textAnchor="end" className="axis">
              {g.label} {g.y}
            </text>
          </g>
        ))}
        <path d={path} className="line" fill="none" />
        <circle cx={x(points.length - 1)} cy={y(last.value)} r={3.5} className="dot" />
        <text x={W / 2} y={H - 4} textAnchor="middle" className="axis">
          oldest → latest ({unit})
        </text>
      </svg>
    </figure>
  );
}
