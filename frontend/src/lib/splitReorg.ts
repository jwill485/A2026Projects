import type { Battalion, Company, Platoon, RosterData, Soldier, SplitStatus, Squad } from "../types/roster";

function keep(soldier: Soldier | null, status: SplitStatus): Soldier | null {
  return soldier && soldier.splitStatus === status ? soldier : null;
}

function buildSquad(squad: Squad, status: SplitStatus): Squad {
  return {
    number: squad.number,
    leader: keep(squad.leader, status),
    members: squad.members.filter((m) => m.splitStatus === status),
  };
}

function buildPlatoon(platoon: Platoon, status: SplitStatus): Platoon {
  return {
    number: platoon.number,
    leader: keep(platoon.leader, status),
    sergeant: keep(platoon.sergeant, status),
    squads: platoon.squads.map((s) => buildSquad(s, status)),
  };
}

function buildCompany(company: Company, status: SplitStatus): Company {
  return {
    letter: company.letter,
    name: company.name,
    commander: keep(company.commander, status),
    executiveOfficer: keep(company.executiveOfficer, status),
    firstSergeant: keep(company.firstSergeant, status),
    platoons: company.platoons.map((p) => buildPlatoon(p, status)),
  };
}

// Builds a new roster containing only the troopers tagged for the given
// split destination, preserving the full company/platoon/squad structure
// (untagged slots come through vacant) so the shape of the new battalion is
// visible even before everyone's been decided.
export function buildSplitRoster(source: RosterData, status: SplitStatus): RosterData {
  const battalion: Battalion = {
    designation: source.battalion.designation,
    commander: keep(source.battalion.commander, status),
    executiveOfficer: keep(source.battalion.executiveOfficer, status),
    sergeantMajor: keep(source.battalion.sergeantMajor, status),
    companies: source.battalion.companies.map((c) => buildCompany(c, status)),
  };
  return { battalion, unassigned: buildCompany(source.unassigned, status) };
}
