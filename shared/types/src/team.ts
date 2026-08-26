export interface TeamListItem {
  id: number;
  name: string;
  code: string;
  joinedAt: string; // Team.createdAt — when this team first ever registered
  sessionsJoined: number; // count of game_session_teams rows for this team
}

export interface TeamsListedPayload {
  items: TeamListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export const TEAMS_SORT_COLUMNS = ['joinedAt', 'sessionsJoined'] as const;
export type TeamsSortColumn = (typeof TEAMS_SORT_COLUMNS)[number];
export type TeamsSortOrder = 'asc' | 'desc';
