// Mirrors the position-title patterns the backend uses (backend/app/main.py's
// classify_position) so the CLI pull script and the live web app always
// agree on who counts. In scope: the three line battalions (1-7/2-7/3-7)
// and the ACD holding pool — Regimental Staff, DEVCOM, and titles with no
// company/platoon/squad structure (New Recruit, test accounts) are
// deliberately excluded and simply won't match any pattern below.
const BATTALION_HQ_RE = /^(\d-7) (Commanding Officer|Executive Officer|Sergeant Major)$/;
const COMPANY_HQ_RE = /^(Commander|Executive Officer|First Sergeant) ([A-Za-z])\/([\w-]+)$/;
const PLATOON_HQ_RE = /^(Platoon Leader|Platoon Sergeant) (\d+)\/([A-Za-z])\/([\w-]+)$/;
const SQUAD_RE = /^(Section Leader|Assistant Section Leader|Trooper) (\d+)\/(\d+)\/([A-Za-z])\/([\w-]+)$/;

const LINE_BATTALION_RE = /^\d-7$/;

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

function unitInScope(unit: string): boolean {
  return LINE_BATTALION_RE.test(unit) || unit === "ACD";
}

export function classifyPosition(positionTitle: string | undefined | null): Classification | null {
  if (!positionTitle) return null;

  if (positionTitle in AUXILIARY_ACD_HQ_ROLES) {
    return {
      battalion: "ACD",
      company: "HQ",
      tier: AUXILIARY_ACD_HQ_ROLES[positionTitle],
      echelon: "battalion",
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
    return { battalion: unit, company: letter, tier, echelon: "company" };
  }

  const platoonMatch = positionTitle.match(PLATOON_HQ_RE);
  if (platoonMatch) {
    const [, role, , letter, unit] = platoonMatch;
    if (!unitInScope(unit)) return null;
    const tier: Tier = role === "Platoon Sergeant" ? "seniorNco" : "officer";
    return { battalion: unit, company: letter, tier, echelon: "platoon" };
  }

  const squadMatch = positionTitle.match(SQUAD_RE);
  if (squadMatch) {
    const [, role, , , letter, unit] = squadMatch;
    if (!unitInScope(unit)) return null;
    const tier: Tier = role === "Trooper" ? "trooper" : "juniorNco";
    return { battalion: unit, company: letter, tier, echelon: "squad" };
  }

  return null;
}
