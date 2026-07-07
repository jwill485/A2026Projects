import type { Battalion, Company, Platoon, Soldier, SplitStatus, Squad } from "../types/roster";
import {
  companyHasMatch,
  EMPTY_FILTER,
  isFilterActive,
  matchesSoldier,
  platoonHasMatch,
  squadHasMatch,
  type RosterFilter,
} from "../lib/filterRoster";
import { SplitStatusToggle } from "./SplitStatusToggle";
import "./RosterTree.css";

type SetSplitStatus = (userId: string, status: SplitStatus) => void;

function noopSetSplitStatus() {}

function SoldierName({
  soldier,
  filter,
  onSetSplitStatus,
}: {
  soldier: Soldier | null;
  filter: RosterFilter;
  onSetSplitStatus: SetSplitStatus;
}) {
  if (!soldier) {
    return <span className={`vacant${filter.vacantOnly ? " filter-match" : ""}`}>VACANT</span>;
  }
  const matched = isFilterActive(filter) && matchesSoldier(soldier, filter);
  return (
    <span className={`soldier-name${matched ? " filter-match" : ""}`}>
      {soldier.rankShort} {soldier.realName}
      <span className="soldier-username"> ({soldier.username})</span>
      <SplitStatusToggle
        status={soldier.splitStatus ?? "neutral"}
        onChange={(next) => onSetSplitStatus(soldier.userId, next)}
      />
    </span>
  );
}

function SquadNode({
  squad,
  filter,
  onSetSplitStatus,
}: {
  squad: Squad;
  filter: RosterFilter;
  onSetSplitStatus: SetSplitStatus;
}) {
  return (
    <details className="tree-node squad-node" open>
      <summary>
        Squad {squad.number} — Leader:{" "}
        <SoldierName soldier={squad.leader} filter={filter} onSetSplitStatus={onSetSplitStatus} />
        <span className="count-badge">{squad.members.length + (squad.leader ? 1 : 0)}</span>
      </summary>
      <ul className="member-list">
        {squad.members.map((member) => (
          <li key={member.userId}>
            <SoldierName soldier={member} filter={filter} onSetSplitStatus={onSetSplitStatus} />
          </li>
        ))}
        {squad.members.length === 0 && <li className="vacant">No additional squad members</li>}
      </ul>
    </details>
  );
}

function PlatoonNode({
  platoon,
  filter,
  onSetSplitStatus,
}: {
  platoon: Platoon;
  filter: RosterFilter;
  onSetSplitStatus: SetSplitStatus;
}) {
  const total = platoon.squads.reduce(
    (sum, s) => sum + s.members.length + (s.leader ? 1 : 0),
    0,
  );
  const squads = isFilterActive(filter)
    ? platoon.squads.filter((s) => squadHasMatch(s, filter))
    : platoon.squads;
  return (
    <details className="tree-node platoon-node" open>
      <summary>
        Platoon {platoon.number} — PL:{" "}
        <SoldierName soldier={platoon.leader} filter={filter} onSetSplitStatus={onSetSplitStatus} /> | PSG:{" "}
        <SoldierName soldier={platoon.sergeant} filter={filter} onSetSplitStatus={onSetSplitStatus} />
        <span className="count-badge">{total}</span>
      </summary>
      {squads.map((squad) => (
        <SquadNode key={squad.number} squad={squad} filter={filter} onSetSplitStatus={onSetSplitStatus} />
      ))}
      {platoon.squads.length === 0 && <p className="vacant">No squads on record</p>}
    </details>
  );
}

function CompanyNode({
  company,
  title,
  filter,
  onSetSplitStatus,
}: {
  company: Company;
  title?: string;
  filter: RosterFilter;
  onSetSplitStatus: SetSplitStatus;
}) {
  const total = company.platoons.reduce(
    (sum, p) =>
      sum + p.squads.reduce((s2, sq) => s2 + sq.members.length + (sq.leader ? 1 : 0), 0),
    0,
  );
  const platoons = isFilterActive(filter)
    ? company.platoons.filter((p) => platoonHasMatch(p, filter))
    : company.platoons;
  return (
    <details className="tree-node company-node" open>
      <summary>
        {title ?? `${company.name} Company (${company.letter})`} — CO:{" "}
        <SoldierName soldier={company.commander} filter={filter} onSetSplitStatus={onSetSplitStatus} />
        <span className="count-badge">{total}</span>
      </summary>
      <div className="company-hq-row">
        XO: <SoldierName soldier={company.executiveOfficer} filter={filter} onSetSplitStatus={onSetSplitStatus} /> |{" "}
        1SG: <SoldierName soldier={company.firstSergeant} filter={filter} onSetSplitStatus={onSetSplitStatus} />
      </div>
      {platoons.map((platoon) => (
        <PlatoonNode key={platoon.number} platoon={platoon} filter={filter} onSetSplitStatus={onSetSplitStatus} />
      ))}
      {company.platoons.length === 0 && <p className="vacant">No platoons on record</p>}
    </details>
  );
}

export function RosterTree({
  battalion,
  filter = EMPTY_FILTER,
  onSetSplitStatus = noopSetSplitStatus,
}: {
  battalion: Battalion;
  filter?: RosterFilter;
  onSetSplitStatus?: SetSplitStatus;
}) {
  const companies = isFilterActive(filter)
    ? battalion.companies.filter((c) => companyHasMatch(c, filter))
    : battalion.companies;
  return (
    <details className="tree-node battalion-node" open>
      <summary>
        {battalion.designation} Cavalry Battalion — CO:{" "}
        <SoldierName soldier={battalion.commander} filter={filter} onSetSplitStatus={onSetSplitStatus} />
      </summary>
      <div className="company-hq-row">
        XO: <SoldierName soldier={battalion.executiveOfficer} filter={filter} onSetSplitStatus={onSetSplitStatus} /> |{" "}
        SGM: <SoldierName soldier={battalion.sergeantMajor} filter={filter} onSetSplitStatus={onSetSplitStatus} />
      </div>
      {companies.map((company) => (
        <CompanyNode key={company.letter} company={company} filter={filter} onSetSplitStatus={onSetSplitStatus} />
      ))}
    </details>
  );
}

export function UnassignedPool({
  group,
  filter = EMPTY_FILTER,
  onSetSplitStatus = noopSetSplitStatus,
}: {
  group: Company;
  filter?: RosterFilter;
  onSetSplitStatus?: SetSplitStatus;
}) {
  const hasAnyone =
    group.commander ||
    group.executiveOfficer ||
    group.firstSergeant ||
    group.platoons.length > 0;
  if (!hasAnyone) return null;
  if (isFilterActive(filter) && !companyHasMatch(group, filter)) return null;
  return (
    <div className="unassigned-pool">
      <h3>Unassigned</h3>
      <p className="unassigned-hint">
        From B/ACD — pending manual reassignment into Charlie Company. Structure shown as
        currently organized within B/ACD.
      </p>
      <CompanyNode company={group} title="B/ACD" filter={filter} onSetSplitStatus={onSetSplitStatus} />
    </div>
  );
}
