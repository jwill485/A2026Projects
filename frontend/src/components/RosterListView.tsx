import { useEffect } from "react";
import type { Battalion, Company, Platoon, Soldier, Squad } from "../types/roster";
import "./RosterListView.css";

function troopLabel(soldier: Soldier | null): string {
  return soldier ? `${soldier.rankShort} ${soldier.realName}` : "VACANT";
}

function SquadLines({ squad }: { squad: Squad }) {
  return (
    <li className="list-squad">
      Squad {squad.number} — Leader: {troopLabel(squad.leader)}
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

function PlatoonLines({ platoon }: { platoon: Platoon }) {
  return (
    <li className="list-platoon">
      Platoon {platoon.number} — PL: {troopLabel(platoon.leader)} | PSG: {troopLabel(platoon.sergeant)}
      {platoon.squads.length > 0 && (
        <ul className="list-squads">
          {platoon.squads.map((squad) => (
            <SquadLines key={squad.number} squad={squad} />
          ))}
        </ul>
      )}
    </li>
  );
}

function CompanyLines({ company }: { company: Company }) {
  const isUnassigned = company.letter === "UNASSIGNED";
  return (
    <li className="list-company">
      <div className="list-company-title">
        {isUnassigned ? "Unassigned (B/ACD)" : `${company.name} Company (${company.letter})`}
      </div>
      <div>CO: {troopLabel(company.commander)}</div>
      <div>XO: {troopLabel(company.executiveOfficer)}</div>
      <div>1SG: {troopLabel(company.firstSergeant)}</div>
      {company.platoons.length > 0 && (
        <ul className="list-platoons">
          {company.platoons.map((platoon) => (
            <PlatoonLines key={platoon.number} platoon={platoon} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function RosterListView({ battalion, unassigned }: { battalion: Battalion; unassigned: Company }) {
  useEffect(() => {
    document.documentElement.classList.add("roster-list-printing");
    return () => document.documentElement.classList.remove("roster-list-printing");
  }, []);

  const hasUnassigned =
    unassigned.commander ||
    unassigned.executiveOfficer ||
    unassigned.firstSergeant ||
    unassigned.platoons.length > 0;

  return (
    <div className="roster-list-view">
      <div className="list-battalion-title">{battalion.designation} Cavalry Battalion</div>
      <div>CO: {troopLabel(battalion.commander)}</div>
      <div>XO: {troopLabel(battalion.executiveOfficer)}</div>
      <div>SGM: {troopLabel(battalion.sergeantMajor)}</div>
      <ul className="list-companies">
        {battalion.companies.map((company) => (
          <CompanyLines key={company.letter} company={company} />
        ))}
        {hasUnassigned && <CompanyLines company={unassigned} />}
      </ul>
    </div>
  );
}
