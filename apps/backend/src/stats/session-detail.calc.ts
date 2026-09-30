import {
  BONUS_CATEGORIES,
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

export interface SessionDetailSessionRow {
  gameSessionId: number;
  joinCode: string;
  quizTitle: string;
  name: string;
  playedAt: string | Date;
}

export interface SessionDetailTeamRow {
  teamId: number;
  teamName: string;
}

export interface SessionDetailRoundInputRow {
  roundId: number;
  title: string;
  category: string | null;
  orderIndex: number;
}

export interface SessionDetailQuestionInputRow {
  questionId: number;
  roundId: number;
  orderIndex: number;
  prompt: string;
  type: QuestionType;
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
  teams: SessionDetailTeamRow[];
  rounds: SessionDetailRoundInputRow[];
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

/** A correct answer is one whose stored verdict is `correct` — the same
 * verdict the grading panel counted live, so a speed-scaled kahoot answer
 * counts while partial `match` credit and ungraded answers (null) don't. */
function isCorrect(answer: SessionDetailAnswerInputRow): boolean {
  return answer.verdict === 'correct';
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
      row.teamName.localeCompare(current.teamName) < 0)
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
      row.teamName.localeCompare(current.teamName) < 0)
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
  const { session, teams, rounds, questions, answers, bonusAwards } = input;
  const teamCount = teams.length;
  const maxPoints = questions.reduce((sum, q) => sum + q.points, 0);

  const standings: SessionDetailStandingRow[] = teams.map((team) => {
    const teamAnswers = answers.filter((a) => a.teamId === team.teamId);
    const answerPoints = teamAnswers.reduce(
      (sum, a) => sum + a.pointsAwarded,
      0,
    );
    const bonusPoints = bonusAwards
      .filter((b) => b.teamId === team.teamId)
      .reduce((sum, b) => sum + b.points, 0);
    const timedResponses = teamAnswers
      .map((a) => a.responseMs)
      .filter((ms): ms is number => ms !== null);
    return {
      rank: 0, // assigned below, after sorting
      teamId: team.teamId,
      teamName: team.teamName,
      answerPoints,
      bonusPoints,
      total: answerPoints + bonusPoints,
      correctCount: teamAnswers.filter(isCorrect).length,
      avgResponseMs:
        timedResponses.length > 0
          ? timedResponses.reduce((sum, ms) => sum + ms, 0) /
            timedResponses.length
          : null,
    };
  });
  // Same ranking as AnswerService.computeLeaderboard: total desc, name asc.
  standings.sort(
    (a, b) => b.total - a.total || a.teamName.localeCompare(b.teamName),
  );
  standings.forEach((row, index) => {
    row.rank = index + 1;
  });

  const sortedRounds = [...rounds].sort((a, b) => a.orderIndex - b.orderIndex);
  const roundTitleById = new Map(
    sortedRounds.map((round) => [round.roundId, round.title]),
  );
  const roundOrderById = new Map(
    sortedRounds.map((round, index) => [round.roundId, index]),
  );

  const roundRows: SessionDetailRoundRow[] = sortedRounds.map((round) => {
    const roundQuestions = questions.filter((q) => q.roundId === round.roundId);
    const roundQuestionIds = new Set(roundQuestions.map((q) => q.questionId));
    const roundMaxPoints = roundQuestions.reduce((sum, q) => sum + q.points, 0);
    const roundAnswers = answers.filter((a) =>
      roundQuestionIds.has(a.questionId),
    );
    const achievablePoints = teamCount * roundMaxPoints;
    return {
      roundId: round.roundId,
      title: round.title,
      category: round.category,
      correctRate:
        teamCount > 0 && roundQuestions.length > 0
          ? roundAnswers.filter(isCorrect).length /
            (teamCount * roundQuestions.length)
          : 0,
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
      // `match` awards partial credit per pair, so a binary correct/incorrect
      // rate hides how close teams got — use points earned ÷ points
      // achievable instead, same idea as a round's pointsPercent.
      const achievableQuestionPoints = teamCount * question.points;
      return {
        questionId: question.questionId,
        roundTitle: roundTitleById.get(question.roundId) ?? '',
        orderIndex: question.orderIndex,
        prompt: question.prompt,
        type: question.type,
        points: question.points,
        answeredCount: questionAnswers.length,
        correctCount: questionAnswers.filter(isCorrect).length,
        correctRate:
          question.type === 'match'
            ? achievableQuestionPoints > 0
              ? questionAnswers.reduce((sum, a) => sum + a.pointsAwarded, 0) /
                achievableQuestionPoints
              : 0
            : teamCount > 0
              ? questionAnswers.filter(isCorrect).length / teamCount
              : 0,
        fastestResponseMs:
          timedResponses.length > 0 ? Math.min(...timedResponses) : null,
      };
    },
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
    difficulty: {
      averagePercent,
      label: getDifficultyLabel(averagePercent),
    },
    standings,
    rounds: roundRows,
    questions: questionRows,
    highlights: {
      hardestQuestionId:
        teamCount > 0
          ? (pickExtreme(questionRows, (row) => row.correctRate, 'min')
              ?.questionId ?? null)
          : null,
      easiestQuestionId:
        teamCount > 0
          ? (pickExtreme(questionRows, (row) => row.correctRate, 'max')
              ?.questionId ?? null)
          : null,
      hardestRoundId:
        teamCount > 0
          ? (pickExtreme(roundRows, (row) => row.correctRate, 'min')?.roundId ??
            null)
          : null,
      allCorrectQuestionIds:
        teamCount > 0
          ? questionRows
              .filter((row) => row.correctCount === teamCount)
              .map((row) => row.questionId)
          : [],
      noneCorrectQuestionIds:
        teamCount > 0
          ? questionRows
              .filter((row) => row.correctCount === 0)
              .map((row) => row.questionId)
          : [],
      fastestAnswer: pickFastestAnswer(answers),
      fastestTeam: pickFastestTeam(standings),
      bonus: computeBonusSummary(bonusAwards),
      winningMargin:
        standings.length >= 2 ? standings[0].total - standings[1].total : null,
    },
  };
}
