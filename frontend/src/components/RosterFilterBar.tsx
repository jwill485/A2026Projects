import type { ApiRankExpanded } from "../types/api";
import { EMPTY_FILTER, isFilterActive, type RosterFilter } from "../lib/filterRoster";
import "./RosterFilterBar.css";

export function RosterFilterBar({
  filter,
  onChange,
  ranks,
  mosOptions,
}: {
  filter: RosterFilter;
  onChange: (next: RosterFilter) => void;
  ranks: ApiRankExpanded[];
  mosOptions: string[];
}) {
  return (
    <div className="roster-filter-bar">
      <input
        type="text"
        placeholder="Search name..."
        value={filter.text}
        onChange={(e) => onChange({ ...filter, text: e.target.value })}
      />
      <select value={filter.rank} onChange={(e) => onChange({ ...filter, rank: e.target.value })}>
        <option value="">All ranks</option>
        {ranks.map((r) => (
          <option key={r.rankId} value={r.rankShort}>
            {r.rankFull}
          </option>
        ))}
      </select>
      <select value={filter.mos} onChange={(e) => onChange({ ...filter, mos: e.target.value })}>
        <option value="">All MOS</option>
        {mosOptions.map((mos) => (
          <option key={mos} value={mos}>
            {mos}
          </option>
        ))}
      </select>
      <select
        value={filter.splitTag}
        onChange={(e) => onChange({ ...filter, splitTag: e.target.value as RosterFilter["splitTag"] })}
      >
        <option value="">Any split tag</option>
        <option value="neutral">Neutral (undecided)</option>
        <option value="hllv">HLLV</option>
        <option value="hllww2">HLLWW2</option>
      </select>
      <label className="filter-vacant-toggle">
        <input
          type="checkbox"
          checked={filter.vacantOnly}
          onChange={(e) => onChange({ ...filter, vacantOnly: e.target.checked })}
        />
        Vacant leadership only
      </label>
      {isFilterActive(filter) && (
        <button type="button" className="add-btn" onClick={() => onChange(EMPTY_FILTER)}>
          Clear filter
        </button>
      )}
    </div>
  );
}
