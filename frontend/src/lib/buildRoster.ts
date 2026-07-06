import type { ApiLiteProfile, ApiLiteRoster } from "../types/api";
import type { Company, Platoon, RosterData, Soldier, Squad } from "../types/roster";
import { makeBattalion, makeCompany } from "./rosterFactory";

const COMPANY_NAMES: Record<string, string> = {
  A: "Able",
  B: "Baker",
  C: "Charlie",
  E: "Easy",
};

const BATTALION_HQ_RE = /^(\d-7) (Commanding Officer|Executive Officer|Sergeant Major)$/;
const COMPANY_HQ_RE = /^(Commander|Executive Officer|First Sergeant) ([A-Za-z])\/([\w-]+)$/;
const PLATOON_HQ_RE = /^(Platoon Leader|Platoon Sergeant) (\d+)\/([A-Za-z])\/([\w-]+)$/;
const SQUAD_RE = /^(Section Leader|Assistant Section Leader|Trooper) (\d+)\/(\d+)\/([A-Za-z])\/([\w-]+)$/;

function toSoldier(profile: ApiLiteProfile): Soldier | null {
  if (!profile.user || !profile.primary) return null;
  return {
    userId: profile.user.userId,
    username: profile.user.username,
    realName: profile.realName,
    rankId: profile.rank?.rankId ?? "",
    rankShort: profile.rank?.rankShort ?? "",
    rankFull: profile.rank?.rankFull ?? "",
    positionTitle: profile.primary.positionTitle,
    mos: profile.mos || "Unknown",
  };
}

function sortByRank(soldiers: Soldier[], rankOrder: Map<string, number>): Soldier[] {
  return [...soldiers].sort(
    (a, b) => (rankOrder.get(a.rankId) ?? Infinity) - (rankOrder.get(b.rankId) ?? Infinity),
  );
}

function getPlatoon(company: Company, number: string): Platoon {
  let platoon = company.platoons.find((p) => p.number === number);
  if (!platoon) {
    platoon = { number, leader: null, sergeant: null, squads: [] };
    company.platoons.push(platoon);
  }
  return platoon;
}

function getSquad(platoon: Platoon, number: string): Squad {
  let squad = platoon.squads.find((s) => s.number === number);
  if (!squad) {
    squad = { number, leader: null, members: [] };
    platoon.squads.push(squad);
  }
  return squad;
}

function sortByNumber<T extends { number: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => Number(a.number) - Number(b.number));
}

export function buildRosterData(
  apiRoster: ApiLiteRoster,
  rankOrder: Map<string, number>,
): RosterData {
  const battalion = makeBattalion(
    "2-7",
    Object.entries(COMPANY_NAMES).map(([letter, name]) => makeCompany(letter, name)),
  );
  const unassigned = makeCompany("UNASSIGNED", "ACD");

  for (const profile of Object.values(apiRoster.profiles)) {
    const title = profile.primary?.positionTitle;
    if (!title) continue;
    const soldier = toSoldier(profile);
    if (!soldier) continue;

    const battalionMatch = title.match(BATTALION_HQ_RE);
    if (battalionMatch) {
      const [, designation, role] = battalionMatch;
      if (designation !== "2-7") continue;
      if (role === "Commanding Officer") battalion.commander = soldier;
      else if (role === "Executive Officer") battalion.executiveOfficer = soldier;
      else if (role === "Sergeant Major") battalion.sergeantMajor = soldier;
      continue;
    }

    const companyMatch = title.match(COMPANY_HQ_RE);
    if (companyMatch) {
      const [, role, letter, unit] = companyMatch;
      const company =
        unit === "ACD" && letter === "B"
          ? unassigned
          : unit === "2-7" && letter in COMPANY_NAMES
            ? battalion.companies.find((c) => c.letter === letter)!
            : null;
      if (!company) continue;
      if (role === "Commander") company.commander = soldier;
      else if (role === "Executive Officer") company.executiveOfficer = soldier;
      else if (role === "First Sergeant") company.firstSergeant = soldier;
      continue;
    }

    const platoonMatch = title.match(PLATOON_HQ_RE);
    if (platoonMatch) {
      const [, role, number, letter, unit] = platoonMatch;
      const company =
        unit === "ACD" && letter === "B"
          ? unassigned
          : unit === "2-7" && letter in COMPANY_NAMES
            ? battalion.companies.find((c) => c.letter === letter)!
            : null;
      if (!company) continue;
      const platoon = getPlatoon(company, number);
      if (role === "Platoon Leader") platoon.leader = soldier;
      else if (role === "Platoon Sergeant") platoon.sergeant = soldier;
      continue;
    }

    const squadMatch = title.match(SQUAD_RE);
    if (squadMatch) {
      const [, role, squadNumber, platoonNumber, letter, unit] = squadMatch;
      const company =
        unit === "ACD" && letter === "B"
          ? unassigned
          : unit === "2-7" && letter in COMPANY_NAMES
            ? battalion.companies.find((c) => c.letter === letter)!
            : null;
      if (!company) continue;
      const platoon = getPlatoon(company, platoonNumber);
      const squad = getSquad(platoon, squadNumber);
      if (role === "Section Leader") squad.leader = soldier;
      else squad.members.push(soldier);
      continue;
    }
  }

  for (const company of [...battalion.companies, unassigned]) {
    company.platoons = sortByNumber(company.platoons);
    for (const platoon of company.platoons) {
      platoon.squads = sortByNumber(platoon.squads);
      for (const squad of platoon.squads) {
        squad.members = sortByRank(squad.members, rankOrder);
      }
    }
  }

  return { battalion, unassigned };
}
