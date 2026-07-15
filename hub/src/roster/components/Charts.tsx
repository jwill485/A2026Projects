import type { CountStat, FillStat } from "../lib/analytics";
import "./Charts.css";

export function BarChart({ data }: { data: CountStat[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <p className="chart-empty">No data.</p>;
  return (
    <div className="bar-chart">
      {data.map((d) => (
        <div className="bar-row" key={d.label} title={`${d.label}: ${d.value}`}>
          <span className="bar-label">{d.label}</span>
          <div className="bar-track">
            <div className="bar-fill series" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="bar-value">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export function FillRateChart({ data }: { data: FillStat[] }) {
  if (data.length === 0) return <p className="chart-empty">No data.</p>;
  return (
    <div className="bar-chart">
      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-swatch good" /> Filled
        </span>
        <span className="legend-item">
          <span className="legend-swatch warning" /> Vacant
        </span>
      </div>
      {data.map((d) => {
        const total = d.filled + d.vacant;
        const filledPct = total ? (d.filled / total) * 100 : 0;
        const vacantPct = total ? (d.vacant / total) * 100 : 0;
        return (
          <div className="bar-row" key={d.label}>
            <span className="bar-label">{d.label}</span>
            <div className="bar-track stacked">
              <div
                className="bar-fill good"
                style={{ width: `${filledPct}%` }}
                title={`Filled: ${d.filled}`}
              />
              <div
                className="bar-fill warning"
                style={{ width: `${vacantPct}%` }}
                title={`Vacant: ${d.vacant}`}
              />
            </div>
            <span className="bar-value">
              {d.filled}/{total}
            </span>
          </div>
        );
      })}
    </div>
  );
}
