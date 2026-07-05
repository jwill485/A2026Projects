import type { Company, Platoon, RosterData, Soldier } from "../types/roster";

export type SlotPath =
  | { kind: "battalionCommander" }
  | { kind: "battalionXO" }
  | { kind: "battalionSGM" }
  | { kind: "companyCommander"; company: string }
  | { kind: "companyXO"; company: string }
  | { kind: "company1SG"; company: string }
  | { kind: "platoonLeader"; company: string; platoon: string }
  | { kind: "platoonSergeant"; company: string; platoon: string }
  | { kind: "squadLeader"; company: string; platoon: string; squad: string }
  | { kind: "squadMember"; company: string; platoon: string; squad: string };

function allCompanies(roster: RosterData): Company[] {
  return [...roster.battalion.companies, roster.unassigned];
}

function findCompany(roster: RosterData, letter: string): Company | undefined {
  return allCompanies(roster).find((c) => c.letter === letter);
}

function findPlatoon(company: Company, number: string): Platoon | undefined {
  return company.platoons.find((p) => p.number === number);
}

function findSquad(platoon: Platoon, number: string) {
  return platoon.squads.find((s) => s.number === number);
}

export function isSlotOccupied(roster: RosterData, destination: SlotPath): boolean {
  switch (destination.kind) {
    case "battalionCommander":
      return roster.battalion.commander !== null;
    case "battalionXO":
      return roster.battalion.executiveOfficer !== null;
    case "battalionSGM":
      return roster.battalion.sergeantMajor !== null;
    case "companyCommander":
      return findCompany(roster, destination.company)?.commander != null;
    case "companyXO":
      return findCompany(roster, destination.company)?.executiveOfficer != null;
    case "company1SG":
      return findCompany(roster, destination.company)?.firstSergeant != null;
    case "platoonLeader": {
      const company = findCompany(roster, destination.company);
      const platoon = company && findPlatoon(company, destination.platoon);
      return platoon?.leader != null;
    }
    case "platoonSergeant": {
      const company = findCompany(roster, destination.company);
      const platoon = company && findPlatoon(company, destination.platoon);
      return platoon?.sergeant != null;
    }
    case "squadLeader": {
      const company = findCompany(roster, destination.company);
      const platoon = company && findPlatoon(company, destination.platoon);
      const squad = platoon && findSquad(platoon, destination.squad);
      return squad?.leader != null;
    }
    case "squadMember":
      return false;
  }
}

function removeFromCompany(company: Company, userId: string): Soldier | null {
  if (company.commander?.userId === userId) {
    const soldier = company.commander;
    company.commander = null;
    return soldier;
  }
  if (company.executiveOfficer?.userId === userId) {
    const soldier = company.executiveOfficer;
    company.executiveOfficer = null;
    return soldier;
  }
  if (company.firstSergeant?.userId === userId) {
    const soldier = company.firstSergeant;
    company.firstSergeant = null;
    return soldier;
  }
  for (const platoon of company.platoons) {
    if (platoon.leader?.userId === userId) {
      const soldier = platoon.leader;
      platoon.leader = null;
      return soldier;
    }
    if (platoon.sergeant?.userId === userId) {
      const soldier = platoon.sergeant;
      platoon.sergeant = null;
      return soldier;
    }
    for (const squad of platoon.squads) {
      if (squad.leader?.userId === userId) {
        const soldier = squad.leader;
        squad.leader = null;
        return soldier;
      }
      const index = squad.members.findIndex((m) => m.userId === userId);
      if (index !== -1) return squad.members.splice(index, 1)[0];
    }
  }
  return null;
}

function removeSoldier(roster: RosterData, userId: string): Soldier | null {
  if (roster.battalion.commander?.userId === userId) {
    const soldier = roster.battalion.commander;
    roster.battalion.commander = null;
    return soldier;
  }
  if (roster.battalion.executiveOfficer?.userId === userId) {
    const soldier = roster.battalion.executiveOfficer;
    roster.battalion.executiveOfficer = null;
    return soldier;
  }
  if (roster.battalion.sergeantMajor?.userId === userId) {
    const soldier = roster.battalion.sergeantMajor;
    roster.battalion.sergeantMajor = null;
    return soldier;
  }
  for (const company of allCompanies(roster)) {
    const found = removeFromCompany(company, userId);
    if (found) return found;
  }
  return null;
}

function placeSoldier(roster: RosterData, soldier: Soldier, destination: SlotPath): boolean {
  switch (destination.kind) {
    case "battalionCommander":
      roster.battalion.commander = soldier;
      return true;
    case "battalionXO":
      roster.battalion.executiveOfficer = soldier;
      return true;
    case "battalionSGM":
      roster.battalion.sergeantMajor = soldier;
      return true;
    case "companyCommander": {
      const company = findCompany(roster, destination.company);
      if (!company) return false;
      company.commander = soldier;
      return true;
    }
    case "companyXO": {
      const company = findCompany(roster, destination.company);
      if (!company) return false;
      company.executiveOfficer = soldier;
      return true;
    }
    case "company1SG": {
      const company = findCompany(roster, destination.company);
      if (!company) return false;
      company.firstSergeant = soldier;
      return true;
    }
    case "platoonLeader": {
      const company = findCompany(roster, destination.company);
      const platoon = company && findPlatoon(company, destination.platoon);
      if (!platoon) return false;
      platoon.leader = soldier;
      return true;
    }
    case "platoonSergeant": {
      const company = findCompany(roster, destination.company);
      const platoon = company && findPlatoon(company, destination.platoon);
      if (!platoon) return false;
      platoon.sergeant = soldier;
      return true;
    }
    case "squadLeader": {
      const company = findCompany(roster, destination.company);
      const platoon = company && findPlatoon(company, destination.platoon);
      const squad = platoon && findSquad(platoon, destination.squad);
      if (!squad) return false;
      squad.leader = soldier;
      return true;
    }
    case "squadMember": {
      const company = findCompany(roster, destination.company);
      const platoon = company && findPlatoon(company, destination.platoon);
      const squad = platoon && findSquad(platoon, destination.squad);
      if (!squad) return false;
      squad.members.push(soldier);
      return true;
    }
  }
}

export function moveSoldier(
  roster: RosterData,
  userId: string,
  destination: SlotPath,
): { roster: RosterData; ok: boolean } {
  if (isSlotOccupied(roster, destination)) {
    return { roster, ok: false };
  }
  const clone = structuredClone(roster);
  const soldier = removeSoldier(clone, userId);
  if (!soldier) return { roster, ok: false };
  const placed = placeSoldier(clone, soldier, destination);
  if (!placed) return { roster, ok: false };
  return { roster: clone, ok: true };
}

export function addPlatoon(roster: RosterData, companyLetter: string): RosterData {
  const clone = structuredClone(roster);
  const company = findCompany(clone, companyLetter);
  if (!company) return roster;
  const nextNumber = String(
    company.platoons.reduce((max, p) => Math.max(max, Number(p.number)), 0) + 1,
  );
  company.platoons.push({ number: nextNumber, leader: null, sergeant: null, squads: [] });
  return clone;
}

export function addSquad(roster: RosterData, companyLetter: string, platoonNumber: string): RosterData {
  const clone = structuredClone(roster);
  const company = findCompany(clone, companyLetter);
  const platoon = company && findPlatoon(company, platoonNumber);
  if (!platoon) return roster;
  const nextNumber = String(
    platoon.squads.reduce((max, s) => Math.max(max, Number(s.number)), 0) + 1,
  );
  platoon.squads.push({ number: nextNumber, leader: null, members: [] });
  return clone;
}
