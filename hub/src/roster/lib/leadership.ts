import type { RosterData, Soldier } from "../types/roster";
import type { SlotPath } from "./moveSoldier";
import { describeSoldierLocations, type LocationInfo } from "./changelog";

// Buckets used by the Split Planner to show what leadership each split
// group actually has before any structure gets built. Classified by the
// billet a soldier currently holds in the roster tree (e.g. Section/Squad
// Leader, Platoon Sergeant) rather than by rank — the 7Cav API only tells
// us rank, not who's actually leading, and rank alone can both over- and
// under-count real leadership (someone can hold a leadership-tier rank
// while sitting as a rank-and-file squad member, or vice versa).
export type LeadershipTier = "officer" | "seniorNco" | "juniorNco" | "trooper";

export const TIER_ORDER: LeadershipTier[] = ["officer", "seniorNco", "juniorNco", "trooper"];

export const TIER_LABELS: Record<LeadershipTier, string> = {
  officer: "Officers",
  seniorNco: "Senior NCOs",
  juniorNco: "Junior NCOs",
  trooper: "Troopers",
};

// What each tier is the candidate pool for, shown as a planning hint.
export const TIER_BILLETS: Record<LeadershipTier, string> = {
  officer: "BN CO/XO, Company CO/XO, Platoon Leader",
  seniorNco: "SGM, 1SG, Platoon Sergeant",
  juniorNco: "Squad Leader, Assistant Squad Leader",
  trooper: "Squad members",
};

// Which tier a given structural billet counts as. Anyone not currently
// occupying one of the leadership slots below (squad members, the pool)
// falls back to "trooper".
const SLOT_TIER: Record<SlotPath["kind"], LeadershipTier> = {
  battalionCommander: "officer",
  battalionXO: "officer",
  battalionSGM: "seniorNco",
  companyCommander: "officer",
  companyXO: "officer",
  company1SG: "seniorNco",
  platoonLeader: "officer",
  platoonSergeant: "seniorNco",
  squadLeader: "juniorNco",
  squadAssistantLeader: "juniorNco",
  squadMember: "trooper",
  unassignedPool: "trooper",
};

// For callers that already have a describeSoldierLocations() result (e.g.
// CandidatePicker, which needs both the locations and the tiers) — avoids
// walking the roster tree a second time just to classify tiers.
export function tierMapFromLocations(locations: Map<string, LocationInfo>): Map<string, LeadershipTier> {
  const map = new Map<string, LeadershipTier>();
  for (const [userId, info] of locations) {
    map.set(userId, SLOT_TIER[info.kind]);
  }
  return map;
}

// One tree walk to classify everyone in a roster — cheaper than re-deriving
// per soldier when classifying a whole list.
export function computeTierMap(roster: RosterData): Map<string, LeadershipTier> {
  return tierMapFromLocations(describeSoldierLocations(roster));
}

export function bucketByTier(
  roster: RosterData,
  soldiers: Soldier[],
): Record<LeadershipTier, Soldier[]> {
  const tierMap = computeTierMap(roster);
  const buckets: Record<LeadershipTier, Soldier[]> = {
    officer: [],
    seniorNco: [],
    juniorNco: [],
    trooper: [],
  };
  for (const soldier of soldiers) buckets[tierMap.get(soldier.userId) ?? "trooper"].push(soldier);
  return buckets;
}

// A separate axis from LeadershipTier (rank-appropriateness): which echelon
// of the org chart a soldier's current billet sits at. Used by the Drag &
// Drop Pool filter to help find, e.g., former company-level B/ACD staff
// sitting unplaced — not for gating who's eligible to fill a vacancy (that
// stays rank-tier based, see CandidatePicker's SLOT_TIERS).
export type BilletEchelon = "battalion" | "company" | "platoon" | "squad";

export const ECHELON_ORDER: BilletEchelon[] = ["battalion", "company", "platoon", "squad"];

export const ECHELON_LABELS: Record<BilletEchelon, string> = {
  battalion: "Battalion HQ",
  company: "Company HQ",
  platoon: "Platoon HQ",
  squad: "Squad",
};

const SLOT_ECHELON: Record<SlotPath["kind"], BilletEchelon> = {
  battalionCommander: "battalion",
  battalionXO: "battalion",
  battalionSGM: "battalion",
  companyCommander: "company",
  companyXO: "company",
  company1SG: "company",
  platoonLeader: "platoon",
  platoonSergeant: "platoon",
  squadLeader: "squad",
  squadAssistantLeader: "squad",
  squadMember: "squad",
  unassignedPool: "squad",
};

export function echelonMapFromLocations(locations: Map<string, LocationInfo>): Map<string, BilletEchelon> {
  const map = new Map<string, BilletEchelon>();
  for (const [userId, info] of locations) {
    map.set(userId, SLOT_ECHELON[info.kind]);
  }
  return map;
}

export function computeEchelonMap(roster: RosterData): Map<string, BilletEchelon> {
  return echelonMapFromLocations(describeSoldierLocations(roster));
}
