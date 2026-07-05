export interface Soldier {
  userId: string;
  username: string;
  realName: string;
  rankId: string;
  rankShort: string;
  rankFull: string;
  positionTitle: string;
  mos: string;
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
