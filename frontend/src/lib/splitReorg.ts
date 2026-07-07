import type { RosterData, Soldier, SplitStatus } from "../types/roster";
import { makeBattalion, makeCompany } from "./rosterFactory";
import { collectAllSoldiers } from "./analytics";

// The two battalions 2-7 is splitting into. Roster names double as battalion
// designations in the generated rosters.
export const SPLIT_GROUPS: { name: string; status: SplitStatus }[] = [
  { name: "HLLV", status: "hllv" },
  { name: "HLLWW2", status: "hllww2" },
];

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
): RosterData {
  const troopers: Soldier[] = collectAllSoldiers(source)
    .filter((s) => s.splitStatus === status)
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

  return { battalion: makeBattalion(designation, []), unassigned };
}
