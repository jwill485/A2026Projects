import type { Soldier } from "../types/roster";

// Buckets used by the Split Planner to show what leadership each split
// group actually has before any structure gets built. Classified by
// rankShort (stable 7Cav identifiers) rather than display-order thresholds.
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
  juniorNco: "Squad Leader",
  trooper: "Squad members",
};

const OFFICER_RANKS = new Set([
  "GOA", "GEN", "LTG", "MG", "BG", "COL", "LTC", "MAJ", "CPT", "1LT", "2LT",
  "CW5", "CW4", "CW3", "CW2", "WO1",
]);
const SENIOR_NCO_RANKS = new Set(["CSM", "SGM", "1SG", "MSG", "SFC"]);
const JUNIOR_NCO_RANKS = new Set(["SSG", "SGT", "CPL"]);

export function classifyTier(soldier: Soldier): LeadershipTier {
  if (OFFICER_RANKS.has(soldier.rankShort)) return "officer";
  if (SENIOR_NCO_RANKS.has(soldier.rankShort)) return "seniorNco";
  if (JUNIOR_NCO_RANKS.has(soldier.rankShort)) return "juniorNco";
  return "trooper";
}

export function bucketByTier(soldiers: Soldier[]): Record<LeadershipTier, Soldier[]> {
  const buckets: Record<LeadershipTier, Soldier[]> = {
    officer: [],
    seniorNco: [],
    juniorNco: [],
    trooper: [],
  };
  for (const soldier of soldiers) buckets[classifyTier(soldier)].push(soldier);
  return buckets;
}
