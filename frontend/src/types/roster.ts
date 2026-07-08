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
  // Free-text practice/drill schedule (e.g. "Tue 1900 EST"), entered on the
  // Split Planner's practice-times phase. Like splitStatus, it's planning
  // metadata: not part of diffRosters, so it never counts as a pending change.
  practiceTime?: string;
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
  // Marked "complete" in the Drag & Drop workbench: moves it to the Staged
  // section of the company picker and locks it against structural changes
  // (incoming drops/assigns, added/deleted platoons or squads) until
  // un-staged. Still fully viewable. Never set on roster.unassigned.
  staged?: boolean;
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
  // Split Planner sign-offs (§2.9): the user has accepted the practice
  // times (phase 2) / the leadership review (phase 3). Both must be set —
  // along with zero undecided troopers — before Commit Split unlocks.
  // Planning metadata like splitStatus: invisible to diffRosters.
  practiceTimesConfirmed?: boolean;
  leadershipAccepted?: boolean;
  // §2.9: Charlie Company (C/2-7) transfers to HLLV as an intact company.
  // Checking it auto-tags all of C's members HLLV; on Commit, the whole
  // company (structure, leadership, practice times) lands in HLLV's
  // battalion instead of its members going through the Unassigned pool.
  sendCharlieToHllv?: boolean;
}
