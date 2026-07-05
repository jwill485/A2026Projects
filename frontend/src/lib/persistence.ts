import type { RosterData } from "../types/roster";

const STORAGE_KEY = "roster-manager:roster-data";

export function loadStoredRoster(): RosterData | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RosterData;
  } catch {
    return null;
  }
}

export function saveRoster(roster: RosterData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(roster));
}

export function clearStoredRoster(): void {
  localStorage.removeItem(STORAGE_KEY);
}
