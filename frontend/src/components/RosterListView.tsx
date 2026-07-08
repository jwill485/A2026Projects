import { useEffect, useState } from "react";
import type { Battalion, Company, Platoon, Soldier, Squad } from "../types/roster";
import {
  filterCompanyForScope,
  keepInScope,
  rosterToRows,
  toCsvText,
  SCOPE_OPTIONS,
  type ListScope,
} from "../lib/rosterExport";
import "./RosterListView.css";

function troopLabel(soldier: Soldier | null): string {
  return soldier ? `${soldier.rankShort} ${soldier.realName}` : "VACANT";
}

// In a scope-filtered view, an empty slot means "occupant didn't match the
// filter", not "billet is vacant" — so those lines are dropped instead of
// printing a misleading VACANT.
function BilletLine({ label, soldier, hideVacant }: { label: string; soldier: Soldier | null; hideVacant: boolean }) {
  if (hideVacant && !soldier) return null;
  return (
    <div>
      {label}: {troopLabel(soldier)}
    </div>
  );
}

function SquadLines({ squad, hideVacant }: { squad: Squad; hideVacant: boolean }) {
  return (
    <li className="list-squad">
      Squad {squad.number}
      {(!hideVacant || squad.leader) && <> — Leader: {troopLabel(squad.leader)}</>}
      {squad.members.length > 0 && (
        <ul className="list-members">
          {squad.members.map((m) => (
            <li key={m.userId}>{troopLabel(m)}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

function PlatoonLines({ platoon, hideVacant }: { platoon: Platoon; hideVacant: boolean }) {
  const leaderParts = [
    !hideVacant || platoon.leader ? `PL: ${troopLabel(platoon.leader)}` : null,
    !hideVacant || platoon.sergeant ? `PSG: ${troopLabel(platoon.sergeant)}` : null,
  ].filter((p): p is string => p !== null);
  return (
    <li className="list-platoon">
      Platoon {platoon.number}
      {leaderParts.length > 0 && <> — {leaderParts.join(" | ")}</>}
      {platoon.squads.length > 0 && (
        <ul className="list-squads">
          {platoon.squads.map((squad) => (
            <SquadLines key={squad.number} squad={squad} hideVacant={hideVacant} />
          ))}
        </ul>
      )}
    </li>
  );
}

function CompanyLines({ company, hideVacant }: { company: Company; hideVacant: boolean }) {
  const isUnassigned = company.letter === "UNASSIGNED";
  return (
    <li className="list-company">
      <div className="list-company-title">
        {isUnassigned ? "Unassigned" : `${company.name} Company (${company.letter})`}
      </div>
      <BilletLine label="CO" soldier={company.commander} hideVacant={hideVacant} />
      <BilletLine label="XO" soldier={company.executiveOfficer} hideVacant={hideVacant} />
      <BilletLine label="1SG" soldier={company.firstSergeant} hideVacant={hideVacant} />
      {company.platoons.length > 0 && (
        <ul className="list-platoons">
          {company.platoons.map((platoon) => (
            <PlatoonLines key={platoon.number} platoon={platoon} hideVacant={hideVacant} />
          ))}
        </ul>
      )}
    </li>
  );
}

function downloadCsv(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function RosterListView({ battalion, unassigned }: { battalion: Battalion; unassigned: Company }) {
  const [companyFilter, setCompanyFilter] = useState<string>("ALL");
  const [scope, setScope] = useState<ListScope>("everyone");

  useEffect(() => {
    document.documentElement.classList.add("roster-list-printing");
    return () => document.documentElement.classList.remove("roster-list-printing");
  }, []);

  const hideVacant = scope !== "everyone";
  const showBattalionHq = companyFilter === "ALL";

  const selectedCompanies =
    companyFilter === "ALL"
      ? battalion.companies
      : battalion.companies.filter((c) => c.letter === companyFilter);
  const scopedCompanies = selectedCompanies
    .map((c) => filterCompanyForScope(c, scope))
    .filter((c): c is Company => c !== null);

  const hasUnassigned =
    unassigned.commander ||
    unassigned.executiveOfficer ||
    unassigned.firstSergeant ||
    unassigned.platoons.length > 0;
  const scopedUnassigned =
    (companyFilter === "ALL" || companyFilter === "UNASSIGNED") && hasUnassigned
      ? filterCompanyForScope(unassigned, scope)
      : null;

  const hqCommander = showBattalionHq ? keepInScope(battalion.commander, scope) : null;
  const hqXo = showBattalionHq ? keepInScope(battalion.executiveOfficer, scope) : null;
  const hqSgm = showBattalionHq ? keepInScope(battalion.sergeantMajor, scope) : null;

  function handleDownloadCsv() {
    const exportBattalion = showBattalionHq
      ? { ...battalion, commander: hqCommander, executiveOfficer: hqXo, sergeantMajor: hqSgm }
      : null;
    const companies = [...scopedCompanies, ...(scopedUnassigned ? [scopedUnassigned] : [])];
    const rows = rosterToRows(exportBattalion, companies);
    const parts = [battalion.designation || "roster"];
    if (companyFilter !== "ALL") parts.push(companyFilter);
    if (scope !== "everyone") parts.push(scope);
    const filename = `${parts.join("-").replace(/[^\w.-]+/g, "_")}-roster.csv`;
    downloadCsv(filename, toCsvText(rows));
  }

  return (
    <div className="roster-list-view">
      <div className="list-toolbar">
        <label>
          Show:{" "}
          <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
            <option value="ALL">Whole battalion</option>
            {battalion.companies.map((c) => (
              <option key={c.letter} value={c.letter}>
                {c.name} Company ({c.letter})
              </option>
            ))}
            {hasUnassigned && <option value="UNASSIGNED">Unassigned</option>}
          </select>
        </label>
        <label>
          Who:{" "}
          <select value={scope} onChange={(e) => setScope(e.target.value as ListScope)}>
            {SCOPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button className="add-btn" onClick={handleDownloadCsv}>
          Download CSV
        </button>
      </div>

      <div className="list-battalion-title">{battalion.designation} Cavalry Battalion</div>
      {showBattalionHq && (
        <>
          <BilletLine label="CO" soldier={hqCommander} hideVacant={hideVacant} />
          <BilletLine label="XO" soldier={hqXo} hideVacant={hideVacant} />
          <BilletLine label="SGM" soldier={hqSgm} hideVacant={hideVacant} />
        </>
      )}
      <ul className="list-companies">
        {scopedCompanies.map((company) => (
          <CompanyLines key={company.letter} company={company} hideVacant={hideVacant} />
        ))}
        {scopedUnassigned && <CompanyLines company={scopedUnassigned} hideVacant={hideVacant} />}
      </ul>
      {scopedCompanies.length === 0 && !scopedUnassigned && (
        <p className="list-empty">Nobody matches this filter.</p>
      )}
    </div>
  );
}
