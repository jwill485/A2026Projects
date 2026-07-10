import { useState } from "react";
import type { Battalion, Company, Platoon, Soldier, Squad } from "../types/roster";
import "./OrgChart.css";

function troopLabel(soldier: Soldier | null): string {
  return soldier ? `${soldier.rankShort} ${soldier.realName}` : "VACANT";
}

function collectSquadKeys(company: Company): string[] {
  const keys: string[] = [];
  for (const platoon of company.platoons) {
    for (const squad of platoon.squads) {
      if (squad.members.length > 0) keys.push(`${company.letter}-${platoon.number}-${squad.number}`);
    }
  }
  return keys;
}

function SquadBox({
  squad,
  squadKey,
  expanded,
  onToggle,
}: {
  squad: Squad;
  squadKey: string;
  expanded: boolean;
  onToggle: (key: string) => void;
}) {
  return (
    <li>
      <div className="chart-node chart-squad">
        <div className="chart-title">Squad {squad.number}</div>
        <div className="chart-role">Leader: {troopLabel(squad.leader)}</div>
        {squad.assistantLeader && <div className="chart-role">Asst: {troopLabel(squad.assistantLeader)}</div>}
        {squad.members.length > 0 && (
          <button type="button" className="chart-toggle" onClick={() => onToggle(squadKey)}>
            {expanded ? "Hide" : "Show"} {squad.members.length} member{squad.members.length === 1 ? "" : "s"}
          </button>
        )}
        {expanded && squad.members.length > 0 && (
          <ul className="chart-roster">
            {squad.members.map((m) => (
              <li key={m.userId}>{troopLabel(m)}</li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function PlatoonBox({
  platoon,
  keyPrefix,
  expandedSquads,
  onToggleSquad,
}: {
  platoon: Platoon;
  keyPrefix: string;
  expandedSquads: Set<string>;
  onToggleSquad: (key: string) => void;
}) {
  return (
    <li>
      <div className="chart-node chart-platoon">
        <div className="chart-title">Platoon {platoon.number}</div>
        <div className="chart-role">PL: {troopLabel(platoon.leader)}</div>
        <div className="chart-role">PSG: {troopLabel(platoon.sergeant)}</div>
      </div>
      {platoon.squads.length > 0 && (
        <ul className="org-branch">
          {platoon.squads.map((squad) => {
            const squadKey = `${keyPrefix}-${platoon.number}-${squad.number}`;
            return (
              <SquadBox
                key={squad.number}
                squad={squad}
                squadKey={squadKey}
                expanded={expandedSquads.has(squadKey)}
                onToggle={onToggleSquad}
              />
            );
          })}
        </ul>
      )}
    </li>
  );
}

function CompanyBox({
  company,
  expandedSquads,
  onToggleSquad,
}: {
  company: Company;
  expandedSquads: Set<string>;
  onToggleSquad: (key: string) => void;
}) {
  const isUnassigned = company.letter === "UNASSIGNED";
  return (
    <li>
      <div className={`chart-node chart-company${isUnassigned ? " chart-unassigned" : ""}`}>
        <div className="chart-title">
          {isUnassigned ? "Unassigned" : `${company.name} Company (${company.letter})`}
        </div>
        <div className="chart-role">CO: {troopLabel(company.commander)}</div>
        <div className="chart-role">XO: {troopLabel(company.executiveOfficer)}</div>
        <div className="chart-role">1SG: {troopLabel(company.firstSergeant)}</div>
      </div>
      {company.platoons.length > 0 && (
        <ul className="org-branch">
          {company.platoons.map((platoon) => (
            <PlatoonBox
              key={platoon.number}
              platoon={platoon}
              keyPrefix={company.letter}
              expandedSquads={expandedSquads}
              onToggleSquad={onToggleSquad}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function OrgChart({ battalion, unassigned }: { battalion: Battalion; unassigned: Company }) {
  const [expandedSquads, setExpandedSquads] = useState<Set<string>>(new Set());

  function toggleSquad(key: string) {
    setExpandedSquads((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const hasUnassigned =
    unassigned.commander ||
    unassigned.executiveOfficer ||
    unassigned.firstSergeant ||
    unassigned.platoons.length > 0;

  const allSquadKeys = [
    ...battalion.companies.flatMap(collectSquadKeys),
    ...(hasUnassigned ? collectSquadKeys(unassigned) : []),
  ];

  return (
    <div>
      {allSquadKeys.length > 0 && (
        <div className="org-chart-toolbar">
          <button type="button" onClick={() => setExpandedSquads(new Set(allSquadKeys))}>
            Expand All
          </button>
          <button type="button" onClick={() => setExpandedSquads(new Set())}>
            Collapse All
          </button>
        </div>
      )}
      <div className="org-chart-scroll">
        <ul className="org-branch org-chart">
          <li>
            <div className="chart-node chart-battalion">
              <div className="chart-title">{battalion.designation} Cavalry Battalion</div>
              <div className="chart-role">CO: {troopLabel(battalion.commander)}</div>
              <div className="chart-role">XO: {troopLabel(battalion.executiveOfficer)}</div>
              <div className="chart-role">SGM: {troopLabel(battalion.sergeantMajor)}</div>
            </div>
            {(battalion.companies.length > 0 || hasUnassigned) && (
              <ul className="org-branch">
                {battalion.companies.map((company) => (
                  <CompanyBox
                    key={company.letter}
                    company={company}
                    expandedSquads={expandedSquads}
                    onToggleSquad={toggleSquad}
                  />
                ))}
                {hasUnassigned && (
                  <CompanyBox company={unassigned} expandedSquads={expandedSquads} onToggleSquad={toggleSquad} />
                )}
              </ul>
            )}
          </li>
        </ul>
      </div>
    </div>
  );
}
