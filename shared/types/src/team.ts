export interface TeamListItem {
  id: number;
  name: string;
  code: string;
  joinedAt: string; // Team.createdAt — when this team first ever registered
  sessionsJoined: number; // count of game_session_teams rows for this team
}

/** A single team's persistent join code, looked up on demand (e.g. the control panel's "Show team code" action) rather than broadcast with every game state update. */
export interface TeamCodeView {
  teamId: number;
  teamName: string;
  code: string;
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
