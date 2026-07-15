import type { Tier } from "./types";

// Order/labels mirror RosterManager's leadership.ts so the two projects
// describe rank tiers the same way.
export const TIER_ORDER: Tier[] = ["officer", "seniorNco", "juniorNco", "trooper"];

export const TIER_LABELS: Record<Tier, string> = {
  officer: "Officers",
  seniorNco: "Senior NCOs",
  juniorNco: "Junior NCOs",
  trooper: "Troopers",
};

// Company letters are shared across battalions (each battalion has its own
// A/B/C/etc.) — combine with the Battalion filter to pin down a specific
// one, e.g. Battalion=1-7 + Company=Able (A).
export const COMPANY_ORDER = ["HQ", "A", "B", "C", "D", "E"];

export const COMPANY_LABELS: Record<string, string> = {
  HQ: "Battalion HQ",
  A: "Able (A)",
  B: "Baker (B)",
  C: "Charlie (C)",
  D: "Dog (D)",
  E: "Easy (E)",
};

export const BATTALION_ORDER = ["1-7", "2-7", "3-7", "ACD"];
