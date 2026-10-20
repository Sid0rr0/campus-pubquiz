/** An ended session that counts towards a league. */
export interface LeagueSessionView {
  gameSessionId: number;
  joinCode: string;
  /** The session's display name: its custom name, else its quiz's title. */
  name: string;
  /** When the session was created, ISO. */
  playedAt: string;
}

/** A league as staff see it (a {@link PublicLeague} plus its sessions): its label dates, whether it is current, and the ended sessions in it. */
export interface LeagueView extends PublicLeague {
  sessions: LeagueSessionView[];
}

export interface LeaguesListedPayload {
  items: LeagueView[];
}

/** Request body for POST /leagues and PATCH /leagues/:id. */
export interface LeagueFields {
  name: string;
  startsOn: string;
  endsOn: string;
}

/** One team's line in a league table. */
export interface LeagueTableRow {
  teamId: number;
  teamName: string;
  leaguePoints: number;
  /** Ended member sessions the team answered in. */
  nightsPlayed: number;
  /** Sessions where the team's Standings placing was 1 (every team tied for first counts). */
  nightsWon: number;
  /** Mean placing to one decimal; null when the team never held a placing (it left every night). */
  averagePlacing: number | null;
  /** 1-based competition position: teams level on every tie-break share it (1, 1, 3). */
  position: number;
}

/** A league's table, as `GET /leagues/:id/table` returns it. No codes, no feedback. */
export interface LeagueTable extends PublicLeague {
  rows: LeagueTableRow[];
}

/** How many rows the big screen lobby shows of the session league's table. */
export const LEAGUE_TOP_SIZE = 5;

/** The lobby's league: its name and the top rows of its table. */
export interface LeagueTop {
  name: string;
  rows: LeagueTableRow[];
}

/** A team's standing in one current league, as its team page shows it. */
export interface TeamLeaguePosition {
  leagueId: number;
  leagueName: string;
  /** Same position as the public table: teams level on every tie-break share it. */
  position: number;
  /** True when another team holds the same position (shown as "Joint 3rd"). */
  shared: boolean;
  /** Teams in the league's table. */
  teamCount: number;
  leaguePoints: number;
}

/** A league as the public page lists it: no sessions. */
export interface PublicLeague {
  id: number;
  name: string;
  /** Calendar date, `YYYY-MM-DD`: a label, never a membership rule. */
  startsOn: string;
  /** Calendar date, `YYYY-MM-DD`; a league is current while this is today or later. */
  endsOn: string;
  current: boolean;
}

/** Response of `GET /leagues/public`: current leagues first, then the rest. */
export interface PublicLeaguesPayload {
  items: PublicLeague[];
}

/** Request body for POST /leagues/:id/sessions. */
export interface AddLeagueSessionPayload {
  gameSessionId: number;
}
