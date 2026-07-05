export interface ApiUser {
  userId: string;
  username: string;
}

export interface ApiRank {
  rankShort: string;
  rankFull: string;
  rankImageUrl: string;
  rankId: string;
}

export interface ApiPosition {
  positionTitle: string;
  positionId: string;
}

export interface ApiLiteProfile {
  user: ApiUser | null;
  rank: ApiRank | null;
  realName: string;
  uniformUrl: string;
  roster: string;
  primary: ApiPosition | null;
  secondaries: ApiPosition[];
  joinDate: string;
  promotionDate: string;
  discordId: string;
  awardDate: string;
  recordDate: string;
  lastForumPostDate: string;
  mos: string;
  consoleGamertag: string;
}

export interface ApiLiteRoster {
  profiles: Record<string, ApiLiteProfile>;
}

export interface ApiRankExpanded {
  rankShort: string;
  rankFull: string;
  rankImageUrl: string;
  rankId: string;
  rankDisplayOrder: number;
}

export interface ApiRanksResponse {
  ranks: ApiRankExpanded[];
}
