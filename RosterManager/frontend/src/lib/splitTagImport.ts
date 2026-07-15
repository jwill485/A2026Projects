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
  hllww2: "hllww2",
};

function stripQuotes(field: string): string {
  const trimmed = field.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

// Accepts two columns — trooper (username or real name), then tag — split on
// comma, semicolon, or tab. Extra columns are ignored so a wider spreadsheet
// export still works. A first line whose tag column isn't N/HLLV/HLLWW2 is
// treated as a header and skipped rather than reported as bad.
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
    const status = STATUS_TOKENS[(fields[1] ?? "").toLowerCase()];
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
    const key = row.name.toLowerCase();
    let soldier = byUsername.get(key);
    if (!soldier) {
      const nameMatches = byRealName.get(key) ?? [];
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
