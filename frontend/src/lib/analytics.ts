import type { Company, RosterData, Soldier } from "../types/roster";

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

function collectCompanySoldiers(company: Company): Soldier[] {
  const soldiers: Soldier[] = [];
  if (company.commander) soldiers.push(company.commander);
  if (company.executiveOfficer) soldiers.push(company.executiveOfficer);
  if (company.firstSergeant) soldiers.push(company.firstSergeant);
  for (const platoon of company.platoons) {
    if (platoon.leader) soldiers.push(platoon.leader);
    if (platoon.sergeant) soldiers.push(platoon.sergeant);
    for (const squad of platoon.squads) {
      if (squad.leader) soldiers.push(squad.leader);
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
