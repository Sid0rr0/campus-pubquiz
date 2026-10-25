import type { Verdict } from './answer-kind';
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
  /** Sum of the player counts teams reported, departed teams included — null when no team in the session reported one. */
  totalPlayers: number | null;
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
  /** The player count the team reported, null when it gave none. Kept for a team that has left. */
  playerCount: number | null;
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
  /** The Session rating: every round rating of the session, each counting once. Null when nobody rated or feedback was off. */
  rating: SessionDetailRoundRating | null;
}

export interface SessionDetailRoundRow {
  roundId: number;
  title: string;
  category: string | null;
  /** Null when no team rated the round. */
  rating: SessionDetailRoundRating | null;
  // Correct answers ÷ (teamCount * the round's questions that have a correct
  // rate). Null when the round has none (e.g. only closest_guess questions).
  correctRate: number | null;
  // Points actually earned ÷ points achievable (teamCount * round's max points).
  pointsPercent: number;
  /** Mean `responseMs` over the round's answers that have one; null when none does. */
  avgResponseMs: number | null;
}

export interface SessionDetailQuestionRow {
  questionId: number;
  roundId: number;
  roundTitle: string;
  orderIndex: number;
  prompt: string;
  type: string;
  /** The correct answer as people read it: rounds can repeat a prompt over different media. */
  answer: string;
  points: number;
  answeredCount: number;
  correctCount: number;
  // Credit per answer by verdict ÷ teamCount: `correct` counts 1, `partial`
  // counts its points' share of the question's points, anything else 0.
  // Null for a closest_guess question (one winner by design) and for a
  // session with no participants.
  correctRate: number | null;
  fastestResponseMs: number | null;
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
  bonus: SessionDetailBonusSummary;
  // Winning team's total minus the runner-up's — null with fewer than 2 teams.
  winningMargin: number | null;
}

/** How many players came, from the counts teams reported. Teams that gave none are left out, never counted as zero. */
export interface SessionDetailPlayerCount {
  /** Sum of the known counts across every participant, departed teams included. */
  total: number;
  /** total ÷ reportedTeams — null when no team reported. */
  average: number | null;
  /** How many participants gave a count. */
  reportedTeams: number;
}

/** One ended session with feedback on, in the Feedback trends page's ratings-over-time table. */
export interface FeedbackTrendsSession {
  id: number;
  /** The session's display name, as everywhere else. */
  name: string;
  date: string; // game_sessions.created_at, ISO
  /** Average of every round rating the session got — null when nobody rated. */
  rating: SessionDetailRoundRating | null;
}

/** A round needs at least this many ratings to appear in the best/worst lists. */
export const MIN_RATINGS_FOR_RANKING = 3;
/** How many rounds each of the best/worst lists holds. */
export const TREND_ROUNDS_LIMIT = 5;

/** One round of one session in the best/worst lists. */
export interface FeedbackTrendsRound {
  sessionId: number;
  /** The session's display name, as everywhere else. */
  sessionName: string;
  roundTitle: string;
  average: number;
  count: number;
}

/** Anonymous feedback across many ended sessions, behind `/stats/feedback`. Never carries a team. */
export interface FeedbackTrends {
  /** Oldest to newest. Sessions with feedback off are left out. */
  sessions: FeedbackTrendsSession[];
  /** Topic suggestions from those sessions, grouped like a single session's; sorted by count, then alphabetically. */
  topics: SessionDetailFeedbackTopic[];
  /** Highest average first; ties by more ratings, then the newer session. */
  bestRounds: FeedbackTrendsRound[];
  /** Lowest average first; ties by more ratings, then the newer session. */
  worstRounds: FeedbackTrendsRound[];
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
  playerCount: SessionDetailPlayerCount;
  difficulty: {
    averagePercent: number;
    label: QuizDifficultyLabel;
  };
  standings: SessionDetailStandingRow[];
  rounds: SessionDetailRoundRow[];
  feedback: SessionDetailFeedback;
  questions: SessionDetailQuestionRow[];
  highlights: SessionDetailHighlights;
  /** Every stored answer, departed teams' included; a team with no answer to a question has no cell. */
  scoresheet: SessionDetailScoresheetCell[];
}

/** One team's answer to one question on the Scoresheet. */
export interface SessionDetailScoresheetCell {
  teamId: number;
  questionId: number;
  /** Doubled when the answer is to a question of the team's joker round, so a row adds up to the team's total. */
  pointsAwarded: number;
  /** The question is in the team's joker round: the cell draws a joker mark. */
  isJoker: boolean;
  /** Null while the answer is ungraded. */
  verdict: Verdict | null;
  /** The team's answer as people read it. */
  answer: string;
}
