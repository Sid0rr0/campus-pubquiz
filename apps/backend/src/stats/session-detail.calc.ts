import {
  BONUS_CATEGORIES,
  compareTeamNames,
  type BonusCategory,
  type QuestionType,
  type QuizDifficultyLabel,
  type Verdict,
  type SessionDetailBonusSummary,
  type SessionDetailFastestAnswer,
  type SessionDetailFastestTeam,
  type SessionDetailQuestionRow,
  type SessionDetailRoundRow,
  type SessionDetailStandingRow,
  type SessionDetailStats,
} from '@campus-pubquiz/types';
import { sessionResult, type TeamResult } from '@/standings/session-result';
import type { SessionStandings } from '@/standings/standings.service';
import { summarisePlayerCounts } from '@/stats/player-count.calc';
import { computeSessionFeedback } from '@/stats/session-feedback.calc';

export interface SessionDetailSessionRow {
  gameSessionId: number;
  joinCode: string;
  quizTitle: string;
  name: string;
  playedAt: string | Date;
}

export interface SessionDetailRoundInputRow {
  roundId: number;
  title: string;
  category: string | null;
  orderIndex: number;
}

export interface SessionDetailRoundRatingInputRow {
  roundId: number;
  average: number;
  count: number;
}

/** One team's session feedback, already stripped of the team. Rows arrive oldest first. */
export interface SessionDetailFeedbackInputRow {
  comment: string;
  topics: string[];
  submittedAt: string | Date;
}

export interface SessionDetailQuestionInputRow {
  questionId: number;
  roundId: number;
  orderIndex: number;
  prompt: string;
  type: QuestionType;
  /** The correct answer, already worded for people. */
  answer: string;
  points: number;
}

export interface SessionDetailAnswerInputRow {
  questionId: number;
  teamId: number;
  teamName: string;
  pointsAwarded: number;
  gradedAt: string | Date | null;
  verdict: Verdict | null;
  responseMs: number | null;
}

export interface SessionDetailBonusInputRow {
  teamId: number;
  category: BonusCategory;
  points: number;
}

export interface SessionDetailInput {
  session: SessionDetailSessionRow;
  /** Who took part and how they rank — decided by the Standings service, passed through as given. */
  standings: SessionStandings;
  /** Reported player count by team id; a team that gave none has no entry. */
  playerCounts: ReadonlyMap<number, number>;
  rounds: SessionDetailRoundInputRow[];
  /** One row per round at least one team rated; an unrated round has none. */
  roundRatings: SessionDetailRoundRatingInputRow[];
  /** The session's "Collect feedback" setting. */
  isFeedbackCollected: boolean;
  feedback: SessionDetailFeedbackInputRow[];
  questions: SessionDetailQuestionInputRow[];
  answers: SessionDetailAnswerInputRow[];
  bonusAwards: SessionDetailBonusInputRow[];
}

// Named thresholds for the quiz-wide difficulty label (Definitions in the
// session-detail plan): average team answer points ÷ max points.
const DIFFICULTY_THRESHOLDS: readonly {
  min: number;
  label: QuizDifficultyLabel;
}[] = [
  { min: 75, label: 'Easy' },
  { min: 50, label: 'Medium' },
  { min: 25, label: 'Hard' },
  { min: 0, label: 'Brutal' },
];

function getDifficultyLabel(averagePercent: number): QuizDifficultyLabel {
  return (
    DIFFICULTY_THRESHOLDS.find((t) => averagePercent >= t.min)?.label ??
    'Brutal'
  );
}

/** First row achieving the min/max of `getValue` — ties keep the earlier
 * row, so callers relying on `rows` already being in display order get the
 * "ties go to the earlier question/round" rule for free. */
function pickExtreme<T>(
  rows: readonly T[],
  getValue: (row: T) => number,
  mode: 'min' | 'max',
): T | null {
  if (rows.length === 0) return null;
  return rows.reduce((best, row) => {
    const value = getValue(row);
    const bestValue = getValue(best);
    return mode === 'min'
      ? value < bestValue
        ? row
        : best
      : value > bestValue
        ? row
        : best;
  });
}

function pickFastestAnswer(
  answers: readonly SessionDetailAnswerInputRow[],
): SessionDetailFastestAnswer | null {
  const timed = answers.filter(
    (a): a is SessionDetailAnswerInputRow & { responseMs: number } =>
      a.responseMs !== null,
  );
  if (timed.length === 0) return null;
  const fastest = timed.reduce((current, row) =>
    row.responseMs < current.responseMs ||
    (row.responseMs === current.responseMs &&
      compareTeamNames(row.teamName, current.teamName) < 0)
      ? row
      : current,
  );
  return {
    teamName: fastest.teamName,
    questionId: fastest.questionId,
    responseMs: fastest.responseMs,
  };
}

function pickFastestTeam(
  standings: readonly SessionDetailStandingRow[],
): SessionDetailFastestTeam | null {
  const timed = standings.filter(
    (s): s is SessionDetailStandingRow & { avgResponseMs: number } =>
      s.avgResponseMs !== null,
  );
  if (timed.length === 0) return null;
  const fastest = timed.reduce((current, row) =>
    row.avgResponseMs < current.avgResponseMs ||
    (row.avgResponseMs === current.avgResponseMs &&
      compareTeamNames(row.teamName, current.teamName) < 0)
      ? row
      : current,
  );
  return { teamName: fastest.teamName, avgResponseMs: fastest.avgResponseMs };
}

function computeBonusSummary(
  bonusAwards: readonly SessionDetailBonusInputRow[],
): SessionDetailBonusSummary {
  const byCategory = Object.fromEntries(
    BONUS_CATEGORIES.map((category) => [category, 0]),
  ) as Record<BonusCategory, number>;
  for (const award of bonusAwards) {
    byCategory[award.category] += award.points;
  }
  return {
    total: bonusAwards.reduce((sum, award) => sum + award.points, 0),
    byCategory,
    count: bonusAwards.length,
  };
}

/**
 * Pure aggregation over one ended session's rows into `SessionDetailStats` —
 * StatsService.getSessionDetail fetches the rows, this does all the math, so
 * the interesting logic is testable without a database.
 */
export function computeSessionDetail(
  input: SessionDetailInput,
): SessionDetailStats {
  const {
    session,
    standings: sessionStandings,
    playerCounts,
    rounds,
    roundRatings,
    isFeedbackCollected,
    feedback,
    questions,
    answers,
    bonusAwards,
  } = input;
  const result = sessionResult({
    standings: sessionStandings,
    questions: questions.map((q) => ({
      id: q.questionId,
      roundId: q.roundId,
      type: q.type,
      points: q.points,
    })),
    answers,
  });
  const { participantCount: teamCount, maxPoints } = result;
  const questionResultById = new Map(
    result.questions.map((q) => [q.questionId, q]),
  );

  const toRow = (team: TeamResult): SessionDetailStandingRow => {
    const timedResponses = answers
      .filter((a) => a.teamId === team.teamId)
      .map((a) => a.responseMs)
      .filter((ms): ms is number => ms !== null);
    return {
      rank: team.placing,
      rankTo: team.placingTo,
      hasLeft: team.hasLeft,
      isWinner: team.isSessionWinner,
      teamId: team.teamId,
      teamName: team.teamName,
      playerCount: playerCounts.get(team.teamId) ?? null,
      answerPoints: team.answerPoints,
      bonusPoints: team.bonusPoints,
      total: team.totalPoints,
      correctCount: team.correctCount,
      avgResponseMs:
        timedResponses.length > 0
          ? timedResponses.reduce((sum, ms) => sum + ms, 0) /
            timedResponses.length
          : null,
    };
  };
  // Ranked teams first, in the order the Session result gives them, then the
  // ones that left — this function never sorts or ranks.
  const standings: SessionDetailStandingRow[] = result.teams.map(toRow);

  const sortedRounds = [...rounds].sort((a, b) => a.orderIndex - b.orderIndex);
  const roundTitleById = new Map(
    sortedRounds.map((round) => [round.roundId, round.title]),
  );
  const roundOrderById = new Map(
    sortedRounds.map((round, index) => [round.roundId, index]),
  );

  const ratingByRoundId = new Map(roundRatings.map((r) => [r.roundId, r]));
  const roundRows: SessionDetailRoundRow[] = sortedRounds.map((round) => {
    const roundQuestions = questions.filter((q) => q.roundId === round.roundId);
    const roundQuestionIds = new Set(roundQuestions.map((q) => q.questionId));
    const roundMaxPoints = roundQuestions.reduce((sum, q) => sum + q.points, 0);
    const roundAnswers = answers.filter((a) =>
      roundQuestionIds.has(a.questionId),
    );
    const achievablePoints = teamCount * roundMaxPoints;
    const rating = ratingByRoundId.get(round.roundId);
    // Only the questions that have a correct rate count towards the round's.
    const ratedResults = roundQuestions.flatMap((q) => {
      const r = questionResultById.get(q.questionId);
      return r && r.correctRate !== null ? [r] : [];
    });
    return {
      roundId: round.roundId,
      title: round.title,
      category: round.category,
      rating: rating ? { average: rating.average, count: rating.count } : null,
      // The mean of the questions' own rates, so a partial answer counts the
      // same way here as it does on the question row.
      correctRate:
        ratedResults.length > 0
          ? ratedResults.reduce((sum, r) => sum + (r.correctRate ?? 0), 0) /
            ratedResults.length
          : null,
      pointsPercent:
        achievablePoints > 0
          ? (roundAnswers.reduce((sum, a) => sum + a.pointsAwarded, 0) /
              achievablePoints) *
            100
          : 0,
    };
  });

  // Display order: round order, then question order within the round —
  // also the order pickExtreme relies on for "ties go to the earlier one".
  const sortedQuestions = [...questions].sort((a, b) => {
    const roundDiff =
      (roundOrderById.get(a.roundId) ?? 0) -
      (roundOrderById.get(b.roundId) ?? 0);
    return roundDiff !== 0 ? roundDiff : a.orderIndex - b.orderIndex;
  });

  const questionRows: SessionDetailQuestionRow[] = sortedQuestions.map(
    (question) => {
      const questionAnswers = answers.filter(
        (a) => a.questionId === question.questionId,
      );
      const timedResponses = questionAnswers
        .map((a) => a.responseMs)
        .filter((ms): ms is number => ms !== null);
      const questionResult = questionResultById.get(question.questionId);
      return {
        questionId: question.questionId,
        roundTitle: roundTitleById.get(question.roundId) ?? '',
        orderIndex: question.orderIndex,
        prompt: question.prompt,
        type: question.type,
        answer: question.answer,
        points: question.points,
        answeredCount: questionResult?.answeredCount ?? 0,
        correctCount: questionResult?.correctCount ?? 0,
        correctRate: questionResult?.correctRate ?? null,
        fastestResponseMs:
          timedResponses.length > 0 ? Math.min(...timedResponses) : null,
      };
    },
  );

  // Highlights consider only rows that have a correct rate (none do when the
  // session has no participants).
  const ratedQuestions = questionRows.filter(
    (row): row is SessionDetailQuestionRow & { correctRate: number } =>
      row.correctRate !== null,
  );
  const ratedRounds = roundRows.filter(
    (row): row is SessionDetailRoundRow & { correctRate: number } =>
      row.correctRate !== null,
  );

  const avgAnswerPoints =
    teamCount > 0
      ? standings.reduce((sum, s) => sum + s.answerPoints, 0) / teamCount
      : 0;
  const averagePercent =
    maxPoints > 0 ? (avgAnswerPoints / maxPoints) * 100 : 0;

  return {
    gameSessionId: session.gameSessionId,
    joinCode: session.joinCode,
    quizTitle: session.quizTitle,
    name: session.name,
    playedAt: new Date(session.playedAt).toISOString(),
    teamCount,
    maxPoints,
    playerCount: summarisePlayerCounts(standings.map((s) => s.playerCount)),
    difficulty: {
      averagePercent,
      label: getDifficultyLabel(averagePercent),
    },
    standings,
    rounds: roundRows,
    feedback: computeSessionFeedback(isFeedbackCollected, feedback),
    questions: questionRows,
    highlights: {
      hardestQuestionId:
        pickExtreme(ratedQuestions, (row) => row.correctRate, 'min')
          ?.questionId ?? null,
      easiestQuestionId:
        pickExtreme(ratedQuestions, (row) => row.correctRate, 'max')
          ?.questionId ?? null,
      hardestRoundId:
        pickExtreme(ratedRounds, (row) => row.correctRate, 'min')?.roundId ??
        null,
      allCorrectQuestionIds: ratedQuestions
        .filter((row) => row.correctCount === teamCount)
        .map((row) => row.questionId),
      noneCorrectQuestionIds: ratedQuestions
        .filter((row) => row.correctCount === 0)
        .map((row) => row.questionId),
      fastestAnswer: pickFastestAnswer(answers),
      fastestTeam: pickFastestTeam(standings),
      bonus: computeBonusSummary(bonusAwards),
      winningMargin:
        sessionStandings.leaderboard.length >= 2
          ? sessionStandings.leaderboard[0].totalPoints -
            sessionStandings.leaderboard[1].totalPoints
          : null,
    },
  };
}
