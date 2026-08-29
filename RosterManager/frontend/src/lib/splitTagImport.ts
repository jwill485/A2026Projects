import type { RosterData, SplitStatus } from "../types/roster";
import { collectAllSoldiers } from "./analytics";

// Bulk-import of split tags from a CSV/spreadsheet export (§2.9 phase 1):
// each line names a trooper and which battalion they're slated for, so the
// sorting decision can be made offline and applied in one shot instead of
// clicking the N/HLLV/HLLWW2 toggle once per person.

export interface SplitTagRow {
  name: string;
  status: SplitStatus;
}

export interface ParsedSplitTagCsv {
  rows: SplitTagRow[];
  // 1-based line numbers, for pointing the user at what to fix.
  badLines: { line: number; text: string }[];
}

const STATUS_TOKENS: Record<string, SplitStatus> = {
  n: "neutral",
  neutral: "neutral",
  hllv: "hllv",
  "hell let loose vietnam": "hllv",
  hllww2: "hllww2",
  "hell let loose ww2": "hllww2",
};

function stripQuotes(field: string): string {
  const trimmed = field.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

// The tag column isn't always field 1 — the real source for this is a
// survey export with an extra "Section" column between the name and the
// answer (e.g. "Pfc.Melon.DJ" / "1/A/2-7 HQ" / "Hell Let Loose Vietnam").
// Scanning every column after the name for a recognized token handles that
// layout, the plain two-column format, and anything in between.
function findStatus(fields: string[]): SplitStatus | undefined {
  for (let i = 1; i < fields.length; i++) {
    const status = STATUS_TOKENS[fields[i].toLowerCase()];
    if (status !== undefined) return status;
  }
  return undefined;
}

// Accepts trooper name (field 0) plus a tag somewhere in the remaining
// columns — split on comma, semicolon, or tab. A first line with no
// recognized tag is treated as a header and skipped rather than reported
// as bad.
export function parseSplitTagCsv(text: string): ParsedSplitTagCsv {
  const rows: SplitTagRow[] = [];
  const badLines: { line: number; text: string }[] = [];
  const lines = text.split(/\r?\n/);
  let firstNonEmptySeen = false;

  lines.forEach((raw, index) => {
    if (raw.trim() === "") return;
    const isFirstNonEmpty = !firstNonEmptySeen;
    firstNonEmptySeen = true;
    const fields = raw.split(/[,;\t]/).map(stripQuotes);
    const name = fields[0] ?? "";
    const status = findStatus(fields);
    if (name === "" || status === undefined) {
      if (!isFirstNonEmpty) badLines.push({ line: index + 1, text: raw.trim() });
      return; // a bad first line is assumed to be a header row
    }
    rows.push({ name, status });
  });

  return { rows, badLines };
}

export interface SplitTagImportResult {
  roster: RosterData;
  applied: number;
  notFound: string[];
  // Real names shared by more than one trooper — skipped rather than guessed at.
  ambiguous: string[];
}

// The survey export names a trooper "Rank.Last.F" (e.g. "Pfc.Melon.DJ")
// rather than the bare "Last.F" username, so the leading rank segment is
// tried both present and stripped — no canonical rank list needed, since a
// stripped name that happens to be wrong just fails to match anything.
function nameCandidates(name: string): string[] {
  const parts = name.split(".");
  return parts.length > 1 ? [name, parts.slice(1).join(".")] : [name];
}

// Matches each row against the roster by username first (the unique MILPACS
// handle, e.g. "Cameron.J"), then by real name as a fallback for hand-typed
// lists; both case-insensitive. Later rows for the same trooper win.
export function applySplitTags(roster: RosterData, rows: SplitTagRow[]): SplitTagImportResult {
  const clone = structuredClone(roster);
  const everyone = collectAllSoldiers(clone);

  const byUsername = new Map(everyone.map((s) => [s.username.toLowerCase(), s]));
  const byRealName = new Map<string, typeof everyone>();
  for (const soldier of everyone) {
    const key = soldier.realName.toLowerCase();
    byRealName.set(key, [...(byRealName.get(key) ?? []), soldier]);
  }

  let applied = 0;
  const notFound: string[] = [];
  const ambiguous: string[] = [];
  for (const row of rows) {
    const candidates = nameCandidates(row.name).map((c) => c.toLowerCase());
    let soldier = candidates.map((key) => byUsername.get(key)).find((s) => s !== undefined);
    if (!soldier) {
      const nameMatches = candidates.map((key) => byRealName.get(key) ?? []).find((m) => m.length > 0) ?? [];
      if (nameMatches.length > 1) {
        ambiguous.push(row.name);
        continue;
      }
      soldier = nameMatches[0];
    }
    if (!soldier) {
      notFound.push(row.name);
      continue;
    }
    soldier.splitStatus = row.status;
    applied += 1;
  }

  return { roster: clone, applied, notFound, ambiguous };
}
