import type { RosterData } from "../types/roster";
import type { SquadLocation } from "./moveSoldier";

// The real 2-7 practice schedule as of JUL 2026, used to pre-fill the Split
// Planner's practice-times phase so "Accept current practice times" means
// accepting these known values rather than typing them all in. A squad that
// already has a hand-entered time keeps it — defaults only fill blanks.
// First matching rule wins; omitted platoon/squads fields match everything.
const DEFAULT_RULES: { company: string; platoon?: string; squads?: string[]; time: string }[] = [
  { company: "A", time: "THU 2359z" },
  { company: "B", platoon: "1", time: "THU 0200z" },
  { company: "B", platoon: "2", time: "WED 2359z" },
  { company: "E", platoon: "1", squads: ["1"], time: "THU 0100z" },
  { company: "E", platoon: "1", squads: ["2", "3"], time: "FRI 0200z" },
  { company: "E", platoon: "2", time: "TUE 0100z" },
  { company: "E", platoon: "3", time: "SUN 2300z" },
  { company: "UNASSIGNED", platoon: "1", squads: ["1"], time: "FRI 0200z" },
  { company: "UNASSIGNED", platoon: "1", squads: ["2"], time: "THU 0100z" },
  { company: "UNASSIGNED", platoon: "1", squads: ["5"], time: "TUE 1900z" },
  { company: "UNASSIGNED", platoon: "2", squads: ["2"], time: "THU 0100z" },
  { company: "UNASSIGNED", platoon: "2", squads: ["3"], time: "MON 0000z" },
  { company: "UNASSIGNED", platoon: "2", squads: ["4"], time: "WED 0100z" },
];

export function defaultPracticeTime(location: SquadLocation): string | undefined {
  return DEFAULT_RULES.find(
    (rule) =>
      rule.company === location.company &&
      (rule.platoon === undefined || rule.platoon === location.platoon) &&
      (rule.squads === undefined || rule.squads.includes(location.squad)),
  )?.time;
}

// Fills every blank practiceTime with its default (hand-entered times win).
export function fillDefaultPracticeTimes(roster: RosterData): RosterData {
  const clone = structuredClone(roster);
  for (const company of [...clone.battalion.companies, clone.unassigned]) {
    for (const platoon of company.platoons) {
      for (const squad of platoon.squads) {
        if ((squad.practiceTime ?? "").trim() !== "") continue;
        const fallback = defaultPracticeTime({
          company: company.letter,
          platoon: platoon.number,
          squad: squad.number,
        });
        if (fallback) squad.practiceTime = fallback;
      }
    }
  }
  return clone;
}
