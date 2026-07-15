// Mirrors the backend's ranger.py so the CLI pull script and the live web
// app always agree on WW2 Ranger Selection Requirement status.

export interface Graduation {
  details: string;
  date: string;
}

export interface RangerStatus {
  requiredTotal: number;
  requiredCompleted: number;
  missingClasses: string[];
  qualified: boolean;
}

// The 14 Hell Let Loose classes required for the WW2 Ranger Selection
// Requirement (user-defined battalion criteria, 2026-07-13 — see project
// memory "class-grads-ww2-ranger-selection"). Each canonical name maps to the
// wording variants actually found in live milpacs records — graduation text
// has been logged inconsistently over the years (typos, reordered words,
// old naming), so a strict-equality match would undercount real completions.
// Matching always additionally requires "Hell Let Loose" to appear in the
// record text, so a similarly-named class from a different game never counts.
export const REQUIRED_CLASSES: string[] = [
  "Basic Infantry Combat Training Course",
  "Combat Lifesaver Course",
  "Commander's Course",
  "Advanced Infantry Training 1 Course",
  "Artillery Crewman Course",
  "Anti Tank Course",
  "Assault and Automatic Rifleman Course",
  "Machine Gunner Course",
  "Basic Recon Course",
  "Engineer and Support Course",
  "Advanced Infantry Training 2 Course",
  "Sniper Course",
  "Basic Leadership Course",
  "Advanced Leadership Course",
];

// Variant wordings found in the live data that should count toward each
// canonical class above. Hyphen/apostrophe/capitalization/whitespace
// differences are handled automatically by normalize() below and don't need
// an entry here — only genuinely different wording does.
const CLASS_VARIANTS: Record<string, string[]> = {
  "Basic Infantry Combat Training Course": [
    "Basic Infantry Combat Training Course",
    "Basic Combat Infantry Course",
  ],
  "Combat Lifesaver Course": ["Combat Lifesaver Course"],
  "Commander's Course": ["Commander's Course"],
  "Advanced Infantry Training 1 Course": [
    "Advanced Infantry Training 1 Course",
    "Advanced Infantry Combat Training 1 Course",
    "Advanced Infantry Tactics 1 Course",
    "Advanced Infantry Tactics I",
  ],
  "Artillery Crewman Course": ["Artillery Crewman Course"],
  "Anti Tank Course": ["Anti Tank Course"],
  "Assault and Automatic Rifleman Course": ["Assault and Automatic Rifleman Course"],
  "Machine Gunner Course": ["Machine Gunner Course", "Machine Gun Course"],
  "Basic Recon Course": ["Basic Recon Course"],
  "Engineer and Support Course": ["Engineer and Support Course"],
  "Advanced Infantry Training 2 Course": [
    "Advanced Infantry Training 2 Course",
    "Advanced Infantry Combat Training 2 Course",
    "Advanced Infantry Traininig 2 Course", // typo as logged live
  ],
  "Sniper Course": ["Sniper Course"],
  "Basic Leadership Course": ["Basic Leadership Course"],
  "Advanced Leadership Course": ["Advanced Leadership Course"],
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[-'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NORMALIZED_VARIANTS: Record<string, string[]> = Object.fromEntries(
  Object.entries(CLASS_VARIANTS).map(([canonical, variants]) => [canonical, variants.map(normalize)]),
);

export function rangerStatus(graduations: Graduation[]): RangerStatus {
  const normalizedRecords = graduations.map((g) => normalize(g.details));
  const hllRecords = normalizedRecords.filter((r) => r.includes("hell let loose"));

  function hasClass(canonical: string): boolean {
    const variants = NORMALIZED_VARIANTS[canonical];
    return hllRecords.some((record) => variants.some((variant) => record.includes(variant)));
  }

  const missing = REQUIRED_CLASSES.filter((c) => !hasClass(c));
  return {
    requiredTotal: REQUIRED_CLASSES.length,
    requiredCompleted: REQUIRED_CLASSES.length - missing.length,
    missingClasses: missing,
    qualified: missing.length === 0,
  };
}
