import { useState } from "react";
import type { ApiRankExpanded } from "../types/api";
import type { Soldier } from "../types/roster";
import "./SoldierForm.css";

export interface SoldierFormValues {
  realName: string;
  rankId: string;
  rankShort: string;
  rankFull: string;
  mos: string;
}

export function SoldierForm({
  ranks,
  initial,
  title,
  onSubmit,
  onCancel,
}: {
  ranks: ApiRankExpanded[];
  initial?: Soldier;
  title: string;
  onSubmit: (values: SoldierFormValues) => void;
  onCancel: () => void;
}) {
  const [realName, setRealName] = useState(initial?.realName ?? "");
  const [rankId, setRankId] = useState(initial?.rankId ?? ranks[0]?.rankId ?? "");
  const [mos, setMos] = useState(initial?.mos ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const rank = ranks.find((r) => r.rankId === rankId);
    if (!realName.trim() || !rank) return;
    onSubmit({
      realName: realName.trim(),
      rankId: rank.rankId,
      rankShort: rank.rankShort,
      rankFull: rank.rankFull,
      mos: mos.trim(),
    });
  }

  return (
    <div className="soldier-form-backdrop" onClick={onCancel}>
      <form className="soldier-form" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>{title}</h3>
        <label>
          Real name
          <input value={realName} onChange={(e) => setRealName(e.target.value)} autoFocus />
        </label>
        <label>
          Rank
          <select value={rankId} onChange={(e) => setRankId(e.target.value)}>
            {ranks.map((r) => (
              <option key={r.rankId} value={r.rankId}>
                {r.rankFull}
              </option>
            ))}
          </select>
        </label>
        <label>
          MOS
          <input value={mos} onChange={(e) => setMos(e.target.value)} placeholder="e.g. 11B" />
        </label>
        <div className="soldier-form-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={!realName.trim()}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
