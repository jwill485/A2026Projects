import type { Priority, Status } from "./types";

export const STATUS_ORDER: Status[] = ["planning", "active", "complete", "shelved"];

export const STATUS_LABELS: Record<Status, string> = {
  planning: "Planning",
  active: "Active",
  complete: "Complete",
  shelved: "Shelved",
};

export const PRIORITY_ORDER: Priority[] = ["high", "medium", "low"];

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};
