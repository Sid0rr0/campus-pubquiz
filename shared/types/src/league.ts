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

/** Request body for POST /leagues/:id/sessions. */
export interface AddLeagueSessionPayload {
  gameSessionId: number;
}
