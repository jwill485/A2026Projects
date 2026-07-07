// Battalion-split decision tag: which of the two new battalions (working
// names HLLV/HLLWW2) a trooper is currently slated for, or "neutral" if
// undecided. Unset is treated the same as "neutral" everywhere it's read.
export type SplitStatus = "neutral" | "hllv" | "hllww2";

export interface Soldier {
  userId: string;
  username: string;
  realName: string;
  rankId: string;
  rankShort: string;
  rankFull: string;
  positionTitle: string;
  mos: string;
  // Billet label at time of import from the live roster; unset for manually-created soldiers.
  originLabel?: string;
  splitStatus?: SplitStatus;
}

export interface Squad {
  number: string;
  leader: Soldier | null;
  members: Soldier[];
}

export interface Platoon {
  number: string;
  leader: Soldier | null;
  sergeant: Soldier | null;
  squads: Squad[];
}

export interface Company {
  letter: string;
  name: string;
  commander: Soldier | null;
  executiveOfficer: Soldier | null;
  firstSergeant: Soldier | null;
  platoons: Platoon[];
}

export interface Battalion {
  designation: string;
  commander: Soldier | null;
  executiveOfficer: Soldier | null;
  sergeantMajor: Soldier | null;
  companies: Company[];
}

export interface RosterData {
  battalion: Battalion;
  unassigned: Company;
}
