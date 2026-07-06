import { useEffect, useState } from "react";
import { fetchCombatRoster, fetchRanks } from "../lib/api";
import { buildRosterData } from "../lib/buildRoster";
import { describeSoldierLocations, type LocationInfo } from "../lib/changelog";
import type { Company, Soldier } from "../types/roster";
import "./SoldierForm.css";
import "./ImportSoldierPicker.css";

const UNASSIGNED_LETTER = "UNASSIGNED";

function companyLabel(company: Company): string {
  return company.letter === UNASSIGNED_LETTER
    ? "Unassigned (B/ACD)"
    : `${company.name} Company (${company.letter})`;
}

function countCompanySoldiers(company: Company): number {
  let count = 0;
  if (company.commander) count += 1;
  if (company.executiveOfficer) count += 1;
  if (company.firstSergeant) count += 1;
  for (const platoon of company.platoons) {
    if (platoon.leader) count += 1;
    if (platoon.sergeant) count += 1;
    for (const squad of platoon.squads) {
      if (squad.leader) count += 1;
      count += squad.members.length;
    }
  }
  return count;
}

function withOriginLabels(company: Company, locations: Map<string, LocationInfo>): Company {
  const tag = (s: Soldier | null): Soldier | null =>
    s ? { ...s, originLabel: locations.get(s.userId)?.label } : s;
  return {
    ...company,
    commander: tag(company.commander),
    executiveOfficer: tag(company.executiveOfficer),
    firstSergeant: tag(company.firstSergeant),
    platoons: company.platoons.map((platoon) => ({
      ...platoon,
      leader: tag(platoon.leader),
      sergeant: tag(platoon.sergeant),
      squads: platoon.squads.map((squad) => ({
        ...squad,
        leader: tag(squad.leader),
        members: squad.members.map((m) => ({ ...m, originLabel: locations.get(m.userId)?.label })),
      })),
    })),
  };
}

export function ImportCompanyPicker({
  existingLetters,
  onImport,
  onClose,
}: {
  existingLetters: Set<string>;
  onImport: (company: Company) => boolean;
  onClose: () => void;
}) {
  const [candidates, setCandidates] = useState<Company[] | null>(null);
  const [locations, setLocations] = useState<Map<string, LocationInfo>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [importedLetters, setImportedLetters] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCombatRoster(), fetchRanks()])
      .then(([apiRoster, ranksResponse]) => {
        if (cancelled) return;
        const order = new Map(
          ranksResponse.ranks.map((rank) => [rank.rankId, rank.rankDisplayOrder]),
        );
        const live = buildRosterData(apiRoster, order);
        setCandidates([...live.battalion.companies, live.unassigned]);
        setLocations(describeSoldierLocations(live));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleImport(company: Company) {
    const added = onImport(withOriginLabels(company, locations));
    if (added) setImportedLetters((prev) => new Set(prev).add(company.letter));
  }

  return (
    <div className="soldier-form-backdrop" onClick={onClose}>
      <div className="import-picker" onClick={(e) => e.stopPropagation()}>
        <h3>Import Company from 2-7</h3>
        {error && <p className="vacant">Failed to load live roster: {error}</p>}
        {!error && !candidates && <p>Loading live roster…</p>}
        {candidates && (
          <ul className="import-list">
            {candidates.map((company) => {
              // The Unassigned/B-ACD group shares its letter with every
              // roster's own (always-present) Unassigned pool, so letter
              // presence can't signal "already imported" for it the way it
              // does for a real company — only this modal session's own
              // import tracks that.
              const isImported =
                company.letter === UNASSIGNED_LETTER
                  ? importedLetters.has(company.letter)
                  : existingLetters.has(company.letter) || importedLetters.has(company.letter);
              return (
                <li key={company.letter} className="import-row">
                  <span className="import-name">{companyLabel(company)}</span>
                  <span className="import-unit">{countCompanySoldiers(company)} troopers</span>
                  <button disabled={isImported} onClick={() => handleImport(company)}>
                    {isImported ? "Imported" : "Import"}
                  </button>
                </li>
              );
            })}
            {candidates.length === 0 && <li className="vacant">No companies available.</li>}
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
