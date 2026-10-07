import type { BonusCategory } from './bonus';

/** One row per **ended** game session, for the admin/moderator stats history view. */
export interface PlayedSessionStats {
  gameSessionId: number;
  joinCode: string;
  quizTitle: string;
  /** The session's display name — a custom name set at creation/rename, or quizTitle when none was set. */
  name: string;
  playedAt: string; // game_sessions.created_at, ISO
  teamCount: number; // everyone who took part: roster teams plus any kicked/departed team that answered or got a bonus
  maxPoints: number; // sum(questions.points) over the session's quiz
  // The session's single Standings winner — never a team that left, the
  // showdown winner when a showdown broke a tie, name order when a tie for
  // first was never broken — null when no team is on the roster.
  winnerTeamName: string | null;
  winnerPoints: number | null; // that team's winning total, bonus (and any showdown bonus) included
}

export interface PlayedSessionsListedPayload {
  items: PlayedSessionStats[];
  total: number;
  page: number;
  pageSize: number;
}

/** Request body for PATCH /stats/sessions/:id — sets a played session's custom display name. A blank name clears it, falling back to the quiz's title. */
export interface RenameSessionPayload {
  name: string;
}

export const PLAYED_SESSIONS_SORT_COLUMNS = [
  'quizTitle',
  'playedAt',
  'teamCount',
  'maxPoints',
  'winner',
] as const;
export type PlayedSessionsSortColumn =
  (typeof PLAYED_SESSIONS_SORT_COLUMNS)[number];
export type PlayedSessionsSortOrder = 'asc' | 'desc';

export type QuizDifficultyLabel = 'Easy' | 'Medium' | 'Hard' | 'Brutal';

export interface SessionDetailStandingRow {
  /** Competition rank shared by tied teams — null for a team that has left (kicked or left on its own), which is listed below every ranked team. */
  rank: number | null;
  /** Last place this team's tie group spans (equal to `rank` when not tied) — null when `rank` is. */
  rankTo: number | null;
  /** True for a team that took part but is no longer on the roster. */
  hasLeft: boolean;
  /** True on the session's single winner's row, even when its rank is shared. Never true for a team that has left. */
  isWinner: boolean;
  teamId: number;
  teamName: string;
  answerPoints: number;
  bonusPoints: number;
  total: number;
  correctCount: number;
  // Average responseMs over this team's answers that have one recorded —
  // null when none of its answers have a recorded response time (e.g. every
  // answer predates the responseMs column).
  avgResponseMs: number | null;
}

/** Anonymous summary of the 1–5 star ratings teams gave a round — never says who rated. */
export interface SessionDetailRoundRating {
  average: number;
  count: number;
}

/** One "Anything else" comment — text and when it was sent, never the team. */
export interface SessionDetailFeedbackComment {
  text: string;
  submittedAt: string; // ISO
}

/** Topic suggestions that match regardless of capitals and spaces, shown in their most common spelling. */
export interface SessionDetailFeedbackTopic {
  topic: string;
  count: number;
}

/** What teams said about a session, anonymously. */
export interface SessionDetailFeedback {
  /** The session's "Collect feedback" setting; when false the lists are empty and the page says feedback was off. */
  collected: boolean;
  /** Newest first, empty comments skipped. */
  comments: SessionDetailFeedbackComment[];
  /** Sorted by count, then alphabetically. */
  topics: SessionDetailFeedbackTopic[];
}

export interface SessionDetailRoundRow {
  roundId: number;
  title: string;
  category: string | null;
  /** Null when no team rated the round. */
  rating: SessionDetailRoundRating | null;
  // Correct answers ÷ (teamCount * questions in this round).
  correctRate: number;
  // Points actually earned ÷ points achievable (teamCount * round's max points).
  pointsPercent: number;
}

export interface SessionDetailQuestionRow {
  questionId: number;
  roundTitle: string;
  orderIndex: number;
  prompt: string;
  type: string;
  points: number;
  answeredCount: number;
  correctCount: number;
  // correctCount / teamCount — except for `match`, where partial credit makes
  // a binary rate misleading, so it's points earned / points achievable
  // (teamCount * points) instead.
  correctRate: number;
  fastestResponseMs: number | null;
}

export interface SessionDetailFastestAnswer {
  teamName: string;
  questionId: number;
  responseMs: number;
}

export interface SessionDetailFastestTeam {
  teamName: string;
  avgResponseMs: number;
}

export interface SessionDetailBonusSummary {
  total: number;
  byCategory: Record<BonusCategory, number>;
  count: number;
}

export interface SessionDetailHighlights {
  hardestQuestionId: number | null;
  easiestQuestionId: number | null;
  hardestRoundId: number | null;
  allCorrectQuestionIds: number[];
  noneCorrectQuestionIds: number[];
  fastestAnswer: SessionDetailFastestAnswer | null;
  fastestTeam: SessionDetailFastestTeam | null;
  bonus: SessionDetailBonusSummary;
  // Winning team's total minus the runner-up's — null with fewer than 2 teams.
  winningMargin: number | null;
}

/** Deep-dive stats for one ended session, behind `/stats/:id`. */
export interface SessionDetailStats {
  gameSessionId: number;
  joinCode: string;
  quizTitle: string;
  /** The session's display name — a custom name set at creation/rename, or quizTitle when none was set. */
  name: string;
  playedAt: string; // ISO
  teamCount: number;
  maxPoints: number;
  difficulty: {
    averagePercent: number;
    label: QuizDifficultyLabel;
  };
  standings: SessionDetailStandingRow[];
  rounds: SessionDetailRoundRow[];
  feedback: SessionDetailFeedback;
  questions: SessionDetailQuestionRow[];
  highlights: SessionDetailHighlights;
}
