import type { BonusCategory } from './socket-events';

/** One row per **ended** game session, for the admin/moderator stats history view. */
export interface PlayedSessionStats {
  gameSessionId: number;
  joinCode: string;
  quizTitle: string;
  playedAt: string; // game_sessions.created_at, ISO
  teamCount: number; // game_session_teams rows for this session
  maxPoints: number; // sum(questions.points) over the session's quiz
  // Leaderboard winner (ranked by total incl. bonus, same order as
  // AnswerService.computeLeaderboard: total desc, team name asc) — null when
  // no teams joined.
  winnerTeamName: string | null;
  winnerAnswerPoints: number | null; // that team's answer points only, bonus excluded
}

export type QuizDifficultyLabel = 'Easy' | 'Medium' | 'Hard' | 'Brutal';

export interface SessionDetailStandingRow {
  rank: number;
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

export interface SessionDetailRoundRow {
  roundId: number;
  title: string;
  category: string | null;
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
  playedAt: string; // ISO
  teamCount: number;
  maxPoints: number;
  difficulty: {
    averagePercent: number;
    label: QuizDifficultyLabel;
  };
  standings: SessionDetailStandingRow[];
  rounds: SessionDetailRoundRow[];
  questions: SessionDetailQuestionRow[];
  highlights: SessionDetailHighlights;
}
