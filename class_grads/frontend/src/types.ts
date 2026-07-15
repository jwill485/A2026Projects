export interface Graduation {
  details: string;
  date: string;
}

export type Tier = "officer" | "seniorNco" | "juniorNco" | "trooper";
export type Echelon = "battalion" | "company" | "platoon" | "squad";

export interface RangerStatus {
  requiredTotal: number;
  requiredCompleted: number;
  missingClasses: string[];
  qualified: boolean;
}

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

export interface Member {
  userId: string;
  username: string;
  realName: string;
  rank: string;
  rankOrder: number;
  positionTitle: string;
  mos: string;
  battalion: string;
  company: string;
  tier: Tier;
  echelon: Echelon;
  graduations: Graduation[];
  ranger: RangerStatus;
  groups: GroupStatus[];
}
