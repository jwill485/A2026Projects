import type { Company, Platoon, Soldier, Squad } from "../types/roster";

export interface RosterFilter {
  text: string;
  rank: string;
  mos: string;
  vacantOnly: boolean;
}

export const EMPTY_FILTER: RosterFilter = { text: "", rank: "", mos: "", vacantOnly: false };

export function isFilterActive(filter: RosterFilter): boolean {
  return filter.text.trim() !== "" || filter.rank.trim() !== "" || filter.mos.trim() !== "" || filter.vacantOnly;
}

function hasSoldierCriteria(filter: RosterFilter): boolean {
  return filter.text.trim() !== "" || filter.rank.trim() !== "" || filter.mos.trim() !== "";
}

export function matchesSoldier(soldier: Soldier, filter: RosterFilter): boolean {
  if (!hasSoldierCriteria(filter)) return false;
  const text = filter.text.trim().toLowerCase();
  if (text && !soldier.realName.toLowerCase().includes(text) && !soldier.username.toLowerCase().includes(text)) {
    return false;
  }
  if (filter.rank && soldier.rankShort !== filter.rank) return false;
  if (filter.mos && soldier.mos !== filter.mos) return false;
  return true;
}

function slotMatches(soldier: Soldier | null, filter: RosterFilter): boolean {
  return soldier ? matchesSoldier(soldier, filter) : filter.vacantOnly;
}

export function squadHasMatch(squad: Squad, filter: RosterFilter): boolean {
  return slotMatches(squad.leader, filter) || squad.members.some((m) => matchesSoldier(m, filter));
}

export function platoonHasMatch(platoon: Platoon, filter: RosterFilter): boolean {
  return (
    slotMatches(platoon.leader, filter) ||
    slotMatches(platoon.sergeant, filter) ||
    platoon.squads.some((s) => squadHasMatch(s, filter))
  );
}

export function companyHasMatch(company: Company, filter: RosterFilter): boolean {
  return (
    slotMatches(company.commander, filter) ||
    slotMatches(company.executiveOfficer, filter) ||
    slotMatches(company.firstSergeant, filter) ||
    company.platoons.some((p) => platoonHasMatch(p, filter))
  );
}
