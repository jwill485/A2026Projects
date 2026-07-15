import type { Company, IntactTransfer, RosterData, Soldier, SplitStatus } from "../types/roster";
import { makeBattalion, makeCompany } from "./rosterFactory";
import { collectAllSoldiers, collectCompanySoldiers } from "./analytics";
import { describeSoldierLocations } from "./changelog";

// The two battalions 2-7 is splitting into. Roster names double as battalion
// designations in the generated rosters.
export const SPLIT_GROUPS: { name: string; status: SplitStatus }[] = [
  { name: "HLLV", status: "hllv" },
  { name: "HLLWW2", status: "hllww2" },
];

// B/ACD holds Charlie's real people while the live Charlie shell is empty —
// a real-data fact about *where Charlie's people currently live*, not a
// generalizable pattern. So Charlie's intact transfer (to either battalion)
// always folds B/ACD's structure in too (platoons appended, renumbered past
// Charlie's own); no other company has an equivalent stand-in.
export const CHARLIE_LETTER = "C";

// Every company in RosterData.intactTransfers transfers to its listed
// battalion intact on commit: structure, leadership, and practice times all
// carried over, its members bypassing the Unassigned pool entirely.
function collectIntactCompanies(
  source: RosterData,
  status: SplitStatus,
  intactTransfers: IntactTransfer[],
): { carried: Company[]; intactMemberIds: Set<string> } {
  const carried: Company[] = [];
  const intactMemberIds = new Set<string>();

  for (const transfer of intactTransfers) {
    if (transfer.status !== status) continue;
    const isCharlie = transfer.letter === CHARLIE_LETTER;
    const company = source.battalion.companies.find((c) => c.letter === transfer.letter);
    const hasUnassignedStructure = isCharlie && source.unassigned.platoons.length > 0;
    if (!company && !hasUnassignedStructure) continue; // nothing to carry for this letter

    const copy: Company = company
      ? structuredClone(company)
      : makeCompany(transfer.letter, "Charlie"); // only reachable in the Charlie/B-ACD-only case
    if (hasUnassignedStructure) {
      // Append B/ACD's platoons under Charlie, renumbered past Charlie's
      // own so the numbers don't collide (same next-available scheme as
      // addPlatoon).
      const nextNumber = copy.platoons.reduce((max, p) => Math.max(max, Number(p.number) || 0), 0) + 1;
      const foldedIn = structuredClone(source.unassigned.platoons);
      foldedIn.forEach((platoon, i) => {
        platoon.number = String(nextNumber + i);
      });
      copy.platoons.push(...foldedIn);
      // B/ACD's own company-level staff (filled in via Import Company —
      // see importCompany in moveSoldier.ts) ride along too, same
      // don't-clobber-Charlie's-own priority as that merge.
      if (!copy.commander && source.unassigned.commander) {
        copy.commander = structuredClone(source.unassigned.commander);
      }
      if (!copy.executiveOfficer && source.unassigned.executiveOfficer) {
        copy.executiveOfficer = structuredClone(source.unassigned.executiveOfficer);
      }
      if (!copy.firstSergeant && source.unassigned.firstSergeant) {
        copy.firstSergeant = structuredClone(source.unassigned.firstSergeant);
      }
    }
    for (const soldier of collectCompanySoldiers(copy)) delete soldier.splitStatus;
    carried.push(copy);
    if (company) {
      for (const soldier of collectCompanySoldiers(company)) intactMemberIds.add(soldier.userId);
    }
    if (hasUnassignedStructure) {
      for (const soldier of collectCompanySoldiers(source.unassigned)) intactMemberIds.add(soldier.userId);
    }
  }

  return { carried, intactMemberIds };
}

// Builds a new battalion roster for one side of the split. Deliberately does
// NOT carry over the old company/platoon/squad structure: the guided flow is
// "sort people first, then construct companies around the leadership you
// actually have", so everyone tagged for this battalion lands in the
// Unassigned pool (sorted by rank) under an otherwise-empty battalion, and
// their split tag is cleared — the tag's job is done once they're committed.
// Companies in intactTransfers bypass this pool-sorting entirely (see
// collectIntactCompanies above).
export function buildSplitRoster(
  source: RosterData,
  status: SplitStatus,
  designation: string,
  rankOrder?: Map<string, number>,
  intactTransfers: IntactTransfer[] = [],
): RosterData {
  // With an intact transfer active, that company's (and Charlie's B/ACD's)
  // members never enter either battalion's pool — regardless of individual
  // tags — because the whole unit moves together to its destination.
  const { carried: carriedCompanies, intactMemberIds } = collectIntactCompanies(source, status, intactTransfers);

  // Once flattened into the sorted-by-rank pool below, there's no more
  // structural trace of who served where in 2-7 — capture it as their
  // origin now, while it's still known, so the Pool's "Former unit" filter
  // has something to work with. Overwrites any earlier origin (e.g. from an
  // old +Import Trooper) with their most recent 2-7 posting.
  const sourceLocations = describeSoldierLocations(source);
  const troopers: Soldier[] = collectAllSoldiers(source)
    .filter((s) => s.splitStatus === status && !intactMemberIds.has(s.userId))
    .map((s) => {
      const copy: Soldier = structuredClone(s);
      delete copy.splitStatus;
      copy.originLabel = sourceLocations.get(s.userId)?.label ?? copy.originLabel;
      return copy;
    });

  troopers.sort((a, b) => {
    const orderA = rankOrder?.get(a.rankId) ?? Number.MAX_SAFE_INTEGER;
    const orderB = rankOrder?.get(b.rankId) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.realName.localeCompare(b.realName);
  });

  const unassigned = makeCompany("UNASSIGNED", "Unassigned");
  if (troopers.length > 0) {
    // Same holding platoon/squad convention as addSoldierToCompany.
    unassigned.platoons.push({
      number: "0",
      leader: null,
      sergeant: null,
      squads: [{ number: "0", leader: null, assistantLeader: null, members: troopers }],
    });
  }

  return { battalion: makeBattalion(designation, carriedCompanies), unassigned };
}

// Company letters that shouldn't be offered as fresh suggested-company
// letters, nor have their squads swept into a build suggestion, for the
// given battalion — because they're already handled via an intact transfer
// (see buildSplitRoster above) rather than the per-trooper sort. Includes
// the Unassigned pool's own letter whenever Charlie is among them, since
// B/ACD folds into Charlie's intact copy too.
export function intactExcludedLetters(roster: RosterData, status: SplitStatus): string[] {
  const letters = (roster.intactTransfers ?? [])
    .filter((t) => t.status === status)
    .map((t) => t.letter);
  if (letters.includes(CHARLIE_LETTER)) letters.push(roster.unassigned.letter);
  return letters;
}
