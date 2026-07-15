import type { ApiLiteRoster, ApiRanksResponse } from "../types/api";

const BACKEND_URL = import.meta.env.VITE_ROSTER_BACKEND_URL || "http://localhost:8000";

export async function fetchCombatRoster(): Promise<ApiLiteRoster> {
  const response = await fetch(`${BACKEND_URL}/api/roster/ROSTER_TYPE_COMBAT`);
  if (!response.ok) {
    throw new Error(`Roster request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function fetchRanks(): Promise<ApiRanksResponse> {
  const response = await fetch(`${BACKEND_URL}/api/ranks`);
  if (!response.ok) {
    throw new Error(`Ranks request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
