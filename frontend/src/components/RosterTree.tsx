import type { Battalion, Company, Platoon, Soldier, Squad } from "../types/roster";
import "./RosterTree.css";

function SoldierName({ soldier }: { soldier: Soldier | null }) {
  if (!soldier) return <span className="vacant">VACANT</span>;
  return (
    <span className="soldier-name">
      {soldier.rankShort} {soldier.realName}
      <span className="soldier-username"> ({soldier.username})</span>
    </span>
  );
}

function SquadNode({ squad }: { squad: Squad }) {
  return (
    <details className="tree-node squad-node" open>
      <summary>
        Squad {squad.number} — Leader: <SoldierName soldier={squad.leader} />
        <span className="count-badge">{squad.members.length + (squad.leader ? 1 : 0)}</span>
      </summary>
      <ul className="member-list">
        {squad.members.map((member) => (
          <li key={member.userId}>
            <SoldierName soldier={member} />
          </li>
        ))}
        {squad.members.length === 0 && <li className="vacant">No additional squad members</li>}
      </ul>
    </details>
  );
}

function PlatoonNode({ platoon }: { platoon: Platoon }) {
  const total = platoon.squads.reduce(
    (sum, s) => sum + s.members.length + (s.leader ? 1 : 0),
    0,
  );
  return (
    <details className="tree-node platoon-node" open>
      <summary>
        Platoon {platoon.number} — PL: <SoldierName soldier={platoon.leader} /> | PSG:{" "}
        <SoldierName soldier={platoon.sergeant} />
        <span className="count-badge">{total}</span>
      </summary>
      {platoon.squads.map((squad) => (
        <SquadNode key={squad.number} squad={squad} />
      ))}
      {platoon.squads.length === 0 && <p className="vacant">No squads on record</p>}
    </details>
  );
}

function CompanyNode({ company, title }: { company: Company; title?: string }) {
  const total = company.platoons.reduce(
    (sum, p) =>
      sum + p.squads.reduce((s2, sq) => s2 + sq.members.length + (sq.leader ? 1 : 0), 0),
    0,
  );
  return (
    <details className="tree-node company-node" open>
      <summary>
        {title ?? `${company.name} Company (${company.letter})`} — CO:{" "}
        <SoldierName soldier={company.commander} />
        <span className="count-badge">{total}</span>
      </summary>
      <div className="company-hq-row">
        XO: <SoldierName soldier={company.executiveOfficer} /> | 1SG:{" "}
        <SoldierName soldier={company.firstSergeant} />
      </div>
      {company.platoons.map((platoon) => (
        <PlatoonNode key={platoon.number} platoon={platoon} />
      ))}
      {company.platoons.length === 0 && <p className="vacant">No platoons on record</p>}
    </details>
  );
}

export function RosterTree({ battalion }: { battalion: Battalion }) {
  return (
    <details className="tree-node battalion-node" open>
      <summary>
        {battalion.designation} Cavalry Battalion — CO: <SoldierName soldier={battalion.commander} />
      </summary>
      <div className="company-hq-row">
        XO: <SoldierName soldier={battalion.executiveOfficer} /> | SGM:{" "}
        <SoldierName soldier={battalion.sergeantMajor} />
      </div>
      {battalion.companies.map((company) => (
        <CompanyNode key={company.letter} company={company} />
      ))}
    </details>
  );
}

export function UnassignedPool({ group }: { group: Company }) {
  const hasAnyone =
    group.commander ||
    group.executiveOfficer ||
    group.firstSergeant ||
    group.platoons.length > 0;
  if (!hasAnyone) return null;
  return (
    <div className="unassigned-pool">
      <h3>Unassigned</h3>
      <p className="unassigned-hint">
        From B/ACD — pending manual reassignment into Charlie Company. Structure shown as
        currently organized within B/ACD.
      </p>
      <CompanyNode company={group} title="B/ACD" />
    </div>
  );
}
