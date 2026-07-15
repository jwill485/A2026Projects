// Mirrors the backend's groups_store.py + compute_group_status() (in
// main.py) so the CLI pull script reports the same Custom Group status the
// live web app does, reading the same groups.json the backend writes.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { Graduation } from "./ranger.ts";

export interface GroupRequirement {
  label: string;
  acceptedClasses: string[];
}

export interface Group {
  id: string;
  name: string;
  requirements: GroupRequirement[];
}

export interface GroupStatus {
  id: string;
  name: string;
  requiredTotal: number;
  requiredCompleted: number;
  missingLabels: string[];
  qualified: boolean;
}

export function loadGroups(repoRoot: string): Group[] {
  const groupsFile = path.join(repoRoot, "backend", "data", "groups.json");
  try {
    return JSON.parse(readFileSync(groupsFile, "utf-8")) as Group[];
  } catch {
    return [];
  }
}

export function computeGroupStatus(graduations: Graduation[], group: Group): GroupStatus {
  const detailSet = new Set(graduations.map((g) => g.details));
  const missingLabels = group.requirements
    .filter((req) => !req.acceptedClasses.some((c) => detailSet.has(c)))
    .map((req) => req.label);
  const total = group.requirements.length;
  return {
    id: group.id,
    name: group.name,
    requiredTotal: total,
    requiredCompleted: total - missingLabels.length,
    missingLabels,
    qualified: missingLabels.length === 0,
  };
}
