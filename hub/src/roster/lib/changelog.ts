import type { Company, RosterData, Soldier } from "../types/roster";
import type { SlotPath } from "./moveSoldier";

export interface LocationInfo {
  label: string;
  soldier: Soldier;
  // Structural billet the soldier currently occupies — see SlotPath. Used
  // by leadership.ts to classify tier by billet rather than rank.
  kind: SlotPath["kind"];
  // Raw structural fields behind `label`, for callers that need the pieces
  // rather than the human-readable string — see slashPath()/billetPhrase()
  // below, used by the Transfer Post generator. Unset battalion/platoon/
  // squad fields mean "not applicable at this kind" (e.g. no platoon number
  // for a company-level billet).
  battalionDesignation: string;
  companyLetter: string;
  platoonNumber?: string;
  squadNumber?: string;
}

function describeCompany(
  company: Company,
  battalionDesignation: string,
  map: Map<string, LocationInfo>,
): void {
  const companyLabel =
    company.letter === "UNASSIGNED" ? "Unassigned" : `${company.name} (${company.letter})`;
  if (company.commander)
    map.set(company.commander.userId, {
      label: `${companyLabel} — Commander`,
      soldier: company.commander,
      kind: "companyCommander",
      battalionDesignation,
      companyLetter: company.letter,
    });
  if (company.executiveOfficer)
    map.set(company.executiveOfficer.userId, {
      label: `${companyLabel} — Executive Officer`,
      soldier: company.executiveOfficer,
      kind: "companyXO",
      battalionDesignation,
      companyLetter: company.letter,
    });
  if (company.firstSergeant)
    map.set(company.firstSergeant.userId, {
      label: `${companyLabel} — First Sergeant`,
      soldier: company.firstSergeant,
      kind: "company1SG",
      battalionDesignation,
      companyLetter: company.letter,
    });
  for (const platoon of company.platoons) {
    if (platoon.leader)
      map.set(platoon.leader.userId, {
        label: `${companyLabel} — Platoon ${platoon.number} Leader`,
        soldier: platoon.leader,
        kind: "platoonLeader",
        battalionDesignation,
        companyLetter: company.letter,
        platoonNumber: platoon.number,
      });
    if (platoon.sergeant)
      map.set(platoon.sergeant.userId, {
        label: `${companyLabel} — Platoon ${platoon.number} Sergeant`,
        soldier: platoon.sergeant,
        kind: "platoonSergeant",
        battalionDesignation,
        companyLetter: company.letter,
        platoonNumber: platoon.number,
      });
    for (const squad of platoon.squads) {
      if (squad.leader)
        map.set(squad.leader.userId, {
          label: `${companyLabel} — Platoon ${platoon.number} / Squad ${squad.number} Leader`,
          soldier: squad.leader,
          kind: "squadLeader",
          battalionDesignation,
          companyLetter: company.letter,
          platoonNumber: platoon.number,
          squadNumber: squad.number,
        });
      if (squad.assistantLeader)
        map.set(squad.assistantLeader.userId, {
          label: `${companyLabel} — Platoon ${platoon.number} / Squad ${squad.number} Assistant Leader`,
          soldier: squad.assistantLeader,
          kind: "squadAssistantLeader",
          battalionDesignation,
          companyLetter: company.letter,
          platoonNumber: platoon.number,
          squadNumber: squad.number,
        });
      for (const member of squad.members) {
        map.set(member.userId, {
          label: `${companyLabel} — Platoon ${platoon.number} / Squad ${squad.number} Member`,
          soldier: member,
          kind: "squadMember",
          battalionDesignation,
          companyLetter: company.letter,
          platoonNumber: platoon.number,
          squadNumber: squad.number,
        });
      }
    }
  }
}

export function describeSoldierLocations(roster: RosterData): Map<string, LocationInfo> {
  const map = new Map<string, LocationInfo>();
  const battalionDesignation = roster.battalion.designation;
  if (roster.battalion.commander)
    map.set(roster.battalion.commander.userId, {
      label: "Battalion HQ — Commander",
      soldier: roster.battalion.commander,
      kind: "battalionCommander",
      battalionDesignation,
      companyLetter: "HQ",
    });
  if (roster.battalion.executiveOfficer)
    map.set(roster.battalion.executiveOfficer.userId, {
      label: "Battalion HQ — Executive Officer",
      soldier: roster.battalion.executiveOfficer,
      kind: "battalionXO",
      battalionDesignation,
      companyLetter: "HQ",
    });
  if (roster.battalion.sergeantMajor)
    map.set(roster.battalion.sergeantMajor.userId, {
      label: "Battalion HQ — Sergeant Major",
      soldier: roster.battalion.sergeantMajor,
      kind: "battalionSGM",
      battalionDesignation,
      companyLetter: "HQ",
    });
  for (const company of roster.battalion.companies) describeCompany(company, battalionDesignation, map);
  describeCompany(roster.unassigned, battalionDesignation, map);
  return map;
}

// Soldier.originLabel is a full location label (e.g. "Baker (B) — Platoon 2
// / Squad 1 Member") captured whenever someone lands somewhere new from
// outside the roster — imported via +Import Trooper/+Import Company, or
// flattened into a split-output battalion's pool (see buildSplitRoster).
// Trims it down to just the company-level part for a coarser "former unit"
// filter (Drag & Drop's Pool panel) — the platoon/squad detail is too
// granular to be a useful filter bucket.
export function originCompanyLabel(soldier: Soldier): string | undefined {
  const label = soldier.originLabel;
  if (!label) return undefined;
  const separatorIndex = label.indexOf(" — ");
  return separatorIndex === -1 ? label : label.slice(0, separatorIndex);
}

function soldierLabel(soldier: Soldier): string {
  return soldier.username
    ? `${soldier.rankShort} ${soldier.realName} (${soldier.username})`
    : `${soldier.rankShort} ${soldier.realName}`;
}

export function diffRosters(baseline: RosterData, current: RosterData): string[] {
  const before = describeSoldierLocations(baseline);
  const after = describeSoldierLocations(current);
  const lines: string[] = [];
  const allIds = new Set([...before.keys(), ...after.keys()]);
  for (const id of allIds) {
    const b = before.get(id);
    const a = after.get(id);
    if (b && a && b.label !== a.label) {
      lines.push(`${soldierLabel(a.soldier)}: ${b.label} → ${a.label}`);
    } else if (!b && a) {
      const origin = a.soldier.originLabel;
      lines.push(
        origin
          ? `${soldierLabel(a.soldier)}: from ${origin} → ${a.label}`
          : `${soldierLabel(a.soldier)}: (new) → ${a.label}`,
      );
    } else if (b && !a) {
      lines.push(`${soldierLabel(b.soldier)}: ${b.label} → (removed from roster)`);
    }
  }
  return lines.sort();
}

// Slash-path notation matching the live 7Cav position-title convention
// (e.g. "Trooper 2/2/E/2-7") — platoon/squad/company/battalion, only as
// many segments as the billet has. "Unassigned" isn't a real company, so
// it gets a plain label instead of a path.
function slashPath(loc: LocationInfo): string {
  if (loc.companyLetter === "UNASSIGNED") return "Unassigned";
  switch (loc.kind) {
    case "battalionCommander":
    case "battalionXO":
    case "battalionSGM":
      return loc.battalionDesignation;
    case "companyCommander":
    case "companyXO":
    case "company1SG":
      return `${loc.companyLetter}/${loc.battalionDesignation}`;
    case "platoonLeader":
    case "platoonSergeant":
      return `${loc.platoonNumber}/${loc.companyLetter}/${loc.battalionDesignation}`;
    case "squadLeader":
    case "squadAssistantLeader":
    case "squadMember":
      return `${loc.platoonNumber}/${loc.squadNumber}/${loc.companyLetter}/${loc.battalionDesignation}`;
    case "unassignedPool":
      // Never actually produced by describeSoldierLocations (that kind is
      // only used as a Drag & Drop pool drop-target marker elsewhere), but
      // LocationInfo shares SlotPath's full kind union.
      return "Unassigned";
  }
}

// How a billet reads in "...Assigned to <path> as <phrase>". Deliberately
// prose, not the raw position title (e.g. "the Squad Leader", not "Squad
// Leader D/1/2/E/2-7").
function billetPhrase(kind: SlotPath["kind"]): string {
  switch (kind) {
    case "battalionCommander":
      return "the Battalion Commander";
    case "battalionXO":
      return "the Battalion Executive Officer";
    case "battalionSGM":
      return "the Battalion Sergeant Major";
    case "companyCommander":
      return "the Company Commander";
    case "companyXO":
      return "the Company Executive Officer";
    case "company1SG":
      return "the First Sergeant";
    case "platoonLeader":
      return "the Platoon Leader";
    case "platoonSergeant":
      return "the Platoon Sergeant";
    case "squadLeader":
      return "the Squad Leader";
    case "squadAssistantLeader":
      return "the Assistant Squad Leader";
    case "squadMember":
      return "a trooper";
    case "unassignedPool":
      return "unassigned";
  }
}

export interface TransferPost {
  soldier: Soldier;
  fromPath: string;
  toPath: string;
  billetPhrase: string;
}

export function milpacsProfileUrl(userId: string): string {
  return `https://7cav.us/rosters/profile/${userId}/`;
}

// Structured counterpart to diffRosters(), computed at the same moment
// (baseline vs. current, at Save time) so it has access to full Soldier
// records — Change Log entries only persist the formatted string lines,
// not the rosters they came from, so this can't be reconstructed later.
// Only covers actual A→B moves (matching "changed to a unit other than
// their original") — new arrivals and removals have no clean "from"/"to"
// and are left out.
export function computeTransfers(baseline: RosterData, current: RosterData): TransferPost[] {
  const before = describeSoldierLocations(baseline);
  const after = describeSoldierLocations(current);
  const transfers: TransferPost[] = [];
  for (const [id, a] of after) {
    const b = before.get(id);
    if (!b || b.label === a.label) continue;
    transfers.push({
      soldier: a.soldier,
      fromPath: slashPath(b),
      toPath: slashPath(a),
      billetPhrase: billetPhrase(a.kind),
    });
  }
  return transfers.sort((x, y) => x.soldier.realName.localeCompare(y.soldier.realName));
}

// BBCode, matching 7cav.us's XenForo post editor — paste directly into a
// new thread/post.
export function transferPostSentence(t: TransferPost): string {
  const link = `[URL=${milpacsProfileUrl(t.soldier.userId)}]${t.soldier.username}[/URL]`;
  return `${t.soldier.rankFull} ${link} is hereby Transferred from ${t.fromPath} and Assigned to ${t.toPath} as ${t.billetPhrase}, MOS ${t.soldier.mos}.`;
}
