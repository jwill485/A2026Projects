import { useState } from "react";
import type { RosterData } from "../types/roster";
import {
  computeHeadcountByCompany,
  computeLeadershipFillByCompany,
  computeMosDistribution,
  computeVacancyReport,
} from "../lib/analytics";
import { BarChart, FillRateChart } from "./Charts";
import "./Charts.css";

function DataTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AnalyticsTab({ roster }: { roster: RosterData }) {
  const [tableView, setTableView] = useState(false);

  const fillStats = computeLeadershipFillByCompany(roster);
  const headcount = computeHeadcountByCompany(roster);
  const mosDist = computeMosDistribution(roster);
  const vacancies = computeVacancyReport(roster);

  return (
    <div className="analytics-tab">
      <label className="table-toggle">
        <input
          type="checkbox"
          checked={tableView}
          onChange={(e) => setTableView(e.target.checked)}
        />
        Show as tables
      </label>

      <section>
        <h2>Leadership Fill Rate by Company</h2>
        {tableView ? (
          <DataTable
            headers={["Company", "Filled", "Vacant"]}
            rows={fillStats.map((d) => [d.label, d.filled, d.vacant])}
          />
        ) : (
          <FillRateChart data={fillStats} />
        )}
      </section>

      <section>
        <h2>Headcount by Company</h2>
        {tableView ? (
          <DataTable
            headers={["Company", "Troopers"]}
            rows={headcount.map((d) => [d.label, d.value])}
          />
        ) : (
          <BarChart data={headcount} />
        )}
      </section>

      <section>
        <h2>MOS Breakdown</h2>
        {tableView ? (
          <DataTable headers={["MOS", "Count"]} rows={mosDist.map((d) => [d.label, d.value])} />
        ) : (
          <BarChart data={mosDist} />
        )}
      </section>

      <section>
        <h2>Vacancy Report ({vacancies.length})</h2>
        <ul className="vacancy-list">
          {vacancies.map((v) => (
            <li key={v.label}>{v.label}</li>
          ))}
          {vacancies.length === 0 && <li>No vacant leadership positions.</li>}
        </ul>
      </section>
    </div>
  );
}
