import type { Platoon, RosterData, Soldier, SplitStatus, Squad } from "../types/roster";
import { makeCompany } from "./rosterFactory";
import { removeSoldier } from "./moveSoldier";
import type { CountStat } from "./analytics";

// Suggests a company/platoon/squad structure for one side of the split from
// what the source roster already knows: old squads stay intact as units,
// units are clustered by practice time (squads that train together end up in
// the same company), and each unit's MOS makeup is surfaced so specialty
// spread is visible before applying. Leadership billets are deliberately
// left vacant — filling them is a judgment call (see click-to-assign).

export interface SuggestedSquad {
  // Where the unit came from, e.g. "A/1/2" or "B/ACD/1/5".
  sourceLabel: string;
  practiceTime?: string;
  leader: Soldier | null;
  members: Soldier[];
  mos: CountStat[];
}

export interface SuggestedPlatoon {
  number: string;
  squads: SuggestedSquad[];
}

export interface SuggestedCompany {
  letter: string;
  name: string;
  practiceTime: string;
  platoons: SuggestedPlatoon[];
  headcount: number;
}

const COMPANY_NAMES: Record<string, string> = {
  A: "Able", B: "Baker", C: "Charlie", D: "Dog",
  E: "Easy", F: "Fox", G: "George", H: "How",
};

const SQUADS_PER_PLATOON = 3;

function mosCounts(people: Soldier[]): CountStat[] {
  const counts = new Map<string, number>();
  for (const person of people) {
    const mos = person.mos.trim() === "" ? "No MOS" : person.mos;
    counts.set(mos, (counts.get(mos) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value }));
}

export function suggestCompanies(
  source: RosterData,
  status: SplitStatus,
  options: { excludeCompanies?: string[]; usedLetters?: string[] } = {},
): SuggestedCompany[] {
  const excluded = new Set(options.excludeCompanies ?? []);

  // Old squads with anyone tagged for this battalion become suggested units.
  const units: SuggestedSquad[] = [];
  for (const company of [...source.battalion.companies, source.unassigned]) {
    if (excluded.has(company.letter)) continue;
    const companyLabel = company.letter === "UNASSIGNED" ? "B/ACD" : company.letter;
    for (const platoon of company.platoons) {
      for (const squad of platoon.squads) {
        const everyone = [...(squad.leader ? [squad.leader] : []), ...squad.members];
        const tagged = everyone.filter((s) => s.splitStatus === status);
        if (tagged.length === 0) continue;
        const leader = squad.leader && squad.leader.splitStatus === status ? squad.leader : null;
        units.push({
          sourceLabel: `${companyLabel}/${platoon.number}/${squad.number}`,
          practiceTime: (squad.practiceTime ?? "").trim() || undefined,
          leader,
          members: tagged.filter((s) => s.userId !== leader?.userId),
          mos: mosCounts(tagged),
        });
      }
    }
  }
  if (units.length === 0) return [];

  // Cluster by practice time — one suggested company per time slot, largest
  // cluster first so it lands the earliest free letter.
  const clusters = new Map<string, SuggestedSquad[]>();
  for (const unit of units) {
    const key = unit.practiceTime ?? "No practice time set";
    clusters.set(key, [...(clusters.get(key) ?? []), unit]);
  }
  const freeLetters = "ABCDEFGH".split("").filter((l) => !(options.usedLetters ?? []).includes(l));

  return [...clusters.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([practiceTime, squads], index) => {
      const letter = freeLetters[index] ?? `X${index + 1}`;
      const platoons: SuggestedPlatoon[] = [];
      for (let i = 0; i < squads.length; i += SQUADS_PER_PLATOON) {
        platoons.push({
          number: String(platoons.length + 1),
          squads: squads.slice(i, i + SQUADS_PER_PLATOON),
        });
      }
      return {
        letter,
        name: COMPANY_NAMES[letter] ?? letter,
        practiceTime,
        platoons,
        headcount: squads.reduce((sum, s) => sum + (s.leader ? 1 : 0) + s.members.length, 0),
      };
    });
}

// Materializes suggestions into a committed battalion roster: creates the
// companies, then pulls each suggested person out of the target's pool (by
// userId) into their squad. People not found on the target (e.g. re-tagged
// since commit) are skipped silently; leadership stays vacant on purpose.
export function applySuggestedCompanies(
  target: RosterData,
  suggestions: SuggestedCompany[],
): RosterData {
  const clone = structuredClone(target);
  for (const suggestion of suggestions) {
    if (clone.battalion.companies.some((c) => c.letter === suggestion.letter)) continue;
    const company = makeCompany(suggestion.letter, suggestion.name);
    for (const suggestedPlatoon of suggestion.platoons) {
      const platoon: Platoon = {
        number: suggestedPlatoon.number,
        leader: null,
        sergeant: null,
        squads: [],
      };
      let squadNumber = 1;
      for (const suggestedSquad of suggestedPlatoon.squads) {
        const squad: Squad = {
          number: String(squadNumber),
          leader: null,
          members: [],
          practiceTime: suggestedSquad.practiceTime,
        };
        for (const person of [
          ...(suggestedSquad.leader ? [suggestedSquad.leader] : []),
          ...suggestedSquad.members,
        ]) {
          const pulled = removeSoldier(clone, person.userId);
          if (!pulled) continue;
          if (suggestedSquad.leader?.userId === person.userId) squad.leader = pulled;
          else squad.members.push(pulled);
        }
        if (squad.leader || squad.members.length > 0) {
          platoon.squads.push(squad);
          squadNumber += 1;
        }
      }
      if (platoon.squads.length > 0) company.platoons.push(platoon);
    }
    clone.battalion.companies.push(company);
  }
  return clone;
}
