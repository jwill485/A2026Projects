import type { Battalion, Company, Platoon, Soldier, Squad } from "../types/roster";
import { classifyTier } from "./leadership";

// Scope filter for the printable roster list (§2.11): narrow the list to
// leadership tiers. Units that end up with nobody matching are pruned
// entirely, so a filtered print reads as "these people, organized by unit"
// rather than a full structure riddled with gaps.

export type ListScope = "everyone" | "leadership" | "officers" | "ncos";

export const SCOPE_OPTIONS: { value: ListScope; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "leadership", label: "Officers & NCOs only" },
  { value: "officers", label: "Officers only" },
  { value: "ncos", label: "NCOs only" },
];

function matchesScope(soldier: Soldier, scope: ListScope): boolean {
  if (scope === "everyone") return true;
  const tier = classifyTier(soldier);
  if (scope === "leadership") return tier !== "trooper";
  if (scope === "officers") return tier === "officer";
  return tier === "seniorNco" || tier === "juniorNco";
}

export function keepInScope(soldier: Soldier | null, scope: ListScope): Soldier | null {
  return soldier && matchesScope(soldier, scope) ? soldier : null;
}
const keep = keepInScope;

function filterSquad(squad: Squad, scope: ListScope): Squad | null {
  const leader = keep(squad.leader, scope);
  const members = squad.members.filter((m) => matchesScope(m, scope));
  if (!leader && members.length === 0) return null;
  return { ...squad, leader, members };
}

function filterPlatoon(platoon: Platoon, scope: ListScope): Platoon | null {
  const leader = keep(platoon.leader, scope);
  const sergeant = keep(platoon.sergeant, scope);
  const squads = platoon.squads
    .map((s) => filterSquad(s, scope))
    .filter((s): s is Squad => s !== null);
  if (!leader && !sergeant && squads.length === 0) return null;
  return { ...platoon, leader, sergeant, squads };
}

export function filterCompanyForScope(company: Company, scope: ListScope): Company | null {
  if (scope === "everyone") return company;
  const commander = keep(company.commander, scope);
  const executiveOfficer = keep(company.executiveOfficer, scope);
  const firstSergeant = keep(company.firstSergeant, scope);
  const platoons = company.platoons
    .map((p) => filterPlatoon(p, scope))
    .filter((p): p is Platoon => p !== null);
  if (!commander && !executiveOfficer && !firstSergeant && platoons.length === 0) return null;
  return { ...company, commander, executiveOfficer, firstSergeant, platoons };
}

// --- CSV export -------------------------------------------------------------

export interface ExportRow {
  company: string;
  platoon: string;
  squad: string;
  billet: string;
  rank: string;
  name: string;
  username: string;
  mos: string;
}

function row(
  soldier: Soldier | null,
  unit: { company: string; platoon?: string; squad?: string },
  billet: string,
): ExportRow[] {
  if (!soldier) return [];
  return [
    {
      company: unit.company,
      platoon: unit.platoon ?? "",
      squad: unit.squad ?? "",
      billet,
      rank: soldier.rankShort,
      name: soldier.realName,
      username: soldier.username,
      mos: soldier.mos,
    },
  ];
}

function companyRows(company: Company): ExportRow[] {
  const label =
    company.letter === "UNASSIGNED" ? "Unassigned" : `${company.name} Company (${company.letter})`;
  const rows: ExportRow[] = [
    ...row(company.commander, { company: label }, "Commanding Officer"),
    ...row(company.executiveOfficer, { company: label }, "Executive Officer"),
    ...row(company.firstSergeant, { company: label }, "First Sergeant"),
  ];
  for (const platoon of company.platoons) {
    const unit = { company: label, platoon: platoon.number };
    rows.push(...row(platoon.leader, unit, "Platoon Leader"));
    rows.push(...row(platoon.sergeant, unit, "Platoon Sergeant"));
    for (const squad of platoon.squads) {
      const squadUnit = { ...unit, squad: squad.number };
      rows.push(...row(squad.leader, squadUnit, "Squad Leader"));
      for (const member of squad.members) rows.push(...row(member, squadUnit, "Member"));
    }
  }
  return rows;
}

// Flattens whatever structures it's given — pass pre-filtered ones to export
// exactly what the list view is showing. `battalion` is optional so a
// single-company export can skip the battalion HQ rows.
export function rosterToRows(battalion: Battalion | null, companies: Company[]): ExportRow[] {
  const rows: ExportRow[] = [];
  if (battalion) {
    rows.push(...row(battalion.commander, { company: "Battalion HQ" }, "Commanding Officer"));
    rows.push(...row(battalion.executiveOfficer, { company: "Battalion HQ" }, "Executive Officer"));
    rows.push(...row(battalion.sergeantMajor, { company: "Battalion HQ" }, "Sergeant Major"));
  }
  for (const company of companies) rows.push(...companyRows(company));
  return rows;
}

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsvText(rows: ExportRow[]): string {
  const header = ["Company", "Platoon", "Squad", "Billet", "Rank", "Name", "Username", "MOS"];
  const lines = rows.map((r) =>
    [r.company, r.platoon, r.squad, r.billet, r.rank, r.name, r.username, r.mos]
      .map(csvField)
      .join(","),
  );
  return [header.join(","), ...lines].join("\r\n") + "\r\n";
}
