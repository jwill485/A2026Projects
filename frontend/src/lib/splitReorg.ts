import type { Company, RosterData, Soldier, SplitStatus } from "../types/roster";
import { makeBattalion, makeCompany } from "./rosterFactory";
import { collectAllSoldiers, collectCompanySoldiers } from "./analytics";

// The two battalions 2-7 is splitting into. Roster names double as battalion
// designations in the generated rosters.
export const SPLIT_GROUPS: { name: string; status: SplitStatus }[] = [
  { name: "HLLV", status: "hllv" },
  { name: "HLLWW2", status: "hllww2" },
];

// When RosterData.sendCharlieToHllv is set, this company transfers to this
// battalion intact on commit: structure, leadership, and practice times all
// carried over, members bypassing the Unassigned pool entirely. The B/ACD
// pool is folded in under this company too (its platoons appended, renumbered
// past Charlie's own) — B/ACD holds Charlie's real people while the live
// Charlie shell is empty, so it's treated as stored under C/2-7 for the
// purposes of this transfer.
export const INTACT_TRANSFER: { letter: string; status: SplitStatus } = {
  letter: "C",
  status: "hllv",
};

// Builds a new battalion roster for one side of the split. Deliberately does
// NOT carry over the old company/platoon/squad structure: the guided flow is
// "sort people first, then construct companies around the leadership you
// actually have", so everyone tagged for this battalion lands in the
// Unassigned pool (sorted by rank) under an otherwise-empty battalion, and
// their split tag is cleared — the tag's job is done once they're committed.
export function buildSplitRoster(
  source: RosterData,
  status: SplitStatus,
  designation: string,
  rankOrder?: Map<string, number>,
  carryIntact = false,
): RosterData {
  // With the intact transfer active, Charlie's (and B/ACD's) members never
  // enter either battalion's pool — regardless of individual tags — because
  // the whole unit moves together to its destination battalion.
  const carriedCompanies: Company[] = [];
  const intactMemberIds = new Set<string>();
  if (carryIntact && INTACT_TRANSFER.status === status) {
    const charlie = source.battalion.companies.find((c) => c.letter === INTACT_TRANSFER.letter);
    const hasUnassignedStructure = source.unassigned.platoons.length > 0;
    if (charlie || hasUnassignedStructure) {
      const copy: Company = charlie
        ? structuredClone(charlie)
        : makeCompany(INTACT_TRANSFER.letter, "Charlie");
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
      carriedCompanies.push(copy);
      for (const soldier of collectCompanySoldiers(charlie ?? makeCompany("", ""))) {
        intactMemberIds.add(soldier.userId);
      }
      for (const soldier of collectCompanySoldiers(source.unassigned)) {
        intactMemberIds.add(soldier.userId);
      }
    }
  }

  const troopers: Soldier[] = collectAllSoldiers(source)
    .filter((s) => s.splitStatus === status && !intactMemberIds.has(s.userId))
    .map((s) => {
      const copy: Soldier = structuredClone(s);
      delete copy.splitStatus;
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
      squads: [{ number: "0", leader: null, members: troopers }],
    });
  }

  return { battalion: makeBattalion(designation, carriedCompanies), unassigned };
}
