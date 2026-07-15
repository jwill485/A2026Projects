export interface ApiUser {
  userId: string;
  username: string;
}

export interface ApiRank {
  rankShort: string;
  rankFull: string;
  rankId: string;
}

export interface ApiPosition {
  positionTitle: string;
  positionId: string;
}

export interface ApiRecord {
  recordDetails: string;
  recordType: string;
  recordDate: string;
  recordUid: string;
}

export interface ApiFullProfile {
  user: ApiUser | null;
  rank: ApiRank | null;
  realName: string;
  primary: ApiPosition | null;
  secondaries: ApiPosition[];
  records: ApiRecord[];
  mos: string;
}

export interface ApiFullRoster {
  profiles: Record<string, ApiFullProfile>;
}
