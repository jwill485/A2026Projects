import type { Platoon, RosterData, Soldier, SplitStatus, Squad } from "../types/roster";
import { makeCompany } from "./rosterFactory";
import { removeSoldier } from "./moveSoldier";
import { computeTierMap } from "./leadership";
import { computeMosBreakdown, type CountStat } from "./analytics";

// Suggests a company/platoon/squad structure for one side of the split from
// what the source roster already knows: old squads stay intact as units,
// grouped by practice time (squads that train together end up in the same
// company where the company-count cap allows it), sized to each
// battalion's structural standards, and checked against how much
// leadership is actually available. Leadership billets are deliberately
// left vacant in the suggestion itself — filling them is a judgment call
// (see click-to-assign).

export interface SuggestedSquad {
  // Where the unit came from, e.g. "A/1/2" or "Unassigned/1/5".
  sourceLabel: string;
  practiceTime?: string;
  leader: Soldier | null;
  assistantLeader: Soldier | null;
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
  // Unique practice times represented in this company, sorted — a company
  // can end up with more than one once bin-packed under a company-count cap.
  practiceTimes: string[];
  platoons: SuggestedPlatoon[];
  headcount: number;
}

export interface SuggestionResult {
  companies: SuggestedCompany[];
  warnings: string[];
}

// Each battalion's structural standards (§8.3 discussion): HLLV is the
// priority battalion and gets the larger allowed footprint; HLLWW2 is
// deliberately smaller. Both share the same minimums per unit.
export interface StructureRules {
  minSquadsPerPlatoon: number;
  minPlatoonsPerCompany: number;
  minCompanies: number;
  maxCompanies: number;
}

export const STRUCTURE_RULES: Partial<Record<SplitStatus, StructureRules>> = {
  hllv: { minSquadsPerPlatoon: 2, minPlatoonsPerCompany: 2, minCompanies: 1, maxCompanies: 4 },
  hllww2: { minSquadsPerPlatoon: 2, minPlatoonsPerCompany: 2, minCompanies: 1, maxCompanies: 2 },
};

const COMPANY_NAMES: Record<string, string> = {
  A: "Able", B: "Baker", C: "Charlie", D: "Dog",
  E: "Easy", F: "Fox", G: "George", H: "How",
};

// Greedily assigns whole practice-time clusters (largest first) to whichever
// bin currently has the fewest squads, so clusters stay together (squads
// that train together stay in one company/platoon) while bin sizes stay
// roughly balanced. A cluster bigger than the target average still lands
// whole in one bin rather than being split.
function packClustersIntoBins<T>(clusters: T[][], binCount: number): T[][] {
  const bins: T[][] = Array.from({ length: binCount }, () => []);
  const sizes = new Array(binCount).fill(0);
  for (const cluster of clusters) {
    let target = 0;
    for (let i = 1; i < binCount; i++) if (sizes[i] < sizes[target]) target = i;
    bins[target].push(...cluster);
    sizes[target] += cluster.length;
  }
  return bins;
}

function squadHeadcount(squad: SuggestedSquad): number {
  return (squad.leader ? 1 : 0) + (squad.assistantLeader ? 1 : 0) + squad.members.length;
}

// squad.mos is already a most-common-first breakdown (computeMosBreakdown),
// so its first entry is the squad's dominant specialty.
function dominantMos(squad: SuggestedSquad): string {
  return squad.mos[0]?.label ?? "No MOS";
}

// Distributes a company's squads across its platoons, keeping squads intact
// (never split — that's a core design principle, see the file-top comment)
// while trying to spread each dominant MOS roughly evenly across platoons —
// e.g. so medics aren't all stacked in one platoon just because their
// squads happened to land next to each other in the practice-time
// clustering above. Greedy: processes squads in an order that interleaves
// distinct dominant-MOS groups (round-robin merge, so same-MOS squads
// aren't handled back-to-back), assigning each to whichever platoon
// currently has the fewest people sharing that squad's dominant MOS (ties
// broken by smallest current headcount, to keep platoon sizes reasonably
// even too). Squad counts per platoon can end up less even than a blind
// slice would give — an accepted trade-off for MOS balance being the
// stated priority here.
function distributeSquadsForMosBalance(squads: SuggestedSquad[], platoonCount: number): SuggestedSquad[][] {
  const platoons: SuggestedSquad[][] = Array.from({ length: platoonCount }, () => []);
  const mosCounts: Map<string, number>[] = Array.from({ length: platoonCount }, () => new Map());
  const headcounts = new Array(platoonCount).fill(0);

  const groups = new Map<string, SuggestedSquad[]>();
  for (const squad of squads) {
    const key = dominantMos(squad);
    groups.set(key, [...(groups.get(key) ?? []), squad]);
  }
  const groupLists = [...groups.values()];
  const order: SuggestedSquad[] = [];
  for (let i = 0; order.length < squads.length; i++) {
    for (const list of groupLists) {
      if (i < list.length) order.push(list[i]);
    }
  }

  for (const squad of order) {
    const mos = dominantMos(squad);
    let target = 0;
    for (let p = 1; p < platoonCount; p++) {
      const targetCount = mosCounts[target].get(mos) ?? 0;
      const candidateCount = mosCounts[p].get(mos) ?? 0;
      if (candidateCount < targetCount || (candidateCount === targetCount && headcounts[p] < headcounts[target])) {
        target = p;
      }
    }
    platoons[target].push(squad);
    const headcount = squadHeadcount(squad);
    headcounts[target] += headcount;
    mosCounts[target].set(mos, (mosCounts[target].get(mos) ?? 0) + headcount);
  }

  return platoons;
}

export function suggestCompanies(
  source: RosterData,
  status: SplitStatus,
  options: { excludeCompanies?: string[]; usedLetters?: string[] } = {},
): SuggestionResult {
  const rules = STRUCTURE_RULES[status];
  if (!rules) return { companies: [], warnings: [] };
  const excluded = new Set(options.excludeCompanies ?? []);

  // Old squads with anyone tagged for this battalion become suggested units.
  const units: SuggestedSquad[] = [];
  for (const company of [...source.battalion.companies, source.unassigned]) {
    if (excluded.has(company.letter)) continue;
    const companyLabel = company.letter === "UNASSIGNED" ? "Unassigned" : company.letter;
    for (const platoon of company.platoons) {
      for (const squad of platoon.squads) {
        const everyone = [
          ...(squad.leader ? [squad.leader] : []),
          ...(squad.assistantLeader ? [squad.assistantLeader] : []),
          ...squad.members,
        ];
        const tagged = everyone.filter((s) => s.splitStatus === status);
        if (tagged.length === 0) continue;
        const leader = squad.leader && squad.leader.splitStatus === status ? squad.leader : null;
        const assistantLeader =
          squad.assistantLeader && squad.assistantLeader.splitStatus === status ? squad.assistantLeader : null;
        units.push({
          sourceLabel: `${companyLabel}/${platoon.number}/${squad.number}`,
          practiceTime: (squad.practiceTime ?? "").trim() || undefined,
          leader,
          assistantLeader,
          members: tagged.filter((s) => s.userId !== leader?.userId && s.userId !== assistantLeader?.userId),
          mos: computeMosBreakdown(tagged),
        });
      }
    }
  }
  if (units.length === 0) return { companies: [], warnings: [] };

  const warnings: string[] = [];
  const everyoneTagged = units.flatMap((u) => [...(u.leader ? [u.leader] : []), ...u.members]);
  const tierMap = computeTierMap(source);
  const officerCount = everyoneTagged.filter((s) => tierMap.get(s.userId) === "officer").length;
  const seniorNcoCount = everyoneTagged.filter((s) => tierMap.get(s.userId) === "seniorNco").length;
  const juniorNcoCount = everyoneTagged.filter((s) => tierMap.get(s.userId) === "juniorNco").length;

  // Company count is driven by squad availability and the battalion's own
  // cap — NOT by leadership. Leadership (especially senior NCO — cavalry-wide
  // there are far fewer 1SG/SGM/MSG/SFC-tier people than officers) is
  // reported as a warning instead: billets can be filled from outside the
  // usual tier (see click-to-assign's "Show all ranks"), so a scarce tier
  // shouldn't silently shrink the suggested structure.
  const minSquadsPerCompany = rules.minSquadsPerPlatoon * rules.minPlatoonsPerCompany;
  const maxCompaniesBySquads = Math.max(1, Math.floor(units.length / minSquadsPerCompany));
  const companies = Math.min(rules.maxCompanies, Math.max(rules.minCompanies, maxCompaniesBySquads));

  if (units.length < minSquadsPerCompany) {
    warnings.push(
      `Only ${units.length} squad${units.length === 1 ? "" : "s"} tagged — fewer than the ` +
        `minimum standard (${rules.minPlatoonsPerCompany} platoons × ${rules.minSquadsPerPlatoon} ` +
        `squads = ${minSquadsPerCompany}) for even one company.`,
    );
  }

  // Cluster by practice time, largest first, then bin-pack whole clusters
  // into the decided company count.
  const clusterMap = new Map<string, SuggestedSquad[]>();
  for (const unit of units) {
    const key = unit.practiceTime ?? "No practice time set";
    clusterMap.set(key, [...(clusterMap.get(key) ?? []), unit]);
  }
  const clusters = [...clusterMap.values()].sort((a, b) => b.length - a.length);
  const companyBins = packClustersIntoBins(clusters, companies)
    .filter((bin) => bin.length > 0)
    .sort((a, b) => b.length - a.length);

  const freeLetters = "ABCDEFGH".split("").filter((l) => !(options.usedLetters ?? []).includes(l));

  const result: SuggestedCompany[] = companyBins.map((squads, index) => {
    const letter = freeLetters[index] ?? `X${index + 1}`;
    const k = squads.length;
    // Aim for ~3 squads/platoon, never below the minimum platoon count, and
    // never so many platoons that squads/platoon would dip under the
    // per-platoon minimum (best effort — flagged below if even the minimum
    // platoon count can't be reached with this few squads).
    const maxPlatoonsBySquads = Math.max(1, Math.floor(k / rules.minSquadsPerPlatoon));
    const idealPlatoons = Math.max(1, Math.round(k / 3));
    const platoonCount = Math.min(maxPlatoonsBySquads, Math.max(rules.minPlatoonsPerCompany, idealPlatoons));
    if (platoonCount < rules.minPlatoonsPerCompany) {
      warnings.push(
        `${COMPANY_NAMES[letter] ?? letter} Company (${letter}) only has enough squads for ` +
          `${platoonCount} platoon(s) — below the ${rules.minPlatoonsPerCompany}-platoon minimum.`,
      );
    }

    const platoons: SuggestedPlatoon[] = distributeSquadsForMosBalance(squads, platoonCount).map(
      (platoonSquads, p) => ({ number: String(p + 1), squads: platoonSquads }),
    );

    const practiceTimes = [...new Set(squads.map((s) => s.practiceTime ?? "No practice time set"))].sort();
    return {
      letter,
      name: COMPANY_NAMES[letter] ?? letter,
      practiceTimes,
      platoons,
      headcount: squads.reduce((sum, s) => sum + squadHeadcount(s), 0),
    };
  });

  // Leadership warnings, computed against the structure actually produced
  // (not a hypothetical minimum) so the numbers are accurate to what's on
  // screen. These never change the structure — see the comment above.
  const totalPlatoons = result.reduce((sum, c) => sum + c.platoons.length, 0);
  const officersNeeded = result.length + totalPlatoons; // 1 CO + 1 PL/platoon
  const seniorNcoNeeded = result.length + totalPlatoons; // 1 1SG + 1 PSG/platoon
  if (officerCount < officersNeeded) {
    warnings.push(
      `Only ${officerCount} officers available for ${officersNeeded} CO/Platoon Leader billets ` +
        `in this structure — some will need a leader from another tier (click-to-assign's ` +
        `"Show all ranks" supports this).`,
    );
  }
  if (seniorNcoCount < seniorNcoNeeded) {
    warnings.push(
      `Only ${seniorNcoCount} senior NCOs available for ${seniorNcoNeeded} 1SG/Platoon Sergeant ` +
        `billets in this structure — some will need a leader from another tier.`,
    );
  }
  if (juniorNcoCount < units.length) {
    warnings.push(
      `Only ${juniorNcoCount} junior NCOs available for ${units.length} squad-leader billets — ` +
        `${units.length - juniorNcoCount} squad(s) will need a leader from another tier.`,
    );
  }

  return { companies: result, warnings };
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
          assistantLeader: null,
          members: [],
          practiceTime: suggestedSquad.practiceTime,
        };
        for (const person of [
          ...(suggestedSquad.leader ? [suggestedSquad.leader] : []),
          ...(suggestedSquad.assistantLeader ? [suggestedSquad.assistantLeader] : []),
          ...suggestedSquad.members,
        ]) {
          const pulled = removeSoldier(clone, person.userId);
          if (!pulled) continue;
          if (suggestedSquad.leader?.userId === person.userId) squad.leader = pulled;
          else if (suggestedSquad.assistantLeader?.userId === person.userId) squad.assistantLeader = pulled;
          else squad.members.push(pulled);
        }
        if (squad.leader || squad.assistantLeader || squad.members.length > 0) {
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
