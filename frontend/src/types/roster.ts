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
  // Assistant Section Leader in the live 7Cav data — a real, distinct
  // billet, not just another member. Optional in practice: most squads
  // don't have one filled, so it's excluded from vacancy/fill-rate
  // reporting (see analytics.ts) to avoid flooding those with noise.
  assistantLeader: Soldier | null;
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
  // Same "Mark complete" concept as Company.staged, one level up: locks
  // Battalion HQ (CO/XO/SGM) against reassignment once its leadership is
  // settled. Independent of any individual company's staged state.
  staged?: boolean;
}

// One company sent to a battalion as an intact unit on Commit Split —
// structure, leadership, and practice times carried over, its members
// bypassing the Unassigned pool entirely rather than going through the
// per-trooper N/HLLV/HLLWW2 sort. See splitReorg.ts.
export interface IntactTransfer {
  letter: string;
  status: SplitStatus;
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
  // §2.9: any number of companies can each transfer to either battalion as
  // an intact unit — see IntactTransfer. Setting one auto-tags that
  // company's members with its destination status.
  intactTransfers?: IntactTransfer[];
}
