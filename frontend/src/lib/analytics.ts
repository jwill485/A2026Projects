import type { Company, RosterData, Soldier, Squad } from "../types/roster";

export interface FillStat {
  label: string;
  filled: number;
  vacant: number;
}

export interface CountStat {
  label: string;
  value: number;
}

export interface VacancyEntry {
  label: string;
}

export function collectCompanySoldiers(company: Company): Soldier[] {
  const soldiers: Soldier[] = [];
  if (company.commander) soldiers.push(company.commander);
  if (company.executiveOfficer) soldiers.push(company.executiveOfficer);
  if (company.firstSergeant) soldiers.push(company.firstSergeant);
  for (const platoon of company.platoons) {
    if (platoon.leader) soldiers.push(platoon.leader);
    if (platoon.sergeant) soldiers.push(platoon.sergeant);
    for (const squad of platoon.squads) {
      if (squad.leader) soldiers.push(squad.leader);
      if (squad.assistantLeader) soldiers.push(squad.assistantLeader);
      soldiers.push(...squad.members);
    }
  }
  return soldiers;
}

export function collectAllSoldiers(roster: RosterData): Soldier[] {
  const soldiers: Soldier[] = [];
  if (roster.battalion.commander) soldiers.push(roster.battalion.commander);
  if (roster.battalion.executiveOfficer) soldiers.push(roster.battalion.executiveOfficer);
  if (roster.battalion.sergeantMajor) soldiers.push(roster.battalion.sergeantMajor);
  for (const company of roster.battalion.companies) {
    soldiers.push(...collectCompanySoldiers(company));
  }
  soldiers.push(...collectCompanySoldiers(roster.unassigned));
  return soldiers;
}

// MOS makeup of any group of people, most common first. Shared by the Split
// Planner's practice-times phase, the Drag & Drop unit-detail panel, and the
// build-suggestion engine.
export function computeMosBreakdown(people: Soldier[]): CountStat[] {
  const counts = new Map<string, number>();
  for (const soldier of people) {
    const mos = soldier.mos.trim() === "" ? "No MOS" : soldier.mos;
    counts.set(mos, (counts.get(mos) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value }));
}

// MOS makeup of one squad (leader + assistant leader + members).
export function computeSquadMos(squad: Squad): CountStat[] {
  return computeMosBreakdown([
    ...(squad.leader ? [squad.leader] : []),
    ...(squad.assistantLeader ? [squad.assistantLeader] : []),
    ...squad.members,
  ]);
}

// Every trooper's practice time, inherited from whichever squad they're
// currently in (unset if their squad has none, or they're in the pool).
// Shared by the click-to-assign candidate picker and the Drag & Drop pool.
export function practiceTimeByUser(roster: RosterData): Map<string, string> {
  const map = new Map<string, string>();
  for (const company of [...roster.battalion.companies, roster.unassigned]) {
    for (const platoon of company.platoons) {
      for (const squad of platoon.squads) {
        const time = (squad.practiceTime ?? "").trim();
        if (time === "") continue;
        if (squad.leader) map.set(squad.leader.userId, time);
        if (squad.assistantLeader) map.set(squad.assistantLeader.userId, time);
        for (const member of squad.members) map.set(member.userId, time);
      }
    }
  }
  return map;
}

export function computeLeadershipFillByCompany(roster: RosterData): FillStat[] {
  return roster.battalion.companies.map((company) => {
    const slots = [
      company.commander,
      company.executiveOfficer,
      company.firstSergeant,
      ...company.platoons.flatMap((p) => [p.leader, p.sergeant]),
      ...company.platoons.flatMap((p) => p.squads.map((s) => s.leader)),
    ];
    const filled = slots.filter((s) => s !== null).length;
    return {
      label: `${company.name} (${company.letter})`,
      filled,
      vacant: slots.length - filled,
    };
  });
}

export function computeHeadcountByCompany(roster: RosterData): CountStat[] {
  return roster.battalion.companies.map((company) => ({
    label: `${company.name} (${company.letter})`,
    value: collectCompanySoldiers(company).length,
  }));
}

export function computeMosDistribution(roster: RosterData): CountStat[] {
  const soldiers = collectAllSoldiers(roster);
  const counts = new Map<string, number>();
  for (const soldier of soldiers) {
    counts.set(soldier.mos, (counts.get(soldier.mos) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
}

export function computeVacancyReport(roster: RosterData): VacancyEntry[] {
  const entries: VacancyEntry[] = [];
  if (!roster.battalion.commander) entries.push({ label: "2-7 Battalion — Commanding Officer" });
  if (!roster.battalion.executiveOfficer) entries.push({ label: "2-7 Battalion — Executive Officer" });
  if (!roster.battalion.sergeantMajor) entries.push({ label: "2-7 Battalion — Sergeant Major" });

  for (const company of roster.battalion.companies) {
    const companyLabel = `${company.name} (${company.letter})`;
    if (!company.commander) entries.push({ label: `${companyLabel} — Commander` });
    if (!company.executiveOfficer) entries.push({ label: `${companyLabel} — Executive Officer` });
    if (!company.firstSergeant) entries.push({ label: `${companyLabel} — First Sergeant` });
    for (const platoon of company.platoons) {
      if (!platoon.leader)
        entries.push({ label: `${companyLabel} — Platoon ${platoon.number} Leader` });
      if (!platoon.sergeant)
        entries.push({ label: `${companyLabel} — Platoon ${platoon.number} Sergeant` });
      for (const squad of platoon.squads) {
        if (!squad.leader)
          entries.push({
            label: `${companyLabel} — Platoon ${platoon.number} / Squad ${squad.number} Leader`,
          });
      }
    }
  }
  return entries;
}
