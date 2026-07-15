import type { Battalion, Company, RosterData, Soldier } from "../types/roster";

export function makeCompany(letter: string, name: string): Company {
  return {
    letter,
    name,
    commander: null,
    executiveOfficer: null,
    firstSergeant: null,
    platoons: [],
  };
}

export function makeBattalion(designation: string, companies: Company[] = []): Battalion {
  return {
    designation,
    commander: null,
    executiveOfficer: null,
    sergeantMajor: null,
    companies,
  };
}

export function makeBlankRoster(): RosterData {
  return {
    battalion: makeBattalion("", []),
    unassigned: makeCompany("UNASSIGNED", "Unassigned"),
  };
}

export interface NewSoldierInput {
  realName: string;
  rankId: string;
  rankShort: string;
  rankFull: string;
  mos: string;
}

export function makeSoldier(input: NewSoldierInput): Soldier {
  return {
    userId: `local-${crypto.randomUUID()}`,
    username: "",
    realName: input.realName,
    rankId: input.rankId,
    rankShort: input.rankShort,
    rankFull: input.rankFull,
    positionTitle: "",
    mos: input.mos,
  };
}
