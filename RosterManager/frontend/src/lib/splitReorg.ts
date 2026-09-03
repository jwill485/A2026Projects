import type { Battalion, Company, IntactTransfer, Platoon, RosterData, Soldier, SplitStatus } from "../types/roster";
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

// Company letter -> the status an intact transfer forces on everyone in it,
// overriding their personal tag (same precedent as collectIntactCompanies
// above). Charlie's transfer also covers the Unassigned pool, since B/ACD
// currently holds Charlie's real people (see CHARLIE_LETTER).
function buildIntactStatusMap(intactTransfers: IntactTransfer[]): Map<string, SplitStatus> {
  const map = new Map<string, SplitStatus>();
  for (const transfer of intactTransfers) map.set(transfer.letter, transfer.status);
  const charlieStatus = map.get(CHARLIE_LETTER);
  if (charlieStatus) map.set("UNASSIGNED", charlieStatus);
  return map;
}

// Builds a new battalion roster for HLLV by mirroring the source roster's
// actual current structure wholesale, rather than flattening everyone into
// an empty pool the way buildSplitRoster does for HLLWW2. HLLV inherits
// almost all of 2-7 as-is; only the minority leaving for HLLWW2 should
// create any visible change, so the whole tree is cloned and only the
// billets held by people *not* staying get vacated in place. Combined with
// Commit Split's baseline-saved-identical-to-built behavior, this means
// nobody who keeps their billet ever shows up as a "change" — only someone
// later moved into (or out of) a billet does, via the existing
// diffRosters/computeTransfers machinery in changelog.ts.
export function buildMirroredRoster(
  source: RosterData,
  status: SplitStatus,
  designation: string,
  intactTransfers: IntactTransfer[] = [],
): RosterData {
  const battalion: Battalion = structuredClone(source.battalion);
  battalion.designation = designation;
  const unassigned: Company = structuredClone(source.unassigned);

  const intactByLetter = buildIntactStatusMap(intactTransfers);
  // A company's intact-transfer status overrides every member's personal
  // tag; absent one, a soldier keeps their own tag. Battalion HQ has no
  // company letter, so "" never matches an intact transfer and this always
  // falls through to the soldier's own tag there.
  function keeps(soldier: Soldier, companyLetter: string): boolean {
    const effective = intactByLetter.get(companyLetter) ?? soldier.splitStatus ?? "neutral";
    return effective === status;
  }

  function vacateCompany(company: Company): void {
    if (company.commander && !keeps(company.commander, company.letter)) company.commander = null;
    if (company.executiveOfficer && !keeps(company.executiveOfficer, company.letter)) {
      company.executiveOfficer = null;
    }
    if (company.firstSergeant && !keeps(company.firstSergeant, company.letter)) company.firstSergeant = null;
    for (const platoon of company.platoons) {
      if (platoon.leader && !keeps(platoon.leader, company.letter)) platoon.leader = null;
      if (platoon.sergeant && !keeps(platoon.sergeant, company.letter)) platoon.sergeant = null;
      for (const squad of platoon.squads) {
        if (squad.leader && !keeps(squad.leader, company.letter)) squad.leader = null;
        if (squad.assistantLeader && !keeps(squad.assistantLeader, company.letter)) {
          squad.assistantLeader = null;
        }
        squad.members = squad.members.filter((m) => keeps(m, company.letter));
      }
    }
  }

  if (battalion.commander && !keeps(battalion.commander, "")) battalion.commander = null;
  if (battalion.executiveOfficer && !keeps(battalion.executiveOfficer, "")) battalion.executiveOfficer = null;
  if (battalion.sergeantMajor && !keeps(battalion.sergeantMajor, "")) battalion.sergeantMajor = null;
  for (const company of battalion.companies) vacateCompany(company);
  vacateCompany(unassigned);

  // The tag's job is done once committed — same convention buildSplitRoster
  // follows for its own troopers.
  for (const soldier of collectAllSoldiers({ battalion, unassigned })) delete soldier.splitStatus;

  return { battalion, unassigned };
}

export interface VacancyChain {
  // e.g. "Able (A) — Commander", matching computeVacancyReport's label style.
  billetLabel: string;
  // Structural units (not people) that sit below this billet in the chain
  // of command — e.g. ["Platoon 1", "Platoon 1 / Squad 1", ...] for a
  // company-level vacancy. Empty for a squad-level vacancy (nothing below
  // a squad).
  affectedUnits: string[];
}

function companyLabel(company: Company): string {
  return company.letter === "UNASSIGNED" ? "Unassigned" : `${company.name} (${company.letter})`;
}

function companySubUnits(company: Company): string[] {
  const units: string[] = [];
  for (const platoon of company.platoons) {
    units.push(`Platoon ${platoon.number}`);
    for (const squad of platoon.squads) units.push(`Platoon ${platoon.number} / Squad ${squad.number}`);
  }
  return units;
}

function platoonSubUnits(platoon: Platoon): string[] {
  return platoon.squads.map((squad) => `Platoon ${platoon.number} / Squad ${squad.number}`);
}

// Compares a source roster against a mirrored roster built from it (see
// buildMirroredRoster) and reports every *leadership* billet (Assistant
// Squad Leader and plain members excluded, same convention
// computeVacancyReport in analytics.ts follows) that was filled in `before`
// and is vacant in `after`, along with the structural units beneath it —
// so a leadership hole is visible together with everything under it that
// now needs attention, not just the single slot. Computed live from
// whatever the two rosters currently look like, the same way
// SuggestionPreview/buildSuggestions are computed live from the source
// roster's current tags rather than frozen at commit time.
export function computeNewVacancyChains(before: RosterData, after: RosterData): VacancyChain[] {
  const chains: VacancyChain[] = [];

  // True when a slot held someone in `before` and is empty in `after`.
  const opened = (beforeSlot: Soldier | null, afterSlot: Soldier | null) => Boolean(beforeSlot) && !afterSlot;

  if (opened(before.battalion.commander, after.battalion.commander)) {
    chains.push({
      billetLabel: `${after.battalion.designation} Battalion — Commanding Officer`,
      affectedUnits: after.battalion.companies.map(companyLabel),
    });
  }
  if (opened(before.battalion.executiveOfficer, after.battalion.executiveOfficer)) {
    chains.push({
      billetLabel: `${after.battalion.designation} Battalion — Executive Officer`,
      affectedUnits: after.battalion.companies.map(companyLabel),
    });
  }
  if (opened(before.battalion.sergeantMajor, after.battalion.sergeantMajor)) {
    chains.push({
      billetLabel: `${after.battalion.designation} Battalion — Sergeant Major`,
      affectedUnits: after.battalion.companies.map(companyLabel),
    });
  }

  const beforeCompanies = new Map(before.battalion.companies.map((c) => [c.letter, c]));
  for (const company of after.battalion.companies) {
    const beforeCompany = beforeCompanies.get(company.letter);
    if (!beforeCompany) continue;
    const label = companyLabel(company);

    if (opened(beforeCompany.commander, company.commander)) {
      chains.push({ billetLabel: `${label} — Commander`, affectedUnits: companySubUnits(company) });
    }
    if (opened(beforeCompany.executiveOfficer, company.executiveOfficer)) {
      chains.push({ billetLabel: `${label} — Executive Officer`, affectedUnits: companySubUnits(company) });
    }
    if (opened(beforeCompany.firstSergeant, company.firstSergeant)) {
      chains.push({ billetLabel: `${label} — First Sergeant`, affectedUnits: companySubUnits(company) });
    }

    const beforePlatoons = new Map(beforeCompany.platoons.map((p) => [p.number, p]));
    for (const platoon of company.platoons) {
      const beforePlatoon = beforePlatoons.get(platoon.number);
      if (!beforePlatoon) continue;

      if (opened(beforePlatoon.leader, platoon.leader)) {
        chains.push({
          billetLabel: `${label} — Platoon ${platoon.number} Leader`,
          affectedUnits: platoonSubUnits(platoon),
        });
      }
      if (opened(beforePlatoon.sergeant, platoon.sergeant)) {
        chains.push({
          billetLabel: `${label} — Platoon ${platoon.number} Sergeant`,
          affectedUnits: platoonSubUnits(platoon),
        });
      }

      const beforeSquads = new Map(beforePlatoon.squads.map((s) => [s.number, s]));
      for (const squad of platoon.squads) {
        const beforeSquad = beforeSquads.get(squad.number);
        if (!beforeSquad) continue;
        if (opened(beforeSquad.leader, squad.leader)) {
          chains.push({
            billetLabel: `${label} — Platoon ${platoon.number} / Squad ${squad.number} Leader`,
            affectedUnits: [],
          });
        }
      }
    }
  }

  return chains;
}
