import { useEffect, useState } from "react";
import { fetchCombatRoster, fetchRanks } from "../lib/api";
import { buildRosterData } from "../lib/buildRoster";
import { collectAllSoldiers } from "../lib/analytics";
import { describeSoldierLocations } from "../lib/changelog";
import type { Soldier } from "../types/roster";
import "./SoldierForm.css";
import "./ImportSoldierPicker.css";

export function ImportSoldierPicker({
  existingIds,
  onImport,
  onClose,
}: {
  existingIds: Set<string>;
  onImport: (soldier: Soldier) => boolean;
  onClose: () => void;
}) {
  const [candidates, setCandidates] = useState<{ soldier: Soldier; unit: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCombatRoster(), fetchRanks()])
      .then(([apiRoster, ranksResponse]) => {
        if (cancelled) return;
        const order = new Map(
          ranksResponse.ranks.map((rank) => [rank.rankId, rank.rankDisplayOrder]),
        );
        const live = buildRosterData(apiRoster, order);
        const locations = describeSoldierLocations(live);
        const soldiers = collectAllSoldiers(live).map((soldier) => ({
          soldier,
          unit: locations.get(soldier.userId)?.label ?? "Unknown",
        }));
        soldiers.sort((a, b) => a.soldier.realName.localeCompare(b.soldier.realName));
        setCandidates(soldiers);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered =
    candidates?.filter(({ soldier, unit }) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        soldier.realName.toLowerCase().includes(q) ||
        soldier.username.toLowerCase().includes(q) ||
        unit.toLowerCase().includes(q)
      );
    }) ?? [];

  function handleAdd(soldier: Soldier, unit: string) {
    const added = onImport({ ...soldier, originLabel: unit });
    if (added) setAddedIds((prev) => new Set(prev).add(soldier.userId));
  }

  return (
    <div className="soldier-form-backdrop" onClick={onClose}>
      <div className="import-picker" onClick={(e) => e.stopPropagation()}>
        <h3>Import from 2-7 / B-ACD</h3>
        <input
          className="import-search"
          placeholder="Search by name or unit…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        {error && <p className="vacant">Failed to load live roster: {error}</p>}
        {!error && !candidates && <p>Loading live roster…</p>}
        {candidates && (
          <ul className="import-list">
            {filtered.map(({ soldier, unit }) => {
              const isAdded = existingIds.has(soldier.userId) || addedIds.has(soldier.userId);
              return (
                <li key={soldier.userId} className="import-row">
                  <span className="import-name">
                    {soldier.rankShort} {soldier.realName}
                    {soldier.username && <span className="soldier-username"> ({soldier.username})</span>}
                  </span>
                  <span className="import-unit">{unit}</span>
                  <button disabled={isAdded} onClick={() => handleAdd(soldier, unit)}>
                    {isAdded ? "Added" : "Add"}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="vacant">No matches.</li>}
          </ul>
        )}
        <div className="soldier-form-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
