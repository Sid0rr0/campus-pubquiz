import type { AnswerKind, Verdict } from './answer-kind';
import type { TeamLeaguePosition } from './league';
import type { QuestionType } from './question-types';

export interface TeamListItem {
  id: number;
  name: string;
  code: string;
  joinedAt: string; // Team.createdAt — when this team first ever registered
  sessionsJoined: number; // ended sessions this team took part in; equals the team page's sessionsPlayed
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
export type TeamPageHistory = Omit<TeamDetail, 'id'> & {
  /** The team's position in each current league where it has points; empty when none. */
  leagues: TeamLeaguePosition[];
};

/** One question of an ended night as the team that played it sees it: its own answer, the verdict and the right answer. Never another team's answer. */
export interface TeamNightQuestion {
  questionId: number;
  roundTitle: string;
  /** 1-based position of the question's round in the quiz. */
  roundNumber: number;
  /** 1-based position of the question within its round. */
  questionNumber: number;
  prompt: string;
  type: QuestionType;
  /** How the question is answered, so the page renders both answers by kind. */
  answerKind: AnswerKind;
  /** The question's points. */
  points: number;
  /** The team's answer as readable text; null when it gave none. */
  teamAnswer: string | null;
  /** Null while the answer is ungraded (or when there is no answer). */
  verdict: Verdict | null;
  pointsAwarded: number;
  /** The key as readable text. */
  correctAnswer: string;
}

/** One ended night in a team's history, behind `POST /team-page/sessions/:sessionId`. */
export interface TeamNightDetail {
  gameSessionId: number;
  name: string;
  playedAt: string; // ISO
  /** In quiz order: round by round. */
  questions: TeamNightQuestion[];
}

/** Why two teams can't be merged. */
export type TeamMergeRefusal =
  /** Both teams took part in (or have rows for) the same session(s), named. */
  | { kind: 'shared_session'; sessionNames: string[] }
  /** One of the teams took part in a session that hasn't ended. */
  | { kind: 'unended_session'; teamId: number; teamName: string };

/** One other team in the merge picker: mergeable, or refused with the reason. */
export interface TeamMergeCandidate {
  id: number;
  name: string;
  sessionsPlayed: number;
  /** Null when the team can be merged with the one being viewed. */
  refusal: TeamMergeRefusal | null;
}

/** `GET /teams/:id/merge-preview`: every other team, mergeable or refused. */
export interface TeamMergeCandidatesPayload {
  candidates: TeamMergeCandidate[];
}

/** `GET /teams/:id/merge-preview?otherTeamId=`: the confirm step of one pair. */
export interface TeamMergePairPreview {
  teams: { id: number; name: string; sessionsPlayed: number }[];
  /** Sessions played by the kept team after the merge. */
  combinedSessionsPlayed: number;
  /** The newer team: its code and phones carry over. */
  newerTeamId: number;
  newerTeamName: string;
  /** The kept team's code, to read out to the team. */
  keptCode: string;
}

/** Body of `POST /teams/:id/merge`. `name` must be one of the two teams' current names. */
export interface TeamMergeRequest {
  otherTeamId: number;
  name: string;
}

/** Reply of `POST /teams/:id/merge`. */
export interface TeamMergedPayload {
  keptTeamId: number;
}

export const TEAMS_SORT_COLUMNS = [
  'joinedAt',
  'sessionsJoined',
  'averagePlacing',
] as const;
export type TeamsSortColumn = (typeof TEAMS_SORT_COLUMNS)[number];
export type TeamsSortOrder = 'asc' | 'desc';
