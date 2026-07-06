import type { RosterData } from "../types/roster";

const STORAGE_KEY = "roster-manager:roster-data";
const BASELINE_KEY = "roster-manager:roster-baseline";
const CHANGELOG_KEY = "roster-manager:changelog";

export interface ChangeLogEntry {
  timestamp: string;
  changes: string[];
}

function loadJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadStoredRoster(): RosterData | null {
  return loadJson<RosterData>(STORAGE_KEY);
}

export function saveRoster(roster: RosterData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(roster));
}

export function clearStoredRoster(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function loadBaseline(): RosterData | null {
  return loadJson<RosterData>(BASELINE_KEY);
}

export function saveBaseline(roster: RosterData): void {
  localStorage.setItem(BASELINE_KEY, JSON.stringify(roster));
}

export function loadChangeLog(): ChangeLogEntry[] {
  return loadJson<ChangeLogEntry[]>(CHANGELOG_KEY) ?? [];
}

export function saveChangeLog(entries: ChangeLogEntry[]): void {
  localStorage.setItem(CHANGELOG_KEY, JSON.stringify(entries));
}

export function clearChangeLog(): void {
  localStorage.removeItem(CHANGELOG_KEY);
}
