// Mirrors the position-title patterns the backend uses (backend/app/main.py's
// classify_position) so the CLI pull script and the live web app always
// agree on who counts. In scope: the three line battalions (1-7/2-7/3-7),
// the ACD holding pool, and — as of 2026-07-15 — every other active-duty
// billet (Regimental Staff, S1/S2/S6/MP/WAG/RRD/RDC, DEVCOM), bucketed under
// a synthetic "Regiment" battalion. New Recruit, test accounts, and Reserve
// titles are deliberately excluded and simply won't match any pattern below.
const BATTALION_HQ_RE = /^(\d-7) (Commanding Officer|Executive Officer|Sergeant Major)$/;
const COMPANY_HQ_RE = /^(Commander|Executive Officer|First Sergeant) ([A-Za-z])\/([\w-]+)$/;
const PLATOON_HQ_RE = /^(Platoon Leader|Platoon Sergeant) (\d+)\/([A-Za-z])\/([\w-]+)$/;
const SQUAD_RE = /^(Section Leader|Assistant Section Leader|Trooper) (\d+)\/(\d+)\/([A-Za-z])\/([\w-]+)$/;

const LINE_BATTALION_RE = /^\d-7$/;

export const REGIMENT_BATTALION = "Regiment";
const DEVCOM_DESIGNATION = "DEVCOM";

export type Tier = "officer" | "seniorNco" | "juniorNco" | "trooper";
export type Echelon = "battalion" | "company" | "platoon" | "squad";

export interface Classification {
  battalion: string;
  company: string;
  tier: Tier;
  echelon: Echelon;
}

// ACD (the holding pool) has company-level leadership of its own but no
// battalion-level HQ titles in the position-title schema — the "Auxiliary"
// unit's CO/XO/SGM fill that role in practice, so they're treated as ACD's
// Battalion HQ (user-confirmed 2026-07-14).
const AUXILIARY_ACD_HQ_ROLES: Record<string, Tier> = {
  "Auxiliary Commander": "officer",
  "Auxiliary Executive Officer": "officer",
  "Auxiliary Sergeant Major": "seniorNco",
};

// Regimental/section-staff billets use ad hoc naming (1IC/2IC/Lead/Senior
// Investigator/...) rather than the Commander/XO/1SG grid line units follow,
// so each title is mapped individually to a "company" bucket under the
// synthetic Regiment battalion. Tier for these is derived from actual rank
// (see tierFromRankOrder) rather than guessed from the title.
const REGIMENT_SECTION_ROLES: Record<string, string> = {
  "Regimental Commanding Officer": "Regimental Staff",
  "Regimental Executive Officer": "Regimental Staff",
  "Regimental Command Sergeant Major": "Regimental Staff",
  "Regimental Chief of Staff": "Regimental Staff",
  "Regimental Adjutant General": "Regimental Staff",
  "Regimental Finance Officer": "Regimental Staff",
  "Regimental Information Management Officer": "Regimental Staff",
  "Regimental Recruiting Oversight Officer": "Regimental Staff",
  "Regimental Security Operations Officer": "Regimental Staff",
  "Regimental Technical Aide": "Regimental Staff",
  "Aide to the SecOps": "Regimental Staff",
  "S1 1IC": "S1",
  "S1 Technical Aide": "S1",
  "S2 1IC": "S2",
  "S2 Senior Investigator": "S2",
  "S6 1IC": "S6",
  "S6 2IC": "S6",
  "S6 Development Staff": "S6",
  "MP 1IC": "MP",
  "WAG 1IC": "WAG",
  "RRD 1IC": "RRD",
  "RDC Commander": "RDC",
  "DEVCOM 1IC": "DEVCOM",
  "DEVCOM 2IC": "DEVCOM",
  "DEVCOM Lead": "DEVCOM",
};

function unitInScope(unit: string): boolean {
  return LINE_BATTALION_RE.test(unit) || unit === "ACD" || unit === DEVCOM_DESIGNATION;
}

// Ranks don't carry a tier field, so we bucket by rankDisplayOrder (see
// milpacs/ranks) — used only for Regiment-bucket titles whose wording
// doesn't reliably signal tier the way the line-unit grid does.
export function tierFromRankOrder(rankOrder: number | undefined | null): Tier {
  if (rankOrder == null) return "trooper";
  if (rankOrder <= 140) return "officer"; // 2LT..GOA, WO1..CW5
  if (rankOrder <= 195) return "seniorNco"; // SFC..CSM
  if (rankOrder <= 210) return "juniorNco"; // CPL/SGT/SSG
  return "trooper"; // PVT..SPC
}

// DEVCOM's own titles carry a company letter (e.g. "D") the way line-unit
// titles do, but per the Regiment-grouping decision it should surface as its
// own "DEVCOM" company bucket under Regiment rather than as company "D".
function devcomNormalized(unit: string, letter: string, tier: Tier, echelon: Echelon): Classification {
  if (unit === DEVCOM_DESIGNATION) {
    return { battalion: REGIMENT_BATTALION, company: DEVCOM_DESIGNATION, tier, echelon };
  }
  return { battalion: unit, company: letter, tier, echelon };
}

export function classifyPosition(
  positionTitle: string | undefined | null,
  rankOrder?: number | undefined | null,
): Classification | null {
  if (!positionTitle) return null;

  if (positionTitle in AUXILIARY_ACD_HQ_ROLES) {
    return {
      battalion: "ACD",
      company: "HQ",
      tier: AUXILIARY_ACD_HQ_ROLES[positionTitle],
      echelon: "battalion",
    };
  }

  if (positionTitle in REGIMENT_SECTION_ROLES) {
    return {
      battalion: REGIMENT_BATTALION,
      company: REGIMENT_SECTION_ROLES[positionTitle],
      tier: tierFromRankOrder(rankOrder),
      echelon: "company",
    };
  }

  const battalionMatch = positionTitle.match(BATTALION_HQ_RE);
  if (battalionMatch) {
    const [, designation, role] = battalionMatch;
    if (!unitInScope(designation)) return null;
    const tier: Tier = role === "Sergeant Major" ? "seniorNco" : "officer";
    return { battalion: designation, company: "HQ", tier, echelon: "battalion" };
  }

  const companyMatch = positionTitle.match(COMPANY_HQ_RE);
  if (companyMatch) {
    const [, role, letter, unit] = companyMatch;
    if (!unitInScope(unit)) return null;
    const tier: Tier = role === "First Sergeant" ? "seniorNco" : "officer";
    return devcomNormalized(unit, letter, tier, "company");
  }

  const platoonMatch = positionTitle.match(PLATOON_HQ_RE);
  if (platoonMatch) {
    const [, role, , letter, unit] = platoonMatch;
    if (!unitInScope(unit)) return null;
    const tier: Tier = role === "Platoon Sergeant" ? "seniorNco" : "officer";
    return devcomNormalized(unit, letter, tier, "platoon");
  }

  const squadMatch = positionTitle.match(SQUAD_RE);
  if (squadMatch) {
    const [, role, , , letter, unit] = squadMatch;
    if (!unitInScope(unit)) return null;
    const tier: Tier = role === "Trooper" ? "trooper" : "juniorNco";
    return devcomNormalized(unit, letter, tier, "squad");
  }

  return null;
}
