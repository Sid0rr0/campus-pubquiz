export interface TeamListItem {
  id: number;
  name: string;
  code: string;
  joinedAt: string; // Team.createdAt — when this team first ever registered
  sessionsJoined: number; // count of game_session_teams rows for this team
  /** Mean placing over ended sessions to one decimal (same figure as the team page), null when the team has no placing. */
  averagePlacing: number | null;
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

/** One ended session a team took part in, as it appears on the team's stats page. */
export interface TeamSessionRow {
  gameSessionId: number;
  name: string;
  playedAt: string; // ISO
  /** Competition rank in the session's Standings — null when the team left (kicked or left on its own). */
  placing: number | null;
  /** Last place the team's tie group spans (equal to `placing` when not tied) — null when `placing` is. */
  placingTo: number | null;
  /** Everyone who took part in the session, departed teams included. */
  teamCount: number;
  hasLeft: boolean;
  totalPoints: number;
  maxPoints: number;
  correctCount: number;
  /** Null when the team reported no player count for the session. */
  playerCount: number | null;
}

/** A team's record over its ended sessions. Left sessions count as played but never as a placing. */
export interface TeamStatsSummary {
  sessionsPlayed: number;
  wins: number;
  podiums: number;
  bestPlacing: number | null;
  /** Mean placing to one decimal, null when the team has no placing. */
  averagePlacing: number | null;
  /** Mean over played sessions of total ÷ max points, as a percentage (0–100). Null with no sessions. */
  averageSharePercent: number | null;
  averageTotalPoints: number | null;
  /** Over sessions with a reported count, null when none. */
  averagePlayerCount: number | null;
}

/** One team's history, behind `/teams/:id`. Never carries feedback or the team code. */
export interface TeamDetail {
  id: number;
  name: string;
  summary: TeamStatsSummary;
  /** Newest first. */
  sessions: TeamSessionRow[];
}

/** A team's history as the team itself sees it, behind `POST /team-page`: the staff figures without the team id. Never carries feedback or the team code. */
export type TeamPageHistory = Omit<TeamDetail, 'id'>;

export const TEAMS_SORT_COLUMNS = [
  'joinedAt',
  'sessionsJoined',
  'averagePlacing',
] as const;
export type TeamsSortColumn = (typeof TEAMS_SORT_COLUMNS)[number];
export type TeamsSortOrder = 'asc' | 'desc';
