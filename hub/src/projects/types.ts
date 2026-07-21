export type Status = "planning" | "active" | "complete" | "shelved";
export type Priority = "low" | "medium" | "high";

export interface Project {
  id: string;
  name: string;
  description: string;
  status: Status;
  owner: string;
  priority: Priority;
  category: string;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInput {
  name: string;
  description: string;
  status: Status;
  owner: string;
  priority: Priority;
  category: string;
  targetDate: string | null;
}
