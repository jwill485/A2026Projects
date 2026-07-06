import type { RosterData } from "../types/roster";

const INDEX_KEY = "roster-manager:index";
const ACTIVE_ID_KEY = "roster-manager:active-id";
const LEGACY_ROSTER_KEY = "roster-manager:roster-data";
const LEGACY_BASELINE_KEY = "roster-manager:roster-baseline";
const LEGACY_CHANGELOG_KEY = "roster-manager:changelog";

function rosterKey(id: string): string {
  return `roster-manager:roster:${id}`;
}
function baselineKey(id: string): string {
  return `roster-manager:baseline:${id}`;
}
function changeLogKey(id: string): string {
  return `roster-manager:changelog:${id}`;
}

export interface ChangeLogEntry {
  timestamp: string;
  changes: string[];
}

export interface RosterSummary {
  id: string;
  name: string;
  updatedAt: string;
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

export function listRosters(): RosterSummary[] {
  return loadJson<RosterSummary[]>(INDEX_KEY) ?? [];
}

function saveIndex(index: RosterSummary[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function getActiveRosterId(): string | null {
  return localStorage.getItem(ACTIVE_ID_KEY);
}

export function setActiveRosterId(id: string): void {
  localStorage.setItem(ACTIVE_ID_KEY, id);
}

export function loadRoster(id: string): RosterData | null {
  return loadJson<RosterData>(rosterKey(id));
}

export function saveRoster(id: string, roster: RosterData): void {
  localStorage.setItem(rosterKey(id), JSON.stringify(roster));
}

export function loadBaseline(id: string): RosterData | null {
  return loadJson<RosterData>(baselineKey(id));
}

export function saveBaseline(id: string, roster: RosterData): void {
  localStorage.setItem(baselineKey(id), JSON.stringify(roster));
}

export function loadChangeLog(id: string): ChangeLogEntry[] {
  return loadJson<ChangeLogEntry[]>(changeLogKey(id)) ?? [];
}

export function saveChangeLog(id: string, entries: ChangeLogEntry[]): void {
  localStorage.setItem(changeLogKey(id), JSON.stringify(entries));
}

export function clearChangeLog(id: string): void {
  localStorage.removeItem(changeLogKey(id));
}

function touchIndexEntry(id: string): void {
  const index = listRosters();
  const entry = index.find((r) => r.id === id);
  if (entry) {
    entry.updatedAt = new Date().toISOString();
    saveIndex(index);
  }
}

export function touchRoster(id: string): void {
  touchIndexEntry(id);
}

export function createRoster(name: string, roster: RosterData, baseline: RosterData = roster): string {
  const id = crypto.randomUUID();
  saveRoster(id, roster);
  saveBaseline(id, baseline);
  saveChangeLog(id, []);
  const index = listRosters();
  index.push({ id, name, updatedAt: new Date().toISOString() });
  saveIndex(index);
  return id;
}

export function renameRoster(id: string, name: string): void {
  const index = listRosters();
  const entry = index.find((r) => r.id === id);
  if (entry) {
    entry.name = name;
    saveIndex(index);
  }
}

export function deleteRoster(id: string): void {
  localStorage.removeItem(rosterKey(id));
  localStorage.removeItem(baselineKey(id));
  localStorage.removeItem(changeLogKey(id));
  saveIndex(listRosters().filter((r) => r.id !== id));
}

/**
 * One-time upgrade from the old single-roster storage scheme (fixed keys,
 * no name/id) into the first entry of the new named-roster index. No-ops if
 * the index already exists or there was never a legacy roster saved.
 */
export function migrateLegacyStorage(): void {
  if (listRosters().length > 0) return;
  const legacyRoster = loadJson<RosterData>(LEGACY_ROSTER_KEY);
  if (!legacyRoster) return;
  const legacyBaseline = loadJson<RosterData>(LEGACY_BASELINE_KEY) ?? legacyRoster;
  const legacyChangeLog = loadJson<ChangeLogEntry[]>(LEGACY_CHANGELOG_KEY) ?? [];
  const id = createRoster("2-7 Cavalry Battalion", legacyRoster, legacyBaseline);
  saveChangeLog(id, legacyChangeLog);
  setActiveRosterId(id);
  localStorage.removeItem(LEGACY_ROSTER_KEY);
  localStorage.removeItem(LEGACY_BASELINE_KEY);
  localStorage.removeItem(LEGACY_CHANGELOG_KEY);
}
