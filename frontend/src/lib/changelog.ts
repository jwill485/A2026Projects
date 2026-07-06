import type { Company, RosterData, Soldier } from "../types/roster";

export interface LocationInfo {
  label: string;
  soldier: Soldier;
}

function describeCompany(company: Company, map: Map<string, LocationInfo>): void {
  const companyLabel =
    company.letter === "UNASSIGNED" ? "Unassigned" : `${company.name} (${company.letter})`;
  if (company.commander)
    map.set(company.commander.userId, {
      label: `${companyLabel} — Commander`,
      soldier: company.commander,
    });
  if (company.executiveOfficer)
    map.set(company.executiveOfficer.userId, {
      label: `${companyLabel} — Executive Officer`,
      soldier: company.executiveOfficer,
    });
  if (company.firstSergeant)
    map.set(company.firstSergeant.userId, {
      label: `${companyLabel} — First Sergeant`,
      soldier: company.firstSergeant,
    });
  for (const platoon of company.platoons) {
    if (platoon.leader)
      map.set(platoon.leader.userId, {
        label: `${companyLabel} — Platoon ${platoon.number} Leader`,
        soldier: platoon.leader,
      });
    if (platoon.sergeant)
      map.set(platoon.sergeant.userId, {
        label: `${companyLabel} — Platoon ${platoon.number} Sergeant`,
        soldier: platoon.sergeant,
      });
    for (const squad of platoon.squads) {
      if (squad.leader)
        map.set(squad.leader.userId, {
          label: `${companyLabel} — Platoon ${platoon.number} / Squad ${squad.number} Leader`,
          soldier: squad.leader,
        });
      for (const member of squad.members) {
        map.set(member.userId, {
          label: `${companyLabel} — Platoon ${platoon.number} / Squad ${squad.number} Member`,
          soldier: member,
        });
      }
    }
  }
}

export function describeSoldierLocations(roster: RosterData): Map<string, LocationInfo> {
  const map = new Map<string, LocationInfo>();
  if (roster.battalion.commander)
    map.set(roster.battalion.commander.userId, {
      label: "Battalion HQ — Commander",
      soldier: roster.battalion.commander,
    });
  if (roster.battalion.executiveOfficer)
    map.set(roster.battalion.executiveOfficer.userId, {
      label: "Battalion HQ — Executive Officer",
      soldier: roster.battalion.executiveOfficer,
    });
  if (roster.battalion.sergeantMajor)
    map.set(roster.battalion.sergeantMajor.userId, {
      label: "Battalion HQ — Sergeant Major",
      soldier: roster.battalion.sergeantMajor,
    });
  for (const company of roster.battalion.companies) describeCompany(company, map);
  describeCompany(roster.unassigned, map);
  return map;
}

function soldierLabel(soldier: Soldier): string {
  return soldier.username
    ? `${soldier.rankShort} ${soldier.realName} (${soldier.username})`
    : `${soldier.rankShort} ${soldier.realName}`;
}

export function diffRosters(baseline: RosterData, current: RosterData): string[] {
  const before = describeSoldierLocations(baseline);
  const after = describeSoldierLocations(current);
  const lines: string[] = [];
  const allIds = new Set([...before.keys(), ...after.keys()]);
  for (const id of allIds) {
    const b = before.get(id);
    const a = after.get(id);
    if (b && a && b.label !== a.label) {
      lines.push(`${soldierLabel(a.soldier)}: ${b.label} → ${a.label}`);
    } else if (!b && a) {
      const origin = a.soldier.originLabel;
      lines.push(
        origin
          ? `${soldierLabel(a.soldier)}: from ${origin} → ${a.label}`
          : `${soldierLabel(a.soldier)}: (new) → ${a.label}`,
      );
    } else if (b && !a) {
      lines.push(`${soldierLabel(b.soldier)}: ${b.label} → (removed from roster)`);
    }
  }
  return lines.sort();
}
