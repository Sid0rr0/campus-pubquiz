/** An ended session that counts towards a league. */
export interface LeagueSessionView {
  gameSessionId: number;
  joinCode: string;
  /** The session's display name: its custom name, else its quiz's title. */
  name: string;
  /** When the session was created, ISO. */
  playedAt: string;
}

/** A league as staff see it: its label dates, whether it is current, and the ended sessions in it. */
export interface LeagueView {
  id: number;
  name: string;
  /** Calendar date, `YYYY-MM-DD`: a label, never a membership rule. */
  startsOn: string;
  /** Calendar date, `YYYY-MM-DD`; a league is current while this is today or later. */
  endsOn: string;
  current: boolean;
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
  /** Sessions where the team was the single Standings winner. */
  nightsWon: number;
  /** Mean placing to one decimal; null when the team never held a placing (it left every night). */
  averagePlacing: number | null;
  /** 1-based competition position: teams level on every tie-break share it (1, 1, 3). */
  position: number;
}

/** A league's table, as `GET /leagues/:id/table` returns it. No codes, no feedback. */
export interface LeagueTable {
  id: number;
  name: string;
  startsOn: string;
  endsOn: string;
  current: boolean;
  rows: LeagueTableRow[];
}

/** A league as the public page lists it: no sessions. */
export interface PublicLeague {
  id: number;
  name: string;
  startsOn: string;
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
